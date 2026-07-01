"""
Connessione a MongoDB tramite motor (driver async per FastAPI).

Motor è il driver asincrono ufficiale di MongoDB per Python: wrappa PyMongo
con supporto nativo per asyncio, necessario perché FastAPI è interamente async.
La connessione viene stabilita al primo import del modulo e condivisa come
singleton tra tutti gli endpoint — motor gestisce internamente il connection pooling.

Configurazione tramite variabili d'ambiente:
  MONGODB_URL  (default: mongodb://localhost:27017)
  DB_NAME      (default: medicinai)

Collezioni utilizzate:
  - users:    documenti utente {username, hashed_password, nome, cognome, gender, role, avatar}
  - patients: documenti paziente {nome, cognome, codice_fiscale, data_nascita, created_at,
              created_by, image_paths, findings, no_finding, report_text, validated, validated_by}
"""

import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()  # carica le variabili da .env nella working directory

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "medicinai")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

users_collection = db["users"]
patients_collection = db["patients"]
