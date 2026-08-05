import psycopg2
import sys

conn = psycopg2.connect('postgresql://postgres:data2026@logisticspro-db.c7aumsycgn94.ap-south-1.rds.amazonaws.com:5432/logistics_db')
cur = conn.cursor()
cur.execute('SELECT id, delivery_id, tracking_number, status, agent, agent_id, accepted, pickup_address, drop_address FROM deliveries ORDER BY id DESC LIMIT 15')
rows = cur.fetchall()
print(f"Total rows fetched: {len(rows)}")
for r in rows:
    print(dict(zip(['id', 'delivery_id', 'tracking_number', 'status', 'agent', 'agent_id', 'accepted', 'pickup_address', 'drop_address'], r)))
