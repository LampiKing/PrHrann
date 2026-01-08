import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'sl-SI,sl;q=0.9,en;q=0.8',
}

def inspect(url, name):
    print(f"\n--- {name} ({url}) ---")
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        print(f"Status: {r.status_code}")
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Try to find links
        links = soup.find_all('a', href=True)
        print(f"Total links: {len(links)}")
        
        # Print first 10 links to see structure
        for l in links[:10]:
            print(f" - {l.text.strip()[:30]}: {l['href']}")
            
        # Specific checks
        if "spar" in name.lower():
            menu = soup.select('nav, .navigation, .menu')
            print(f"Menu elements: {len(menu)}")
            
        if "mercator" in name.lower():
             print(f"Title: {soup.title.string if soup.title else 'No title'}")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect("https://online.spar.si", "Spar")
    inspect("https://mercatoronline.si/brskaj", "Mercator")
    inspect("https://hitrinakup.com", "Hitri Nakup")
