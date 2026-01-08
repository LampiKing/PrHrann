#!/usr/bin/env python3
"""
📋 CATALOG SCRAPER - Extract sale prices from store catalogs
Runs weekly (Tuesdays) to catch new promotions
"""

import asyncio
import requests
import os
import json
import base64
from io import BytesIO
from typing import List, Dict
from datetime import datetime

# Dependencies: pip install openai requests pdf2image
from openai import OpenAI
try:
    from pdf2image import convert_from_bytes
except ImportError:
    print("Warning: pdf2image not installed. Catalog scraping will fail without it.")
    convert_from_bytes = None

CATALOG_URLS = {
    "mercator": [
        # Example dynamic URL logic would go here, often /katalogi/current.pdf
    ],
    "spar": [],
    "tus": []
}

CATALOG_EXTRACTION_PROMPT = '''
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
4. Extract validity dates from page. If future date, capture it!
5. Only include products with DISCOUNTS, skip regular prices
'''

async def extract_catalog_sales(pdf_url: str, store_name: str, client: OpenAI):
    print(f"  Downloading {store_name} catalog...")
    try:
        response = requests.get(pdf_url)
        if response.status_code != 200:
            print(f"  Failed to download: {response.status_code}")
            return []
        
        pdf_bytes = response.content
        if not convert_from_bytes:
            print("  Skipping PDF conversion (missing library)")
            return []

        # Convert to images (first 5 pages for testing/demo)
        images = convert_from_bytes(pdf_bytes, dpi=200, first_page=1, last_page=5)
        
        sales = []
        for i, img in enumerate(images):
            print(f"  Processing page {i+1}...")
            page_sales = await extract_from_page(img, i+1, store_name, client)
            sales.extend(page_sales)
            
        return sales
        
    except Exception as e:
        print(f"  Error extracting catalog: {e}")
        return []

async def extract_from_page(image, page_num, store_name, client):
    # Convert image to base64
    buffered = BytesIO()
    image.save(buffered, format="JPEG")
    base64_image = base64.b64encode(buffered.getvalue()).decode()

    try:
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
            max_tokens=2000,
            temperature=0.1
        )

        content = response.choices[0].message.content
        # Strip markdown json block if present
        if "```json" in content:
            content = content.replace("```json", "").replace("```", "")
            
        sales_data = json.loads(content)
        return sales_data
    except Exception as e:
        print(f"    AI Error on page {page_num}: {e}")
        return []

def upload_to_convex(sales):
    # This would call the internal mutation
    # For now, just print or save to file
    with open("catalog_sales.json", "w", encoding="utf-8") as f:
        json.dump(sales, f, indent=2)

async def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set")
        return

    client = OpenAI(api_key=api_key)
    all_sales = []

    # Example test with a dummy URL or real one if known
    # all_sales.extend(await extract_catalog_sales("https://example.com/katalog.pdf", "Mercator", client))

    if all_sales:
        upload_to_convex(all_sales)
        print(f"✅ Extracted {len(all_sales)} sales.")
    else:
        print("No sales extracted (Url list empty or failed).")

if __name__ == "__main__":
    asyncio.run(main())
