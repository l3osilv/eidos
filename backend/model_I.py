"""
Wrapper per il Modello I (classificazione, RF2).

TODO: sostituisci i punti segnati con l'architettura e il preprocessing
reali della repo (src/models.py, src/medical_encoders.py, src/preprocessing.py).
"""

import logging
from typing import List

import torch
from PIL import Image

logger = logging.getLogger("model_I")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # RNF7.1

# RF2.4 — multi-label: una soglia per classe, non un singolo 0.5 globale.
# Le soglie ottimali per classe vengono di solito calcolate con
# find_thresholds_swin.py (nel caso Stage 1) o l'equivalente in Stage 2:
# aggiornale con i valori reali una volta fatto il fine-tuning.
CLASS_THRESHOLDS = {
    "Blood": 0.5,
    "Ischemia": 0.5,
    "Chronic_Ischemia": 0.5,
    "Edema": 0.5,
    "Mass": 0.5,
}

# RNF6.2 — AUC misurato per classe, da comunicare come livello di affidabilità.
# Aggiorna con i valori reali ottenuti in fase di validazione.
CLASS_RELIABILITY_AUC = {
    "Blood": 0.568,
    "Ischemia": None,
    "Chronic_Ischemia": None,
    "Edema": 0.756,
    "Mass": 0.589,
}


class ClassificationModel:
    def __init__(self):
        self.model = None

    def load(self):
        logger.info("Caricamento Modello I (classificazione) su %s", DEVICE)
        # TODO:
        # from src.models import MILClassifier  (o equivalente)
        # self.model = MILClassifier(...)
        # checkpoint = torch.load("checkpoints/model_I_best.pth", map_location=DEVICE)
        # self.model.load_state_dict(checkpoint)
        # self.model.to(DEVICE).eval()
        logger.info("Modello I caricato (placeholder, da completare)")

    def _preprocess(self, images: List[Image.Image]) -> torch.Tensor:
        # TODO: sostituisci con la pipeline reale (CLAHE, circle mask, multi-window CT)
        raise NotImplementedError("Collegare preprocessing reale da src/preprocessing.py")

    @torch.no_grad()
    def predict(self, images: List[Image.Image]) -> dict:
        """
        Ritorna un dict {label: probability} per TUTTE le classi supportate.
        RF2.1, RF2.4 (multi-label).
        """
        if self.model is None:
            raise RuntimeError("Modello I non caricato")

        x = self._preprocess(images)

        # TODO: logits = self.model(x)  # shape (1, num_classes)
        # probs = torch.sigmoid(logits).squeeze(0).tolist()
        probs = [0.0] * len(CLASS_THRESHOLDS)  # placeholder

        return dict(zip(CLASS_THRESHOLDS.keys(), probs))


classification_model = ClassificationModel()
