import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("Deliveries:")
    res = conn.execute(text("SELECT id, delivery_id, status, agent, agent_id FROM deliveries LIMIT 5"))
    for row in res.fetchall():
        print(row)

    print("\nAgents (newusers):")
    res2 = conn.execute(text("SELECT id, fullname, username, role_id FROM newusers WHERE role_id=2"))
    for row in res2.fetchall():
        print(row)