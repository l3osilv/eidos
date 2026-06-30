# MedicinAI — BrainCT

Sistema di supporto alla refertazione neuroradiologica sviluppato come progetto di tesi triennale in Informatica presso l'Università di Trento.

**Autore:** Leonardo Silvestri   
---

## Descrizione

Applicazione web clinica che assiste medici radiologi e specializzandi nell'analisi di esami TC encefalo. Il sistema integra:

- **Modello I** — classificazione automatica di 5 classi patologiche (Blood, Ischemia, Chronic Ischemia, Edema, Mass) tramite DenseNet-121 con pretraining SimCLR ([repo SSL-BrainCT-Pathology](https://github.com/meridtesfay/SSL-BrainCT-Pathology))
- **Modello II** — generazione rule-based di una bozza di referto testuale strutturato a partire dai findings del Modello I
- **Frontend** — interfaccia web React/TypeScript con visualizzatore PACS, pannello findings e editor di refertazione

---

## Avvio rapido

### Prerequisiti
- Python 3.11+
- Node.js 18+
- MongoDB (Docker o nativo — vedi [`docs/setup_mongodb.md`](docs/setup_mongodb.md))

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt  
uvicorn main:app --reload --port 8000
```

Documentazione API interattiva: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Apri `http://localhost:5173` nel browser.

---

## Documentazione

| File | Contenuto |
|---|---|
| [`docs/architettura_e_requisiti.md`](docs/architettura_e_requisiti.md) | User stories, flussi end-to-end, decisioni architetturali, tracciabilità RF |
| [`docs/guida_tecnica_backend.md`](docs/guida_tecnica_backend.md) | Stack tecnologico, integrazione Modello I/II, endpoint API, checklist pre-consegna |
| [`docs/setup_mongodb.md`](docs/setup_mongodb.md) | Setup MongoDB (Docker e nativo), configurazione `.env`, inizializzazione DB |
| [`spiegazione_SSL_BrainCT_Pathology.md`](spiegazione_SSL_BrainCT_Pathology.md) | Metodologia SSL del progetto di ricerca di riferimento (Stage 1 e Stage 2) |

---

## Struttura del progetto

```
medicinAI-brainCT/
├── backend/
│   ├── main.py          # app FastAPI, tutti gli endpoint
│   ├── auth.py          # JWT, hashing, controllo ruoli
│   ├── database.py      # connessione MongoDB (motor async)
│   ├── schemas.py       # modelli Pydantic
│   ├── storage.py       # lettura/scrittura immagini su disco
│   ├── model_I.py       # classificazione (DenseNet-121 + SimCLR)
│   └── model_II.py      # generazione referto (rule-based)
├── frontend/
│   └── src/
│       ├── pages/       # Dashboard, PatientDetail, NewPatient, Profile
│       └── components/  # PacsViewer, FindingsPanel, ReportEditor, ...
├── docs/                # documentazione tecnica
└── mongodb_setup/       # docker-compose.yml e .env.example
```
