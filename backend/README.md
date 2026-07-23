# Eidos — Backend

Questo è il codice del backend di **Eidos**, un sistema di supporto alla refertazione neuroradiologica che ho sviluppato come progetto per la mia tesi triennale.

Il server espone le API REST (usando FastAPI) che servono a gestire l'anagrafica dei pazienti, caricare le immagini TC, eseguire la classificazione automatica tramite reti neurali (Modello I) e generare una bozza di referto clinico basata sui risultati (Modello II) .

---

## Indice

* [Come è strutturato il backend](https://www.google.com/search?q=%23come-%C3%A8-strutturato-il-backend)
* [Tecnologie utilizzate](https://www.google.com/search?q=%23tecnologie-utilizzate)
* [Struttura delle cartelle](https://www.google.com/search?q=%23struttura-delle-cartelle)
* [Requisiti](https://www.google.com/search?q=%23requisiti)
* [Installazione e setup](https://www.google.com/search?q=%23installazione-e-setup)
* [Configurazione delle variabili d'ambiente](https://www.google.com/search?q=%23configurazione-delle-variabili-dambiente)
* [Avvio del server](https://www.google.com/search?q=%23avvio-del-server)
* [Riferimento delle API](https://www.google.com/search?q=%23riferimento-delle-api)
* [Dettagli sul Modello I (Classificazione)](https://www.google.com/search?q=%23dettagli-sul-modello-i-classificazione)
* [Dettagli sul Modello II (Refertazione)](https://www.google.com/search?q=%23dettagli-sul-modello-ii-refertazione)
* [Gestione di autenticazione e ruoli](https://www.google.com/search?q=%23gestione-di-autenticazione-e-ruoli)
* [Salvataggio delle immagini](https://www.google.com/search?q=%23salvataggio-delle-immagini)
* [Mappatura dei requisiti funzionali](https://www.google.com/search?q=%23mappatura-dei-requisiti-funzionali)

---

## Come è strutturato il backend

Ho progettato il backend per seguire le fasi tipiche del flusso di lavoro del medico in reparto :

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

Per rendere l'applicazione performante ed evitare colli di bottiglia, ho utilizzato **FastAPI** in modalità interamente asincrona insieme a **Motor** (il driver asincrono ufficiale per MongoDB) . I pesi delle reti neurali vengono caricati in memoria all'avvio una volta sola e condivisi come singleton tra le varie richieste, riducendo i tempi di risposta delle API di inferenza .

---

## Tecnologie utilizzate

Ecco le librerie e le tecnologie principali che ho scelto per realizzare il server:

| Componente | Tecnologia |
| --- | --- |
| Framework web | **FastAPI** (per scrivere API asincrone in modo rapido)  |
| Server ASGI | **Uvicorn** (per far girare l'app FastAPI) |
| Database | **MongoDB** (con driver asincrono Motor)  |
| Autenticazione | **JWT** (`python-jose`) + **bcrypt** (`passlib` per fare l'hashing sicuro) |
| Deep Learning | **PyTorch** e **timm** (per caricare l'encoder DenseNet-121)  |
| Image Processing | **Pillow**, **OpenCV** e **NumPy** (per manipolare le slice della TC)  |
| Rifinitura Linguistica | **Anthropic API** (modello Claude Haiku per rendere più naturale il testo refertato)

|
| Validazione dati | **Pydantic v2** (integrato in FastAPI per controllare l'input delle API)  |
| Versione Python | Python 3.11 o superiore |

---

## Struttura delle cartelle

```text
backend/
├── main.py              # File principale con tutti gli endpoint API di FastAPI
├── auth.py              # Gestione JWT, hashing delle password e controllo dei ruoli
├── database.py          # Connessione a MongoDB (inizializzazione client Motor)
├── schemas.py           # Modelli Pydantic per validare richieste e risposte
├── model_I.py           # Wrapper per caricare i 4 classificatori ed eseguire l'inferenza
├── model_II.py          # Codice per comporre i referti in due fasi (rule-based + LLM)
├── llm_refiner.py       # Integrazione API Anthropic per la rifinitura stilistica del referto
├── storage.py           # Logica per salvare le immagini su disco
├── requirements.txt     # Pacchetti Python da installare
├── pyproject.toml       # Metadati e configurazioni del backend
├── .env                 # Variabili d'ambiente (da creare in locale)
│
├── checkpoints/         # Pesi dei modelli (.pth) per ciascuna patologia
│   ├── model_I_blood_best.pth
│   ├── model_I_edema_best.pth
│   ├── model_I_ischemia_best.pth
│   └── model_I_mass_best.pth
│
├── models_config/       # File JSON usati per configurare i modelli durante il training
│   ├── config_blood.json
│   ├── config_edema.json
│   ├── config_ischemia.json
│   └── config_massa.json
│
└── storage/
    └── images/          # Cartella in cui vengono salvati i file delle immagini TC

```

---

## Requisiti

* **Python** installato (versione ≥ 3.11)
* **MongoDB** avviato localmente (di default l'app cerca l'indirizzo `mongodb://localhost:27017`) 
* La repository **SSL-BrainCT-Pathology** clonata in locale (serve al Modello I per caricare la definizione della rete neurale) 
* **GPU CUDA** (opzionale): se disponibile PyTorch la utilizzerà per velocizzare l'inferenza, altrimenti il sistema userà la CPU.

---

## Installazione e setup

### 1. Scarica il codice

```bash
git clone https://github.com/l3osilv/eidos.git
cd eidos/backend

```

### 2. Crea l'ambiente virtuale di Python

```bash
python -m venv .venv
source .venv/bin/activate

```

### 3. Installa le dipendenze richieste

```bash
pip install -r requirements.txt

```

### 4. Clona la repository del Modello I

Il backend importa del codice dalla repository di riferimento [SSL-BrainCT-Pathology](https://github.com/l3osilv/SSL-BrainCT-Pathology). Per impostazione predefinita, ho configurato il percorso assumendo che le due cartelle si trovino affiancate :

```text
Cartella_Progetti/
├── eidos/
│   └── backend/          ← Cartella in cui ti trovi ora
└── SSL-BrainCT-Pathology/
    └── stage2_2d_slice_level/
        └── supervised_finetuning/
            └── src/       ← File sorgenti importati da model_I.py

```

Se preferisci posizionarla altrove, dovrai impostare la variabile d'ambiente `SSL_BRAINCT_SRC` nel file `.env` .

### 5. Avvia MongoDB

Se usi Docker, puoi avviare un database in un attimo con questo comando:

```bash
docker run -d -p 27017:27017 --name mongo mongo:7

```

---

## Configurazione delle variabili d'ambiente

Crea un file `.env` dentro la cartella `backend/` prendendo come base `.env.example`:

| Variabile | Valore di Default | Descrizione |
| --- | --- | --- |
| `MONGODB_URL` | `mongodb://localhost:27017` | Indirizzo per connettersi a MongoDB  |
| `DB_NAME` | `eidos` | Nome del database  |
| `JWT_SECRET` | *(vuoto per sviluppo)* | Chiave per firmare i token JWT  |
| `SSL_BRAINCT_SRC` | `../../SSL-BrainCT-Pathology/...` | Percorso alla repository esterna del Modello I  |
| `IMAGES_ROOT` | `storage/images` | Cartella in cui salvare le immagini caricate  |
| `ANTHROPIC_API_KEY` | *(vuoto)* | Chiave API per l'utilizzo dei modelli Anthropic (Claude) per la rifinitura linguistica del Modello II

|
| `ENABLE_LLM_REFINEMENT` | `true` | Abilita o disabilita il passaggio del testo allo LLM per migliorarne la fluidità sintattica

|

> **Nota per la sicurezza:** Per generare un `JWT_SECRET` sicuro da usare in produzione, puoi usare questo comando Python:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> 
> ```
>
>

---

## Avvio del server

Per far partire il backend in modalità sviluppo (con ricaricamento automatico a ogni modifica dei file):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000

```

All'avvio, il backend eseguirà queste azioni in sequenza :

1. Carica i 4 file dei pesi (.pth) per la classificazione su GPU o CPU.
2. Inizializza i template del generatore di referti (Modello II).
3. Stabilisce la connessione con MongoDB .

Puoi verificare che sia tutto attivo visitando `http://localhost:8000/health` o aprendo la documentazione interattiva all'indirizzo **http://localhost:8000/docs** .

---

## Riferimento delle API

### Diagnostica

* `GET /health`: Restituisce lo stato del backend, i modelli caricati e se si sta usando la CPU o la GPU .

### Gestione Utenti ed Autenticazione

* `POST /auth/register`: Registra un nuovo account .
* `POST /auth/login`: Effettua il login e restituisce il token JWT .
* `PUT /users/profile`: Permette all'utente autenticato di modificare nome, cognome o avatar .

### Gestione Pazienti

* `POST /patients`: Crea un paziente e carica le sue 8 slice TC .
* `GET /patients`: Mostra la lista dei pazienti e lo stato delle loro cartelle cliniche .
* `GET /patients/{id}`: Restituisce i dettagli di un singolo paziente .
* `GET /patients/{id}/slices/{index}`: Permette di scaricare una delle 8 slice (indice da 0 a 7) come immagine PNG .

### Classificazione ed Elaborazione Referti

* `POST /patients/{id}/classify`: Avvia l'inferenza dell'IA (Modello I) sul paziente . Passando il parametro `force=true` è possibile ricalcolare i risultati .
* `POST /patients/{id}/report`: Compone la bozza del referto (Modello II) . Funziona solo se la classificazione è già stata completata .
* `GET /patients/{id}/coherence`: Esegue un controllo incrociato tra le patologie stimate e il testo del referto, evidenziando eventuali incongruenze .
* `PUT /patients/{id}/report`: Salva le modifiche manuali apportate dal medico al testo del referto .

### Validazione e Condivisione

* `POST /patients/{id}/validate`: Marca il referto come validato e vi appone la firma digitale (questa operazione è permessa solo agli utenti con il ruolo di `medico`) .
* `POST /patients/{id}/unvalidate`: Rimuove lo stato di validazione per consentire ulteriori modifiche (solo per i medici strutturati) .
* `GET /patients/{id}/export`: Permette di scaricare il referto definitivo in formato testo semplice (.txt) .

---

## Dettagli sul Modello I (Classificazione)

Il Modello I si occupa di stimare la probabilità di presenza di 4 patologie sulle immagini caricate . Utilizza un approccio a classificatori binari indipendenti: per ciascuna patologia viene eseguita una pipeline dedicata .

### Schema di elaborazione (per ciascuna classe)

```text
8 immagini TC del paziente
       │
       ▼
Preprocessing
(maschera circolare + tre finestre TC sovrapposte + CLAHE)
       │
       ▼
Encoder DenseNet-121 (inizializzato con pesi SimCLR)
       │
       ▼
Average Aggregator (mette insieme le caratteristiche delle 8 slice)
       │
       ▼
Classificatore (Fully Connected 256 → Dropout 0.3 → Fully Connected 1)
       │
       ▼
Funzione Sigmoide → Probabilità finale compresa tra 0 e 1

```

### Parametri e soglie delle classi

| Patologia | File dei Pesi | Soglia Decisionale |
| --- | --- | --- |
| **Blood** (Sanguinamento) | `model_I_blood_best.pth` | 0.5  |
| **Mass** (Effetto Massa) | `model_I_mass_best.pth` | 0.5  |
| **Edema** (Accumulo di Liquido) | `model_I_edema_best.pth` | 0.5  |
| **Ischemia** (Mancanza di Flusso) | `model_I_ischemia_best.pth` | 0.5  |

### Preprocessing delle immagini

Per garantire la precisione delle predizioni, ho replicato esattamente la pipeline di preprocessing utilizzata durante l'addestramento dei modelli :

* Applicazione di una **maschera circolare** per isolare la zona del cranio .
* Generazione di un'immagine a **3 canali** combinando tre diverse finestre CT (Brain Window, Blood Window e Stroke Window) .
* Miglioramento del contrasto locale tramite l'algoritmo **CLAHE** (clip limit 2.0) .
* Ridimensionamento delle slice a **224x224 pixel** con interpolazione bilineare .
* Normalizzazione standard basata sui valori di ImageNet .

I parametri di configurazione di ciascun modello sono letti dinamicamente dai file JSON salvati nella cartella `models_config/` .

---

## Dettagli sul Modello II (Refertazione)

Il Modello II genera il testo della bozza del referto operando attraverso **due fasi sequenziali** per garantire che il testo finale sia clinicamente inattaccabile e linguisticamente fluido:

1. **Generatore Rule-Based Strutturato**: Un motore basato su template che compila le sezioni (TECNICA, REPERTI, CONCLUSIONI, RACCOMANDAZIONI) in modo deterministico partendo dalle probabilità stimate dal Modello I. Questo assicura che non ci siano errori clinici e che la confidenza espressa (es. reperto "sospetto", "probabile" o "evidente") sia basata matematicamente sulle soglie decisionali.


2. **Rifinitura Linguistica LLM (Opzionale)**: Se abilitato tramite la chiave API (modello Claude Haiku), questo livello riscrive il testo generato dal primo motore per renderlo più naturale e leggibile. Le rigide regole di sistema (system prompt) vietano al modello generativo di aggiungere, rimuovere o falsificare i reperti positivi.


3. **Controllo di Coerenza di Sicurezza**: Il referto rifinito dall'LLM viene automaticamente sottoposto a un controllo diagnostico; se l'AI ha omesso o alterato inavvertitamente un referto presente nello scheletro iniziale, la modifica linguistica viene scartata e viene restituito il referto standard, garantendo assoluta precisione medica.



---

## Gestione di autenticazione e ruoli

L'accesso alle risorse è protetto tramite token JWT ed è previsto un controllo basato sui ruoli dell'utente :

* **medico**: Ha accesso completo a tutte le funzioni dell'applicazione, inclusa la firma e la validazione definitiva dei casi clinici 1, .
* **specializzando**: Può fare tutto (caricare pazienti, eseguire modelli, modificare bozze) tranne validare e firmare i referti 1, .

Le password degli utenti vengono memorizzate in modo sicuro nel database sotto forma di hash cifrati generati tramite la libreria `bcrypt` . Le password in chiaro non transitano mai oltre la fase di login/registrazione .

---

## Salvataggio delle immagini

Le immagini TC caricate dagli utenti non vengono salvate all'interno di MongoDB. Vengono salvate in formato **PNG lossless** (in scala di grigi per non alterare i valori di densità originari) all'interno del filesystem del server .
I file sono organizzati all'interno della cartella `storage/images/` in sottocartelle nominate con l'ID univoco del paziente (es. `storage/images/6684a1f2b3.../slice_0.png`) . Nel database MongoDB vengono salvati unicamente i percorsi relativi delle immagini 4, .

---

## Mappatura dei requisiti funzionali

Ho inserito questa lista per mostrare quale file o endpoint implementa ciascun requisito della tesi :

| Requisito | Descrizione | Endpoint Associato |
| --- | --- | --- |
| **RF1.1** | Creazione anagrafica paziente | `POST /patients`  |
| **RF1.2** | Caricamento delle 8 slice della TC | `POST /patients`  |
| **RF2.1-2.4** | Classificazione IA delle patologie | `POST /patients/{id}/classify`  |
| **RF3.1** | Generazione della bozza di referto | `POST /patients/{id}/report`  |
| **RF3.2** | Modifica del testo del referto | `PUT /patients/{id}/report`  |
| **RF3.4** | Salvataggio delle modifiche al referto | `PUT /patients/{id}/report`  |
| **RF4.1** | Controllo di coerenza referto-findings | `GET /patients/{id}/coherence`  |
| **RF5.1** | Visualizzazione delle slice | `GET /patients/{id}/slices/{i}`  |
| **RF5.2** | Navigazione tra le fette della TC | `GET /patients/{id}/slices/{i}`  |
| **RF5.3** | Validazione e firma del caso (solo medici) | `POST /patients/{id}/validate`  |
| **RF6.1** | Lista dei pazienti e storico | `GET /patients`  |
| **RF6.2** | Esportazione del referto in formato testo | `GET /patients/{id}/export`  |
| **RNF6.1** | Tempo di risposta per la refertazione | `POST /patients/{id}/report`  |
| **RNF6.2** | Tempo di risposta per la classificazione | `POST /patients/{id}/classify`  |
| **RNF7.1** | Endpoint di diagnostica e health check | `GET /health`  |