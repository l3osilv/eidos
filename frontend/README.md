# Eidos — Frontend

Questa cartella contiene il codice del frontend di **Eidos**. È una Single Page Application (SPA) sviluppata per simulare l'interfaccia di una workstation radiologica per l'analisi delle TC all'encefalo.

L'applicazione permette a medici e specializzandi di consultare lo storico dei pazienti, registrare nuovi esami, visualizzare le slice TC, esaminare le stime dei modelli e modificare o convalidare i referti.

---

## Tecnologie utilizzate

L'interfaccia è sviluppata con le seguenti tecnologie:

- **Core**: React 19 e TypeScript.
- **Build System**: Vite.
- **Styling**: Tailwind CSS v4.
- **Icone**: Lucide-React.
- **Routing**: Sistema di routing client-side essenziale per la gestione delle pagine senza librerie esterne.

---

## Organizzazione del codice e ottimizzazioni

Durante lo sviluppo sono state adottate alcune soluzioni per mantenere il codice pulito ed efficiente:

1. **Gestione centrale delle chiamate API (`authFetch`):**
   La funzione helper `authFetch()` in `api.ts` gestisce l'inserimento dell'header di autenticazione JWT e intercetta automaticamente gli errori di sessione scaduta (401) o permessi insufficienti (403).

2. **Caricamento ottimizzato delle slice (`Promise.all`):**
   Nel componente `PacsViewer.tsx`, le 8 immagini della TC vengono caricate in parallelo tramite `Promise.all` per ridurre i tempi di attesa.

3. **Gestione efficiente dello stato e delle costanti:**
   Gli oggetti di configurazione e le mappature condizionali sono definiti a livello di modulo anziché ricreati ad ogni render di React, per alleggerire l'esecuzione del browser.

4. **Dipendenze essenziali:**
   Il file `package.json` include esclusivamente le librerie necessarie, evitando dipendenze ridondanti.

---

## Struttura delle cartelle

```text
frontend/
├── src/
│   ├── api.ts              # Chiamate API al backend FastAPI
│   ├── types.ts            # Tipi e interfacce TypeScript (Patient, User, Findings)
│   ├── App.tsx             # Componente principale e gestione autenticazione/rotte
│   ├── router.tsx          # Gestione navigazione client-side
│   ├── index.css           # Stili globali e Tailwind CSS
│   ├── main.tsx            # Entrypoint di React
│   │
│   ├── components/         # Componenti UI
│   │   ├── Header.tsx           # Barra superiore e navigazione utente
│   │   ├── LoadingNotice.tsx    # Indicatore di caricamento
│   │   ├── PacsViewer.tsx       # Visualizzatore delle 8 slice TC
│   │   ├── FindingsPanel.tsx    # Pannello risultati del Modello I
│   │   ├── ReportEditor.tsx     # Editor per il testo del referto (Modello II)
│   │   ├── CoherenceAlert.tsx   # Segnalazione discrepanze tra reperti e testo
│   │   └── LoginForm.tsx        # Moduli di login e registrazione
│   │
│   └── pages/              # Pagine principali
│       ├── Dashboard.tsx        # Elenco dei pazienti e filtri di ricerca
│       ├── PatientDetail.tsx    # Scheda paziente (Visualizzatore + Editor)
│       ├── NewPatient.tsx       # Modulo inserimento paziente e caricamento slice
│       ├── Profile.tsx          # Gestione profilo utente
│       ├── Login.tsx            # Pagina di accesso
│       └── Register.tsx         # Pagina di registrazione
```

---

## Funzionalità principali

- **Autenticazione e gestione ruoli:** L'interfaccia si adatta al ruolo dell'utente (*Medico Strutturato* o *Specializzando*). La validazione e firma finale del referto è abilitata esclusivamente per i medici strutturati.
- **Dashboard Pazienti:** Elenco che consente di monitorare lo stato di avanzamento degli esami (da analizzare, analizzato, refertato, validato).
- **Visualizzatore Slice (PacsViewer):** Modulo per scorrere le 8 slice assiali tramite tastiera o miniatura.
- **Pannello Reperti:** Mostra i risultati di classificazione del Modello I con indicazione delle soglie decisionali.
- **Editor Referti e Controllo Coerenza:** Consente di modificare la bozza generata e avvisa il medico in caso di discrepanze tra reperti rilevati e testo salvato.
- **Esportazione in formato testo:** Permette di esportare il referto finale in un file `.txt`.

---

## Esecuzione Locale (Sviluppo)

Prima di avviare il frontend, verificare che il backend sia attivo sulla porta `8000` (`http://localhost:8000`).

```bash
# 1. Spostati nella cartella del frontend
cd frontend

# 2. Installa le dipendenze npm
npm install

# 3. Avvia il server di sviluppo Vite
npm run dev
```

L'applicazione sarà accessibile all'indirizzo `http://localhost:5173`.

---

## Build di Produzione

Per generare i file statici ottimizzati per la produzione:

```bash
npm run build
```
