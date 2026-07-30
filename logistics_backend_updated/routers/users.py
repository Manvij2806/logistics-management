"""
routers/users.py - Full CRUD for the newusers table + agents endpoints
"""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc, or_
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin, require_role
from auth_utils import hash_password
from database import User, UserRole, UserStatus, get_db, Delivery

from pydantic import BaseModel, EmailStr, Field, field_validator
import re

router = APIRouter(prefix="/api/users", tags=["Users"])
# NOTE: No router-level dependency here. Most routes below require Admin,
# but the agent-listing routes (/agents, /agents/active) also allow Dispatcher.
# Each route declares its own access requirement explicitly.

# Separate router for agent-listing endpoints so they appear ONLY under the
# "Agents" tag group in the docs, not under "Users" as well. Same URL prefix,
# so the actual paths (/api/users/agents, /api/users/agents/active) are unchanged.
agents_router = APIRouter(prefix="/api/users", tags=["Agents"])


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class UserCreate(BaseModel):
    fullname: str = Field(..., min_length=2, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    phone_number: str = Field(..., min_length=7, max_length=15)
    role_id: Optional[int] = None
    city: Optional[str] = None
    password: str = Field(..., min_length=6)

    @field_validator("fullname")
    @classmethod
    def validate_full_name(cls, v):
        v = v.strip()
        if not re.match(r"^[A-Za-z\s]+$", v):
            raise ValueError("Full name must contain only letters and spaces.")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if not re.match(r"^\w+$", v):
            raise ValueError("Username must contain only letters, numbers, and underscores.")
        return v.lower()

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v):
        v = v.strip()
        if not re.match(r"^[\d\s\-+()]{7,15}$", v):
            raise ValueError("Phone number must be 7-15 characters.")
        return v


class UserUpdate(BaseModel):
    fullname: Optional[str] = Field(None, min_length=2, max_length=100)
    phone_number: Optional[str] = Field(None, min_length=7, max_length=15)
    role_id: Optional[int] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None

    @field_validator("fullname")
    @classmethod
    def validate_full_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not re.match(r"^[A-Za-z\s]+$", v):
            raise ValueError("Full name must contain only letters and spaces.")
        return v


class UserStatusUpdate(BaseModel):
    status: str  # "Active" or "Inactive"


class UserPasswordUpdate(BaseModel):
    password: str = Field(..., min_length=6)


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: int
    fullname: str
    username: str
    email: str
    phone_number: Optional[str] = None
    status: str
    role_id: Optional[int] = None
    role: Optional[RoleResponse] = None
    created_at: Optional[str] = None
    active_deliveries: Optional[int] = 0
    city: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator("created_at", mode="before")
    @classmethod
    def format_dt(cls, v):
        if v is None:
            return None
        return str(v)


class UserListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    users: List[UserResponse]


# ─────────────────────────────────────────────
# SORTABLE FIELDS
# ─────────────────────────────────────────────

SORTABLE = {
    "fullname":    User.fullname,
    "email":       User.email,
    "phone_number": User.phone_number,
    "status":      User.status,
    "created_at":  User.created_at,
}


# ─────────────────────────────────────────────
# LIST ALL USERS
# ─────────────────────────────────────────────

@router.get("/", response_model=UserListResponse, dependencies=[Depends(require_admin)])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: Literal["fullname", "email", "phone_number", "status", "created_at"] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    search: str = Query("", max_length=100),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.fullname.ilike(pattern),
                User.email.ilike(pattern),
                User.username.ilike(pattern),
                User.phone_number.ilike(pattern),
            )
        )

    total = query.count()
    col = SORTABLE[sort_by]
    order = asc(col) if sort_order == "asc" else desc(col)
    users = query.order_by(order).offset((page - 1) * page_size).limit(page_size).all()

    return UserListResponse(total=total, page=page, page_size=page_size, users=users)


# ─────────────────────────────────────────────
# AGENTS ENDPOINTS
# ─────────────────────────────────────────────

AGENT_ROLE_ID = 2   # roles.id where name = 'agent'


@agents_router.get(
    "/agents",
    response_model=List[UserResponse],
)
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return all users with role_id = 2 (agent)."""
    query = db.query(User).filter(User.role_id == AGENT_ROLE_ID)
    if current_user.role and current_user.role.name == "Dispatcher" and current_user.city:
        query = query.filter(User.city == current_user.city)
    agents = query.all()
    for agent in agents:
        active_count = db.query(Delivery).filter(
            or_(Delivery.agent == agent.fullname, Delivery.agent_id == agent.id),
            Delivery.status.in_(["Assigned", "Picked Up", "In Transit"]),
            Delivery.accepted.in_(["Accepted", "Acknowledged"])
        ).count()
        agent.active_deliveries = active_count
    return agents


@agents_router.get(
    "/agents/active",
    response_model=List[UserResponse],
)
def list_active_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return all users with role_id = 2 (agent) whose status is Active."""
    query = db.query(User).filter(User.role_id == AGENT_ROLE_ID, User.status == "Active")
    if current_user.role and current_user.role.name == "Dispatcher" and current_user.city:
        query = query.filter(User.city == current_user.city)
    agents = query.all()
    for agent in agents:
        active_count = db.query(Delivery).filter(
            or_(Delivery.agent == agent.fullname, Delivery.agent_id == agent.id),
            Delivery.status.in_(["Assigned", "Picked Up", "In Transit"]),
            Delivery.accepted.in_(["Accepted", "Acknowledged"])
        ).count()
        agent.active_deliveries = active_count
    return agents


# ─────────────────────────────────────────────
# GET ONE USER
# ─────────────────────────────────────────────

@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


# ─────────────────────────────────────────────
# CREATE USER
# ─────────────────────────────────────────────

@router.post("/", response_model=UserResponse, status_code=201, dependencies=[Depends(require_admin)])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail=f"Email '{payload.email}' already exists.")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail=f"Username '{payload.username}' is taken.")

    new_user = User(
        fullname=payload.fullname,
        username=payload.username,
        email=payload.email,
        phone_number=payload.phone_number,
        role_id=payload.role_id,
        status="Active",
        city=payload.city,
        hashed_password=hash_password(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ─────────────────────────────────────────────
# UPDATE USER
# ─────────────────────────────────────────────

@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.fullname is not None:
        user.fullname = payload.fullname
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number
    if payload.role_id is not None:
        user.role_id = payload.role_id
    if payload.email is not None:
        existing = db.query(User).filter(User.email == payload.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use.")
        user.email = payload.email
    if payload.city is not None:
        user.city = payload.city

    db.commit()
    db.refresh(user)
    return user


# ─────────────────────────────────────────────
# UPDATE STATUS
# ─────────────────────────────────────────────

@router.patch("/{user_id}/status", response_model=UserResponse, dependencies=[Depends(require_admin)])
def update_user_status(user_id: int, payload: UserStatusUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if payload.status == "Inactive" and user.role_id == 2:
        # Check for active deliveries
        active_delivery = db.query(Delivery).filter(
            or_(Delivery.agent == user.fullname, Delivery.agent_id == user.id),
            Delivery.status.in_(["Assigned", "Picked Up", "In Transit"])
        ).first()
        if active_delivery:
            user.deactivate_after_delivery = True
            db.commit()
            raise HTTPException(
                status_code=400,
                detail=f"the agent you are trying to disable is in middle of a delivery {active_delivery.delivery_id} , the user will be deactivated after completing the delivery ."
            )

    if payload.status == "Active":
        user.deactivate_after_delivery = False

    user.status = payload.status
    db.commit()
    db.refresh(user)
    return user


# ─────────────────────────────────────────────
# RESET PASSWORD
# ─────────────────────────────────────────────

@router.patch("/{user_id}/password", dependencies=[Depends(require_admin)])
def reset_password(user_id: int, payload: UserPasswordUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.hashed_password = hash_password(payload.password)
    db.commit()
    return {"message": "Password successfully reset."}


# ─────────────────────────────────────────────
# DELETE USER
# ─────────────────────────────────────────────

@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    db.delete(user)
    db.commit()
    return None


@router.get("/debug-cities/all")
def debug_cities(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "fullname": u.fullname, "role": u.role.name if u.role else None, "city": u.city} for u in users]
