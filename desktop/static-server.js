// Máy chủ tĩnh tối giản phục vụ thư mục web/ (chế độ ngoại tuyến, khi không có Python).
// Dùng cho ứng dụng Electron: mọi tính năng vẽ/nắn nét/công thức/OCR/bản quyền chạy
// hoàn toàn trong trình duyệt nhúng; chỉ các API AI máy chủ (/api/*) là không có.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.traineddata': 'application/octet-stream', '.map': 'application/json'
};

function startStaticServer(webDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        // API không có trong chế độ ngoại tuyến -> báo 503 để frontend tự chuyển sang offline
        if (urlPath.startsWith('/api/')) {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, offline: true, error: 'Chế độ ngoại tuyến (không có máy chủ AI).' }));
          return;
        }
        const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        const file = path.join(webDir, safe);
        if (!file.startsWith(webDir)) { res.writeHead(403); res.end('Forbidden'); return; }
        fs.readFile(file, (err, data) => {
          if (err) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) { res.writeHead(500); res.end('Error'); }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startStaticServer };
