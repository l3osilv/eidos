# Guida Tecnica — Backend

## 1. Architettura generale

```
                ┌─────────────┐
   Frontend  →  │   FastAPI   │  → MongoDB (collezioni: users, patients)
  (React/TS)    │   Backend   │  → Filesystem locale (slice immagini)
                └──────┬──────┘
                       │
            ┌──────────┴──────────┐
            │                     │
      Modello I                Modello II
   (classificazione:         (refertazione:
   DenseNet-121 + SimCLR     rule-based sui findings)
   AvgAggregator)
```

**Principio guida:** i due modelli sono moduli indipendenti e sostituibili. Il Modello II non vede mai le immagini: riceve i findings già calcolati dal Modello I. Questo garantisce coerenza per costruzione — il referto non può contraddire i findings perché è generato a partire da essi.

---

## 2. Stack tecnologico

| Componente | Tecnologia | Motivazione |
|---|---|---|
| API framework | FastAPI | async nativo, validazione automatica via Pydantic, documentazione interattiva auto-generata su `/docs` |
| Database | MongoDB + driver `motor` (async) | schema flessibile, adatto a documenti eterogenei (utenti, pazienti, findings) |
| Autenticazione | JWT (`python-jose`) + bcrypt (`passlib`) | stateless, standard per API REST; nessuna query a DB per validare richieste successive al login |
| Storage immagini | Filesystem locale, path referenziati in MongoDB | più semplice da gestire rispetto a GridFS per il volume di dati del progetto (≤500 pazienti × 8 slice) |
| Modello I | PyTorch — DenseNet-121 + SimCLR pretraining | vedi sezione 4 |
| Modello II | Python puro, nessuna libreria ML | generatore rule-based, vedi sezione 5 |

---

## 3. Struttura del progetto

```
backend/
├── main.py              # app FastAPI — tutti gli endpoint
├── auth.py              # JWT, hashing password, dependency per i ruoli
├── database.py          # connessione MongoDB tramite motor
├── schemas.py           # modelli Pydantic per richieste e risposte
├── storage.py           # salvataggio e lettura immagini su disco
├── model_I.py           # wrapper classificazione (SSL-BrainCT-Pathology)
├── model_II.py          # generatore referto rule-based
├── models_config/       # JSON di configurazione per classe (parametri usati in training)
│   ├── config_blood.json
│   ├── config_edema.json
│   ├── config_ischemia.json
│   └── config_massa.json
├── checkpoints/         # checkpoint PyTorch fine-tuned (da posizionare manualmente)
│   ├── model_I_blood_best.pth
│   ├── model_I_mass_best.pth
│   ├── model_I_ischemia_best.pth
│   └── model_I_edema_best.pth
├── init_db.py           # script di inizializzazione DB e primo utente
├── requirements.txt
├── .env                 # variabili d'ambiente (da creare — vedi setup_mongodb.md)
└── storage/
    └── images/
        └── <patient_id>/
            ├── slice_0.png
            ├── ...
            └── slice_7.png
```

---

## 4. Modello I — Classificazione (SSL-BrainCT-Pathology)

### 4.1 Origine e contesto

Repository di riferimento: `https://github.com/meridtesfay/SSL-BrainCT-Pathology`  
Autori: Selene Tomassini (PhD), Merid Tesfay Hagos, Leonardo Silvestri — Università di Trento.

Il progetto affronta la classificazione multi-label di patologie cerebrali da TC, usando il self-supervised learning per contrastare lo sbilanciamento delle classi.

### 4.2 Perché Stage 2 (2D Slice-level)

| | Stage 1 — 3D Volumetrico | Stage 2 — 2D Slice-level (usato) |
|---|---|---|
| Input | Volume di 8 slice impilate | Singole slice 2D aggregate via MIL |
| Encoder | SwinUNETR | DenseNet-121 / ConvNeXt |
| SSL pretraining | MAE | SimCLR / BYOL / Barlow Twins |
| Checkpoint SSL | `mae_stable_epoch_150.pth` (67 MB) | `simclr_densenet121_best.pth` |
| Tempo fine-tuning stimato | giorni (3 fasi, 80 epoche, batch 2 per VRAM) | ore (stesso schema ma modello 2D leggero) |
| Dipendenze | MONAI, gestione volumi 3D | solo PyTorch/torchvision |


### 4.3 Dataset

- 500 pazienti (ID 0001–0540, con 40 ID mancanti), 8 slice ciascuno → 4000 immagini JPG
- Formato file: `XXXX_slice_YYYY.jpg`
- `labels.csv`: colonne `patient_id, Blood, Ischemia, Chronic_Ischemia, Edema, Mass`, valori binari 0/1
- Le immagini sono JPG già pre-processati (finestrati da DICOM originali): **non serve ripetere la conversione DICOM→JPG**

### 4.4 Procedura di fine-tuning

```bash
# 1. Setup repo
git clone https://github.com/meridtesfay/SSL-BrainCT-Pathology.git
cd SSL-BrainCT-Pathology
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Posiziona (da Google Drive):
#    - data/slices/ + data/labels.csv
#    - checkpoints/simclr_densenet121_best.pth

# 3. Verifica GPU disponibile
python -c "import torch; print(torch.cuda.is_available())"

# 4. Fine-tuning per una classe binaria
cd stage2_2d_slice_level/supervised_finetuning
python scripts/train.py \
    --run_name exp_blood_binary \
    --task_mode binary \
    --target_class Blood \
    --encoder densenet121 \
    --ssl_weights ../../checkpoints/simclr_densenet121_best.pth
```

Il training segue tre fasi automatiche:
1. **Fase 1 (5 epoche):** encoder freezato, si allena solo la testa di classificazione
2. **Fase 2 (15 epoche):** unfreezing graduale dell'encoder
3. **Fase 3 (60 epoche):** fine-tuning completo con early stopping (pazienza 25 epoche)

Il checkpoint finale viene salvato in `outputs/<run_name>/` (verificare il path esatto in `src/trainer.py`).

**Ripetere per ogni classe** — ogni classe è un modello binario indipendente (strategia *binary decomposition*, +6/+46% AUC rispetto al multi-label unico secondo la repo).

### 4.5 Integrazione in `model_I.py`

`model_I.py` è già completo e funzionante. I parametri dell'architettura (encoder, aggregatore, testa) vengono letti dinamicamente dai file JSON in `models_config/`, garantendo allineamento automatico con i parametri usati durante il training.

I checkpoint vanno posizionati secondo i path definiti in `CHECKPOINT_PATHS`:

```python
CHECKPOINT_PATHS: Dict[str, str] = {
    "Blood":   "checkpoints/model_I_blood_best.pth",
    "Mass":    "checkpoints/model_I_mass_best.pth",
    "Ischemia":"checkpoints/model_I_ischemia_best.pth",
    "Edema":   "checkpoints/model_I_edema_best.pth",
}
```

I file JSON di configurazione in `models_config/` contengono tutti i parametri usati nel training (encoder, aggregatore, preprocessing, iperparametri). `model_I.py` li carica automaticamente all'avvio e li usa per ricostruire la stessa architettura usata durante il fine-tuning:

| Parametro | Valore (da JSON) | Descrizione |
|---|---|---|
| ENCODER_NAME | densenet121 | Encoder backbone |
| AGGREGATOR_TYPE | avg | Strategia di aggregazione slice (media) |
| AGGREGATOR_HIDDEN | 512 | Dimensione hidden dell'aggregatore |
| HEAD_HIDDEN | 256 | Dimensione hidden della testa di classificazione |
| HEAD_DROPOUT | 0.3 | Dropout nella testa |
| NUM_SLICES | 8 | Numero di slice per paziente |

### 4.6 Preprocessing — punto critico

Il preprocessing in inferenza deve essere **identico** a quello di training (`BrainCTPreprocessor` in `src/preprocessing.py`):

- Circle masking (rimozione artefatti bordo scanner)
- CLAHE (contrast enhancement)
- Multi-window CT (finestre brain/blood/stroke)
- Resize a 224×224 con interpolazione bilineare
- Normalizzazione ImageNet (mean/std standard per encoder timm pretrained)

Un preprocessing diverso produce input fuori distribuzione: il modello non genera errori espliciti, ma le predizioni sono inattendibili.

### 4.7 Soglie di decisione

Le soglie in `CLASS_THRESHOLDS` (default 0.5) vanno calibrate sul validation set usando `find_thresholds_swin.py` o l'equivalente Stage 2. Le soglie ottimizzate migliorano l'F1 rispetto al valore fisso.

---

## 5. Modello II — Refertazione (rule-based)

### 5.1 Perché non un modello generativo

`labels.csv` contiene solo etichette binarie, non referti testuali scritti da radiologi. In assenza di un dataset di coppie immagine-referto, un modello visione→testo non è addestrabile. Questa è una limitazione del dataset disponibile, non una scorciatoia: va dichiarata esplicitamente nella tesi.

### 5.2 Come funziona

`model_II.py` riceve i findings già calcolati (non le immagini) e compone un referto in quattro sezioni (Tecnica, Reperti, Conclusioni, Raccomandazioni) usando varianti di frasi template per ciascuna delle 5 classi. Il livello di confidenza del modello (quanto la probabilità supera la soglia) determina il tono della frase: *sospetta*, *probabile* o *evidente*.

Ogni chiamata senza `seed` produce una formulazione diversa (non-determinismo testuale), mantenendo invariato il contenuto clinico.

### 5.3 Validazione linguistica

Le frasi sono scritte con registro radiologico plausibile, ma **non sono state validate da un medico**. Prima della consegna, far rileggere un output di esempio a una persona con competenza clinica — è il tipo di dettaglio che una commissione medica nota immediatamente.

---

## 6. Setup completo dell'ambiente

```bash
cd backend
uv init
uv venv
uv pip install -r requirements.txt
```

Contenuto di `.env`:

```env
MONGODB_URL=mongodb://localhost:27017
DB_NAME=medicinai
JWT_SECRET=<stringa lunga e random — non lasciare il default>
```

Avvio:

```bash
uv run uvicorn main:app --reload --port 8000
```

Verifica:

```bash
curl http://localhost:8000/health
```

---

## 7. Riferimento endpoint

| Metodo | Path | Ruolo richiesto | Requisito |
|---|---|---|---|
| POST | `/auth/register` | — | gestione utenti |
| POST | `/auth/login` | — | gestione utenti |
| PUT | `/users/profile` | autenticato | gestione utenti |
| POST | `/patients` | autenticato | RF1.1, RF1.2 |
| GET | `/patients` | autenticato | RF6.1 |
| GET | `/patients/{id}` | autenticato | RF6.1 |
| GET | `/patients/{id}/slices/{i}` | autenticato | RF5.1, RF5.2 |
| POST | `/patients/{id}/classify` | autenticato | RF2.1–2.4, RNF6.2 |
| POST | `/patients/{id}/report` | autenticato | RF3.1, RNF6.1 |
| GET | `/patients/{id}/coherence` | autenticato | RF4.1 |
| PUT | `/patients/{id}/report` | autenticato | RF3.2, RF3.4 |
| POST | `/patients/{id}/validate` | **solo medico** | RF5.3 |
| POST | `/patients/{id}/unvalidate` | **solo medico** | RF5.3 |
| GET | `/patients/{id}/export` | autenticato | RF6.2 |
| GET | `/health` | — | RNF7.1 |

Documentazione completa con schema richieste/risposte: `http://localhost:8000/docs`

---

## 8. Sicurezza e privacy — note per la tesi

- `codice_fiscale`, `nome`, `cognome` sono salvati in chiaro nel prototipo. In un sistema reale, combinati con dati sanitari sensibili, richiederebbero cifratura a riposo e audit log degli accessi (GDPR art. 9).
- CORS aperto a tutti i domini (`*`) — da restringere al dominio del frontend prima di qualsiasi deployment reale.
- `JWT_SECRET` di default nel codice è solo per sviluppo locale: in qualsiasi ambiente condiviso va sostituito con un valore random generato e tenuto segreto.
- L'endpoint `/auth/register` non richiede autenticazione — accettabile per una demo, non per la produzione.

---
