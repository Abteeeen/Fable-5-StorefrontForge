#!/usr/bin/env node
/* Visual QA: serves the built site and screenshots key pages.
 * Usage: node forge/preview.mjs [dist-dir] [out-dir]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'qa'));
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = path.join(distDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const products = fs.existsSync(path.join(distDir, 'products'))
  ? fs.readdirSync(path.join(distDir, 'products'))
  : [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, 'home.png'), fullPage: true });
console.log(`shot: home.png`);

if (products[0]) {
  await page.goto(`${base}/products/${products[0]}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // let spin viewer draw
  await page.screenshot({ path: path.join(outDir, 'product.png'), fullPage: true });
  console.log(`shot: product.png (${products[0]})`);
}

await browser.close();
server.close();
