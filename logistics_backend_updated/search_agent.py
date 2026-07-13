import os

def search_files(directory, query):
    print(f"Searching for '{query}' in {directory}:")
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.html')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for line_num, line in enumerate(f, 1):
                            if query in line:
                                print(f" {path}:{line_num} -> {line.strip()}")
                except Exception as e:
                    pass

search_files(r"C:\Users\yuvra\Downloads\logistics management\delivery-agent-dashboard\src\app", "updateDelivery")
