# MedicinAI — Frontend

Questa cartella contiene il codice del frontend di **MedicinAI-BrainCT** (che ho chiamato **NeuroReport**). Si tratta di una Single Page Application (SPA) realizzata per simulare l'interfaccia di una workstation radiologica per l'analisi delle TC all'encefalo.

L'applicazione permette ai medici e agli specializzandi di visualizzare lo storico dei pazienti, caricare nuovi esami, scorrere le slice delle immagini, visualizzare le predizioni dell'IA ed editare/validare il referto generato in automatico.

---

## Tecnologie utilizzate

Ho scelto di sviluppare l'interfaccia utilizzando queste tecnologie:

- **Core**: React 19 e TypeScript (per avere un codice tipizzato e ridurre gli errori a runtime).
- **Build System**: Vite (per un caricamento ultra-veloce in fase di sviluppo e per creare pacchetti ottimizzati per la produzione).
- **Styling**: Tailwind CSS v4 (per realizzare una UI pulita, minimale e in stile clinico).
- **Icone**: Lucide-React.
- **Routing**: Un piccolo sistema di routing interno personalizzato, scritto da me per non appesantire il caricamento con librerie esterne.

---

## Come ho organizzato il codice e ottimizzazioni

Durante lo sviluppo ho cercato di strutturare il codice in modo ordinato ed efficiente, implementando alcune ottimizzazioni per migliorare l'esperienza d'uso:

1. **Richieste API semplificate (`authFetch`):**
   Invece di dover includere manualmente i token JWT in ogni richiesta HTTP ed implementare la gestione degli errori per ogni chiamata, in `api.ts` ho creato una funzione helper chiamata `authFetch()`. Questa funzione si occupa in automatico di aggiungere l'header di autorizzazione e intercettare gli errori di sessione scaduta (401) o permessi insufficienti (403).

2. **Caricamento parallelo delle slice (`Promise.all`):**
   All'interno del visualizzatore (`PacsViewer.tsx`), per evitare che le 8 immagini della TC vengano caricate una alla volta in modo sequenziale rallentando la pagina, ho usato `Promise.all` per effettuare le richieste parallele e caricare l'intero esame molto più velocemente.

3. **Ottimizzazione della memoria:**
   Ho rimosso la logica che ricreava inutilmente oggetti e stili condizionali (come i colori dei badge per lo stato del paziente) ad ogni render di React, posizionandoli come costanti a livello di modulo. Questo rende la navigazione della UI più reattiva e alleggerisce il lavoro del browser.

4. **Rimozione del codice inutilizzato:**
   Ho tenuto il file `package.json` pulito, rimuovendo tutte le librerie esterne non necessarie (es. pacchetti pesanti di animazione) a favore di componenti React leggeri e scritti direttamente.

---

## Struttura delle cartelle

```
frontend/
├── src/
│   ├── api.ts              # Funzioni per dialogare con il backend FastAPI
│   ├── types.ts            # Tipi e interfacce TypeScript (Patient, User, Findings)
│   ├── App.tsx             # Componente radice dell'app e gestione delle rotte protette
│   ├── router.tsx          # Gestore per la navigazione all'interno dell'app
│   ├── index.css           # Configurazione di Tailwind e stili globali
│   ├── main.tsx            # Punto di ingresso di React
│   │
│   ├── components/         # Componenti dell'interfaccia utente
│   │   ├── Header.tsx           # Barra superiore con il menu e logout
│   │   ├── LoadingNotice.tsx    # Schermata di caricamento per l'inferenza dell'IA
│   │   ├── PacsViewer.tsx       # Componente per scorrere le 8 slice TC
│   │   ├── FindingsPanel.tsx    # Schermata dei risultati del Modello I (IA)
│   │   ├── ReportEditor.tsx     # Campo di testo del referto Modello II con tasto di export
│   │   ├── CoherenceAlert.tsx   # Messaggio che segnala discrepanze testo/reperti
│   │   └── LoginForm.tsx        # Schermata di login e registrazione utenti
│   │
│   └── pages/              # Schermate principali dell'applicazione
│       ├── Dashboard.tsx        # Lista dei pazienti inseriti con i filtri
│       ├── PatientDetail.tsx    # Schermata di lavoro (Visualizzatore + Editor referti)
│       ├── NewPatient.tsx       # Modulo per inserire un nuovo paziente e caricare le 8 immagini
│       ├── Profile.tsx          # Gestione dei dati del medico e della firma
│       ├── Login.tsx            # Schermata di accesso
│       └── Register.tsx         # Schermata di registrazione
```

---

## Funzionalità principali

- **Accesso protetto e gestione ruoli:** L'interfaccia si adatta a seconda del ruolo dell'utente (*Medico* o *Specializzando*). Solo i medici strutturati hanno abilitato il pulsante per firmare e validare definitivamente un referto.
- **Dashboard Pazienti:** Tabella che permette di monitorare tutti i casi inseriti nel sistema e di vedere subito il loro stato nel workflow (es. caricato, refertato, validato).
- **Visualizzatore delle Slice (PacsViewer):** Un modulo che simula i visualizzatori clinici reali, consentendo di scorrere le 8 slice TC utilizzando la tastiera o la filmstrip laterale.
- **Pannello dei Findings dell'IA:** Mostra a schermo i risultati della classificazione del Modello I, con barre di probabilità colorate a seconda che superino o meno la soglia clinica.
- **Editor Referti e Controllo Coerenza:** Permette di visualizzare la bozza generata dal Modello II e di modificarla. Se il medico rimuove manualmente una patologia che l'IA ha rilevato come positiva, l'applicazione mostra un avviso visivo di incoerenza.
- **Esportazione in formato testo:** Permette di esportare il referto finale firmato in un file di testo piatto (.txt) pronto per essere salvato in locale o copiato in altri sistemi ospedalieri.

---

## Esecuzione Locale (Sviluppo)

Prima di avviare il frontend, assicurati che il backend di FastAPI sia attivo sulla porta `8000` (`http://localhost:8000`), altrimenti le chiamate API restituiranno errore.

```bash
# 1. Spostati nella cartella del frontend
cd frontend

# 2. Installa le dipendenze npm
npm install

# 3. Avvia il server di sviluppo con Vite
npm run dev
```

Una volta avviato, apri il browser all'indirizzo `http://localhost:5173`.

---

## Build per la Produzione

Se vuoi generare il pacchetto statico ottimizzato e minimizzato da caricare su un server web (es. Nginx):

```bash
npm run build
```
