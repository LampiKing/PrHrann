"""
PrHran Product Matcher - ULTIMATE EDITION
==========================================
Najboljši možni algoritem za ujemanje istih izdelkov iz različnih trgovin.

Primer:
- Spar: "Alpsko mleko 3,5% m.m. 1L"
- Mercator: "Mleko ALPSKO polnomastno 3,5% 1 liter"
- Tuš: "ALPSKO MLEKO polnomastno 1l 3.5%"
-> Vsi dobijo isti match_id!

Pristop:
1. Normalizacija - lowercase, odstrani šumnike, poenostavi
2. Ekstrakcija - znamka, količina, enota, %
3. Signature - unikaten podpis izdelka
4. Fuzzy matching - rapidfuzz za ujemanje
5. Image matching - ujemanje po URL slik
6. Multi-pass matching - več korakov za boljše rezultate
"""

import re
import hashlib
from typing import Optional, List, Dict, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict
from urllib.parse import urlparse

try:
    from rapidfuzz import fuzz, process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False
    print("[Warning] rapidfuzz not installed, using basic matching")

try:
    from unidecode import unidecode
    UNIDECODE_AVAILABLE = True
except ImportError:
    UNIDECODE_AVAILABLE = False
    print("[Warning] unidecode not installed, using basic normalization")


# ============================================
# 250+ ZNANIH BLAGOVNIH ZNAMK
# ============================================

KNOWN_BRANDS = {
    # ===== MLEČNI IZDELKI =====
    "alpsko", "mu", "ego", "activia", "danone", "jogobella", "zott", "meggle",
    "ljubljanske mlekarne", "lm", "pomurske mlekarne", "zelene doline", "z bregov",
    "parmalat", "lactalis", "dukat", "vindija", "planika", "vipava", "krepko",
    "skuta", "skyr", "actimel", "fantastik", "president", "gervais", "philadelphia",
    "hochland", "mileram", "rama", "becel", "flora", "lurpak", "kerrygold",
    "pettit suisse", "monte", "frutek", "jogurtina", "jošt", "turek",

    # ===== PIJAČE =====
    "coca-cola", "coca cola", "coke", "pepsi", "pepsi cola", "fanta", "sprite",
    "schweppes", "7up", "mirinda", "mountain dew", "dr pepper",
    "radenska", "donat mg", "donat", "costella", "jamnica", "dana", "zala",
    "vodavoda", "voda voda", "aqua viva", "jana", "mg mivela",
    "red bull", "monster", "hell", "burn", "rockstar",
    "cedevita", "fruc", "fructal", "ora", "jupi", "cockta", "pipi",
    "union", "laško", "lasko", "zlatorog", "heineken", "tuborg", "corona",
    "budweiser", "stella artois", "becks", "guinness", "leffe", "hoegaarden",
    "jägermeister", "jagermeister", "stock", "pelinkovac", "badel",
    "smirnoff", "absolut", "finlandia", "grey goose", "belvedere",
    "johnnie walker", "jack daniels", "jim beam", "chivas regal", "ballantines",

    # ===== SOKOVI =====
    "rauch", "happy day", "cappy", "granini", "hohes c", "santal",
    "bravo", "juicy", "pfanner", "rio", "marli", "minute maid",
    "tropicana", "innocent", "naked", "ocean spray",

    # ===== ČOKOLADE IN SLADKARIJE =====
    "milka", "lindt", "ferrero", "kinder", "nutella", "raffaello", "rocher",
    "mars", "snickers", "twix", "bounty", "m&m", "maltesers", "celebrations",
    "haribo", "katjes", "trolli", "maoam", "nimm2",
    "ritter sport", "toblerone", "merci", "after eight",
    "orbit", "mentos", "tic tac", "airwaves", "vivident", "stimorol",
    "gorenjka", "dorina", "kraš", "pionir", "zvečevo", "kandit",
    "bajadera", "griotte", "rum kokos", "čokolešnik", "bronhi",
    "cedevita", "lino", "čoko", "eurocrem", "jaffa",

    # ===== KAVA IN ČAJ =====
    "nescafe", "nescafé", "jacobs", "lavazza", "illy", "segafredo", "dallmayr",
    "douwe egberts", "tchibo", "melitta", "carte noire", "kenco",
    "barcaffe", "barcafe", "franck", "zlatna džezva", "grand kafa", "doncafe",
    "lipton", "teekanne", "pickwick", "milford", "twinings", "ahmad", "dilmah",
    "tetley", "pg tips", "yorkshire",

    # ===== ZAJTRK IN ŽITA =====
    "nutella", "lino lada", "eurokrem", "nutkao",
    "kelloggs", "kellogg's", "nestle", "nestlé", "fitness", "cheerios",
    "cini minis", "lion", "cookie crisp", "nesquik", "chocapic",
    "musli", "musli vitanella", "crownfield",
    "corn flakes", "rice krispies", "frosties", "special k",
    "ovseni", "oatmeal", "quaker",

    # ===== PECIVO =====
    "jaffa", "domačica", "domacica", "domaćica", "petit beurre",
    "napolitanke", "jadro", "koestlin", "koštlin",
    "oreo", "belvita", "balconi", "barni", "biscoff",
    "hit", "tuc", "ritz", "crackers", "grissini",
    "7days", "dan cake", "croissant",

    # ===== TESTENINE IN RIŽ =====
    "barilla", "de cecco", "buitoni", "divella", "voiello", "garofalo",
    "rio", "zlato polje", "mlinotest", "žito",
    "uncle bens", "uncle ben's", "riso gallo", "scotti", "arborio",

    # ===== KONZERVE IN OMAKE =====
    "rio mare", "princes", "john west", "eva", "podravka",
    "natureta", "bonduelle", "d'aucy", "globus",
    "heinz", "hellmann's", "hellmanns", "knorr", "maggi", "vegeta",
    "kečap", "ketchup", "majoneza", "gorčica", "mustard",

    # ===== MESO IN MESNI IZDELKI =====
    "poli", "celjske mesnine", "pivka", "kras", "kraš",
    "kranjska", "perutnina ptuj", "mesnine štajerske", "štajerske mesnine",
    "carnex", "zlatar", "gavrilović", "argeta",
    "mortadela", "salama", "šunka", "pršut", "buđola",

    # ===== OSEBNA NEGA =====
    "nivea", "dove", "palmolive", "fa", "rexona", "axe", "old spice",
    "lynx", "sure", "degree",
    "head shoulders", "head & shoulders", "pantene", "loreal", "l'oreal",
    "garnier", "schwarzkopf", "syoss", "gliss kur", "elseve",
    "schauma", "timotei", "herbal essences", "tresemme",
    "oral-b", "colgate", "sensodyne", "meridol", "elmex", "signal",
    "listerine", "parodontax", "lacalut", "blend-a-med",
    "always", "libresse", "ob", "kotex", "naturella",
    "pampers", "huggies", "baby dry", "active fit",
    "gillette", "venus", "wilkinson", "bic",
    "neutrogena", "clean & clear", "clearasil",

    # ===== ČISTILA =====
    "ajax", "cif", "domestos", "fairy", "jar", "pur", "somat", "finish",
    "calgon", "vanish", "ariel", "persil", "omo", "surf", "perwoll", "tide",
    "lenor", "silan", "coccolino", "vernel", "softlan",
    "bref", "wc net", "cillit bang", "mr proper", "meister proper",
    "pronto", "pledge", "air wick", "glade", "febreze",
    "savo", "domestos", "klorin",

    # ===== HRANA ZA ŽIVALI =====
    "whiskas", "kitekat", "felix", "sheba", "perfect fit",
    "pedigree", "cesar", "chappi", "friskies", "gourmet",
    "purina", "one", "pro plan", "royal canin", "hills",

    # ===== TRGOVSKE ZNAMKE =====
    "s budget", "spar", "spar premium", "spar natur pur", "spar vital",
    "spar free from", "spar veggie", "spar enjoy", "despar",
    "mercator", "m klasik", "m bio", "lumpi", "dona", "rondo",
    "tuš", "tus", "tušev izbor", "tuš premium",
    "aro", "tip", "k classic", "k bio", "ja", "gut & günstig",
    "milbona", "pilos", "pikok", "chef select", "deluxe", "cien",
    "w5", "denkmit", "balea", "alverde",

    # ===== BIO IN EKO =====
    "bio", "eko", "organic", "demeter", "biodar", "alnatura",
    "hofer bio", "spar natur pur", "naturland",

    # ===== DRUGE ZNANE ZNAMKE =====
    "dr oetker", "dr. oetker", "oetker", "knorr", "maggi", "podravka",
    "vegeta", "maestro", "dolcela", "c vitamini",
}

# Pretvori v set za hitrejše iskanje
KNOWN_BRANDS_SET = set(b.lower() for b in KNOWN_BRANDS)

# ============================================
# KANONIČNE OBLIKE BLAGOVNIH ZNAMK
# ============================================
# Mapira vse variante na eno kanonično obliko

BRAND_CANONICAL = {
    # Coca-Cola variante
    "coca-cola": "cocacola", "coca cola": "cocacola", "coke": "cocacola",
    "pepsi cola": "pepsi", "pepsi-cola": "pepsi",
    # Nescafe variante
    "nescafe": "nescafe", "nescafé": "nescafe",
    # Kellogg's variante
    "kelloggs": "kelloggs", "kellogg's": "kelloggs",
    # Nestlé variante
    "nestle": "nestle", "nestlé": "nestle",
    # L'Oreal variante
    "loreal": "loreal", "l'oreal": "loreal",
    # Laško variante
    "laško": "lasko", "lasko": "lasko",
    # Hellmann's variante
    "hellmann's": "hellmanns", "hellmanns": "hellmanns",
    # Dr. Oetker variante
    "dr oetker": "droetker", "dr. oetker": "droetker", "oetker": "droetker",
    # Head & Shoulders variante
    "head shoulders": "headshoulders", "head & shoulders": "headshoulders",
    # Uncle Ben's variante
    "uncle bens": "unclebens", "uncle ben's": "unclebens",
    # Tuš variante
    "tuš": "tus", "tus": "tus", "tušev izbor": "tus", "tuš premium": "tus",
    # Kraš variante
    "kraš": "kras", "kras": "kras",
    # Čoko variante
    "čoko": "coko", "čokolešnik": "cokolesnik",
    # Jägermeister variante
    "jägermeister": "jagermeister", "jagermeister": "jagermeister",
    # Gut & Günstig variante
    "gut & günstig": "gutgunstig",
}

def get_canonical_brand(brand: str) -> str:
    """Vrni kanonično obliko blagovne znamke"""
    if not brand:
        return None
    brand_lower = brand.lower().strip()
    # Najprej preveri direktno mapiranje
    if brand_lower in BRAND_CANONICAL:
        return BRAND_CANONICAL[brand_lower]
    # Nato normaliziraj (odstrani pomišljaje, presledke, šumnike)
    normalized = brand_lower.replace("-", "").replace(" ", "").replace("'", "")
    if UNIDECODE_AVAILABLE:
        normalized = unidecode(normalized)
    return normalized

# Ustvari dict za hitro iskanje (podporna lista variant)
BRAND_VARIANTS = {}
for brand in KNOWN_BRANDS_SET:
    canonical = get_canonical_brand(brand)
    BRAND_VARIANTS[brand] = canonical
    # Dodaj variante brez šumnikov
    if UNIDECODE_AVAILABLE:
        normalized = unidecode(brand)
        if normalized != brand:
            BRAND_VARIANTS[normalized] = canonical
    # Dodaj variante brez presledkov
    no_space = brand.replace(" ", "")
    if no_space != brand:
        BRAND_VARIANTS[no_space] = canonical
    # Dodaj variante s pomišljaji
    with_dash = brand.replace(" ", "-")
    if with_dash != brand:
        BRAND_VARIANTS[with_dash] = canonical
    # Dodaj variante brez pomišljajev
    no_dash = brand.replace("-", " ")
    if no_dash != brand:
        BRAND_VARIANTS[no_dash] = canonical


# ============================================
# ENOTE IN KOLIČINE
# ============================================

UNIT_PATTERNS = {
    # Teža
    r"(\d+(?:[,.]\d+)?)\s*kg\b": ("g", 1000),
    r"(\d+(?:[,.]\d+)?)\s*g\b": ("g", 1),
    r"(\d+(?:[,.]\d+)?)\s*dag\b": ("g", 10),
    r"(\d+(?:[,.]\d+)?)\s*dkg\b": ("g", 10),

    # Volumen
    r"(\d+(?:[,.]\d+)?)\s*l\b": ("ml", 1000),
    r"(\d+(?:[,.]\d+)?)\s*ml\b": ("ml", 1),
    r"(\d+(?:[,.]\d+)?)\s*cl\b": ("ml", 10),
    r"(\d+(?:[,.]\d+)?)\s*dl\b": ("ml", 100),

    # Kosi
    r"(\d+)\s*(?:kos|kom|pcs?|st|kosov|komadov)\b": ("kos", 1),
}

# Normalizacija enot
UNIT_NORMALIZE = {
    "liter": "l", "litre": "l", "litrov": "l", "litra": "l",
    "gram": "g", "gramov": "g", "grama": "g",
    "kilogram": "kg", "kilogramov": "kg",
    "mililiter": "ml", "mililitrov": "ml",
    "deciliter": "dl", "centiliter": "cl",
    "kosov": "kos", "komad": "kos", "komada": "kos", "piece": "kos",
}


# ============================================
# PRODUCT NORMALIZER
# ============================================

class ProductNormalizer:
    """Normalizira ime izdelka za boljše ujemanje"""

    STOPWORDS = {
        # Slovenščina
        "za", "in", "ali", "z", "s", "iz", "po", "na", "od", "do", "pri",
        "kot", "brez", "samo", "še", "tudi", "lahko", "pa", "ter", "je",
        # Opisi
        "nov", "nova", "novo", "novi", "nove",
        "akcija", "akcijski", "akcijska", "promo",
        "super", "extra", "premium", "klasik", "classic", "original",
        "family", "pack", "maxi", "mini", "xxl", "xl", "jumbo", "mega",
        # Trgovine
        "spar", "mercator", "tus", "tuš", "hofer", "lidl",
    }

    SYNONYMS = {
        # Mleko
        "polnomastno": "3.5%", "polnomastni": "3.5%",
        "delno posneto": "1.5%", "pol posneto": "1.5%",
        "posneto": "0.5%", "low fat": "0.5%",
        "m.m.": "", "mlečne maščobe": "", "maščobe": "",
        # Meso
        "piščanec": "piščančje", "piščančji": "piščančje",
        "goveje": "govedina", "goveja": "govedina", "beef": "govedina",
        "svinjsko": "svinjina", "svinjska": "svinjina", "pork": "svinjina",
        "puranje": "puran", "turkey": "puran",
        # Splošno
        "bio": "ekološki", "eko": "ekološki", "organic": "ekološki",
        "brez glutena": "gluten free", "lactose free": "brez laktoze",
    }

    @staticmethod
    def normalize(name: str) -> str:
        """Normaliziraj ime izdelka"""
        if not name:
            return ""

        text = name.lower().strip()

        # Odstrani šumnike
        if UNIDECODE_AVAILABLE:
            text = unidecode(text)
        else:
            for k, v in {"č": "c", "ć": "c", "š": "s", "ž": "z", "đ": "d"}.items():
                text = text.replace(k, v)

        # Zamenjaj sinonime
        for old, new in ProductNormalizer.SYNONYMS.items():
            text = text.replace(old.lower(), new.lower())

        # Normaliziraj enote
        for old, new in UNIT_NORMALIZE.items():
            text = re.sub(rf"\b{old}\b", new, text, flags=re.I)

        # Normaliziraj decimalke
        text = re.sub(r"(\d+),(\d+)", r"\1.\2", text)

        # Odstrani odvečne znake
        text = re.sub(r"[^\w\s\d.%/x-]", " ", text)

        # Več presledkov v enega
        text = re.sub(r"\s+", " ", text).strip()

        # Odstrani stopwords
        words = text.split()
        words = [w for w in words if w not in ProductNormalizer.STOPWORDS]
        text = " ".join(words)

        return text

    @staticmethod
    def create_tokens(name: str) -> Set[str]:
        """Ustvari set tokenov za primerjavo"""
        text = ProductNormalizer.normalize(name)
        # Odstrani številke za token primerjavo
        words = text.split()
        tokens = set()
        for w in words:
            if len(w) > 2 and not w.replace(".", "").isdigit():
                tokens.add(w)
        return tokens


# ============================================
# PRODUCT EXTRACTOR
# ============================================

@dataclass
class ProductFeatures:
    """Ekstrahirane lastnosti izdelka"""
    brand: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    fat_percent: Optional[float] = None
    pack_count: Optional[int] = None
    pack_unit_size: Optional[float] = None
    product_type: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    image_hash: Optional[str] = None


class ProductExtractor:
    """Ekstrahira lastnosti iz imena izdelka"""

    PRODUCT_TYPES = {
        "mleko": ["mleko", "milk", "mlijeko", "mleka"],
        "jogurt": ["jogurt", "yogurt", "joghurt", "skyr", "kefir"],
        "sir": ["sir", "cheese", "parmezan", "gauda", "edamec", "feta", "mozzarella", "mascarpone", "ricotta"],
        "maslo": ["maslo", "butter", "margarina", "margarine"],
        "smetana": ["smetana", "cream", "vrhnje", "kisla smetana"],
        "sok": ["sok", "juice", "nektar", "nectar", "smoothie"],
        "gazirana": ["coca-cola", "coca cola", "pepsi", "fanta", "sprite", "schweppes", "7up", "mirinda", "cockta", "pipi", "cedevita"],
        "energijska": ["red bull", "monster", "hell", "burn", "rockstar", "energy"],
        "voda": ["voda", "water", "mineralna", "gazirana", "naravna", "radenska", "donat", "jana"],
        "pivo": ["pivo", "beer", "ale", "lager", "radler", "pils", "union", "laško", "heineken"],
        "vino": ["vino", "wine", "rdece", "belo", "rose"],
        "cokolada": ["cokolada", "chocolate", "čokolada", "kakav", "cocoa", "milka", "lindt", "gorenjka"],
        "kava": ["kava", "coffee", "espresso", "cappuccino", "latte", "nescafe", "jacobs", "barcaffe"],
        "caj": ["caj", "tea", "čaj", "zeleni", "črni", "zeliščni", "lipton", "teekanne"],
        "kruh": ["kruh", "bread", "toast", "žemlja", "zemlja", "pecivo"],
        "moka": ["moka", "flour", "moko", "bela", "polnozrnata"],
        "riz": ["riz", "rice", "riza", "basmati", "jasmin"],
        "testenine": ["testenine", "pasta", "špageti", "spaghetti", "makaroni", "penne", "fusilli", "tagliatelle", "barilla"],
        "olje": ["olje", "oil", "olivno", "soncnicno", "repicno"],
        "kis": ["kis", "vinegar", "balzamik", "jabolcni"],
        "sol": ["sol", "salt", "morska", "himalajska"],
        "sladkor": ["sladkor", "sugar", "cukor", "rjavi", "beli"],
        "jajca": ["jajca", "eggs", "jajce", "prostorejne"],
        "meso": ["meso", "piščanec", "piščančje", "govedina", "svinjina", "puran", "riba", "file", "steak", "zrezek"],
        "namaz": ["nutella", "lino lada", "eurokrem", "marmelada", "džem", "med", "namaz"],
        "pecivo": ["keksi", "piškoti", "napolitanke", "oreo", "domačica", "jaffa", "croissant"],
    }

    @staticmethod
    def extract(name: str, image_url: str = None) -> ProductFeatures:
        """Ekstrahiraj lastnosti iz imena"""
        features = ProductFeatures()
        normalized = ProductNormalizer.normalize(name)
        original_lower = name.lower()

        # 1. Najdi blagovno znamko (KANONIČNA OBLIKA)
        found_brand = None
        for brand in KNOWN_BRANDS_SET:
            if brand in original_lower or brand in normalized:
                found_brand = brand
                break

        # Poskusi tudi variante
        if not found_brand:
            for variant in BRAND_VARIANTS.keys():
                if variant in original_lower or variant in normalized:
                    found_brand = variant
                    break

        # Pretvori v kanonično obliko
        if found_brand:
            features.brand = get_canonical_brand(found_brand)

        # 2. Najdi količino in enoto
        pack_match = re.search(r"(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(g|ml|l|kg|cl|dl)", normalized)
        if pack_match:
            features.pack_count = int(pack_match.group(1))
            size = float(pack_match.group(2).replace(",", "."))
            unit = pack_match.group(3).lower()

            # Normaliziraj na g/ml
            if unit == "kg":
                size *= 1000
                unit = "g"
            elif unit == "l":
                size *= 1000
                unit = "ml"
            elif unit == "cl":
                size *= 10
                unit = "ml"
            elif unit == "dl":
                size *= 100
                unit = "ml"

            features.pack_unit_size = size
            features.quantity = size * features.pack_count
            features.unit = unit
        else:
            for pattern, (base_unit, multiplier) in UNIT_PATTERNS.items():
                match = re.search(pattern, normalized, re.I)
                if match:
                    try:
                        value = float(match.group(1).replace(",", "."))
                        features.quantity = value * multiplier
                        features.unit = base_unit
                        break
                    except:
                        pass

        # 3. Najdi % maščobe
        fat_match = re.search(r"(\d+(?:[.,]\d+)?)\s*%", normalized)
        if fat_match:
            try:
                features.fat_percent = float(fat_match.group(1).replace(",", "."))
            except:
                pass

        # 4. Najdi vrsto izdelka
        for product_type, keywords in ProductExtractor.PRODUCT_TYPES.items():
            for kw in keywords:
                if kw in original_lower or kw in normalized:
                    features.product_type = product_type
                    break
            if features.product_type:
                break

        # 5. Ključne besede
        words = normalized.split()
        features.keywords = [w for w in words if len(w) > 2 and not w.replace(".", "").isdigit()]

        # 6. Image hash (za ujemanje po slikah)
        if image_url:
            features.image_hash = ProductExtractor.get_image_hash(image_url)

        return features

    @staticmethod
    def get_image_hash(url: str) -> Optional[str]:
        """Ustvari hash iz URL slike za ujemanje"""
        if not url:
            return None

        try:
            # Normaliziraj URL - odstrani query params, protokol
            parsed = urlparse(url)
            # Vzemi samo path in filename
            path = parsed.path.lower()

            # Odstrani common prefixes
            path = re.sub(r"^/images?/", "", path)
            path = re.sub(r"^/products?/", "", path)
            path = re.sub(r"^/media/", "", path)

            # Odstrani size suffixes
            path = re.sub(r"[-_]\d{2,4}x\d{2,4}", "", path)
            path = re.sub(r"[-_](small|medium|large|thumb|xl)", "", path, flags=re.I)

            # Vzemi samo ime datoteke
            filename = path.split("/")[-1]
            # Odstrani extension
            filename = re.sub(r"\.(jpg|jpeg|png|gif|webp)$", "", filename, flags=re.I)

            if len(filename) > 5:
                return hashlib.md5(filename.encode()).hexdigest()[:12]
        except:
            pass

        return None


# ============================================
# PRODUCT SIGNATURE
# ============================================

class ProductSignature:
    """Ustvari unikaten podpis za izdelek"""

    @staticmethod
    def create(name: str, features: ProductFeatures = None) -> str:
        """Ustvari signature za izdelek"""
        if features is None:
            features = ProductExtractor.extract(name)

        parts = []

        # 1. Blagovna znamka
        if features.brand:
            parts.append(features.brand)

        # 2. Vrsta izdelka
        if features.product_type:
            parts.append(features.product_type)

        # 3. Količina (zaokrožena)
        if features.quantity:
            rounded = round(features.quantity / 10) * 10
            unit = features.unit or "g"
            parts.append(f"{int(rounded)}{unit}")

        # 4. % maščobe
        if features.fat_percent:
            parts.append(f"{features.fat_percent}%")

        # 5. Pakiranje
        if features.pack_count and features.pack_count > 1:
            parts.append(f"{features.pack_count}x")

        signature = "|".join(parts)
        return signature.lower()

    @staticmethod
    def create_hash(name: str) -> str:
        """Ustvari hash iz signature"""
        sig = ProductSignature.create(name)
        return hashlib.md5(sig.encode()).hexdigest()[:12]


# ============================================
# PRODUCT MATCHER - ULTIMATE
# ============================================

class ProductMatcher:
    """
    ULTIMATE Product Matcher z multi-pass algoritmom.
    """

    # Pragovi
    EXACT_MATCH_THRESHOLD = 95      # Praktično identično
    HIGH_MATCH_THRESHOLD = 85       # Zelo verjetno isto
    MATCH_THRESHOLD = 72            # Verjetno isto

    def __init__(self):
        self.products = []
        self.matches = {}  # match_id -> [product_ids]
        self.product_to_match = {}  # product_id -> match_id
        self._next_match_id = 1

        # Indeksi za hitrejše iskanje
        self.signature_index = defaultdict(list)  # signature -> [product_ids]
        self.brand_index = defaultdict(list)      # brand -> [product_ids]
        self.image_index = defaultdict(list)      # image_hash -> [product_ids]
        self.type_index = defaultdict(list)       # product_type -> [product_ids]

    def add_product(self, product: dict) -> str:
        """Dodaj izdelek in vrni match_id"""
        product_id = len(self.products)
        self.products.append(product)

        name = product.get("ime", "")
        store = product.get("trgovina", "")
        image = product.get("slika", "")

        # Ekstrahiraj lastnosti
        features = ProductExtractor.extract(name, image)
        normalized = ProductNormalizer.normalize(name)
        signature = ProductSignature.create(name, features)
        tokens = ProductNormalizer.create_tokens(name)

        # Shrani v product
        product["_normalized"] = normalized
        product["_signature"] = signature
        product["_features"] = features
        product["_tokens"] = tokens

        # Posodobi indekse
        if signature:
            self.signature_index[signature].append(product_id)
        if features.brand:
            self.brand_index[features.brand].append(product_id)
        if features.image_hash:
            self.image_index[features.image_hash].append(product_id)
        if features.product_type:
            self.type_index[features.product_type].append(product_id)

        # Multi-pass matching
        match_id = self._find_match_multipass(product_id, normalized, signature, features, tokens, store)

        if match_id:
            product["match_id"] = match_id
            self.product_to_match[product_id] = match_id
            self.matches[match_id].append(product_id)
        else:
            # Nova skupina
            match_id = f"M{self._next_match_id:06d}"
            self._next_match_id += 1

            product["match_id"] = match_id
            self.product_to_match[product_id] = match_id
            self.matches[match_id] = [product_id]

        return match_id

    def _find_match_multipass(
        self,
        product_id: int,
        normalized: str,
        signature: str,
        features: ProductFeatures,
        tokens: Set[str],
        store: str
    ) -> Optional[str]:
        """
        Multi-pass matching algoritem:
        1. Signature match (najhitrejše)
        2. Image hash match (če imamo slike)
        3. Brand + quantity match
        4. Fuzzy text match (najpočasnejše)
        """

        # ===== PASS 1: SIGNATURE MATCH =====
        if signature:
            candidates = self.signature_index.get(signature, [])
            for cid in candidates:
                if cid == product_id:
                    continue
                if self.products[cid].get("trgovina") == store:
                    continue
                # Signature match!
                return self.product_to_match.get(cid)

        # ===== PASS 2: IMAGE HASH MATCH =====
        if features.image_hash:
            candidates = self.image_index.get(features.image_hash, [])
            for cid in candidates:
                if cid == product_id:
                    continue
                if self.products[cid].get("trgovina") == store:
                    continue
                # Image match - dodatna validacija
                other = self.products[cid]
                other_features = other.get("_features")
                if self._validate_features_match(features, other_features):
                    return self.product_to_match.get(cid)

        # ===== PASS 3: BRAND + QUANTITY MATCH =====
        if features.brand:
            candidates = self.brand_index.get(features.brand, [])
            for cid in candidates:
                if cid == product_id:
                    continue
                if self.products[cid].get("trgovina") == store:
                    continue

                other = self.products[cid]
                other_features = other.get("_features")

                if self._is_strong_match(features, other_features):
                    return self.product_to_match.get(cid)

        # ===== PASS 4: FUZZY TEXT MATCH =====
        if not RAPIDFUZZ_AVAILABLE:
            return None

        # Optimizacija: išči samo med istim tipom izdelka
        if features.product_type:
            candidate_ids = self.type_index.get(features.product_type, [])
        else:
            candidate_ids = range(product_id)

        best_match_id = None
        best_score = 0

        for cid in candidate_ids:
            if cid == product_id:
                continue
            if cid >= product_id:
                continue

            other = self.products[cid]
            if other.get("trgovina") == store:
                continue

            other_normalized = other.get("_normalized", "")
            other_features = other.get("_features")

            # Token overlap check (hitro)
            other_tokens = other.get("_tokens", set())
            if tokens and other_tokens:
                overlap = len(tokens & other_tokens) / max(len(tokens), len(other_tokens))
                if overlap < 0.3:  # Premalo skupnih tokenov
                    continue

            # Fuzzy match
            score = fuzz.token_sort_ratio(normalized, other_normalized)

            if score >= self.EXACT_MATCH_THRESHOLD:
                # Praktično identično
                return self.product_to_match.get(cid)

            if score >= self.MATCH_THRESHOLD and score > best_score:
                # Dodatna validacija količine
                if self._validate_quantity_match(features, other_features):
                    best_score = score
                    best_match_id = self.product_to_match.get(cid)

        return best_match_id

    def _is_strong_match(self, f1: ProductFeatures, f2: ProductFeatures) -> bool:
        """Preveri močno ujemanje (brand + type + quantity)"""
        if not f1 or not f2:
            return False

        # Ista znamka
        if f1.brand != f2.brand:
            return False

        # Isti tip
        if f1.product_type and f2.product_type:
            if f1.product_type != f2.product_type:
                return False

        # Podobna količina (±5%)
        if f1.quantity and f2.quantity:
            ratio = f1.quantity / f2.quantity if f2.quantity else 0
            if not (0.95 <= ratio <= 1.05):
                return False

        # Isti % maščobe (za mlečne izdelke)
        if f1.fat_percent and f2.fat_percent:
            if abs(f1.fat_percent - f2.fat_percent) > 0.5:
                return False

        return True

    def _validate_features_match(self, f1: ProductFeatures, f2: ProductFeatures) -> bool:
        """Validiraj ujemanje lastnosti"""
        if not f1 or not f2:
            return True

        # Količina mora biti podobna (±15%)
        if f1.quantity and f2.quantity:
            ratio = f1.quantity / f2.quantity if f2.quantity else 0
            if not (0.85 <= ratio <= 1.15):
                return False

        return True

    def _validate_quantity_match(self, f1: ProductFeatures, f2: ProductFeatures) -> bool:
        """Preveri ali se količini ujemata"""
        if not f1 or not f2:
            return True

        q1 = f1.quantity
        q2 = f2.quantity

        if not q1 or not q2:
            return True

        # Dovoli 10% razlike
        ratio = q1 / q2 if q2 != 0 else 0
        return 0.9 <= ratio <= 1.1

    def process_all(self, products: List[dict]) -> List[dict]:
        """Procesiraj vse izdelke in doda match_id"""
        print(f"[Matcher] Procesiram {len(products)} izdelkov...")

        # Reset
        self.products = []
        self.matches = {}
        self.product_to_match = {}
        self._next_match_id = 1
        self.signature_index.clear()
        self.brand_index.clear()
        self.image_index.clear()
        self.type_index.clear()

        # Dodaj vse izdelke
        for i, product in enumerate(products):
            self.add_product(product)

            if (i + 1) % 500 == 0:
                multi = sum(1 for ids in self.matches.values() if len(ids) > 1)
                print(f"[Matcher] {i + 1}/{len(products)} - {len(self.matches)} skupin, {multi} v 2+ trg")

        # Statistika
        total_matches = len(self.matches)
        multi_store = sum(1 for ids in self.matches.values() if len(ids) > 1)
        three_stores = sum(1 for ids in self.matches.values() if len(set(self.products[i].get("trgovina") for i in ids)) >= 3)

        print(f"[Matcher] Končano!")
        print(f"  - Unikatnih izdelkov:    {total_matches}")
        print(f"  - V 2+ trgovinah:        {multi_store}")
        print(f"  - V vseh 3 trgovinah:    {three_stores}")
        if total_matches > 0:
            print(f"  - Uspešnost ujemanja:    {multi_store / total_matches * 100:.1f}%")

        return self.products

    def get_grouped_products(self) -> Dict[str, Dict]:
        """Vrni izdelke grupirane po match_id"""
        grouped = {}

        for match_id, product_ids in self.matches.items():
            grouped[match_id] = {}

            for pid in product_ids:
                product = self.products[pid]
                store = product.get("trgovina", "Unknown")
                grouped[match_id][store] = {
                    "ime": product.get("ime"),
                    "redna_cena": product.get("redna_cena"),
                    "akcijska_cena": product.get("akcijska_cena"),
                    "slika": product.get("slika"),
                }

        return grouped

    def export_for_api(self) -> List[dict]:
        """Izvozi izdelke v format za API"""
        result = []

        for product in self.products:
            export = {
                "ime": product.get("ime"),
                "redna_cena": product.get("redna_cena"),
                "akcijska_cena": product.get("akcijska_cena"),
                "kategorija": product.get("kategorija"),
                "trgovina": product.get("trgovina"),
                "slika": product.get("slika"),
                "url": product.get("url"),
                "match_id": product.get("match_id"),
            }
            result.append(export)

        return result


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def match_products(products: List[dict]) -> List[dict]:
    """Glavna funkcija - procesira izdelke in doda match_id"""
    matcher = ProductMatcher()
    return matcher.process_all(products)


def get_product_signature(name: str) -> str:
    """Vrni signature za ime izdelka"""
    return ProductSignature.create(name)


def normalize_product_name(name: str) -> str:
    """Normaliziraj ime izdelka"""
    return ProductNormalizer.normalize(name)


def extract_product_features(name: str) -> ProductFeatures:
    """Ekstrahiraj lastnosti iz imena"""
    return ProductExtractor.extract(name)


# ============================================
# TEST
# ============================================

if __name__ == "__main__":
    test_products = [
        {"ime": "Alpsko mleko 3,5% m.m. 1L", "trgovina": "Spar", "redna_cena": 1.29, "slika": "https://example.com/alpsko-mleko-1l.jpg"},
        {"ime": "Mleko ALPSKO polnomastno 3,5% 1 liter", "trgovina": "Mercator", "redna_cena": 1.35, "slika": "https://example.com/alpsko-1000ml.jpg"},
        {"ime": "ALPSKO MLEKO polnomastno 1l 3.5%", "trgovina": "Tuš", "redna_cena": 1.25, "slika": "https://example.com/alpsko_mleko_1l.jpg"},
        {"ime": "Coca-Cola 1,5L", "trgovina": "Spar", "redna_cena": 2.49},
        {"ime": "Coca Cola 1.5 liter", "trgovina": "Mercator", "redna_cena": 2.59},
        {"ime": "COCA-COLA 1,5l", "trgovina": "Tuš", "redna_cena": 2.39},
        {"ime": "Nutella 400g", "trgovina": "Spar", "redna_cena": 4.99},
        {"ime": "NUTELLA 400 g", "trgovina": "Tuš", "redna_cena": 5.19},
        {"ime": "Jogurt Activia jagoda 125g", "trgovina": "Spar", "redna_cena": 0.89},
        {"ime": "ACTIVIA jogurt z jagodami 125g", "trgovina": "Mercator", "redna_cena": 0.95},
        {"ime": "Barilla Spaghetti No.5 500g", "trgovina": "Spar", "redna_cena": 1.99},
        {"ime": "BARILLA špageti št. 5 500g", "trgovina": "Mercator", "redna_cena": 2.09},
        {"ime": "Barilla Spaghetti 500 g", "trgovina": "Tuš", "redna_cena": 1.95},
    ]

    print("=" * 60)
    print("PrHran ULTIMATE Product Matcher Test")
    print("=" * 60)

    matched = match_products(test_products)

    print("\nRezultati:")
    print("-" * 60)

    groups = defaultdict(list)
    for p in matched:
        groups[p["match_id"]].append(p)

    for match_id, products in groups.items():
        print(f"\n{match_id}:")
        for p in products:
            price = p.get('akcijska_cena') or p.get('redna_cena')
            print(f"  [{p['trgovina']:10}] {p['ime'][:45]:45} - {price:.2f} €")
