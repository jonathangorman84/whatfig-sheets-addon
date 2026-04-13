/**
 * ===== Sparrow Automation (2025-06-14) =====
 * – Fixed identification of dash-style set IDs (e.g. “col11-5”)
 * – Safer “-1” appending for numeric sets
 * – All other logic unchanged
 */
const LOT_MODE_KEY = 'LOT_NUMBER_MODE';

const LOT_COUNTER_KEYS = {
  LOT: 'LOT_COUNTER_LOT',
  ULINE: 'LOT_COUNTER_ULINE'
};

const LOT_MODES = {
  OFF: 'OFF',
  LOT: 'LOT',
  ULINE: 'ULINE'
};

const CONFIG_KEYS = {
  WEB_APP_URL: 'CONFIG_WEB_APP_URL',
  DEFAULT_LISTING_DESC: 'CONFIG_DEFAULT_LISTING_DESC',
  DEFAULT_CUSTOM_DESC: 'CONFIG_DEFAULT_CUSTOM_DESC'
};

const DOCUMENT_CONFIG_KEYS = {
  LISTING_DESC_OVERRIDE: 'DOC_LISTING_DESC_OVERRIDE'
};

/* ─────────────────────────── Custom Fig Workflow ───────────────────────── */
const CUSTOM_COUNTER_KEY = 'LOT_COUNTER_CUSTOM';

function getWhatFigConfig_(key, defaultValue) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value !== null && value !== undefined && value !== '' ? value : (defaultValue || '');
}

function getEffectiveListingDescription_() {
  const docValue = PropertiesService.getDocumentProperties().getProperty(DOCUMENT_CONFIG_KEYS.LISTING_DESC_OVERRIDE);
  if (docValue !== null && docValue !== undefined && docValue !== '') {
    return docValue;
  }
  return getWhatFigConfig_(CONFIG_KEYS.DEFAULT_LISTING_DESC, '');
}

function getEffectiveCustomDescription_() {
  return getWhatFigConfig_(CONFIG_KEYS.DEFAULT_CUSTOM_DESC, getEffectiveListingDescription_());
}

function syncSettingsToScriptProperties() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Settings');

  if (!settingsSheet) {
    SpreadsheetApp.getUi().alert('Settings sheet not found.');
    return;
  }

  const webAppUrl = String(settingsSheet.getRange('B2').getValue() || '').trim();
  const listingDescription = String(settingsSheet.getRange('B3').getValue() || '').trim();
  const descriptionSheet = ss.getSheetByName('Description');
  const customDescription = descriptionSheet
    ? String(descriptionSheet.getRange('A2').getValue() || '').trim()
    : listingDescription;

  PropertiesService.getScriptProperties().setProperties({
    [CONFIG_KEYS.WEB_APP_URL]: webAppUrl,
    [CONFIG_KEYS.DEFAULT_LISTING_DESC]: listingDescription,
    [CONFIG_KEYS.DEFAULT_CUSTOM_DESC]: customDescription
  }, true);

  SpreadsheetApp.getUi().alert('WhatFig settings synced to Script Properties.');
}

function useDefaultListingDescription() {
  PropertiesService.getDocumentProperties().deleteProperty(DOCUMENT_CONFIG_KEYS.LISTING_DESC_OVERRIDE);
  SpreadsheetApp.getUi().alert('Listing description reset to the default value.');
}

function promptForCustomListingDescription() {
  const ui = SpreadsheetApp.getUi();
  const currentDescription = getEffectiveListingDescription_();
  const response = ui.prompt(
    'Set Listing Description',
    'Enter the listing description to use for this spreadsheet.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const value = String(response.getResponseText() || '').trim();
  if (!value) {
    ui.alert('No description entered. Keeping the current value.');
    return;
  }

  PropertiesService.getDocumentProperties().setProperty(DOCUMENT_CONFIG_KEYS.LISTING_DESC_OVERRIDE, value);
  ui.alert('Listing description updated for this spreadsheet.\n\nCurrent value:\n' + value);
}

function showCurrentListingDescription() {
  SpreadsheetApp.getUi().alert('Current listing description:\n\n' + (getEffectiveListingDescription_() || '(empty)'));
}

function resetCustomCounter() {
  PropertiesService.getScriptProperties().deleteProperty(CUSTOM_COUNTER_KEY);
  SpreadsheetApp.getUi().alert('CUSTOM counter reset to #01.');
}

// This receives the array of cropped images directly from the new Custom HTML scanner
function processCustomMobileImages(imageArray) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const desc = getEffectiveCustomDescription_(); 
    
    let addedCount = 0;
    const props = PropertiesService.getScriptProperties();
    
    for (let i = 0; i < imageArray.length; i++) {
      // 1. Save Image to Google Drive
      const blob = Utilities.newBlob(Utilities.base64Decode(imageArray[i]), MimeType.JPEG, "Custom_Minifig_" + new Date().getTime() + "_" + i + ".jpg");
      const file = DriveApp.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const imageUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

      // 2. Find the next empty row based on Column C
      const colC = sheet.getRange('C:C').getValues();
      let row = colC.findIndex(r => !r[0]) + 1;
      if (row === 0) row = colC.length + 1;

      // 3. Increment Counter and Build Title ("#01 Custom Fig")
      let counter = Number(props.getProperty(CUSTOM_COUNTER_KEY) || 1);
      let num = String(counter).padStart(2, '0');
      props.setProperty(CUSTOM_COUNTER_KEY, counter + 1);
      
      const itemName = "#" + num + " Custom Fig"; 

      // 4. Fill the spreadsheet row
      sheet.getRange(row, 1).setValue('Toys & Hobbies');
      sheet.getRange(row, 2).setValue('LEGO Minifigures');
      sheet.getRange(row, 3).setValue(itemName);
      sheet.getRange(row, 4).setValue(desc);
      sheet.getRange(row, 5).setValue(1);
      sheet.getRange(row, 6).setValue('Auction');
      sheet.getRange(row, 7).setValue('1');
      sheet.getRange(row, 8).setValue('0-1 oz');
      sheet.getRange(row, 10).setValue('Not Hazmat');
      sheet.getRange(row, 11).setValue('Used - Good');
      sheet.getRange(row, 14).setValue(imageUrl);

      addedCount++;
    }

    return "Successfully added " + addedCount + " Custom Minifigs!";
  } catch (err) {
    return "Error: " + err.message;
  }
}
/* ────────────────────────────────── UI ────────────────────────────────── */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('Sparrow Automation')
    .addItem('Fetch Bricklink ID Info', 'updateItems')
    
    //.addItem('Web Cam', 'openCameraModal')
    .addItem('📱 Scan with Phone (QR)', 'showQRCode') // <--- NEW BUTTON
    .addItem('📱 Scan Customs with Phone (QR)', 'showCustomQRCode') // <--- NEW BUTTON
    .addItem('Download Sheet', 'downloadSheetAsCSVAndOpenLink')
    .addItem('Clear Sheet', 'clearRowsFromSecond')
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Listing Description')
        .addItem('Use Default Description', 'useDefaultListingDescription')
        .addItem('Set Custom Description...', 'promptForCustomListingDescription')
        .addItem('Show Current Description', 'showCurrentListingDescription')
    )
    .addSubMenu(
      ui.createMenu('Config')
        .addItem('Sync Settings to Script Properties', 'syncSettingsToScriptProperties')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Lot Numbering')
        .addItem('Turn OFF', 'setLotModeOff')
        .addItem('#01 Lot', 'setLotModeLot')
        //.addItem('#01 Uline Bin', 'setLotModeUline')
        .addSeparator()
        .addItem('Reset LOT Counter', 'resetLotCounter')
        //.addItem('Reset ULINE Counter', 'resetUlineCounter')
        .addItem('Reset CUSTOM Counter', 'resetCustomCounter') // <--- NEW RESET
    )
    .addToUi();
}


/* ───────────────────────────── Main Workflow ─────────────────────────── */
function updateItems() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getActiveSheet();
  const data   = sheet.getDataRange().getValues();
  const desc   = getEffectiveListingDescription_();

  for (let r = 1; r < data.length; r++) {             // Skip header row 0
    if (data[r][1] !== '') continue;                  // Column B already filled → skip

    let itemId  = data[r][2];                         // Raw ID in Column C
    const type  = identifyItemType(itemId);           // "SET" | "MINIFIG"

    // Append "-1" only if it’s a set *and* no variant suffix exists yet
    if (type === 'SET' && !/-\d+$/.test(itemId)) {
      itemId += '-1';
    }

    // Fetch BrickLink data
    const { itemName, imageUrl } = getItemNamenew(itemId, type === 'SET' ? 'S' : 'M');

    /* ---------- Spreadsheet output ---------- */
    const category  = type === 'SET' ? 'LEGO Sets'        : 'LEGO Minifigures';
    const weight    = type === 'SET' ? '8-11 oz'          : '0-1 oz';
    const condition = type === 'SET' ? 'New in box'       : 'Used - Good';
    const imgLink   = type === 'SET'
      ? `https://img.bricklink.com/ItemImage/SN/0/${itemId}.png`
      : `https://img.bricklink.com/ItemImage/MN/0/${itemId}.png`;

    sheet.getRange(r + 1,  1).setValue('Toys & Hobbies');   // L1 category
    sheet.getRange(r + 1,  2).setValue(category);           // L2 category
    //sheet.getRange(r + 1,  3).setValue(itemName);           // Title
    const prefix = buildLotPrefix(); // uses row order
sheet.getRange(r + 1, 3).setValue(prefix + itemName);

    sheet.getRange(r + 1,  4).setValue(desc);               // Description
    sheet.getRange(r + 1,  5).setValue(1);                  // Quantity
    sheet.getRange(r + 1,  6).setValue('Auction');          // Sale type
    sheet.getRange(r + 1,  7).setValue('1');          // Sale type
    sheet.getRange(r + 1,  8).setValue(weight);             // Shipping weight
    sheet.getRange(r + 1, 10).setValue('Not Hazmat');       // Haz-flag
    sheet.getRange(r + 1, 11).setValue(condition);          // Condition
    sheet.getRange(r + 1, 14).setValue(imgLink);            // Image URL
  }
}

/* ─────────────────────────── BrickLink Helpers ───────────────────────── */
function getItemName(itemId, itemType) {
  const partType = itemType === 'S' ? 'S' : 'M';
  const url      = `https://www.bricklink.com/v2/catalog/catalogitem.page?${partType}=${itemId}`;

  try {
    const html = UrlFetchApp.fetch(url).getContentText();
    const m    = /<title>(.*?)<\/title>/i.exec(html);

    if (m && m[1]) {
      return m[1]
        .replace(/BrickLink/i, '')
        .replace(/(Minifigure|Set)\s*/i, '')
        .replace(/\s*\|\s*$/, '')
        .trim();
    }
    return 'Item name not found';
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

function getItemNameCategory(itemId, itemType) {
  const partType = itemType === 'S' ? 'S' : 'M';
  const url      = `https://www.bricklink.com/v2/catalog/catalogitem.page?${partType}=${itemId}`;

  try {
    const html = UrlFetchApp.fetch(url).getContentText();

    /* --- Title --- */
    const tMatch = /<title>(.*?)<\/title>/i.exec(html);
    let itemName = tMatch ? tMatch[1] : 'Item name not found';

    /* --- Category trail (use the last element) --- */
    const catReg = new RegExp(`<a href="//www\\.bricklink\\.com/catalogList\\.asp\\?catType=${partType}&amp;catString=[^"]+">([^<]+)<\\/a>`, 'gi');
    const cats   = [];
    let   cMatch;

    while ((cMatch = catReg.exec(html)) !== null) {
      cats.push(cMatch[1]);
    }
    const catName = cats.length ? cats[cats.length - 1] : 'Unknown Category';

    /* --- Clean title & compose --- */
    itemName = itemName
      .replace(/BrickLink/i, '')
      .replace(/(Minifigure|Set)\s*/i, '')
      .replace(/\s*\|\s*$/, '')
      .trim();

    let out = `${catName}: ${itemName}`;
    if (out.length > 99) out = out.substring(0, 95) + '...';
    return out;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

function getItemNamenew(itemId, itemType) {
  const partType = itemType || 'P';    // default to Part if unknown
  const url      = `https://www.bricklink.com/v2/catalog/catalogitem.page?${partType}=${itemId}`;

  try {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      followRedirects: true,
      muteHttpExceptions: true // Prevents Google from crashing on a 404 error
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const html = response.getContentText();

    // If BrickLink explicitly says it doesn't exist or throws a web error
    if (html.includes('Item Not Found') || response.getResponseCode() !== 200) {
       if (partType !== 'P') return getItemNamenew(itemId, 'P');
       return { itemName: `${itemId} not found`, imageUrl: 'Image not found' };
    }

    /* --- Image (if any) --- */
    const imgMatch = /<img[^>]+id="_idImageMain"[^>]+src="([^"]+)"/i.exec(html);
    const imageUrl = imgMatch && imgMatch[1] ? 'https:' + imgMatch[1] : 'Image not found';

    /* --- Title --- */
    const tMatch = /<title>(.*?)<\/title>/i.exec(html);
    if (tMatch && tMatch[1]) {
      const rawTitle = tMatch[1];
      
      // Double-check the title just in case Bricklink served an error page
      if (rawTitle.toLowerCase().includes('not found') || rawTitle.toLowerCase().includes('error')) {
          if (partType !== 'P') return getItemNamenew(itemId, 'P');
          return { itemName: `${itemId} not found`, imageUrl: 'Image not found' };
      }

      const itemName = rawTitle
        .replace(/BrickLink/i, '')
        .replace(/(Minifigure|Set|Part)\s*/i, '')
        .replace(/\s*\|\s*$/, '')
        .trim();
        
      return { itemName, imageUrl };
    }

    /* --- Fallback: try as Part if first attempt failed --- */
    if (partType !== 'P') return getItemNamenew(itemId, 'P');
    return { itemName: `${itemId} not found`, imageUrl };
    
  } catch (err) {
    // If the entire request fails, return the ID
    return { itemName: `${itemId} not found`, imageUrl: 'Image not found' };
  }
}

/* ───────────────────────────── Misc Helpers ──────────────────────────── */
function addIdToSheet(itemId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const colC  = sheet.getRange('C:C').getValues();
  let row     = colC.findIndex(r => !r[0]) + 1;
  if (row === 0) row = colC.length + 1;

  sheet.getRange(row, 3).setValue(itemId);
  updateItems();                            // run automatically
}

/* ───────────────────── Improved ID Classification ────────────────────── */
/**
 * Decide whether a BrickLink ID refers to a SET or a MINIFIG.
 *
 * Rules:
 *   1. Any ID containing a dash (“-”) → SET      (e.g. “col11-5”, “75192-1”)
 *   2. Purely numeric IDs            → SET      (e.g. “21309”)
 *   3. Known set-only prefixes       → SET      (col, idea, gwp, set…)
 *   4. Otherwise → MINIFIG
 */
function identifyItemType(itemId) {
  const id = String(itemId).toLowerCase();

  // Rule 0: If it starts with "idea", treat as MINIFIG
  if (id.startsWith('idea')) return 'MINIFIG';

  // Rule 1: If it contains a dash, treat as a set (e.g., "75192-1", "col11-5")
  if (id.includes('-')) return 'SET';

  // Rule 2: If it's numeric only, it's a set
  if (/^\d+$/.test(id)) return 'SET';

  // Rule 3: Known set-only prefixes (but not "idea" anymore)
  if (/^(gwp|set)\d+/i.test(id)) return 'SET';

  // Rule 4: Everything else is treated as a minifigure
  return 'MINIFIG';
}

function setLotModeOff() {
  PropertiesService.getScriptProperties()
    .setProperty(LOT_MODE_KEY, LOT_MODES.OFF);
  SpreadsheetApp.getUi().alert('Lot numbering disabled.');
}

function setLotModeLot() {
  PropertiesService.getScriptProperties()
    .setProperty(LOT_MODE_KEY, LOT_MODES.LOT);
  SpreadsheetApp.getUi().alert('Lot numbering set to "#01 Lot".');
}

function setLotModeUline() {
  PropertiesService.getScriptProperties()
    .setProperty(LOT_MODE_KEY, LOT_MODES.ULINE);
  SpreadsheetApp.getUi().alert('Lot numbering set to "#01 Uline Bin".');
}



function buildLotPrefix() {
  const props = PropertiesService.getScriptProperties();
  const mode  = props.getProperty(LOT_MODE_KEY) || LOT_MODES.OFF;

  if (mode === LOT_MODES.OFF) return '';

  const counterKey =
    mode === LOT_MODES.LOT
      ? LOT_COUNTER_KEYS.LOT
      : LOT_COUNTER_KEYS.ULINE;

  let counter = Number(props.getProperty(counterKey) || 1);
  const num   = String(counter).padStart(2, '0');

  props.setProperty(counterKey, counter + 1);

  if (mode === LOT_MODES.LOT) {
    return `Lot #${num} `; // e.g., "Lot #01 "
  }

  if (mode === LOT_MODES.ULINE) {
    return `Uline #${num} `; // e.g., "Uline #01 "
  }

  return '';
}


/* ─────────────────────────── Custom Lot Workflow ───────────────────────── */
function processCustomLot(base64Data) {
  try {
    // 1. Save Image to Google Drive and get a direct link
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.JPEG, "Custom_Minifig_" + new Date().getTime() + ".jpg");
    const file = DriveApp.createFile(blob);
    
    // Set permissions so the image URL works on external sites (Whatnot/eBay)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const imageUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();

    // 2. Find the next empty row based on Column C
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const colC  = sheet.getRange('C:C').getValues();
    let row     = colC.findIndex(r => !r[0]) + 1;
    if (row === 0) row = colC.length + 1;

    // 3. Build the Title and grab Description
    const desc = getEffectiveCustomDescription_();
    const prefix = buildLotPrefix(); 
    const itemName = prefix + "Custom Minifig"; // Results in "Lot #01 Custom Minifig"

    // 4. Fill the spreadsheet row
    sheet.getRange(row, 1).setValue('Toys & Hobbies');
    sheet.getRange(row, 2).setValue('LEGO Minifigures');
    sheet.getRange(row, 3).setValue(itemName);
    sheet.getRange(row, 4).setValue(desc);
    sheet.getRange(row, 5).setValue(1);
    sheet.getRange(row, 6).setValue('Auction');
    sheet.getRange(row, 7).setValue('1');
    sheet.getRange(row, 8).setValue('0-1 oz');
    sheet.getRange(row, 10).setValue('Not Hazmat');
    sheet.getRange(row, 11).setValue('Used - Good');
    sheet.getRange(row, 14).setValue(imageUrl);

    return itemName + " added successfully!";
  } catch (err) {
    return "Error: " + err.message;
  }
}

/* ─────────────────────────── Reset of Lot Counters ─────────────────────────────── */
function resetLotCounter() {
  PropertiesService.getScriptProperties()
    .deleteProperty(LOT_COUNTER_KEYS.LOT);
  SpreadsheetApp.getUi().alert('LOT counter reset to #01.');
}

function resetUlineCounter() {
  PropertiesService.getScriptProperties()
    .deleteProperty(LOT_COUNTER_KEYS.ULINE);
  SpreadsheetApp.getUi().alert('ULINE counter reset to #01.');
}


/* ─────────────────────────── End of File ─────────────────────────────── */

