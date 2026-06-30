# User Stories, Flussi di Processo e Architettura — Sistema di Supporto alla Refertazione Neuroradiologica

## Premessa didattica

Questo documento ha un duplice scopo: documentare formalmente il comportamento del sistema attraverso user stories tracciabili ai requisiti, e spiegare il **perché** delle scelte architetturali — non solo il *cosa* fa il sistema, ma il ragionamento ingegneristico dietro ogni decisione. È il tipo di documento che, in un contesto professionale, accompagna un sistema software per permettere a un nuovo membro del team (o a una commissione di tesi) di capire non solo come funziona, ma perché è stato costruito così.

Le user stories seguono il formato standard `Come <ruolo>, voglio <azione>, in modo da <beneficio>`, con criteri di accettazione espliciti e tracciabilità verso i requisiti funzionali (RF) e non funzionali (RNF) definiti in `requisiti_progetto.md`.

---

## Parte 1 — User Stories

### Epic 1: Autenticazione e gestione ruoli

**US-1.1**
> Come medico o specializzando, voglio autenticarmi con username e password, in modo da accedere alle funzionalità del sistema in modo sicuro e identificabile.

Criteri di accettazione:
- Il sistema rifiuta credenziali errate con un messaggio chiaro (401), senza specificare se è lo username o la password a essere sbagliato (principio di sicurezza: non facilitare attacchi di enumerazione utenti)
- Il token di sessione ha una scadenza (8 ore), dopo la quale è necessario un nuovo login
- Il ruolo (medico/specializzando) è incluso nel token, non richiede una query separata al database a ogni richiesta successiva

Requisiti collegati: gestione utenti (non in RF originali, requisito emerso durante lo sviluppo).

---

**US-1.2**
> Come medico, voglio essere l'unico ruolo che può validare definitivamente un referto, in modo da garantire che la responsabilità clinica finale resti in capo a personale qualificato, anche quando uno specializzando ha preparato il caso.

Criteri di accettazione:
- Un tentativo di validazione da parte di uno specializzando riceve un errore 403 (Forbidden), non un errore generico
- Il frontend deve nascondere o disabilitare il pulsante di validazione per chi non ha il ruolo richiesto, ma il backend **deve comunque applicare il controllo** — il frontend è una comodità UX, non un meccanismo di sicurezza

Requisiti collegati: RF5.3.

Nota didattica: questo è un esempio del principio "non fidarsi mai del client". Anche se il frontend nasconde un bottone, niente impedisce a un utente di chiamare l'API direttamente (con `curl`, Postman, o un frontend modificato). Il controllo di autorizzazione deve sempre vivere nel backend.

---

### Epic 2: Gestione del caso clinico

**US-2.1**
> Come medico, voglio caricare i dati anagrafici di un paziente insieme alle 8 slice della sua TAC, in modo da iniziare un nuovo caso clinico nel sistema.

Criteri di accettazione:
- Se vengono caricate meno o più di 8 immagini, il sistema rifiuta la richiesta (400) con un messaggio che indica esattamente quante ne sono state ricevute
- Se uno dei file caricati non è un'immagine valida (es. un PDF rinominato `.jpg`), il sistema lo segnala specificando quale file è problematico
- Il paziente non viene creato nel database finché la validazione dei file non è completata — non deve esistere un paziente "a metà" con immagini mancanti

Requisiti collegati: RF1.1, RF1.2.

---

**US-2.2**
> Come medico o specializzando, voglio vedere lo storico dei pazienti caricati, in modo da riprendere un caso lasciato in sospeso o consultare casi precedenti.

Criteri di accettazione:
- La lista mostra lo stato di avanzamento di ciascun caso (caricato / classificato / referto generato / validato) senza dover apre ogni singolo paziente
- L'ordinamento di default è per data di creazione

Requisiti collegati: RF6.1.

---

**US-2.3**
> Come medico, voglio scorrere le 8 slice di un paziente una per una, in modo da ispezionare visivamente l'esame prima di fidarmi dei findings automatici.

Criteri di accettazione:
- Le slice sono accessibili singolarmente (non tutte scaricate insieme), per non appesantire il caricamento della pagina
- L'ordine delle slice è preservato esattamente come caricato, non riordinato

Requisiti collegati: RF5.1, RF5.2.

---

### Epic 3: Classificazione automatica (Modello I)

**US-3.1**
> Come medico, voglio ottenere automaticamente le probabilità di presenza di ciascuna patologia (Blood, Ischemia, Edema, Mass), in modo da avere un secondo parere quantitativo prima di scrivere il referto.

Criteri di accettazione:
- Per ogni classe viene mostrata la probabilità numerica esatta, non solo un'etichetta binaria — un medico deve poter giudicare quanto il sistema è "sicuro", non solo cosa ha deciso
- Se nessuna classe supera la propria soglia, il sistema lo comunica esplicitamente come "esame negativo", non lasciando un elenco vuoto ambiguo
- Le classi per cui non esiste ancora un modello allenato (es. Chronic_Ischemia, se non disponibile) semplicemente non appaiono — il sistema non finge di avere un'opinione che non ha

Requisiti collegati: RF2.1, RF2.2, RF2.3, RF2.4, RNF6.2.

Nota tecnica: ogni classe è gestita da un **modello binario indipendente** (densenet121 + aggregazione MIL), non da un singolo classificatore multi-output. Questa è la strategia "binary decomposition" validata nella repo di origine, che migliora l'AUC del 6-46% rispetto a un approccio multi-label unico — un esempio di come una scelta architetturale empiricamente validata possa avere un impatto enorme sulle metriche.

---

**US-3.2**
> Come sistema, voglio elaborare le 8 slice con un preprocessing specifico (maschera circolare, CLAHE, finestre CT multiple) prima di passarle al modello, in modo da garantire che l'input sia coerente con quello su cui il modello è stato allenato.

Criteri di accettazione:
- Il preprocessing in fase di inferenza è **identico, non approssimato**, a quello usato in fase di training — qualsiasi discrepanza (anche un resize con un metodo di interpolazione diverso) può degradare silenziosamente la qualità delle predizioni senza generare un errore visibile
- Le 8 slice vengono elaborate come un'unica unità (Multiple Instance Learning), non classificate singolarmente e poi mediate a posteriori

Requisiti collegati: implicito in RF2.1 (non testabile direttamente dall'utente finale, ma critico per la correttezza del sistema).

Nota didattica: questo è uno dei punti più insidiosi nell'integrazione di modelli ML in un sistema di produzione. Un modello può "funzionare" nel senso che non genera errori, pur producendo output completamente inattendibili se il preprocessing di inferenza diverge da quello di training. Non esiste un test automatico ovvio per questo — richiede disciplina nel replicare esattamente il codice, non nel "fare qualcosa di simile".

---

### Epic 4: Generazione del referto (Modello II)

**US-4.1**
> Come medico, voglio ottenere una bozza di referto testuale strutturato a partire dai findings già calcolati, in modo da risparmiare il tempo di scrivere da zero un referto standard.

Criteri di accettazione:
- Il referto non può essere generato prima che la classificazione sia stata eseguita — il sistema impedisce questo ordine sbagliato con un errore esplicativo (400), non un referto vuoto o fittizio
- Il referto è organizzato in sezioni riconoscibili (Tecnica, Reperti, Conclusioni), non un blocco di testo indistinto
- Il linguaggio usato per descrivere un finding varia in base a quanto la probabilità supera la soglia di decisione (es. "sospetta" vs "evidente"), comunicando un livello di confidenza senza dichiarare una gravità clinica che il sistema non è in grado di valutare

Requisiti collegati: RF3.1, RNF6.1.

Nota tecnica e di design: il Modello II non è un modello generativo addestrato — è un generatore rule-based che compone frasi template a partire dai findings del Modello I. Questa è una scelta esplicita, motivata dall'assenza nel dataset disponibile di referti testuali liberi scritti da radiologi (necessari per addestrare un modello visione→testo end-to-end). Il vantaggio collaterale di questa scelta è che elimina strutturalmente il problema della coerenza tra i due modelli: il referto non può contraddire i findings, perché è generato a partire da essi.

---

**US-4.2**
> Come medico, voglio poter modificare liberamente il testo del referto generato, in modo da correggere, integrare o riscrivere completamente quanto prodotto automaticamente prima che diventi parte della cartella clinica del paziente.

Criteri di accettazione:
- Non esiste alcuna versione "bloccata" o read-only del referto — è sempre un campo di testo modificabile
- Le modifiche manuali sovrascrivono il testo precedente, mantenendo lo storico solo nella misura in cui il sistema di audit lo richieda (non implementato nel prototipo attuale — limite dichiarato)

Requisiti collegati: RF3.2, RF3.4.

---

**US-4.3**
> Come medico, voglio essere avvisato se il referto e la classificazione risultano incoerenti tra loro, in modo da non firmare un documento clinico internamente contraddittorio.

Criteri di accettazione:
- Il controllo di coerenza confronta, per ciascuna classe, se è marcata positiva nei findings e se è effettivamente menzionata nel testo del referto
- Dato che il Modello II genera il testo direttamente dai findings, un mismatch può verificarsi praticamente solo se il medico stesso ha modificato manualmente il referto in modo da rimuovere la menzione di un finding positivo — il sistema lo segnala comunque, perché un medico potrebbe farlo per errore (es. cancellando una frase per sbaglio durante un'edit)

Requisiti collegati: RF4.1.

---

### Epic 5: Validazione e tracciabilità clinica

**US-5.1**
> Come medico, voglio marcare un referto come definitivamente validato, in modo da segnalare che ho assunto la responsabilità clinica sul contenuto, distinguendo i casi ancora in bozza da quelli pronti per l'uso clinico.

Criteri di accettazione:
- Non è possibile validare un caso che non ha ancora un referto generato
- Il sistema registra **chi** ha validato (username), non solo che è stato validato — questo è essenziale per la tracciabilità clinica, non un dettaglio opzionale

Requisiti collegati: RF5.3.

---

**US-5.2**
> Come medico, voglio esportare il referto finale in un formato facilmente condivisibile, in modo da poterlo integrare nella cartella clinica del paziente o consegnarlo al paziente stesso.

Criteri di accettazione:
- L'esportazione include sempre lo stato di validazione (validato/non validato e da chi), per evitare che un documento in bozza venga scambiato per un referto definitivo

Requisiti collegati: RF6.2.

---

## Parte 2 — Flusso degli eventi: percorso end-to-end di un caso

Questa sezione descrive cosa accade tecnicamente, livello per livello, dal momento in cui il medico clicca "carica paziente" al momento in cui il referto è validato. È strutturata per strati architetturali (presentazione → API → logica di business → persistenza → modello ML), che è il modo corretto di ragionare su un sistema a più livelli: ogni strato ha una responsabilità precisa e non dovrebbe conoscere i dettagli implementativi dello strato sottostante.

### 2.1 — Autenticazione

```
Frontend                    Backend (auth.py)              Database (MongoDB)
   |                              |                               |
   |--- POST /auth/login -------->|                               |
   |    (username, password)      |--- find_one(username) ------->|
   |                              |<-- documento utente -----------|
   |                              |--- verify_password (bcrypt) -- |
   |                              |--- create_access_token (JWT) - |
   |<-- 200: {access_token, role}-|                               |
```

Punto tecnico: la verifica della password con bcrypt è intenzionalmente **lenta** (è un costo computazionale voluto, per rendere impraticabili gli attacchi a forza bruta). Il JWT, una volta emesso, non richiede invece nessuna query al database per essere validato nelle richieste successive — questa è la differenza fondamentale tra autenticazione (costosa, avviene una volta) e autorizzazione su ogni richiesta (deve essere economica, perché avviene continuamente).

### 2.2 — Creazione del caso

```
Frontend                Backend (main.py)         storage.py         MongoDB
   |                          |                       |                 |
   |-- POST /patients ------->|                       |                 |
   |   (dati + 8 file)        |-- valida count==8 -----|                 |
   |                          |-- valida ogni file -----|                 |
   |                          |---------------------------- insert_one ->|
   |                          |<--------------------------- patient_id --|
   |                          |-- save_patient_images(patient_id, imgs)->|
   |                          |                       |-- scrive su disco|
   |                          |<-- lista path ---------|                 |
   |                          |---------------------------- update_one ->|
   |<-- 201: PatientStatus ---|                       |                 |
```

Punto tecnico importante: il documento Mongo viene creato **prima** di salvare le immagini su disco, per ottenere un `patient_id` univoco da usare come nome della cartella. Questo è un esempio di dipendenza tra due operazioni che, in un sistema più maturo, richiederebbe una gestione esplicita della transazionalità (cosa succede se il salvataggio su disco fallisce dopo che il documento Mongo è già stato creato? Si resta con un paziente "fantasma" senza immagini). Nel prototipo attuale questo scenario non è gestito esplicitamente — è un limite noto, accettabile per una demo, da menzionare se la tesi discute robustezza del sistema.

### 2.3 — Classificazione

```
Frontend            Backend (main.py)         model_I.py              Disco
   |                      |                       |                     |
   |-- POST /classify --->|                       |                     |
   |                      |-- find_one(patient) -->|                     |
   |                      |-- Image.open() per ogni path -------------->|
   |                      |<-- 8 immagini PIL -----|                     |
   |                      |-- classification_model.predict(images) ---->|
   |                      |                       |-- per ogni classe:  |
   |                      |                       |   preprocess(8 img) |
   |                      |                       |   forward pass      |
   |                      |                       |   sigmoid(logit)    |
   |                      |<-- {label: prob, ...} -|                     |
   |                      |-- applica soglie, calcola no_finding         |
   |                      |-- update_one(findings) ---------------------->|
   |<-- 200: ClassificationResponse ---------------|                     |
```

Punto tecnico: l'inferenza avviene **sincrona** — il medico aspetta che il modello finisca prima di ricevere risposta. Per un singolo paziente con 4 modelli leggeri (DenseNet-121) questo è accettabile (probabilmente pochi secondi su CPU, meno su GPU). Se il sistema dovesse scalare a molti utenti simultanei, questo sarebbe un punto critico da rivedere con una coda di elaborazione asincrona (es. Celery + Redis) — non necessario per questo progetto, ma è il tipo di considerazione che un ingegnere deve sempre tenere a mente quando un sistema può crescere.

### 2.4 — Generazione del referto

```
Frontend            Backend (main.py)         model_II.py
   |                      |                       |
   |-- POST /report ----->|                       |
   |                      |-- find_one(patient) -->|
   |                      |-- verifica findings != None                  
   |                      |    (altrimenti 400)                          
   |                      |-- generate_from_findings(findings) --------->|
   |                      |                       |-- per ogni classe in ordine fisso:
   |                      |                       |   template positivo/negativo
   |                      |                       |   + modificatore di confidenza
   |                      |                       |-- compone Tecnica/Reperti/Conclusioni
   |                      |<-- testo referto ------|
   |                      |-- update_one(report_text)
   |<-- 200: ReportResponse (+ disclaimer) --------|
```

Punto tecnico: a differenza della classificazione, questo passaggio è **deterministico** — stesso input (stessi findings) produce sempre lo stesso output. Non c'è nessuna componente stocastica. Questo è positivo per la riproducibilità (utile in un contesto di validazione/audit clinico) ma è anche il limite intrinseco dell'approccio: il referto non potrà mai descrivere nulla che non sia già codificato nei template, a differenza di un vero modello generativo.

### 2.5 — Validazione ed export

```
Frontend            Backend (main.py)         MongoDB
   |                      |                       |
   |-- POST /validate --->|                       |
   |   (richiede ruolo    |-- require_role("medico")
   |    "medico")         |   [se specializzando: 403, stop qui]
   |                      |-- verifica report_text != None
   |                      |-- update_one(validated=True, validated_by=username)
   |<-- 200 --------------|                       |
   |                      |                       |
   |-- GET /export ------>|                       |
   |                      |-- find_one(patient) -->|
   |                      |-- compone testo finale con stato validazione
   |<-- text/plain --------|                       |
```

---

## Parte 3 — Decisioni architetturali e razionale (per chi vuole capire il "perché")

| Decisione | Alternativa scartata | Perché questa scelta |
|---|---|---|
| JWT stateless per l'autenticazione | Sessioni server-side con storage in Mongo | Riduce il carico sul database a ogni richiesta; coerente con un'API REST che deve restare semplice da scalare orizzontalmente, anche se per questo progetto la scalabilità non è un requisito stringente — è comunque buona prassi |
| Un modello binario per classe (binary decomposition) | Un singolo classificatore multi-label | Risultato empiricamente validato nella repo di origine (+6/+46% AUC); esempio di come la letteratura/evidenza disponibile debba guidare le scelte architetturali, non solo l'eleganza del design |
| Modello II rule-based, non generativo | Modello visione→testo end-to-end | Il dataset disponibile non contiene referti testuali liberi — un modello generativo richiederebbe dati che semplicemente non esistono in questo progetto. Una scelta vincolata dai dati, non dalla preferenza tecnica |
| Referto generato DAI findings, non in modo indipendente dalle immagini | Due modelli paralleli che elaborano le immagini separatamente | Elimina strutturalmente il problema di coerenza tra i due output — un esempio di come un vincolo di design possa risolvere un problema (la coerenza) invece di limitarsi a verificarlo a posteriori |
| Immagini su disco, path in MongoDB | Immagini dentro MongoDB con GridFS | Per il volume di dati di questo progetto (poche immagini per paziente), il filesystem è più semplice da gestire e da debuggare; GridFS avrebbe introdotto complessità non giustificata dalla scala del progetto |
| Validazione riservata al ruolo "medico" | Permettere a entrambi i ruoli di validare | Riflette il vincolo clinico reale: uno specializzando in formazione può preparare un caso, ma la responsabilità finale deve restare di un medico qualificato — un esempio di come un requisito di dominio (non tecnico) determini una scelta di autorizzazione nel software |

---

## Parte 4 — Tracciabilità Requisiti → User Stories → Endpoint

| Requisito | User Story | Endpoint coinvolto |
|---|---|---|
| RF1.1, RF1.2 | US-2.1 | `POST /patients` |
| RF2.1-2.4, RNF6.2 | US-3.1, US-3.2 | `POST /patients/{id}/classify` |
| RF3.1, RNF6.1 | US-4.1 | `POST /patients/{id}/report` |
| RF3.2, RF3.4 | US-4.2 | `PUT /patients/{id}/report` |
| RF4.1 | US-4.3 | `GET /patients/{id}/coherence` |
| RF5.1, RF5.2 | US-2.3 | `GET /patients/{id}/slices/{i}` |
| RF5.3 | US-1.2, US-5.1 | `POST /patients/{id}/validate` |
| RF6.1 | US-2.2 | `GET /patients`, `GET /patients/{id}` |
| RF6.2 | US-5.2 | `GET /patients/{id}/export` |

---

## Considerazione finale, in chiave didattica

Questo progetto, nel suo piccolo, attraversa quasi tutti i temi classici dell'ingegneria del software applicata a sistemi con componenti di intelligenza artificiale: separazione delle responsabilità tra strati, autenticazione vs autorizzazione, gestione degli errori come parte del contratto dell'API (non un'aggiunta successiva), e — soprattutto — la consapevolezza che un modello ML non è "magia": è un componente con un contratto di input/output preciso (preprocessing esatto, formato dei dati, soglie calibrate), che va trattato con la stessa disciplina ingegneristica di qualsiasi altro modulo software, se non di più, perché i suoi errori sono spesso silenziosi (un input fuori distribuzione non genera un'eccezione, genera semplicemente un numero sbagliato).
