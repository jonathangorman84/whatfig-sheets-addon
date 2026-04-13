function downloadSheetAsCSVAndOpenLink() {
  // Get the active spreadsheet and sheet name
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = spreadsheet.getActiveSheet().getName();
  
  // Construct the CSV download URL
  var url = "https://docs.google.com/spreadsheets/d/" + spreadsheet.getId() +
            "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName);
  
  // Create an HTML link to download the CSV and open a new tab
  var html = '<a href="' + url + '" target="_blank" onclick="window.open(\'http://whatnot.pxf.io/3JOjLd\', \'_blank\')">Click here to download the CSV and open the link</a>';
  
  // Display the download link in a modal dialog
  var htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(100);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Download CSV and Open Link');
}

