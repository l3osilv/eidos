"""
Schemi Pydantic per richieste e risposte dell'API.

Ogni schema corrisponde a un modello di validazione usato da FastAPI per:
  - deserializzare e validare automaticamente il body delle richieste in arrivo
  - serializzare le risposte in formato JSON con i campi e i tipi dichiarati
  - generare la documentazione interattiva su /docs (OpenAPI/Swagger)

Organizzazione:
  - Utenti / Auth: creazione account, token JWT, aggiornamento profilo
  - Pazienti: anagrafica, stato del workflow (classificazione → referto → validazione)
  - Findings: risultati del Modello I (classificazione binaria per classe)
  - Report: testo del referto generato dal Modello II e controllo di coerenza
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────────────────────
# Utenti / Auth
# ──────────────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """
    Dati richiesti per la registrazione di un nuovo utente.

    Se username non viene fornito, viene generato automaticamente da main.py
    concatenando nome e cognome in minuscolo (es. "mariorossi").
    """
    nome: str
    cognome: str
    gender: str  # "M" o "F" — usato per la firma del referto (Dr. / Dr.ssa)
    role: str  # "medico" o "specializzando" — determina i permessi sull'applicazione
    password: str
    username: Optional[str] = None


class Token(BaseModel):
    """
    Risposta di login/registrazione.

    Contiene il token JWT per le richieste successive e i dati dell'utente
    che il frontend usa per personalizzare l'interfaccia (nome, ruolo, avatar).
    """
    access_token: str
    token_type: str = "bearer"
    role: str
    gender: str
    nome: str
    cognome: str
    username: str
    avatar: Optional[str] = None


class ProfileUpdate(BaseModel):
    """Campi aggiornabili dal profilo utente (PUT /users/profile)."""
    nome: str
    cognome: str
    gender: str
    avatar: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Pazienti
# ──────────────────────────────────────────────────────────────────────────────


class FindingResult(BaseModel):
    """
    Risultato della classificazione per una singola classe patologica.

    Ogni classe viene valutata indipendentemente dal Modello I (binary decomposition):
      - label: nome della patologia (es. "Blood", "Ischemia", "Edema", "Mass")
      - probability: probabilità restituita dal modello (0.0–1.0, post-sigmoid)
      - threshold: soglia di decisione per questa classe (default 0.5, calibrabile)
      - positive: True se probability >= threshold
    """
    label: str
    probability: float
    threshold: float
    positive: bool


class ClassificationResponse(BaseModel):
    """
    Risposta dell'endpoint POST /patients/{id}/classify.

    Contiene i findings per tutte le classi del Modello I e un flag
    no_finding che indica se nessuna classe ha superato la soglia.
    """
    patient_id: str
    findings: List[FindingResult]
    no_finding: bool
    model_name: str = "model_I_classification"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportResponse(BaseModel):
    """
    Risposta degli endpoint di refertazione (POST e PUT /patients/{id}/report).

    Il disclaimer viene incluso automaticamente in ogni risposta per ricordare
    che il referto è generato automaticamente e richiede validazione medica.
    """
    patient_id: str
    report_text: str
    model_name: str = "model_II_report"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    disclaimer: str = (
        "Referto generato automaticamente. Richiede revisione e validazione "
        "da parte di un medico prima di qualsiasi uso clinico."
    )


class CoherenceIssue(BaseModel):
    """
    Singola discrepanza tra findings e testo del referto.

    Confronta se un finding positivo è menzionato nel testo e viceversa.
    Una mismatch indica che il referto è stato modificato manualmente
    togliendo o aggiungendo riferimenti a patologie.
    """
    label: str
    in_findings: bool
    mentioned_in_report: bool


class CoherenceCheckResponse(BaseModel):
    """
    Risposta del controllo di coerenza (GET /patients/{id}/coherence).

    has_mismatch è True se almeno una classe presenta discrepanza tra
    il risultato della classificazione e il testo del referto.
    """
    patient_id: str
    issues: List[CoherenceIssue]
    has_mismatch: bool


class ReportUpdateRequest(BaseModel):
    """Body della richiesta PUT /patients/{id}/report per la modifica manuale del referto."""
    report_text: str


class PatientStatus(BaseModel):
    """
    Stato completo di un paziente nel workflow diagnostico.

    Usato sia per il dettaglio singolo (GET /patients/{id}) che per la lista
    pazienti (GET /patients). I flag booleani indicano a che punto è arrivato
    il workflow: caricamento → classificazione → referto → validazione.
    """
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
