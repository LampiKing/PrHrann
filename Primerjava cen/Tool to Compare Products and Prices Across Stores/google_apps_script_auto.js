/**
 * Advanced Product Matching System with Auto-Detection and Auto-Update
 * Automatically detects new sheets and updates results in real-time
 * 
 * Installation:
 * 1. Create a new Google Sheet (this will be your "hub" sheet)
 * 2. Go to Extensions > Apps Script
 * 3. Copy this entire code
 * 4. Save and run "setupAutoUpdate()"
 * 5. Authorize the script
 * 6. Done! The script will now auto-update whenever you add new products
 */

// Configuration storage
const CONFIG_SHEET_NAME = 'Konfiguracija';
const OUTPUT_SHEET_NAME = 'Primerjava Cen';

/**
 * Setup auto-update triggers
 * Run this once to set up automatic updates
 */
function setupAutoUpdate() {
  Logger.log('Setting up auto-update triggers...');
  
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Create new trigger - runs every 5 minutes
  ScriptApp.newTrigger('autoUpdateMatching')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('✓ Auto-update trigger created (every 5 minutes)');
  Logger.log('✓ Script will automatically update when new products are added');
}

/**
 * Auto-update function (runs automatically)
 */
function autoUpdateMatching() {
  Logger.log('Auto-update started: ' + new Date());
  matchAndCompareProducts();
}

/**
 * Main function to match products and create comparison
 */
function matchAndCompareProducts() {
  Logger.log('Starting product matching...');
  
  try {
    // Get or create configuration sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    
    if (!configSheet) {
      configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
      setupConfigurationSheet(configSheet);
    }
    
    // Load store configurations
    const storeConfigs = loadStoreConfigurations(configSheet);
    Logger.log('Loaded ' + Object.keys(storeConfigs).length + ' stores');
    
    // Load data from all stores
    const allStoreData = {};
    for (const [storeName, config] of Object.entries(storeConfigs)) {
      allStoreData[storeName] = loadStoreData(config);
      Logger.log(`Loaded ${allStoreData[storeName].length} products from ${storeName}`);
    }
    
    // Match products
    const matchedGroups = matchProducts(allStoreData);
    Logger.log(`Found ${matchedGroups.length} matching groups`);
    
    // Create output sheet
    createComparisonSheet(matchedGroups, storeConfigs);
    
    Logger.log('✓ Product matching completed successfully!');
  } catch (error) {
    Logger.log('Error: ' + error.toString());
  }
}

/**
 * Setup configuration sheet with example
 */
function setupConfigurationSheet(sheet) {
  sheet.appendRow(['TRGOVINA', 'SHEET_ID', 'RANGE', 'AKTIVNA']);
  sheet.appendRow(['Spar', '1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok', 'Podatki!A:F', 'DA']);
  sheet.appendRow(['Merkator', '1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0', 'Podatki!A:F', 'DA']);
  sheet.appendRow(['Tuš', '17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A', 'Podatki!A:F', 'DA']);
  
  // Format header
  const headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 4);
  
  Logger.log('✓ Configuration sheet created');
  Logger.log('✓ Edit the configuration sheet to add/remove stores');
}

/**
 * Load store configurations from configuration sheet
 */
function loadStoreConfigurations(configSheet) {
  const values = configSheet.getDataRange().getValues();
  const storeConfigs = {};
  
  // Skip header row
  for (let i = 1; i < values.length; i++) {
    const [storeName, sheetId, range, active] = values[i];
    
    if (storeName && sheetId && active === 'DA') {
      storeConfigs[storeName.toLowerCase()] = {
        name: storeName,
        sheetId: sheetId,
        range: range
      };
    }
  }
  
  return storeConfigs;
}

/**
 * Load data from a store's Google Sheet
 */
function loadStoreData(config) {
  try {
    const spreadsheet = SpreadsheetApp.openById(config.sheetId);
    const sheetName = config.range.split('!')[0];
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log('Warning: Sheet ' + sheetName + ' not found in ' + config.name);
      return [];
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    const products = [];
    
    // Skip header row
    for (let i = 1; i < values.length; i++) {
      if (values[i][0]) { // Check if product name exists
        products.push({
          store: config.name.toLowerCase(),
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
  } catch (error) {
    Logger.log('Error loading data from ' + config.name + ': ' + error.toString());
    return [];
  }
}

/**
 * Normalize product name for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  
  text = text.toLowerCase();
  
  // Remove store brand names
  const brands = ['spar', 'merkator', 'tuš', 'despar', 's-budget', 'puro gusto', 'barcaffe', 'radenska', 'bio zone'];
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
  
  const ratio = stringSimilarity(norm1, norm2);
  
  const qty1 = extractQuantityUnit(name1);
  const qty2 = extractQuantityUnit(name2);
  
  if (qty1.quantity && qty2.quantity) {
    if (qty1.quantity !== qty2.quantity || qty1.unit !== qty2.unit) {
      return 0.0;
    }
  }
  
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) {
    return 0.0;
  }
  
  const overlap = [...words1].filter(w => words2.has(w)).length / Math.max(words1.size, words2.size);
  
  return (ratio * 0.6) + (overlap * 0.4);
}

/**
 * String similarity algorithm
 */
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance
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
function matchProducts(allStoreData) {
  const allProducts = [];
  
  for (const [storeName, products] of Object.entries(allStoreData)) {
    products.forEach(p => {
      allProducts.push(p);
    });
  }
  
  const matched = new Set();
  const groups = [];
  
  for (let i = 0; i < allProducts.length; i++) {
    if (matched.has(i)) continue;
    
    const group = [allProducts[i]];
    matched.add(i);
    
    for (let j = i + 1; j < allProducts.length; j++) {
      if (matched.has(j) || allProducts[i].store === allProducts[j].store) continue;
      
      const similarity = calculateSimilarity(allProducts[i].name, allProducts[j].name);
      
      if (similarity > 0.75) {
        group.push(allProducts[j]);
        matched.add(j);
      }
    }
    
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * Create comparison sheet with results
 */
function createComparisonSheet(matchedGroups, storeConfigs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create new sheet or clear existing one
  let sheet = ss.getSheetByName(OUTPUT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(OUTPUT_SHEET_NAME);
  } else {
    sheet.clear();
  }
  
  // Build headers dynamically based on stores
  const storeNames = Object.keys(storeConfigs).sort();
  const headers = ['PROIZVOD', ...storeNames.map(s => s.toUpperCase() + '_CENA'), 'NAJCENEJSI', 'RAZLIKA_EUR'];
  sheet.appendRow(headers);
  
  // Add data rows
  for (const group of matchedGroups) {
    const byStore = {};
    group.forEach(product => {
      byStore[product.store] = product;
    });
    
    const canonicalName = group.reduce((a, b) => a.name.length > b.name.length ? a : b).name.substring(0, 70);
    
    const prices = {};
    storeNames.forEach(store => {
      if (byStore[store]) {
        const priceStr = byStore[store].price.replace('€', '').trim();
        prices[store] = parseFloat(priceStr.replace(',', '.'));
      }
    });
    
    const validPrices = Object.entries(prices).filter(([_, p]) => !isNaN(p));
    if (validPrices.length > 0) {
      const cheapestStore = validPrices.reduce((a, b) => a[1] < b[1] ? a : b)[0];
      const minPrice = validPrices.reduce((a, b) => a[1] < b[1] ? a : b)[1];
      const maxPrice = validPrices.reduce((a, b) => a[1] > b[1] ? a : b)[1];
      const difference = maxPrice - minPrice;
      
      const row = [canonicalName];
      storeNames.forEach(store => {
        row.push(prices[store] ? prices[store].toFixed(2) : '');
      });
      row.push(cheapestStore);
      row.push(difference.toFixed(2));
      
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
 * Manual update function (can be called anytime)
 */
function manualUpdate() {
  Logger.log('Manual update triggered');
  matchAndCompareProducts();
  Logger.log('✓ Manual update completed');
}

/**
 * Test function
 */
function testMatching() {
  Logger.log('Testing product matching...');
  
  const test1 = 'SUHE MARELICE SPAR, 200G';
  const test2 = 'Suhe Marelice Natura 200g';
  
  const similarity = calculateSimilarity(test1, test2);
  Logger.log(`Similarity: ${similarity.toFixed(3)}`);
  Logger.log(`Normalized 1: ${normalizeText(test1)}`);
  Logger.log(`Normalized 2: ${normalizeText(test2)}`);
}
