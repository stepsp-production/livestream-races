import express from "express";
import morgan from "morgan";
import compression from "compression";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { URL } from "url";

// --- resolve __dirname (ESM) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.resolve(process.cwd()); // safe on Render

// origin is your camera server (HTTP preferred because the cert is bad)
const ORIGIN_BASE = process.env.ORIGIN_BASE || "http://46.152.153.249";
const PORT = process.env.PORT || 10000;
const ALLOW_INSECURE_TLS = String(process.env.ALLOW_INSECURE_TLS || "true") === "true";

const app = express();
app.use(morgan("tiny"));
app.use(compression());
app.use(cors());

// serve frontend from /public
app.use(express.static(path.join(__dirname, "public")));

// … (keep the rest of the proxy code you already have: headers, redirects,
// rewriteManifest, app.get("/hls/*") proxy route, app.get("/player") test page, etc.)

app.listen(PORT, () => {
  console.log("Server on", PORT, "→ origin:", ORIGIN_BASE, "insecureTLS:", ALLOW_INSECURE_TLS);
});
