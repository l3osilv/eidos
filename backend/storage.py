"""
gestione salvataggio immagini tc su disco.
le slice sono salvate come png in scala di grigi nella cartella del paziente.
"""

import os
from pathlib import Path
from typing import List
from PIL import Image

IMAGES_ROOT = Path(os.getenv("IMAGES_ROOT", "storage/images"))


def save_patient_images(patient_id: str, images: List[Image.Image]) -> List[str]:
    """salva le 8 slice tc in una cartella denominata con l'id del paziente."""
    folder = IMAGES_ROOT / patient_id
    folder.mkdir(parents=True, exist_ok=True)

    paths = []
    for i, img in enumerate(images):
        p = folder / f"slice_{i}.png"
        img.convert("L").save(p, format="PNG")
        paths.append(str(p))
    return paths