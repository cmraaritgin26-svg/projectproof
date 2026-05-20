# ProjectProof OCR Backend

Render service for receipt OCR. The Android app sends a receipt image to `POST /ocr/receipt`; this backend sends it to Google Vision OCR and returns vendor, date, total, and OCR lines.

## Render Environment Variables

Set these in the Render service Environment tab:

```txt
GOOGLE_SERVICE_ACCOUNT_JSON=<paste the full service account JSON>
APP_ALLOWED_ORIGINS=capacitor://localhost,ionic://localhost,http://localhost,http://localhost:8080
MAX_IMAGE_CHARS=9000000
```

Do not put `GOOGLE_SERVICE_ACCOUNT_JSON` in the app or commit it to source control.

## Endpoints

```txt
GET /health
POST /ocr/receipt
```

Request:

```json
{
  "imageBase64": "base64-or-data-url"
}
```

Response:

```json
{
  "ok": true,
  "vendor": "Store Name",
  "date": "05/20/2026",
  "total": "42.18",
  "confidence": 1,
  "lines": []
}
```
