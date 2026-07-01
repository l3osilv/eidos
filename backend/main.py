"""
Backend principale — FastAPI.

Questo modulo contiene tutti gli endpoint REST dell'applicazione MedicinAI-BrainCT.
L'architettura segue un flusso lineare che rispecchia il workflow diagnostico reale:
  1. Registrazione/login dell'operatore sanitario
  2. Creazione paziente con caricamento delle 8 slice TC (RF1)
  3. Classificazione automatica delle patologie tramite Modello I (RF2)
  4. Generazione automatica del referto tramite Modello II (RF3)
  5. Controllo di coerenza tra findings e testo del referto (RF4)
  6. Visualizzazione delle slice e dello storico pazienti (RF5, RF6)
  7. Validazione del referto da parte del medico (RF5.3)
  8. Esportazione del referto in formato testuale (RF6.2)

Endpoint implementati e requisiti di riferimento:
  POST   /auth/register               gestione utenti (fuori dagli RF originali, aggiunto per supportare i due ruoli)
  POST   /auth/login                  idem
  PUT    /users/profile               aggiornamento profilo utente
  POST   /patients                    RF1.1, RF1.2
  GET    /patients                    RF6.1
  GET    /patients/{id}               RF6.1
  GET    /patients/{id}/slices/{i}    RF5.1, RF5.2
  POST   /patients/{id}/classify      RF2.1-RF2.4, RNF6.2
  POST   /patients/{id}/report        RF3.1, RNF6.1
  GET    /patients/{id}/coherence     RF4.1
  PUT    /patients/{id}/report        RF3.2, RF3.4
  POST   /patients/{id}/validate      RF5.3 (solo ruolo "medico")
  GET    /patients/{id}/export        RF6.2
  GET    /health                      RNF7.1
"""

import io
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import List

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.security import OAuth2PasswordRequestForm
from PIL import Image

from auth import (
    VALID_ROLES,
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)
from database import patients_collection, users_collection
from model_I import CLASS_THRESHOLDS, classification_model
from model_II import report_model
from schemas import (
    ClassificationResponse,
    CoherenceCheckResponse,
    CoherenceIssue,
    FindingResult,
    PatientStatus,
    ReportResponse,
    ReportUpdateRequest,
    Token,
    UserCreate,
    ProfileUpdate,
)
from storage import save_patient_images

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

EXPECTED_NUM_SLICES = 8


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestore del ciclo di vita dell'applicazione FastAPI.

    All'avvio carica i modelli di classificazione e refertazione in memoria.
    I modelli vengono caricati una volta sola e condivisi tra tutte le richieste
    come singleton — evita di ricaricare i pesi ad ogni richiesta.
    """
    classification_model.load()
    report_model.load()
    yield
    logger.info("Shutdown backend")


app = FastAPI(title="Neuroradiology Support API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # da restringere al dominio del frontend prima di andare in produzione
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers — eliminano la duplicazione tra endpoint
# ---------------------------------------------------------------------------

def _oid(id_str: str) -> ObjectId:
    """Converte una stringa in ObjectId MongoDB. Lancia HTTP 400 se non valido."""
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID paziente non valido")


async def _get_patient(patient_id: str) -> dict:
    """Cerca un paziente per ID, lancia HTTP 404 se non esiste."""
    p = await patients_collection.find_one({"_id": _oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return p


def _patient_status(p: dict) -> PatientStatus:
    """Converte un documento MongoDB paziente in PatientStatus."""
    dn = p["data_nascita"]
    return PatientStatus(
        patient_id=str(p["_id"]),
        nome=p["nome"],
        cognome=p["cognome"],
        codice_fiscale=p["codice_fiscale"],
        data_nascita=date.fromisoformat(dn) if isinstance(dn, str) else dn,
        created_at=p["created_at"],
        num_slices=len(p.get("image_paths", [])),
        has_classification=p.get("findings") is not None,
        has_report=p.get("report_text") is not None,
        validated=p.get("validated", False),
        validated_by=p.get("validated_by"),
    )


def _build_token(user: dict) -> Token:
    """Genera un Token JWT a partire da un documento utente (o dict equivalente)."""
    return Token(
        access_token=create_access_token({"sub": user["username"]}),
        role=user["role"],
        gender=user.get("gender", "M"),
        nome=user.get("nome", ""),
        cognome=user.get("cognome", ""),
        username=user["username"],
        avatar=user.get("avatar"),
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """
    Endpoint di health check (RNF7.1).

    Restituisce lo stato dei modelli caricati e il dispositivo di calcolo in uso.
    Utile per verificare che il backend sia avviato correttamente e che i checkpoint
    siano stati trovati. Non richiede autenticazione.
    """
    import torch

    return {
        "status": "ok",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "model_I_loaded_classes": list(classification_model.models.keys()),
        "model_II_loaded": report_model.model is not None,
    }


# ---------------------------------------------------------------------------
# Auth — due ruoli: medico, specializzando
# ---------------------------------------------------------------------------
@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    """
    Lasciata aperta per la demo/tesi. In un sistema reale
    solo un amministratore dovrebbe poter creare account.
    """
    if user.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Ruolo deve essere uno di: {VALID_ROLES}")

    username = user.username or f"{user.nome}{user.cognome}".lower().replace(" ", "")

    if await users_collection.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username già in uso")

    doc = {
        "username": username,
        "hashed_password": hash_password(user.password),
        "nome": user.nome,
        "cognome": user.cognome,
        "gender": user.gender,
        "role": user.role,
        "avatar": None,
    }
    await users_collection.insert_one(doc)
    return _build_token(doc)


@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Autenticazione con username e password (OAuth2 password flow).

    Verifica le credenziali contro MongoDB e restituisce un token JWT
    valido per 8 ore. Il frontend lo memorizza e lo invia come header
    Authorization: Bearer <token> in ogni richiesta successiva.

    Lancia HTTP 401 se le credenziali sono errate.
    """
    user = await users_collection.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Username o password errati")
    return _build_token(user)


@app.put("/users/profile", response_model=Token)
async def update_profile(
    profile: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Aggiorna il profilo dell'utente corrente (nome, cognome, genere, avatar).

    Dopo l'aggiornamento genera un nuovo token JWT che riflette i dati
    aggiornati — necessario perché il frontend usa i dati dal token per
    personalizzare l'interfaccia (es. "Benvenuto, Dr. Rossi").
    """
    update_fields = {"nome": profile.nome, "cognome": profile.cognome, "gender": profile.gender, "avatar": profile.avatar}
    await users_collection.update_one({"username": current_user["username"]}, {"$set": update_fields})

    # Rileggiamo l'utente aggiornato per costruire un token fresco con i nuovi dati
    updated = await users_collection.find_one({"username": current_user["username"]})
    return _build_token(updated)


# ---------------------------------------------------------------------------
# RF1 — Creazione paziente + caricamento immagini
# ---------------------------------------------------------------------------
@app.post("/patients", response_model=PatientStatus)
async def create_patient(
    nome: str = Form(...),
    cognome: str = Form(...),
    codice_fiscale: str = Form(...),
    data_nascita: date = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Crea un nuovo paziente e salva le 8 slice TC su disco (RF1.1, RF1.2).

    Riceve i dati anagrafici e le immagini come multipart/form-data.
    Valida che siano esattamente 8 file immagine, li converte in grayscale,
    li salva nella cartella dedicata su filesystem, e crea il documento
    paziente in MongoDB con tutti i campi del workflow inizializzati a None.

    Lancia HTTP 400 se il numero di slice è diverso da 8 o se un file non è un'immagine valida.
    """
    if len(files) != EXPECTED_NUM_SLICES:
        raise HTTPException(
            status_code=400,
            detail=f"Servono esattamente {EXPECTED_NUM_SLICES} slice, ricevute {len(files)}",
        )

    images = []
    for f in files:
        content = await f.read()
        try:
            img = Image.open(io.BytesIO(content))
            img.load()
        except Exception:
            raise HTTPException(status_code=400, detail=f"File non valido: {f.filename}")
        images.append(img)

    patient_doc = {
        "nome": nome,
        "cognome": cognome,
        "codice_fiscale": codice_fiscale,
        "data_nascita": data_nascita.isoformat(),
        "created_at": datetime.utcnow(),
        "created_by": current_user["username"],
        "image_paths": [],
        "findings": None,
        "no_finding": None,
        "report_text": None,
        "validated": False,
        "validated_by": None,
    }
    result = await patients_collection.insert_one(patient_doc)
    patient_id = str(result.inserted_id)

    # Le immagini si salvano dopo aver creato il documento Mongo, così la cartella
    # su disco prende lo stesso _id del paziente (RF1: coppia immagine-paziente garantita).
    image_paths = save_patient_images(patient_id, images)
    await patients_collection.update_one(
        {"_id": result.inserted_id}, {"$set": {"image_paths": image_paths}}
    )
    logger.info("Creato paziente %s con %d slice", patient_id, len(images))

    # Aggiorniamo il doc locale per riusare _patient_status
    patient_doc["_id"] = result.inserted_id
    patient_doc["image_paths"] = image_paths
    return _patient_status(patient_doc)


# ---------------------------------------------------------------------------
# RF6 — Storico pazienti
# ---------------------------------------------------------------------------
@app.get("/patients", response_model=List[PatientStatus])
async def list_patients(current_user: dict = Depends(get_current_user)):
    """
    Restituisce la lista di tutti i pazienti con lo stato del workflow (RF6.1).

    Ogni paziente include i flag has_classification, has_report e validated
    che il frontend usa per mostrare lo stato di avanzamento nella dashboard.
    """
    return [_patient_status(p) async for p in patients_collection.find()]


@app.get("/patients/{patient_id}", response_model=PatientStatus)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Restituisce il dettaglio completo di un singolo paziente (RF6.1)."""
    return _patient_status(await _get_patient(patient_id))


# ---------------------------------------------------------------------------
# RF5.1/5.2 — Visualizzazione slice
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/slices/{index}")
async def get_slice(
    patient_id: str, index: int, current_user: dict = Depends(get_current_user)
):
    """
    Restituisce una singola slice TC come immagine PNG (RF5.1, RF5.2).

    L'indice va da 0 a 7 (le 8 slice caricate). L'immagine viene servita
    direttamente dal filesystem via FileResponse.

    Lancia HTTP 404 se il paziente non esiste o l'indice è fuori range.
    """
    p = await _get_patient(patient_id)
    paths = p["image_paths"]
    if not 0 <= index < len(paths):
        raise HTTPException(status_code=404, detail="Slice non trovata")
    return FileResponse(paths[index], media_type="image/png")


# ---------------------------------------------------------------------------
# RF2 — Classificazione (Modello I)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/classify", response_model=ClassificationResponse)
async def classify_patient(
    patient_id: str, force: bool = False, current_user: dict = Depends(get_current_user)
):
    """
    Esegue la classificazione delle patologie sulle 8 slice TC (RF2.1–RF2.4).

    Carica le immagini dal filesystem, le passa al Modello I (4 classificatori
    binari indipendenti) e salva i risultati nel documento paziente.

    Il parametro force=True forza il ricalcolo anche se i findings esistono già;
    di default restituisce i risultati salvati in precedenza senza rieseguire l'inferenza.

    Lancia:
      - HTTP 404 se il paziente non esiste
      - HTTP 501 se il Modello I non è stato collegato (repo mancante)
      - HTTP 500 per errori di inferenza imprevisti
    """
    p = await _get_patient(patient_id)

    # Se i findings esistono già e non si forza il ricalcolo, li restituiamo direttamente
    # senza ri-eseguire l'inferenza (che è costosa). force=True serve se si vuole rigenerare.
    if not force and p.get("findings") is not None:
        return ClassificationResponse(
            patient_id=patient_id,
            findings=[FindingResult(**f) for f in p["findings"]],
            no_finding=p.get("no_finding", True),
        )

    try:
        probs = classification_model.predict([Image.open(path) for path in p["image_paths"]])
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=f"Modello I non ancora collegato: {e}")
    except Exception as e:
        logger.exception("Errore inferenza Modello I")
        raise HTTPException(status_code=500, detail=str(e))

    findings = [
        FindingResult(
            label=label,
            probability=round(prob, 4),
            threshold=(t := CLASS_THRESHOLDS.get(label, 0.5)),
            positive=prob >= t,
        )
        for label, prob in probs.items()
    ]
    no_finding = not any(f.positive for f in findings)

    await patients_collection.update_one(
        {"_id": _oid(patient_id)},
        {"$set": {"findings": [f.model_dump() for f in findings], "no_finding": no_finding}},
    )
    return ClassificationResponse(patient_id=patient_id, findings=findings, no_finding=no_finding)


# ---------------------------------------------------------------------------
# RF3 — Refertazione (Modello II)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/report", response_model=ReportResponse)
async def generate_report(
    patient_id: str, force: bool = False, current_user: dict = Depends(get_current_user)
):
    """
    Genera il referto neuroradiologico a partire dai findings (RF3.1, RNF6.1).

    Prerequisito: la classificazione deve essere già stata eseguita (/classify).
    Il Modello II (rule-based) compone un referto strutturato in 4 sezioni
    (Tecnica, Reperti, Conclusioni, Raccomandazioni) usando template clinici.

    Con force=False restituisce il referto già salvato se presente;
    con force=True rigenera il referto (la formulazione sarà diversa,
    il contenuto clinico identico).

    Lancia:
      - HTTP 400 se la classificazione non è ancora stata eseguita
      - HTTP 404 se il paziente non esiste
      - HTTP 500 per errori di generazione imprevisti
    """
    p = await _get_patient(patient_id)

    if not force and p.get("report_text") is not None:
        return ReportResponse(patient_id=patient_id, report_text=p["report_text"])

    # Il referto si genera dai findings — la classificazione deve venire prima.
    if p["findings"] is None:
        raise HTTPException(
            status_code=400,
            detail="Esegui prima /classify: il referto richiede i findings del Modello I",
        )

    try:
        report_text = report_model.generate_from_findings(
            p["findings"], p["no_finding"], n_slices=len(p["image_paths"])
        )
    except Exception as e:
        logger.exception("Errore generazione referto")
        raise HTTPException(status_code=500, detail=str(e))

    await patients_collection.update_one(
        {"_id": _oid(patient_id)}, {"$set": {"report_text": report_text}}
    )
    return ReportResponse(patient_id=patient_id, report_text=report_text)


@app.get("/patients/{patient_id}/coherence", response_model=CoherenceCheckResponse)
async def check_coherence(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Verifica la coerenza tra findings e testo del referto (RF4.1).

    Per ogni classe patologica controlla se un finding positivo è menzionato
    nel testo del referto e viceversa. Le discrepanze indicano che il medico
    ha modificato manualmente il referto togliendo o aggiungendo riferimenti.

    Prerequisito: sia la classificazione che il referto devono essere stati generati.

    Lancia HTTP 400 se mancano findings o referto.
    """
    p = await _get_patient(patient_id)
    if not p["findings"] or not p["report_text"]:
        raise HTTPException(
            status_code=400,
            detail="Servono sia classificazione che referto per il controllo di coerenza",
        )

    report_lower = p["report_text"].lower()
    issues = [
        CoherenceIssue(
            label=f["label"],
            in_findings=f["positive"],
            mentioned_in_report=(f["label"].lower().replace("_", " ") in report_lower),
        )
        for f in p["findings"]
    ]
    has_mismatch = any(i.in_findings != i.mentioned_in_report for i in issues)
    return CoherenceCheckResponse(patient_id=patient_id, issues=issues, has_mismatch=has_mismatch)


# ---------------------------------------------------------------------------
# RF3.4 — Modifica referto (medico e specializzando possono editare)
# ---------------------------------------------------------------------------
@app.put("/patients/{patient_id}/report", response_model=ReportResponse)
async def update_report(
    patient_id: str,
    body: ReportUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Modifica manuale del testo del referto (RF3.2, RF3.4).

    Sia il medico che lo specializzando possono editare il referto.
    Dopo una modifica manuale, il controllo di coerenza potrebbe
    rilevare discrepanze con i findings originali.
    """
    await _get_patient(patient_id)  # verifica esistenza
    await patients_collection.update_one(
        {"_id": _oid(patient_id)}, {"$set": {"report_text": body.report_text}}
    )
    return ReportResponse(patient_id=patient_id, report_text=body.report_text)


# ---------------------------------------------------------------------------
# RF5.3 — Validazione: SOLO ruolo "medico" (assunzione da confermare)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/validate")
async def validate_patient(
    patient_id: str, current_user: dict = Depends(require_role("medico"))
):
    """
    Valida il referto con firma digitale del medico (RF5.3).

    Operazione riservata esclusivamente al ruolo "medico" — lo specializzando
    non può validare. La firma include il titolo professionale corretto
    in base al genere (Dr. / Dr.ssa) seguito dal cognome.

    Prerequisito: il referto deve essere già stato generato.
    Lancia HTTP 400 se non esiste un referto da validare.
    """
    p = await _get_patient(patient_id)
    if not p["report_text"]:
        raise HTTPException(status_code=400, detail="Nessun referto da validare")

    # La firma include il titolo corretto in base al genere — dettaglio che conta
    # in un documento clinico e che la commissione noterebbe se sbagliato.
    title = "Dr." if current_user.get("gender", "M") == "M" else "Dr.ssa"
    signature = f"{title} {current_user.get('cognome', current_user['username'])}"

    await patients_collection.update_one(
        {"_id": _oid(patient_id)},
        {"$set": {"validated": True, "validated_by": signature}},
    )
    return {"patient_id": patient_id, "validated": True, "validated_by": signature}


# ---------------------------------------------------------------------------
# RF6.2 — Esportazione referto
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/export", response_class=PlainTextResponse)
async def export_report(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Esporta il referto in formato testo leggibile (RF6.2).

    Compone un documento testuale con intestazione anagrafica, findings positivi,
    stato di validazione e testo completo del referto. Restituito come
    Content-Type text/plain, scaricabile direttamente dal browser.

    Lancia HTTP 400 se il referto non è ancora stato generato.
    """
    p = await _get_patient(patient_id)
    if not p["report_text"]:
        raise HTTPException(status_code=400, detail="Nessun referto generato per questo paziente")

    findings_str = "\n".join(
        f"- {f['label']}: {f['probability']:.2f} (soglia {f['threshold']})"
        for f in (p["findings"] or [])
        if f["positive"]
    )

    return (
        f"REFERTO - {p['cognome']} {p['nome']}\n"
        f"Codice fiscale: {p['codice_fiscale']}\n"
        f"Data di nascita: {p['data_nascita']}\n"
        f"Generato il: {p['created_at'].isoformat()}\n"
        f"Validato: {'Sì, da ' + p['validated_by'] if p['validated'] else 'No - in attesa di revisione medica'}\n\n"
        f"Main findings:\n{findings_str or 'Nessun finding positivo'}\n\n"
        f"Testo referto:\n{p['report_text']}\n"
    )
