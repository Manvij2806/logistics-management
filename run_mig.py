import sys
sys.path.append('/home/ubuntu/logistics-management/logistics_backend_updated')
from database import init_db
print("Running init_db...")
init_db()
print("Done!")
