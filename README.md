# WhatFig Google Sheets Add-on

A Google Sheets add-on built with Google Apps Script and [clasp](https://github.com/google/clasp).

## Setup

1. Install clasp globally:
   ```
   npm install -g @google/clasp
   ```

2. Log in to Google:
   ```
   clasp login
   ```

3. Create a new Apps Script project (or link an existing one):
   ```
   clasp create --type sheets --title "WhatFig"
   ```
   This will populate the `scriptId` in `.clasp.json`.

4. Push code to Apps Script:
   ```
   clasp push
   ```

## Development

- Edit `.gs` files locally and push with `clasp push`.
- Open the script editor in the browser: `clasp open`
- Watch for changes and auto-push: `clasp push --watch`

## Deployment

1. Create a new version: `clasp version "v1.0"`
2. Deploy the add-on from the Apps Script editor (Deploy > New deployment).
