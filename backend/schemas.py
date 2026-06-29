"""
Schemi dati. Aggiornati per il modello con utenti (medico/specializzando)
e pazienti reali (nome, cognome, codice fiscale, data di nascita) salvati
su MongoDB.
"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Utenti / Auth
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    nome: str
    cognome: str
    gender: str  # "M" | "F"
    role: str    # "medico" | "specializzando"
    password: str
    username: Optional[str] = None


class UserPublic(BaseModel):
    username: str
    nome: str
    cognome: str
    role: str
    gender: str
    avatar: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    gender: str
    nome: str
    cognome: str
    username: str
    avatar: Optional[str] = None


class ProfileUpdate(BaseModel):
    nome: str
    cognome: str
    gender: str
    avatar: Optional[str] = None



# ---------------------------------------------------------------------------
# Pazienti
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    nome: str
    cognome: str
    codice_fiscale: str
    data_nascita: date


class FindingResult(BaseModel):
    label: str
    probability: float
    threshold: float
    positive: bool


class ClassificationResponse(BaseModel):
    patient_id: str
    findings: List[FindingResult]
    no_finding: bool
    model_name: str = "model_I_classification"
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class ReportResponse(BaseModel):
    patient_id: str
    report_text: str
    model_name: str = "model_II_report"
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    disclaimer: str = (
        "Referto generato automaticamente. Richiede revisione e validazione "
        "da parte di un medico prima di qualsiasi uso clinico."
    )


class CoherenceIssue(BaseModel):
    label: str
    in_findings: bool
    mentioned_in_report: bool


class CoherenceCheckResponse(BaseModel):
    patient_id: str
    issues: List[CoherenceIssue]
    has_mismatch: bool


class ReportUpdateRequest(BaseModel):
    report_text: str


class PatientStatus(BaseModel):
    patient_id: str
    nome: str
    cognome: str
    codice_fiscale: str
    data_nascita: date
    created_at: datetime
    num_slices: int
    has_classification: bool
    has_report: bool
    validated: bool
    validated_by: Optional[str] = None


class PatientSummary(BaseModel):
    """Per la lista pazienti (storico)."""

    patient_id: str
    nome: str
    cognome: str
    created_at: datetime
    validated: bool
