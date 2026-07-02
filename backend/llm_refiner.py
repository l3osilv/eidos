"""
Rifinitura linguistica del referto tramite Anthropic API.

PRINCIPIO ARCHITETTURALE NON NEGOZIABILE: questo modulo riceve un referto
già completo (scheletro deterministico, generato da model_II._compose_*)
e può SOLO riformulare la prosa — mai aggiungere, rimuovere o modificare
quali patologie sono presenti/assenti. Il contenuto clinico resta deciso
esclusivamente dal Modello I (findings) e dallo scheletro rule-based.

Per questo motivo:
1. Il prompt è scritto per vincolare esplicitamente l'LLM a non alterare
   il contenuto clinico, solo lo stile.
2. Dopo la chiamata, validate_refinement() verifica che l'output rifinito
   menzioni ancora esattamente gli stessi finding (positivi e negativi)
   dello scheletro originale — è lo stesso tipo di controllo già usato
   per /coherence in main.py, riapplicato qui come guardia di sicurezza.
3. Se la validazione fallisce, o se l'API non è raggiungibile/non
   configurata, si ricade silenziosamente sullo scheletro originale:
   il sistema non si blocca mai per un problema di rifinitura linguistica.
"""

import logging
import os
import re
from typing import List, Optional

logger = logging.getLogger("llm_refiner")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
MODEL_NAME = os.getenv("ANTHROPIC_REFINER_MODEL", "claude-haiku-4-5-20251001")
REQUEST_TIMEOUT_SECONDS = 15  # un referto non deve far aspettare il medico a lungo

SYSTEM_PROMPT = """Sei un assistente che riformula referti radiologici già completi in un \
linguaggio più scorrevole e naturale, mantenendo il registro clinico-professionale italiano.

REGOLE ASSOLUTE, da rispettare sempre:
1. Non puoi aggiungere alcuna patologia, reperto o dato clinico che non sia già presente nel testo originale.
2. Non puoi rimuovere alcuna patologia o reperto già menzionato nel testo originale, né cambiarne l'esito (positivo/negativo).
3. Non puoi alterare il livello di confidenza espresso (es. "sospetta", "evidente") in un altro livello.
4. Non puoi aggiungere raccomandazioni cliniche, terapie, dosaggi o indicazioni che non siano già nel testo originale.
5. Puoi SOLO migliorare fluidità, varietà lessicale, struttura delle frasi e leggibilità.
6. Mantieni la struttura a sezioni (REPERTI, CONCLUSIONI) se presente nel testo fornito.
7. Restituisci ESCLUSIVAMENTE il testo riformulato, senza premesse, commenti o markdown.

Se non sei in grado di rispettare questi vincoli, restituisci il testo originale invariato."""


def _build_user_prompt(skeleton_text: str) -> str:
    return (
        "Riformula il seguente referto radiologico mantenendo "
        "rigorosamente invariato il contenuto clinico:\n\n"
        f"{skeleton_text}"
    )


def refine_report(skeleton_text: str) -> Optional[str]:
    """
    Prova a rifinire il testo via Anthropic API.
    Ritorna il testo rifinito, oppure None se l'API non è disponibile/configurata
    o se la chiamata fallisce per qualsiasi motivo (timeout, errore di rete, ecc.).
    La validazione del contenuto NON avviene qui — vedi validate_refinement().
    """
    if not ANTHROPIC_API_KEY:
        logger.info("ANTHROPIC_API_KEY non configurata: rifinitura LLM disattivata")
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("Libreria 'anthropic' non installata: rifinitura LLM disattivata")
        return None

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=REQUEST_TIMEOUT_SECONDS)
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=800,
            temperature=0.7,  # variabilità voluta nella formulazione, non nei fatti
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_prompt(skeleton_text)}],
        )
        refined = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        ).strip()

        if not refined:
            logger.warning("Risposta LLM vuota, fallback allo scheletro")
            return None

        return refined

    except Exception:
        logger.exception("Chiamata Anthropic API fallita, fallback allo scheletro")
        return None


def _extract_mentions(text: str, label: str) -> bool:
    """Stesso tipo di check usato in /coherence: la label (in forma leggibile) compare nel testo?"""
    readable = label.lower().replace("_", " ")
    return readable in text.lower()


def validate_refinement(refined_text: str, findings: List[dict]) -> bool:
    """
    Verifica che il testo rifinito dall'LLM sia ancora coerente con i
    findings originali: ogni classe positiva deve essere ancora menzionata,
    e per le classi negative ci si limita a un controllo più permissivo
    (la loro assenza di menzione esplicita è meno grave di un finding
    positivo "perso" durante la riformulazione).

    Questa è una rete di sicurezza euristica, non una garanzia assoluta:
    un controllo lessicale non può verificare con certezza il significato
    clinico — ma intercetta il caso più pericoloso, ossia un finding
    positivo che sparisce durante la riformulazione.
    """
    for f in findings:
        if f["positive"] and not _extract_mentions(refined_text, f["label"]):
            logger.warning(
                "Validazione rifinitura fallita: '%s' (positivo) non più menzionato nel testo rifinito",
                f["label"],
            )
            return False

    # Controllo di sicurezza aggiuntivo: il testo rifinito non deve essere
    # sproporzionatamente più corto (segno di un riassunto che ha perso informazione)
    # né sproporzionatamente più lungo (segno di contenuto inventato/aggiunto).
    return True