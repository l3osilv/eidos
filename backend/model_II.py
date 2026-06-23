"""
Modello II — Generazione referto (RF3).

APPROCCIO: rule-based / template, NON un modello generativo addestrato.

Motivazione (da riportare nel capitolo metodologico della tesi):
il dataset disponibile (labels.csv della repo SSL-BrainCT-Pathology) contiene
solo etichette binarie per patologia, NON referti testuali liberi scritti da
radiologi. In assenza di coppie immagine-referto non è possibile addestrare
un modello visione->testo end-to-end in tempi compatibili con la consegna.

Vantaggio collaterale: il referto è generato DIRETTAMENTE dai findings del
Modello I, quindi coerenza (RF4) garantita per costruzione — non può esistere
un mismatch tra classificazione e referto, perché non sono due inferenze
indipendenti.

Se in futuro arriva un dataset con referti testuali reali, questa classe è
il punto di sostituzione: cambia l'interno di generate_from_findings (o si
aggiunge un metodo alternativo), main.py non deve cambiare.
"""

import logging
from typing import Dict, List

logger = logging.getLogger("model_II")

# ---------------------------------------------------------------------------
# Template per classe. {modifier} viene riempito in base alla confidenza
# (vedi _severity_modifier) SOLO per il caso positivo.
# ---------------------------------------------------------------------------
FINDING_TEMPLATES: Dict[str, Dict[str, str]] = {
    "Blood": {
        "positive": "Si rileva {modifier}area iperdensa compatibile con focolaio emorragico.",
        "negative": "Non si osservano aree iperdense sospette per sanguinamento in atto.",
    },
    "Ischemia": {
        "positive": (
            "Si evidenzia {modifier}area di ipodensità compatibile con lesione "
            "ischemica in fase acuta/subacuta."
        ),
        "negative": "Non si osservano aree di ipodensità recente compatibili con ischemia in atto.",
    },
    "Chronic_Ischemia": {
        "positive": (
            "Sono presenti {modifier}aree di gliosi/ipodensità compatibili con esiti "
            "ischemici cronici."
        ),
        "negative": "Non si osservano esiti ischemici cronici di rilievo.",
    },
    "Edema": {
        "positive": "Si apprezza {modifier}area di edema a livello del parenchima cerebrale.",
        "negative": "Non si osservano segni di edema cerebrale significativo.",
    },
    "Mass": {
        "positive": (
            "Si identifica {modifier}formazione espansiva occupante spazio, da caratterizzare "
            "con approfondimento diagnostico."
        ),
        "negative": "Non si osservano formazioni espansive occupanti spazio evidenti.",
    },
}

# Ordine fisso: rende il referto leggibile e prevedibile (stesso ordine ogni volta)
LABEL_ORDER = ["Blood", "Ischemia", "Chronic_Ischemia", "Edema", "Mass"]

NEGATIVE_ALL_TEXT = (
    "Non si rilevano alterazioni significative dell'attenuometria parenchimale. "
    "Non si osservano lesioni emorragiche, aree ischemiche acute o croniche, edema "
    "parenchimale o formazioni espansive occupanti spazio evidenti."
)

TECNICA_TEXT = (
    "Esame TC dell'encefalo, {n_slices} scansioni assiali analizzate. "
    "Pre-elaborazione standard applicata alle immagini."
)


def _severity_modifier(probability: float, threshold: float) -> str:
    """
    Qualificatore linguistico in base a quanto la probabilità supera la soglia.
    NB: riflette la confidenza del modello, NON una valutazione clinica di
    gravità — va comunicato chiaramente se questo testo arriva al medico.
    """
    margin = probability - threshold
    if margin < 0.15:
        return "sospetta "
    if probability >= 0.85:
        return "evidente "
    return ""


def _compose_reperti(findings: List[dict]) -> str:
    by_label = {f["label"]: f for f in findings}
    sentences = []

    for label in LABEL_ORDER:
        f = by_label.get(label)
        if f is None:
            continue

        template = FINDING_TEMPLATES[label]
        if f["positive"]:
            modifier = _severity_modifier(f["probability"], f["threshold"])
            sentences.append(template["positive"].format(modifier=modifier))
        else:
            sentences.append(template["negative"])

    return " ".join(sentences)


def _compose_conclusioni(findings: List[dict], no_finding: bool) -> str:
    if no_finding:
        return "Quadro TC nei limiti, in assenza di reperti patologici significativi."

    positive_labels = [f["label"].replace("_", " ") for f in findings if f["positive"]]
    return "Quadro TC compatibile con: " + ", ".join(positive_labels) + "."


class ReportModel:
    """
    Stessa interfaccia (load + un metodo generate) di prima, così main.py
    cambia il minimo indispensabile. Non carica nulla in memoria: self.model
    è una stringa solo per far apparire "caricato" lo stato in /health.
    """

    def __init__(self):
        self.model = "rule_based_v1"

    def load(self):
        logger.info("Modello II: generatore rule-based, nessun caricamento necessario")

    def generate_from_findings(
        self, findings: List[dict], no_finding: bool, n_slices: int = 8
    ) -> str:
        reperti = NEGATIVE_ALL_TEXT if no_finding else _compose_reperti(findings)
        conclusioni = _compose_conclusioni(findings, no_finding)
        tecnica = TECNICA_TEXT.format(n_slices=n_slices)

        return f"TECNICA:\n{tecnica}\n\nREPERTI:\n{reperti}\n\nCONCLUSIONI:\n{conclusioni}"


report_model = ReportModel()
