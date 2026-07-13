import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")
engine = create_engine(DATABASE_URL)
new_columns = [
    ("recipient_name", "VARCHAR"),
    ("recipient_address", "VARCHAR"),
    ("recipient_pincode", "VARCHAR"),
    ("sender_name", "VARCHAR"),
    ("sender_address", "VARCHAR"),
    ("sender_pincode", "VARCHAR"),
    ("package_description", "VARCHAR"),
    ("package_weight", "VARCHAR"),
    ("package_dimensions", "VARCHAR"),
    ("priority", "VARCHAR")
]
with engine.connect() as conn:
    # Get current columns
    result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='deliveries'"))
    existing_cols = {row[0] for row in result.fetchall()}

    print("Existing columns:", existing_cols)

    for col_name, col_type in new_columns:
        if col_name not in existing_cols:
            print(f"Adding column '{col_name}'...")
            conn.execute(text(f"ALTER TABLE deliveries ADD COLUMN {col_name} {col_type} NULL"))
            conn.commit()
            print(f"Column '{col_name}' added successfully.")
        else:
            print(f"Column '{col_name}' already exists.")

print("Migration completed.")
