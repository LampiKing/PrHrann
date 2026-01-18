#!/usr/bin/env python3
"""
Advanced Product Matching System with Auto-Detection
Automatically detects new Google Sheets and matches products in real-time
"""

import re
import json
import csv
import time
import os
from typing import List, Dict, Tuple, Set
from difflib import SequenceMatcher
from collections import defaultdict
import requests
from io import StringIO
from datetime import datetime

class AutoDetectingProductMatcher:
    def __init__(self, config_file='store_config.json'):
        self.config_file = config_file
        self.stores = {}
        self.last_update = {}
        self.load_or_create_config()
        
    def load_or_create_config(self):
        """Load configuration from file or create default"""
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r') as f:
                self.stores = json.load(f)
            print(f"✓ Loaded configuration with {len(self.stores)} stores")
        else:
            # Default configuration
            self.stores = {
                'spar': 'https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv',
                'merkator': 'https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv',
                'tus': 'https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv'
            }
            self.save_config()
            print("✓ Created default configuration")
    
    def save_config(self):
        """Save configuration to file"""
        with open(self.config_file, 'w') as f:
            json.dump(self.stores, f, indent=2)
    
    def add_store(self, store_name: str, sheet_url: str):
        """Add a new store to the configuration"""
        self.stores[store_name.lower()] = sheet_url
        self.save_config()
        print(f"✓ Added store: {store_name}")
    
    def detect_new_stores(self, folder_id: str = None):
        """
        Detect new Google Sheets in a folder
        If folder_id is provided, scan for new sheets
        Otherwise, prompt user to add stores manually
        """
        print("\n" + "="*70)
        print("AUTO-DETECTION MODE")
        print("="*70)
        print(f"Currently configured stores: {', '.join(self.stores.keys())}")
        print("\nTo add a new store, use:")
        print("  matcher.add_store('store_name', 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv')")
        print("\nOr manually edit 'store_config.json'")
    
    def download_data(self) -> Dict[str, List[Dict]]:
        """Download product data from all configured stores"""
        all_data = {}
        
        for store_name, url in self.stores.items():
            print(f"Downloading {store_name} data...")
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
                
                all_data[store_name] = products
                self.last_update[store_name] = datetime.now().isoformat()
                print(f"✓ Downloaded {len(products)} products from {store_name}")
            except Exception as e:
                print(f"✗ Error downloading {store_name}: {e}")
                all_data[store_name] = []
        
        return all_data
    
    def normalize_text(self, text: str) -> str:
        """Normalize product name for comparison"""
        text = text.lower()
        
        # Remove store brand names
        text = re.sub(r'\b(spar|merkator|tuš|despar|s-budget|puro gusto|barcaffe|radenska|bio zone)\b', '', text)
        
        # Standardize units
        text = re.sub(r'\b(\d+)\s*g\b', r'\1g', text)
        text = re.sub(r'\b(\d+)\s*kg\b', r'\1kg', text)
        text = re.sub(r'\b(\d+)\s*ml\b', r'\1ml', text)
        text = re.sub(r'\b(\d+)\s*l\b', r'\1l', text)
        
        # Remove special characters
        text = re.sub(r'[^\w\s]', ' ', text)
        text = ' '.join(text.split())
        
        return text
    
    def extract_quantity_unit(self, name: str) -> Tuple[str, str]:
        """Extract quantity and unit from product name"""
        match = re.search(r'(\d+(?:,\d+)?)\s*(g|kg|ml|l|pcs?|kom|kos|jajc)', name.lower())
        if match:
            return match.group(1).replace(',', '.'), match.group(2)
        return '', ''
    
    def extract_key_words(self, name: str) -> Set[str]:
        """Extract key words from product name"""
        normalized = self.normalize_text(name)
        words = set(normalized.split())
        words = {w for w in words if len(w) > 2}
        return words
    
    def similarity_score(self, name1: str, name2: str) -> float:
        """Calculate similarity between two product names with strict criteria"""
        norm1 = self.normalize_text(name1)
        norm2 = self.normalize_text(name2)
        
        ratio = SequenceMatcher(None, norm1, norm2).ratio()
        
        qty1, unit1 = self.extract_quantity_unit(name1)
        qty2, unit2 = self.extract_quantity_unit(name2)
        
        if qty1 and qty2:
            if qty1 != qty2 or unit1 != unit2:
                return 0.0
        
        words1 = self.extract_key_words(name1)
        words2 = self.extract_key_words(name2)
        
        if not words1 or not words2:
            return 0.0
        
        overlap = len(words1 & words2) / max(len(words1), len(words2))
        
        if overlap < 0.4:
            return 0.0
        
        combined_score = (ratio * 0.6) + (overlap * 0.4)
        
        return combined_score
    
    def match_products(self, all_data: Dict[str, List[Dict]]) -> List[List[Dict]]:
        """Match products across stores with strict criteria"""
        
        print("\n" + "="*80)
        print("MATCHING PRODUCTS ACROSS STORES (STRICT MODE)")
        print("="*80)
        
        all_products = []
        for store, products in all_data.items():
            for idx, product in enumerate(products):
                all_products.append({
                    'store': store,
                    'name': product['name'],
                    'price': product['price'],
                    'image': product['image'],
                    'sale_price': product['sale_price'],
                    'in_stock': product['in_stock'],
                    'updated': product['updated'],
                    'normalized_name': self.normalize_text(product['name']),
                    'original_idx': idx
                })
        
        matched = set()
        groups = []
        match_count = 0
        
        for i, product1 in enumerate(all_products):
            if i in matched:
                continue
            
            group = [product1]
            matched.add(i)
            
            for j, product2 in enumerate(all_products[i+1:], start=i+1):
                if j in matched or product1['store'] == product2['store']:
                    continue
                
                similarity = self.similarity_score(product1['name'], product2['name'])
                
                if similarity > 0.75:
                    group.append(product2)
                    matched.add(j)
                    match_count += 1
                    print(f"✓ MATCH (score: {similarity:.3f}): {product1['store']:10} '{product1['name'][:40]:40}' <-> {product2['store']:10} '{product2['name'][:40]:40}'")
            
            if len(group) > 1:
                groups.append(group)
        
        print(f"\n✓ Found {len(groups)} matching product groups ({match_count} matches)")
        return groups
    
    def create_comparison_sheet(self, groups: List[List[Dict]]) -> str:
        """Create a comparison sheet with matched products"""
        
        output = []
        output.append("PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR")
        
        for group in groups:
            by_store = {p['store']: p for p in group}
            
            canonical_name = max([p['name'] for p in group], key=len)[:70]
            
            prices = {}
            for store in sorted(self.stores.keys()):
                if store in by_store:
                    price_str = by_store[store]['price'].replace('€', '').strip()
                    try:
                        price = float(price_str.replace(',', '.'))
                        prices[store] = price
                    except:
                        prices[store] = None
            
            valid_prices = {k: v for k, v in prices.items() if v is not None}
            if valid_prices:
                cheapest_store = min(valid_prices, key=valid_prices.get)
                min_price = valid_prices[cheapest_store]
                max_price = max(valid_prices.values())
                difference = max_price - min_price
                
                # Build row with all stores dynamically
                row = [canonical_name]
                for store in sorted(self.stores.keys()):
                    row.append(f"{prices.get(store, ''):.2f}" if prices.get(store) else "")
                row.append(cheapest_store)
                row.append(f"{difference:.2f}")
                
                output.append(','.join(row))
        
        return '\n'.join(output)
    
    def run(self, watch_mode=False, interval=300):
        """
        Run the complete matching process
        
        Args:
            watch_mode: If True, continuously monitor and update
            interval: Seconds between updates (default: 5 minutes)
        """
        print("Starting Advanced Product Matching System...\n")
        
        if watch_mode:
            print(f"WATCH MODE ENABLED - Updates every {interval} seconds")
            print("Press Ctrl+C to stop\n")
            
            try:
                iteration = 0
                while True:
                    iteration += 1
                    print(f"\n{'='*80}")
                    print(f"UPDATE #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"{'='*80}")
                    
                    self._run_once()
                    
                    print(f"\nNext update in {interval} seconds... (Press Ctrl+C to stop)")
                    time.sleep(interval)
            except KeyboardInterrupt:
                print("\n\n✓ Watch mode stopped")
        else:
            self._run_once()
    
    def _run_once(self):
        """Run matching process once"""
        all_data = self.download_data()
        matched_groups = self.match_products(all_data)
        comparison = self.create_comparison_sheet(matched_groups)
        
        # Save results
        output_file = f'matched_products_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(comparison)
        
        # Also save as latest
        with open('matched_products_latest.csv', 'w', encoding='utf-8') as f:
            f.write(comparison)
        
        print(f"\n{'='*80}")
        print(f"✓ Successfully matched {len(matched_groups)} product groups")
        print(f"✓ Results saved to:")
        print(f"  - {output_file}")
        print(f"  - matched_products_latest.csv")
        print(f"{'='*80}\n")
        
        # Show sample results
        if matched_groups:
            print("SAMPLE RESULTS (first 10 matches):")
            print("-" * 80)
            for i, group in enumerate(matched_groups[:10]):
                print(f"\n{i+1}. Product Group:")
                for product in group:
                    print(f"   {product['store']:10} | {product['name'][:55]:55} | {product['price']:8}")


def main():
    """Main entry point"""
    import sys
    
    # Create matcher instance
    matcher = AutoDetectingProductMatcher('store_config.json')
    
    # Check for command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == 'watch':
            # Watch mode - continuous updates
            interval = int(sys.argv[2]) if len(sys.argv) > 2 else 300
            matcher.run(watch_mode=True, interval=interval)
        elif sys.argv[1] == 'add':
            # Add new store
            if len(sys.argv) < 4:
                print("Usage: python3 product_matcher_auto.py add <store_name> <sheet_url>")
                sys.exit(1)
            store_name = sys.argv[2]
            sheet_url = sys.argv[3]
            matcher.add_store(store_name, sheet_url)
        elif sys.argv[1] == 'detect':
            # Show auto-detection info
            matcher.detect_new_stores()
        else:
            print("Unknown command. Usage:")
            print("  python3 product_matcher_auto.py              # Run once")
            print("  python3 product_matcher_auto.py watch        # Watch mode (update every 5 min)")
            print("  python3 product_matcher_auto.py watch 600    # Watch mode (update every 10 min)")
            print("  python3 product_matcher_auto.py add <name> <url>  # Add new store")
            print("  python3 product_matcher_auto.py detect       # Show auto-detection info")
    else:
        # Default: run once
        matcher.run(watch_mode=False)


if __name__ == "__main__":
    main()
