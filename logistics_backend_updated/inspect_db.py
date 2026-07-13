import os
from sqlalchemy import create_engine, inspect
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")
engine = create_engine(DATABASE_URL)
try:
    inspector = inspect(engine)
    columns = inspector.get_columns('deliveries')
    print("Columns in 'deliveries' table:")
    for col in columns:
        print(f" - {col['name']}: {col['type']}")
except Exception as e:
    print("Error connecting/inspecting DB:", e)