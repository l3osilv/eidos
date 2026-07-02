# MedicinAI-BrainCT — Backend

Backend REST API per il sistema di supporto alla diagnosi neuroradiologica **MedicinAI-BrainCT**, sviluppato come progetto di tesi.

Il sistema assiste medici e specializzandi nella refertazione di TC encefalo: classifica automaticamente le patologie dalle immagini (Modello I) e genera un referto strutturato a partire dai risultati (Modello II).

---

## Indice

- [Architettura](#architettura)
- [Tecnologie](#tecnologie)
- [Struttura del progetto](#struttura-del-progetto)
- [Requisiti di sistema](#requisiti-di-sistema)
- [Installazione](#installazione)
- [Configurazione](#configurazione)
- [Avvio](#avvio)
- [API Reference](#api-reference)
- [Modello I — Classificazione (RF2)](#modello-i--classificazione-rf2)
- [Modello II — Refertazione (RF3)](#modello-ii--refertazione-rf3)
- [Autenticazione e ruoli](#autenticazione-e-ruoli)
- [Storage immagini](#storage-immagini)
- [Mapping requisiti funzionali](#mapping-requisiti-funzionali)

---

## Architettura

Il backend segue un flusso lineare che rispecchia il workflow diagnostico reale:

```
Registrazione/Login
       │
       ▼
Creazione paziente + upload 8 slice TC  ──── RF1
       │
       ▼
Classificazione automatica (Modello I)  ──── RF2
       │
       ▼
Generazione referto (Modello II)        ──── RF3
       │
       ▼
Controllo coerenza findings ↔ referto   ──── RF4
       │
       ▼
Visualizzazione slice + storico         ──── RF5, RF6
       │
       ▼
Validazione medica + esportazione       ──── RF5.3, RF6.2
```

L'applicazione è interamente asincrona grazie a FastAPI + Motor (driver async MongoDB).  
I modelli di deep learning vengono caricati una sola volta all'avvio e condivisi come singleton tra tutte le richieste.

---

## Tecnologie

| Componente         | Tecnologia                                        |
| ------------------ | ------------------------------------------------- |
| Framework web      | **FastAPI** ≥ 0.110                               |
| Server ASGI        | **Uvicorn** ≥ 0.27                                |
| Database           | **MongoDB** (driver: Motor ≥ 3.4 / PyMongo ≥ 4.6) |
| Autenticazione     | **JWT** (python-jose) + **bcrypt** (passlib)      |
| Deep Learning      | **PyTorch** ≥ 2.0, **timm**                       |
| Image Processing   | **Pillow** ≥ 10.0, **OpenCV**, **NumPy**          |
| Validazione dati   | **Pydantic v2** (integrato in FastAPI)             |
| Python             | ≥ 3.14                                            |

---

## Struttura del progetto

```
backend/
├── main.py              # Applicazione FastAPI: tutti gli endpoint REST
├── auth.py              # Autenticazione JWT, hashing password, gestione ruoli
├── database.py          # Connessione MongoDB (Motor async) e collezioni
├── schemas.py           # Schemi Pydantic per request/response
├── model_I.py           # Wrapper Modello I: classificazione binaria per classe
├── model_II.py          # Modello II: generatore rule-based di referti
├── storage.py           # Salvataggio immagini TC su filesystem
├── requirements.txt     # Dipendenze Python
├── pyproject.toml       # Metadata del progetto
├── .env                 # Variabili d'ambiente (non committare in produzione)
│
├── checkpoints/         # Pesi dei 4 classificatori binari (~30 MB ciascuno)
│   ├── model_I_blood_best.pth
│   ├── model_I_edema_best.pth
│   ├── model_I_ischemia_best.pth
│   └── model_I_mass_best.pth
│
├── models_config/       # Configurazioni JSON usate durante il training
│   ├── config_blood.json
│   ├── config_edema.json
│   ├── config_ischemia.json
│   └── config_massa.json
│
└── storage/
    └── images/          # Immagini TC organizzate per paziente (ObjectId/)
```

---

## Requisiti di sistema

- **Python** ≥ 3.14
- **MongoDB** in esecuzione locale (default: `mongodb://localhost:27017`)
- **Repo SSL-BrainCT-Pathology** clonata in locale (necessaria per l'inferenza del Modello I)
- **GPU CUDA** (opzionale) — il sistema funziona anche su CPU, ma l'inferenza è più lenta

---

## Installazione

### 1. Clona il repository

```bash
git clone https://github.com/l3osilv/medicinAI-brainCT.git
cd medicinAI-brainCT/backend
```

### 2. Crea e attiva l'ambiente virtuale

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Installa le dipendenze

```bash
pip install -r requirements.txt
```

### 4. Clona la repo del Modello I (se non già presente)

Il Modello I dipende dalla repo [SSL-BrainCT-Pathology](https://github.com/l3osilv/SSL-BrainCT-Pathology). Il path di default assume che sia affiancata al progetto:

```
Projects/
├── medicinAI-brainCT/
│   └── backend/          ← tu sei qui
└── SSL-BrainCT-Pathology/
    └── stage2_2d_slice_level/
        └── supervised_finetuning/
            └── src/       ← codice importato da model_I.py
```

Se la repo è in una posizione diversa, imposta la variabile `SSL_BRAINCT_SRC` nel file `.env`.

### 5. Avvia MongoDB

```bash
# Se installato localmente
mongod --dbpath /path/to/data

# Oppure con Docker
docker run -d -p 27017:27017 --name mongo mongo:7
```

---

## Configurazione

La configurazione avviene tramite variabili d'ambiente, definite nel file `.env`:

| Variabile          | Default                            | Descrizione                                                     |
| ------------------ | ---------------------------------- | --------------------------------------------------------------- |
| `MONGODB_URL`      | `mongodb://localhost:27017`        | URI di connessione a MongoDB                                    |
| `DB_NAME`          | `medicinai`                        | Nome del database MongoDB                                       |
| `JWT_SECRET`       | *(vuoto — solo per sviluppo)*      | Chiave segreta per la firma dei token JWT (HS256)               |
| `SSL_BRAINCT_SRC`  | `../../SSL-BrainCT-Pathology/...`  | Path alla repo del Modello I (cartella `supervised_finetuning`) |
| `IMAGES_ROOT`      | `storage/images`                   | Cartella root per lo storage delle immagini TC                  |

> **⚠️ Importante:** In produzione, genera un `JWT_SECRET` sicuro:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

## Avvio

```bash
# Dalla cartella backend/
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

All'avvio il backend:
1. Carica i checkpoint del Modello I (4 classificatori binari) su GPU/CPU
2. Inizializza il Modello II (rule-based, nessun caricamento necessario)
3. Stabilisce la connessione a MongoDB

Verifica che il backend sia attivo:
```bash
curl http://localhost:8000/health
```

La documentazione interattiva Swagger è disponibile su: **http://localhost:8000/docs**

---

## API Reference

### Health Check

| Metodo | Endpoint   | Auth | Descrizione                                            |
| ------ | ---------- | ---- | ------------------------------------------------------ |
| GET    | `/health`  | No   | Stato del backend, modelli caricati, dispositivo (GPU/CPU) |

### Autenticazione

| Metodo | Endpoint          | Auth | Descrizione                                |
| ------ | ----------------- | ---- | ------------------------------------------ |
| POST   | `/auth/register`  | No   | Registrazione nuovo utente                 |
| POST   | `/auth/login`     | No   | Login (OAuth2 password flow) → token JWT   |
| PUT    | `/users/profile`  | Sì   | Aggiornamento profilo (nome, cognome, avatar) |

### Pazienti

| Metodo | Endpoint                          | Auth | Descrizione                                      |
| ------ | --------------------------------- | ---- | ------------------------------------------------ |
| POST   | `/patients`                       | Sì   | Crea paziente + upload 8 slice TC (form: nome, cognome, codice_fiscale, data_nascita, sesso, files) |
| GET    | `/patients`                       | Sì   | Lista pazienti con stato workflow                |
| GET    | `/patients/{id}`                  | Sì   | Dettaglio singolo paziente                       |
| GET    | `/patients/{id}/slices/{index}`   | Sì   | Singola slice come immagine PNG (indice 0–7)     |

### Classificazione e refertazione

| Metodo | Endpoint                        | Auth | Descrizione                                                 |
| ------ | ------------------------------- | ---- | ----------------------------------------------------------- |
| POST   | `/patients/{id}/classify`       | Sì   | Classificazione patologie (Modello I). `force=true` ricalcola |
| POST   | `/patients/{id}/report`         | Sì   | Genera referto (Modello II). Richiede classificazione prima  |
| GET    | `/patients/{id}/coherence`      | Sì   | Controllo coerenza findings ↔ testo referto                 |
| PUT    | `/patients/{id}/report`         | Sì   | Modifica manuale del testo del referto                       |

### Validazione ed esportazione

| Metodo | Endpoint                          | Auth     | Descrizione                                          |
| ------ | --------------------------------- | -------- | ---------------------------------------------------- |
| POST   | `/patients/{id}/validate`         | Medico   | Validazione referto con firma digitale (solo "medico") |
| POST   | `/patients/{id}/unvalidate`       | Medico   | Annulla la validazione del referto per modifiche (solo "medico") |
| GET    | `/patients/{id}/export`           | Sì       | Esportazione referto in formato testo (text/plain)   |

---

## Modello I — Classificazione (RF2)

Il Modello I esegue la classificazione binaria delle patologie sulle 8 slice TC assiali con strategia **binary decomposition**: un classificatore indipendente per ciascuna delle 4 classi.

### Architettura (per ogni classe)

```
8 slice TC (PIL.Image)
       │
       ▼
  Preprocessing
  (circle mask + multi-window CT + CLAHE)
       │
       ▼
  DenseNet-121 encoder (pesi SimCLR)
       │
       ▼
  AvgAggregator (aggregazione slice-level)
       │
       ▼
  Testa di classificazione (FC 256 → dropout 0.3 → FC 1)
       │
       ▼
  Sigmoid → probabilità [0, 1]
```

### Classi patologiche

| Classe      | Checkpoint                       | Soglia | AUC di riferimento |
| ----------- | -------------------------------- | ------ | ------------------ |
| Blood       | `model_I_blood_best.pth`        | 0.5    | 0.568              |
| Mass        | `model_I_mass_best.pth`         | 0.5    | 0.589              |
| Edema       | `model_I_edema_best.pth`        | 0.5    | 0.756              |
| Ischemia    | `model_I_ischemia_best.pth`     | 0.5    | —                  |

### Preprocessing

I parametri di preprocessing sono definiti nei JSON di `models_config/` e replicano esattamente la pipeline usata in training:
- **Circle mask** adattiva (raggio 0.45)
- **Multi-window CT** (finestre: brain, blood, stroke → 3 canali)
- **CLAHE** (clip limit 2.0, tile 8×8)
- **Resize** 224×224 (interpolazione bilineare)
- **Normalizzazione ImageNet** (mean/std standard)

### Configurazione dinamica

Ogni modello legge i propri parametri dal file JSON corrispondente in `models_config/`:
- `config_blood.json` — configurazione per la classe Blood
- `config_edema.json` — configurazione per la classe Edema
- `config_ischemia.json` — configurazione per la classe Ischemia
- `config_massa.json` — configurazione per la classe Mass

I JSON contengono tutti gli iperparametri usati durante il training (encoder, aggregatore, augmentation, loss, ecc.) e garantiscono l'allineamento tra fase di training e fase di inferenza.

---

## Modello II — Refertazione (RF3)

Il Modello II è un **generatore rule-based** che compone referti strutturati a partire dai findings del Modello I. Non è un modello generativo addestrato.

### Struttura del referto

Ogni referto è organizzato in 4 sezioni:

1. **TECNICA** — Descrizione dell'esame (numero di slice, preprocessing applicato)
2. **REPERTI** — Descrizione finding per finding, con frasi calibrate sul livello di confidenza
3. **CONCLUSIONI** — Sintesi diagnostica
4. **RACCOMANDAZIONI** — Indicazioni cliniche per ogni finding positivo

### Livelli di confidenza

La probabilità restituita dal Modello I viene tradotta in livelli descrittivi:

| Livello     | Condizione                     | Esempio nel referto                                 |
| ----------- | ------------------------------ | --------------------------------------------------- |
| `sospetta`  | margine < 0.08 sopra soglia   | "area di incerta significatività..."                |
| `probabile` | probabilità tra soglia e 0.85  | "area compatibile con..."                           |
| `evidente`  | probabilità ≥ 0.85            | "francamente evidente, compatibile con..."          |

### Non-determinismo

Ogni sezione dispone di template multipli equivalenti dal punto di vista clinico. Chiamate successive a `/report` producono testo diverso nella formulazione ma identico nel contenuto diagnostico. Si può passare un `seed` per output riproducibili (utile per test e valutazione).

---

## Autenticazione e ruoli

Il sistema utilizza **JWT (JSON Web Token)** con algoritmo HS256 per l'autenticazione.

### Flusso

1. L'utente si registra o effettua il login → riceve un token JWT
2. Il frontend include il token nell'header `Authorization: Bearer <token>`
3. Ogni endpoint protetto decodifica il token e recupera l'utente da MongoDB
4. Il token ha validità di **8 ore** (una giornata lavorativa)

### Ruoli

| Ruolo            | Permessi                                                          |
| ---------------- | ----------------------------------------------------------------- |
| `medico`         | Tutte le operazioni, inclusa la validazione del referto (RF5.3)   |
| `specializzando` | Tutte le operazioni tranne la validazione del referto             |

La validazione del referto include la firma digitale con titolo professionale corretto in base al genere (`Dr.` / `Dr.ssa`).

### Password

Le password sono memorizzate come hash bcrypt con salt casuale. Non vengono mai salvate in chiaro.

---

## Storage immagini

Le immagini TC **non** vengono salvate dentro MongoDB: risiedono su filesystem con solo i path assoluti memorizzati nel documento paziente.

### Organizzazione

```
storage/images/
├── 6684a1f2b3c4d5e6f7890123/    ← ObjectId del paziente
│   ├── slice_0.png
│   ├── slice_1.png
│   ├── ...
│   └── slice_7.png
└── 6684b2a3c4d5e6f7890124/
    ├── slice_0.png
    └── ...
```

- Formato: **PNG lossless** (grayscale) — preserva i valori di densità CT
- Ogni paziente ha una cartella dedicata con nome uguale al suo `_id` MongoDB
- Le 8 slice sono nominate progressivamente (`slice_0.png` ... `slice_7.png`)

---

## Mapping requisiti funzionali

| Requisito | Descrizione                               | Endpoint                         |
| --------- | ----------------------------------------- | -------------------------------- |
| RF1.1     | Creazione paziente                        | `POST /patients`                 |
| RF1.2     | Caricamento 8 slice TC                    | `POST /patients`                 |
| RF2.1–2.4 | Classificazione automatica                | `POST /patients/{id}/classify`   |
| RF3.1     | Generazione referto                       | `POST /patients/{id}/report`     |
| RF3.2     | Modifica manuale referto                  | `PUT /patients/{id}/report`      |
| RF3.4     | Salvataggio modifiche referto             | `PUT /patients/{id}/report`      |
| RF4.1     | Controllo coerenza findings ↔ referto     | `GET /patients/{id}/coherence`   |
| RF5.1     | Visualizzazione slice                     | `GET /patients/{id}/slices/{i}`  |
| RF5.2     | Navigazione tra slice                     | `GET /patients/{id}/slices/{i}`  |
| RF5.3     | Validazione referto (solo medico)         | `POST /patients/{id}/validate`   |
| RF6.1     | Storico pazienti                          | `GET /patients`                  |
| RF6.2     | Esportazione referto                      | `GET /patients/{id}/export`      |
| RNF6.1    | Tempo di generazione referto              | `POST /patients/{id}/report`     |
| RNF6.2    | Tempo di classificazione                  | `POST /patients/{id}/classify`   |
| RNF7.1    | Health check e monitoraggio               | `GET /health`                    |

---

## Collezioni MongoDB

### `users`

```json
{
  "username": "mariorossi",
  "hashed_password": "$2b$12$...",
  "nome": "Mario",
  "cognome": "Rossi",
  "gender": "M",
  "role": "medico",
  "avatar": null
}
```

### `patients`

```json
{
  "_id": "ObjectId(...)",
  "nome": "Luigi",
  "cognome": "Verdi",
  "codice_fiscale": "VRDLGU80A01H501Z",
  "data_nascita": "1980-01-01",
  "created_at": "2026-07-01T10:30:00Z",
  "created_by": "mariorossi",
  "image_paths": ["storage/images/abc123/slice_0.png", "..."],
  "findings": [
    {"label": "Blood", "probability": 0.82, "threshold": 0.5, "positive": true},
    {"label": "Mass", "probability": 0.12, "threshold": 0.5, "positive": false}
  ],
  "no_finding": false,
  "report_text": "TECNICA:\n...\n\nREPERTI:\n...",
  "validated": true,
  "validated_by": "Dr. Rossi"
}
```

---
