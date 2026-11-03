'use strict';

/**
 * 零依赖本地开发服务器（用于在未登录 Vercel 时本地调试）。
 * 用法：node dev-server.js  → 访问 http://localhost:3000
 * 需要 SUB 环境变量：PowerShell 中先执行 $env:SUB='你的SUB值' 再启动。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/generate.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// 给原生 res 补充 Vercel 风格的 status() / json() 方法
function wrapRes(res) {
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (obj) {
    const s = JSON.stringify(obj);
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(s);
    return this;
  };
  return res;
}

http.createServer(async (req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  if (urlPath.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    let parsed = {};
    const ct = req.headers['content-type'] || '';
    try {
      if (ct.includes('application/json')) parsed = JSON.parse(raw);
      else if (ct.includes('application/x-www-form-urlencoded')) parsed = Object.fromEntries(new URLSearchParams(raw));
    } catch {
      parsed = {};
    }
    req.body = parsed;
    return handler(req, wrapRes(res));
  }

  const file = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const full = path.resolve(ROOT, file);
  if (!full.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('forbidden');
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('本地服务已启动：http://localhost:' + PORT);
});
