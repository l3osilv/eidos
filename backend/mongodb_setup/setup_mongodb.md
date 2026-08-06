# Guida al Setup di MongoDB

Per utilizzare il database MongoDB con questo progetto sono disponibili due opzioni.

---

## 1. Opzione consigliata: Docker

Questa soluzione è consigliata per evitare conflitti di versione con altre installazioni locali e per garantire un ambiente riproducibile.

**Prerequisiti:** Docker e Docker Compose installati sul sistema.

Spostarsi nella cartella `mongodb_setup` e avviare il servizio in background:
```bash
cd mongodb_setup
docker compose up -d
```

Verificare che il container sia attivo:
```bash
docker ps
```
Dovrebbe essere presente un container denominato `eidos_mongo` con stato `Up`.

### Comandi utili per Docker:
```bash
# Arrestare il database
docker compose down
```

---

## 2. Opzione alternativa: Installazione locale (Systemd)

Se si preferisce utilizzare un'istanza locale di MongoDB installata direttamente sul sistema operativo:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

Verificare lo stato del servizio:
```bash
sudo systemctl status mongod
```

*Nota:* Per maggiori informazioni sull'installazione nativa, consultare la [documentazione ufficiale di MongoDB](https://www.mongodb.com/docs/manual/installation/).

---

## 3. Configurazione del backend

Una volta avviato MongoDB, configurare il backend per consentire la connessione al database.

Spostarsi nella cartella del backend e creare il file `.env` a partire dal modello d'esempio:
```bash
cd backend
cp ../mongodb_setup/.env.example .env
```

Generare una chiave segreta per firmare i token JWT degli utenti:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Incollare la stringa generata nel file `.env`, aggiornando la variabile `JWT_SECRET`.

Infine, installare i pacchetti Python necessari:
```bash
pip install -r requirements.txt
```