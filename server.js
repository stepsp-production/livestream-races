// server.js (ESM)

import express from "express";
import morgan from "morgan";
import compression from "compression";
import cors from "cors";
import https from "https";
import http from "http";
import path from "path";
import { URL, fileURLToPath } from "url";

// ===== resolve __dirname in ESM =====
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ===== config =====
const ORIGIN_BASE = process.env.ORIGIN_BASE || "http://46.152.153.249";
const PORT        = process.env.PORT || 10000;
const ALLOW_INSECURE_TLS = String(process.env.ALLOW_INSECURE_TLS || "true") === "true";

const app = express();

// ===== middlewares =====
app.use(morgan("tiny"));
app.use(compression());
app.use(cors());

// ✅ قدّم ملفات الواجهة من مجلد public/
app.use(express.static(path.join(__dirname, "public")));

// رؤوس مفيدة للملفات الميديا/HLS
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

// لو تزور الجذر وكان عندك public/index.html سيتخدّم تلقائيًا من السطر أعلاه.
// (اختياري) إجبار الجذر على index.html:
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== HLS proxy (مع دعم إعادة التوجيه وTLS غير موثوق لو لزم) =====
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: !ALLOW_INSECURE_TLS });

function requestOnce(urlStr, headers) {
  const u = new URL(urlStr);
  const client = u.protocol === "https:" ? https : http;
  const opts = { method: "GET", headers, agent: u.protocol === "https:" ? insecureHttpsAgent : undefined };
  return new Promise((resolve, reject) => {
    const req = client.request(urlStr, opts, up => resolve(up));
    req.on("error", reject);
    req.end();
  });
}

async function fetchWithRedirects(urlStr, headers, maxRedirects = 5) {
  let current = urlStr;
  for (let i = 0; i <= maxRedirects; i++) {
    const up = await requestOnce(current, headers);
    const sc = up.statusCode || 0;
    if (sc >= 300 && sc < 400 && up.headers.location) {
      const loc = up.headers.location;
      up.resume();
      current = new URL(loc, current).toString();
      continue;
    }
    return { up, finalUrl: current };
  }
  throw new Error("Too many redirects");
}

function rewriteManifest(text, basePath) {
  return text.split("\n").map(line => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    if (/^https?:\/\//i.test(t)) {
      try {
        const url = new URL(t);
        return `${basePath}${url.pathname}${url.search || ""}`;
      } catch { return line; }
    }
    const parent = basePath.replace(/\/[^/]*$/, "/");
    return parent + t;
  }).join("\n");
}

app.get("/hls/*", async (req, res) => {
  try {
    const upstreamUrl = ORIGIN_BASE + req.originalUrl;
    const headers = {
      ...req.headers,
      host: new URL(ORIGIN_BASE).host,
      ...(req.headers.range ? { Range: req.headers.range } : {})
    };

    const { up } = await fetchWithRedirects(upstreamUrl, headers);

    if (up.headers["content-type"])  res.set("Content-Type",   up.headers["content-type"]);
    if (up.headers["content-length"])res.set("Content-Length", up.headers["content-length"]);
    if (up.headers["accept-ranges"]) res.set("Accept-Ranges",  up.headers["accept-ranges"]);
    if (up.headers["content-range"]) res.set("Content-Range",  up.headers["content-range"]);

    if ((up.statusCode || 0) >= 400) { res.status(up.statusCode).end(); up.resume(); return; }

    if (/\.m3u8(\?.*)?$/i.test(req.path)) {
      let data = "";
      up.setEncoding("utf8");
      up.on("data", c => (data += c));
      up.on("end", () => res.type("application/vnd.apple.mpegurl").send(rewriteManifest(data, req.originalUrl)));
      up.on("error", () => res.status(502).send("Upstream error"));
      return;
    }

    res.status(up.statusCode || 200);
    up.pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).send("Proxy error");
  }
});

// صفحة اختبار بسيطة: /player?src=/hls/live2/playlist.m3u8
app.get("/player", (req, res) => {
  const src = req.query.src || "/hls/live/playlist.m3u8";
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>HLS Player</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<style>body{margin:0;background:#000}video{width:100vw;height:100vh;object-fit:contain}</style>
</head><body>
<video id="v" controls muted playsinline></video>
<script>
const src=${JSON.stringify(src)};
const v=document.getElementById('v');
if (window.Hls && Hls.isSupported()) {
  const h=new Hls();
  h.on(Hls.Events.ERROR,(e,d)=>console.log('HLS error',d));
  h.loadSource(src);
  h.attachMedia(v);
} else {
  v.src=src;
}
</script>
</body></html>`);
});

app.listen(PORT, () => {
  console.log("Server on", PORT, "→ origin:", ORIGIN_BASE, "insecureTLS:", ALLOW_INSECURE_TLS);
});
