"""
Modello II — Generazione referto (RF3), v2.

Rispetto alla v1: stesso principio (rule-based, ancorato ai findings del
Modello I, NON un modello generativo addestrato — vedi motivazione nella
v1/guida tecnica), ma ora:

1. Più varianti di frase per ciascuna combinazione classe/severità/esito,
   scelte casualmente — stesso contenuto clinico, espressione variabile.
2. Livelli di severità più granulari (non solo sospetta/evidente).
3. Frasi di collegamento quando più patologie coesistono, invece di frasi
   isolate concatenate senza relazione.
4. Sezione "Raccomandazioni" generica per finding positivo (correlazione
   clinica, eventuale approfondimento) — non prescrizioni terapeutiche.

IMPORTANTE — implicazione della non-determinismo: chiamare /report più
volte sullo stesso paziente può produrre testi con frasi diverse a ogni
chiamata. Il CONTENUTO clinico (quali classi sono menzionate come positive)
resta sempre identico, perché deriva direttamente dai findings — varia solo
la formulazione linguistica. Per test/valutazione riproducibile, usa il
parametro `seed` di generate_from_findings().
"""

import logging
import random
from typing import Dict, List, Optional

logger = logging.getLogger("model_II")

LABEL_ORDER = ["Blood", "Ischemia", "Chronic_Ischemia", "Edema", "Mass"]

# ---------------------------------------------------------------------------
# Varianti di frase per classe, separate per esito (positive/negative) e,
# per il caso positivo, per livello di severità (vedi _severity_level).
# Tutte le varianti all'interno di una stessa categoria sono clinicamente
# equivalenti: cambia solo la formulazione.
# ---------------------------------------------------------------------------
FINDING_TEMPLATES: Dict[str, Dict[str, List[str]]] = {
    "Blood": {
        "negative": [
            "Non si osservano aree iperdense sospette per sanguinamento in atto.",
            "Assenza di focolai iperdensi compatibili con emorragia.",
            "Non si rilevano segni di sanguinamento intracranico in atto.",
        ],
        "sospetta": [
            "Si segnala area iperdensa di incerta significatività, da correlare con il quadro clinico, non dirimente per focolaio emorragico.",
            "Presenza di area di dubbia iperdensità, non chiaramente attribuibile a sanguinamento in atto.",
        ],
        "probabile": [
            "Si rileva area iperdensa compatibile con focolaio emorragico.",
            "Si osserva area di aumentata densità riferibile a sanguinamento.",
        ],
        "evidente": [
            "Si rileva area iperdensa francamente evidente, compatibile con focolaio emorragico significativo.",
            "Presenza di estesa area iperdensa, fortemente indicativa di sanguinamento in atto.",
        ],
    },
    "Ischemia": {
        "negative": [
            "Non si osservano aree di ipodensità recente compatibili con ischemia in atto.",
            "Assenza di alterazioni di densità riferibili a lesione ischemica acuta.",
        ],
        "sospetta": [
            "Si segnala area di ipodensità di incerto significato, da correlare clinicamente, non dirimente per ischemia acuta.",
        ],
        "probabile": [
            "Si evidenzia area di ipodensità compatibile con lesione ischemica in fase acuta/subacuta.",
            "Si osserva area ipodensa riferibile a sofferenza ischemica recente.",
        ],
        "evidente": [
            "Si evidenzia estesa area di ipodensità, francamente compatibile con lesione ischemica in fase acuta/subacuta.",
        ],
    },
    "Chronic_Ischemia": {
        "negative": [
            "Non si osservano esiti ischemici cronici di rilievo.",
            "Assenza di alterazioni riferibili a sofferenza ischemica cronica.",
        ],
        "sospetta": [
            "Si segnalano minime aree di ipodensità, di incerto significato, non chiaramente attribuibili a esiti ischemici cronici.",
        ],
        "probabile": [
            "Sono presenti aree di gliosi/ipodensità compatibili con esiti ischemici cronici.",
            "Si osservano alterazioni della sostanza bianca riferibili a sofferenza ischemica cronica.",
        ],
        "evidente": [
            "Sono presenti estese aree di gliosi compatibili con marcati esiti ischemici cronici.",
        ],
    },
    "Edema": {
        "negative": [
            "Non si osservano segni di edema cerebrale significativo.",
            "Assenza di alterazioni di densità riferibili a edema parenchimale.",
        ],
        "sospetta": [
            "Si segnala minima alterazione di densità, di incerto significato, non chiaramente attribuibile a edema.",
        ],
        "probabile": [
            "Si apprezza area di edema a livello del parenchima cerebrale.",
            "Si osserva alterazione di densità compatibile con edema parenchimale.",
        ],
        "evidente": [
            "Si apprezza estesa area di edema parenchimale, con possibile effetto compressivo sulle strutture adiacenti.",
        ],
    },
    "Mass": {
        "negative": [
            "Non si osservano formazioni espansive occupanti spazio evidenti.",
            "Assenza di lesioni occupanti spazio di rilievo.",
        ],
        "sospetta": [
            "Si segnala area di incerta significatività, non dirimente per formazione espansiva, da approfondire.",
        ],
        "probabile": [
            "Si identifica formazione espansiva occupante spazio, da caratterizzare con approfondimento diagnostico.",
            "Si osserva lesione occupante spazio, di natura da determinare.",
        ],
        "evidente": [
            "Si identifica formazione espansiva di dimensioni significative, occupante spazio, con effetto sulle strutture adiacenti.",
        ],
    },
}

# Frasi di transizione, usate come mini-frase a parte quando più classi
# positive vengono descritte in sequenza, per dare continuità al testo
# senza dover "fondere" grammaticalmente due frasi indipendenti.
CONNECTORS: List[str] = [
    "Si associa inoltre il seguente reperto:",
    "Si segnala inoltre quanto segue:",
    "A questo si associa il seguente ulteriore reperto:",
]

RECOMMENDATIONS: Dict[str, List[str]] = {
    "Blood": [
        "Si raccomanda valutazione neurochirurgica e correlazione con il quadro clinico.",
    ],
    "Ischemia": [
        "Si raccomanda valutazione neurologica con urgenza e correlazione clinica.",
    ],
    "Chronic_Ischemia": [
        "Reperto da correlare con l'anamnesi vascolare del paziente.",
    ],
    "Edema": [
        "Si raccomanda monitoraggio clinico-radiologico ravvicinato.",
    ],
    "Mass": [
        "Si raccomanda approfondimento diagnostico (RM encefalo con contrasto) e valutazione multidisciplinare.",
    ],
}

NEGATIVE_ALL_TEXT = (
    "Non si rilevano alterazioni significative dell'attenuometria parenchimale. "
    "Non si osservano lesioni emorragiche, aree ischemiche acute o croniche, edema "
    "parenchimale o formazioni espansive occupanti spazio evidenti."
)

TECNICA_TEXT = (
    "Esame TC dell'encefalo, {n_slices} scansioni assiali analizzate. "
    "Pre-elaborazione standard applicata alle immagini."
)


def _severity_level(probability: float, threshold: float) -> str:
    """
    Livello di severità (in realtà: livello di CONFIDENZA del modello,
    non gravità clinica) in base a quanto la probabilità supera la soglia.
    Più granulare della v1 (era solo sospetta/evidente).
    """
    margin = probability - threshold
    if margin < 0.08:
        return "sospetta"
    if probability >= 0.85:
        return "evidente"
    return "probabile"


def _compose_reperti(findings: List[dict], rng: random.Random) -> str:
    by_label = {f["label"]: f for f in findings}
    sentences = []
    positive_count_so_far = 0

    for label in LABEL_ORDER:
        f = by_label.get(label)
        if f is None:
            continue

        templates = FINDING_TEMPLATES[label]

        if f["positive"]:
            level = _severity_level(f["probability"], f["threshold"])
            variants = templates[level]
            sentence = rng.choice(variants)

            # Se non è il primo finding positivo descritto, premetti una
            # frase di transizione separata, invece di fondere grammaticalmente
            # due frasi indipendenti (es. evita "Si rileva inoltre si identifica...").
            if positive_count_so_far > 0:
                sentences.append(rng.choice(CONNECTORS))

            sentences.append(sentence)
            positive_count_so_far += 1
        else:
            variants = templates["negative"]
            sentences.append(rng.choice(variants))

    return " ".join(sentences)


def _compose_conclusioni(findings: List[dict], no_finding: bool) -> str:
    if no_finding:
        return "Quadro TC nei limiti, in assenza di reperti patologici significativi."

    positive_labels = [f["label"].replace("_", " ") for f in findings if f["positive"]]
    return "Quadro TC compatibile con: " + ", ".join(positive_labels) + "."


def _compose_raccomandazioni(findings: List[dict], no_finding: bool) -> str:
    if no_finding:
        return "Nessuna raccomandazione specifica; follow-up secondo pratica clinica standard."

    lines = []
    for f in findings:
        if f["positive"] and f["label"] in RECOMMENDATIONS:
            lines.append(RECOMMENDATIONS[f["label"]][0])

    if not lines:
        return "Nessuna raccomandazione specifica; follow-up secondo pratica clinica standard."

    # Evita duplicati se più classi rimandano alla stessa raccomandazione
    seen = set()
    unique_lines = []
    for line in lines:
        if line not in seen:
            unique_lines.append(line)
            seen.add(line)

    return " ".join(unique_lines)


class ReportModel:
    def __init__(self):
        self.model = "rule_based_v2_nondeterministic"

    def load(self):
        logger.info(
            "Modello II v2: generatore rule-based con varianti, nessun caricamento necessario"
        )

    def generate_from_findings(
        self,
        findings: List[dict],
        no_finding: bool,
        n_slices: int = 8,
        seed: Optional[int] = None,
    ) -> str:
        """
        seed: se fornito, rende la generazione riproducibile (utile per
        test automatici o per la sezione di valutazione della tesi).
        Se None (default), la scelta delle varianti è casuale a ogni chiamata.
        """
        rng = random.Random(seed)

        reperti = NEGATIVE_ALL_TEXT if no_finding else _compose_reperti(findings, rng)
        conclusioni = _compose_conclusioni(findings, no_finding)
        raccomandazioni = _compose_raccomandazioni(findings, no_finding)
        tecnica = TECNICA_TEXT.format(n_slices=n_slices)

        return (
            f"TECNICA:\n{tecnica}\n\n"
            f"REPERTI:\n{reperti}\n\n"
            f"CONCLUSIONI:\n{conclusioni}\n\n"
            f"RACCOMANDAZIONI:\n{raccomandazioni}"
        )


report_model = ReportModel()
