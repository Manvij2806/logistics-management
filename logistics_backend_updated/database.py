"""
database.py - Database connection and ORM models for LogisticsPro
Tables: newusers, roles, deliveries, packages
"""

import enum
import os
import uuid

from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, create_engine, inspect, text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─────────────────────────────────────────────
# ENUMS (Python-side only – stored as VARCHAR)
# ─────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin      = "Admin"
    dispatcher = "Dispatcher"
    agent      = "Agent"
    customer   = "Customer"
    manager    = "manager"
    staff      = "staff"


class UserStatus(str, enum.Enum):
    active   = "Active"
    inactive = "Inactive"


# ─────────────────────────────────────────────
# ORM MODELS  (mirror actual DB table names)
# ─────────────────────────────────────────────

class Role(Base):
    """Mirrors the 'roles' table."""
    __tablename__ = "roles"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(10),  nullable=False, unique=True)
    description = Column(String(25),  nullable=True)


class User(Base):
    """Mirrors the 'newusers' table."""
    __tablename__ = "newusers"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    fullname        = Column(String(100), nullable=False)
    username        = Column(String(50),  nullable=False, unique=True)
    email           = Column(String(100), nullable=False, unique=True)
    phone_number    = Column(String(15),  nullable=True)
    hashed_password = Column(String(255), nullable=True)
    status          = Column(String(20),  nullable=False, default="Active")
    role_id         = Column(Integer, ForeignKey("roles.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    active_deliveries = Column(Integer, nullable=True, default=0)
    deactivate_after_delivery = Column(Boolean, nullable=True, default=False)
    city            = Column(String(100), nullable=True)

    role = relationship("Role", foreign_keys=[role_id])

    # Convenience property so existing code using .full_name still works
    @property
    def full_name(self):
        return self.fullname

    @full_name.setter
    def full_name(self, value):
        self.fullname = value


class Delivery(Base):
    """Mirrors the 'deliveries' table."""
    __tablename__ = "deliveries"

    id               = Column(Integer, primary_key=True, index=True)
    delivery_id      = Column(String, unique=True, index=True)
    tracking_number  = Column(String, unique=True, index=True)
    pickup_address   = Column(String, nullable=False)
    drop_address     = Column(String, nullable=False)
    customer_name    = Column(String, nullable=False)
    customer_phone   = Column(String, nullable=False)
    status           = Column(String, default="Created")
    agent            = Column(String, nullable=True)
    agent_id         = Column(Integer, nullable=True)
    notes            = Column(String, default="Notes are empty")
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    recipient_name    = Column(String, nullable=True)
    recipient_address = Column(String, nullable=True)
    recipient_pincode = Column(String, nullable=True)
    sender_name       = Column(String, nullable=True)
    sender_address    = Column(String, nullable=True)
    sender_pincode    = Column(String, nullable=True)
    package_description = Column(String, nullable=True)
    package_weight     = Column(String, nullable=True)
    package_dimensions = Column(String, nullable=True)
    priority           = Column(String, nullable=True)
    accepted           = Column(String, nullable=True, default="Pending")
    payment_status     = Column(String, nullable=True, default="Unpaid")
    payment_method     = Column(String, nullable=True)
    sender_phone       = Column(String, nullable=True)
    recipient_phone    = Column(String, nullable=True)
    verification_pin   = Column(String, nullable=True)
    assigned_at        = Column(DateTime(timezone=True), nullable=True)
    picked_up_at       = Column(DateTime(timezone=True), nullable=True)
    in_transit_at      = Column(DateTime(timezone=True), nullable=True)
    delivered_at       = Column(DateTime(timezone=True), nullable=True)
    estimated_delivery_at = Column(DateTime(timezone=True), nullable=True)


class Package(Base):
    """Mirrors the 'packages' table."""
    __tablename__ = "packages"

    id          = Column(Integer, primary_key=True, index=True)
    package_id  = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    weight      = Column(String, nullable=True)
    dimensions  = Column(String, nullable=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    delivery = relationship("Delivery", foreign_keys=[delivery_id])


# ─────────────────────────────────────────────
# DB DEPENDENCY
# ─────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────
# SCHEMA INIT
# ─────────────────────────────────────────────

def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)

    # Auto-migration for columns
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='deliveries'"))
            existing_cols = {row[0] for row in result.fetchall()}

            if "accepted" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN accepted VARCHAR DEFAULT 'Pending'"))
                conn.commit()
                print("Migration: 'accepted' column added successfully.")
            if "payment_status" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN payment_status VARCHAR DEFAULT 'Unpaid'"))
                conn.commit()
                print("Migration: 'payment_status' column added successfully.")
            if "payment_method" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN payment_method VARCHAR DEFAULT NULL"))
                conn.commit()
                print("Migration: 'payment_method' column added successfully.")
            if "sender_phone" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN sender_phone VARCHAR DEFAULT NULL"))
                conn.commit()
                print("Migration: 'sender_phone' column added successfully.")
            if "recipient_phone" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN recipient_phone VARCHAR DEFAULT NULL"))
                conn.commit()
                print("Migration: 'recipient_phone' column added successfully.")
            if "verification_pin" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN verification_pin VARCHAR DEFAULT NULL"))
                conn.commit()
                print("Migration: 'verification_pin' column added successfully.")
            if "assigned_at" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL"))
                conn.commit()
                print("Migration: 'assigned_at' column added successfully.")
            if "picked_up_at" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN picked_up_at TIMESTAMP WITH TIME ZONE DEFAULT NULL"))
                conn.commit()
                print("Migration: 'picked_up_at' column added successfully.")
            if "in_transit_at" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN in_transit_at TIMESTAMP WITH TIME ZONE DEFAULT NULL"))
                conn.commit()
                print("Migration: 'in_transit_at' column added successfully.")
            if "delivered_at" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL"))
                conn.commit()
                print("Migration: 'delivered_at' column added successfully.")
            if "estimated_delivery_at" not in existing_cols:
                conn.execute(text("ALTER TABLE deliveries ADD COLUMN estimated_delivery_at TIMESTAMP WITH TIME ZONE DEFAULT NULL"))
                if conn.dialect.name == "sqlite":
                    conn.execute(text("UPDATE deliveries SET estimated_delivery_at = datetime(created_at, '+4 hours') WHERE estimated_delivery_at IS NULL"))
                else:
                    conn.execute(text("UPDATE deliveries SET estimated_delivery_at = created_at + INTERVAL '4 hours' WHERE estimated_delivery_at IS NULL"))
                conn.commit()
                print("Migration: 'estimated_delivery_at' column added successfully.")

            # Migration for newusers table
            try:
                result_users = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='newusers'"))
                existing_user_cols = {row[0] for row in result_users.fetchall()}
                if "deactivate_after_delivery" not in existing_user_cols:
                    conn.execute(text("ALTER TABLE newusers ADD COLUMN deactivate_after_delivery BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                    print("Migration: 'deactivate_after_delivery' column added successfully.")
                if "city" not in existing_user_cols:
                    conn.execute(text("ALTER TABLE newusers ADD COLUMN city VARCHAR(100) DEFAULT NULL"))
                    conn.commit()
                    print("Migration: 'city' column added successfully.")
            except Exception as e_info:
                # SQLite fallback
                try:
                    conn.execute(text("ALTER TABLE newusers ADD COLUMN deactivate_after_delivery BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE newusers ADD COLUMN city VARCHAR(100) DEFAULT NULL"))
                    conn.commit()
                except Exception:
                    pass

            # Backfill random cities for existing users who do not have a city yet (excluding Admins)
            try:
                db_session = SessionLocal()
                db_users = db_session.query(User).filter(User.city == None).all()
                import random
                cities_list = ["Agra", "Mumbai", "Delhi", "Noida", "Gwalior"]
                for u in db_users:
                    if u.role_id == 1 or (u.role and u.role.name == "Admin"):
                        continue
                    u.city = random.choice(cities_list)
                db_session.commit()
                print("Migration: Backfilled users with random cities.")
            except Exception as e_backfill:
                print("Error backfilling user cities:", e_backfill)
            finally:
                db_session.close()

    except Exception as e:
        print("Error running migration:", e)