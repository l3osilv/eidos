"""
Gestione salvataggio immagini TC su disco.
Le slice sono salvate come PNG grayscale nella cartella del paziente.
"""

import os
from pathlib import Path
from typing import List
from PIL import Image

IMAGES_ROOT = Path(os.getenv("IMAGES_ROOT", "storage/images"))


def save_patient_images(patient_id: str, images: List[Image.Image]) -> List[str]:
    """Salva le 8 slice TC in una cartella denominata con l'ID paziente."""
    folder = IMAGES_ROOT / patient_id
    folder.mkdir(parents=True, exist_ok=True)

    paths = []
    for i, img in enumerate(images):
        p = folder / f"slice_{i}.png"
        img.convert("L").save(p, format="PNG")
        paths.append(str(p))
    return paths