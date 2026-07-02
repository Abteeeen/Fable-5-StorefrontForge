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

// verify GSAP animation actually ran inside the live preview iframe
await inner.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(900);
const previewMotion = await inner.evaluate(() => ({
  motionOn: document.documentElement.classList.contains('motion-on'),
  revealsVisible: [...document.querySelectorAll('[data-reveal]')].every((el) => +getComputedStyle(el).opacity > 0.9),
}));
console.log(`preview motion: gsap active=${previewMotion.motionOn}, reveals visible after scroll=${previewMotion.revealsVisible}`);

// download the forged store to disk
const downloadPromise = page.waitForEvent('download');
await page.click('#download');
const download = await downloadPromise;
const downloadedPath = path.join(outDir, 'my-forged-store.html');
await download.saveAs(downloadedPath);
const sizeKB = (fs.statSync(downloadedPath).size / 1024).toFixed(0);
console.log(`downloaded ✓ (${sizeKB} KB) → ${downloadedPath}`);

await browser.close();
server.close();

// ---- open the DOWNLOADED file standalone, offline, in a fresh browser with
//      networking blocked entirely — this is what a client actually receives.
const offlineBrowser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const offlineCtx = await offlineBrowser.newContext({ viewport: { width: 1360, height: 950 } });
await offlineCtx.route('**/*', (route) => {
  if (route.request().url().startsWith('file://')) return route.continue();
  console.log('BLOCKED NETWORK REQUEST (should never happen offline):', route.request().url());
  route.abort();
});
const offlinePage = await offlineCtx.newPage();
// fonts.googleapis.com is expected to fail with no network — the page is
// designed to degrade gracefully to system fonts (media="print" onload trick).
const offlineErrors = [];
offlinePage.on('pageerror', (e) => offlineErrors.push(String(e)));
offlinePage.on('console', (m) => {
  if (m.type() !== 'error') return;
  if ((m.location().url || '').includes('fonts.googleapis')) return;
  offlineErrors.push(m.text());
});

await offlinePage.goto(`file://${downloadedPath}`, { waitUntil: 'load' });
await offlinePage.waitForTimeout(1500);
const offlineState = await offlinePage.evaluate(() => ({
  title: document.title,
  hasGsap: typeof window.gsap !== 'undefined',
  hasScrollTrigger: typeof window.ScrollTrigger !== 'undefined',
  motionOn: document.documentElement.classList.contains('motion-on'),
  hasSpinCanvas: !!document.querySelector('.viewer.spin canvas'),
}));
console.log(`OFFLINE FILE :// TEST — title:"${offlineState.title}" gsap:${offlineState.hasGsap} scrollTrigger:${offlineState.hasScrollTrigger} motion-on:${offlineState.motionOn} spin-canvas:${offlineState.hasSpinCanvas}`);
await offlinePage.screenshot({ path: path.join(outDir, '3-offline-file-hero.png') });

await offlinePage.evaluate(() => document.querySelector('main section:last-of-type')?.scrollIntoView());
await offlinePage.waitForTimeout(900);
const offlineReveals = await offlinePage.evaluate(() =>
  [...document.querySelectorAll('[data-reveal]')].every((el) => +getComputedStyle(el).opacity > 0.9));
console.log(`offline reveals visible after scroll: ${offlineReveals}`);
await offlinePage.screenshot({ path: path.join(outDir, '4-offline-file-scrolled.png') });

console.log(`offline console/page errors: ${offlineErrors.length ? offlineErrors.join(' | ') : 'none'}`);
await offlineBrowser.close();

console.log(`screenshots → ${outDir}`);

const ok = hasCanvas && previewMotion.motionOn && previewMotion.revealsVisible
  && offlineState.hasGsap && offlineState.hasScrollTrigger && offlineState.motionOn && offlineState.hasSpinCanvas
  && offlineReveals && offlineErrors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
