#!/usr/bin/env python3
"""
Product Matching System for Price Comparison
Matches identical products across Tuš, Merkator, and Spar stores
Uses strict matching criteria to avoid false positives
"""

import re
import json
import csv
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
        
    def download_data(self) -> Dict[str, List[Dict]]:
        """Download product data from all three stores"""
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
        
        # Base similarity using SequenceMatcher
        ratio = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Extract quantities - MUST match for same product
        qty1, unit1 = self.extract_quantity_unit(name1)
        qty2, unit2 = self.extract_quantity_unit(name2)
        
        # If both have quantities, they MUST match
        if qty1 and qty2:
            if qty1 != qty2 or unit1 != unit2:
                return 0.0  # Different quantities = different products
        
        # Extract key words
        words1 = self.extract_key_words(name1)
        words2 = self.extract_key_words(name2)
        
        if not words1 or not words2:
            return 0.0
        
        # Calculate word overlap
        overlap = len(words1 & words2) / max(len(words1), len(words2))
        
        # STRICT matching: require high word overlap AND high sequence similarity
        if overlap < 0.4:
            return 0.0
        
        # Combined score: both must be high
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
            
            # Look for matches in other stores
            for j, product2 in enumerate(all_products[i+1:], start=i+1):
                if j in matched or product1['store'] == product2['store']:
                    continue
                
                similarity = self.similarity_score(product1['name'], product2['name'])
                
                # STRICT threshold: 0.75 (75% similarity required)
                if similarity > 0.75:
                    group.append(product2)
                    matched.add(j)
                    match_count += 1
                    print(f"✓ MATCH (score: {similarity:.3f}): {product1['store']:10} '{product1['name'][:40]:40}' <-> {product2['store']:10} '{product2['name'][:40]:40}'")
            
            # Only keep groups with multiple stores
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
            
            # Use longest name as canonical
            canonical_name = max([p['name'] for p in group], key=len)[:70]
            
            prices = {}
            for store in ['spar', 'merkator', 'tus']:
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
                
                row = [
                    canonical_name,
                    f"{prices.get('spar', ''):.2f}" if prices.get('spar') else "",
                    f"{prices.get('merkator', ''):.2f}" if prices.get('merkator') else "",
                    f"{prices.get('tus', ''):.2f}" if prices.get('tus') else "",
                    cheapest_store,
                    f"{difference:.2f}"
                ]
                output.append(','.join(row))
        
        return '\n'.join(output)
    
    def run(self):
        """Run the complete matching process"""
        print("Starting Product Matching System (STRICT MODE)...\n")
        
        all_data = self.download_data()
        matched_groups = self.match_products(all_data)
        comparison = self.create_comparison_sheet(matched_groups)
        
        with open('/home/ubuntu/matched_products.csv', 'w', encoding='utf-8') as f:
            f.write(comparison)
        
        print(f"\n{'='*80}")
        print(f"✓ Successfully matched {len(matched_groups)} product groups")
        print(f"✓ Results saved to /home/ubuntu/matched_products.csv")
        print(f"{'='*80}\n")
        
        # Show sample results
        if matched_groups:
            print("SAMPLE RESULTS (first 15 matches):")
            print("-" * 80)
            for i, group in enumerate(matched_groups[:15]):
                print(f"\n{i+1}. Product Group:")
                for product in group:
                    print(f"   {product['store']:10} | {product['name'][:55]:55} | {product['price']:8}")
        else:
            print("No matching products found with strict criteria.")
        
        return matched_groups


if __name__ == "__main__":
    matcher = ProductMatcher()
    matcher.run()
