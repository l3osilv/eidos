"""
Connessione MongoDB asincrona (motor).

Configurazione da .env:
  MONGODB_URL  (default: mongodb://localhost:27017)
  DB_NAME      (default: medicinai)
"""

import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "medicinai")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

users_collection = db["users"]
patients_collection = db["patients"]
