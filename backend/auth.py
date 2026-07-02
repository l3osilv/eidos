"""
Autenticazione JWT e gestione ruoli (medico / specializzando).

Flusso:
  1. POST /auth/login → verifica credenziali (bcrypt) → token JWT
  2. Il frontend invia il token come header Authorization: Bearer <token>
  3. get_current_user() decodifica il token e recupera l'utente da Mongo
  4. require_role() blocca con 403 se il ruolo non è quello richiesto

Il token dura 8 ore (una giornata lavorativa). JWT_SECRET va configurato
nel .env — il default vuoto è solo per sviluppo locale.
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from database import users_collection

# Chiave per la firma JWT — in produzione va impostata tramite .env
SECRET_KEY = os.getenv("JWT_SECRET", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 ore

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

VALID_ROLES = {"medico", "specializzando"}


def hash_password(password: str) -> str:
    """Hash bcrypt con salt casuale."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Confronta password in chiaro con hash bcrypt."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    """Crea JWT con scadenza. Il payload contiene {sub: username, exp: ...}."""
    return jwt.encode(
        {**data, "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)},
        SECRET_KEY, algorithm=ALGORITHM,
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependency per endpoint protetti: decodifica il token,
    cerca l'utente in Mongo, 401 se qualcosa non torna.
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
    Uso: Depends(require_role("medico"))
    """

    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operazione consentita solo a: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker
