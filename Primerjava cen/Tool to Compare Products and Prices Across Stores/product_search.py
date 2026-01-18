#!/usr/bin/env python3
"""
Product Search and Comparison Tool
Search for products by name and compare prices across stores
"""

import re
import csv
import json
from typing import List, Dict
from difflib import SequenceMatcher
import requests
from io import StringIO
import json

class ProductSearcher:
    def __init__(self, config_file='store_config.json'):
        self.config_file = config_file
        self.stores = {}
        self.all_products = {}
        self.load_config()
        
    def load_config(self):
        """Load store configuration"""
        try:
            with open(self.config_file, 'r') as f:
                self.stores = json.load(f)
            print(f"✓ Loaded {len(self.stores)} stores from configuration")
        except:
            print("✗ Could not load configuration. Using defaults.")
            self.stores = {
                'spar': 'https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv',
                'merkator': 'https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv',
                'tus': 'https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv'
            }
    
    def download_all_products(self):
        """Download all products from all stores"""
        print("\n" + "="*80)
        print("DOWNLOADING PRODUCTS FROM ALL STORES")
        print("="*80 + "\n")
        
        for store_name, url in self.stores.items():
            print(f"Downloading {store_name}...", end=" ", flush=True)
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                
                reader = csv.DictReader(StringIO(response.text))
                products = []
                for row in reader:
                    if row.get('IME IZDELKA'):
                        products.append({
                            'name': row.get('IME IZDELKA', ''),
                            'price': row.get('CENA', ''),
                            'image': row.get('SLIKA', ''),
                            'sale_price': row.get('AKCIJSKA CENA', ''),
                            'in_stock': row.get('NA VOLJO', ''),
                            'updated': row.get('POSODOBLJENO', '')
                        })
                
                self.all_products[store_name] = products
                print(f"✓ ({len(products)} products)")
            except Exception as e:
                print(f"✗ Error: {e}")
                self.all_products[store_name] = []
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for searching"""
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        text = ' '.join(text.split())
        return text
    
    def search_products(self, search_term: str, min_similarity=0.5) -> Dict[str, List[Dict]]:
        """
        Search for products by name
        
        Args:
            search_term: Product name to search for
            min_similarity: Minimum similarity score (0.0-1.0)
        
        Returns:
            Dictionary with store names as keys and matching products as values
        """
        results = {}
        normalized_search = self.normalize_text(search_term)
        
        print(f"\n{'='*80}")
        print(f"SEARCHING FOR: '{search_term}'")
        print(f"{'='*80}\n")
        
        for store_name, products in self.all_products.items():
            matching_products = []
            
            for product in products:
                normalized_name = self.normalize_text(product['name'])
                
                # Calculate similarity
                similarity = SequenceMatcher(None, normalized_search, normalized_name).ratio()
                
                # Also check if search term appears in product name
                if normalized_search in normalized_name or similarity >= min_similarity:
                    matching_products.append({
                        'name': product['name'],
                        'price': product['price'],
                        'sale_price': product['sale_price'],
                        'in_stock': product['in_stock'],
                        'updated': product['updated'],
                        'similarity': similarity
                    })
            
            # Sort by similarity (highest first)
            matching_products.sort(key=lambda x: x['similarity'], reverse=True)
            results[store_name] = matching_products
        
        return results
    
    def display_search_results(self, search_term: str, results: Dict[str, List[Dict]]):
        """Display search results in a nice format"""
        total_found = sum(len(products) for products in results.values())
        
        if total_found == 0:
            print(f"✗ No products found for '{search_term}'")
            return
        
        print(f"✓ Found {total_found} matching products\n")
        
        for store_name, products in results.items():
            if products:
                print(f"\n{store_name.upper()} ({len(products)} products):")
                print("-" * 80)
                
                for i, product in enumerate(products[:10], 1):  # Show top 10
                    price_str = product['price'].replace('€', '').strip()
                    sale_price_str = product['sale_price'].replace('€', '').strip() if product['sale_price'] else ""
                    
                    print(f"{i}. {product['name'][:70]:70}")
                    print(f"   Cena: {product['price']:10}", end="")
                    if sale_price_str:
                        print(f" | Akcija: {product['sale_price']:10}", end="")
                    print(f" | Dostopno: {product['in_stock']}")
                    print()
                
                if len(products) > 10:
                    print(f"   ... and {len(products) - 10} more products")
    
    def compare_product(self, search_term: str) -> Dict:
        """
        Find the same product across all stores and compare prices
        
        Args:
            search_term: Product name to search for
        
        Returns:
            Comparison data
        """
        results = self.search_products(search_term, min_similarity=0.6)
        
        # Find the best match from each store
        comparison = {}
        for store_name, products in results.items():
            if products:
                comparison[store_name] = products[0]  # Best match
        
        return comparison
    
    def display_comparison(self, search_term: str, comparison: Dict):
        """Display price comparison"""
        if not comparison:
            print(f"✗ No products found for comparison: '{search_term}'")
            return
        
        print(f"\n{'='*80}")
        print(f"PRICE COMPARISON FOR: '{search_term}'")
        print(f"{'='*80}\n")
        
        # Extract prices
        prices = {}
        for store_name, product in comparison.items():
            price_str = product['price'].replace('€', '').strip()
            try:
                prices[store_name] = float(price_str.replace(',', '.'))
            except:
                prices[store_name] = None
        
        # Find cheapest
        valid_prices = {k: v for k, v in prices.items() if v is not None}
        if not valid_prices:
            print("✗ Could not parse prices")
            return
        
        cheapest_store = min(valid_prices, key=valid_prices.get)
        cheapest_price = valid_prices[cheapest_store]
        most_expensive_store = max(valid_prices, key=valid_prices.get)
        most_expensive_price = valid_prices[most_expensive_store]
        difference = most_expensive_price - cheapest_price
        savings_percent = (difference / most_expensive_price) * 100
        
        # Display results
        print("PRODUCT NAMES:")
        for store_name, product in comparison.items():
            print(f"  {store_name:12} | {product['name'][:60]:60}")
        
        print(f"\n{'PRICE COMPARISON':^80}")
        print("-" * 80)
        
        for store_name in sorted(valid_prices.keys()):
            price = valid_prices[store_name]
            is_cheapest = "✓ NAJCENEJŠA" if store_name == cheapest_store else ""
            print(f"  {store_name:12} | {price:8.2f}€ {is_cheapest}")
        
        print("-" * 80)
        print(f"  {'RAZLIKA':12} | {difference:8.2f}€ ({savings_percent:.1f}% savings)")
        print(f"  {'NAJCENEJŠA':12} | {cheapest_store.upper()} ({cheapest_price:.2f}€)")
        print(f"  {'NAJDRAŽJA':12} | {most_expensive_store.upper()} ({most_expensive_price:.2f}€)")
        print()
    
    def interactive_search(self):
        """Interactive search mode"""
        print("\n" + "="*80)
        print("INTERACTIVE PRODUCT SEARCH")
        print("="*80)
        print("Type 'quit' to exit\n")
        
        while True:
            search_term = input("Enter product name (e.g., 'Alpsko mleko'): ").strip()
            
            if search_term.lower() == 'quit':
                print("Goodbye!")
                break
            
            if not search_term:
                continue
            
            # Search and display results
            results = self.search_products(search_term)
            self.display_search_results(search_term, results)
            
            # Show comparison
            comparison = self.compare_product(search_term)
            self.display_comparison(search_term, comparison)


def main():
    """Main entry point"""
    import sys
    
    searcher = ProductSearcher()
    
    # Download all products
    searcher.download_all_products()
    
    if len(sys.argv) > 1:
        # Command line search
        search_term = ' '.join(sys.argv[1:])
        
        # Search and display results
        results = searcher.search_products(search_term)
        searcher.display_search_results(search_term, results)
        
        # Show comparison
        comparison = searcher.compare_product(search_term)
        searcher.display_comparison(search_term, comparison)
    else:
        # Interactive mode
        searcher.interactive_search()


if __name__ == "__main__":
    main()
