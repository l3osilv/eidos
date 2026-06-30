"""
Wrapper per il Modello I di classificazione (RF2).

Collega il backend alla repo SSL-BrainCT-Pathology (stage2_2d_slice_level).
Un modello binario per classe, caricato separatamente: è la strategia "binary
decomposition" che nella repo originale batte il multi-label di parecchio (+6/+46% AUC).

Architettura per ogni classe:
  DenseNet-121 (encoder, pesi SimCLR) → GatedAttentionAggregator → testa di classificazione
  → sigmoid → probabilità tra 0 e 1

NB: ogni run di training salva i parametri usati in outputs/<run_name>/config.json.
Se hai usato encoder o aggregatori diversi dal default, mettili in RUN_CONFIG_OVERRIDES,
non toccare il resto del file.

ATTENZIONE al preprocessing: le immagini devono passare per BrainCTPreprocessor
con gli stessi parametri usati in training (circle mask, multi-window, CLAHE).
Se usi un preprocessing diverso il modello riceve input fuori distribuzione —
niente errore, solo predizioni completamente sbagliate. È il tipo di bug peggiore.
"""

import logging
import os
import sys
from typing import Dict, List, Optional

import cv2
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger("model_I")

# GPU se disponibile, altrimenti CPU — vedi RNF7.1
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Path alla repo clonata (deve contenere stage2_2d_slice_level/.../src/).
# Imposta SSL_BRAINCT_SRC nell'ambiente, altrimenti usa il path relativo di default
# che funziona se la repo è affiancata a questa nella struttura delle cartelle.
REPO_SRC_PATH = os.getenv(
    "SSL_BRAINCT_SRC",
    "../../SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning",
)
if REPO_SRC_PATH not in sys.path:
    sys.path.insert(0, REPO_SRC_PATH)

try:
    from src.config import Config
    from src.models import MultiLabelMILClassifier
    from src.preprocessing import BrainCTPreprocessor
except ImportError as e:
    # Se la repo non è raggiungibile il backend parte comunque, ma /classify
    # risponderà con 501. Controllare SSL_BRAINCT_SRC nei log di avvio.
    Config = None
    MultiLabelMILClassifier = None
    BrainCTPreprocessor = None
    logger.warning(
        "Import della repo fallito (%s). "
        "Imposta SSL_BRAINCT_SRC come variabile d'ambiente.",
        e,
    )

# Checkpoint fine-tuned per classe — contengono già i pesi SSL dentro,
# salvati dal training supervisionato. Non sono i pesi SSL grezzi.
CHECKPOINT_PATHS: Dict[str, str] = {
    "Blood": "checkpoints/model_I_blood_best.pth",
    "Mass": "checkpoints/model_I_mass_best.pth",
    "Ischemia": "checkpoints/model_I_ischemia_best.pth",
    "Edema": "checkpoints/model_I_edema_best.pth",
}

# Usalo solo se un run specifico ha usato un encoder o aggregatore diverso dal default.
# Es: {"Mass": {"ENCODER_NAME": "convnext_small", "AGGREGATOR_TYPE": "gated_attention"}}
# Se è tutto densenet121 + gated_attention lascia vuoto.
RUN_CONFIG_OVERRIDES: Dict[str, dict] = {}

# Soglie di decisione per classe. 0.5 è solo il default iniziale —
# andrebbero calibrate sul validation set con find_thresholds_swin.py (o equivalente
# Stage 2). Con soglie ottimizzate l'F1 migliora sensibilmente.
CLASS_THRESHOLDS: Dict[str, float] = {
    "Blood": 0.5,
    "Mass": 0.5,
    "Ischemia": 0.5,
    "Chronic_Ischemia": 0.5,
    "Edema": 0.5,
}

# AUC di riferimento — per ora quelli del README della repo originale (densenet121 + avg).
# Vanno sostituiti con i valori reali dei tuoi checkpoint non appena hai i risultati
# di validazione. Questi vengono usati solo per logging e per l'endpoint /health.
CLASS_RELIABILITY_AUC: Dict[str, Optional[float]] = {
    "Blood": 0.568,
    "Mass": 0.589,
    "Edema": 0.756,
    "Ischemia": None,      # non ancora misurato sui nostri run
    "Chronic_Ischemia": None,
}


def _build_cfg(label: str):
    """Ricostruisce la stessa Config usata in training per questa classe."""
    cfg = Config()
    cfg.set_task_mode("binary", target_class=label)
    cfg.ENCODER_PRETRAINED = False  # i pesi vengono dal checkpoint, non da ImageNet
    cfg.ENCODER_NAME = "densenet121"  # quello passato con --encoder durante il training

    for key, value in RUN_CONFIG_OVERRIDES.get(label, {}).items():
        setattr(cfg, key, value)

    return cfg


def _build_architecture(label: str) -> torch.nn.Module:
    """
    Istanzia il MultiLabelMILClassifier per la classe indicata.
    Fallisce con NotImplementedError se la repo non è stata importata.
    """
    if MultiLabelMILClassifier is None:
        raise NotImplementedError(
            "Import della repo non riuscito: controlla SSL_BRAINCT_SRC"
        )
    cfg = _build_cfg(label)
    return MultiLabelMILClassifier(cfg, ssl_weights=None)


def _extract_state_dict(checkpoint) -> dict:
    """
    I checkpoint PyTorch non hanno un formato unico: a volte è uno state_dict
    puro, a volte è un dict con chiave 'model_state_dict' o 'state_dict'.
    Questa funzione gestisce entrambi i casi per non dover dipendere dal formato
    esatto usato dallo script di training.
    """
    if isinstance(checkpoint, dict):
        for key in ("model_state_dict", "state_dict"):
            if key in checkpoint:
                return checkpoint[key]
        # Nessuna chiave nota: assumiamo sia già lo state_dict diretto
        return checkpoint
    return checkpoint


class ClassificationModel:
    """
    Wrapper attorno ai modelli di classificazione binaria per classe (RF2).

    Due metodi pubblici:
      - load(): chiamato una volta sola all'avvio del backend
      - predict(images): riceve le 8 slice e torna {label: probabilità}
    """

    def __init__(self):
        self.models: Dict[str, torch.nn.Module] = {}  # label → modello in eval()
        self.preprocessor = None  # BrainCTPreprocessor, inizializzato in load()
        self.img_size = (224, 224)  # resize target, uguale a quello usato in training

    def load(self):
        """
        Carica i checkpoint disponibili. Quelli mancanti vengono saltati con un warning
        e il sistema continua a funzionare con le classi rimanenti.
        """
        logger.info("Caricamento Modello I su %s", DEVICE)

        if BrainCTPreprocessor is not None:
            # Questi sono i parametri di default del Config della repo.
            # Se i config.json dei tuoi run hanno valori diversi, aggiorna qui.
            self.preprocessor = BrainCTPreprocessor(
                use_circle_mask=True,
                circle_radius=0.45,
                adaptive_circle=True,
                use_multiwindow=True,
                use_clahe=True,
            )

        for label, path in CHECKPOINT_PATHS.items():
            if not os.path.exists(path):
                logger.warning(
                    "Checkpoint per '%s' non trovato in '%s' — saltato", label, path
                )
                continue

            try:
                model = _build_architecture(label)
                checkpoint = torch.load(path, map_location=DEVICE)
                state_dict = _extract_state_dict(checkpoint)

                missing, unexpected = model.load_state_dict(state_dict, strict=False)
                if missing:
                    logger.warning(
                        "'%s': %d chiavi mancanti nel checkpoint", label, len(missing)
                    )
                if unexpected:
                    logger.warning(
                        "'%s': %d chiavi inattese nel checkpoint", label, len(unexpected)
                    )

                model.to(DEVICE).eval()
                self.models[label] = model
                logger.info("Modello per '%s' caricato da '%s'", label, path)

            except NotImplementedError as e:
                logger.warning("'%s' non caricato: %s", label, e)
            except Exception:
                logger.exception("Errore caricando il checkpoint per '%s'", label)

        if not self.models:
            logger.warning(
                "Nessun modello caricato. "
                "Controlla CHECKPOINT_PATHS e la variabile SSL_BRAINCT_SRC."
            )

    def _preprocess_one(self, img: Image.Image) -> np.ndarray:
        """
        Preprocessing di una singola slice:
          1. Conversione in grayscale — il preprocessore vuole un array 2D
          2. BrainCTPreprocessor (circle mask + multi-window CT + CLAHE)
             oppure fallback minimale se la repo non è disponibile
          3. Resize a 224×224 (bilineare, come in training)
          4. Normalizzazione ImageNet (valori standard per encoder timm pretrained)

        Ritorna un array (H, W, 3) float32 pronto per essere impilato.
        """
        arr = np.array(img.convert("L"))  # grayscale 2D

        if self.preprocessor is not None:
            processed = self.preprocessor(arr)  # (H, W, 3)
        else:
            # Fallback solo per sviluppo locale senza la repo.
            # In produzione le predizioni con questo fallback sono inattendibili.
            logger.debug(
                "Preprocessore non disponibile: uso fallback grayscale→3ch. "
                "Le predizioni potrebbero non valere nulla."
            )
            processed = np.stack([arr.astype(np.float32) / 255.0] * 3, axis=-1)

        resized = cv2.resize(processed, self.img_size, interpolation=cv2.INTER_LINEAR)

        # Normalizzazione ImageNet — stessa usata da timm per i pretrained
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        normalized = (resized - mean) / std

        return normalized

    def _preprocess(self, images: List[Image.Image]) -> torch.Tensor:
        """
        Prende le 8 slice e le impila in un tensore batch.
        Input:  lista di 8 PIL.Image
        Output: tensore (1, 8, 3, H, W) su DEVICE — formato che si aspetta MultiLabelMILClassifier
        """
        processed = [self._preprocess_one(img) for img in images]
        stacked = np.stack(processed, axis=0)     # (8, H, W, 3)
        stacked = stacked.transpose(0, 3, 1, 2)   # (8, 3, H, W)
        tensor = torch.from_numpy(stacked).float().unsqueeze(0)  # (1, 8, 3, H, W)
        return tensor.to(DEVICE)

    @torch.no_grad()
    def predict(self, images: List[Image.Image]) -> Dict[str, float]:
        """
        Inferenza sulle 8 slice. Ritorna {label: probabilità} per ogni classe
        per cui esiste un modello caricato.

        Lancia RuntimeError se load() non ha caricato nessun modello.
        """
        if not self.models:
            raise RuntimeError(
                "Nessun modello caricato. "
                "Controlla i checkpoint e SSL_BRAINCT_SRC (vedi log all'avvio)."
            )

        x = self._preprocess(images)

        results = {}
        for label, model in self.models.items():
            logits = model(x)  # (1, 1) — modello binario per classe
            prob = torch.sigmoid(logits).item()
            results[label] = prob

        return results


# Singleton importato da main.py — load() viene chiamato nel lifespan di FastAPI
classification_model = ClassificationModel()
