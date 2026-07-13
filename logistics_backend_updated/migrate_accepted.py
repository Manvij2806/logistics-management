import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='deliveries'"))
    existing_cols = {row[0] for row in result.fetchall()}
    
    if "accepted" not in existing_cols:
        print("Adding column 'accepted'...")
        conn.execute(text("ALTER TABLE deliveries ADD COLUMN accepted VARCHAR DEFAULT 'Pending'"))
        conn.commit()
        print("Column 'accepted' added successfully.")
    else:
        print("Column 'accepted' already exists.")
        
print("Migration completed.")
