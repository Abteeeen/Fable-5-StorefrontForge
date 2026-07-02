#!/usr/bin/env node
/* E2E test of the operator console: unlock → intake → forge → preview.
 * Usage: node forge/test-console.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(ROOT, 'dist');
const outDir = path.join(ROOT, 'qa-console');
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = path.join(distDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`${base}/console/`, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, '1-gate.png') });

// unlock
await page.fill('#pass', 'forge-ops-26');
await page.click('#unlock');
await page.waitForSelector('#gate', { state: 'detached' });
console.log('unlocked ✓');

// intake
await page.fill('#bizname', 'Bloom & Bark');
await page.fill('#brief', 'Hand-poured soy candles and dried-flower arrangements from a tiny Kochi studio; soft, botanical, calming; orders via WhatsApp.');
await page.fill('#wa', '+91 90000 00000');
await page.fill('.p-name', 'Meadow Candle');
await page.fill('.p-price', '₹499');

// upload the vase spin frames as this product's photos
const spinDir = path.join(ROOT, 'intake/demo/products/ridge-vase/spin');
const frames = fs.readdirSync(spinDir).map((f) => path.join(spinDir, f));
await page.setInputFiles('.product-block input[type=file]', frames);
await page.waitForTimeout(400);
console.log('intake filled ✓ (24 photos → spin mode)');

// forge
await page.click('#forge');
await page.waitForSelector('#preview[style*="block"]', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, '2-console-run.png'), fullPage: true });
console.log('forge run complete ✓');

// verify the preview store rendered
const frameEl = await page.$('#preview');
const inner = await frameEl.contentFrame();
const h1 = await inner.textContent('h1');
const hasCanvas = await inner.$('.viewer.spin canvas') !== null;
console.log(`preview headline: "${h1.trim()}" · spin canvas: ${hasCanvas ? '✓' : 'MISSING'}`);

await browser.close();
server.close();
console.log(`screenshots → ${outDir}`);
