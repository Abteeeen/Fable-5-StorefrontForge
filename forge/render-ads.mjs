#!/usr/bin/env node
/* Launch-ad renderer: designs ad creatives as HTML/CSS and screenshots them
 * at exact ad dimensions. Zero-cost replacement for image-gen APIs, using the
 * store's real product imagery.
 * Usage: node forge/render-ads.mjs <intake-dir> [out-dir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intakeDir = path.resolve(process.argv[2] || path.join(ROOT, 'intake/demo'));
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'launch-kit'));
fs.mkdirSync(outDir, { recursive: true });

const store = JSON.parse(fs.readFileSync(path.join(intakeDir, 'store.json'), 'utf8'));
const productsDir = path.join(intakeDir, 'products');
const products = fs.readdirSync(productsDir)
  .filter((d) => fs.existsSync(path.join(productsDir, d, 'product.json')))
  .map((slug) => {
    const p = JSON.parse(fs.readFileSync(path.join(productsDir, slug, 'product.json'), 'utf8'));
    const spinDir = path.join(productsDir, slug, 'spin');
    const frames = fs.existsSync(spinDir) ? fs.readdirSync(spinDir).sort() : [];
    // a 3/4 angle frame usually looks better in ads than the head-on first frame
    const hero = frames[Math.floor(frames.length / 8)] || frames[0];
    return { slug, heroImg: hero ? path.join(spinDir, hero) : null, ...p };
  })
  .filter((p) => p.heroImg);

const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const pal = store.palette;

const FORMATS = [
  { name: 'square', w: 1080, h: 1080 },
  { name: 'story', w: 1080, h: 1920 },
];

function adHtml(p, fmt, variant) {
  const img = b64(p.heroImg);
  const isStory = fmt.name === 'story';
  const base = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:${fmt.w}px; height:${fmt.h}px; overflow:hidden;
      font-family:'Inter',system-ui,sans-serif; }
    .display { font-family:'Fraunces',Georgia,serif; }
  </style>`;

  if (variant === 'clean') {
    return `${base}
    <body style="background:${pal.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${isStory ? 60 : 30}px;padding:80px;text-align:center">
      <div style="font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:30px;color:${pal.accent}">${store.name}</div>
      <img src="${img}" style="width:${isStory ? 82 : 56}%;filter:drop-shadow(0 40px 60px rgba(0,0,0,.22))">
      <div class="display" style="font-size:${isStory ? 92 : 72}px;line-height:1.08;letter-spacing:-0.02em;color:${pal.text};font-weight:700">${p.name}</div>
      <div style="font-size:34px;color:${pal.text};opacity:.7;max-width:80%">${p.adLine || p.description.split('.')[0] + '.'}</div>
      <div style="background:${pal.accent};color:${pal.accentContrast};font-weight:700;font-size:34px;padding:22px 64px;border-radius:999px">${p.price} · ${store.orderCta || 'Order now'}</div>
    </body>`;
  }
  // 'bold' variant: full-bleed accent background
  return `${base}
  <body style="background:linear-gradient(160deg,${pal.accent},color-mix(in srgb,${pal.accent} 60%,#20140e));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${isStory ? 56 : 26}px;padding:80px;text-align:center">
    <div class="display" style="font-size:${isStory ? 110 : 84}px;line-height:1.05;letter-spacing:-0.02em;color:${pal.accentContrast};font-weight:700;max-width:92%">${store.adHeadline || store.headline}</div>
    <img src="${img}" style="width:${isStory ? 80 : 52}%;filter:drop-shadow(0 40px 70px rgba(0,0,0,.35))">
    <div style="font-size:36px;color:${pal.accentContrast};opacity:.85">${p.name} — ${p.price}</div>
    <div style="background:${pal.accentContrast};color:${pal.accent};font-weight:700;font-size:34px;padding:22px 64px;border-radius:999px">${store.orderCta || 'Order now'}</div>
    <div style="font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:26px;color:${pal.accentContrast};opacity:.7">${store.name}</div>
  </body>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const manifest = [];
for (const p of products) {
  for (const fmt of FORMATS) {
    for (const variant of ['clean', 'bold']) {
      const page = await browser.newPage({ viewport: { width: fmt.w, height: fmt.h } });
      await page.setContent(adHtml(p, fmt, variant), { waitUntil: 'networkidle' });
      const file = `${p.slug}_${variant}_${fmt.name}.png`;
      await page.screenshot({ path: path.join(outDir, file) });
      await page.close();
      manifest.push({ file, product: p.name, variant, format: `${fmt.w}x${fmt.h}` });
      console.log(`ad: ${file}`);
    }
  }
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
console.log(`${manifest.length} creatives → ${outDir}`);
