"""
Script di inizializzazione del database, da lanciare UNA VOLTA dopo aver
avviato MongoDB, prima di usare il backend.

Cosa fa:
1. Crea gli indici necessari (username univoco, ricerca rapida pazienti)
2. Crea il primo utente con ruolo "medico" (serve per fare login la prima
   volta, dato che /auth/register è aperto ma devi pur partire da qualcuno)

Uso:
    python init_db.py --username dott.rossi --password "una-password-sicura" --full-name "Dott. Rossi"

Richiede le stesse variabili d'ambiente del backend (MONGODB_URL, DB_NAME),
le legge dallo stesso file .env se presente.
"""

import argparse
import os
import sys

import bcrypt
from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "medicinai")


def main():
    parser = argparse.ArgumentParser(
        description="Inizializza DB e crea il primo utente medico"
    )
    parser.add_argument("--nome", required=True)
    parser.add_argument("--cognome", required=True)
    parser.add_argument(
        "--gender",
        required=True,
        choices=["M", "F"],
        help="Sesso (M o F)",
    )
    parser.add_argument("--password", required=True)
    parser.add_argument(
        "--role",
        default="medico",
        choices=["medico", "specializzando"],
        help="Ruolo del primo utente (default: medico, serve per poter validare i referti)",
    )
    args = parser.parse_args()

    print(f"Connessione a {MONGODB_URL}, database '{DB_NAME}'...")
    client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)

    try:
        client.admin.command("ping")
    except Exception as e:
        print(f"ERRORE: non riesco a connettermi a MongoDB. Dettaglio: {e}")
        print(
            "Verifica che MongoDB sia in esecuzione (docker compose up -d, oppure mongod)."
        )
        sys.exit(1)

    db = client[DB_NAME]

    # --- Indici ---
    print("Creo indici...")
    db["users"].create_index([("username", ASCENDING)], unique=True)
    db["patients"].create_index([("codice_fiscale", ASCENDING)])
    db["patients"].create_index([("created_at", ASCENDING)])
    print("Indici creati (o già esistenti).")

    # --- Primo utente ---
    # bcrypt richiede bytes, quindi codifichiamo la password in utf-8,
    # generiamo il salt e decodifichiamo in stringa per salvarla nel DB
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(args.password.encode("utf-8"), salt).decode("utf-8")
    
    username = f"{args.nome}{args.cognome}".lower().replace(" ", "")
    try:
        db["users"].insert_one(
            {
                "username": username,
                "hashed_password": hashed,
                "nome": args.nome,
                "cognome": args.cognome,
                "gender": args.gender,
                "role": args.role,
                "avatar": None,
            }
        )
        print(f"Utente '{username}' creato con ruolo '{args.role}'.")
    except DuplicateKeyError:
        print(
            f"Un utente con username '{username}' esiste già: nessuna modifica fatta."
        )

    client.close()
    print("Inizializzazione completata.")


if __name__ == "__main__":
    main()
