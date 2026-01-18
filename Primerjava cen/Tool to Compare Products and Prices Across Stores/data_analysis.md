# Product Matching System - Data Structure Analysis

## Data Format
All three stores (Spar, Merkator, Tuš) have the same CSV structure:
- **IME IZDELKA** (Product Name)
- **CENA** (Price)
- **SLIKA** (Image URL)
- **AKCIJSKA CENA** (Sale Price)
- **NA VOLJO** (In Stock)
- **POSODOBLJENO** (Updated)

## Sample Data Issues

### Spar:
- "SUHE MARELICE SPAR, 200G" - 2,29€
- "JABOLKA IDARED, 1KG" - 0,85€

### Merkator:
- "Kivi, cena za kg" - 2,99€
- "Mango, cena za kos" - 1,59€

### Tuš:
- "Brokoli pakirani, 500 g" - 1,99€
- "Sveže Zelje SLO" - 2,57€

## Challenges for Product Matching

1. **Different naming conventions**: Same product has different names
   - Example: "SUHE MARELICE SPAR" vs "Suhe marelice" vs "Dried apricots"
   
2. **Different quantity specifications**:
   - "200G" vs "200 g" vs different units
   
3. **Brand names included**: Some products include store brand names
   
4. **Inconsistent capitalization**: Some uppercase, some mixed case

5. **Images available**: Can use image similarity matching as additional verification

## Matching Strategy

1. **Text normalization**: Convert to lowercase, remove special chars, standardize units
2. **Fuzzy string matching**: Use Levenshtein distance to find similar names
3. **Image similarity**: Compare product images using computer vision
4. **Quantity extraction**: Extract weight/volume and normalize
5. **AI-powered matching**: Use GPT to understand product descriptions
6. **Manual review**: Flag uncertain matches for user verification
