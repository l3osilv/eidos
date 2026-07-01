"""
Storage locale delle immagini TC su filesystem.

Le immagini NON vengono salvate dentro MongoDB: vengono salvate su disco in una
cartella per paziente, e il documento Mongo contiene solo i path assoluti.

Strategia scelta:
  - Ogni paziente ha una cartella dedicata con nome = ObjectId MongoDB
  - Le slice sono salvate come PNG in scala di grigi (slice_0.png ... slice_7.png)
  - Il formato PNG è lossless, adatto a immagini medicali dove la compressione
    con perdita (JPEG) potrebbe alterare i valori di densità

Configurazione:
  - IMAGES_ROOT: variabile d'ambiente (default: storage/images nella working directory)
"""

import os
from pathlib import Path
from typing import List

from PIL import Image

IMAGES_ROOT = Path(os.getenv("IMAGES_ROOT", "storage/images"))


def save_patient_images(patient_id: str, images: List[Image.Image]) -> List[str]:
    """
    Salva le 8 slice di un paziente su disco in formato PNG grayscale.

    Crea la cartella <IMAGES_ROOT>/<patient_id>/ se non esiste.
    Ritorna la lista dei path assoluti dei file salvati, nello stesso ordine
    delle immagini ricevute. Questi path vengono poi memorizzati nel documento
    MongoDB del paziente per il recupero successivo.

    Args:
        patient_id: ObjectId del paziente (stringa), usato come nome cartella.
        images: lista di PIL.Image — le 8 slice TC caricate dall'utente.

    Returns:
        Lista di path ai file PNG salvati (es. ['storage/images/abc123/slice_0.png', ...]).
    """
    folder = IMAGES_ROOT / patient_id
    folder.mkdir(parents=True, exist_ok=True)

    paths = []
    for i, img in enumerate(images):
        p = folder / f"slice_{i}.png"
        img.convert("L").save(p, format="PNG")  # scala di grigi, coerente con CT
        paths.append(str(p))
    return paths