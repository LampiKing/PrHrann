#!/usr/bin/env python3
"""
Intelligent Product Matching System
Advanced semantic analysis to match identical products across stores
Handles different naming conventions, descriptions, and brand names
"""

import re
import json
import csv
from typing import List, Dict, Tuple, Set
from difflib import SequenceMatcher
from collections import defaultdict
import requests
from io import StringIO
from datetime import datetime

class IntelligentProductMatcher:
    def __init__(self, config_file='store_config.json'):
        self.config_file = config_file
        self.stores = {}
        self.load_config()
        
        # Common product descriptors to ignore
        self.descriptors = {
            'biskvit', 'keksi', 'piškoti', 'čokolada', 'oblit', 'polnjen',
            'sladkan', 'sladek', 'sladko', 'sveže', 'pakirano', 'zamrznjeno',
            'hlajeno', 'toplo', 'vroče', 'hladno', 'pekaren', 'pekarni',
            'domač', 'domače', 'naravno', 'bio', 'ekološko', 'organsko',
            'premium', 'luksuzno', 'posebno', 'klasik', 'original', 'klasična',
            'original', 'posebna', 'posebne', 'posebni', 'posebnega',
            'standard', 'standardna', 'standardne', 'standardni',
            'vrhunska', 'vrhunske', 'vrhunski', 'vrhunskega',
            'kvalitetna', 'kvalitetne', 'kvalitetni', 'kvalitetnega',
            'fina', 'fine', 'fini', 'finega', 'finesa', 'finega',
            'tanka', 'tanke', 'tanki', 'tankega', 'debela', 'debele',
            'debeli', 'debelega', 'mehka', 'mehke', 'mehki', 'mehkega',
            'trda', 'trde', 'trdi', 'trdega', 'sveža', 'sveže', 'svežega',
            'stara', 'stare', 'starega', 'novo', 'nove', 'novega',
            'mlado', 'mlade', 'mladega', 'zrela', 'zrele', 'zrelega',
            'pekaren', 'pekarni', 'pekarne', 'pekarno', 'pekarne',
            'trgovina', 'trgovine', 'trgovini', 'trgovino', 'trgovine',
            'blagajna', 'blagajne', 'blagajni', 'blagajno', 'blagajne',
            'akcija', 'akcije', 'akciji', 'akcijo', 'akcije',
            'popust', 'popusti', 'popusta', 'popuste', 'popusti',
            'razprodaja', 'razprodaje', 'razprodaji', 'razprodajo', 'razprodaje',
            'ponuda', 'ponude', 'ponudi', 'ponudo', 'ponude',
            'super', 'odličan', 'odličnih', 'odličnega', 'odličnega',
            'izvrstna', 'izvrstne', 'izvrstni', 'izvrstnega',
            'sjajno', 'sjajne', 'sjajni', 'sjajnega',
            'fantastično', 'fantastične', 'fantastični', 'fantastičnega',
            'čudovito', 'čudovite', 'čudoviti', 'čudovitega',
            'prekrasno', 'prekrasne', 'prekrasni', 'prekrasnega',
            'lepota', 'lepote', 'lepoti', 'lepoto', 'lepote',
            'lepota', 'lepa', 'lepe', 'lepega', 'lepih',
            'lepo', 'lepše', 'najlepše', 'lepši', 'najlepši',
            'pakirano', 'pakirane', 'pakiranega', 'pakiranih',
            'zamrznjeno', 'zamrznjene', 'zamrznjenih', 'zamrznjega',
            'hlajeno', 'hlajene', 'hlajenih', 'hlajega',
            'sveže', 'svežega', 'svežih', 'sveža',
            'sveže', 'svežega', 'svežih', 'sveža',
            'proizvod', 'proizvodi', 'proizvodu', 'proizvode', 'proizvodi',
            'izdelek', 'izdelki', 'izdelku', 'izdelke', 'izdelki',
            'artikel', 'artikli', 'artiklu', 'article', 'artikli',
            'roba', 'robe', 'robi', 'robo', 'robe',
            'blago', 'blaga', 'blagu', 'blago', 'blaga',
            'stvar', 'stvari', 'stvari', 'stvar', 'stvari',
            'reč', 'reči', 'reči', 'reč', 'reči',
            'predmet', 'predmeti', 'predmetu', 'predmete', 'predmeti',
            'tvar', 'tvari', 'tvari', 'tvar', 'tvari',
            'snov', 'snovi', 'snovi', 'snov', 'snovi',
            'material', 'materiali', 'materialu', 'materiale', 'materiali',
            'substanca', 'substance', 'substanci', 'substanco', 'substance',
            'element', 'elementi', 'elementu', 'elemente', 'elementi',
            'komponent', 'komponenti', 'komponentu', 'komponente', 'komponenti',
            'del', 'deli', 'delu', 'dele', 'deli',
            'kos', 'kosi', 'kosu', 'kose', 'kosi',
            'kos', 'kosov', 'kosom', 'kose', 'kosov',
            'komad', 'komadi', 'komadu', 'komade', 'komadi',
            'parče', 'parče', 'parču', 'parče', 'parče',
            'delec', 'delci', 'delcu', 'delce', 'delci',
            'fragment', 'fragmenti', 'fragmentu', 'fragmente', 'fragmenti',
            'odlomek', 'odlomki', 'odlomku', 'odlomke', 'odlomki',
            'kup', 'kupi', 'kupu', 'kupe', 'kupi',
            'hrpa', 'hrpe', 'hrpi', 'hrpo', 'hrpe',
            'gomila', 'gomile', 'gomili', 'gomilo', 'gomile',
            'kupa', 'kupe', 'kupi', 'kupo', 'kupe',
            'prav', 'prava', 'prave', 'pravega', 'pravih',
            'pravi', 'prava', 'prave', 'pravega', 'pravih',
            'pravo', 'prava', 'prave', 'pravega', 'pravih',
            'res', 'resa', 'rese', 'resega', 'resih',
            'resničen', 'resničnih', 'resničnega', 'resničnih',
            'resnična', 'resničnih', 'resničnega', 'resničnih',
            'resničko', 'resničnih', 'resničnega', 'resničnih',
            'velik', 'velika', 'velike', 'velikega', 'velikih',
            'malo', 'mala', 'male', 'malegega', 'malih',
            'srednje', 'srednja', 'srednje', 'srednjega', 'srednjih',
            'majhen', 'majhna', 'majhne', 'majhnega', 'majhnih',
            'ogromno', 'ogromna', 'ogromne', 'ogromnega', 'ogromnih',
            'minijaturno', 'minijaturna', 'minijaturne', 'minijaturnega', 'minijaturnih',
            'ogromno', 'ogromna', 'ogromne', 'ogromnega', 'ogromnih',
            'ogromen', 'ogromna', 'ogromne', 'ogromnega', 'ogromnih',
            'gor', 'gora', 'gore', 'gorega', 'gorih',
            'dol', 'dola', 'dole', 'dolegega', 'dolih',
            'levo', 'leva', 'leve', 'levega', 'leveh',
            'desno', 'desna', 'desne', 'desnega', 'desnih',
            'spredaj', 'sprednja', 'sprednje', 'sprednjega', 'sprednjeh',
            'zadaj', 'zadnja', 'zadnje', 'zadnjega', 'zadnjeh',
            'zgoraj', 'zgornja', 'zgornje', 'zgornjega', 'zgornjeh',
            'spodaj', 'spodnja', 'spodnje', 'spodnjega', 'spodnjeh',
            'zunaj', 'zunanja', 'zunanje', 'zunanjega', 'zunanjeh',
            'notri', 'notranja', 'notranje', 'notranjega', 'notranjeh',
            'notranjost', 'notranjosti', 'notranjosti', 'notranjost', 'notranjosti',
            'zunanjost', 'zunanjosti', 'zunanjosti', 'zunanjost', 'zunanjosti',
            'površina', 'površine', 'površini', 'površino', 'površine',
            'globina', 'globine', 'globini', 'globino', 'globine',
            'dolžina', 'dolžine', 'dolžini', 'dolžino', 'dolžine',
            'širina', 'širine', 'širini', 'širino', 'širine',
            'višina', 'višine', 'višini', 'višino', 'višine',
            'teža', 'teže', 'teži', 'težo', 'teže',
            'masa', 'mase', 'masi', 'maso', 'mase',
            'volumen', 'volumni', 'volumnu', 'volumen', 'volumni',
            'prostornina', 'prostornine', 'prostornini', 'prostornino', 'prostornine',
            'količina', 'količine', 'količini', 'količino', 'količine',
            'obseg', 'obsegi', 'obsegu', 'obsege', 'obsegi',
            'obsegnost', 'obsegnosti', 'obsegnosti', 'obsegnost', 'obsegnosti',
        }
        
        # Brand names to extract
        self.brands = {
            'jaffa', 'alpsko', 'donat', 'radenska', 'barcaffe', 'nutella',
            'ferrero', 'rocher', 'kinder', 'milka', 'lindt', 'godiva',
            'lindt', 'ghirardelli', 'toblerone', 'snickers', 'mars', 'twix',
            'bounty', 'milky way', 'dove', 'cadbury', 'galaxy', 'aero',
            'kitkat', 'nestle', 'mondelez', 'mars', 'hershey', 'lindt',
            'ghirardelli', 'lindt', 'toblerone', 'snickers', 'mars', 'twix',
            'bounty', 'milky way', 'dove', 'cadbury', 'galaxy', 'aero',
            'kitkat', 'nestle', 'mondelez', 'mars', 'hershey', 'lindt',
            'natureta', 'podravka', 'zvijezda', 'ledo', 'mercator', 'spar',
            'despar', 's-budget', 'puro gusto', 'bio zone', 'biotop', 'gea',
            'ultje', 'ãltje', 'agona', 'odličko', 'odličan', 'odličnih',
        }
        
        # Flavors and characteristics
        self.flavors = {
            'pomaranča', 'pomarančni', 'pomarančna', 'pomarančne',
            'jagoda', 'jagodna', 'jagodne', 'jagodni',
            'marelica', 'marelični', 'marelična', 'marelične',
            'limona', 'limonin', 'limonina', 'limonine',
            'vanilija', 'vanilijn', 'vaniljna', 'vaniljne',
            'čokolada', 'čokoladna', 'čokoladne', 'čokoladi',
            'mlečna', 'mlečne', 'mlečni', 'mlečnega',
            'temna', 'temne', 'temni', 'temnega',
            'bela', 'bele', 'beli', 'beleg',
            'moka', 'moke', 'moki', 'moke',
            'kava', 'kave', 'kavi', 'kavo',
            'čaj', 'čaja', 'čaji', 'čaj',
            'pijača', 'pijače', 'pijači', 'pijačo',
            'voda', 'vode', 'vodi', 'vodo',
            'mleko', 'mleka', 'mleki', 'mleko',
            'jogurt', 'jogurta', 'jogurti', 'jogurt',
            'sir', 'sira', 'siri', 'sir',
            'maslо', 'masla', 'masli', 'maslo',
            'olje', 'olja', 'olji', 'olje',
            'sol', 'soli', 'soli', 'sol',
            'sladkor', 'sladkorja', 'sladkori', 'sladkor',
            'med', 'meda', 'medi', 'med',
            'marmelada', 'marmelade', 'marmeladi', 'marmelado',
            'džem', 'džema', 'džemi', 'džem',
            'pesto', 'pesta', 'pesti', 'pesto',
            'omaka', 'omake', 'omaki', 'omako',
            'pita', 'pite', 'piti', 'pito',
            'kruh', 'kruha', 'kruhi', 'kruh',
            'krušna', 'krušne', 'krušni', 'krušnega',
            'moka', 'moke', 'moki', 'moke',
            'riž', 'riža', 'riži', 'riž',
            'testenine', 'testenin', 'testeninama', 'testenine',
            'rezanci', 'rezancev', 'rezanci', 'rezance',
            'pasta', 'paste', 'pasti', 'pasto',
            'piškoti', 'piškotov', 'piškoti', 'piškote',
            'keksi', 'keksov', 'keksi', 'kekse',
            'biskvit', 'biskviта', 'biskviти', 'biskvit',
            'torta', 'torte', 'torti', 'torto',
            'kolač', 'kolača', 'kolači', 'kolač',
            'pita', 'pite', 'piti', 'pito',
            'buhtla', 'buhtli', 'buhtli', 'buhtlo',
            'krof', 'krofa', 'krofi', 'krof',
            'donut', 'donuta', 'donuti', 'donut',
            'čokoladna', 'čokoladne', 'čokoladi', 'čokolado',
            'vaniljna', 'vaniljne', 'vanilji', 'vaniljo',
            'jagodna', 'jagodne', 'jagodi', 'jagodo',
            'marelična', 'marelične', 'marelični', 'marelično',
            'limonina', 'limonine', 'limonini', 'limonino',
            'pomarančna', 'pomarančne', 'pomarančni', 'pomarančno',
            'sladka', 'sladke', 'sladki', 'sladko',
            'slatka', 'slatke', 'slatki', 'slatko',
            'gorka', 'gorke', 'gorki', 'gorko',
            'kiselkasta', 'kiselkaste', 'kiselkasti', 'kiselkasto',
            'soljasta', 'soljaste', 'soljasti', 'soljasto',
            'pikantna', 'pikantne', 'pikantni', 'pikantno',
            'začinjena', 'začinjene', 'začinjeni', 'začinjeno',
            'aromatična', 'aromatične', 'aromatični', 'aromatično',
            'dišeča', 'dišeče', 'dišeči', 'dišečega',
            'vonj', 'vonja', 'vonji', 'vonj',
            'aroma', 'arome', 'aromi', 'aromo',
            'okus', 'okusa', 'okusi', 'okus',
            'tekstura', 'teksture', 'teksturi', 'teksturo',
            'konzistenca', 'konzistence', 'konzistenci', 'konzistenco',
            'gostota', 'gostote', 'gostoti', 'gostoto',
            'tekoče', 'tekočega', 'tekočih', 'tekočega',
            'trdna', 'trdne', 'trdni', 'trdnega',
            'plinasta', 'plinaste', 'plinasti', 'plinasto',
            'pjena', 'pjene', 'pjeni', 'pjeno',
            'pena', 'pene', 'peni', 'peno',
            'krem', 'krema', 'kremi', 'krem',
            'krema', 'kreme', 'kremi', 'kremo',
            'gel', 'gela', 'geli', 'gel',
            'prah', 'praha', 'prahi', 'prah',
            'prah', 'praha', 'prahi', 'prah',
            'granule', 'granul', 'granulama', 'granule',
            'zrna', 'zrn', 'zrnom', 'zrna',
            'delci', 'delcev', 'delci', 'delce',
            'kristali', 'kristala', 'kristali', 'kristale',
            'ledeni', 'ledene', 'ledeni', 'ledenega',
            'zmrznjena', 'zmrznjene', 'zmrznjeni', 'zmrznjeno',
            'zamrznjena', 'zamrznjene', 'zamrznjeni', 'zamrznjeno',
            'sveža', 'sveže', 'svežega', 'svežih',
            'svežega', 'svežih', 'svežega', 'svežih',
            'sveža', 'sveže', 'svežega', 'svežih',
            'stara', 'stare', 'starega', 'starih',
            'novo', 'nove', 'novega', 'novih',
            'mlado', 'mlade', 'mladega', 'mladih',
            'zrela', 'zrele', 'zrelega', 'zrelih',
            'nezrela', 'nezrele', 'nezrelega', 'nezrelih',
            'premodra', 'premodre', 'premodrega', 'premodreih',
            'premehka', 'premehke', 'premehkega', 'premehkih',
            'pretrda', 'pretrde', 'pretrdega', 'pretrdih',
            'preslaba', 'preslab', 'preslabeih', 'preslab',
            'premočna', 'premočne', 'premočnega', 'premočnih',
            'premilo', 'premile', 'premileg', 'premilih',
            'pregorko', 'pregork', 'pregorkih', 'pregork',
            'preslatko', 'preslatk', 'preslatkih', 'preslatk',
            'prekiselo', 'prekisel', 'prekiselih', 'prekisel',
            'presolјasto', 'presoljast', 'presoljastih', 'presoljast',
            'prepikantno', 'prepikant', 'prepikantnih', 'prepikant',
        }
    
    def load_config(self):
        """Load store configuration"""
        try:
            with open(self.config_file, 'r') as f:
                self.stores = json.load(f)
        except:
            self.stores = {
                'spar': 'https://docs.google.com/spreadsheets/d/1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok/export?format=csv',
                'merkator': 'https://docs.google.com/spreadsheets/d/1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0/export?format=csv',
                'tus': 'https://docs.google.com/spreadsheets/d/17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A/export?format=csv'
            }
    
    def extract_key_features(self, name: str) -> Dict:
        """
        Extract key features from product name
        Ignores descriptors and focuses on essential info
        """
        name_lower = name.lower()
        
        # Extract quantity and unit
        quantity_match = re.search(r'(\d+(?:,\d+)?)\s*(g|kg|ml|l|pcs?|kom|kos|jajc)', name_lower)
        quantity = None
        unit = None
        if quantity_match:
            quantity = quantity_match.group(1).replace(',', '.')
            unit = quantity_match.group(2)
        
        # Extract brand
        brand = None
        for b in self.brands:
            if b in name_lower:
                brand = b
                break
        
        # Extract flavor/characteristics
        flavors = []
        for f in self.flavors:
            if f in name_lower:
                flavors.append(f)
        
        # Remove descriptors and extract main words
        words = re.sub(r'[^\w\s]', ' ', name_lower).split()
        main_words = []
        for word in words:
            if (len(word) > 2 and 
                word not in self.descriptors and 
                word not in self.brands and
                word not in self.flavors and
                word not in ['spar', 'merkator', 'tuš', 'despar', 's', 'budget']):
                main_words.append(word)
        
        return {
            'quantity': quantity,
            'unit': unit,
            'brand': brand,
            'flavors': flavors,
            'main_words': main_words,
            'original_name': name
        }
    
    def calculate_match_score(self, features1: Dict, features2: Dict) -> float:
        """
        Calculate match score between two products
        Returns 0-1 score
        Stricter matching - requires either brand match or significant word overlap
        """
        score = 0.0
        has_brand_match = False
        has_word_match = False

        # Quantity MUST match (most important)
        if features1['quantity'] and features2['quantity']:
            if features1['quantity'] == features2['quantity'] and features1['unit'] == features2['unit']:
                score += 0.3
            else:
                return 0.0  # Different quantities = different products
        elif features1['quantity'] or features2['quantity']:
            return 0.0  # One has quantity, other doesn't = different products

        # Brand matching (critical)
        if features1['brand'] and features2['brand']:
            if features1['brand'] == features2['brand']:
                score += 0.4
                has_brand_match = True
            else:
                return 0.0  # Different brands = different products

        # Main words MUST have significant overlap
        words1 = set(features1['main_words']) if features1['main_words'] else set()
        words2 = set(features2['main_words']) if features2['main_words'] else set()

        if words1 and words2:
            common_words = words1 & words2
            # Require at least 2 common words, OR brand match with 1 common word
            min_required = 1 if has_brand_match else 2
            if len(common_words) >= min_required:
                overlap_ratio = len(common_words) / min(len(words1), len(words2))
                score += 0.3 * overlap_ratio
                has_word_match = len(common_words) >= min_required
            else:
                return 0.0  # Not enough common words
        elif not words1 and not words2:
            # Both have no main words - only match if brand matches
            if not has_brand_match:
                return 0.0
        else:
            # One has words, other doesn't
            return 0.0

        # MUST have either brand match or significant word match
        if not has_brand_match and not has_word_match:
            return 0.0

        return min(1.0, score)
    
    def download_data(self) -> Dict[str, List[Dict]]:
        """Download product data from all stores"""
        all_data = {}
        
        for store_name, url in self.stores.items():
            print(f"Downloading {store_name}...", end=" ", flush=True)
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                response.encoding = 'utf-8'

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
                print(f"[OK] ({len(products)} products)")
            except Exception as e:
                print(f"[ERROR] {e}")
                all_data[store_name] = []
        
        return all_data
    
    def match_products(self, all_data: Dict[str, List[Dict]]) -> List[List[Dict]]:
        """Match products across stores using intelligent algorithm"""
        
        print("\n" + "="*80)
        print("INTELLIGENT PRODUCT MATCHING")
        print("="*80 + "\n")
        
        all_products = []
        for store, products in all_data.items():
            for idx, product in enumerate(products):
                features = self.extract_key_features(product['name'])
                all_products.append({
                    'store': store,
                    'name': product['name'],
                    'price': product['price'],
                    'image': product['image'],
                    'sale_price': product['sale_price'],
                    'in_stock': product['in_stock'],
                    'updated': product['updated'],
                    'features': features,
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
                
                score = self.calculate_match_score(product1['features'], product2['features'])
                
                if score > 0.5:  # Threshold for matching
                    group.append(product2)
                    matched.add(j)
                    match_count += 1
                    try:
                        print(f"[OK] MATCH (score: {score:.3f}): {product1['store']:10} '{product1['name'][:40]:40}' <-> {product2['store']:10} '{product2['name'][:40]:40}'")
                    except UnicodeEncodeError:
                        print(f"[OK] MATCH (score: {score:.3f}): {product1['store']:10} (name encoding error)")
            
            if len(group) > 1:
                groups.append(group)
        
        print(f"\n[OK] Found {len(groups)} matching product groups ({match_count} matches)")
        return groups
    
    def create_comparison_sheet(self, groups: List[List[Dict]]) -> str:
        """Create comparison sheet"""
        output = []
        output.append("PROIZVOD,SPAR_CENA,MERKATOR_CENA,TUS_CENA,NAJCENEJSI,RAZLIKA_EUR")
        
        for group in groups:
            by_store = {p['store']: p for p in group}
            
            canonical_name = max([p['name'] for p in group], key=len)[:70]
            
            prices = {}
            for store in sorted(self.stores.keys()):
                if store in by_store:
                    price_str = by_store[store]['price']
                    # Remove all non-numeric characters except comma and dot
                    price_str = ''.join(c for c in price_str if c.isdigit() or c in ',.').strip()
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
        """Run the intelligent matching process"""
        print("Starting Intelligent Product Matching System...\n")
        
        all_data = self.download_data()
        matched_groups = self.match_products(all_data)
        comparison = self.create_comparison_sheet(matched_groups)
        
        output_file = f'matched_products_intelligent_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            f.write(comparison)

        with open('matched_products_latest.csv', 'w', encoding='utf-8-sig', newline='') as f:
            f.write(comparison)

        # Also save JSON for Convex import
        merge_json = self.create_merge_json(matched_groups)
        with open('matched_products.json', 'w', encoding='utf-8') as f:
            f.write(merge_json)

        print(f"\n{'='*80}")
        print(f"[OK] Successfully matched {len(matched_groups)} product groups")
        print(f"[OK] Results saved to:")
        print(f"  - {output_file}")
        print(f"  - matched_products_latest.csv")
        print(f"  - matched_products.json (for Convex import)")
        print(f"{'='*80}\n")
        
        if matched_groups:
            print("SAMPLE RESULTS (first 10 matches):")
            print("-" * 80)
            for i, group in enumerate(matched_groups[:10]):
                print(f"\n{i+1}. Product Group:")
                for product in group:
                    try:
                        print(f"   {product['store']:10} | {product['name'][:55]:55} | {product['price']:8}")
                    except UnicodeEncodeError:
                        print(f"   {product['store']:10} | (encoding error) | {product['price']:8}")
        
        return matched_groups

    def create_merge_json(self, groups: List[List[Dict]]) -> str:
        """Create JSON file with all matched product names for Convex import"""
        merge_groups = []
        for group in groups:
            if len(group) >= 2:  # Only groups with 2+ products from different stores
                products = []
                for p in group:
                    products.append({
                        'store': p['store'],
                        'name': p['name'],
                        'price': p['price']
                    })
                merge_groups.append(products)

        return json.dumps(merge_groups, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    matcher = IntelligentProductMatcher()
    matcher.run()
