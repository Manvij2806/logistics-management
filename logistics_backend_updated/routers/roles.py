"""
routers/roles.py - Read-only endpoints for the roles table
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import Role, get_db
from auth import require_admin

router = APIRouter(
    prefix="/api/roles",
    tags=["Roles"],
    dependencies=[Depends(require_admin)],  # Admin-only
)


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


@router.get("/", response_model=List[RoleResponse])
def list_roles(db: Session = Depends(get_db)):
    return db.query(Role).order_by(Role.id).all()


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    return role
