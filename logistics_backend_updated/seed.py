"""
seed.py - Seeds a default admin user if none exists (for fresh installs).
For PostgreSQL setups with an existing newusers table this is a no-op.
"""
from sqlalchemy.orm import Session
from database import User, Role
from auth_utils import hash_password


def seed_admin_user(db: Session):
    # Only seed if the table is completely empty
    if db.query(User).count() > 0:
        return

    # Ensure the admin role row exists
    admin_role = db.query(Role).filter(Role.name.ilike("Admin")).first()
    if not admin_role:
        admin_role = Role(name="Admin", description="Full system access")
        db.add(admin_role)
        db.commit()
        db.refresh(admin_role)

    admin = User(
        fullname="System Admin",
        username="admin",
        email="admin@logisticspro.com",
        phone_number="0000000000",
        role_id=admin_role.id,
        status="Active",
        hashed_password=hash_password("admin123"),
    )
    db.add(admin)
    db.commit()
    print("✅ Default admin user seeded (username: admin / password: admin123)")
