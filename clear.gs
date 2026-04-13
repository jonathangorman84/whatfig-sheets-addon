function clearRowsFromSecond() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('Template');

  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
  } else {
    Logger.log("Sheet named 'Template' does not exist.");
  }
}
