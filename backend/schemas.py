"""
Schemi Pydantic per validazione input/output API.
"""

from datetime import date, datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


# --- Auth / Utenti ---

class UserCreate(BaseModel):
    nome: str
    cognome: str
    gender: str  # "M" / "F" (serve per Dr. o Dr.ssa)
    role: str    # "medico" / "specializzando"
    password: str
    username: Optional[str] = None


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


# --- Pazienti e Findings ---

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
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportResponse(BaseModel):
    patient_id: str
    report_text: str
    model_name: str = "model_II_report"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    gender: str = "M"
    data_nascita: date
    created_at: datetime
    num_slices: int
    has_classification: bool
    has_report: bool
    validated: bool
    validated_by: Optional[str] = None
