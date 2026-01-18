/**
 * Product Matching System for Google Sheets
 * Automatically matches products from three stores and creates a comparison sheet
 * 
 * Installation:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Copy this entire code into the script editor
 * 4. Save and run the function "matchAndCompareProducts()"
 */

// Configuration - Update these with your Google Sheet IDs
const SHEET_CONFIG = {
  spar: {
    sheetId: '1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok',
    range: 'Podatki!A:F'
  },
  merkator: {
    sheetId: '1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0',
    range: 'Podatki!A:F'
  },
  tus: {
    sheetId: '17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A',
    range: 'Podatki!A:F'
  }
};

/**
 * Main function to match products and create comparison
 */
function matchAndCompareProducts() {
  Logger.log('Starting product matching...');
  
  try {
    // Load data from all stores
    const sparData = loadStoreData('spar');
    const merkatorData = loadStoreData('merkator');
    const tusData = loadStoreData('tus');
    
    Logger.log(`Loaded: Spar=${sparData.length}, Merkator=${merkatorData.length}, Tuš=${tusData.length}`);
    
    // Match products
    const matchedGroups = matchProducts(sparData, merkatorData, tusData);
    Logger.log(`Found ${matchedGroups.length} matching groups`);
    
    // Create output sheet
    createComparisonSheet(matchedGroups);
    
    Logger.log('✓ Product matching completed successfully!');
  } catch (error) {
    Logger.log('Error: ' + error.toString());
  }
}

/**
 * Load data from a store's Google Sheet
 */
function loadStoreData(storeName) {
  const config = SHEET_CONFIG[storeName];
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const range = spreadsheet.getRangeByName(config.range) || 
                spreadsheet.getSheetByName(config.range.split('!')[0]).getDataRange();
  
  const values = range.getValues();
  const products = [];
  
  // Skip header row
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) { // Check if product name exists
      products.push({
        store: storeName,
        name: values[i][0],
        price: values[i][1],
        image: values[i][2],
        salePrice: values[i][3],
        inStock: values[i][4],
        updated: values[i][5]
      });
    }
  }
  
  return products;
}

/**
 * Normalize product name for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  
  text = text.toLowerCase();
  
  // Remove store brand names
  const brands = ['spar', 'merkator', 'tuš', 'despar', 's-budget', 'puro gusto', 'barcaffe', 'radenska'];
  brands.forEach(brand => {
    text = text.replace(new RegExp('\\b' + brand + '\\b', 'g'), '');
  });
  
  // Standardize units
  text = text.replace(/(\d+)\s*g\b/g, '$1g');
  text = text.replace(/(\d+)\s*kg\b/g, '$1kg');
  text = text.replace(/(\d+)\s*ml\b/g, '$1ml');
  text = text.replace(/(\d+)\s*l\b/g, '$1l');
  
  // Remove special characters
  text = text.replace(/[^\w\s]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Extract quantity and unit from product name
 */
function extractQuantityUnit(name) {
  const match = name.match(/(\d+(?:,\d+)?)\s*(g|kg|ml|l|pcs?|kom|kos|jajc)/i);
  if (match) {
    return {
      quantity: match[1].replace(',', '.'),
      unit: match[2]
    };
  }
  return { quantity: '', unit: '' };
}

/**
 * Calculate similarity between two product names
 */
function calculateSimilarity(name1, name2) {
  const norm1 = normalizeText(name1);
  const norm2 = normalizeText(name2);
  
  // Base similarity using character matching
  const ratio = stringSimilarity(norm1, norm2);
  
  // Extract quantities
  const qty1 = extractQuantityUnit(name1);
  const qty2 = extractQuantityUnit(name2);
  
  // If both have quantities, they MUST match
  if (qty1.quantity && qty2.quantity) {
    if (qty1.quantity !== qty2.quantity || qty1.unit !== qty2.unit) {
      return 0.0;
    }
  }
  
  // Extract key words
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) {
    return 0.0;
  }
  
  // Calculate word overlap
  const overlap = [...words1].filter(w => words2.has(w)).length / Math.max(words1.size, words2.size);
  
  // Combined score
  return (ratio * 0.6) + (overlap * 0.4);
}

/**
 * Simple string similarity algorithm (Levenshtein-like)
 */
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance between two strings
 */
function getEditDistance(s1, s2) {
  const costs = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

/**
 * Match products across all stores
 */
function matchProducts(sparData, merkatorData, tusData) {
  const allProducts = [
    ...sparData,
    ...merkatorData,
    ...tusData
  ];
  
  const matched = new Set();
  const groups = [];
  
  for (let i = 0; i < allProducts.length; i++) {
    if (matched.has(i)) continue;
    
    const group = [allProducts[i]];
    matched.add(i);
    
    for (let j = i + 1; j < allProducts.length; j++) {
      if (matched.has(j) || allProducts[i].store === allProducts[j].store) continue;
      
      const similarity = calculateSimilarity(allProducts[i].name, allProducts[j].name);
      
      // Strict threshold: 0.75
      if (similarity > 0.75) {
        group.push(allProducts[j]);
        matched.add(j);
      }
    }
    
    // Only keep groups with multiple stores
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * Create comparison sheet with results
 */
function createComparisonSheet(matchedGroups) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create new sheet or clear existing one
  let sheet = ss.getSheetByName('Primerjava Cen');
  if (!sheet) {
    sheet = ss.insertSheet('Primerjava Cen');
  } else {
    sheet.clear();
  }
  
  // Add headers
  const headers = ['PROIZVOD', 'SPAR_CENA', 'MERKATOR_CENA', 'TUS_CENA', 'NAJCENEJSI', 'RAZLIKA_EUR'];
  sheet.appendRow(headers);
  
  // Add data rows
  for (const group of matchedGroups) {
    const byStore = {};
    group.forEach(product => {
      byStore[product.store] = product;
    });
    
    // Get canonical name
    const canonicalName = group.reduce((a, b) => a.name.length > b.name.length ? a : b).name.substring(0, 70);
    
    // Get prices
    const prices = {};
    ['spar', 'merkator', 'tus'].forEach(store => {
      if (byStore[store]) {
        const priceStr = byStore[store].price.replace('€', '').trim();
        prices[store] = parseFloat(priceStr.replace(',', '.'));
      }
    });
    
    // Find cheapest
    const validPrices = Object.entries(prices).filter(([_, p]) => !isNaN(p));
    if (validPrices.length > 0) {
      const cheapestStore = validPrices.reduce((a, b) => a[1] < b[1] ? a : b)[0];
      const minPrice = validPrices.reduce((a, b) => a[1] < b[1] ? a : b)[1];
      const maxPrice = validPrices.reduce((a, b) => a[1] > b[1] ? a : b)[1];
      const difference = maxPrice - minPrice;
      
      const row = [
        canonicalName,
        prices.spar || '',
        prices.merkator || '',
        prices.tus || '',
        cheapestStore,
        difference.toFixed(2)
      ];
      
      sheet.appendRow(row);
    }
  }
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Run this function to test
 */
function testMatching() {
  Logger.log('Testing product matching...');
  
  const test1 = 'SUHE MARELICE SPAR, 200G';
  const test2 = 'Suhe Marelice Natura 200g';
  
  const similarity = calculateSimilarity(test1, test2);
  Logger.log(`Similarity between "${test1}" and "${test2}": ${similarity.toFixed(3)}`);
  
  Logger.log('Normalized 1: ' + normalizeText(test1));
  Logger.log('Normalized 2: ' + normalizeText(test2));
}
