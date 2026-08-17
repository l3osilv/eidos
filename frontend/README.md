# Eidos: frontend

Questa cartella contiene il codice del frontend di **Eidos**, single-page application sviluppata in React 19 e TypeScript per visualizzare e refertare le TC cerebrali in ambiente ospedaliero simulato.

L'interfaccia consente a medici e specializzandi di consultare l'elenco dei pazienti, inserire nuovi casi con le relative 8 slice tomografiche, visualizzare le predizioni del modello di classificazione e redigere, modificare e firmare digitalmente il referto clinico.

---

## Tecnologie utilizzate

- **Framework e linguaggio:** React 19 e TypeScript
- **Strumento di build:** Vite
- **Stile grafico:** Tailwind CSS v4
- **Icone:** lucide-react
- **Navigazione:** router client-side nativo basato sulla Web History API, senza librerie esterne

---

## Organizzazione del codice e ottimizzazioni

Scelte di sviluppo e gestione delle risorse:

1. **Chiamate alle API protette (`authFetch`):**
   La funzione helper `authFetch()` in `api.ts` inserisce automaticamente l'header di autorizzazione con il token JWT e intercetta gli errori di sessione scaduta (HTTP 401) o permessi insufficienti (HTTP 403).

2. **Caricamento parallelo delle slice (`Promise.all`):**
   Nel componente `PacsViewer.tsx`, le 8 immagini della TC vengono scaricate contemporaneamente tramite `Promise.all()` per ridurre i tempi di attesa.

3. **Gestione della memoria e prevenzione memory leak:**
   I blob delle immagini tomografiche convertiti in URL temporanei (`URL.createObjectURL`) vengono esplicitamente revocati (`URL.revokeObjectURL`) allo smontaggio del componente tramite hook `useEffect`, liberando la memoria RAM del browser.

4. **Dipendenze essenziali:**
   Il file `package.json` include esclusivamente i pacchetti necessari all'applicazione, evitando librerie ridondanti.

---

## Struttura delle cartelle

```text
frontend/
├── src/
│   ├── api.ts              # chiamate HTTP al backend FastAPI
│   ├── types.ts            # interfacce e tipi TypeScript (Patient, User, Findings)
│   ├── App.tsx             # componente principale e gestione delle rotte
│   ├── router.tsx          # router client-side nativo
│   ├── index.css           # stili globali e configurazione Tailwind CSS
│   ├── main.tsx            # punto di ingresso dell'applicazione React
│   │
│   ├── components/         # componenti UI riutilizzabili
│   │   ├── Header.tsx           # intestazione e menu utente
│   │   ├── LoadingNotice.tsx    # indicatore di caricamento
│   │   ├── PacsViewer.tsx       # visualizzatore delle 8 slice TC
│   │   ├── FindingsPanel.tsx    # pannello dei reperti del modello I
│   │   ├── ReportEditor.tsx     # editor del referto (modello II)
│   │   ├── CoherenceAlert.tsx   # segnalazione di incongruenze tra reperti e testo
│   │   └── LoginForm.tsx        # form di login e registrazione
│   │
│   └── pages/              # schermate dell'applicazione
│       ├── Home.tsx             # landing page introduttiva e accesso
│       ├── Dashboard.tsx        # elenco dei pazienti e filtri di ricerca
│       ├── PatientDetail.tsx    # scheda del paziente con visualizzatore ed editor
│       ├── NewPatient.tsx       # inserimento nuovo paziente e upload delle immagini
│       ├── Profile.tsx          # gestione del profilo utente
│       ├── Login.tsx            # pagina di autenticazione
│       └── Register.tsx         # pagina di registrazione account
```

---

## Funzionalità principali

- **Autenticazione e ruoli:** l'interfaccia distingue tra *medico strutturato* e *specializzando*. La validazione formale e l'apposizione della firma digitale sono riservate ai medici strutturati.
- **Dashboard dei pazienti:** tabella per monitorare l'avanzamento degli esami (da analizzare, analizzato, refertato, validato) con filtri per stato e ricerca testuale.
- **Visualizzatore delle slice (PacsViewer):** componente per scorrere le 8 slice assiali tramite tastiera, pulsanti o miniature dedicate.
- **Pannello dei reperti:** visualizza i punteggi di probabilità stimati dal modello I con evidenziazione delle soglie di decisione.
- **Editor del referto e controllo di coerenza:** consente la modifica manuale della bozza e avvisa il medico se viene cancellata la descrizione di una patologia rilevata come positiva.
- **Esportazione del referto:** consente di scaricare il documento clinico finale in formato testo (`.txt`).

---

## Esecuzione locale in ambiente di sviluppo

Prima di avviare il frontend, verificare che il server backend sia attivo sulla porta `8000` (`http://localhost:8000`).

```bash
# 1. Spostarsi nella cartella del frontend
cd frontend

# 2. Installare le dipendenze npm
npm install

# 3. Avviare il server di sviluppo Vite
npm run dev
```

L'applicazione sarà accessibile all'indirizzo `http://localhost:5173`.

---

## Build di produzione

Per compilare i file statici ottimizzati per l'ambiente di produzione:

```bash
npm run build
```
