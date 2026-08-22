"""
backend fastapi per eidos — api rest per la refertazione neuroradiologica.

all'avvio carica in memoria i pesi dei classificatori (modello I)
e inizializza il generatore di referti (modello II). i modelli restano
come singleton per tutta la durata del processo.

le operazioni di i/o (mongo con motor, filesystem, llm) sono asincrone
per non bloccare l'event loop durante l'inferenza.
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
    """carica i modelli in memoria all'avvio (singleton condivisi)."""
    classification_model.load()
    report_model.load()
    yield
    logger.info("Shutdown backend")


app = FastAPI(title="Neuroradiology Support API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # da restringere in produzione
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------

def _oid(id_str: str) -> ObjectId:
    """converte stringa in objectid (400 se non valido)."""
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID paziente non valido")


async def _get_patient(patient_id: str) -> dict:
    """recupera il paziente per id (404 se non trovato)."""
    p = await patients_collection.find_one({"_id": _oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return p


def _patient_status(p: dict) -> PatientStatus:
    """mappa il documento mongo nel modello patientstatus per la risposta."""
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
    """costruisce il token jwt a partire dal documento utente."""
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
# health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """stato del backend con modelli caricati e device di calcolo."""
    return {
        "status": "ok",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "model_I_loaded_classes": list(classification_model.models.keys()),
        "model_II_loaded": report_model.model is not None,
    }


# ---------------------------------------------------------------------------
# autenticazione
# ---------------------------------------------------------------------------
@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    """
    registrazione per la demo (in produzione andrebbe riservata all'admin).
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
    login con username e password (oauth2 password flow).
    restituisce il token jwt valido 8 ore.
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
    aggiorna il profilo utente e ritorna un token aggiornato.
    """
    update_fields = {"nome": profile.nome, "cognome": profile.cognome, "gender": profile.gender, "avatar": profile.avatar}
    await users_collection.update_one({"username": current_user["username"]}, {"$set": update_fields})

    updated = await users_collection.find_one({"username": current_user["username"]})
    return _build_token(updated)


# ---------------------------------------------------------------------------
# rf1 — creazione paziente e caricamento immagini
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
    crea il paziente e salva le 8 slice tc su disco.
    valida il numero di immagini, le converte in scala di grigi
    e inizializza il documento su mongodb.
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

    # salvataggio immagini usando l'_id generato da mongo
    image_paths = save_patient_images(patient_id, images)
    await patients_collection.update_one(
        {"_id": result.inserted_id}, {"$set": {"image_paths": image_paths}}
    )
    logger.info("Creato paziente %s con %d slice", patient_id, len(images))

    patient_doc["_id"] = result.inserted_id
    patient_doc["image_paths"] = image_paths
    return _patient_status(patient_doc)


# ---------------------------------------------------------------------------
# rf6 — storico pazienti
# ---------------------------------------------------------------------------
@app.get("/patients", response_model=List[PatientStatus])
async def list_patients(current_user: dict = Depends(get_current_user)):
    """lista dei pazienti con relativo stato di avanzamento."""
    return [_patient_status(p) async for p in patients_collection.find()]


@app.get("/patients/{patient_id}", response_model=PatientStatus)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    """dettaglio del singolo paziente."""
    return _patient_status(await _get_patient(patient_id))


# ---------------------------------------------------------------------------
# rf5 — visualizzazione slice
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/slices/{index}")
async def get_slice(
    patient_id: str, index: int, current_user: dict = Depends(get_current_user)
):
    """restituisce la slice richiesta come immagine png (indice 0-7)."""
    p = await _get_patient(patient_id)
    paths = p["image_paths"]
    if not 0 <= index < len(paths):
        raise HTTPException(status_code=404, detail="Slice non trovata")
    return FileResponse(paths[index], media_type="image/png")


# ---------------------------------------------------------------------------
# rf2 — classificazione (modello I)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/classify", response_model=ClassificationResponse)
async def classify_patient(
    patient_id: str, force: bool = False, current_user: dict = Depends(get_current_user)
):
    """
    classificazione delle patologie sulle 8 slice.
    se force=false riusa i risultati salvati, con force=true ricalcola.
    """
    p = await _get_patient(patient_id)

    # se i risultati esistono già e non serve ricalcolare, ritorno la cache
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
# rf3 — generazione referto (modello II)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/report", response_model=ReportResponse)
async def generate_report(
    patient_id: str, force: bool = False, current_user: dict = Depends(get_current_user)
):
    """
    genera il referto a partire dai findings classificati.
    richiede che la classificazione sia già stata completata.
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
    controllo di coerenza tra i reperti rilevati e il testo del referto.
    verifica la concordanza tra classi positive e testo.
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
# rf3.4 — modifica referto
# ---------------------------------------------------------------------------
@app.put("/patients/{patient_id}/report", response_model=ReportResponse)
async def update_report(
    patient_id: str,
    body: ReportUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """salvataggio delle modifiche manuali apportate al referto."""
    await _get_patient(patient_id)
    await patients_collection.update_one(
        {"_id": _oid(patient_id)}, {"$set": {"report_text": body.report_text}}
    )
    return ReportResponse(patient_id=patient_id, report_text=body.report_text)


# ---------------------------------------------------------------------------
# rf5.3 — validazione referto (solo ruolo medico)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/validate")
async def validate_patient(
    patient_id: str, current_user: dict = Depends(require_role("medico"))
):
    """
    validazione con firma del medico (strutturato).
    la firma applica il titolo in base al genere (dr. / dr.ssa).
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
    """annulla la validazione per consentire ulteriori modifiche."""
    await _get_patient(patient_id)
    await patients_collection.update_one(
        {"_id": _oid(patient_id)},
        {"$set": {"validated": False, "validated_by": None}},
    )
    return {"patient_id": patient_id, "validated": False, "validated_by": None}


# ---------------------------------------------------------------------------
# rf6.2 — esportazione referto
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/export", response_class=PlainTextResponse)
async def export_report(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    """
    esporta il referto in formato testo con anagrafica e reperti.
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
        f"Reperti positivi:\n{findings_str or 'Nessun finding positivo'}\n\n"
        f"Testo referto:\n{p['report_text']}\n"
    )
