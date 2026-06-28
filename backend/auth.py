"""
Autenticazione e gestione ruoli (medico / specializzando).

ATTENZIONE: SECRET_KEY va impostata come variabile d'ambiente in qualsiasi
ambiente diverso dal tuo laptop di sviluppo. Il valore di default qui è
SOLO per farti partire subito.
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from database import users_collection
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

SECRET_KEY = os.getenv("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # validità token: 8 ore (un turno)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

VALID_ROLES = {"medico", "specializzando"}


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # Usiamo datetime.now(timezone.utc) al posto del deprecato datetime.utcnow()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
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
    Dependency factory per limitare un endpoint a uno o più ruoli.
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
