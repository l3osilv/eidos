# Eidos — Backend

Questo repository contiene il codice del backend di **Eidos**, un sistema di supporto alla refertazione neuroradiologica sviluppato come progetto per la mia tesi triennale.

Il server espone le API REST (realizzate con FastAPI) per la gestione dell'anagrafica dei pazienti, il caricamento delle immagini TC, l'esecuzione della classificazione automatica tramite reti neurali (Modello I) e la generazione della bozza di referto (Modello II).

---

## Indice

- [Come è strutturato il backend](#come-è-strutturato-il-backend)
- [Tecnologie utilizzate](#tecnologie-utilizzate)
- [Struttura delle cartelle](#struttura-delle-cartelle)
- [Requisiti](#requisiti)
- [Installazione e setup](#installazione-e-setup)
- [Configurazione delle variabili d'ambiente](#configurazione-delle-variabili-dambiente)
- [Avvio del server](#avvio-del-server)
- [Riferimento delle API](#riferimento-delle-api)
- [Dettagli sul Modello I (Classificazione)](#dettagli-sul-modello-i-classificazione)
- [Dettagli sul Modello II (Refertazione)](#dettagli-sul-modello-ii-refertazione)
- [Gestione di autenticazione e ruoli](#gestione-di-autenticazione-e-ruoli)
- [Salvataggio delle immagini](#salvataggio-delle-immagini)
- [Mappatura dei requisiti funzionali](#mappatura-dei-requisiti-funzionali)

---

## Come è strutturato il backend

Il backend è progettato per rispecchiare il flusso di lavoro radiologico in reparto:

```text
Registrazione/Login
       │
       ▼
Inserimento paziente + caricamento 8 slice TC ─── RF1
       │
       ▼
Classificazione automatica (Modello I) ────────── RF2
       │
       ▼
Generazione automatica referto (Modello II) ───── RF3
       │
       ▼
Controllo coerenza tra reperti e referto ──────── RF4
       │
       ▼
Visualizzazione delle slice e storico ─────────── RF5, RF6
       │
       ▼
Validazione del medico strutturato ed export ──── RF5.3, RF6.2
```

Per ottimizzare le prestazioni e ridurre i tempi di latenza, l'applicazione usa **FastAPI** in modalità asincrona e **Motor** (il driver asincrono per MongoDB). I pesi delle reti neurali vengono caricati in memoria all'avvio del server e condivisi come singleton tra le varie richieste.

---

## Tecnologie utilizzate

Ecco le librerie e le tecnologie principali impiegate nel server:

| Componente | Tecnologia |
| --- | --- |
| Framework web | **FastAPI** (API REST asincrone) |
| Server ASGI | **Uvicorn** |
| Database | **MongoDB** (con driver Motor) |
| Autenticazione | **JWT** (`python-jose`) + **bcrypt** (`passlib`) |
| Deep Learning | **PyTorch** e **timm** (encoder DenseNet-121) |
| Image Processing | **Pillow**, **OpenCV** e **NumPy** |
| Rifinitura Linguistica | **Groq API** (LLaMA 3.3 70B per lo stile del testo) |
| Validazione dati | **Pydantic v2** |
| Versione Python | Python 3.11+ |

---

## Struttura delle cartelle

```text
backend/
├── main.py              # Endpoint API del server FastAPI
├── auth.py              # Autenticazione JWT, hashing password e gestione ruoli
├── database.py          # Connessione asincrona a MongoDB
├── schemas.py           # Schemi Pydantic per validare richieste e risposte
├── model_I.py           # Inizializzazione e inferenza dei 4 classificatori
├── model_II.py          # Generazione del referto (rule-based + LLM)
├── llm_refiner.py       # Integrazione API Groq (LLaMA 3.3) per rifinitura del referto
├── storage.py           # Salvataggio delle immagini su disco
├── requirements.txt     # Dipendenze Python
├── pyproject.toml       # Configurazioni di progetto
├── .env                 # Variabili d'ambiente locali
│
├── checkpoints/         # Pesi pre-addestrati dei modelli (.pth)
│   ├── model_I_blood_best.pth
│   ├── model_I_edema_best.pth
│   ├── model_I_ischemia_best.pth
│   └── model_I_mass_best.pth
│
├── models_config/       # Configurazioni dei modelli in formato JSON
│   ├── config_blood.json
│   ├── config_edema.json
│   ├── config_ischemia.json
│   └── config_massa.json
│
└── storage/
    └── images/          # Cartella di salvataggio delle slice TC
```

---

## Requisiti

- **Python** (versione ≥ 3.11)
- **MongoDB** attivo localmente (`mongodb://localhost:27017`)
- La repository **SSL-BrainCT-Pathology** clonata in locale (necessaria per caricare l'architettura di rete)
- **GPU CUDA** (opzionale: se presente viene usata da PyTorch, altrimenti viene usata la CPU)

---

## Installazione e setup

### 1. Clona il codice

```bash
git clone https://github.com/l3osilv/eidos.git
cd eidos/backend
```

### 2. Crea l'ambiente virtuale

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Installa le dipendenze

```bash
pip install -r requirements.txt
```

### 4. Struttura delle repository

Il backend importa il codice sorgente dalla repository di riferimento [SSL-BrainCT-Pathology](https://github.com/l3osilv/SSL-BrainCT-Pathology). Per impostazione predefinita, le cartelle devono trovarsi affiancate:

```text
Cartella_Progetti/
├── eidos/
│   └── backend/          ← Cartella corrente
└── SSL-BrainCT-Pathology/
    └── stage2_2d_slice_level/
        └── supervised_finetuning/
            └── src/       ← Sorgenti importati da model_I.py
```

Se la repository si trova in un altro percorso, specifica la variabile `SSL_BRAINCT_SRC` nel file `.env`.

### 5. Avvio di MongoDB

Per avviare velocemente MongoDB tramite Docker:

```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

---

## Configurazione delle variabili d'ambiente

Crea un file `.env` nella cartella `backend/` prendendo come modello `.env.example`:

| Variabile | Valore di Default | Descrizione |
| --- | --- | --- |
| `MONGODB_URL` | `mongodb://localhost:27017` | URL di connessione a MongoDB |
| `DB_NAME` | `eidos` | Nome del database |
| `JWT_SECRET` | *(stringa casuale)* | Chiave per firmare i token JWT |
| `SSL_BRAINCT_SRC` | `../../SSL-BrainCT-Pathology/...` | Percorso alla repository esterna |
| `IMAGES_ROOT` | `storage/images` | Percorso locale di salvataggio immagini |
| `GROQ_API_KEY` | *(opzionale)* | Chiave API Groq per la rifinitura stilistica (llama-3.3-70b-versatile) |
| `ENABLE_LLM_REFINEMENT` | `true` | Abilita o disabilita il passaggio LLM |

Per generare un `JWT_SECRET` sicuro:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Avvio del server

Per avviare il backend in modalità sviluppo:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

All'avvio, il server esegue automaticamente le seguenti operazioni:
1. Caricamento dei pesi `.pth` dei 4 modelli su GPU/CPU.
2. Inizializzazione dei template per la refertazione.
3. Connessione al database MongoDB.

Puoi verificare lo stato del server su `http://localhost:8000/health` e accedere alla documentazione delle API su `http://localhost:8000/docs`.

---

## Riferimento delle API

### Diagnostica
- `GET /health`: Stato del server, tipo di dispositivo in uso (CPU/GPU) e modelli caricati.

### Autenticazione e Utenti
- `POST /auth/register`: Registrazione nuovo utente.
- `POST /auth/login`: Autenticazione e rilascio del token JWT.
- `PUT /users/profile`: Aggiornamento dati profilo o avatar.

### Gestione Pazienti
- `POST /patients`: Registrazione paziente e caricamento delle 8 slice TC.
- `GET /patients`: Elenco dei pazienti e relativo stato.
- `GET /patients/{id}`: Dettaglio del singolo paziente.
- `GET /patients/{id}/slices/{index}`: Recupero dell'immagine della slice indicata.

### Classificazione e Refertazione
- `POST /patients/{id}/classify`: Esecuzione dell'inferenza (Modello I). Con `force=true` forza il ricalcolo.
- `POST /patients/{id}/report`: Generazione bozza del referto (Modello II).
- `GET /patients/{id}/coherence`: Controllo di coerenza tra reperti e testo del referto.
- `PUT /patients/{id}/report`: Salvataggio modifiche manuali al referto.

### Validazione ed Export
- `POST /patients/{id}/validate`: Validazione e firma digitale del referto (riservato ai medici strutturati).
- `POST /patients/{id}/unvalidate`: Riapertura referto per riesame (riservato ai medici strutturati).
- `GET /patients/{id}/export`: Download del referto in formato `.txt`.

---

## Dettagli sul Modello I (Classificazione)

Il Modello I stima la probabilità di presenza di 4 patologie sulle immagini TC utilizzando una pipeline a classificatori binari indipendenti.

### Pipeline di elaborazione

```text
8 immagini TC del paziente
       │
       ▼
Preprocessing
(maschera circolare + tre finestre TC sovrapposte + CLAHE)
       │
       ▼
Encoder DenseNet-121 (pesi pre-addestrati SimCLR)
       │
       ▼
Average Aggregator (aggregazione delle feature delle 8 slice)
       │
       ▼
Classificatore (Fully Connected 256 → Dropout 0.3 → Fully Connected 1)
       │
       ▼
Sigmoide → Probabilità finale (0.0 - 1.0)
```

### Soglie decisionali

| Patologia | File dei Pesi | Soglia |
| --- | --- | --- |
| **Blood** (Emorragia/Sangue) | `model_I_blood_best.pth` | 0.50 |
| **Mass** (Massa espansiva) | `model_I_mass_best.pth` | 0.50 |
| **Edema** (Edema cerebrale) | `model_I_edema_best.pth` | 0.50 |
| **Ischemia** (Ischemia acuta) | `model_I_ischemia_best.pth` | 0.50 |

---

## Dettagli sul Modello II (Refertazione)

Il Modello II genera il testo del referto in due passaggi:

1. **Generatore Rule-Based Strutturato**: Un motore deterministico compone le sezioni del referto (TECNICA, REPERTI, CONCLUSIONI, RACCOMANDAZIONI) in base alle probabilità e alle soglie del Modello I.
2. **Rifinitura Linguistica (Opzionale)**: Se configurato, invia il testo al modello LLM per migliorare la scorrevolezza sintattica, mantenendo invariati i contenuti clinici.
3. **Controllo di Coerenza**: Verifiche automatiche assicurano che nessun reperto rilevato dal Modello I venga alterato o rimosso.

---

## Autenticazione e Ruoli

L'accesso alle funzionalità è regolato tramite ruoli:

- **medico**: Accesso completo, compresa la validazione e firma dei referti.
- **specializzando**: Caricamento pazienti, esecuzione analisi ed editing bozza referti (senza permessi di firma finale).

Le password vengono salvate su database sotto forma di hash cifrati tramite `bcrypt`.

---

## Salvataggio Immagini

Le immagini TC vengono memorizzate su disco in formato PNG privo di compressione con perdita nella cartella `storage/images/{patient_id}/`. Nel database MongoDB vengono memorizzati unicamente i percorsi relativi dei file.

---

## Mappatura Requisiti Funzionali

| Requisito | Descrizione | Endpoint |
| --- | --- | --- |
| **RF1.1** | Anagrafica paziente | `POST /patients` |
| **RF1.2** | Caricamento 8 slice TC | `POST /patients` |
| **RF2.1-2.4** | Classificazione patologie | `POST /patients/{id}/classify` |
| **RF3.1** | Generazione bozza referto | `POST /patients/{id}/report` |
| **RF3.2 / RF3.4** | Modifica e salvataggio referto | `PUT /patients/{id}/report` |
| **RF4.1** | Controllo di coerenza | `GET /patients/{id}/coherence` |
| **RF5.1-5.2** | Visualizzazione e navigazione slice | `GET /patients/{id}/slices/{i}` |
| **RF5.3** | Validazione e firma referto | `POST /patients/{id}/validate` |
| **RF6.1** | Registro pazienti e storico | `GET /patients` |
| **RF6.2** | Esportazione referto (.txt) | `GET /patients/{id}/export` |
| **RNF7.1** | Endpoint di diagnostica | `GET /health` |