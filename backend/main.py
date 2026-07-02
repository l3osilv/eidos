"""
Backend FastAPI — endpoint REST per MedicinAI-BrainCT.

Flusso di lavoro diagnostico:
  1. Login/registrazione operatore
  2. Creazione paziente + upload 8 slice TC           (RF1)
  3. Classificazione automatica via Modello I          (RF2)
  4. Generazione referto via Modello II                (RF3)
  5. Controllo coerenza findings ↔ referto             (RF4)
  6. Visualizzazione slice e storico                    (RF5, RF6)
  7. Validazione + esportazione                        (RF5.3, RF6.2)

Mappa endpoint → requisiti:
  POST  /auth/register              (gestione utenti)
  POST  /auth/login                 (gestione utenti)
  PUT   /users/profile              (gestione utenti)
  POST  /patients                   RF1.1, RF1.2
  GET   /patients                   RF6.1
  GET   /patients/{id}              RF6.1
  GET   /patients/{id}/slices/{i}   RF5.1, RF5.2
  POST  /patients/{id}/classify     RF2.1-RF2.4, RNF6.2
  POST  /patients/{id}/report       RF3.1, RNF6.1
  GET   /patients/{id}/coherence    RF4.1
  PUT   /patients/{id}/report       RF3.2, RF3.4
  POST  /patients/{id}/validate     RF5.3 (solo "medico")
  POST  /patients/{id}/unvalidate   RF5.3 (solo "medico")
  GET   /patients/{id}/export       RF6.2
  GET   /health                     RNF7.1
"""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import io
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import List

import torch

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
    """Carica i modelli in memoria all'avvio. Vengono condivisi come singleton."""
    classification_model.load()
    report_model.load()
    yield
    logger.info("Shutdown backend")


app = FastAPI(title="Neuroradiology Support API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringere prima di andare in produzione
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _oid(id_str: str) -> ObjectId:
    """Converte stringa → ObjectId, 400 se non valido."""
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID paziente non valido")


async def _get_patient(patient_id: str) -> dict:
    """Recupera paziente per ID, 404 se non esiste."""
    p = await patients_collection.find_one({"_id": _oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return p


def _patient_status(p: dict) -> PatientStatus:
    """Mappa un documento Mongo nel formato PatientStatus per la risposta API."""
    dn = p["data_nascita"]
    return PatientStatus(
        patient_id=str(p["_id"]),
        nome=p["nome"],
        cognome=p["cognome"],
        codice_fiscale=p["codice_fiscale"],
        gender=p.get("gender", "M"),
        data_nascita=date.fromisoformat(dn) if isinstance(dn, str) else dn,
        created_at=p["created_at"],
        num_slices=len(p.get("image_paths", [])),
        has_classification=p.get("findings") is not None,
        has_report=p.get("report_text") is not None,
        validated=p.get("validated", False),
        validated_by=p.get("validated_by"),
    )


def _build_token(user: dict) -> Token:
    """Costruisce il Token JWT da un documento utente."""
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
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """Stato del backend: modelli caricati e dispositivo di calcolo (RNF7.1)."""
    return {
        "status": "ok",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "model_I_loaded_classes": list(classification_model.models.keys()),
        "model_II_loaded": report_model.model is not None,
    }


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    """
    Registrazione aperta (solo per la demo).
    In produzione andrebbe protetta con un ruolo admin.
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
    Login con username/password (OAuth2 password flow).
    Restituisce un JWT valido 8 ore; il frontend lo manda come Bearer token.
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
    Aggiorna profilo utente. Ritorna un token nuovo
    così il frontend riflette subito i dati aggiornati nell'header.
    """
    update_fields = {"nome": profile.nome, "cognome": profile.cognome, "gender": profile.gender, "avatar": profile.avatar}
    await users_collection.update_one({"username": current_user["username"]}, {"$set": update_fields})

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
    gender: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Crea paziente e salva le 8 slice TC su disco (RF1).
    Valida che siano esattamente 8 immagini, le converte in grayscale
    e crea il documento in MongoDB con tutti i campi del workflow a None.
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
        "gender": gender,
        "created_at": datetime.now(timezone.utc),
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

    # Salvo dopo l'insert per usare l'_id Mongo come nome cartella
    image_paths = save_patient_images(patient_id, images)
    await patients_collection.update_one(
        {"_id": result.inserted_id}, {"$set": {"image_paths": image_paths}}
    )
    logger.info("Creato paziente %s con %d slice", patient_id, len(images))

    patient_doc["_id"] = result.inserted_id
    patient_doc["image_paths"] = image_paths
    return _patient_status(patient_doc)


# ---------------------------------------------------------------------------
# RF6 — Storico pazienti
# ---------------------------------------------------------------------------
@app.get("/patients", response_model=List[PatientStatus])
async def list_patients(current_user: dict = Depends(get_current_user)):
    """Lista pazienti con stato del workflow (RF6.1)."""
    return [_patient_status(p) async for p in patients_collection.find()]


@app.get("/patients/{patient_id}", response_model=PatientStatus)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Dettaglio singolo paziente (RF6.1)."""
    return _patient_status(await _get_patient(patient_id))


# ---------------------------------------------------------------------------
# RF5 — Visualizzazione slice
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/slices/{index}")
async def get_slice(
    patient_id: str, index: int, current_user: dict = Depends(get_current_user)
):
    """Restituisce una slice come PNG dal filesystem (RF5.1, RF5.2). Indice 0-7."""
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
    Classificazione patologie sulle 8 slice (RF2).
    Con force=False restituisce i risultati salvati senza ri-eseguire
    l'inferenza. Con force=True ricalcola da zero.
    """
    p = await _get_patient(patient_id)

    # Se i findings ci sono già e non è richiesto il ricalcolo, li restituisco subito
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
    Genera referto neuroradiologico dai findings (RF3).
    Prerequisito: la classificazione deve essere già stata eseguita.
    Con force=True rigenera (la formulazione cambia, il contenuto clinico no).
    """
    p = await _get_patient(patient_id)

    if not force and p.get("report_text") is not None:
        return ReportResponse(patient_id=patient_id, report_text=p["report_text"])

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
    Controllo coerenza tra findings e testo del referto (RF4.1).
    Per ogni classe verifica se un finding positivo è menzionato nel testo e viceversa.
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
# RF3.4 — Modifica referto
# ---------------------------------------------------------------------------
@app.put("/patients/{patient_id}/report", response_model=ReportResponse)
async def update_report(
    patient_id: str,
    body: ReportUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Salvataggio manuale del testo modificato dal medico (RF3.2, RF3.4)."""
    await _get_patient(patient_id)
    await patients_collection.update_one(
        {"_id": _oid(patient_id)}, {"$set": {"report_text": body.report_text}}
    )
    return ReportResponse(patient_id=patient_id, report_text=body.report_text)


# ---------------------------------------------------------------------------
# RF5.3 — Validazione (solo ruolo "medico")
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/validate")
async def validate_patient(
    patient_id: str, current_user: dict = Depends(require_role("medico"))
):
    """
    Validazione con firma digitale (RF5.3).
    Solo il medico strutturato può firmare; la firma include
    il titolo corretto in base al genere (Dr. / Dr.ssa).
    """
    p = await _get_patient(patient_id)
    if not p["report_text"]:
        raise HTTPException(status_code=400, detail="Nessun referto da validare")

    title = "Dr." if current_user.get("gender", "M") == "M" else "Dr.ssa"
    signature = f"{title} {current_user.get('cognome', current_user['username'])}"

    await patients_collection.update_one(
        {"_id": _oid(patient_id)},
        {"$set": {"validated": True, "validated_by": signature}},
    )
    return {"patient_id": patient_id, "validated": True, "validated_by": signature}


@app.post("/patients/{patient_id}/unvalidate")
async def unvalidate_patient(
    patient_id: str, current_user: dict = Depends(require_role("medico"))
):
    """Riapre un referto validato per consentire modifiche (solo medico)."""
    await _get_patient(patient_id)
    await patients_collection.update_one(
        {"_id": _oid(patient_id)},
        {"$set": {"validated": False, "validated_by": None}},
    )
    return {"patient_id": patient_id, "validated": False, "validated_by": None}


# ---------------------------------------------------------------------------
# RF6.2 — Esportazione referto
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/export", response_class=PlainTextResponse)
async def export_report(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Esporta il referto come testo leggibile (RF6.2).
    Include intestazione anagrafica, findings positivi e stato di validazione.
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
