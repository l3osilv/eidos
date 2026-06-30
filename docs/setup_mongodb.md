# Setup MongoDB

## 1. Opzione consigliata: Docker

Evita conflitti di versione con eventuali installazioni native e semplifica la documentazione dell'ambiente nella tesi ("sistema containerizzato, riproducibile").

**Prerequisito:** Docker installato (`docker --version`; su Ubuntu: `sudo apt install docker.io docker-compose-v2`).

```bash
cd mongodb_setup   # contiene il docker-compose.yml
docker compose up -d
```

Verifica che sia partito:

```bash
docker ps
```

Dovresti vedere un container `medicinai_mongo` in stato `Up`.

Comandi utili:

```bash
docker compose down          # ferma il container (i dati restano nel volume)
docker compose down -v       # ferma E cancella tutti i dati (utile per ripartire da zero)
```

---

## 2. Alternativa: installazione nativa su Ubuntu/Debian

```bash
sudo apt-get install gnupg curl
curl -fsSL https://pgp.mongodb.com/server-7.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod   # avvio automatico al boot
```

Verifica:

```bash
sudo systemctl status mongod
```

> Per distribuzioni non Debian-based consultare la [documentazione ufficiale MongoDB](https://www.mongodb.com/docs/manual/installation/).

---

## 3. Configurazione del backend

Copia il file `.env.example` nella cartella `backend/` e rinominalo `.env`:

```bash
cd backend
cp ../mongodb_setup/.env.example .env
```

Genera un JWT secret sicuro e inseriscilo nel file `.env`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Sostituisci il valore placeholder `CHANGE_ME` con l'output del comando sopra.

Installa le dipendenze (include `python-dotenv` per leggere `.env`):

```bash
pip install -r requirements.txt
```

---

## 4. Strumenti di ispezione (opzionali)

**mongosh** — shell testuale ufficiale:

```bash
mongosh mongodb://localhost:27017/medicinai
> db.users.find()
> db.patients.find()
```

**MongoDB Compass** — interfaccia grafica. Scaricabile da [mongodb.com/products/compass](https://www.mongodb.com/products/compass). Connessione: `mongodb://localhost:27017`. Utile per verificare visivamente i dati durante lo sviluppo.

---

## 5. Backup dei dati di demo (opzionale)

Per conservare uno snapshot dei dati prima della presentazione:

```bash
mongodump --uri="mongodb://localhost:27017/medicinai" --out=./backup_demo
```

Ripristino:

```bash
mongorestore --uri="mongodb://localhost:27017/medicinai" ./backup_demo/medicinai
```

---
