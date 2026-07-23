"""
Integrazione con la repo di ricerca SSL-BrainCT-Pathology (stage2_2d_slice_level).
Carica 4 classificatori binari indipendenti (binary decomposition),
ciascuno composto da: DenseNet-121 (pesi SimCLR) + AvgAggregator.
"""

import json
import logging
import os
import sys
from typing import Dict, List

import cv2
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger("model_I")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

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
    Config = None
    MultiLabelMILClassifier = None
    BrainCTPreprocessor = None
    logger.warning(
        "Impossibile importare moduli dalla repo esterna (%s). Verificare la variabile SSL_BRAINCT_SRC.",
        e,
    )

CONFIG_JSON_PATHS: Dict[str, str] = {
    "Blood": "models_config/config_blood.json",
    "Mass": "models_config/config_massa.json",
    "Ischemia": "models_config/config_ischemia.json",
    "Edema": "models_config/config_edema.json",
}

CHECKPOINT_PATHS: Dict[str, str] = {
    "Blood": "checkpoints/model_I_blood_best.pth",
    "Mass": "checkpoints/model_I_mass_best.pth",
    "Ischemia": "checkpoints/model_I_ischemia_best.pth",
    "Edema": "checkpoints/model_I_edema_best.pth",
}


def _load_json_config(label: str) -> dict:
    path = CONFIG_JSON_PATHS.get(label)
    if path is None or not os.path.exists(path):
        logger.warning(
            "Config JSON per %s non trovato in %s. Uso valori di default.", label, path
        )
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_CLASS_CONFIGS: Dict[str, dict] = {
    label: _load_json_config(label) for label in CONFIG_JSON_PATHS
}

# Soglie decisionali per ciascuna classe (calibrabili)
CLASS_THRESHOLDS: Dict[str, float] = {
    "Blood": 0.5,
    "Mass": 0.5,
    "Ischemia": 0.5,
    "Edema": 0.5,
}


def _build_cfg(label: str):
    cfg = Config()
    json_cfg = _CLASS_CONFIGS.get(label, {})

    cfg.set_task_mode(
        json_cfg.get("TASK_MODE", "binary"),
        target_class=json_cfg.get("BINARY_TARGET", label),
    )
    cfg.ENCODER_NAME = json_cfg.get("ENCODER_NAME", "densenet121")
    cfg.ENCODER_PRETRAINED = json_cfg.get("ENCODER_PRETRAINED", False)
    cfg.AGGREGATOR_TYPE = json_cfg.get("AGGREGATOR_TYPE", "avg")
    cfg.AGGREGATOR_HIDDEN = json_cfg.get("AGGREGATOR_HIDDEN", 512)
    cfg.HEAD_HIDDEN = json_cfg.get("HEAD_HIDDEN", 256)
    cfg.HEAD_DROPOUT = json_cfg.get("HEAD_DROPOUT", 0.3)
    cfg.NUM_SLICES = json_cfg.get("NUM_SLICES", 8)

    return cfg


def _build_architecture(label: str) -> torch.nn.Module:
    if MultiLabelMILClassifier is None:
        raise NotImplementedError(
            "Moduli di inferenza non disponibili (check SSL_BRAINCT_SRC)"
        )
    cfg = _build_cfg(label)
    return MultiLabelMILClassifier(cfg, ssl_weights=None)


def _extract_state_dict(checkpoint: dict) -> dict:
    return checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))


def _build_preprocessor_from_config(json_cfg: dict):
    if BrainCTPreprocessor is None:
        return None
    return BrainCTPreprocessor(
        use_circle_mask=json_cfg.get("USE_CIRCLE_MASK", True),
        circle_radius=json_cfg.get("CIRCLE_RADIUS_RATIO", 0.45),
        adaptive_circle=json_cfg.get("ADAPTIVE_CIRCLE", True),
        use_multiwindow=json_cfg.get("USE_MULTIWINDOW", True),
        use_clahe=json_cfg.get("USE_CLAHE", True),
    )


class ClassificationModel:
    """Modello I: classificazione multi-patologia basata su binary decomposition."""

    def __init__(self):
        self.models: Dict[str, torch.nn.Module] = {}
        self.preprocessor = None
        self.img_size = (224, 224)

    def load(self):
        """Carica in memoria i checkpoint disponibili per ciascuna patologia."""
        logger.info("Caricamento Modello I su dispositivo: %s", DEVICE)

        # Inizializza il pre-processore usando la prima configurazione valida trovata
        for label, json_cfg in _CLASS_CONFIGS.items():
            if json_cfg:
                self.preprocessor = _build_preprocessor_from_config(json_cfg)
                img_size_list = json_cfg.get("IMG_SIZE")
                if img_size_list and len(img_size_list) == 2:
                    self.img_size = tuple(img_size_list)
                break

        if self.preprocessor is None and BrainCTPreprocessor is not None:
            logger.warning(
                "Nessun JSON di configurazione trovato. Uso preprocessore standard."
            )
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
                    "Checkpoint per %s non trovato in %s — saltato.", label, path
                )
                continue

            try:
                model = _build_architecture(label)
                checkpoint = torch.load(path, map_location=DEVICE)
                state_dict = _extract_state_dict(checkpoint)

                model.load_state_dict(state_dict, strict=False)
                model.to(DEVICE).eval()
                self.models[label] = model
                logger.info("Modello caricato con successo per la classe: %s", label)

            except NotImplementedError as e:
                logger.warning("Classe %s saltata: %s", label, e)
            except Exception:
                logger.exception(
                    "Errore durante il caricamento del checkpoint per: %s", label
                )

        if not self.models:
            logger.warning("Nessun modello di classificazione caricato correttamente.")

    def _preprocess_one(self, img: Image.Image) -> np.ndarray:
        arr = np.array(img.convert("L"))

        if self.preprocessor is not None:
            processed = self.preprocessor(arr)
        else:
            # Fallback per test o sviluppo locale senza la repo di ricerca
            processed = np.stack([arr.astype(np.float32) / 255.0] * 3, axis=-1)

        resized = cv2.resize(processed, self.img_size, interpolation=cv2.INTER_LINEAR)
        return (resized - _IMAGENET_MEAN) / _IMAGENET_STD

    def _preprocess(self, images: List[Image.Image]) -> torch.Tensor:
        processed = [self._preprocess_one(img) for img in images]
        stacked = np.stack(processed, axis=0)  # (8, H, W, 3)
        stacked = stacked.transpose(0, 3, 1, 2)  # (8, 3, H, W)
        tensor = torch.from_numpy(stacked).float().unsqueeze(0)  # (1, 8, 3, H, W)
        return tensor.to(DEVICE)

    @torch.no_grad()
    def predict(self, images: List[Image.Image]) -> Dict[str, float]:
        """Esegue l'inferenza sulle slice e ritorna la probabilità per ciascuna classe."""
        if not self.models:
            raise RuntimeError("Nessun modello caricato. Controllare i log di avvio.")

        x = self._preprocess(images)
        results = {}
        for label, model in self.models.items():
            logits = model(x)
            prob = torch.sigmoid(logits).item()
            results[label] = prob

        return results


classification_model = ClassificationModel()
