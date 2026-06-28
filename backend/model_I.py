"""
Wrapper per il Modello I (classificazione, RF2).

Architettura e preprocessing COLLEGATI AL CODICE REALE della repo
SSL-BrainCT-Pathology (stage2_2d_slice_level/supervised_finetuning).

IMPORTANTE: ogni training salva la sua config esatta in
outputs/<run_name>/config.json — se i valori effettivi (ENCODER_NAME,
AGGREGATOR_TYPE, IMG_SIZE) sono diversi da quelli usati qui come default,
aggiorna RUN_CONFIG_OVERRIDES sotto invece di toccare il resto del file.

Strategia "binary decomposition": un classificatore per classe, ognuno
caricato separatamente in load().
"""

import logging
import os
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional

import cv2
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger("model_I")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # RNF7.1

# ---------------------------------------------------------------------------
# Path della repo clonata: deve contenere stage2_2d_slice_level/.../src/
# Aggiorna questo path con quello reale sulla macchina che esegue il backend.
# ---------------------------------------------------------------------------
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
        "Import del codice della repo fallito (%s). Imposta correttamente "
        "SSL_BRAINCT_SRC come variabile d'ambiente.",
        e,
    )

# ---------------------------------------------------------------------------
# Un checkpoint FINE-TUNED per classe (non i pesi SSL — quelli sono già
# dentro questo checkpoint, salvati dal training supervisionato).
# ---------------------------------------------------------------------------
CHECKPOINT_PATHS: Dict[str, str] = {
    "Blood": "checkpoints/model_I_blood_best.pth",
    "Mass": "checkpoints/model_I_mass_best.pth",
    "Ischemia": "checkpoints/model_I_ischemia_best.pth",
    "Edema": "checkpoints/model_I_edema_best.pth",
}

# Se config.json di un run riporta valori diversi dai default del codice,
# sovrascrivi qui SOLO per quella classe (es. se Mass ha usato un altro encoder).
RUN_CONFIG_OVERRIDES: Dict[str, dict] = {
    # "Mass": {"ENCODER_NAME": "convnext_small", "AGGREGATOR_TYPE": "gated_attention"},
}

CLASS_THRESHOLDS: Dict[str, float] = {
    "Blood": 0.5,
    "Mass": 0.5,
    "Ischemia": 0.5,
    "Chronic_Ischemia": 0.5,
    "Edema": 0.5,
}

CLASS_RELIABILITY_AUC: Dict[str, Optional[float]] = {
    # NOTA: questi sono i valori riportati nel README della repo originale,
    # NON ancora l'AUC misurato sui TUOI run (densenet121 + avg). Aggiornali
    # con i numeri reali appena hai i risultati di validazione dei tuoi 4
    # checkpoint — sono quelli che vanno citati in tesi, non questi.
    "Blood": 0.568,
    "Mass": 0.589,
    "Edema": 0.756,
    "Ischemia": None,
    "Chronic_Ischemia": None,
}


def _build_cfg(label: str):
    """Ricostruisce la config usata in training per questa classe."""
    cfg = Config()
    cfg.set_task_mode("binary", target_class=label)
    cfg.ENCODER_PRETRAINED = (
        False  # i pesi arrivano dal checkpoint fine-tuned, non da ImageNet
    )
    cfg.ENCODER_NAME = "densenet121"  # quello passato con --encoder nei training reali

    for key, value in RUN_CONFIG_OVERRIDES.get(label, {}).items():
        setattr(cfg, key, value)

    return cfg


def _build_architecture(label: str):
    if MultiLabelMILClassifier is None:
        raise NotImplementedError(
            "Import della repo non riuscito: controlla SSL_BRAINCT_SRC"
        )
    cfg = _build_cfg(label)
    model = MultiLabelMILClassifier(cfg, ssl_weights=None)
    return model


def _extract_state_dict(checkpoint) -> dict:
    """
    I checkpoint di training possono avere formati diversi (state_dict puro,
    oppure un dict con 'model_state_dict', 'state_dict', ecc., come già visto
    nel formato dei checkpoint SSL della stessa repo). Gestiamo entrambi.
    """
    if isinstance(checkpoint, dict):
        for key in ("model_state_dict", "state_dict"):
            if key in checkpoint:
                return checkpoint[key]
        # Se non ha sotto-chiavi note, assumiamo sia già lo state_dict
        return checkpoint
    return checkpoint


class ClassificationModel:
    def __init__(self):
        self.models: Dict[str, torch.nn.Module] = {}
        self.preprocessor = None
        self.img_size = (224, 224)
        """
        Wrapper per il Modello I (classificazione, RF2).
        
        Architettura e preprocessing COLLEGATI AL CODICE REALE della repo
        SSL-BrainCT-Pathology (stage2_2d_slice_level/supervised_finetuning).
        
        IMPORTANTE: ogni training salva la sua config esatta in
        outputs/<run_name>/config.json — se i valori effettivi (ENCODER_NAME,
        AGGREGATOR_TYPE, IMG_SIZE) sono diversi da quelli usati qui come default,
        aggiorna RUN_CONFIG_OVERRIDES sotto invece di toccare il resto del file.
        
        Strategia "binary decomposition": un classificatore per classe, ognuno
        caricato separatamente in load().
        """
        
        import logging
        import os
        import sys
        from dataclasses import dataclass
        from typing import Dict, List, Optional
        
        import cv2
        import numpy as np
        import torch
        from PIL import Image
        
        logger = logging.getLogger("model_I")
        
        DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # RNF7.1
        
        # ---------------------------------------------------------------------------
        # Path della repo clonata: deve contenere stage2_2d_slice_level/.../src/
        # Aggiorna questo path con quello reale sulla macchina che esegue il backend.
        # ---------------------------------------------------------------------------
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
                "Import del codice della repo fallito (%s). Imposta correttamente "
                "SSL_BRAINCT_SRC come variabile d'ambiente.",
                e,
            )
        
        # ---------------------------------------------------------------------------
        # Un checkpoint FINE-TUNED per classe (non i pesi SSL — quelli sono già
        # dentro questo checkpoint, salvati dal training supervisionato).
        # ---------------------------------------------------------------------------
        CHECKPOINT_PATHS: Dict[str, str] = {
            "Blood": "checkpoints/model_I_blood_best.pth",
            "Mass": "checkpoints/model_I_mass_best.pth",
            "Ischemia": "checkpoints/model_I_ischemia_best.pth",
            "Edema": "checkpoints/model_I_edema_best.pth",
        }
        
        # Se config.json di un run riporta valori diversi dai default del codice,
        # sovrascrivi qui SOLO per quella classe (es. se Mass ha usato un altro encoder).
        RUN_CONFIG_OVERRIDES: Dict[str, dict] = {
            # "Mass": {"ENCODER_NAME": "convnext_small", "AGGREGATOR_TYPE": "gated_attention"},
        }
        
        CLASS_THRESHOLDS: Dict[str, float] = {
            "Blood": 0.5,
            "Mass": 0.5,
            "Ischemia": 0.5,
            "Chronic_Ischemia": 0.5,
            "Edema": 0.5,
        }
        
        CLASS_RELIABILITY_AUC: Dict[str, Optional[float]] = {
            # NOTA: questi sono i valori riportati nel README della repo originale,
            # NON ancora l'AUC misurato sui TUOI run (densenet121 + avg). Aggiornali
            # con i numeri reali appena hai i risultati di validazione dei tuoi 4
            # checkpoint — sono quelli che vanno citati in tesi, non questi.
            "Blood": 0.568,
            "Mass": 0.589,
            "Edema": 0.756,
            "Ischemia": None,
            "Chronic_Ischemia": None,
        }
        
        
        def _build_cfg(label: str):
            """Ricostruisce la config usata in training per questa classe."""
            cfg = Config()
            cfg.set_task_mode("binary", target_class=label)
            cfg.ENCODER_PRETRAINED = (
                False  # i pesi arrivano dal checkpoint fine-tuned, non da ImageNet
            )
            cfg.ENCODER_NAME = "densenet121"  # quello passato con --encoder nei training reali
        
            for key, value in RUN_CONFIG_OVERRIDES.get(label, {}).items():
                setattr(cfg, key, value)
        
            return cfg
        
        
        def _build_architecture(label: str):
            if MultiLabelMILClassifier is None:
                raise NotImplementedError(
                    "Import della repo non riuscito: controlla SSL_BRAINCT_SRC"
                )
            cfg = _build_cfg(label)
            model = MultiLabelMILClassifier(cfg, ssl_weights=None)
            return model
        
        
        def _extract_state_dict(checkpoint) -> dict:
            """
            I checkpoint di training possono avere formati diversi (state_dict puro,
            oppure un dict con 'model_state_dict', 'state_dict', ecc., come già visto
            nel formato dei checkpoint SSL della stessa repo). Gestiamo entrambi.
            """
            if isinstance(checkpoint, dict):
                for key in ("model_state_dict", "state_dict"):
                    if key in checkpoint:
                        return checkpoint[key]
                # Se non ha sotto-chiavi note, assumiamo sia già lo state_dict
                return checkpoint
            return checkpoint
        
        
        class ClassificationModel:
            def __init__(self):
                self.models: Dict[str, torch.nn.Module] = {}
                self.preprocessor = None
                self.img_size = (224, 224)
        
            def load(self):
                logger.info("Caricamento Modello I su %s", DEVICE)
        
                if BrainCTPreprocessor is not None:
                    # Parametri di default del Config della repo (CIRCLE_RADIUS_RATIO=0.45,
                    # multiwindow brain/blood/stroke, CLAHE attivo). Se i config.json dei
                    # tuoi run riportano valori diversi, aggiorna anche qui.
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
                            "Checkpoint per '%s' non trovato in %s — saltato", label, path
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
                        logger.info("Modello per '%s' caricato da %s", label, path)
                    except NotImplementedError as e:
                        logger.warning("'%s' non caricato: %s", label, e)
                    except Exception:
                        logger.exception("Errore caricando il checkpoint per '%s'", label)
        
                if not self.models:
                    logger.warning("Nessun modello di classificazione caricato.")
        
            def _preprocess_one(self, img: Image.Image) -> np.ndarray:
                """Una singola slice -> array (H, W, 3) pronto per il tensor finale."""
                arr = np.array(img.convert("L"))  # grayscale, come si aspetta il preprocessing
        
                if self.preprocessor is not None:
                    processed = self.preprocessor(arr)  # (H, W, 3), via BrainCTPreprocessor
                else:
                    processed = np.stack([arr.astype(np.float32) / 255.0] * 3, axis=-1)
        
                resized = cv2.resize(processed, self.img_size, interpolation=cv2.INTER_LINEAR)
        
                # Normalizzazione ImageNet, standard per encoder pretrained timm
                mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
                std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
                normalized = (resized - mean) / std
        
                return normalized
        
            def _preprocess(self, images: List[Image.Image]) -> torch.Tensor:
                """8 slice -> tensor (1, 8, 3, H, W), come si aspetta MultiLabelMILClassifier."""
                processed = [self._preprocess_one(img) for img in images]
                stacked = np.stack(processed, axis=0)  # (8, H, W, 3)
                stacked = stacked.transpose(0, 3, 1, 2)  # (8, 3, H, W)
                tensor = torch.from_numpy(stacked).float().unsqueeze(0)  # (1, 8, 3, H, W)
                return tensor.to(DEVICE)
        
            @torch.no_grad()
            def predict(self, images: List[Image.Image]) -> Dict[str, float]:
                if not self.models:
                    raise RuntimeError(
                        "Nessun modello di classificazione caricato (vedi log all'avvio)"
                    )
        
                x = self._preprocess(images)
        
                results = {}
                for label, model in self.models.items():
                    logits = model(x)  # (1, 1) per modello binario
                    prob = torch.sigmoid(logits).item()
                    results[label] = prob
        
                return results
        
        
        classification_model = ClassificationModel()
        
        
        classification_model = ClassificationModel()

    def load(self):
        logger.info("Caricamento Modello I su %s", DEVICE)

        if BrainCTPreprocessor is not None:
            # Parametri di default del Config della repo (CIRCLE_RADIUS_RATIO=0.45,
            # multiwindow brain/blood/stroke, CLAHE attivo). Se i config.json dei
            # tuoi run riportano valori diversi, aggiorna anche qui.
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
                    "Checkpoint per '%s' non trovato in %s — saltato", label, path
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
                logger.info("Modello per '%s' caricato da %s", label, path)
            except NotImplementedError as e:
                logger.warning("'%s' non caricato: %s", label, e)
            except Exception:
                logger.exception("Errore caricando il checkpoint per '%s'", label)

        if not self.models:
            logger.warning("Nessun modello di classificazione caricato.")

    def _preprocess_one(self, img: Image.Image) -> np.ndarray:
        """Una singola slice -> array (H, W, 3) pronto per il tensor finale."""
        arr = np.array(img.convert("L"))  # grayscale, come si aspetta il preprocessing

        if self.preprocessor is not None:
            processed = self.preprocessor(arr)  # (H, W, 3), via BrainCTPreprocessor
        else:
            processed = np.stack([arr.astype(np.float32) / 255.0] * 3, axis=-1)

        resized = cv2.resize(processed, self.img_size, interpolation=cv2.INTER_LINEAR)

        # Normalizzazione ImageNet, standard per encoder pretrained timm
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        normalized = (resized - mean) / std

        return normalized

    def _preprocess(self, images: List[Image.Image]) -> torch.Tensor:
        """8 slice -> tensor (1, 8, 3, H, W), come si aspetta MultiLabelMILClassifier."""
        processed = [self._preprocess_one(img) for img in images]
        stacked = np.stack(processed, axis=0)  # (8, H, W, 3)
        stacked = stacked.transpose(0, 3, 1, 2)  # (8, 3, H, W)
        tensor = torch.from_numpy(stacked).float().unsqueeze(0)  # (1, 8, 3, H, W)
        return tensor.to(DEVICE)

    @torch.no_grad()
    def predict(self, images: List[Image.Image]) -> Dict[str, float]:
        if not self.models:
            raise RuntimeError(
                "Nessun modello di classificazione caricato (vedi log all'avvio)"
            )

        x = self._preprocess(images)

        results = {}
        for label, model in self.models.items():
            logits = model(x)  # (1, 1) per modello binario
            prob = torch.sigmoid(logits).item()
            results[label] = prob

        return results


classification_model = ClassificationModel()


classification_model = ClassificationModel()
