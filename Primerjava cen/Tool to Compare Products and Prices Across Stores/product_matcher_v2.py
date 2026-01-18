#!/usr/bin/env python3
"""
Product Matching System for Price Comparison
Matches identical products across Tuš, Merkator, and Spar stores
Uses fuzzy matching instead of AI to avoid rate limiting
"""

import re
import json
import csv
import time
from typing import List, Dict, Tuple, Set
from difflib import SequenceMatcher
from collections import defaultdict
import requests
from io import StringIO

class ProductMatcher:
    def __init__(self):
        self.stores = {
            'spar': 'https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv',
            'merkator': 'https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv',
            'tus': 'https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv'
        }
        self.products = defaultdict(list)
        self.matched_groups = []
        
    def download_data(self) -> Dict[str, List[Dict]]:
        """Download product data from all three stores"""
        all_data = {}
        
        for store_name, url in self.stores.items():
            print(f"Downloading {store_name} data...")
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                
                # Parse CSV
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
                print(f"✓ Downloaded {len(products)} products from {store_name}")
            except Exception as e:
                print(f"✗ Error downloading {store_name}: {e}")
                all_data[store_name] = []
        
        return all_data
    
    def normalize_text(self, text: str) -> str:
        """Normalize product name for comparison"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove store brand names
        text = re.sub(r'\b(spar|merkator|tuš|despar|s-budget|puro gusto|barcaffe|radenska|bio zone)\b', '', text)
        
        # Standardize units
        text = re.sub(r'\b(\d+)\s*g\b', r'\1g', text)
        text = re.sub(r'\b(\d+)\s*kg\b', r'\1kg', text)
        text = re.sub(r'\b(\d+)\s*ml\b', r'\1ml', text)
        text = re.sub(r'\b(\d+)\s*l\b', r'\1l', text)
        
        # Remove special characters but keep spaces and numbers
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text
    
    def extract_quantity_unit(self, name: str) -> Tuple[str, str]:
        """Extract quantity and unit from product name"""
        match = re.search(r'(\d+(?:,\d+)?)\s*(g|kg|ml|l|pcs?|kom|kos|jajc)', name.lower())
        if match:
            return match.group(1), match.group(2)
        return '', ''
    
    def extract_key_words(self, name: str) -> Set[str]:
        """Extract key words from product name"""
        normalized = self.normalize_text(name)
        words = set(normalized.split())
        # Remove very short words
        words = {w for w in words if len(w) > 2}
        return words
    
    def similarity_score(self, name1: str, name2: str) -> float:
        """Calculate similarity between two product names"""
        norm1 = self.normalize_text(name1)
        norm2 = self.normalize_text(name2)
        
        # Use SequenceMatcher for basic similarity
        ratio = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Extract quantities
        qty1, unit1 = self.extract_quantity_unit(name1)
        qty2, unit2 = self.extract_quantity_unit(name2)
        
        # If quantities exist and match, boost score
        if qty1 and qty2:
            if qty1 == qty2 and unit1 == unit2:
                ratio = min(1.0, ratio + 0.2)
            elif qty1 != qty2 or unit1 != unit2:
                # Different quantities - likely different products
                ratio = max(0, ratio - 0.3)
        
        # Extract key words and check overlap
        words1 = self.extract_key_words(name1)
        words2 = self.extract_key_words(name2)
        
        if words1 and words2:
            overlap = len(words1 & words2) / max(len(words1), len(words2))
            if overlap > 0.5:
                ratio = min(1.0, ratio + 0.1)
        
        return ratio
    
    def match_products(self, all_data: Dict[str, List[Dict]]) -> List[List[Dict]]:
        """Match products across stores"""
        
        print("\n" + "="*70)
        print("MATCHING PRODUCTS ACROSS STORES")
        print("="*70)
        
        # Create a list of all products with store info
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
        
        # Group products by similarity
        matched = set()
        groups = []
        
        for i, product1 in enumerate(all_products):
            if i in matched:
                continue
            
            group = [product1]
            matched.add(i)
            
            # Look for similar products in other stores
            for j, product2 in enumerate(all_products[i+1:], start=i+1):
                if j in matched:
                    continue
                
                # Skip if same store
                if product1['store'] == product2['store']:
                    continue
                
                # Calculate similarity
                similarity = self.similarity_score(product1['name'], product2['name'])
                
                # Threshold for matching
                if similarity > 0.65:
                    group.append(product2)
                    matched.add(j)
                    print(f"✓ MATCH (score: {similarity:.2f}): {product1['store']:10} '{product1['name'][:35]:35}' <-> {product2['store']:10} '{product2['name'][:35]:35}'")
            
            # Only keep groups with multiple stores
            if len(group) > 1:
                groups.append(group)
        
        print(f"\n✓ Found {len(groups)} matching product groups")
        return groups
    
    def create_comparison_sheet(self, groups: List[List[Dict]]) -> str:
        """Create a comparison sheet with matched products"""
        
        output = []
        output.append("PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR")
        
        for group in groups:
            # Get product info by store
            by_store = {p['store']: p for p in group}
            
            # Get canonical name (longest name as it usually has more info)
            canonical_name = max([p['name'] for p in group], key=len)[:60]
            
            # Get prices
            prices = {}
            for store in ['spar', 'merkator', 'tus']:
                if store in by_store:
                    price_str = by_store[store]['price'].replace('€', '').strip()
                    try:
                        price = float(price_str.replace(',', '.'))
                        prices[store] = price
                    except:
                        prices[store] = None
            
            # Find cheapest
            valid_prices = {k: v for k, v in prices.items() if v is not None}
            if valid_prices:
                cheapest_store = min(valid_prices, key=valid_prices.get)
                min_price = valid_prices[cheapest_store]
                max_price = max(valid_prices.values())
                difference = max_price - min_price
                
                row = [
                    canonical_name,
                    str(prices.get('spar', '')),
                    str(prices.get('merkator', '')),
                    str(prices.get('tus', '')),
                    cheapest_store,
                    f"{difference:.2f}"
                ]
                output.append(','.join(row))
        
        return '\n'.join(output)
    
    def run(self):
        """Run the complete matching process"""
        print("Starting Product Matching System...\n")
        
        # Download data
        all_data = self.download_data()
        
        # Match products
        matched_groups = self.match_products(all_data)
        
        # Create comparison sheet
        comparison = self.create_comparison_sheet(matched_groups)
        
        # Save results
        with open('/home/ubuntu/matched_products.csv', 'w', encoding='utf-8') as f:
            f.write(comparison)
        
        print(f"\n{'='*70}")
        print(f"✓ Successfully matched {len(matched_groups)} product groups")
        print(f"✓ Results saved to /home/ubuntu/matched_products.csv")
        print(f"{'='*70}\n")
        
        # Show sample results
        print("SAMPLE RESULTS (first 10 matches):")
        print("-" * 70)
        for i, group in enumerate(matched_groups[:10]):
            print(f"\n{i+1}. Product Group:")
            for product in group:
                print(f"   {product['store']:10} | {product['name'][:50]:50} | {product['price']:8}")
        
        return matched_groups


if __name__ == "__main__":
    matcher = ProductMatcher()
    matcher.run()
