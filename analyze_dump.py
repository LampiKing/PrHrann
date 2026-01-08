from bs4 import BeautifulSoup

def inspect_dump():
    try:
        with open("spar_dump.html", "r", encoding="utf-8") as f:
            content = f.read()
        
        soup = BeautifulSoup(content, 'html.parser')
        
        # Find first product card
        card = soup.select_one(".product-card, .product-item")
        if card:
            print("--- Product Card Found ---")
            print(card.prettify()[:1000]) # Print first 1000 chars of card
            
            # Check for title
            title = card.select_one("h4, .product-title, .title, a.title, .product-name")
            print(f"\nTitle detected: {title.text.strip() if title else 'None'}")
            
            # Check for price
            price = card.select_one(".price-value, .price, .current-price, .product-price")
            print(f"Price detected: {price.text.strip() if price else 'None'}")
        else:
            print("No .product-card or .product-item found in dump.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_dump()
