# Spiegazione del Progetto: SSL-BrainCT-Pathology

> Documento generato analizzando il codice sorgente del progetto a fini di supporto per la tesi di laurea.
> Autori: Merid Tesfay Hagos, Leonardo Silvestri, Selene Tomassini (PhD, UniTrento)

---

## 1. Scopo Generale del Progetto

L'obiettivo è **identificare e classificare automaticamente diverse patologie cerebrali** a partire da scansioni CT (Tomografia Computerizzata). Le **cinque patologie** analizzate sono:

| Patologia | Distribuzione nel dataset |
|---|---|
| Blood (Emorragia) | ~12.4% |
| Ischemia | ~8.6% |
| Chronic Ischemia | ~28.0% |
| Edema | ~9.0% |
| Mass (Tumore) | ~7.8% |

Il problema principale è duplice:
1. **Scarsità di dati etichettati** — i dataset medici sono rari e costosi da costruire.
2. **Forte sbilanciamento delle classi** — le patologie rare (es. Masse al 7.8%) rendono il training difficile: i modelli ignorano le classi rare.

La soluzione adottata è una pipeline in **due fasi** ispirata al Self-Supervised Learning (SSL):

1. **Fase SSL (Pre-training):** Il modello viene addestrato su tutte le immagini CT *senza etichette*, imparando da solo l'anatomia cerebrale.
2. **Fase Supervisionata (Fine-tuning):** L'encoder così "formato" viene poi fine-tuned su un subset di immagini con etichette per classificare le patologie.

### Dataset
- **500 pazienti** (ID da 0001 a 0540, con 40 ID mancanti)
- **8 slice (fette) di CT per paziente**, numerate da `_slice_0002` a `_slice_0009`
- **4000 immagini** totali in formato `.jpg`
- Le etichette sono **a livello di paziente** (non di singola fetta)

### Formato dei file
```
data/
├── slices/
│   ├── 0001_slice_0002.jpg
│   ├── 0001_slice_0003.jpg
│   └── ...
└── labels.csv
```

```csv
patient_id,Blood,Ischemia,Chronic_Ischemia,Edema,Mass
0001,1,0,0,1,0
0002,0,1,0,0,0
```

### Modalità di classificazione (Task Modes)
Il sistema supporta tre modalità configurabili:

| Modalità | Descrizione | Classi |
|---|---|---|
| `binary` ⭐ (Raccomandata) | Un modello separato per ogni patologia | 1 classe (es. Edema vs No-Edema) |
| `merged_ischemia` | Unisce Ischemia e Ischemia Cronica | 4 classi: Blood, Any_Ischemia, Edema, Mass |
| `full_5class` | Tutte le patologie contemporaneamente | 5 classi |

> **Scoperta chiave:** La modalità `binary` supera la `full_5class` di un margine di +6% a +46% in AUC. Avere un modello specializzato è nettamente superiore a un modello generalista.

---

## 2. Sotto-progetto 1 — Approccio Volumetrico 3D (`stage1_3d_volumetric`)

Questo stage tratta le scansioni CT come oggetti **tridimensionali**, fornendo al modello tutte le 8 fette contemporaneamente come un volume 3D.

### 2.1. SSL Pre-training: Masked Autoencoding (MAE)

**Architettura:** `SwinUNETR_MAE` (da `model_mae.py`)

Il modello si compone di due parti:
- **Encoder:** `SwinTransformer` 3D da MONAI (libreria per immagini mediche). Parametri: `embed_dim=48`, profondità `(2,2,2,2)`, teste di attenzione `(3,6,12,24)`, `window_size=(7,7,7)`.
- **Decoder:** `MaskedAutoencoderDecoder` — un Transformer Decoder leggero (4 layer, `d_model=192`, 6 teste) che ricostruisce le patch mascherate.

**Flusso di training MAE (dal codice):**
1. L'immagine 3D (dimensione `[B, 1, 128, 128, 32]`) viene divisa in patch `2×2×2`.
2. Il **70%** delle patch viene oscurato (azzerato) casualmente — questa percentuale è risultata ottimale.
3. Il volume mascherato passa attraverso il SwinTransformer Encoder.
4. Le feature dell'encoder e dei token speciali "maschera" vengono passate al Decoder.
5. Il Decoder predice i valori pixel delle **sole patch mascherate**.
6. La loss è **MSE** tra patch ricostruite e patch originali.
7. Dopo il training, **solo i pesi dell'Encoder** vengono salvati per il fine-tuning.

> **Nota tecnica importante (da `ssl_dataloader.py`):** Le 8 slice JPEG vengono caricate, pre-processate (CLAHE + Circle Mask) e poi **interpolate trilinearmente da 8 a 32 fette** (`trilinear interpolation`), producendo un volume `[1, 128, 128, 32]`. Il modello quindi non lavora su 8 slice "vere", ma su 32 slice sinteticamente interpolate.

**Iperparametri di training SSL:**
| Parametro | Valore |
|---|---|
| Learning rate | `1e-4` |
| Batch size | `2` (minimo per stabilità) |
| Epoche | `150` |
| Masking ratio | `0.70` |
| GPU richiesta | NVIDIA A100 (~25-38 ore) |
| Memoria GPU | ~8-10 GB |

**Checkpoint prodotto:** `checkpoints/mae_stable_epoch_150.pth`

### 2.2. Fine-tuning Supervisionato 3D

**Architettura:** L'encoder SwinTransformer pre-addestrato con MAE viene "sbloccato" progressivamente e si aggiunge una classification head lineare in cima.

**Strategia di training a 3 fasi** (configurata in `config.py`):
1. **Fase Warmup (5 epoche):** L'encoder è **congelato**, si addestra solo la classification head con `lr=1e-4`.
2. **Fase Unfreeze (15 epoche):** L'encoder viene sbloccato **gradualmente**, layer per layer.
3. **Fase Full Fine-tuning (60 epoche):** Training completo con `lr_encoder=1e-6`, `lr_head=1e-4`, early stopping con patience=25 epoche.

**Strategie per gestire lo sbilanciamento:**
- **Loss:** Focal Loss o Asymmetric Loss (`gamma_neg=6, gamma_pos=0, clip=0.05`)
- **Sampling:** `WeightedRandomSampler` — campiona di più le classi rare
- **Label Smoothing:** `0.1`
- **Augmentation:** MixUp (`alpha=0.1`), CutMix, flip, rotazione limitata (±10°)
- **Evaluation:** Test-Time Augmentation (TTA) con 16 trasformazioni

**Iperparametri di fine-tuning:**
| Parametro | Valore |
|---|---|
| Batch size | `8` (+ gradient accumulation ×8) |
| Optimizer | AdamW, `weight_decay=0.02` |
| Validation | 5-Fold Cross-Validation stratificata |
| Early stopping | patience=25 epoche, metrica=`val_macro_f1` |

**Risultati ottenuti:**
| Patologia | AUC | Note |
|---|---|---|
| **Edema** | **0.756** | Miglior risultato assoluto del progetto |
| - | - | +9% rispetto alla baseline ImageNet |

---

## 3. Sotto-progetto 2 — Approccio a Slice 2D (`stage2_2d_slice_level`)

Questo stage tratta ogni fetta come un'immagine 2D indipendente. Il problema della diagnosi "a livello paziente" con dati "a livello fetta" viene risolto con **Multiple Instance Learning (MIL)**.

### 3.1. SSL Pre-training: Contrastive Learning

**Metodi implementati** (file `ssl_methods.py`):

| Metodo | Meccanismo | Iperparametro chiave |
|---|---|---|
| **SimCLR** ⭐ | NT-Xent Loss (coppie positive/negative) | Temperature `0.07` |
| **BYOL** | Momentum Encoder (no negativi) | Momentum `0.996` |
| **Barlow Twins** | Riduzione ridondanza cross-correlazione | Lambda `0.005` |
| MoCo v2 | Queue di negativi (non usato in produzione) | - |

**Architettura Encoder 2D** (`encoders.py`):
- Backbone supportati: `DenseNet-121` (raccomandato per imaging medico), `ConvNeXt-Small/Base`, `ResNet50`, `EfficientNet-B3/B4`, `ViT`, `Swin`
- Ogni backbone ha una **Projection Head** (MLP 2 layer) che proietta le feature in uno spazio di embedding dove viene calcolata la loss SSL.

**Augmentazioni forti usate in SSL:**
- Random crop (scala 0.05–0.4)
- Flip orizzontale
- Rotazione fino a 45°
- Color jitter (ridotto per immagini mediche)
- Gaussian blur
- Preprocessing CLAHE

**Iperparametri SSL 2D:**
| Parametro | Valore |
|---|---|
| Image size | `224×224` |
| Projection dim | `256` |
| Batch size | `128` |
| Epoche | `40` |
| Warmup | `10 epoche` |
| GPU richiesta | NVIDIA A100 (~6-8 ore) |

**Checkpoint prodotti:**
```
checkpoints/
├── simclr_densenet121_best.pth    ← Raccomandato
├── simclr_convnext_small_best.pth
└── byol_densenet121_best.pth
```

### 3.2. Fine-tuning Supervisionato: MIL con Gated Attention

**Architettura del modello principale** (`MultiLabelMILClassifier` in `models.py`):

```
Input: (B, 8, 3, 224, 224)  ← B pazienti, 8 slice, immagine RGB 224×224
         ↓
SliceEncoder (DenseNet-121 con pesi SSL)
  → Tutte le 8 slice encodate indipendentemente
         ↓
(B, 8, D)  ← D = feature dimension per fetta
         ↓
GatedAttentionAggregator
  → Impara quanta attenzione dare a ogni fetta
  → Produce un singolo vettore di features per paziente
         ↓
(B, H)  ← H = hidden dim aggregator (512)
         ↓
ClassificationHead (Linear → ReLU → Dropout → Linear)
         ↓
(B, num_classes)  ← Output logits
```

**I 4 tipi di aggregatore disponibili** (scelto da config):
- `gated_attention` ⭐ — Il migliore: impara un peso di attenzione per ogni fetta tramite una rete V×U (Tanh×Sigmoid).
- `transformer` — Usa un CLS token e un Transformer Encoder sulle 8 fette.
- `lstm` — Bidirectional LSTM sulle 8 fette con attention.
- `avg` — Semplice media delle feature (baseline).

**Il Preprocessor Medico** (`BrainCTPreprocessor` in `preprocessing.py`):
Prima che le immagini entrino nel modello, vengono processate da una pipeline in 3 step:

1. **`IntelligentCircleMask`** — Applica una maschera circolare adattiva (raggio ~45% dell'immagine), rilevando automaticamente il bordo del cranio tramite thresholding di Otsu. Elimina il bordo del tubo del TAC e le annotazioni scritte ai margini.
2. **`MultiWindowCT`** — Converte l'immagine grayscale in un'immagine a **3 canali**, uno per ogni finestra CT clinica:
   - `Channel 0` → *Brain Window* (W=80, L=40): tessuto cerebrale generale
   - `Channel 1` → *Blood Window* (W=150, L=75): emorragie
   - `Channel 2` → *Stroke Window* (W=40, L=40): variazioni ischemiche
3. **Normalizzazione percentile** — Clipping al 1°-99° percentile, robusto agli outlier.

Questo step è **critico per il wrapper**: le immagini raw non possono essere passate direttamente al modello.

**Strategia di training a 3 fasi** (identica allo Stage 1):
1. **Warmup (5 epoche):** Encoder congelato, si addestra solo head + aggregator.
2. **Unfreeze (15 epoche):** Scongelamento graduale dell'encoder (strato per strato dal fondo).
3. **Full Fine-tuning (60 epoche):** Training completo con early stopping.

**Augmentazioni** (libreria `albumentations`): Resize → HorizontalFlip → SafeRotate → ShiftScaleRotate → ElasticTransform → BrightnessContrast/RandomGamma → GaussNoise/GaussianBlur → Normalizzazione ImageNet → ToTensor.

**Risultati ottenuti:**
| Patologia | AUC | Modello |
|---|---|---|
| **Blood** | **0.568** | DenseNet-121 (from scratch) |
| **Mass** | **0.589** | DenseNet-121 + SimCLR |
| SimCLR vs baseline | +2% a +9% AUC | su tutte le patologie |

---

## 4. Struttura dei Checkpoints (per il Wrapper)

Tutti i pesi pre-addestrati sono scaricabili da Google Drive:
`https://drive.google.com/drive/folders/1g1k1vIcdL71oHEFrHArs3TDlNA6lKYT6`

```
checkpoints/
├── mae_stable_epoch_150.pth         ← Stage 1 SSL (67MB) → necessario per Stage 1 supervised
├── simclr_densenet121_best.pth      ← Stage 2 SSL → raccomandato per Blood, Mass
├── simclr_convnext_small_best.pth   ← Stage 2 SSL alternativo
└── byol_densenet121_best.pth        ← Stage 2 SSL alternativo
```

---

## 5. Implicazioni per il Wrapper (Backend/Frontend)

### 5.1. Flusso Input/Output

**Input (frontend → backend):**
- Un set di esattamente **8 immagini JPEG** di CT scan di un singolo paziente
- L'indicazione di **quale patologia** l'utente vuole diagnosticare
- Opzionalmente: quale modello usare (Stage 1 o Stage 2)

**Output (backend → frontend):**
- Un valore di probabilità `[0, 1]` (output del `sigmoid` sul logit grezzo)
- La soglia di decisione ottimizzata (il progetto include `find_thresholds_swin.py`)
- Opzionalmente: i pesi di attenzione per slice (da `GatedAttentionAggregator`) per visualizzare quale fetta ha influenzato di più la diagnosi

### 5.2. Quale Modello Usare per Ogni Patologia

| Patologia | Stage Raccomandato | Motivazione |
|---|---|---|
| **Edema** | Stage 1 (3D, SwinUNETR) | Patologia diffusa → il contesto 3D è fondamentale |
| **Blood** | Stage 2 (2D, MIL) | Patologia focale → meglio su singola fetta |
| **Mass** | Stage 2 (2D, MIL) | Patologia focale → meglio su singola fetta |
| **Ischemia / Chronic Ischemia** | Entrambi (da testare) | Risultati non conclusivi nel progetto |

### 5.3. Pipeline di Inferenza Backend (pseudocodice)

```python
# 1. Preprocessing obbligatorio per Stage 2
preprocessor = BrainCTPreprocessor(
    use_circle_mask=True,
    use_multiwindow=True,  # produce 3 canali clinici
    normalize_method='percentile'
)
images_preprocessed = [preprocessor(img) for img in 8_slices]

# 2. Carica il modello corretto (binary, patologia specifica)
cfg = Config()
cfg.set_task_mode('binary', target_class='Blood')  # o 'Edema', 'Mass', ecc.

model = MultiLabelMILClassifier(cfg, ssl_weights='checkpoints/simclr_densenet121_best.pth')
model.load_state_dict(torch.load('checkpoints/finetuned_blood_model.pth'))
model.eval()

# 3. Forward pass
with torch.no_grad():
    logits, attention_weights = model(input_tensor, return_attention=True)
    probability = torch.sigmoid(logits).item()  # Es: 0.73 = 73% probabilità Blood
```

### 5.4. Bug Noti nel Progetto (rilevati dall'analisi del codice)

| Bug | File | Descrizione |
|---|---|---|
| `preprocessing.py` mancante | `stage1_3d_volumetric/supervised_finetuning/src/dataset.py` | Il file viene importato ma non esiste nella cartella Stage 1. Soluzione: copiare `preprocessing.py` da Stage 2. |
| `SimCLR.__init__` firma errata | `stage2_2d_slice_level/ssl_pretraining/scripts/train_ssl.py` (r.71) | Lo script passa `temperature` come kwarg diretto, ma la classe `SimCLR` accetta solo `cfg`. Soluzione: usare `create_ssl_model(cfg)`. |
| Dati mancanti | Cartella `data/` | Non inclusa nel repo per ragioni di privacy. Richiede i file originali dagli autori, o generazione sintetica per test. |

---

*Ultima modifica: Aprile 2026*
