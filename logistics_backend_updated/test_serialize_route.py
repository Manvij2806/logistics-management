import os
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import sessionmaker
from database import Base, Delivery, User
from schemas import DeliveryListResponse

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

user = db.query(User).filter(User.id == 18).first()
print("Suresh Sharma fullname:", user.fullname)
print("Suresh Sharma role_id:", user.role_id)

query = db.query(Delivery)
query = query.filter(
    or_(Delivery.agent == user.fullname, Delivery.agent_id == user.id)
)

deliveries = query.order_by(Delivery.created_at.desc()).all()
print("\nDeliveries in DB for Suresh Sharma:")
for d in deliveries:
    print(f"DB ID: {d.id}, delivery_id: {d.delivery_id}, status: {d.status}, agent: {d.agent}, agent_id: {d.agent_id}, accepted: {d.accepted}")

# Serialize
serialized = DeliveryListResponse(
    total=len(deliveries),
    page=1,
    page_size=100,
    deliveries=deliveries
)

print("\nSerialized response:")
for d in serialized.deliveries:
    print(f"Serialized ID: {d.id}, delivery_id: {d.delivery_id}, status: {d.status}, agent: {d.agent}, agent_id: {d.agent_id}, accepted: {d.accepted}")

db.close()
