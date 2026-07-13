"""
main.py - LogisticsPro FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import deliveries
from routers import users as users_router
from routers import roles as roles_router
from routers import dashboard as dashboard_router

app = FastAPI(
    title="LogisticsPro API",
    description="Unified API – user management, deliveries, agents",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:4201",
        "http://127.0.0.1:4201",
        "http://localhost:4202",
        "http://127.0.0.1:4202",
        "http://localhost:4203",
        "http://127.0.0.1:4203",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    init_db()


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(deliveries.router)
app.include_router(users_router.agents_router)  # must come before users_router.router so
                                                  # /api/users/agents matches before /api/users/{user_id}
app.include_router(users_router.router)
app.include_router(roles_router.router)
app.include_router(dashboard_router.router)


# ── Auth (kept inline for simplicity) ────────────────────────────────────────

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from auth import create_access_token, get_current_user
from auth_utils import verify_password
from database import User, UserStatus, get_db


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@app.post("/api/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    identifier = payload.username.strip().lower()
    # Support login with either username or email address
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="Password not set. Contact an administrator.")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if user.status != "Active":
        raise HTTPException(status_code=403, detail="Account is disabled.")

    return TokenResponse(access_token=create_access_token(user.id))


@app.get("/api/auth/me", tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "fullname": current_user.fullname,
        "username": current_user.username,
        "email": current_user.email,
        "status": current_user.status,
        "role_id": current_user.role_id,
        "phone_number": current_user.phone_number,
    }


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)


@app.post("/api/auth/change-password", tags=["Auth"])
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Incorrect old password."
        )
    
    from auth_utils import hash_password
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "LogisticsPro API",
        "status": "running",
        "docs": "/docs",
    }
