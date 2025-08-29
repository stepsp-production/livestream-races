// --- imports (keep these only once) ---
import express from "express";
import morgan from "morgan";
import compression from "compression";
import cors from "cors";
import https from "https";
import http from "http";
import path from "node:path";            // <— ONE path import
import { fileURLToPath } from "node:url"; // for __dirname in ESM

// --- constants ---
const ORIGIN_BASE = process.env.ORIGIN_BASE || "http://46.152.153.249";
const PORT = process.env.PORT || 10000;
const ALLOW_INSECURE_TLS = String(process.env.ALLOW_INSECURE_TLS || "true") === "true";

// --- ESM __dirname shim ---
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- app init & static files ---
const app = express();
app.use(express.static(path.join(__dirname, "public")));  // serve index.html, css, js, etc.
app.use(morgan("tiny"));
app.use(compression());
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (/\.(m3u8)$/i.test(req.path)) {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  } else if (/\.(ts|m4s)$/i.test(req.path)) {
    res.setHeader("Content-Type", "video/mp2t");
  }
  next();
});

// health page – optional
app.get("/", (req, res) => {
  res.type("text/plain").send("livestream-races is up. Try /player?src=/hls/live2/playlist.m3u8");
});

// ---- keep the rest of your proxy code exactly as you have it ----
// (insecureHttpsAgent, requestOnce, fetchWithRedirects, rewriteManifest,
//  the /hls/* route, and /player)
// ---------------------------------------------------------------

app.listen(PORT, () => {
  console.log("Server on", PORT, "→ origin:", ORIGIN_BASE, "insecureTLS:", ALLOW_INSECURE_TLS);
});
