# Eidos — Eidos

Questo repository contiene il codice di **Eidos**, un sistema di supporto alla refertazione neuroradiologica che ho sviluppato come progetto per la mia tesi triennale in Informatica presso l'Università di Trento.

**Autore:** Leonardo Silvestri  

---

## Di cosa si tratta

Il progetto consiste in un'applicazione web pensata per assistere i medici radiologi e gli specializzandi durante l'analisi delle TC all'encefalo. Il sistema si compone di tre parti principali:

- **Modello I (Classificazione):** Un modello basato su DenseNet-121 con pre-addestramento SimCLR (adattato dalla repository [SSL-Eidos-Pathology](https://github.com/meridtesfay/SSL-Eidos-Pathology)) che analizza 8 slice della TC e stima la probabilità di presenza per 4 patologie: Blood (sanguinamento/emorragia), Ischemia (infarto cerebrale acuto), Edema (accumulo di liquidi) e Mass (effetto massa).
- **Modello II (Generatore di referti):** Un modulo rule-based scritto da me che prende i risultati del Modello I e genera in automatico una bozza di referto testuale strutturata.
- **Interfaccia Web (Frontend):** Una UI realizzata in React e TypeScript che include un visualizzatore stile PACS per scorrere le slice della TC, un pannello con le probabilità stimate dall'IA e un editor per correggere e validare il referto.

---

## Come avviarlo velocemente

### Prerequisiti
Prima di partire, verifica di avere installato:
- Python 3.11 o superiore
- Node.js 18 o superiore
- MongoDB attivo (se preferisci usare Docker, trovi la guida in [`backend/mongodb_setup/setup_mongodb.md`](backend/mongodb_setup/setup_mongodb.md))

### Avvio del Backend
Spostati nella cartella del backend, crea l'ambiente virtuale, installa le dipendenze e lancia il server FastAPI con Uvicorn:

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt  
uvicorn main:app --reload --port 8000
```
Una volta avviato, puoi consultare la documentazione delle API (Swagger) su: `http://localhost:8000/docs`

### Avvio del Frontend
In un altro terminale, spostati nella cartella del frontend, installa i pacchetti npm e lancia il server di sviluppo Vite:

```bash
cd frontend
npm install
npm run dev
```
Ora puoi aprire l'applicazione nel browser all'indirizzo `http://localhost:5173`.

---

## Struttura del progetto

Ecco come ho organizzato i file principali del progetto:

```
medicinAI-brainCT/
├── backend/    # python
├── frontend/   # react vite 
└── docs/                
```
