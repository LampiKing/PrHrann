// PrHran Chrome Extension - Popup Script
// Avtomatsko skenira izdelke in jih izvozi v Google Sheets

// ============================================
// CONVEX API CONFIGURATION
// ============================================
// POMEMBNO: Nastavi te vrednosti!
const CONVEX_API_URL = 'https://vibrant-dolphin-871.convex.site/api/ingest/grocery';
const CONVEX_API_TOKEN = 'prhran-scraper-2024'; // Mora biti enak kot PRHRAN_INGEST_TOKEN v Convex

// ============================================
// MASTER GOOGLE SHEET (combined across stores)
// ============================================
// Used for unified search data (name, price, sale_price, store, date).
// NOTE: This ID is also referenced in the backend (Convex) Google Sheets reader.
const MASTER_DEFAULT_SPREADSHEET_ID = '1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y';
const MASTER_SPREADSHEET_ID_STORAGE_KEY = 'masterSpreadsheetId';
const MASTER_SHEET_TITLE = 'List1';
const MASTER_HEADER = ['name', 'price', 'sale_price', 'store', 'date'];

// ============================================
// STORE GOOGLE SHEETS (per-store sheets)
// ============================================
// Default IDs so "Posodobi spletno stran" works without manual linking.
const DEFAULT_STORE_SPREADSHEET_IDS = {
  Spar: '1c2SpIPP2trFzI0rAqQXNaim32Ar9BtMfCnUKQsPOgok',
  Mercator: '1YFsWKEMIs5aDvC1-LmTaWSYvMCnEL5CRpmWDHku6kf0',
  Tus: '17zw9ntl9E9md8bMvagiL-YZBN9gqC0UA1RDsna1o12A',
};

// ============================================
// GLOBAL STATE
// ============================================
let scrapedData = null;
let googleSheetsConnected = false;
let spreadsheetId = null;
let currentStore = null;

// ============================================
// UI HELPERS
// ============================================

function showMessage(msg, type) {
  const el = document.getElementById('message');
  if (el) {
    el.textContent = msg;
    el.className = 'message active ' + (type || 'info');
  }
  console.log(`[${type || 'info'}] ${msg}`);
}

function hideMessage() {
  const el = document.getElementById('message');
  if (el) {
    el.className = 'message';
  }
}

function updateStatus(text, statusClass) {
  const el = document.getElementById('scriptStatus');
  if (el) {
    el.textContent = text;
    el.className = 'status-value script-status ' + (statusClass || 'idle');
  }
}

function updateProductCount(count) {
  const el = document.getElementById('productCount');
  if (el) {
    el.textContent = count.toLocaleString();
  }
}

function updateStore(storeName) {
  const el = document.getElementById('currentStore');
  if (el) {
    el.textContent = storeName || '-';
  }
  currentStore = storeName;
}

function showProgress(text, percent) {
  const box = document.getElementById('progressBox');
  const textEl = document.getElementById('progressText');
  const fillEl = document.getElementById('progressFill');

  if (box) {
    box.classList.add('active');
  }
  if (textEl) {
    textEl.textContent = text;
  }
  if (fillEl && percent !== undefined) {
    fillEl.style.width = percent + '%';
  }
}

function hideProgress() {
  const box = document.getElementById('progressBox');
  if (box) {
    box.classList.remove('active');
  }
}

function updateGoogleSheetsButton() {
  const btn = document.getElementById('googleSheetsBtn');
  if (!btn) return;

  const span = btn.querySelector('span');
  if (!span) return;

  if (scrapedData && scrapedData.length > 0) {
    span.textContent = 'Izvozi v Google Sheets';
    btn.disabled = false;
  } else if (googleSheetsConnected) {
    span.textContent = 'Povezano - Poberi izdelke';
    btn.disabled = false;
  } else {
    span.textContent = 'Povezi z Google Sheets';
    btn.disabled = false;
  }
}

function setButtonsEnabled(enabled) {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const googleBtn = document.getElementById('googleSheetsBtn');
  const resetBtn = document.getElementById('resetBtn');
  const stopBtn = document.getElementById('stopBtn');

  if (scrapeBtn) scrapeBtn.disabled = !enabled;
  if (googleBtn) googleBtn.disabled = !enabled;
  if (resetBtn) resetBtn.disabled = !enabled;

  // Show/hide stop button
  if (stopBtn) {
    stopBtn.style.display = enabled ? 'none' : 'flex';
  }
  if (scrapeBtn) {
    scrapeBtn.style.display = enabled ? 'flex' : 'none';
  }
}

// ============================================
// SHARED HELPERS (parsing)
// ============================================

function parsePriceValue(input) {
  if (!input) return undefined;
  const text = String(input).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;

  // Grab the first number in the string (supports "1,99", "1.99", "1")
  const match = text.match(/(\d+(?:[,.]\d+)?)/);
  if (!match) return undefined;

  const normalized = match[1].replace(',', '.');
  const value = parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function extractImageUrlFromCell(cellValue) {
  if (!cellValue) return undefined;
  const formula = String(cellValue).trim();
  if (!formula) return undefined;
  if (formula.startsWith('http')) return formula;
  // Support: =IMAGE("url"), =IMAGE("url", ...), =IMAGE("url"; ...)
  const match = formula.match(/=IMAGE\s*\(\s*"([^"]+)"(?:\s*[;,]\s*[^)]*)?\)/i);
  if (match) return match[1];
  return undefined;
}

// ============================================
// STOP SCRAPING - IZVOZI KAR JE ZE POBRAL
// ============================================
async function stopScraping() {
  console.log('Stopping scrape...');
  showMessage('Ustavljam in izvazam...', 'warning');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab) {
      showMessage('Ni aktivnega zavihka!', 'error');
      setButtonsEnabled(true);
      return;
    }

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'stop' }, (res) => {
        if (chrome.runtime.lastError) {
          console.error('Stop message error:', chrome.runtime.lastError);
        }
        console.log('Raw stop response:', res);
        console.log('Products in response:', res?.products?.length || 0);
        resolve(res || { stopped: false, products: [], productsFound: 0 });
      });
    });

    console.log('Stop response:', response);
    console.log('Products array:', response.products);
    console.log('Products count:', response.productsFound);

    if (response && response.stopped) {
      const count = response.productsFound || 0;
      updateProductCount(count);

      // Ce je prevec izdelkov, preberi iz storage
      let products = response.products || [];
      if (response.readFromStorage || products.length === 0) {
        console.log('Reading products from storage...');
        const storeName = response.store || currentStore || 'Unknown';
        const key = `products_${storeName}`;
        try {
          const stored = await chrome.storage.local.get([key]);
          if (stored[key] && stored[key].length > 0) {
            products = stored[key];
            console.log(`Loaded ${products.length} products from storage`);
          }
        } catch (e) {
          console.error('Error reading from storage:', e);
        }
      }

      if (products && products.length > 0) {
        scrapedData = products;
        currentStore = response.store || currentStore;
        updateStore(currentStore);

        showMessage(`Ustavljeno! Izvazam ${count} izdelkov...`, 'warning');
        updateStatus('Izvazam...', 'loading');

        // Avtomatsko izvozi v Google Sheets
        try {
          await exportToGoogleSheets();
          showMessage(`Uspesno izvozenih ${count} izdelkov!`, 'success');
          updateStatus('Izvozeno', 'ready');
        } catch (exportError) {
          console.error('Export after stop error:', exportError);
          showMessage(`Ustavljeno z ${count} izdelki. Klikni Google Sheets za izvoz.`, 'warning');
        }
      } else {
        showMessage(`Ustavljeno. Ni izdelkov za izvoz.`, 'warning');
      }
    } else {
      showMessage('Napaka pri ustavljanju.', 'error');
    }

    setButtonsEnabled(true);
    hideProgress();

  } catch (error) {
    console.error('Stop error:', error);
    showMessage('Napaka: ' + error.message, 'error');
    setButtonsEnabled(true);
  }
}

// ============================================
// STORE DETECTION
// ============================================

async function detectAndDisplayStore() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url) {
      updateStore('-');
      return null;
    }

    const hostname = new URL(tab.url).hostname.toLowerCase();
    let storeName = 'Neznana';

    if (hostname.includes('spar')) {
      storeName = 'Spar';
    } else if (hostname.includes('mercator')) {
      storeName = 'Mercator';
    } else if (hostname.includes('tus') || hostname.includes('hitrinakup')) {
      storeName = 'Tus';
    } else if (hostname.includes('hofer')) {
      storeName = 'Hofer';
    } else if (hostname.includes('lidl')) {
      storeName = 'Lidl';
    } else if (hostname.includes('eurospin')) {
      storeName = 'Eurospin';
    } else if (hostname.includes('jager')) {
      storeName = 'Jager';
    }

    updateStore(storeName);
    return storeName;

  } catch (error) {
    console.error('Error detecting store:', error);
    updateStore('-');
    return null;
  }
}

// ============================================
// GOOGLE SHEETS AUTHENTICATION
// ============================================

async function googleSheetsLogin() {
  console.log('Starting Google Sheets login...');
  showMessage('Povezujem z Google Sheets...', 'progress');
  updateStatus('Povezujem...', 'loading');

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError || !token) {
        console.error('Google login error:', chrome.runtime.lastError);
        showMessage('Google prijava ni uspela: ' + (chrome.runtime.lastError?.message || 'Ni tokena'), 'error');
        updateStatus('Napaka', 'error');
        reject(new Error(chrome.runtime.lastError?.message || 'No token'));
        return;
      }

      console.log('Google login successful');
      googleSheetsConnected = true;
      updateStatus('Povezano', 'ready');
      showMessage('Povezano z Google Sheets!', 'success');
      updateGoogleSheetsButton();

      chrome.storage.local.set({ googleSheetsConnected: true });
      resolve(token);
    });
  });
}

// ============================================
// SCRAPING
// ============================================

async function scrapeProducts() {
  console.log('Starting scrape...');

  setButtonsEnabled(false);
  updateStatus('Skeniram...', 'loading');
  showProgress('Pripravljam skeniranje...', 10);
  showMessage('Pobiram izdelke...', 'progress');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab) {
      throw new Error('Ni aktivnega zavihka!');
    }

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      throw new Error('Ta stran ne podpira skript. Obisci spletno stran trgovine.');
    }

    console.log('Current tab:', tab.url);
    showProgress('Nalagam skript...', 20);

    // Inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script injected');
    } catch (injectError) {
      console.warn('Script injection warning:', injectError);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    showProgress('Povezujem s skriptom...', 30);

    // Ping test
    let pingSuccess = false;
    for (let i = 0; i < 5; i++) {
      try {
        const pingResult = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        if (pingResult && pingResult.pong) {
          pingSuccess = true;
          console.log('Ping successful');
          break;
        }
      } catch (e) {
        console.log(`Ping attempt ${i + 1} failed`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    if (!pingSuccess) {
      throw new Error('Ni mogoc vzpostaviti povezave s skriptom. Osvezi stran in poskusi znova.');
    }

    showProgress('Skeniram izdelke...', 50);

    // Send scrape message
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'scrape' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });

    console.log('Scrape response:', response);

    if (response && response.success) {
      // Check if scraping started in background
      if (response.started) {
        console.log('Scraping started in background');
        updateStore(response.store || currentStore);
        updateStatus('Skeniram...', 'loading');
        showProgress('Pobiram izdelke... Klikni USTAVI za rezultate.', 50);
        showMessage('Skeniranje poteka v ozadju. Cakaj ali klikni USTAVI za trenutne rezultate.', 'progress');
        return; // Don't unlock buttons - STOP is visible
      }

      // Normal response with products
      scrapedData = response.products || [];
      updateStore(response.store || currentStore);
      updateProductCount(scrapedData.length);
      updateStatus('Koncano', 'ready');
      showProgress('Skeniranje koncano!', 100);

      if (scrapedData.length > 0) {
        showMessage(`Najdenih ${scrapedData.length} izdelkov!`, 'success');

        // Auto-export if connected to Google Sheets
        if (googleSheetsConnected) {
          setTimeout(() => {
            showMessage('Samodejno izvazam v Google Sheets...', 'progress');
            exportToGoogleSheets();
          }, 1500);
        }
      } else {
        showMessage('Ni najdenih izdelkov. Preveri ce si na pravilni strani s produkti.', 'warning');
      }

      updateGoogleSheetsButton();
      setButtonsEnabled(true);
      setTimeout(hideProgress, 2000);

    } else {
      throw new Error(response?.error || 'Neznana napaka pri skeniranju');
    }

  } catch (error) {
    console.error('Scrape error:', error);
    updateStatus('Napaka', 'error');
    showMessage('Napaka: ' + error.message, 'error');
    setButtonsEnabled(true);
    setTimeout(hideProgress, 2000);
  }
}

// ============================================
// GOOGLE SHEETS EXPORT
// ============================================

async function exportToGoogleSheets() {
  console.log('Export to Google Sheets start');

  if (!scrapedData || scrapedData.length === 0) {
    showMessage('Ni podatkov za izvoz! Najprej poberi izdelke.', 'error');
    return;
  }

  setButtonsEnabled(false);
  showProgress('Izvazam v Google Sheets...', 10);
  showMessage('Povezujem z Google Sheets...', 'progress');

  try {
    // Get token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError || !token) {
          reject(new Error(chrome.runtime.lastError?.message || 'Ni tokena'));
          return;
        }
        resolve(token);
      });
    });

    googleSheetsConnected = true;
    const storeName = currentStore || 'Trgovina';
    console.log('=== EXPORT START ===');
    console.log('Store name:', storeName);
    console.log('Scraped data count:', scrapedData?.length || 0);
    const spreadsheetTitle = `IZDELKI_${storeName}`;
    const sheetTitle = 'Podatki';
    const storageKey = `spreadsheetId_${storeName}`;

    showProgress('Preverjam obstojecii datoteko...', 30);

    // Get spreadsheet ID for this store
    const stored = await chrome.storage.local.get([storageKey]);
    let targetSpreadsheetId = stored[storageKey];

    console.log(`Looking for spreadsheet for ${storeName}:`, targetSpreadsheetId);

    // Check if spreadsheet still exists
    if (targetSpreadsheetId) {
      try {
        const checkRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}`,
          { headers: { 'Authorization': 'Bearer ' + token } }
        );
        if (!checkRes.ok) {
          console.log('Stored spreadsheet not found, will create new');
          targetSpreadsheetId = null;
        } else {
          console.log('Found existing spreadsheet for', storeName);
        }
      } catch (e) {
        targetSpreadsheetId = null;
      }
    }

    // If no spreadsheet for this store, create new
    if (!targetSpreadsheetId) {
      showProgress(`Ustvarjam IZDELKI_${storeName}...`, 40);
      console.log(`Creating new spreadsheet: ${spreadsheetTitle}`);

      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: spreadsheetTitle
          },
          sheets: [{
            properties: {
              title: sheetTitle,
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }]
        })
      });

      if (!createRes.ok) {
        const errorText = await createRes.text();
        throw new Error('Napaka pri ustvarjanju dokumenta: ' + errorText);
      }

      const createData = await createRes.json();
      targetSpreadsheetId = createData.spreadsheetId;

      // Save ID for this store
      await chrome.storage.local.set({ [storageKey]: targetSpreadsheetId });
      console.log(`Created new spreadsheet for ${storeName}:`, targetSpreadsheetId);

    } else {
      // Existing spreadsheet - READ existing data first, then merge
      showProgress(`Berem obstoječe podatke iz IZDELKI_${storeName}...`, 40);
      console.log('Reading existing data from spreadsheet...');
    }

    // Write/merge data
    await writeDataToSheet(token, targetSpreadsheetId, sheetTitle, targetSpreadsheetId !== null);

  } catch (error) {
    console.error('Export error:', error);
    showMessage('Napaka pri izvozu: ' + error.message, 'error');
    updateStatus('Napaka', 'error');
  } finally {
    setButtonsEnabled(true);
    setTimeout(hideProgress, 2000);
  }
}

async function writeDataToSheet(token, spreadsheetId, sheetTitle, mergeWithExisting = false) {
  if (!scrapedData || scrapedData.length === 0) {
    throw new Error('Ni podatkov za zapis!');
  }

  const today = new Date().toLocaleDateString('sl-SI');
  const now = new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  const timestamp = `${today} ${now}`;

  // Map za vse izdelke (kljuc = ime izdelka)
  const productMap = new Map();

  // Ce ze obstaja sheet, najprej preberi obstoječe podatke
  if (mergeWithExisting) {
    showProgress('Berem obstoječe izdelke...', 45);
    console.log('Reading existing data from sheet...');

    try {
      const readRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetTitle}'!A2:F10000`)}`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      );

      if (readRes.ok) {
        const readData = await readRes.json();
        const existingRows = readData.values || [];

        console.log(`Found ${existingRows.length} existing products`);

        // Dodaj obstoječe izdelke v map
        existingRows.forEach(row => {
          if (row[0]) { // Ime izdelka
            const name = row[0].trim();
            productMap.set(name.toLowerCase(), {
              name: name,
              price: row[1] || '',
              image: row[2] || '',
              salePrice: row[3] || '',
              status: row[4] || 'Na voljo',
              lastUpdate: row[5] || ''
            });
          }
        });

        console.log(`Loaded ${productMap.size} existing products into map`);
      }
    } catch (readError) {
      console.warn('Could not read existing data, will write all new:', readError);
    }
  }

  showProgress('Združujem podatke...', 55);

  // Statistika
  let updatedCount = 0;
  let newCount = 0;
  let unchangedCount = 0;

  // Dodaj/posodobi nove izdelke
  console.log(`Processing ${scrapedData.length} scraped products...`);
  scrapedData.forEach((product, index) => {
    console.log(`[${index}] Product data:`, JSON.stringify(product));
    const nameKey = (product.name || '').trim().toLowerCase();
    if (!nameKey) {
      console.log(`[${index}] SKIPPING - empty name`);
      return;
    }

    const imageFormula = (product.image && product.image.startsWith('http'))
      ? `=IMAGE("${product.image}")`
      : '';

    const statusText = product.statusText || (product.naVoljo === false ? 'NI NA VOLJO' : 'Na voljo');
    const newPrice = product.price || '';
    const newSalePrice = product.salePrice || '';

    if (productMap.has(nameKey)) {
      // Izdelek ze obstaja - preveri ali se je cena spremenila
      const existing = productMap.get(nameKey);
      const oldPrice = existing.price || '';

      if (oldPrice !== newPrice || existing.salePrice !== newSalePrice) {
        // Cena se je spremenila - posodobi
        console.log(`Posodabljam ceno: "${product.name}" ${oldPrice} -> ${newPrice}`);
        productMap.set(nameKey, {
          name: product.name,
          price: newPrice,
          image: imageFormula || existing.image,
          salePrice: newSalePrice,
          status: statusText,
          lastUpdate: timestamp
        });
        updatedCount++;
      } else {
        // Cena je enaka - samo posodobi timestamp
        existing.lastUpdate = timestamp;
        existing.status = statusText;
        unchangedCount++;
      }
    } else {
      // Nov izdelek - dodaj
      console.log(`[${index}] Nov izdelek: "${product.name}" - Cena: "${newPrice}" Akcija: "${newSalePrice}"`);
      productMap.set(nameKey, {
        name: product.name,
        price: newPrice,
        image: imageFormula,
        salePrice: newSalePrice,
        status: statusText,
        lastUpdate: timestamp
      });
      newCount++;
    }
  });

  console.log(`Statistika: ${newCount} novih, ${updatedCount} posodobljenih, ${unchangedCount} nespremenjenih`);
  showProgress(`Pisem ${productMap.size} izdelkov...`, 65);

  // Pripravi podatke za zapis
  const values = [
    ['IME IZDELKA', 'CENA', 'SLIKA', 'AKCIJSKA CENA', 'NA VOLJO', 'POSODOBLJENO']
  ];

  // Dodaj vse izdelke iz mape
  productMap.forEach((product) => {
    values.push([
      product.name || '',
      product.price || '',
      product.image || '',
      product.salePrice || '',
      product.status || 'Na voljo',
      product.lastUpdate || timestamp
    ]);
  });

  console.log('Total rows to write:', values.length);
  console.log('ProductMap size:', productMap.size);
  console.log('First few rows:', JSON.stringify(values.slice(0, 5)));

  // Najprej pocisti sheet (da odstranimo morebitne stare vrstice ki jih vec ni)
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetTitle}'!A:F`)}:clear`,
      {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      }
    );
  } catch (e) {
    console.warn('Could not clear sheet:', e);
  }

  // Napisi vse podatke
  const range = `'${sheetTitle}'!A1:F${values.length}`;

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: values })
    }
  );

  if (!writeRes.ok) {
    const errorText = await writeRes.text();
    console.error('Write FAILED:', errorText);
    throw new Error('Napaka pri pisanju podatkov: ' + errorText);
  }

  const writeResult = await writeRes.json();
  console.log('=== WRITE SUCCESSFUL ===');
  console.log('Updated range:', writeResult.updatedRange);
  console.log('Updated rows:', writeResult.updatedRows);
  console.log('Updated cells:', writeResult.updatedCells);
  showMessage(`${newCount} novih, ${updatedCount} posodobljenih cen, ${productMap.size} skupaj`, 'success');
  showProgress('Formatiram...', 80);

  // Format header
  try {
    const sheetInfoRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
      { headers: { 'Authorization': 'Bearer ' + token } }
    );

    if (sheetInfoRes.ok) {
      const sheetInfo = await sheetInfoRes.json();
      const targetSheet = sheetInfo.sheets.find(s => s.properties.title === sheetTitle);

      if (targetSheet) {
        const sheetId = targetSheet.properties.sheetId;

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                repeatCell: {
                  range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.4, green: 0.5, blue: 0.9 },
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                      horizontalAlignment: 'CENTER'
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
              },
              {
                updateDimensionProperties: {
                  range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
                  properties: { pixelSize: 300 },
                  fields: 'pixelSize'
                }
              },
              {
                updateDimensionProperties: {
                  range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
                  properties: { pixelSize: 150 },
                  fields: 'pixelSize'
                }
              },
              {
                updateDimensionProperties: {
                  range: { sheetId: sheetId, dimension: 'ROWS', startIndex: 1, endIndex: values.length },
                  properties: { pixelSize: 80 },
                  fields: 'pixelSize'
                }
              }
            ]
          })
        });
      }
    }
  } catch (formatError) {
    console.warn('Formatting warning:', formatError);
  }

  showProgress('Koncano!', 100);

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  console.log('Opening sheet:', url);

  // Sporocilo ze prikazano zgoraj z statistiko
  updateStatus('Izvozeno', 'ready');

  window.open(url, '_blank');
}

// ============================================
// RESET
// ============================================

function resetExtension() {
  console.log('Resetting extension...');

  scrapedData = null;
  googleSheetsConnected = false;
  spreadsheetId = null;
  currentStore = null;

  updateProductCount(0);
  updateStore('-');
  updateStatus('Pripravljen', 'idle');
  hideProgress();
  hideMessage();

  chrome.storage.local.clear(() => {
    console.log('Storage cleared');
  });

  showMessage('Razsiritev ponastavljena!', 'info');
  updateGoogleSheetsButton();
}

// ============================================
// MESSAGE LISTENER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'progress') {
    console.log('Progress update:', message.message);
    showProgress(message.message, 50);

    if (message.count !== undefined) {
      updateProductCount(message.count);
    }

    return true;
  }

  // Skeniranje koncano - avtomatski izvoz
  if (message.action === 'scrapeComplete') {
    console.log('Scraping complete!', message.productsFound, 'products');

    // Uporabi IIFE async funkcijo
    (async () => {
      let products = message.products || [];
      currentStore = message.store || currentStore;

      // Ce je prazno ali prevec, preberi iz storage
      if (products.length === 0 || message.readFromStorage) {
        console.log('Reading products from storage for export...');
        const key = `products_${currentStore}`;
        try {
          const stored = await chrome.storage.local.get([key]);
          if (stored[key] && stored[key].length > 0) {
            products = stored[key];
            console.log(`Loaded ${products.length} products from storage`);
          }
        } catch (e) {
          console.error('Error reading from storage:', e);
        }
      }

      scrapedData = products;
      updateProductCount(message.productsFound || products.length);
      updateStore(currentStore);
      setButtonsEnabled(true);

      if (scrapedData.length > 0) {
        showMessage(`Najdenih ${scrapedData.length} izdelkov! Izvažam...`, 'success');
        updateStatus('Izvažam...', 'loading');
        showProgress('Izvažam v Google Sheets...', 80);

        // Avtomatski izvoz
        try {
          await exportToGoogleSheets();
          console.log('Auto-export complete');
        } catch (err) {
          console.error('Auto-export error:', err);
          showMessage(`Najdenih ${scrapedData.length} izdelkov. Klikni Google Sheets za izvoz.`, 'warning');
        }
      } else {
        showMessage('Skeniranje končano, ni najdenih izdelkov.', 'warning');
        updateStatus('Ni izdelkov', 'idle');
        hideProgress();
      }
    })();

    return true;
  }
});

// ============================================
// UPDATE WEBSITE (CONVEX)
// ============================================

async function ensureSheetExists(token, spreadsheetId, sheetTitle) {
  const infoRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { 'Authorization': 'Bearer ' + token } }
  );

  if (!infoRes.ok) {
    const text = await infoRes.text().catch(() => '');
    throw new Error(`Ne morem prebrati master Sheeta (${infoRes.status}): ${text || 'napaka'}`);
  }

  const info = await infoRes.json();
  const sheets = info.sheets || [];
  const exists = sheets.some(s => s?.properties?.title === sheetTitle);

  if (exists) return;

  const createRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      }),
    }
  );

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Ne morem ustvariti taba "${sheetTitle}" (${createRes.status}): ${text || 'napaka'}`);
  }
}

async function resolveMasterSpreadsheetId(token) {
  const stored = await chrome.storage.local.get([MASTER_SPREADSHEET_ID_STORAGE_KEY]);
  const storedId = stored[MASTER_SPREADSHEET_ID_STORAGE_KEY];

  const tryId = async (spreadsheetId) => {
    if (!spreadsheetId) return false;
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`,
        { headers: { 'Authorization': 'Bearer ' + token } }
      );
      return res.ok;
    } catch {
      return false;
    }
  };

  if (storedId && await tryId(storedId)) {
    return storedId;
  }

  if (await tryId(MASTER_DEFAULT_SPREADSHEET_ID)) {
    await chrome.storage.local.set({ [MASTER_SPREADSHEET_ID_STORAGE_KEY]: MASTER_DEFAULT_SPREADSHEET_ID });
    return MASTER_DEFAULT_SPREADSHEET_ID;
  }

  // Fallback: create a new master sheet (keeps store spreadsheets untouched).
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: `PRHRAN_MASTER_${new Date().toISOString().slice(0, 10)}` },
      sheets: [
        {
          properties: {
            title: MASTER_SHEET_TITLE,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Ne morem ustvariti master Google Sheeta (${createRes.status}): ${text || 'napaka'}`);
  }

  const created = await createRes.json();
  const newId = created.spreadsheetId;
  if (!newId) {
    throw new Error('Ne morem dobiti ID-ja novega master Sheeta.');
  }

  await chrome.storage.local.set({ [MASTER_SPREADSHEET_ID_STORAGE_KEY]: newId });
  return newId;
}

async function findSpreadsheetIdByDriveName(token, spreadsheetName) {
  if (!spreadsheetName) return null;

  // Drive API query: find spreadsheet by exact name (most-recent modified first).
  const safeName = String(spreadsheetName).replace(/'/g, "\\'");
  const q = [
    `name='${safeName}'`,
    `mimeType='application/vnd.google-apps.spreadsheet'`,
    `trashed=false`,
  ].join(" and ");

  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?q=${encodeURIComponent(q)}` +
    `&orderBy=${encodeURIComponent("modifiedTime desc")}` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
    `&pageSize=1` +
    `&fields=${encodeURIComponent("files(id,name,modifiedTime)")}`;

  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    return null;
  }

  const data = await res.json().catch(() => null);
  const file = data?.files?.[0];
  return file?.id || null;
}

function extractSpreadsheetId(input) {
  const value = String(input || "").trim();
  if (!value) return null;

  const urlMatch = value.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[a-zA-Z0-9-_]{20,}$/.test(value)) return value;

  return null;
}

async function resolveStoreSpreadsheetId(token, storeName) {
  const storageKey = `spreadsheetId_${storeName}`;
  const stored = await chrome.storage.local.get([storageKey]);
  const storedId = stored[storageKey];

  const checkExists = async (spreadsheetId) => {
    if (!spreadsheetId) return false;
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        { headers: { Authorization: "Bearer " + token } }
      );
      return res.ok;
    } catch {
      return false;
    }
  };

  if (storedId && (await checkExists(storedId))) {
    return storedId;
  }

  const defaultId = DEFAULT_STORE_SPREADSHEET_IDS?.[storeName];
  if (defaultId && (await checkExists(defaultId))) {
    await chrome.storage.local.set({ [storageKey]: defaultId });
    return defaultId;
  }

  // If storage is empty (extension reset/reinstall), try to find by Drive filename.
  const spreadsheetTitle = `IZDELKI_${storeName}`;
  const foundId = await findSpreadsheetIdByDriveName(token, spreadsheetTitle);
  if (foundId && (await checkExists(foundId))) {
    await chrome.storage.local.set({ [storageKey]: foundId });
    return foundId;
  }

  return null;
}

async function updateMasterSheet(token, masterRows) {
  if (!Array.isArray(masterRows)) {
    throw new Error('Master rows niso veljavni.');
  }

  const masterSpreadsheetId = await resolveMasterSpreadsheetId(token);
  await ensureSheetExists(token, masterSpreadsheetId, MASTER_SHEET_TITLE);

  // Clear old data first (so removed products disappear too).
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${masterSpreadsheetId}/values/${encodeURIComponent(`'${MASTER_SHEET_TITLE}'!A:E`)}:clear`,
    { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }
  ).catch(() => {});

  // Write header row.
  const headerRange = `'${MASTER_SHEET_TITLE}'!A1:E1`;
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${masterSpreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [MASTER_HEADER] }),
    }
  );

  if (!headerRes.ok) {
    const text = await headerRes.text().catch(() => '');
    throw new Error(`Napaka pri pisanju headerja v master sheet (${headerRes.status}): ${text || 'napaka'}`);
  }

  // Write data in batches to avoid payload limits.
  const BATCH_ROWS = 5000;
  for (let i = 0; i < masterRows.length; i += BATCH_ROWS) {
    const batch = masterRows.slice(i, i + BATCH_ROWS);
    const startRow = 2 + i; // data starts at row 2
    const endRow = startRow + batch.length - 1;
    const range = `'${MASTER_SHEET_TITLE}'!A${startRow}:E${endRow}`;

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${masterSpreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: batch }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Napaka pri pisanju master podatkov (${res.status}): ${text || 'napaka'}`);
    }
  }

  return masterSpreadsheetId;
}

async function updateWebsite() {
  console.log('=== POSODABLJAM SPLETNO STRAN ===');

  setButtonsEnabled(false);
  showProgress('Povezujem z Google Sheets...', 10);
  showMessage('Berem podatke iz Google Sheets...', 'progress');

  try {
    // Pridobi Google token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError || !token) {
          reject(new Error(chrome.runtime.lastError?.message || 'Ni tokena'));
          return;
        }
        resolve(token);
      });
    });

    googleSheetsConnected = true;
    chrome.storage.local.set({ googleSheetsConnected: true });
    updateGoogleSheetsButton();

    // Seznam trgovin
    const stores = ['Mercator', 'Spar', 'Tus'];
    const allProducts = [];
    const masterRows = [];

    // Resolve all spreadsheet IDs first (avoid partial updates that would wipe other stores).
    const storeSpreadsheetIds = {};
    const missingStores = [];
    for (const storeName of stores) {
      const spreadsheetId = await resolveStoreSpreadsheetId(token, storeName);
      if (!spreadsheetId) {
        missingStores.push(storeName);
      } else {
        storeSpreadsheetIds[storeName] = spreadsheetId;
      }
    }

    if (missingStores.length > 0) {
      showMessage(
        `Manjkajo Google Sheeti za: ${missingStores.join(", ")}. Najprej izvozi te trgovine (Poberi izdelke → Izvozi v Google Sheets) ali prilepi URL/ID obstoječih IZDELKI_{trgovina} sheetov spodaj (Shrani ID-je sheetov), nato poskusi znova.`,
        "error"
      );
      updateStatus("Manjkajo Sheeti", "error");
      return;
    }

    // Preberi vsak sheet
    for (let i = 0; i < stores.length; i++) {
      const storeName = stores[i];
      const sheetTitle = `IZDELKI_${storeName}`;
      showProgress(`Berem ${sheetTitle}...`, 20 + (i * 20));

      const spreadsheetId = storeSpreadsheetIds[storeName];

      try {
        // Preberi podatke iz sheeta
        const readRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("'Podatki'!A2:F50000")}?valueRenderOption=FORMULA`,
          { headers: { 'Authorization': 'Bearer ' + token } }
        );

        if (!readRes.ok) {
          console.warn(`Napaka pri branju ${sheetTitle}:`, await readRes.text());
          continue;
        }

        const readData = await readRes.json();
        const rows = readData.values || [];

        console.log(`${sheetTitle}: ${rows.length} izdelkov`);

        // Pretvori v format za Convex
        for (const row of rows) {
          const name = (row[0] || '').trim();
          const priceStr = (row[1] || '').trim();
          const imageFormula = (row[2] || '').trim();
          const salePriceStr = (row[3] || '').trim();
          const lastUpdate = (row[5] || '').trim();

          if (!name || !priceStr) continue;

          const regularPrice = parsePriceValue(priceStr);
          const salePrice = parsePriceValue(salePriceStr);
          const imageUrl = extractImageUrlFromCell(imageFormula);

          if (!regularPrice) continue;

          // V Google Sheets: CENA = redna cena, AKCIJSKA CENA = znižana cena
          allProducts.push({
            ime: name,
            redna_cena: regularPrice,
            akcijska_cena: salePrice || undefined,
            trgovina: storeName,
            slika: imageUrl || undefined
          });

          // Master sheet row (for unified search)
          const shouldIncludeSale =
            salePrice !== undefined &&
            Number.isFinite(salePrice) &&
            salePrice > 0 &&
            salePrice < regularPrice;
          masterRows.push([
            name,
            regularPrice,
            shouldIncludeSale ? salePrice : '',
            storeName,
            lastUpdate || new Date().toISOString(),
          ]);
        }
      } catch (e) {
        console.warn(`Napaka pri branju ${sheetTitle}:`, e);
      }
    }

    console.log(`Skupaj: ${allProducts.length} izdelkov`);

    if (allProducts.length === 0) {
      throw new Error('Ni podatkov za pošiljanje! Najprej izvozi podatke v Google Sheets.');
    }

    // Najprej posodobi MASTER sheet (zdruzeno iz vseh trgovin), store sheeti ostanejo nedotaknjeni.
    try {
      showProgress('Zdruzujem vse trgovine v master sheet...', 70);
      const masterSpreadsheetId = await updateMasterSheet(token, masterRows);
      console.log('Master sheet updated:', masterSpreadsheetId, 'rows:', masterRows.length);
    } catch (e) {
      console.warn('Master sheet update failed (continuing with Convex upload):', e);
    }

    // Pošlji v Convex
    showProgress('Pošiljam v spletno stran...', 80);
    showMessage(`Pošiljam ${allProducts.length} izdelkov...`, 'progress');

    const UPLOAD_BATCH_SIZE = 300;
    const totalBatches = Math.ceil(allProducts.length / UPLOAD_BATCH_SIZE);

    let totals = {
      createdProducts: 0,
      updatedProducts: 0,
      createdPrices: 0,
      updatedPrices: 0,
      skipped: 0,
      unknownStores: 0,
    };

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * UPLOAD_BATCH_SIZE;
      const end = Math.min(start + UPLOAD_BATCH_SIZE, allProducts.length);
      const batch = allProducts.slice(start, end);

      const progress = 80 + Math.round(((batchIndex + 1) / totalBatches) * 18);
      showProgress(`Pošiljam v spletno stran... (${batchIndex + 1}/${totalBatches})`, progress);
      showMessage(
        `Pošiljam ${end.toLocaleString("sl-SI")} / ${allProducts.length.toLocaleString("sl-SI")} izdelkov...`,
        "progress"
      );

      const response = await fetch(CONVEX_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONVEX_API_TOKEN}`,
        },
        body: JSON.stringify({
          items: batch,
          clearFirst: batchIndex === 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Napaka API: ${response.status} - ${errorText || "Server error"}`);
      }

      const result = await response.json();
      console.log(`Convex batch ${batchIndex + 1}/${totalBatches} rezultat:`, result);

      totals = {
        createdProducts: totals.createdProducts + (result.createdProducts || 0),
        updatedProducts: totals.updatedProducts + (result.updatedProducts || 0),
        createdPrices: totals.createdPrices + (result.createdPrices || 0),
        updatedPrices: totals.updatedPrices + (result.updatedPrices || 0),
        skipped: totals.skipped + (result.skipped || 0),
        unknownStores: totals.unknownStores + (result.unknownStores || 0),
      };
    }

    showProgress("Končano!", 100);
    showMessage(
      `Uspešno! +${totals.createdProducts} izdelkov, +${totals.createdPrices} cen (posodobljeno: ${totals.updatedPrices}).`,
      "success"
    );

  } catch (error) {
    console.error('Update website error:', error);
    showMessage('Napaka: ' + error.message, 'error');
  } finally {
    setButtonsEnabled(true);
    setTimeout(hideProgress, 2000);
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  // Load stored settings
  try {
    const stored = await chrome.storage.local.get([
      'googleSheetsConnected',
      'spreadsheetId',
      'spreadsheetId_Mercator',
      'spreadsheetId_Spar',
      'spreadsheetId_Tus',
    ]);
    if (stored.googleSheetsConnected) {
      googleSheetsConnected = true;
    }
    if (stored.spreadsheetId) {
      spreadsheetId = stored.spreadsheetId;
    }

    const defaultsToSet = {};
    if (!stored.spreadsheetId_Mercator && DEFAULT_STORE_SPREADSHEET_IDS.Mercator) {
      defaultsToSet.spreadsheetId_Mercator = DEFAULT_STORE_SPREADSHEET_IDS.Mercator;
    }
    if (!stored.spreadsheetId_Spar && DEFAULT_STORE_SPREADSHEET_IDS.Spar) {
      defaultsToSet.spreadsheetId_Spar = DEFAULT_STORE_SPREADSHEET_IDS.Spar;
    }
    if (!stored.spreadsheetId_Tus && DEFAULT_STORE_SPREADSHEET_IDS.Tus) {
      defaultsToSet.spreadsheetId_Tus = DEFAULT_STORE_SPREADSHEET_IDS.Tus;
    }
    if (Object.keys(defaultsToSet).length > 0) {
      await chrome.storage.local.set(defaultsToSet);
      Object.assign(stored, defaultsToSet);
    }

    const mercatorInput = document.getElementById('sheetIdMercator');
    const sparInput = document.getElementById('sheetIdSpar');
    const tusInput = document.getElementById('sheetIdTus');
    if (mercatorInput) mercatorInput.value = stored.spreadsheetId_Mercator || '';
    if (sparInput) sparInput.value = stored.spreadsheetId_Spar || '';
    if (tusInput) tusInput.value = stored.spreadsheetId_Tus || '';
  } catch (e) {
    console.warn('Could not load stored settings:', e);
  }

  // Detect store
  await detectAndDisplayStore();

  // Attach event listeners
  const scrapeBtn = document.getElementById('scrapeBtn');
  const googleSheetsBtn = document.getElementById('googleSheetsBtn');
  const resetBtn = document.getElementById('resetBtn');
  const stopBtn = document.getElementById('stopBtn');
  const saveSheetIdsBtn = document.getElementById('saveSheetIdsBtn');

  if (scrapeBtn) {
    scrapeBtn.addEventListener('click', () => {
      console.log('Scrape button clicked');
      scrapeProducts();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      console.log('Stop button clicked');
      stopScraping();
    });
  }

  if (googleSheetsBtn) {
    googleSheetsBtn.addEventListener('click', () => {
      console.log('Google Sheets button clicked');
      if (scrapedData && scrapedData.length > 0) {
        exportToGoogleSheets();
      } else {
        googleSheetsLogin();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      console.log('Reset button clicked');
      resetExtension();
    });
  }

  const updateWebsiteBtn = document.getElementById('updateWebsiteBtn');
  if (updateWebsiteBtn) {
    updateWebsiteBtn.addEventListener('click', () => {
      console.log('Update website button clicked');
      updateWebsite();
    });
  }

  if (saveSheetIdsBtn) {
    saveSheetIdsBtn.addEventListener('click', async () => {
      const mercatorInput = document.getElementById('sheetIdMercator');
      const sparInput = document.getElementById('sheetIdSpar');
      const tusInput = document.getElementById('sheetIdTus');

      const mercatorId = extractSpreadsheetId(mercatorInput?.value);
      const sparId = extractSpreadsheetId(sparInput?.value);
      const tusId = extractSpreadsheetId(tusInput?.value);

      const invalid = [];
      if (!mercatorId) invalid.push('Mercator');
      if (!sparId) invalid.push('Spar');
      if (!tusId) invalid.push('Tus');

      if (invalid.length > 0) {
        showMessage(
          `Neveljaven ali manjkajoč ID za: ${invalid.join(", ")}. Odpri sheet in kopiraj cel URL ali samo ID iz /d/<ID>/...`,
          'error'
        );
        return;
      }

      await chrome.storage.local.set({
        spreadsheetId_Mercator: mercatorId,
        spreadsheetId_Spar: sparId,
        spreadsheetId_Tus: tusId,
      });

      showMessage('Shranjeno! Zdaj lahko klikneš Posodobi spletno stran.', 'success');
    });
  }

  // Update UI
  updateGoogleSheetsButton();
  showMessage('Pripravljen za delo!', 'info');

  console.log('Popup initialization complete');
});
