function openCameraModal() {
  const html = HtmlService
    .createHtmlOutputFromFile('CameraModal')
    .setTitle('Capture Minifig')
    .setWidth(400)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showSidebar(html);
}


/*
function openCameraModal() {
  const url = 'https://script.google.com/macros/s/AKfycbzSocu29FQmdmRkUbI3EmRXqtKqPIaAy9-R9u2bvavbY_ZijYq_C9y6zA9Z0dwxRlGI/exec';
  SpreadsheetApp.getUi().showModelessDialog(
    HtmlService.createHtmlOutput(
      `<script>window.open('${url}', '_blank');google.script.host.close();</script>`
    ),
    'Opening Camera'
  );
}
*/


function uploadImageToAPI(base64Image, mimeType) {
  try {
    var decodedImage = Utilities.base64Decode(base64Image);
    var imageBlob = Utilities.newBlob(decodedImage, mimeType, 'uploaded_image');

    var url = 'https://api.brickognize.com/predict/';
    var formData = {
      'query_image': imageBlob
    };

    var options = {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      payload: formData
    };

    var response = UrlFetchApp.fetch(url, options);
    var jsonResponse = JSON.parse(response.getContentText());

    var items = jsonResponse.items;
    var itemId = items && items.length > 0 ? items[0].id : 'No ID found';
    //var itemName = items && items.length > 0 ? items[0].name : 'Unknown';

    //if (itemId !== 'No ID found') {
    //  updateGoogleSheet(itemId, itemName);
    //}

    return `Product ID: ${itemId}`;
  } catch (error) {
    return "An error occurred: " + error.message;
  }
}


function quickCaptureMinifig() {
  var html = HtmlService.createHtmlOutputFromFile('QuickCapture')
    .setWidth(1)
    .setHeight(1);
  SpreadsheetApp.getUi().showModalDialog(html, ' '); // Invisible modal
}

/*
function updateGoogleSheet(itemId, itemName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cell = sheet.getActiveCell();
  cell.setValue(itemId);
  cell.offset(0, 1).setValue(itemName);
}
*/

function identifyAndSaveImageToDrive(base64Image, mimeType) {
  try {
    // 1. Decode and save image to Drive
    const decoded = Utilities.base64Decode(base64Image);
    const blob = Utilities.newBlob(decoded, mimeType, 'minifig.jpg');

    const folder = getOrCreatePublicFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const imageUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

    // 2. Send image to Brickognize
    const apiUrl = 'https://api.brickognize.com/predict/';
    const options = {
      method: 'POST',
      headers: { accept: 'application/json' },
      payload: { query_image: file.getBlob() }
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const json = JSON.parse(response.getContentText());

    const itemId = json.items?.[0]?.id || 'No ID found';

    if (itemId === 'No ID found') {
      return '❌ No ID found from Brickognize';
    }

    // 3. Append ID to next empty row in Column C
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const colC = sheet.getRange('C:C').getValues();
    let row = colC.findIndex(r => !r[0]) + 1;
    if (row === 0) row = colC.length + 1;

    sheet.getRange(row, 3).setValue(itemId);  // Column C

    // 4. Trigger updateItems (fills row)
    updateItems();

    // 5. Overwrite BrickLink image with saved image in Column N
    sheet.getRange(row, 14).setValue(imageUrl);  // Column N

    return `✅ Added ${itemId} to row ${row} with custom image.`;
  } catch (err) {
    return '❌ Error: ' + err.message;
  }
}



function getOrCreatePublicFolder() {
  const folderName = 'Whatnot Images';
  const folders = DriveApp.getFoldersByName(folderName);

  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return folder;
}


/* ─────────────────────────── Mobile Scanner Workflow ───────────────────────── */

// 1. Serve the Mobile Web App
function doGet(e) {
  const ssId = (e && e.parameter && e.parameter.ssId) ? e.parameter.ssId : '';
  const isCustom = e && e.parameter && e.parameter.mode === 'custom';

  const template = HtmlService.createTemplateFromFile(isCustom ? 'ScannerCustom' : 'MobileApp');
  template.ssId = ssId;
  template.buildTag = 'a04e0a4';

  return template.evaluate()
    .setTitle(isCustom ? 'WhatFig Custom Scanner' : 'WhatFig Mobile Scanner')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 2. Display the QR Code
function showQRCode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssId = ss.getId();
  const webAppUrl = getConfiguredWebAppUrl_();
  
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    SpreadsheetApp.getUi().alert('WhatFig is not fully configured yet. The add-on owner must set the published Web App URL.');
    return;
  }
  
  const fullUrl = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + 'ssId=' + ssId;
  const qrUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(fullUrl) + "&size=300";
  
  const html = HtmlService.createHtmlOutput(`
    <div style="text-align: center; font-family: Arial;">
      <h2>📱 Mobile Scanner</h2>
      <img src="${qrUrl}" width="300" height="300" style="border: 2px solid #ccc; border-radius: 10px;"/>
      <p style="color: #666;">Point your phone camera here to open.</p>
      <p style="color: #999; font-size: 11px;">Target sheet ID: ${ssId}</p>
    </div>
  `).setWidth(350).setHeight(450);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Scan with Phone');
}

// 2b. Display the Custom QR Code
function showCustomQRCode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssId = ss.getId();
  const webAppUrl = getConfiguredWebAppUrl_();
  
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    SpreadsheetApp.getUi().alert('WhatFig is not fully configured yet. The add-on owner must set the published Web App URL.');
    return;
  }
  
  // Append mode and spreadsheet ID to the URL
  const customUrl = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + 'mode=custom&ssId=' + ssId;
  const qrUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(customUrl) + "&size=300";
  
  const html = HtmlService.createHtmlOutput(`
    <div style="text-align: center; font-family: Arial;">
      <h2>📱 Custom Scanner</h2>
      <img src="${qrUrl}" width="300" height="300" style="border: 2px solid #ccc; border-radius: 10px;"/>
      <p style="color: #666;">Point your phone camera here to open the Custom Minifig app.</p>
      <p style="color: #999; font-size: 11px;">Target sheet ID: ${ssId}</p>
    </div>
  `).setWidth(350).setHeight(450);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Scan Customs with Phone');
}

// 3. Process the Batch Images from the Phone
function resolveTargetSpreadsheetForMobile_(ssId) {
  if (!ssId) {
    throw new Error('Missing spreadsheet ID in QR URL. Re-open the scanner by scanning a fresh QR code from the target sheet.');
  }

  try {
    return SpreadsheetApp.openById(ssId);
  } catch (err) {
    throw new Error(
      'No permission for target sheet ID ' + ssId + '. ' +
      'Make sure the phone is signed into a Google account that has Editor access to that copied sheet. ' +
      'Open this sheet directly: https://docs.google.com/spreadsheets/d/' + ssId + '/edit. ' +
      'Details: ' + err.message
    );
  }
}

function processMobileImages(imageArray, ssId) {
  try {
    const ss = resolveTargetSpreadsheetForMobile_(ssId);
    const sheet = ss.getActiveSheet();
    const folder = getOrCreatePublicFolder();
    let addedCount = 0;

    for (let i = 0; i < imageArray.length; i++) {
       const decoded = Utilities.base64Decode(imageArray[i]);
       const blob = Utilities.newBlob(decoded, MimeType.JPEG, `Mobile_Fig_${new Date().getTime()}_${i}.jpg`);
       const file = folder.createFile(blob);
       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       const imageUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

       // Send to Brickognize
       const apiUrl = 'https://api.brickognize.com/predict/';
       const options = {
         method: 'POST',
         headers: { accept: 'application/json' },
         payload: { query_image: file.getBlob() }
       };
       const response = UrlFetchApp.fetch(apiUrl, options);
       const json = JSON.parse(response.getContentText());
       const itemId = json.items?.[0]?.id || 'No ID found';

       // Find next row
       const colC = sheet.getRange('C:C').getValues();
       let row = colC.findIndex(r => !r[0]) + 1;
       if (row === 0) row = colC.length + 1;

       // 1. Insert ID
       sheet.getRange(row, 3).setValue(itemId);

       // Fill the same row directly on the explicit target sheet.
       populateDetectedMinifigRow_(sheet, row, itemId, imageUrl);
       
       addedCount++;
    }
    return `✅ Successfully identified and added ${addedCount} Minifigures!`;
  } catch (err) {
    return '❌ Error: ' + err.message;
  }
}

function populateDetectedMinifigRow_(sheet, row, itemId, imageUrl) {
  const type = identifyItemType(itemId);
  const isSet = type === 'SET';
  const resolvedId = isSet && !/-\d+$/.test(itemId) ? (itemId + '-1') : itemId;
  const itemNameData = getItemNamenew(resolvedId, isSet ? 'S' : 'M');
  const itemName = itemNameData && itemNameData.itemName ? itemNameData.itemName : resolvedId;

  const category  = isSet ? 'LEGO Sets' : 'LEGO Minifigures';
  const weight    = isSet ? '8-11 oz' : '0-1 oz';
  const condition = isSet ? 'New in box' : 'Used - Good';
  const desc = getWhatFigConfig_(CONFIG_KEYS.DEFAULT_LISTING_DESC, DEFAULT_LISTING_DESCRIPTION);
  const prefix = buildLotPrefix();

  sheet.getRange(row, 1).setValue('Toys & Hobbies');
  sheet.getRange(row, 2).setValue(category);
  sheet.getRange(row, 3).setValue(prefix + itemName);
  sheet.getRange(row, 4).setValue(desc);
  sheet.getRange(row, 5).setValue(1);
  sheet.getRange(row, 6).setValue('Auction');
  sheet.getRange(row, 7).setValue('1');
  sheet.getRange(row, 8).setValue(weight);
  sheet.getRange(row, 10).setValue('Not Hazmat');
  sheet.getRange(row, 11).setValue(condition);
  sheet.getRange(row, 14).setValue(imageUrl);
}

