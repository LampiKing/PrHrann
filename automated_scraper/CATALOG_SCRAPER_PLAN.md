# 📋 CATALOG SCRAPER IMPLEMENTATION PLAN

## 🎯 CILJ
Avtomatsko skenirati kataloge trgovin (Mercator, Spar, Tuš) za akcijske cene in datume veljavnosti.

## 📊 UGOTOVITVE IZ RESEARCH-A

### **Mercator**
- **Katalog page:** https://www.mercator.si/katalogi/
- **Format:** PDF + Interactive viewer
- **URL pattern:** `/assets/Katalogi/[filename].pdf`
- **Problem:** PDF katalogi - potrebujemo OCR ali PDF parsing
- **Prednost:** Jasna struktura

### **Spar**
- **Katalog page:** https://www.spar.si/letak
- **Format:** Interactive viewer (third-party: kimbino, moj-letak)
- **Problem:** 403 Forbidden na main page
- **Rešitev:** Uporabi tretje strani (kimbino.si, moj-letak.si) ali API

### **Tuš**
- **Katalog page:** https://www.tus.si/aktualno/katalogi-in-revije/
- **Format:** PDF + Interactive flipbook
- **API:** `https://api.tus.si/files/thumbnails/`
- **PDF pattern:** `https://www.tus.si/app/uploads/catalogues/[timestamp]_[id]_akcija_[number].pdf`
- **UID parameter:** `?uid=514` (za interactive viewer)

## 🤖 STRATEGIJA

### **FAZA 1: PDF Catalog Scraping s GPT-4o Vision** ✅ RECOMMENDED
**Pristop:** Download PDFs → Convert to images → GPT-4o Vision OCR

**Prednosti:**
- ✅ GPT-4o že uporabljamo za receipts
- ✅ Lahko prebere TOČNE cene, datume, izdelke
- ✅ Prepozna discount badges ("30% OFF", "-0.50 EUR")
- ✅ Multi-page processing

**Implementation:**
```python
async def extract_catalog_sales(pdf_url: str, store_name: str):
    """
    1. Download PDF catalog
    2. Convert PDF pages to images (pdf2image)
    3. For each page:
       - Send to GPT-4o Vision
       - Extract: product_name, original_price, sale_price, valid_until
    4. Return structured sales data
    """

    prompt = '''
    Extract ALL sale prices from this catalog page.

    Return JSON array:
    [
      {
        "productName": "Mleko Alpsko 3.5% 1L",
        "originalPrice": 1.29,
        "salePrice": 0.99,
        "discount": "23%",
        "validFrom": "2026-01-07",
        "validUntil": "2026-01-31",
        "storeName": "Mercator"
      }
    ]

    RULES:
    1. Extract EXACT product names (brand + variant + size)
    2. Include original price AND sale price
    3. Calculate discount percentage if visible
    4. Extract validity dates from page
    5. Only include products with DISCOUNTS, skip regular prices
    '''
```

### **FAZA 2: Integration s Convex**

**Nova tabela:**
```typescript
// convex/schema.ts
salePrices: defineTable({
  productName: v.string(),        // "Mleko Alpsko 3.5% 1L"
  storeId: v.id("stores"),
  originalPrice: v.number(),
  salePrice: v.number(),
  discountPercentage: v.number(), // 23
  validFrom: v.string(),          // "2026-01-07"
  validUntil: v.string(),         // "2026-01-31"
  catalogSource: v.string(),      // "Mercator Weekly 01-2026"
  scrapedAt: v.number(),
  isActive: v.boolean(),          // true if still valid
}).index("by_store", ["storeId"])
  .index("by_active", ["isActive"])
  .index("by_product", ["productName"])
```

**Nova akcija:**
```typescript
// convex/catalogSales.ts
export const ingestCatalogSales = internalAction({
  args: { sales: v.array(v.object({ ... })) },
  handler: async (ctx, { sales }) => {
    // 1. Match product names to existing products (fuzzy match)
    // 2. Create salePrices entries
    // 3. Update isOnSale flag on prices table
    // 4. Mark expired sales as inactive
  }
})
```

### **FAZA 3: UI Integration**

**Sale badge na product cards:**
```typescript
{salePrice && salePrice < regularPrice && (
  <View style={styles.saleBadge}>
    <Ionicons name="pricetag" size={14} color="#ef4444" />
    <Text style={styles.saleText}>-{discountPercentage}%</Text>
    <Text style={styles.saleValidUntil}>do {validUntil}</Text>
  </View>
)}
```

**Sale indicator v search results:**
```typescript
// Sale icon next to store name
{price.isOnSale && (
  <Ionicons name="flash" size={12} color="#ef4444" />
)}
```

## 📅 AUTOMATION

**GitHub Actions Update:**
```yaml
# .github/workflows/catalog-scraper.yml
name: Catalog Scraper - Weekly Sales

on:
  schedule:
    # Vsak TOREK ob 08:00 CET (novi katalogi običajno prihajajo v torek)
    - cron: '0 7 * * 2'
  workflow_dispatch: {}

jobs:
  scrape-catalogs:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Dependencies
        run: |
          pip install -r automated_scraper/requirements_catalogs.txt
          # pdf2image, Pillow, requests

      - name: Scrape Catalogs
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          CONVEX_INGEST_URL: ${{ secrets.CONVEX_INGEST_URL }}
          CONVEX_INGEST_TOKEN: ${{ secrets.CONVEX_INGEST_TOKEN }}
        run: |
          python automated_scraper/catalog_scraper.py
```

## 🚀 IMPLEMENTATION STEPS

### **Step 1: Create catalog_scraper.py** ✅ NEXT
```python
#!/usr/bin/env python3
"""
📋 CATALOG SCRAPER - Extract sale prices from store catalogs
Runs weekly (Tuesdays) to catch new promotions
"""

import asyncio
import requests
from pdf2image import convert_from_bytes
from openai import OpenAI
import base64
import json
from typing import List, Dict

CATALOG_URLS = {
    "mercator": [
        # Extract from mercator.si/katalogi/ dynamically
        # OR hardcode current week URL
    ],
    "spar": [
        # Use kimbino.si or moj-letak.si API if available
    ],
    "tus": [
        # Use api.tus.si endpoint
    ]
}

async def main():
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    all_sales = []

    for store, urls in CATALOG_URLS.items():
        for pdf_url in urls:
            print(f"📥 Downloading {store} catalog from {pdf_url}")
            sales = await extract_catalog_sales(pdf_url, store, client)
            all_sales.extend(sales)

    # Upload to Convex
    if all_sales:
        upload_to_convex(all_sales)
        print(f"✅ Uploaded {len(all_sales)} sale prices")
```

### **Step 2: Add PDF → Image conversion**
```python
def pdf_to_images(pdf_bytes):
    """Convert PDF pages to PIL Images"""
    return convert_from_bytes(pdf_bytes, dpi=200)
```

### **Step 3: GPT-4o Vision extraction**
```python
async def extract_from_page(image, page_num, store_name, client):
    """Extract sales from single catalog page"""

    # Convert image to base64
    buffered = BytesIO()
    image.save(buffered, format="JPEG")
    base64_image = base64.b64encode(buffered.getvalue()).decode()

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": CATALOG_EXTRACTION_PROMPT
        }, {
            "role": "user",
            "content": [{
                "type": "text",
                "text": f"Extract sales from {store_name} catalog page {page_num}"
            }, {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}",
                    "detail": "high"
                }
            }]
        }],
        max_tokens: 2000,
        temperature: 0.1
    )

    # Parse JSON response
    sales_data = json.loads(response.choices[0].message.content)
    return sales_data
```

### **Step 4: Convex integration**
```typescript
// convex/catalogSales.ts
export const ingestCatalogSales = internalAction({
  args: {
    sales: v.array(v.object({
      productName: v.string(),
      storeId: v.string(),
      originalPrice: v.number(),
      salePrice: v.number(),
      discountPercentage: v.number(),
      validFrom: v.string(),
      validUntil: v.string(),
      catalogSource: v.string(),
    }))
  },
  handler: async (ctx, { sales }) => {
    // Match products, create salePrices entries
  }
})
```

## ⚠️ CHALLENGES & SOLUTIONS

### **Challenge 1: PDF Quality**
- **Problem:** Low resolution PDFs, slanted text
- **Solution:** Use `dpi=200` for conversion, GPT-4o handles rotation

### **Challenge 2: Product Name Matching**
- **Problem:** Catalog says "Mleko 1L", we have "Alpsko mleko 3.5% 1L"
- **Solution:** Fuzzy matching + brand detection

### **Challenge 3: Multiple catalogs per store**
- **Problem:** Mercator has "Weekly", "MTehnika", "Special Moments"
- **Solution:** Process all, deduplicate by product+store

### **Challenge 4: Datum extraction**
- **Problem:** "Velja od 7.1. do 31.1." instead of ISO dates
- **Solution:** GPT-4o parses, we validate + convert to YYYY-MM-DD

## 📈 EXPECTED RESULTS

**Per run (weekly):**
- ~500-1000 sale prices extracted
- ~3 trgovine × 20-50 pages = 60-150 pages
- GPT-4o cost: ~$2-5 per run ($8-20/month)

**Value for users:**
- ⚡ Instant visibility of sales
- 📊 Historical price comparison
- 🔔 Potential notification: "Mleko je danes v akciji v Mercator -20%!"

## 🎯 SUCCESS CRITERIA

✅ Bot ekstrahira TOČNE cene iz katalogov
✅ Bot pravilno prepozna datume veljavnosti
✅ Sale badges prikazani v app
✅ Posodobitve 1x tedensko (vsak torek)
✅ Error rate < 5% (95%+ accuracy)

---

**Status:** ✅ READY FOR IMPLEMENTATION
**Estimated time:** 6-8 hours
**Dependencies:** OpenAI API key, pdf2image, Pillow
