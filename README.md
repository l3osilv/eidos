# Eidos

Repository dell'applicazione **Eidos**, sistema di supporto alla refertazione neuroradiologica sviluppato per la tesi di laurea triennale in Informatica presso l'Università degli Studi di Trento.

**Autore:** Leonardo Silvestri  

---

## Descrizione del progetto

L'applicazione web assiste medici e specializzandi nell'analisi delle TC all'encefalo. Il sistema si articola in tre componenti principali:

- **Modello I (classificazione):** basato su DenseNet-121 con pre-addestramento SimCLR (adattato dal progetto di ricerca [SSL-BrainCT-Pathology](https://github.com/meridtesfay/SSL-BrainCT-Pathology)). Analizza le 8 slice della TC e stima la probabilità di presenza di 4 patologie: *Blood* (emorragia), *Ischemia* (infarto cerebrale acuto), *Edema* (edema cerebrale) e *Mass* (massa espansiva).
- **Modello II (generatore di referti):** elabora le stime del modello I e compone in modo deterministico e trasparente una bozza di referto testuale strutturata, con rifinitura linguistica opzionale.
- **Interfaccia web (frontend):** single-page application in React e TypeScript con visualizzatore in stile PACS per le slice TC, pannello dei reperti ed editor per la modifica, la verifica di coerenza e la validazione del referto.

---

## Guida rapida all'avvio

### Prerequisiti
- **Python** 3.11 o superiore
- **Node.js** 18 o superiore
- **MongoDB** attivo (per la configurazione via Docker consultare [`backend/mongodb_setup/setup_mongodb.md`](backend/mongodb_setup/setup_mongodb.md))

### Avvio del backend
Dalla cartella del backend, creare l'ambiente virtuale, installare le dipendenze e avviare il server FastAPI con Uvicorn:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  
uvicorn main:app --reload --port 8000
```
La documentazione interattiva OpenAPI/Swagger è disponibile su `http://localhost:8000/docs`.

### Avvio del frontend
In un terminale separato, spostarsi nella cartella del frontend, installare i pacchetti npm e avviare il server Vite:

```bash
cd frontend
npm install
npm run dev
```
L'applicazione è accessibile all'indirizzo `http://localhost:5173`.

---

## Struttura del repository

```text
eidos/
├── backend/    # Server FastAPI e modelli
├── frontend/   # Interfaccia web React
└── docs/       # Documentazione e schemi
```
