"""
Modello II — Generazione referto (RF3), v3.

Non è un modello generativo addestrato — è un generatore rule-based che compone
frasi template a partire dai findings del Modello I. La scelta non è una scorciatoia:
labels.csv ha solo etichette binarie, nessun referto testuale libero, quindi non c'è
nemmeno un dataset su cui addestrare un modello visione→testo. Va dichiarato
esplicitamente nella tesi.

Il vantaggio collaterale di questo approccio è che il referto non può contraddire
i findings per costruzione — il testo viene generato direttamente da loro, quindi
il check di coerenza è quasi sempre verde tranne se il medico modifica manualmente
il testo togliendo un finding positivo.

Rispetto alla v2:
- Varianti aggiunte ovunque: TECNICA (3), REPERTI negativo (3), CONNECTORS (8),
  RACCOMANDAZIONI (2-3 per classe), CONCLUSIONI (4 intro + 3 negative)
- Frase introduttiva quando ci sono ≥2 findings positivi nello stesso referto
- Tutto usa lo stesso rng, quindi seed funziona ancora su tutte le sezioni

Se chiami /report più volte sullo stesso paziente ottieni testo diverso ogni volta
(il contenuto clinico è identico, varia la formulazione). Per test riproducibili
passa seed=<intero> a generate_from_findings().
"""

import logging
import random
from typing import Dict, List, Optional

logger = logging.getLogger("model_II")

# Ordine fisso delle classi nel referto — rispecchia la priorità clinica
# convenzionale in neuroradiologia (emorragia e ischemia acuta prima delle croniche).
LABEL_ORDER = ["Blood", "Ischemia", "Chronic_Ischemia", "Edema", "Mass"]

# Le frasi dentro ogni categoria sono clinicamente equivalenti tra loro —
# stesso contenuto diagnostico, formulazione diversa. Non aggiungere varianti
# che cambiano il significato clinico, solo la forma sintattica.
FINDING_TEMPLATES: Dict[str, Dict[str, List[str]]] = {
    "Blood": {
        "negative": [
            "Non si osservano aree iperdense sospette per sanguinamento in atto.",
            "Assenza di focolai iperdensi compatibili con emorragia intracranica.",
            "Non si rilevano segni di sanguinamento intracranico in atto.",
            "Nessuna area di iperdensità riferibile a sanguinamento è identificabile.",
        ],
        "sospetta": [
            "Si segnala area iperdensa di incerta significatività, da correlare con il quadro clinico, non dirimente per focolaio emorragico.",
            "Presenza di area di dubbia iperdensità, non chiaramente attribuibile a sanguinamento in atto.",
            "Si rileva sfumata area di iperdensità di significato non definito, da valutare in correlazione clinica.",
        ],
        "probabile": [
            "Si rileva area iperdensa compatibile con focolaio emorragico.",
            "Si osserva area di aumentata densità riferibile a sanguinamento intracranico.",
            "Reperto iperdensità focale in sede parenchimale, compatibile con emorragia.",
        ],
        "evidente": [
            "Si rileva area iperdensa francamente evidente, compatibile con focolaio emorragico significativo.",
            "Presenza di estesa area iperdensa, fortemente indicativa di sanguinamento in atto.",
            "Si identifica voluminosa area di iperdensità parenchimale, compatibile con emorragia intracranica di rilievo.",
        ],
    },
    "Ischemia": {
        "negative": [
            "Non si osservano aree di ipodensità recente compatibili con ischemia in atto.",
            "Assenza di alterazioni di densità riferibili a lesione ischemica acuta.",
            "Non si identificano aree di sofferenza ischemica acuta o subacuta.",
            "Nessun reperto di ipodensità riferibile a ischemia recente è rilevabile.",
        ],
        "sospetta": [
            "Si segnala area di ipodensità di incerto significato, da correlare clinicamente, non dirimente per ischemia acuta.",
            "Lieve area di riduzione di densità di significato non definito, non chiaramente attribuibile a lesione ischemica acuta.",
            "Si osserva sfumata ipodensità focale di incerta interpretazione; correlazione clinica raccomandata.",
        ],
        "probabile": [
            "Si evidenzia area di ipodensità compatibile con lesione ischemica in fase acuta/subacuta.",
            "Si osserva area ipodensa riferibile a sofferenza ischemica recente.",
            "Reperto di ipodensità parenchimale in sede cortico-sottocorticale, compatibile con evento ischemico in fase acuta.",
        ],
        "evidente": [
            "Si evidenzia estesa area di ipodensità, francamente compatibile con lesione ischemica in fase acuta/subacuta.",
            "Ampia zona ipodensa territoriale di netta compatibilità con ischemia acuta estesa.",
            "Lesione ipodensa di significative dimensioni, del tutto compatibile con infarto ischemico in fase acuta.",
        ],
    },
    "Chronic_Ischemia": {
        "negative": [
            "Non si osservano esiti ischemici cronici di rilievo.",
            "Assenza di alterazioni riferibili a sofferenza ischemica cronica.",
            "Non si identificano aree di gliosi o ipodensità riferibili a esiti ischemici pregressi di rilievo.",
            "Nessun reperto di sofferenza ischemica cronica significativa è individuabile.",
        ],
        "sospetta": [
            "Si segnalano minime aree di ipodensità, di incerto significato, non chiaramente attribuibili a esiti ischemici cronici.",
            "Lievi alterazioni della sostanza bianca perivascolare di incerta interpretazione; possibile esito di microangiopatia cronica.",
            "Sfumata rarefazione della sostanza bianca periventricolare, di significato non definito in assenza di anamnesi vascolare.",
        ],
        "probabile": [
            "Sono presenti aree di gliosi/ipodensità compatibili con esiti ischemici cronici.",
            "Si osservano alterazioni della sostanza bianca riferibili a sofferenza ischemica cronica.",
            "Aree di leucoaraiosi periventricolari e sottocorticali, compatibili con encefalopatia vascolare cronica.",
        ],
        "evidente": [
            "Sono presenti estese aree di gliosi compatibili con marcati esiti ischemici cronici.",
            "Diffuse e confluenti alterazioni della sostanza bianca, compatibili con encefalopatia vascolare cronica di grado severo.",
            "Multiple lacune ischemiche croniche e confluente rarefazione della sostanza bianca, espressione di severa microangiopatia cerebrale.",
        ],
    },
    "Edema": {
        "negative": [
            "Non si osservano segni di edema cerebrale significativo.",
            "Assenza di alterazioni di densità riferibili a edema parenchimale.",
            "Nessun reperto riferibile a edema cerebrale è identificabile.",
            "Non si rilevano alterazioni della densità parenchimale attribuibili a edema cerebrale.",
        ],
        "sospetta": [
            "Si segnala minima alterazione di densità, di incerto significato, non chiaramente attribuibile a edema.",
            "Lieve riduzione di densità parenchimale di significato non definito; non dirimente per edema cerebrale.",
            "Sfumata ipodensità focale di incerta interpretazione; correlazione clinica necessaria per escludere componente edemigena.",
        ],
        "probabile": [
            "Si apprezza area di edema a livello del parenchima cerebrale.",
            "Si osserva alterazione di densità compatibile con edema parenchimale.",
            "Reperto di ipodensità compatibile con reazione edemigena parenchimale focale.",
        ],
        "evidente": [
            "Si apprezza estesa area di edema parenchimale, con possibile effetto compressivo sulle strutture adiacenti.",
            "Ampia area di edema cerebrale con segni di effetto massa sulle strutture della linea mediana.",
            "Marcata ipodensità diffusa compatibile con edema cerebrale severo; da valutare con urgenza l'effetto sulle strutture della linea mediana.",
        ],
    },
    "Mass": {
        "negative": [
            "Non si osservano formazioni espansive occupanti spazio evidenti.",
            "Assenza di lesioni occupanti spazio di rilievo.",
            "Non si identificano formazioni espansive endocraniche evidenti.",
            "Nessuna lesione occupante spazio è identificabile nelle scansioni analizzate.",
        ],
        "sospetta": [
            "Si segnala area di incerta significatività, non dirimente per formazione espansiva, da approfondire.",
            "Reperto di dubbia interpretazione, non chiaramente riferibile a lesione espansiva; approfondimento diagnostico raccomandato.",
            "Si osserva area di alterata densità di significato non determinabile con il solo esame TC senza contrasto.",
        ],
        "probabile": [
            "Si identifica formazione espansiva occupante spazio, da caratterizzare con approfondimento diagnostico.",
            "Si osserva lesione occupante spazio, di natura da determinare con imaging di secondo livello.",
            "Reperto di formazione occupante spazio in sede parenchimale, di natura non ulteriormente caratterizzabile con il solo TC diretto.",
        ],
        "evidente": [
            "Si identifica formazione espansiva di dimensioni significative, occupante spazio, con effetto sulle strutture adiacenti.",
            "Voluminosa lesione occupante spazio con effetto massa sulle strutture limitrofe, da sottoporre urgentemente a caratterizzazione RM.",
            "Formazione espansiva di rilievo con segni di effetto massa; la natura non è caratterizzabile con il solo TC diretto e richiede approfondimento RM con contrasto.",
        ],
    },
}

# Connettori tra findings positivi consecutivi — ne servono abbastanza da non
# ripetere la stessa frase su referti con 2-3 patologie positive.
CONNECTORS: List[str] = [
    "Si associa inoltre il seguente reperto:",
    "Si segnala inoltre quanto segue:",
    "A questo si associa il seguente ulteriore reperto:",
    "Ulteriore reperto di rilievo:",
    "Si rileva contestualmente:",
    "In aggiunta al reperto precedente:",
    "Si identifica inoltre:",
    "Reperto aggiuntivo di interesse clinico:",
]

# Frase di apertura quando ci sono ≥2 findings positivi — serve a dare un contesto
# prima di elencarli uno a uno, invece di iniziare direttamente con il primo finding.
MULTI_FINDING_INTRO: List[str] = [
    "L'esame evidenzia la coesistenza di più reperti patologici, descritti di seguito.",
    "Sono presenti più alterazioni degne di nota, dettagliate in sequenza.",
    "L'analisi delle scansioni rivela la presenza di più reperti significativi.",
    "Si rilevano contestualmente diversi reperti di interesse clinico, elencati di seguito.",
]

# Le raccomandazioni hanno 2-3 varianti per classe — così due referti con la stessa
# singola patologia positiva non producono testo identico parola per parola.
RECOMMENDATIONS: Dict[str, List[str]] = {
    "Blood": [
        "Si raccomanda valutazione neurochirurgica urgente e correlazione con il quadro clinico.",
        "Indicata consulenza neurochirurgica con urgenza; correlare con parametri clinici e anamnesi.",
        "Correlazione clinica urgente e valutazione neurochirurgica raccomandate.",
    ],
    "Ischemia": [
        "Si raccomanda valutazione neurologica con urgenza e correlazione clinica.",
        "Indicata consulenza neurologica urgente; valutare opportunità di imaging di perfusione.",
        "Correlazione clinica urgente; si raccomanda consulenza neurologica per eventuale trattamento fibrinolitico.",
    ],
    "Chronic_Ischemia": [
        "Reperto da correlare con l'anamnesi vascolare del paziente.",
        "Si raccomanda valutazione del profilo di rischio cardiovascolare e correlazione con l'anamnesi.",
        "Correlazione con l'anamnesi vascolare; indicato follow-up clinico-radiologico programmato.",
    ],
    "Edema": [
        "Si raccomanda monitoraggio clinico-radiologico ravvicinato.",
        "Indicato stretto monitoraggio clinico e radiologico; valutare cause sottostanti (infiammatorie, neoplastiche, vascolari).",
        "Monitoraggio della pressione intracranica e rivalutazione TC a breve termine raccomandata.",
    ],
    "Mass": [
        "Si raccomanda approfondimento diagnostico (RM encefalo con contrasto) e valutazione multidisciplinare.",
        "Indicata RM encefalo con e senza mezzo di contrasto per caratterizzazione della lesione; valutazione neuroradiologica multidisciplinare.",
        "Approfondimento con RM con contrasto urgente; discussione multidisciplinare (neurochirurgia, oncologia) raccomandata.",
    ],
}

# Testo della sezione REPERTI per esame completamente negativo —
# 3 varianti così non è sempre identico anche quando il caso è negativo.
NEGATIVE_ALL_TEXTS: List[str] = [
    (
        "Non si rilevano alterazioni significative dell'attenuometria parenchimale. "
        "Non si osservano lesioni emorragiche, aree ischemiche acute o croniche, edema "
        "parenchimale o formazioni espansive occupanti spazio evidenti."
    ),
    (
        "L'attenuometria parenchimale è nella norma. "
        "Assenza di focolai emorragici, aree di sofferenza ischemica acuta o cronica, "
        "edema cerebrale o lesioni occupanti spazio evidenti alle scansioni analizzate."
    ),
    (
        "Non si identificano reperti patologici di rilievo. "
        "Nessuna lesione emorragica, ischemica acuta o cronica, edema parenchimale "
        "o formazione espansiva endocranica è evidenziabile nelle scansioni esaminate."
    ),
]

# Sezione TECNICA — 3 modi diversi di dire la stessa cosa.
# Il terzo menziona esplicitamente il preprocessing, utile se si vuole
# che il referto documenti anche la pipeline usata.
TECNICA_TEMPLATES: List[str] = [
    "Esame TC dell'encefalo, {n_slices} scansioni assiali analizzate. Pre-elaborazione standard applicata alle immagini.",
    "TC cerebrale eseguita su {n_slices} sezioni assiali. Le immagini sono state sottoposte a pre-elaborazione standardizzata prima dell'analisi.",
    "Analisi di {n_slices} scansioni assiali di TC encefalo. Pre-processing standardizzato (circle masking, multi-window, CLAHE) applicato prima dell'elaborazione automatica.",
]

# Introduzione variabile per la riga delle conclusioni positive
CONCLUSIONI_INTRO_POSITIVE: List[str] = [
    "Quadro TC compatibile con:",
    "Il quadro tomografico è compatibile con:",
    "L'esame TC risulta compatibile con la presenza di:",
    "Le scansioni analizzate sono compatibili con:",
]

# Conclusione per esame negativo
CONCLUSIONI_NEGATIVA: List[str] = [
    "Quadro TC nei limiti, in assenza di reperti patologici significativi.",
    "Esame TC privo di reperti patologici di rilievo nelle scansioni analizzate.",
    "Quadro tomografico nella norma; nessun reperto patologico significativo nelle scansioni esaminate.",
]


def _severity_level(probability: float, threshold: float) -> str:
    """
    Restituisce il livello di confidenza del modello — non è una valutazione
    della gravità clinica, è solo quanto la probabilità supera la soglia.
    Tre livelli:
      - margin < 0.08  → "sospetta"  (appena sopra soglia, poco convincente)
      - prob >= 0.85   → "evidente"  (il modello è abbastanza sicuro)
      - il resto       → "probabile" (via di mezzo)
    """
    margin = probability - threshold
    if margin < 0.08:
        return "sospetta"
    if probability >= 0.85:
        return "evidente"
    return "probabile"


def _compose_reperti(findings: List[dict], rng: random.Random) -> str:
    """
    Compone la sezione REPERTI.
    Se ci sono ≥2 findings positivi aggiunge una frase introduttiva prima di
    elencarli — evita di iniziare direttamente con il primo finding senza contesto.
    Tra un finding positivo e il successivo inserisce un connettore variabile.
    """
    by_label = {f["label"]: f for f in findings}
    positive_count = sum(1 for f in findings if f["positive"])
    sentences = []

    if positive_count >= 2:
        sentences.append(rng.choice(MULTI_FINDING_INTRO))

    positive_count_so_far = 0

    for label in LABEL_ORDER:
        f = by_label.get(label)
        if f is None:
            continue

        templates = FINDING_TEMPLATES[label]

        if f["positive"]:
            level = _severity_level(f["probability"], f["threshold"])
            sentence = rng.choice(templates[level])

            # Connettore tra findings positivi — dal secondo in poi
            if positive_count_so_far > 0:
                sentences.append(rng.choice(CONNECTORS))

            sentences.append(sentence)
            positive_count_so_far += 1
        else:
            sentences.append(rng.choice(templates["negative"]))

    return " ".join(sentences)


def _compose_conclusioni(findings: List[dict], no_finding: bool, rng: random.Random) -> str:
    """Riga di conclusione — phrasing dell'introduzione variabile."""
    if no_finding:
        return rng.choice(CONCLUSIONI_NEGATIVA)

    positive_labels = [f["label"].replace("_", " ") for f in findings if f["positive"]]
    intro = rng.choice(CONCLUSIONI_INTRO_POSITIVE)
    return intro + " " + ", ".join(positive_labels) + "."


def _compose_raccomandazioni(findings: List[dict], no_finding: bool, rng: random.Random) -> str:
    """
    Raccomandazioni per ogni finding positivo.
    Se più classi condividono per caso la stessa frase (non dovrebbe succedere
    con le varianti attuali, ma meglio gestirlo) i duplicati vengono eliminati.
    """
    if no_finding:
        return "Nessuna raccomandazione specifica; follow-up secondo pratica clinica standard."

    lines = []
    for f in findings:
        if f["positive"] and f["label"] in RECOMMENDATIONS:
            lines.append(rng.choice(RECOMMENDATIONS[f["label"]]))

    if not lines:
        return "Nessuna raccomandazione specifica; follow-up secondo pratica clinica standard."

    # deduplicazione preservando l'ordine
    seen: set = set()
    unique_lines = []
    for line in lines:
        if line not in seen:
            unique_lines.append(line)
            seen.add(line)

    return " ".join(unique_lines)


class ReportModel:
    """
    Generatore rule-based di referti neuroradiologici (RF3).
    Non addestrato — compone template a partire dai findings del Modello I.
    """

    def __init__(self):
        self.model = "rule_based_v3_nondeterministic"

    def load(self):
        logger.info("Modello II v3: nessun caricamento necessario, generatore rule-based")

    def generate_from_findings(
        self,
        findings: List[dict],
        no_finding: bool,
        n_slices: int = 8,
        seed: Optional[int] = None,
    ) -> str:
        """
        Genera il referto dai findings del Modello I.

        findings:   lista di dict {label, probability, threshold, positive}
        no_finding: True se nessuna classe ha superato la soglia
        n_slices:   numero di slice nell'esame (va nella sezione TECNICA)
        seed:       se passato, l'output è riproducibile — utile per i test
                    e per la sezione di valutazione della tesi. Se None (default)
                    ogni chiamata produce una formulazione diversa.
        """
        rng = random.Random(seed)

        tecnica = rng.choice(TECNICA_TEMPLATES).format(n_slices=n_slices)
        reperti = rng.choice(NEGATIVE_ALL_TEXTS) if no_finding else _compose_reperti(findings, rng)
        conclusioni = _compose_conclusioni(findings, no_finding, rng)
        raccomandazioni = _compose_raccomandazioni(findings, no_finding, rng)

        return (
            f"TECNICA:\n{tecnica}\n\n"
            f"REPERTI:\n{reperti}\n\n"
            f"CONCLUSIONI:\n{conclusioni}\n\n"
            f"RACCOMANDAZIONI:\n{raccomandazioni}"
        )


# Singleton importato da main.py
report_model = ReportModel()
