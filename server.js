// server.js
const express = require('express');
const path = require('path');
const app = express();

// ضع الـ CSP كرأس HTTP (يَغلِب على <meta> إن وُجد)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.dashjs.org https://www.youtube.com https://player.vimeo.com",
  "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.dashjs.org https://www.youtube.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "connect-src 'self' https://hls-proxy-iphq.onrender.com https://livestream-races.onrender.com blob: data:",
  "media-src 'self' https://hls-proxy-iphq.onrender.com https://livestream-races.onrender.com blob: data:",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-src 'self' https://www.youtube.com https://player.vimeo.com"
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

// ملفات الستاتيك من مجلد public/
app.use(express.static(path.join(__dirname, 'public')));

// index.html رئيسي
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
