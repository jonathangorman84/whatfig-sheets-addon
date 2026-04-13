/**
 * ===== Sparrow Automation (2025-06-14) =====
 * Fixed identification of dash-style set IDs (e.g. "col11-5")
 * Safer "-1" appending for numeric sets
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

/* Custom Fig Workflow */
const CUSTOM_COUNTER_KEY = 'LOT_COUNTER_CUSTOM';

function resetCustomCounter() {
  PropertiesService.getScriptProperties().deleteProperty(CUSTOM_COUNTER_KEY);
  SpreadsheetApp.getUi().alert('CUSTOM counter reset to #01.');
}

// Receives cropped images from the Custom HTML scanner phone app
function processCustomMobileImages(imageArray, ssId) {
  try {
    const ss = ssId ? SpreadsheetApp.openById(ssId) : SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const descSheet = ss.getSheetByName('Description');
    const desc = descSheet ? descSheet.getRange('A2').getValue() : '';

    let addedCount = 0;
    const props = PropertiesService.getScriptProperties();

    for (let i = 0; i < imageArray.length; i++) {
      const blob = Utilities.newBlob(Utilities.base64Decode(imageArray[i]), MimeType.JPEG, "Custom_Minifig_" + new Date().getTime() + "_" + i + ".jpg");
      const file = DriveApp.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();

      const colC = sheet.getRange('C:C').getValues();
      let row = colC.findIndex(r => !r[0]) + 1;
      if (row === 0) row = colC.length + 1;

      let counter = Number(props.getProperty(CUSTOM_COUNTER_KEY) || 1);
      let num = String(counter).padStart(2, '0');
      props.setProperty(CUSTOM_COUNTER_KEY, counter + 1);
      const itemName = "#" + num + " Custom Fig";

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

/* UI */
function onInstall(e) {
  onOpen(e);
}

function onOpen(e) {
  const ui = SpreadsheetApp.getUi();

  if (e && e.authMode === ScriptApp.AuthMode.NONE) {
    ui.createAddonMenu()
      .addItem('Authorize WhatFig', 'onInstall')
      .addToUi();
    return;
  }

  ui.createAddonMenu()
    .addItem('Fetch Bricklink ID Info', 'updateItems')
    .addItem('Scan with Phone (QR)', 'showQRCode')
    .addItem('Scan Customs with Phone (QR)', 'showCustomQRCode')
    .addItem('Download Sheet', 'downloadSheetAsCSVAndOpenLink')
    .addItem('Clear Sheet', 'clearRowsFromSecond')
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Lot Numbering')
        .addItem('Turn OFF', 'setLotModeOff')
        .addItem('#01 Lot', 'setLotModeLot')
        .addSeparator()
        .addItem('Reset LOT Counter', 'resetLotCounter')
        .addItem('Reset CUSTOM Counter', 'resetCustomCounter')
    )
    .addToUi();
}

/* Main Workflow */
function updateItems() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getActiveSheet();
  const data   = sheet.getDataRange().getValues();
  const desc   = ss.getSheetByName('Settings').getRange('B3').getValue();

  for (let r = 1; r < data.length; r++) {
    if (data[r][1] !== '') continue;

    let itemId  = data[r][2];
    const type  = identifyItemType(itemId);

    if (type === 'SET' && !/-\d+$/.test(itemId)) {
      itemId += '-1';
    }

    const { itemName, imageUrl } = getItemNamenew(itemId, type === 'SET' ? 'S' : 'M');

    const category  = type === 'SET' ? 'LEGO Sets'  : 'LEGO Minifigures';
    const weight    = type === 'SET' ? '8-11 oz'    : '0-1 oz';
    const condition = type === 'SET' ? 'New in box' : 'Used - Good';
    const imgLink   = type === 'SET'
      ? 'https://img.bricklink.com/ItemImage/SN/0/' + itemId + '.png'
      : 'https://img.bricklink.com/ItemImage/MN/0/' + itemId + '.png';

    sheet.getRange(r + 1,  1).setValue('Toys & Hobbies');
    sheet.getRange(r + 1,  2).setValue(category);
    const prefix = buildLotPrefix();
    sheet.getRange(r + 1, 3).setValue(prefix + itemName);
    sheet.getRange(r + 1,  4).setValue(desc);
    sheet.getRange(r + 1,  5).setValue(1);
    sheet.getRange(r + 1,  6).setValue('Auction');
    sheet.getRange(r + 1,  7).setValue('1');
    sheet.getRange(r + 1,  8).setValue(weight);
    sheet.getRange(r + 1, 10).setValue('Not Hazmat');
    sheet.getRange(r + 1, 11).setValue(condition);
    sheet.getRange(r + 1, 14).setValue(imgLink);
  }
}

/* BrickLink Helpers */
function getItemNamenew(itemId, itemType) {
  const partType = itemType || 'P';
  const url = 'https://www.bricklink.com/v2/catalog/catalogitem.page?' + partType + '=' + itemId;

  try {
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      followRedirects: true,
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    const html = response.getContentText();

    if (html.includes('Item Not Found') || response.getResponseCode() !== 200) {
      if (partType !== 'P') return getItemNamenew(itemId, 'P');
      return { itemName: itemId + ' not found', imageUrl: 'Image not found' };
    }

    const imgMatch = /<img[^>]+id="_idImageMain"[^>]+src="([^"]+)"/i.exec(html);
    const imageUrl = imgMatch && imgMatch[1] ? 'https:' + imgMatch[1] : 'Image not found';

    const tMatch = /<title>(.*?)<\/title>/i.exec(html);
    if (tMatch && tMatch[1]) {
      const rawTitle = tMatch[1];
      if (rawTitle.toLowerCase().includes('not found') || rawTitle.toLowerCase().includes('error')) {
        if (partType !== 'P') return getItemNamenew(itemId, 'P');
        return { itemName: itemId + ' not found', imageUrl: 'Image not found' };
      }
      const itemName = rawTitle
        .replace(/BrickLink/i, '')
        .replace(/(Minifigure|Set|Part)\s*/i, '')
        .replace(/\s*\|\s*$/, '')
        .trim();
      return { itemName, imageUrl };
    }

    if (partType !== 'P') return getItemNamenew(itemId, 'P');
    return { itemName: itemId + ' not found', imageUrl };

  } catch (err) {
    return { itemName: itemId + ' not found', imageUrl: 'Image not found' };
  }
}

/* Misc Helpers */
function addIdToSheet(itemId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const colC  = sheet.getRange('C:C').getValues();
  let row     = colC.findIndex(r => !r[0]) + 1;
  if (row === 0) row = colC.length + 1;
  sheet.getRange(row, 3).setValue(itemId);
  updateItems();
}

/* ID Classification */
function identifyItemType(itemId) {
  const id = String(itemId).toLowerCase();
  if (id.startsWith('idea')) return 'MINIFIG';
  if (id.includes('-')) return 'SET';
  if (/^\d+$/.test(id)) return 'SET';
  if (/^(gwp|set)\d+/i.test(id)) return 'SET';
  return 'MINIFIG';
}

function setLotModeOff() {
  PropertiesService.getScriptProperties().setProperty(LOT_MODE_KEY, LOT_MODES.OFF);
  SpreadsheetApp.getUi().alert('Lot numbering disabled.');
}

function setLotModeLot() {
  PropertiesService.getScriptProperties().setProperty(LOT_MODE_KEY, LOT_MODES.LOT);
  SpreadsheetApp.getUi().alert('Lot numbering set to "#01 Lot".');
}

function setLotModeUline() {
  PropertiesService.getScriptProperties().setProperty(LOT_MODE_KEY, LOT_MODES.ULINE);
  SpreadsheetApp.getUi().alert('Lot numbering set to "#01 Uline Bin".');
}

function buildLotPrefix() {
  const props = PropertiesService.getScriptProperties();
  const mode  = props.getProperty(LOT_MODE_KEY) || LOT_MODES.OFF;
  if (mode === LOT_MODES.OFF) return '';
  const counterKey = mode === LOT_MODES.LOT ? LOT_COUNTER_KEYS.LOT : LOT_COUNTER_KEYS.ULINE;
  let counter = Number(props.getProperty(counterKey) || 1);
  const num   = String(counter).padStart(2, '0');
  props.setProperty(counterKey, counter + 1);
  if (mode === LOT_MODES.LOT)   return 'Lot #' + num + ' ';
  if (mode === LOT_MODES.ULINE) return 'Uline #' + num + ' ';
  return '';
}

/* Custom Lot Workflow */
function processCustomLot(base64Data) {
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.JPEG, "Custom_Minifig_" + new Date().getTime() + ".jpg");
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const imageUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const colC  = sheet.getRange('C:C').getValues();
    let row     = colC.findIndex(r => !r[0]) + 1;
    if (row === 0) row = colC.length + 1;

    const desc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Description').getRange('A2').getValue();
    const prefix = buildLotPrefix();
    const itemName = prefix + "Custom Minifig";

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

/* Reset Lot Counters */
function resetLotCounter() {
  PropertiesService.getScriptProperties().deleteProperty(LOT_COUNTER_KEYS.LOT);
  SpreadsheetApp.getUi().alert('LOT counter reset to #01.');
}

function resetUlineCounter() {
  PropertiesService.getScriptProperties().deleteProperty(LOT_COUNTER_KEYS.ULINE);
  SpreadsheetApp.getUi().alert('ULINE counter reset to #01.');
}