import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:data2026@localhost:5432/logistics_db")
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT pid, query, state, age(clock_timestamp(), query_start) FROM pg_stat_activity WHERE state != 'idle'"))
        rows = result.fetchall()
        print(f"Active connections count: {len(rows)}")
        for row in rows:
            print(f"PID: {row[0]} | State: {row[2]} | Age: {row[3]}")
            print(f"Query: {row[1]}")
            print("-" * 50)
except Exception as e:
    print("Error:", e)
