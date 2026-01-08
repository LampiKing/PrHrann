def find_context():
    try:
        with open("spar_dump.html", "r", encoding="utf-8") as f:
            content = f.read()
        
        # Search for "product-card" or "product-item"
        idx = content.find("product-card")
        if idx == -1:
            idx = content.find("product-item")
            
        if idx != -1:
            start = max(0, idx - 200)
            end = min(len(content), idx + 1000)
            print("--- Context Found ---")
            print(content[start:end])
        else:
            print("String not found in simple search.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_context()
