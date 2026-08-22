"""
rifinitura linguistica del referto tramite groq (modelli llama).
mantiene inalterato il significato clinico modificando solo lo stile.
"""

import logging
import os
from typing import List, Optional

logger = logging.getLogger("llm_refiner")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = os.getenv("GROQ_REFINER_MODEL", "llama-3.3-70b-versatile")
REQUEST_TIMEOUT_SECONDS = 15

SYSTEM_PROMPT = """Sei un assistente che riformula referti radiologici già completi in un \
linguaggio più scorrevole e naturale, mantenendo il registro clinico-professionale italiano.

REGOLE ASSOLUTE:
1. Non aggiungere alcuna patologia, reperto o dato clinico assente nel testo originale.
2. Non rimuovere alcuna patologia o reperto menzionato, né cambiarne l'esito (positivo/negativo).
3. Non alterare il livello di confidenza espresso (es. "sospetta", "evidente").
4. Non aggiungere nuove raccomandazioni o indicazioni cliniche.
5. Migliora solo la fluidità sintattica e la leggibilità.
6. Mantieni la struttura a sezioni (TECNICA, REPERTI, CONCLUSIONI, RACCOMANDAZIONI).
7. Restituisci solo il testo riformulato, senza cappelli introduttivi o commenti.

Se non puoi rispettare questi vincoli, restituisci il testo originale intatto."""


def _build_user_prompt(skeleton_text: str) -> str:
    return (
        "Riformula il seguente referto radiologico mantenendo "
        "invariato il contenuto clinico:\n\n"
        f"{skeleton_text}"
    )


def refine_report(skeleton_text: str) -> Optional[str]:
    """invia lo scheletro all'api groq e ottiene il testo rifinito."""
    if not GROQ_API_KEY:
        logger.info("Rifinitura LLM disattivata (GROQ_API_KEY non impostata)")
        return None

    try:
        from groq import Groq
    except ImportError:
        logger.warning("Libreria 'groq' non installata: rifinitura LLM disattivata")
        return None

    try:
        client = Groq(api_key=GROQ_API_KEY, timeout=REQUEST_TIMEOUT_SECONDS)
        response = client.chat.completions.create(
            model=MODEL_NAME,
            temperature=0.3,
            max_tokens=800,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(skeleton_text)},
            ],
        )
        refined = response.choices[0].message.content or ""
        refined = refined.strip()

        if not refined:
            return None
        return refined

    except Exception:
        logger.exception("Chiamata API Groq fallita.")
        return None


def _extract_mentions(text: str, label: str) -> bool:
    return label.lower().replace("_", " ") in text.lower()


def validate_refinement(refined_text: str, findings: List[dict]) -> bool:
    """verifica che le patologie positive siano presenti anche nel testo rifinito."""
    for f in findings:
        if f["positive"] and not _extract_mentions(refined_text, f["label"]):
            logger.warning("Rifinitura non valida: persa menzione di %s", f["label"])
            return False
    return True