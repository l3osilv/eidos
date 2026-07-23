# Guida al Setup di MongoDB

Per far funzionare il database MongoDB per questo progetto ci sono due strade principali. 

---

## 1. Opzione consigliata: Docker

Questa è la soluzione che consiglio perché evita conflitti di versione con eventuali altre installazioni di database sul computer e semplifica il setup, rendendo l'ambiente riproducibile (un aspetto utile anche da descrivere nella tesi).

**Prerequisiti:** Docker e Docker Compose installati sul computer.

Spostati nella cartella in cui si trova il file `docker-compose.yml` e avvia il servizio in background:
```bash
cd mongodb_setup
docker compose up -d
```

Puoi verificare che il container sia effettivamente partito con:
```bash
docker ps
```
Dovresti vedere nell'elenco un container chiamato `eidos_mongo` con lo stato `Up`.

### Comandi utili per Docker:
```bash
# Per fermare il database
docker compose down

sudo systemctl start mongod
sudo systemctl enable mongod
```

Puoi verificare lo stato del servizio con:
```bash
sudo systemctl status mongod
```

*Nota:* Se utilizzi una distribuzione Linux diversa o un altro sistema operativo, fai riferimento alla [documentazione ufficiale di MongoDB](https://www.mongodb.com/docs/manual/installation/).

---

## 3. Configurazione del backend

Una volta che MongoDB è attivo, occorre configurare il backend per farlo connettere al database. 

Spostati nella cartella del backend, copia il file delle impostazioni di esempio e rinominalo in `.env`:
```bash
cd backend
cp ../mongodb_setup/.env.example .env
```

Successivamente, genera una chiave segreta casuale che verrà usata per firmare i token JWT degli utenti:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Copia l'output del comando e incollalo nel file `.env` appena creato, sostituendo la dicitura `CHANGE_ME` della variabile `JWT_SECRET`.

Infine, ricordati di installare i pacchetti Python necessari (che comprendono anche `python-dotenv` per caricare le configurazioni da questo file):
```bash
pip install -r requirements.txt
```

---