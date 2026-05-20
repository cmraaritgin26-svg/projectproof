import express from "express";
import cors from "cors";
import vision from "@google-cloud/vision";

const PORT = Number(process.env.PORT || 10000);
const MAX_IMAGE_CHARS = Number(process.env.MAX_IMAGE_CHARS || 9_000_000);
const ALLOWED_ORIGINS = (process.env.APP_ALLOWED_ORIGINS || "capacitor://localhost,ionic://localhost,http://localhost,http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*")) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  }
}));
app.use(express.json({ limit: "12mb" }));

let visionClient;

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "projectproof-ocr",
    googleConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  });
});

app.post("/ocr/receipt", async (request, response) => {
  try {
    const imageBase64 = normalizeImagePayload(request.body?.imageBase64 || request.body?.dataUrl);
    if (!imageBase64) {
      response.status(400).json({ ok: false, error: "Missing imageBase64" });
      return;
    }
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      response.status(413).json({ ok: false, error: "Image too large" });
      return;
    }

    const [result] = await getVisionClient().textDetection({
      image: { content: imageBase64 }
    });
    const text = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";
    const parsed = parseReceiptText(text);

    response.json({
      ok: true,
      rawText: text,
      vendor: parsed.vendor,
      date: parsed.date,
      total: parsed.total,
      confidence: parsed.confidence,
      lines: parsed.lines
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: "OCR failed",
      detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error)
    });
  }
});

app.use((_request, response) => {
  response.status(404).json({ ok: false, error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`ProjectProof OCR backend listening on ${PORT}`);
});

function getVisionClient() {
  if (visionClient) return visionClient;
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const credentials = JSON.parse(credentialsJson);
  visionClient = new vision.ImageAnnotatorClient({
    credentials,
    projectId: credentials.project_id
  });
  return visionClient;
}

function normalizeImagePayload(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(",");
  return trimmed.startsWith("data:") && commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

function parseReceiptText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const vendor = findVendor(lines);
  const date = findDate(lines);
  const total = findTotal(lines);
  const confidence = [vendor, date, total].filter(Boolean).length / 3;
  return {
    vendor,
    date,
    total,
    confidence,
    lines: lines.slice(0, 40)
  };
}

function findVendor(lines) {
  return lines.find((line) => {
    const lower = line.toLowerCase();
    return line.length >= 3
      && !lower.includes("receipt")
      && !lower.includes("invoice")
      && !lower.includes("total")
      && !/^\d/.test(line);
  }) || "";
}

function findDate(lines) {
  const datePatterns = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4}\b/i
  ];
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) return match[0];
    }
  }
  return "";
}

function findTotal(lines) {
  const totalLines = lines.filter((line) => /total|amount due|balance|sale/i.test(line));
  const candidates = [...totalLines, ...lines].flatMap((line) => {
    const matches = line.match(/(?:\$?\s*)\d{1,5}(?:,\d{3})*(?:\.\d{2})/g) || [];
    return matches.map((match) => Number(match.replace(/[$,\s]/g, ""))).filter((number) => Number.isFinite(number));
  });
  if (!candidates.length) return "";
  return String(Math.max(...candidates).toFixed(2));
}
