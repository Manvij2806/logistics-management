"""
auth.py – JWT helpers using integer user IDs (newusers.id is INTEGER)
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from sqlalchemy.orm import Session

from database import User, get_db

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production-32b")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8   # 8 hours

http_bearer = HTTPBearer(auto_error=True)


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exc
    if user.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role and current_user.role.name.lower() == "admin":
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required.",
    )


def require_role(*allowed_roles: str):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/", dependencies=[Depends(require_role("Admin", "Dispatcher"))])

    Role names are compared case-insensitively against current_user.role.name.
    Admins are NOT automatically granted access by this function — pass "Admin"
    explicitly in allowed_roles if admins should be allowed too.
    """
    allowed_lower = {r.lower() for r in allowed_roles}

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role and current_user.role.name.lower() in allowed_lower:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access restricted to: {', '.join(allowed_roles)}.",
        )

    return checker