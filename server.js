// server.js
// Simple Express server + HLS proxy (Node 18+)

import express from "express";
import compression from "compression";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ====== CONFIG ======
const PORT = process.env.PORT || 10000;
// أصل سيرفر البث لديك (يمكن تغييره من متغيّر بيئة على Render)
const HLS_ORIGIN = (process.env.HLS_ORIGIN || "https://46.152.153.249").replace(/\/+$/, "");

// ====== MIDDLEWARE ======
app.use(compression());
app.use(morgan("dev"));
app.use(cors({ origin: "*"}));

// CSP مناسبة للصفحة والـ CDNs المستخدمة
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.dashjs.org https://www.youtube.com https://player.vimeo.com",
      "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.dashjs.org https://www.youtube.com https://player.vimeo.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "worker-src 'self' blob:",
      "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
      // البث سيخرج من نفس الدومين عبر /hls لذا نسمح لـ self
      "connect-src 'self' blob: data:",
      "media-src 'self' blob: data:",
    ].join("; ")
  );
  next();
});

// ملفات الواجهة (ضع index.html داخل public/)
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ====== HLS PROXY  ======
// أي طلب يبدأ بـ /hls/* نمرّره إلى سيرفر البث HLS_ORIGIN مع الحفاظ على المسار/الاستعلام.
app.get("/hls/*", async (req, res) => {
  try {
    const upstreamURL = new URL(req.originalUrl.replace(/^\/hls/, ""), HLS_ORIGIN).toString();

    // استخدم fetch المدمج في Node 18 (بستريم)
    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const upstreamRes = await fetch(upstreamURL, {
      // تمرير الـ UA يفيد بعض السيرفرات
      headers: {
        "user-agent": req.headers["user-agent"] || "Render-HLS-Proxy",
        "accept": req.headers["accept"] || "*/*",
        "referer": HLS_ORIGIN,
        "origin": req.headers["origin"] || "",
      },
      signal: controller.signal,
    });

    // حالة الرد
    res.status(upstreamRes.status);

    // نوع المحتوى (إن لم يرجع السيرفر نوعًا صحيحًا نحاول التخمين حسب الامتداد)
    const guessed = guessContentType(upstreamURL) || upstreamRes.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", guessed);

    // CORS + Cache
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    // تمرير البودي ستريم مباشرة
    if (upstreamRes.body) {
      upstreamRes.body.pipeTo(
        new WritableStream({
          write(chunk) { res.write(chunk); },
          close() { res.end(); },
          abort() { try { res.end(); } catch (_) {} },
        })
      ).catch(() => {
        try { res.end(); } catch (_) {}
      });
    } else {
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) res.status(502).send("Upstream error");
  }
});

// تخمين نوع المحتوى لبعض الامتدادات الشائعة
function guessContentType(url) {
  const u = url.split("?")[0].toLowerCase();
  if (u.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (u.endsWith(".mpd"))  return "application/dash+xml";
  if (u.endsWith(".ts"))   return "video/mp2t";
  if (u.endsWith(".m4s"))  return "video/iso.segment";
  if (u.endsWith(".mp4"))  return "video/mp4";
  if (u.endsWith(".aac"))  return "audio/aac";
  if (u.endsWith(".vtt"))  return "text/vtt";
  return "";
}

app.listen(PORT, () => {
  console.log("/////////////////////////////////////////////////////");
  console.log(`Server running on port ${PORT}`);
  console.log(`HLS origin: ${HLS_ORIGIN}`);
  console.log("/////////////////////////////////////////////////////");
});
