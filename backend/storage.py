"""
Le immagini NON vengono salvate dentro MongoDB (sconsigliato per file binari
di queste dimensioni senza GridFS): vengono salvate su disco in una cartella
per paziente, e il documento Mongo del paziente contiene solo i path.

Se preferisci tenere tutto dentro MongoDB con GridFS, è un cambio isolato
in questo file: l'interfaccia verso main.py resta identica.
"""

import os
from typing import List

from PIL import Image

IMAGES_ROOT = os.getenv("IMAGES_ROOT", "storage/images")


def save_patient_images(patient_id: str, images: List[Image.Image]) -> List[str]:
    """Salva le slice su disco, ritorna la lista dei path in ordine."""
    folder = os.path.join(IMAGES_ROOT, patient_id)
    os.makedirs(folder, exist_ok=True)

    paths = []
    for i, img in enumerate(images):
        path = os.path.join(folder, f"slice_{i}.png")
        img.convert("L").save(path, format="PNG")  # scala di grigi, coerente con CT
        paths.append(path)
    return paths


def load_image(path: str) -> Image.Image:
    return Image.open(path)
