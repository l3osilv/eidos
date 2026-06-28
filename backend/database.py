"""
Connessione a MongoDB tramite motor (driver async per FastAPI).

Configurazione tramite variabili d'ambiente:
  MONGODB_URL  (default: mongodb://localhost:27017)
  DB_NAME      (default: medicinAI)
"""

import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()  # carica le variabili da .env nella working directory

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "medicinAI")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

users_collection = db["users"]
patients_collection = db["patients"]
