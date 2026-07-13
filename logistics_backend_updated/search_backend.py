import os
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.py') and file != 'search_backend.py':
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'active_deliveries' in content:
                        print(f"Found 'active_deliveries' in {path}")
            except Exception as e:
                pass