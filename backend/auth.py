"""
Autenticazione JWT e gestione ruoli (medico / specializzando).

Flusso di autenticazione:
  1. L'utente invia username + password a POST /auth/login
  2. Il backend verifica le credenziali contro MongoDB (hash bcrypt)
  3. Se valide, genera un JWT firmato con HS256 contenente {sub: username, exp: ...}
  4. Il frontend include il token in ogni richiesta successiva (header Authorization: Bearer <token>)
  5. get_current_user() decodifica il token, cerca l'utente in MongoDB e lo restituisce

Gestione ruoli:
  - Due ruoli previsti: "medico" e "specializzando"
  - La validazione del referto (RF5.3) è riservata al ruolo "medico"
  - require_role() è una dependency factory che genera un 403 se il ruolo non corrisponde

Configurazione:
  - JWT_SECRET: variabile d'ambiente obbligatoria — il default vuoto è solo per sviluppo locale
  - ACCESS_TOKEN_EXPIRE_MINUTES: durata del token (default 8 ore, una giornata lavorativa)
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from database import users_collection

# Chiave segreta per la firma JWT — deve essere una stringa lunga e casuale.
# Il default vuoto funziona solo in sviluppo locale; in produzione va impostata
# tramite variabile d'ambiente JWT_SECRET (vedi .env e guida_tecnica_backend.md).
SECRET_KEY = os.getenv("JWT_SECRET", "")
ALGORITHM = "HS256"
# Durata del token: 8 ore, pari a una giornata lavorativa ospedaliera.
# Scaduto il token, il frontend redirige automaticamente al login.
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

VALID_ROLES = {"medico", "specializzando"}


def hash_password(password: str) -> str:
    """Genera l'hash bcrypt della password con salt casuale per la memorizzazione sicura."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Confronta la password in chiaro con l'hash bcrypt salvato in MongoDB."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    """
    Crea un token JWT firmato con scadenza.

    Il payload contiene il campo 'sub' (username) più il campo 'exp'
    calcolato automaticamente. Il token viene poi incluso dal frontend
    nell'header Authorization di ogni richiesta successiva.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependency FastAPI che estrae e valida l'utente corrente dal token JWT.

    Usata come Depends(get_current_user) in ogni endpoint protetto.
    Decodifica il token, verifica la scadenza, e cerca l'utente in MongoDB.
    Ritorna il documento utente completo (dict con username, role, nome, ecc.).
    Lancia HTTP 401 se il token è invalido, scaduto, o l'utente non esiste più.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenziali non valide o sessione scaduta",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await users_collection.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory per proteggere un endpoint per ruolo.
    Si usa come: Depends(require_role("medico"))
    Ritorna 403 se l'utente autenticato non ha il ruolo richiesto.
    """

    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operazione consentita solo a: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker
