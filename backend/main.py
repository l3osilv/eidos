"""
Backend principale.

Mappa endpoint -> requisito (vedi requisiti_progetto.md):
  POST   /auth/register               (gestione utenti - non in RF originali, aggiunto per i due ruoli)
  POST   /auth/login                  idem
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
  GET    /health                     RNF7.1
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
from fastapi.responses import PlainTextResponse, StreamingResponse
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
    PatientSummary,
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
    classification_model.load()
    report_model.load()
    yield
    logger.info("Shutdown backend")


app = FastAPI(title="Neuroradiology Support API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringi in produzione al dominio del frontend
    allow_methods=["*"],
    allow_headers=["*"],
)


def oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID paziente non valido")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
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
    NOTA: aperta per semplicità di demo/tesi. In un sistema reale la
    creazione di account andrebbe limitata a un amministratore.
    """
    if user.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400, detail=f"Ruolo deve essere uno di: {VALID_ROLES}"
        )

    username = user.username
    if not username:
        username = f"{user.nome}{user.cognome}".lower().replace(" ", "")

    existing = await users_collection.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="Username già in uso")

    await users_collection.insert_one(
        {
            "username": username,
            "hashed_password": hash_password(user.password),
            "nome": user.nome,
            "cognome": user.cognome,
            "gender": user.gender,
            "role": user.role,
            "avatar": None,
        }
    )

    token = create_access_token({"sub": username})
    return Token(
        access_token=token,
        role=user.role,
        gender=user.gender,
        nome=user.nome,
        cognome=user.cognome,
        username=username,
        avatar=None
    )


@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await users_collection.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Username o password errati")

    token = create_access_token({"sub": user["username"]})
    return Token(
        access_token=token,
        role=user["role"],
        gender=user.get("gender", "M"),
        nome=user.get("nome", ""),
        cognome=user.get("cognome", ""),
        username=user["username"],
        avatar=user.get("avatar")
    )


@app.put("/users/profile", response_model=Token)
async def update_profile(
    profile: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    await users_collection.update_one(
        {"username": current_user["username"]},
        {
            "$set": {
                "nome": profile.nome,
                "cognome": profile.cognome,
                "gender": profile.gender,
                "avatar": profile.avatar,
            }
        }
    )
    
    # Retrieve updated user to return fresh Token
    updated_user = await users_collection.find_one({"username": current_user["username"]})
    token = create_access_token({"sub": current_user["username"]})
    return Token(
        access_token=token,
        role=updated_user["role"],
        gender=updated_user.get("gender", "M"),
        nome=updated_user.get("nome", ""),
        cognome=updated_user.get("cognome", ""),
        username=updated_user["username"],
        avatar=updated_user.get("avatar")
    )


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
            raise HTTPException(
                status_code=400, detail=f"File non valido: {f.filename}"
            )
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

    # Le immagini si salvano DOPO aver creato il paziente, così la cartella
    # su disco usa lo stesso id del documento Mongo (RF1: coppia immagine-paziente)
    image_paths = save_patient_images(patient_id, images)
    await patients_collection.update_one(
        {"_id": result.inserted_id}, {"$set": {"image_paths": image_paths}}
    )

    logger.info("Creato paziente %s con %d slice", patient_id, len(images))

    return PatientStatus(
        patient_id=patient_id,
        nome=nome,
        cognome=cognome,
        codice_fiscale=codice_fiscale,
        data_nascita=data_nascita,
        created_at=patient_doc["created_at"],
        num_slices=len(image_paths),
        has_classification=False,
        has_report=False,
        validated=False,
    )


# ---------------------------------------------------------------------------
# RF6 — Storico pazienti
# ---------------------------------------------------------------------------
@app.get("/patients", response_model=List[PatientStatus])
async def list_patients(current_user: dict = Depends(get_current_user)):
    cursor = patients_collection.find()
    results = []
    async for p in cursor:
        results.append(
            PatientStatus(
                patient_id=str(p["_id"]),
                nome=p["nome"],
                cognome=p["cognome"],
                codice_fiscale=p["codice_fiscale"],
                data_nascita=date.fromisoformat(p["data_nascita"]),
                created_at=p["created_at"],
                num_slices=len(p["image_paths"]),
                has_classification=p["findings"] is not None,
                has_report=p["report_text"] is not None,
                validated=p["validated"],
                validated_by=p.get("validated_by"),
            )
        )
    return results


@app.get("/patients/{patient_id}", response_model=PatientStatus)
async def get_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    return PatientStatus(
        patient_id=str(p["_id"]),
        nome=p["nome"],
        cognome=p["cognome"],
        codice_fiscale=p["codice_fiscale"],
        data_nascita=date.fromisoformat(p["data_nascita"]),
        created_at=p["created_at"],
        num_slices=len(p["image_paths"]),
        has_classification=p["findings"] is not None,
        has_report=p["report_text"] is not None,
        validated=p["validated"],
        validated_by=p.get("validated_by"),
    )


# ---------------------------------------------------------------------------
# RF5.1/5.2 — Visualizzazione slice
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/slices/{index}")
async def get_slice(
    patient_id: str, index: int, current_user: dict = Depends(get_current_user)
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    paths = p["image_paths"]
    if index < 0 or index >= len(paths):
        raise HTTPException(status_code=404, detail="Slice non trovata")

    with open(paths[index], "rb") as f:
        buf = io.BytesIO(f.read())
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


# ---------------------------------------------------------------------------
# RF2 — Classificazione (Modello I)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/classify", response_model=ClassificationResponse)
async def classify_patient(
    patient_id: str, force: bool = False, current_user: dict = Depends(get_current_user)
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    if not force and p.get("findings") is not None:
        findings = [FindingResult(**f) for f in p["findings"]]
        return ClassificationResponse(
            patient_id=patient_id,
            findings=findings,
            no_finding=p.get("no_finding", True)
        )

    images = [Image.open(path) for path in p["image_paths"]]

    try:
        probs = classification_model.predict(images)
    except NotImplementedError as e:
        raise HTTPException(
            status_code=501, detail=f"Modello I non ancora collegato: {e}"
        )
    except Exception as e:
        logger.exception("Errore inferenza Modello I")
        raise HTTPException(status_code=500, detail=str(e))

    findings = []
    for label, prob in probs.items():
        threshold = CLASS_THRESHOLDS.get(label, 0.5)
        findings.append(
            FindingResult(
                label=label,
                probability=round(prob, 4),
                threshold=threshold,
                positive=prob >= threshold,
            )
        )
    no_finding = not any(f.positive for f in findings)

    await patients_collection.update_one(
        {"_id": oid(patient_id)},
        {
            "$set": {
                "findings": [f.model_dump() for f in findings],
                "no_finding": no_finding,
            }
        },
    )

    return ClassificationResponse(
        patient_id=patient_id, findings=findings, no_finding=no_finding
    )


# ---------------------------------------------------------------------------
# RF3 — Refertazione (Modello II)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/report", response_model=ReportResponse)
async def generate_report(
    patient_id: str, force: bool = False, current_user: dict = Depends(get_current_user)
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    if not force and p.get("report_text") is not None:
        return ReportResponse(patient_id=patient_id, report_text=p["report_text"])

    # Il referto si genera DAI findings, quindi la classificazione deve
    # essere già stata eseguita (workflow: classify -> report, coerente
    # con come un radiologo lavora davvero: prima reperti, poi referto).
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
        {"_id": oid(patient_id)}, {"$set": {"report_text": report_text}}
    )

    return ReportResponse(patient_id=patient_id, report_text=report_text)


@app.get("/patients/{patient_id}/coherence", response_model=CoherenceCheckResponse)
async def check_coherence(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    if not p["findings"] or not p["report_text"]:
        raise HTTPException(
            status_code=400,
            detail="Servono sia classificazione che referto per il controllo di coerenza",
        )

    report_lower = p["report_text"].lower()
    issues = []
    has_mismatch = False

    for finding in p["findings"]:
        mentioned = finding["label"].lower().replace("_", " ") in report_lower
        if finding["positive"] != mentioned:
            has_mismatch = True
        issues.append(
            CoherenceIssue(
                label=finding["label"],
                in_findings=finding["positive"],
                mentioned_in_report=mentioned,
            )
        )

    return CoherenceCheckResponse(
        patient_id=patient_id, issues=issues, has_mismatch=has_mismatch
    )


# ---------------------------------------------------------------------------
# RF3.4 — Modifica referto (medico e specializzando possono editare)
# ---------------------------------------------------------------------------
@app.put("/patients/{patient_id}/report", response_model=ReportResponse)
async def update_report(
    patient_id: str,
    body: ReportUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    await patients_collection.update_one(
        {"_id": oid(patient_id)}, {"$set": {"report_text": body.report_text}}
    )

    return ReportResponse(patient_id=patient_id, report_text=body.report_text)


# ---------------------------------------------------------------------------
# RF5.3 — Validazione: SOLO ruolo "medico" (assunzione da confermare)
# ---------------------------------------------------------------------------
@app.post("/patients/{patient_id}/validate")
async def validate_patient(
    patient_id: str, current_user: dict = Depends(require_role("medico"))
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    if not p["report_text"]:
        raise HTTPException(status_code=400, detail="Nessun referto da validare")

    gender = current_user.get("gender", "M")
    cognome = current_user.get("cognome", current_user["username"])
    title = "Dr." if gender == "M" else "Dr.ssa"
    signature = f"{title} {cognome}"

    await patients_collection.update_one(
        {"_id": oid(patient_id)},
        {"$set": {"validated": True, "validated_by": signature}},
    )
    return {
        "patient_id": patient_id,
        "validated": True,
        "validated_by": signature,
    }


# ---------------------------------------------------------------------------
# RF6.2 — Esportazione referto
# ---------------------------------------------------------------------------
@app.get("/patients/{patient_id}/export", response_class=PlainTextResponse)
async def export_report(
    patient_id: str, current_user: dict = Depends(get_current_user)
):
    p = await patients_collection.find_one({"_id": oid(patient_id)})
    if p is None:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    if not p["report_text"]:
        raise HTTPException(
            status_code=400, detail="Nessun referto generato per questo paziente"
        )

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
