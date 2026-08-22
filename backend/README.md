# Eidos: backend

Backend dell'applicazione **Eidos**, sistema di supporto alla refertazione neuroradiologica sviluppato per la tesi di laurea triennale in Informatica presso l'Università degli Studi di Trento.

Il server espone le API REST asincrone realizzate con FastAPI per gestire l'anagrafica dei pazienti, il salvataggio delle 8 slice tomografiche, l'inferenza del modello di classificazione delle patologie (modello I) e la generazione della bozza di referto (modello II).

---

## Indice

- [Flusso operativo del backend](#flusso-operativo-del-backend)
- [Tecnologie utilizzate](#tecnologie-utilizzate)
- [Struttura delle cartelle](#struttura-delle-cartelle)
- [Requisiti di sistema](#requisiti-di-sistema)
- [Installazione e configurazione](#installazione-e-configurazione)
- [Configurazione delle variabili d'ambiente](#configurazione-delle-variabili-dambiente)
- [Avvio del server](#avvio-del-server)
- [Riferimento delle API REST](#riferimento-delle-api-rest)
- [Dettagli sul modello I (classificazione)](#dettagli-sul-modello-i-classificazione)
- [Dettagli sul modello II (refertazione)](#dettagli-sul-modello-ii-refertazione)
- [Autenticazione e gestione dei ruoli](#autenticazione-e-gestione-dei-ruoli)
- [Salvataggio delle immagini](#salvataggio-delle-immagini)
- [Mappatura dei requisiti funzionali](#mappatura-dei-requisiti-funzionali)

---

## Flusso operativo del backend

Il backend rispecchia il percorso diagnostico del reparto radiologico:

```text
Registrazione e login
       │
       ▼
Inserimento paziente e upload 8 slice TC ─── RF1
       │
       ▼
Classificazione automatica (modello I) ────── RF2
       │
       ▼
Generazione automatica referto (modello II) ── RF3
       │
       ▼
Controllo di coerenza lessicale ──────────── RF4
       │
       ▼
Visualizzazione slice e consultazione ─────── RF5, RF6
       │
       ▼
Firma digitale del medico strutturato ────── RF5.3, RF6.2
```

Per garantire tempi di risposta contenuti ed evitare blocchi del server durante i calcoli intensivi su CPU, le operazioni PyTorch vengono delegate al thread pool di sistema tramite `asyncio.to_thread()`, mentre il database MongoDB è interrogato in modo asincrono con Motor. I pesi delle reti neurali vengono caricati in memoria come istanze singleton all'avvio del server.

---

## Tecnologie utilizzate

Riepilogo dello stack tecnologico:

| Componente | Tecnologia |
| --- | --- |
| Framework web | **FastAPI** (API REST asincrone) |
| Server ASGI | **Uvicorn** |
| Database | **MongoDB** (con driver asincrono Motor) |
| Autenticazione | **JWT** (`python-jose`) + **bcrypt** (`passlib`) |
| Deep learning | **PyTorch** e **timm** (encoder DenseNet-121) |
| Image processing | **Pillow**, **OpenCV** e **NumPy** |
| Rifinitura linguistica | **Groq API** (modello LLaMA 3.3 70B) |
| Validazione dati | **Pydantic v2** |
| Versione Python | Python 3.11+ |

---

## Struttura delle cartelle

```text
backend/
├── main.py              # endpoint API e registrazione delle rotte
├── auth.py              # autenticazione JWT, hashing bcrypt e ruoli
├── database.py          # connessione asincrona a MongoDB tramite Motor
├── schemas.py           # schemi Pydantic per validazione dati
├── model_I.py           # caricamento e inferenza dei 4 classificatori (DenseNet-121)
├── model_II.py          # generazione deterministica e controllo lessicale
├── llm_refiner.py       # client per API Groq (LLaMA 3.3)
├── storage.py           # funzioni di salvataggio immagini su filesystem
├── requirements.txt     # dipendenze Python
├── pyproject.toml       # configurazione del pacchetto
├── .env                 # variabili d'ambiente locali
│
├── checkpoints/         # pesi pre-addestrati dei modelli (.pth)
│   ├── model_I_blood_best.pth
│   ├── model_I_edema_best.pth
│   ├── model_I_ischemia_best.pth
│   └── model_I_mass_best.pth
│
├── models_config/       # file JSON di configurazione dei modelli
│   ├── config_blood.json
│   ├── config_edema.json
│   ├── config_ischemia.json
│   └── config_massa.json
│
└── storage/
    └── images/          # directory di salvataggio delle slice tomografiche
```

---

## Requisiti di sistema

- **Python** (versione ≥ 3.11)
- **MongoDB** attivo localmente (`mongodb://localhost:27017`)
- Repository **SSL-BrainCT-Pathology** presente in locale (necessaria per i moduli di preprocessing e architettura)
- **Architettura hardware**: testata su CPU Intel Core i5 con 16 GB di RAM (GPU CUDA supportata automaticamente se presente)

---

## Installazione e configurazione

### 1. Clonazione del repository

```bash
git clone https://github.com/l3osilv/eidos.git
cd eidos/backend
```

### 2. Creazione dell'ambiente virtuale

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Installazione delle dipendenze

```bash
pip install -r requirements.txt
```

### 4. Posizionamento della repository SSL-BrainCT-Pathology

Il backend importa i sorgenti di riferimento dalla repository [SSL-BrainCT-Pathology](https://github.com/l3osilv/SSL-BrainCT-Pathology). La struttura predefinita prevede le directory affiancate:

```text
Cartella_Progetti/
├── eidos/
│   └── backend/          ← directory corrente
└── SSL-BrainCT-Pathology/
    └── stage2_2d_slice_level/
        └── supervised_finetuning/
            └── src/       ← sorgenti importati da model_I.py
```

Se la repository si trova in un percorso alternativo, è sufficiente specificare la variabile `SSL_BRAINCT_SRC` nel file `.env`.

### 5. Avvio del database MongoDB

Per avviare MongoDB tramite container Docker:

```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

---

## Configurazione delle variabili d'ambiente

Creare un file `.env` nella directory `backend/` prendendo come modello `.env.example`:

| Variabile | Valore predefinito | Descrizione |
| --- | --- | --- |
| `MONGODB_URL` | `mongodb://localhost:27017` | URL di connessione a MongoDB |
| `DB_NAME` | `eidos` | Nome del database |
| `JWT_SECRET` | *(stringa casuale)* | Chiave per firmare i token JWT |
| `SSL_BRAINCT_SRC` | `../../SSL-BrainCT-Pathology/...` | Percorso alla repository esterna |
| `IMAGES_ROOT` | `storage/images` | Percorso locale di salvataggio immagini |
| `GROQ_API_KEY` | *(opzionale)* | Chiave API Groq per rifinitura stilistica |
| `ENABLE_LLM_REFINEMENT` | `true` | Abilita o disabilita il passaggio LLM |

Per generare una chiave `JWT_SECRET` sicura:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Avvio del server

Per avviare il server backend in modalità di sviluppo:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

All'avvio, il server esegue automaticamente le seguenti operazioni:
1. Caricamento dei pesi `.pth` dei 4 modelli su memoria (CPU o GPU).
2. Inizializzazione dei template clinici deterministici per la refertazione.
3. Connessione al database MongoDB.

Lo stato del server è verificabile all'indirizzo `http://localhost:8000/health`, mentre la documentazione interattiva OpenAPI è disponibile su `http://localhost:8000/docs`.

---

## Riferimento delle API REST

### Diagnostica
- `GET /health`: stato del server, dispositivo in uso (CPU/GPU) e modelli caricati.

### Autenticazione e utenti
- `POST /auth/register`: registrazione di un nuovo utente.
- `POST /auth/login`: autenticazione delle credenziali e rilascio del token JWT.
- `PUT /users/profile`: aggiornamento dei dati del profilo o dell'avatar.

### Gestione pazienti
- `POST /patients`: registrazione del paziente e caricamento delle 8 slice TC.
- `GET /patients`: elenco dei pazienti registrati con filtri di ricerca.
- `GET /patients/{id}`: scheda clinica completa del paziente.
- `GET /patients/{id}/slices/{index}`: download dell'immagine tomografica indicata.

### Classificazione e refertazione
- `POST /patients/{id}/classify`: esecuzione dell'inferenza del modello I (con `force=true` forza il ricalcolo).
- `POST /patients/{id}/report`: generazione della bozza del referto tramite modello II.
- `GET /patients/{id}/coherence`: verifica della coerenza tra reperti e testo del referto.
- `PUT /patients/{id}/report`: salvataggio delle modifiche manuali al testo.

### Validazione ed esportazione
- `POST /patients/{id}/validate`: validazione e firma digitale del referto (riservato ai medici strutturati).
- `POST /patients/{id}/unvalidate`: sblocco della scheda per riesame (riservato ai medici strutturati).
- `GET /patients/{id}/export`: esportazione del referto clinico in formato testo (`.txt`).

---

## Dettagli sul modello I (classificazione)

Il modello I stima la probabilità di presenza di 4 patologie sulle 8 slice tomografiche utilizzando una pipeline a classificatori binari indipendenti.

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
Average Aggregator (aggregazione feature delle 8 slice)
       │
       ▼
Classificatore (Fully Connected 256 → Dropout 0.3 → Fully Connected 1)
       │
       ▼
Sigmoide → Probabilità finale (0.0 - 1.0)
```

### Soglie di decisione

| Patologia | File dei pesi | Soglia predefinita |
| --- | --- | --- |
| **Blood** (emorragia cerebrale) | `model_I_blood_best.pth` | 0.50 |
| **Mass** (effetto massa) | `model_I_mass_best.pth` | 0.50 |
| **Edema** (edema cerebrale) | `model_I_edema_best.pth` | 0.50 |
| **Ischemia** (ischemia acuta) | `model_I_ischemia_best.pth` | 0.50 |

---

## Dettagli sul modello II (refertazione)

La generazione del referto è strutturata in tre stadi sequenziali:

1. **Generatore deterministico con template:** compone le sezioni canoniche del referto (*Tecnica*, *Reperti*, *Conclusioni*, *Raccomandazioni*) in base alle probabilità numeriche e alle soglie del modello I.
2. **Rifinitura linguistica opzionale:** se attiva la chiave API, invia la bozza al modello LLaMA 3.3 70B tramite Groq per rendere il testo scorrevole, preservando inalterati i termini clinici.
3. **Controllo automatico di coerenza lessicale:** verifica che nessun reperto positivo venga rimosso dalla risposta dell'LLM; in caso di anomalie, ripristina istantaneamente la bozza deterministica.

---

## Autenticazione e gestione dei ruoli

L'accesso alle funzionalità è regolato tramite ruoli:

- **medico:** accesso completo, inclusa la validazione e la firma digitale dei referti.
- **specializzando:** caricamento pazienti, avvio inferenza ed editing delle bozze (senza permessi di firma finale).

Le password vengono memorizzate sul database sotto forma di hash cifrati con algoritmo `bcrypt`.

---

## Salvataggio delle immagini

Le slice tomografiche vengono salvate su filesystem in formato PNG privo di compressione con perdita nel percorso `storage/images/{patient_id}/`. Nel database MongoDB vengono memorizzati unicamente i percorsi relativi dei file.

---
