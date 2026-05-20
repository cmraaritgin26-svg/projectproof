# ProjectProof Render OCR Setup

Render is the secure backend for receipt OCR. The Android app should never contain the Google service account JSON.

## Files Added

- `backend/server.js`
- `backend/package.json`
- `backend/README.md`
- `render.yaml`

## Create The Render Service

1. Go to `https://dashboard.render.com`.
2. Click `New +`.
3. Choose `Blueprint`.
4. Connect the GitHub repo that contains this `ProjectProof` folder.
5. Select `render.yaml`.
6. Create the service named `projectproof-ocr`.

If you are not using Blueprint, create a Web Service manually:

```txt
Name: projectproof-ocr
Runtime: Node
Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

## Add Environment Variables

In Render, open the service, then go to `Environment`.

Add:

```txt
GOOGLE_SERVICE_ACCOUNT_JSON=<paste the full service account JSON>
APP_ALLOWED_ORIGINS=capacitor://localhost,ionic://localhost,http://localhost,http://localhost:8080
MAX_IMAGE_CHARS=9000000
```

Use this local file as the source for the JSON:

```txt
/storage/emulated/0/Download/mlb-stats-tracker-d823b-77f68c24301e.json
```

Do not commit that JSON file.

## Verify

Open:

```txt
https://projectproof-ocr.onrender.com/health
```

Expected:

```json
{"ok":true,"service":"projectproof-ocr","googleConfigured":true}
```

The app is wired to:

```txt
https://projectproof-ocr.onrender.com/ocr/receipt
```

You can change that in the app's Business Profile panel if Render gives you a different URL.
