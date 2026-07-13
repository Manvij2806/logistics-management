"""
routers/dashboard.py - Dashboard statistics endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth import get_current_user, require_role
from database import User, Role, Delivery, get_db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

# Statuses that count as "active" (i.e. not yet finished/cancelled)
ACTIVE_DELIVERY_STATUSES = ["Created", "Pending", "Unassigned", "Assigned", "Picked Up", "In Transit"]

AGENT_ROLE_ID = 2  # roles.id where name = 'agent' (matches routers/users.py)


@router.get("/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return aggregate user statistics. Accessible to any authenticated user."""
    total_users   = db.query(User).count()
    active_users  = db.query(User).filter(User.status == "Active").count()
    inactive_users = db.query(User).filter(User.status == "Inactive").count()

    # Count users per role name
    rows = (
        db.query(Role.name, func.count(User.id))
        .join(User, User.role_id == Role.id, isouter=True)
        .group_by(Role.name)
        .all()
    )
    users_by_role = {name: count for name, count in rows if name}

    return {
        "total_users":   total_users,
        "active_users":  active_users,
        "inactive_users": inactive_users,
        "users_by_role": users_by_role,
    }


@router.get("/dispatcher-stats", dependencies=[Depends(require_role("Admin", "Dispatcher"))])
def get_dispatcher_stats(db: Session = Depends(get_db)):
    """Return aggregate delivery + agent statistics for the dispatcher dashboard."""
    total_deliveries  = db.query(Delivery).count()
    active_deliveries = (
        db.query(Delivery).filter(Delivery.status.in_(ACTIVE_DELIVERY_STATUSES)).count()
    )

    total_agents = db.query(User).filter(User.role_id == AGENT_ROLE_ID).count()
    active_agents = (
        db.query(User)
        .filter(User.role_id == AGENT_ROLE_ID, User.status == "Active")
        .count()
    )

    return {
        "total_deliveries":  total_deliveries,
        "active_deliveries": active_deliveries,
        "total_agents":      total_agents,
        "active_agents":     active_agents,
    }

