# MedicinAI - Frontend Clinico (NeuroReport)

Questo modulo contiene l'interfaccia utente web-based (Single Page Application) del progetto **MedicinAI BrainCT**. 
Il frontend simula una workstation clinica radiologica moderna, integrando un visualizzatore PACS per le scansioni assiali, una dashboard per il registro pazienti e un editor avanzato per la stesura assistita dei referti neuroradiologici.

## Stack Tecnologico

Il progetto è stato sviluppato con tecnologie moderne, ottimizzato per garantire reattività, sicurezza dei dati (tipizzazione) e pulizia architetturale:

* **Core**: React 19 + TypeScript.
* **Build System**: Vite (per un HMR ultra-veloce e bundle ottimizzati).
* **Styling**: Tailwind CSS v4 (design system clinico minimale e accessibile).
* **Iconografia**: Lucide-React per un set di icone chiare e professionali.
* **Routing**: Sistema di routing minimale custom per SPA senza dipendenze esterne pesanti.

---

## Architettura e Clean Code

Il codice è stato sottoposto a una profonda revisione "Senior-level" focalizzata su efficienza e manutenibilità:

1. **Gestione del Network (Zero Boilerplate)**:
   Le chiamate API in `api.ts` sono incapsulate in un helper asincrono `authFetch()`. Questa astrazione gestisce in automatico l'invio del token JWT e l'intercettazione degli errori (es. *401 Unauthorized*, *403 Forbidden*), riducendo ogni endpoint API a un pulito *one-liner*.

2. **Parallelizzazione I/O**:
   I componenti che richiedono asset pesanti (es. `PacsViewer.tsx`) sfruttano il mapping parallelo (`Promise.all`) per caricare simultaneamente la filmstrip delle slice, abbattendo drasticamente i tempi di rendering iniziale rispetto al caricamento sequenziale.

3. **Memory Optimization**:
   Eliminato l'anti-pattern che ricrea costanti e stili di mappa ad ogni re-render. Gli stili condizionali (come i badge dei _Findings_) sono statici a livello di modulo JavaScript per conservare cicli di garbage collection preziosi durante la navigazione della UI.

4. **Zero Dead Code**:
   Le dipendenze NPM sono strettamente ridotte a quelle necessarie per il build (rimossi pacchetti pesanti di animazione, mock server o utility ridondanti). Le prop di configurazione React e gli strati di context superflui sono stati rimossi a favore di una gestione dello stato lineare e controllata.

---

## Struttura della Directory

```text
frontend/
├── src/
│   ├── api.ts              # Interfaccia di comunicazione con il Backend FastAPI
│   ├── types.ts            # Definizioni globali delle interfacce TypeScript (Patient, User, Findings)
│   ├── App.tsx             # Root Component e Auth Guard
│   ├── router.tsx          # Motore di navigazione interno lightweight
│   ├── index.css           # Token Tailwind e stili globali (es. scrollbar clinica)
│   ├── main.tsx            # Entry point React
│   │
│   ├── components/         # Componenti riutilizzabili dell'UI
│   │   ├── Header.tsx           # Barra di navigazione utente e logout
│   │   ├── LoadingNotice.tsx    # Animazione di scansione e waiting state
│   │   ├── PacsViewer.tsx       # Simulatore di navigazione assiale immagini TC
│   │   ├── FindingsPanel.tsx    # Risultati del Modello I (barre di confidenza)
│   │   ├── ReportEditor.tsx     # Area di stesura del referto Modello II con export
│   │   ├── CoherenceAlert.tsx   # Badge di avviso disallineamento testo/reperti
│   │   └── LoginForm.tsx        # Schermata unificata login/registrazione personale
│   │
│   └── pages/              # Viste principali (agganciate al router)
│       ├── Dashboard.tsx        # Registro pazienti (Tabella e Filtri)
│       ├── PatientDetail.tsx    # Workspace clinico integrato (Visualizzatore + Editor)
│       ├── NewPatient.tsx       # Form anagrafica + drag&drop 8 slices
│       ├── Profile.tsx          # Gestione identità e firma digitale medico
│       ├── Login.tsx            # Wrapper Page Login
│       └── Register.tsx         # Wrapper Page Registrazione
```

---

## Funzionalità Cliniche Principali

* **Accesso Riservato Role-based**: Differenziazione UI in base alla qualifica (*Medico Strutturato* vs *Specializzando*). Solo lo Strutturato ha le permission di validare (apporre firma digitale) il referto finale.
* **Registro Pazienti (Dashboard)**: Sistema di filtraggio rapido e tracking visivo per capire a colpo d'occhio quali pazienti devono essere ancora elaborati dall'AI e quali sono refertati/validati.
* **Visualizzatore "RIS/PACS" (PacsViewer)**: Interfaccia dedicata alla navigazione slice-by-slice di un esame TC Assiale, con pre-fetching parallelo e filmstrip dedicata per una review rapida e precisa.
* **Findings Assestment & Coerenza**: Visualizzazione dei risultati del modello computazionale sui tessuti patologici (Modello I), calcolati come percentuali di probabilità rispetto alle soglie cliniche decisionali.
* **Workflow Refertazione LaTeX-style (ReportEditor)**: Generazione di una bozza di testo standardizzata (Modello II) che può essere modificata a mano e costantemente controllata in tempo reale dal check di *Coerenza Semantica* (evidenzia discrepanze tra reperti AI e testo inserito dal medico).
* **Export PDF/TXT**: Funzionalità di scaricamento immediato del referto validato in file testuale piatto, adatto all'incollaggio su sistemi legacy ospedalieri.

---

## Esecuzione Locale (Sviluppo)

Assicurati che il backend (FastAPI) sia già in esecuzione sulla porta `8000` (`http://localhost:8000`), poiché le chiamate API nel frontend puntano per default a questa route.

```bash
# 1. Spostati nella cartella frontend
cd frontend

# 2. Installa le dipendenze
npm install

# 3. Avvia il server di sviluppo (Vite)
npm run dev
```

Il progetto sarà esposto su `http://localhost:3000`.

## Build (Produzione)

Per generare il bundle statico minimizzato (per deploy su Vercel, Netlify, o Nginx):

```bash
npm run build
```
