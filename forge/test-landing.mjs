#!/usr/bin/env node
/* Landing-page QA: loads site/index.html in headless Chromium at desktop and
 * mobile viewports, captures console errors, verifies the WebGL hero renders,
 * exercises the scroll animations, and checks for horizontal overflow.
 * Screenshots → qa/landing-*.png
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const QA = path.join(ROOT, 'qa');
fs.mkdirSync(QA, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

async function audit(name, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  // fonts.googleapis.com is blocked in the sandbox (async-loaded, page degrades fine)
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('fonts.googleapis')) errors.push(`${m.location().url} ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800); // let intro timeline finish

  const checks = await page.evaluate(() => {
    const gl = document.getElementById('webgl');
    let webglDrawn = false;
    try {
      const ctx = gl.getContext('webgl2') || gl.getContext('webgl');
      webglDrawn = !!ctx && gl.width > 0;
    } catch {}
    const h1 = document.querySelector('#hero-h .line > span');
    const h1Visible = h1 && getComputedStyle(h1).transform !== 'matrix(1, 0, 0, 1, 0, 110)' && h1.getBoundingClientRect().height > 0;
    const loaderGone = document.getElementById('loader').classList.contains('done');
    const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return { webglDrawn, h1Visible, loaderGone, overflowX, gsapOn: document.documentElement.classList.contains('gsap-on') };
  });

  await page.screenshot({ path: path.join(QA, `landing-${name}-hero.png`) });

  // scroll through to fire every ScrollTrigger, then check reveals landed
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await page.waitForTimeout(1200);
  const reveals = await page.evaluate(() => {
    const rvs = [...document.querySelectorAll('.rv')];
    const hidden = rvs.filter((el) => +getComputedStyle(el).opacity < 0.9);
    return { total: rvs.length, stillHidden: hidden.length, statVal: document.querySelector('.demo-stats .val')?.textContent };
  });
  await page.evaluate(() => document.querySelector('#request').scrollIntoView());
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(QA, `landing-${name}-cta.png`) });
  await page.evaluate(() => document.querySelector('#demo').scrollIntoView());
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(QA, `landing-${name}-demo.png`) });

  await page.close();
  return { name, viewport, ...checks, ...reveals, errors };
}

const desktop = await audit('desktop', { width: 1440, height: 900 });
const mobile = await audit('mobile', { width: 390, height: 844 });

for (const r of [desktop, mobile]) {
  console.log(`\n=== ${r.name} (${r.viewport.width}x${r.viewport.height}) ===`);
  console.log(`gsap active: ${r.gsapOn} | loader dismissed: ${r.loaderGone} | h1 visible: ${r.h1Visible}`);
  console.log(`webgl context: ${r.webglDrawn} | horizontal overflow: ${r.overflowX}px`);
  console.log(`reveals: ${r.total - r.stillHidden}/${r.total} visible after scroll | stat counter: ${r.statVal}`);
  console.log(`console errors: ${r.errors.length ? r.errors.join(' | ') : 'none'}`);
}

await browser.close();
server.close();
const ok = [desktop, mobile].every((r) => r.errors.length === 0 && r.loaderGone && r.h1Visible && r.stillHidden === 0 && r.overflowX === 0);
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
