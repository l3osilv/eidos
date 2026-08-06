# Eidos

Questo repository contiene il codice di **Eidos**, un sistema di supporto alla refertazione neuroradiologica sviluppato come progetto per la tesi triennale in Informatica presso l'Università di Trento.

**Autore:** Leonardo Silvestri  

---

## Descrizione del progetto

L'applicazione web è progettata per assistere radiologi e specializzandi durante l'analisi delle TC all'encefalo. Il sistema si articola in tre componenti principali:

- **Modello I (Classificazione):** Modello basato su DenseNet-121 con pre-addestramento SimCLR (adattato dalla repository [SSL-BrainCT-Pathology](https://github.com/meridtesfay/SSL-BrainCT-Pathology)) che analizza le 8 slice della TC e stima la probabilità di presenza di 4 patologie: *Blood* (emorragia), *Ischemia* (infarto cerebrale acuto), *Edema* (edema cerebrale) e *Mass* (massa espansiva).
- **Modello II (Generatore di referti):** Modulo che elabora le stime del Modello I e compone automaticamente una bozza di referto testuale strutturata.
- **Interfaccia Web (Frontend):** UI in React e TypeScript comprensiva di visualizzatore in stile PACS per la consultazione delle slice TC, pannello dei risultati ed editor per la modifica e validazione del referto.

---

## Guida rapida all'avvio

### Prerequisiti
Assicurarsi di avere installato:
- **Python** 3.11 o superiore
- **Node.js** 18 o superiore
- **MongoDB** attivo (per la configurazione via Docker consultare [`backend/mongodb_setup/setup_mongodb.md`](backend/mongodb_setup/setup_mongodb.md))

### Avvio del Backend
Dalla cartella del backend, crea l'ambiente virtuale, installa le dipendenze e avvia il server FastAPI con Uvicorn:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  
uvicorn main:app --reload --port 8000
```
La documentazione interattiva OpenAPI/Swagger è disponibile su `http://localhost:8000/docs`.

### Avvio del Frontend
In una nuova finestra di terminale, spostati nella cartella del frontend, installa i pacchetti npm e avvia il server Vite:

```bash
cd frontend
npm install
npm run dev
```
L'applicazione è accessibile dal browser su `http://localhost:5173`.

---

## Struttura del progetto

```text
eidos/
├── backend/    # Server FastAPI e modelli di IA
├── frontend/   # Interfaccia web React (Vite)
└── docs/       # Documentazione e schemi
```
