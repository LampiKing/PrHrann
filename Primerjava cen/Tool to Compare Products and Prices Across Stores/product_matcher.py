#!/usr/bin/env python3
"""
Product Matching System for Price Comparison
Matches identical products across Tuš, Merkator, and Spar stores
"""

import re
import json
import csv
import time
from typing import List, Dict, Tuple
from difflib import SequenceMatcher
from collections import defaultdict
import requests
from io import StringIO
import os
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI()

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
        text = re.sub(r'\b(spar|merkator|tuš|despar|s-budget|puro gusto)\b', '', text)
        
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
    
    def extract_key_features(self, name: str) -> Dict:
        """Extract key features from product name"""
        features = {
            'quantity': None,
            'unit': None,
            'main_ingredient': None,
            'brand': None
        }
        
        # Extract quantity and unit
        match = re.search(r'(\d+(?:,\d+)?)\s*(g|kg|ml|l|pcs?|kom|kos)', name.lower())
        if match:
            features['quantity'] = match.group(1)
            features['unit'] = match.group(2)
        
        # Extract main ingredient (usually first meaningful word)
        normalized = self.normalize_text(name)
        words = normalized.split()
        if words:
            features['main_ingredient'] = words[0]
        
        # Extract brand
        brands = ['spar', 'merkator', 'tuš', 'despar', 's-budget', 'puro gusto', 'barcaffe', 'radenska']
        for brand in brands:
            if brand in name.lower():
                features['brand'] = brand
                break
        
        return features
    
    def similarity_score(self, name1: str, name2: str) -> float:
        """Calculate similarity between two product names"""
        norm1 = self.normalize_text(name1)
        norm2 = self.normalize_text(name2)
        
        # Use SequenceMatcher for basic similarity
        ratio = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Boost score if key features match
        features1 = self.extract_key_features(name1)
        features2 = self.extract_key_features(name2)
        
        if features1['main_ingredient'] and features2['main_ingredient']:
            if features1['main_ingredient'] == features2['main_ingredient']:
                ratio = min(1.0, ratio + 0.15)
        
        if features1['quantity'] and features2['quantity']:
            if features1['quantity'] == features2['quantity'] and features1['unit'] == features2['unit']:
                ratio = min(1.0, ratio + 0.1)
        
        return ratio
    
    def ai_match_products(self, products_batch: List[Tuple[str, str, str]]) -> Dict:
        """Use AI to match products from different stores"""
        
        # Format products for AI analysis
        products_text = "\n".join([
            f"{i+1}. Store: {store}, Product: {name}"
            for i, (store, name, _) in enumerate(products_batch)
        ])
        
        prompt = f"""Analyze these products from different stores and determine if they are the SAME PRODUCT:

{products_text}

Return a JSON object with:
- "is_match": true/false (are these the same product?)
- "confidence": 0-100 (how confident are you?)
- "reason": brief explanation
- "canonical_name": what should this product be called?

Be strict - only match if you're very confident these are identical products (same item, possibly different packaging size).
Return ONLY valid JSON, no other text."""

        try:
            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                max_tokens=500,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            result_text = response.choices[0].message.content
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except Exception as e:
            print(f"AI matching error: {e}")
        
        return {"is_match": False, "confidence": 0, "reason": "Error in AI matching"}
    
    def match_products(self, all_data: Dict[str, List[Dict]]) -> List[Dict]:
        """Match products across stores"""
        
        print("\n" + "="*60)
        print("MATCHING PRODUCTS ACROSS STORES")
        print("="*60)
        
        # Create a list of all products with store info
        all_products = []
        for store, products in all_data.items():
            for product in products:
                all_products.append({
                    'store': store,
                    'name': product['name'],
                    'price': product['price'],
                    'image': product['image'],
                    'sale_price': product['sale_price'],
                    'in_stock': product['in_stock'],
                    'updated': product['updated'],
                    'normalized_name': self.normalize_text(product['name'])
                })
        
        # Group products by similarity
        matched = set()
        groups = []
        
        for i, product1 in enumerate(all_products):
            if i in matched:
                continue
            
            group = [product1]
            matched.add(i)
            
            for j, product2 in enumerate(all_products[i+1:], start=i+1):
                if j in matched:
                    continue
                
                # Skip if same store
                if product1['store'] == product2['store']:
                    continue
                
                # Calculate similarity
                similarity = self.similarity_score(product1['name'], product2['name'])
                
                # If similarity is high enough, use AI to verify
                if similarity > 0.5:
                    ai_result = self.ai_match_products([
                        (product1['store'], product1['name'], product1['image']),
                        (product2['store'], product2['name'], product2['image'])
                    ])
                    
                    if ai_result.get('is_match') and ai_result.get('confidence', 0) > 70:
                        group.append(product2)
                        matched.add(j)
                        print(f"✓ Matched: {product1['store']} '{product1['name'][:40]}...' <-> {product2['store']} '{product2['name'][:40]}...'")
            
            if len(group) > 1:  # Only keep groups with multiple stores
                groups.append(group)
        
        return groups
    
    def create_comparison_sheet(self, groups: List[Dict]) -> str:
        """Create a comparison sheet with matched products"""
        
        output = []
        output.append("PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA")
        
        for group in groups:
            # Get product info by store
            by_store = {p['store']: p for p in group}
            
            # Get canonical name
            canonical_name = group[0]['name'][:50]  # Use first product name as canonical
            
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
        print("Starting Product Matching System...")
        
        # Download data
        all_data = self.download_data()
        
        # Match products
        matched_groups = self.match_products(all_data)
        
        # Create comparison sheet
        comparison = self.create_comparison_sheet(matched_groups)
        
        # Save results
        with open('/home/ubuntu/matched_products.csv', 'w', encoding='utf-8') as f:
            f.write(comparison)
        
        print(f"\n✓ Successfully matched {len(matched_groups)} product groups")
        print(f"✓ Results saved to /home/ubuntu/matched_products.csv")
        
        return matched_groups


if __name__ == "__main__":
    matcher = ProductMatcher()
    matcher.run()
