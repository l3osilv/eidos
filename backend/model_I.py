"""
Wrapper per il Modello I di classificazione (RF2).

Collega il backend alla repo SSL-BrainCT-Pathology (stage2_2d_slice_level).
Un modello binario per classe, caricato separatamente: è la strategia "binary
decomposition" (che nella repo originale risulta miglore del multi-label (+6/+46% AUC)).

Architettura per ogni classe:
  DenseNet-121 (encoder, pesi SimCLR) → AvgAggregator → testa di classificazione
  → sigmoid → probabilità tra 0 e 1

I parametri di ogni modello (encoder, aggregatore, preprocessing) vengono letti
direttamente dai JSON in models_config/ per garantire allineamento con il training.
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

# GPU se disponibile, altrimenti CPU — vedi RNF7.1
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Costanti normalizzazione ImageNet — allocate una sola volta a livello di modulo
_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

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

# ──────────────────────────────────────────────────────────────────────────────
# Configurazioni caricate dai JSON di models_config/
# ──────────────────────────────────────────────────────────────────────────────

# Mappa: label → path del file JSON di configurazione usato durante il training
CONFIG_JSON_PATHS: Dict[str, str] = {
    "Blood": "models_config/config_blood.json",
    "Mass": "models_config/config_massa.json",
    "Ischemia": "models_config/config_ischemia.json",
    "Edema": "models_config/config_edema.json",
}

# Checkpoint fine-tuned per classe.
CHECKPOINT_PATHS: Dict[str, str] = {
    "Blood": "checkpoints/model_I_blood_best.pth",
    "Mass": "checkpoints/model_I_mass_best.pth",
    "Ischemia": "checkpoints/model_I_ischemia_best.pth",
    "Edema": "checkpoints/model_I_edema_best.pth",
}


def _load_json_config(label: str) -> dict:
    """
    Carica il JSON di configurazione per la classe indicata.
    Ritorna un dizionario con tutti i parametri usati durante il training,
    oppure un dict vuoto se il file non esiste (con warning).
    """
    path = CONFIG_JSON_PATHS.get(label)
    if path is None or not os.path.exists(path):
        logger.warning(
            "Config JSON per '%s' non trovato in '%s' — uso valori di default",
            label,
            path,
        )
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# Pre-carica tutti i JSON all'import per avere i dati subito disponibili
_CLASS_CONFIGS: Dict[str, dict] = {
    label: _load_json_config(label) for label in CONFIG_JSON_PATHS
}

# Soglie di decisione per classe. 0.5 è solo il default iniziale.
# Le 4 classi corrispondono ai 4 modelli binari effettivamente addestrati.
CLASS_THRESHOLDS: Dict[str, float] = {
    "Blood": 0.5,
    "Mass": 0.5,
    "Ischemia": 0.5,
    "Edema": 0.5,
}



def _build_cfg(label: str):
    """
    Ricostruisce la stessa Config usata in training per questa classe,
    leggendo i parametri dal JSON di configurazione corrispondente.
    """
    cfg = Config()

    json_cfg = _CLASS_CONFIGS.get(label, {})

    # Modalità task e classe target
    cfg.set_task_mode(
        json_cfg.get("TASK_MODE", "binary"),
        target_class=json_cfg.get("BINARY_TARGET", label),
    )

    # Encoder — tutti i run usano densenet121 con pesi dal checkpoint (non ImageNet)
    cfg.ENCODER_NAME = json_cfg.get("ENCODER_NAME", "densenet121")
    cfg.ENCODER_PRETRAINED = json_cfg.get("ENCODER_PRETRAINED", False)

    # Aggregatore — dai JSON risulta "avg" per tutti i run
    cfg.AGGREGATOR_TYPE = json_cfg.get("AGGREGATOR_TYPE", "avg")
    cfg.AGGREGATOR_HIDDEN = json_cfg.get("AGGREGATOR_HIDDEN", 512)

    # Testa di classificazione
    cfg.HEAD_HIDDEN = json_cfg.get("HEAD_HIDDEN", 256)
    cfg.HEAD_DROPOUT = json_cfg.get("HEAD_DROPOUT", 0.3)

    # Numero di slice per paziente
    cfg.NUM_SLICES = json_cfg.get("NUM_SLICES", 8)

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


def _extract_state_dict(checkpoint: dict) -> dict:
    """
    Estrae lo state_dict da un checkpoint PyTorch, indipendentemente dal formato
    (chiave 'model_state_dict', 'state_dict', o state_dict diretto).
    """
    return checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))


def _build_preprocessor_from_config(json_cfg: dict):
    """
    Costruisce il BrainCTPreprocessor usando i parametri dal JSON di config.
    Se la repo non è disponibile ritorna None.
    """
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
        Il preprocessor viene configurato dal primo JSON disponibile (i parametri di
        preprocessing sono identici per tutti i run).
        """
        logger.info("Caricamento Modello I su %s", DEVICE)

        # Costruisce il preprocessor dal primo JSON disponibile.
        # I parametri di preprocessing (circle mask, multiwindow, CLAHE) sono
        # identici in tutti e 4 i config JSON, quindi basta usarne uno qualsiasi.
        for label, json_cfg in _CLASS_CONFIGS.items():
            if json_cfg:
                self.preprocessor = _build_preprocessor_from_config(json_cfg)
                # Aggiorna img_size dal JSON se presente
                img_size_list = json_cfg.get("IMG_SIZE")
                if img_size_list and len(img_size_list) == 2:
                    self.img_size = tuple(img_size_list)
                break

        # Fallback se nessun JSON è stato trovato
        if self.preprocessor is None and BrainCTPreprocessor is not None:
            logger.warning(
                "Nessun config JSON trovato: uso parametri di preprocessing di default"
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
                        "'%s': %d chiavi inattese nel checkpoint",
                        label,
                        len(unexpected),
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
        return (resized - _IMAGENET_MEAN) / _IMAGENET_STD

    def _preprocess(self, images: List[Image.Image]) -> torch.Tensor:
        """
        Prende le 8 slice e le impila in un tensore batch.
        Input:  lista di 8 PIL.Image
        Output: tensore (1, 8, 3, H, W) su DEVICE — formato che si aspetta MultiLabelMILClassifier
        """
        processed = [self._preprocess_one(img) for img in images]
        stacked = np.stack(processed, axis=0)  # (8, H, W, 3)
        stacked = stacked.transpose(0, 3, 1, 2)  # (8, 3, H, W)
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
