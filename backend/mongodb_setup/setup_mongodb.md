# Guida alla configurazione di MongoDB

Istruzioni per configurare e avviare l'istanza del database MongoDB a supporto del backend.

---

## 1. Opzione consigliata: container Docker

Configurazione consigliata per evitare conflitti con altre istanze locali e mantenere l'ambiente di sviluppo riproducibile.

**Prerequisiti:** Docker e Docker Compose installati sul sistema.

Spostarsi nella cartella `mongodb_setup` e avviare il servizio in background:
```bash
cd backend/mongodb_setup
docker compose up -d
```

Verificare che il container sia attivo:
```bash
docker ps
```
Il comando mostrerà il container denominato `eidos_mongo` in esecuzione (`Up`).

### Comandi per la gestione del container

```bash
# Arresto del database
docker compose down

# Riavvio del database
docker compose restart
```

---

## 2. Opzione alternativa: installazione locale con systemd

In alternativa all'uso di Docker, è possibile utilizzare un'istanza di MongoDB installata nativamente sul sistema operativo:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

Verifica dello stato del servizio:
```bash
sudo systemctl status mongod
```

Per i dettagli sull'installazione nativa per la propria distribuzione Linux, consultare la [documentazione ufficiale di MongoDB](https://www.mongodb.com/docs/manual/installation/).

---

## 3. Configurazione del backend

Dopo aver avviato MongoDB, configurare le variabili d'ambiente per consentire la connessione del backend al database.

Dalla cartella `backend/`, creare il file `.env` a partire dal modello di esempio:
```bash
cd backend
cp mongodb_setup/.env.example .env
```

Generare una chiave segreta sicura per la firma dei token JWT:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Inserire la stringa generata nel file `.env` in corrispondenza della variabile `JWT_SECRET`.

Infine, installare le dipendenze Python:
```bash
pip install -r requirements.txt
```