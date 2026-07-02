#!/usr/bin/env node
/* StorefrontForge site generator.
 * Usage: node forge/build.mjs <intake-dir> [out-dir]
 *
 * Intake layout:
 *   <intake-dir>/store.json            brand config + copy (see intake/demo)
 *   <intake-dir>/products/<slug>/product.json
 *   <intake-dir>/products/<slug>/spin/frame_00.png ... frame_NN.png
 *
 * Output: a fully static site in <out-dir> (default: dist/).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intakeDir = path.resolve(process.argv[2] || path.join(ROOT, 'intake/demo'));
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'dist'));

const store = JSON.parse(fs.readFileSync(path.join(intakeDir, 'store.json'), 'utf8'));
const productsDir = path.join(intakeDir, 'products');
const products = fs.readdirSync(productsDir)
  .filter((d) => fs.existsSync(path.join(productsDir, d, 'product.json')))
  .map((slug) => {
    const p = JSON.parse(fs.readFileSync(path.join(productsDir, slug, 'product.json'), 'utf8'));
    const spinDir = path.join(productsDir, slug, 'spin');
    const frames = fs.existsSync(spinDir)
      ? fs.readdirSync(spinDir).filter((f) => /^frame_\d+\.(png|jpg|webp)$/.test(f)).sort()
      : [];
    return { slug, frames, ...p };
  });

if (products.length === 0) {
  console.error(`No products found in ${productsDir}`);
  process.exit(1);
}

const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const brandVars = `
:root {
  --color-bg: ${store.palette.bg};
  --color-surface: ${store.palette.surface};
  --color-text: ${store.palette.text};
  --color-accent: ${store.palette.accent};
  --color-accent-contrast: ${store.palette.accentContrast || '#ffffff'};
  --font-display: ${store.fonts?.display || "'Inter', system-ui, sans-serif"};
  --font-body: ${store.fonts?.body || "'Inter', system-ui, sans-serif"};
}`;

const fontLink = store.fonts?.googleFonts
  ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?${store.fonts.googleFonts}&display=swap" rel="stylesheet">`
  : '';

const marqueeItems = products.length
  ? Array(6).fill(products.map((p) => esc(p.name)).join(' <i>&#10022;</i> ')).join(' <i>&#10022;</i> ')
  : '';

function page({ title, description, body, depth = 0 }) {
  const rel = depth === 0 ? '.' : Array(depth).fill('..').join('/');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${fontLink}
  <style>${brandVars}</style>
  <link rel="stylesheet" href="${rel}/assets/store.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a class="brand-mark" href="${rel}/index.html">${store.brandMarkHtml || esc(store.name)}</a>
      <nav class="nav">
        <a href="${rel}/index.html#products">Products</a>
        <a class="order-link" href="${esc(store.orderLink)}">Order</a>
      </nav>
    </div>
  </header>
  ${marqueeItems ? `<div class="marquee"><div class="track"><span>${marqueeItems}</span></div></div>` : ''}
  ${body}
  <footer class="site-footer">
    <div class="footer-word">${esc(store.name)}</div>
    <div class="container footer-note">© ${new Date().getFullYear()} ${esc(store.name)} · ${esc(store.footerNote || '')}</div>
  </footer>
  <script src="${rel}/assets/vendor/gsap.min.js"></script>
  <script src="${rel}/assets/vendor/ScrollTrigger.min.js"></script>
  <script src="${rel}/assets/spin-viewer.js"></script>
  <script src="${rel}/assets/site-motion.js"></script>
</body>
</html>`;
}

function productCard(p, i) {
  const thumb = p.frames.length
    ? `products/${p.slug}/spin/${p.frames[0]}`
    : `products/${p.slug}/photo.png`;
  return `
      <a class="product-card" data-reveal href="products/${p.slug}/index.html">
        <div class="thumb"><img src="${thumb}" alt="${esc(p.name)}" loading="lazy"></div>
        <div class="card-body">
          ${p.frames.length ? '<span class="spin-badge">360° view</span>' : ''}
          <h3>${esc(p.name)}</h3>
          <div class="price">${esc(p.price)}</div>
        </div>
      </a>`;
}

const indexBody = `
  <section class="hero">
    <div class="container">
      <div class="kicker">${esc(store.name)}</div>
      <h1>${esc(store.headline)}</h1>
      <p class="tagline">${esc(store.tagline)}</p>
      <a class="cta-button" href="#products">Browse the collection</a>
    </div>
  </section>
  <main class="container" id="products">
    <div class="section-head" data-reveal>
      <div class="eyebrow">The collection</div>
      <h2 class="section-title">${products.length} piece${products.length === 1 ? '' : 's'}, made to order</h2>
    </div>
    <div class="product-grid">${products.map(productCard).join('\n')}</div>
  </main>`;

function productBody(p, i) {
  const spin = p.frames.length
    ? `<div class="spin-viewer" data-frames="spin/frame_%d.png" data-count="${p.frames.length}" aria-label="360 degree view of ${esc(p.name)}"></div>`
    : `<div class="spin-viewer"><img src="photo.png" alt="${esc(p.name)}"></div>`;
  const highlights = (p.highlights || []).map((h) => `<li>${esc(h)}</li>`).join('\n');
  return `
  <main class="container">
    <div class="product-layout">
      <div data-reveal>${spin}</div>
      <div class="product-info" data-reveal>
        <div class="idx">${String(i + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}</div>
        <h1>${esc(p.name)}</h1>
        <div class="price">${esc(p.price)}</div>
        <p class="description">${esc(p.description)}</p>
        ${highlights ? `<ul class="highlights">${highlights}</ul>` : ''}
        <a class="cta-button" href="${esc(store.orderLink)}">${esc(store.orderCta || 'Order now')}</a>
        <a class="cta-button secondary" style="margin-left:12px" href="../../index.html">Back to shop</a>
      </div>
    </div>
  </main>`;
}

// --- write output ---
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'assets', 'vendor'), { recursive: true });
for (const f of ['store.css', 'spin-viewer.js', 'site-motion.js']) {
  fs.copyFileSync(path.join(ROOT, 'template/assets', f), path.join(outDir, 'assets', f));
}
for (const f of ['gsap.min.js', 'ScrollTrigger.min.js']) {
  fs.copyFileSync(path.join(ROOT, 'template/assets/vendor', f), path.join(outDir, 'assets/vendor', f));
}
fs.writeFileSync(path.join(outDir, 'index.html'), page({
  title: `${store.name} — ${store.tagline}`,
  description: store.tagline,
  body: indexBody,
  depth: 0,
}));
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

products.forEach((p, i) => {
  const pDir = path.join(outDir, 'products', p.slug);
  fs.mkdirSync(pDir, { recursive: true });
  fs.writeFileSync(path.join(pDir, 'index.html'), page({
    title: `${p.name} — ${store.name}`,
    description: p.description,
    body: productBody(p, i),
    depth: 2,
  }));
  const spinSrc = path.join(productsDir, p.slug, 'spin');
  if (p.frames.length) {
    fs.mkdirSync(path.join(pDir, 'spin'), { recursive: true });
    for (const f of p.frames) fs.copyFileSync(path.join(spinSrc, f), path.join(pDir, 'spin', f));
  }
  const photo = path.join(productsDir, p.slug, 'photo.png');
  if (fs.existsSync(photo)) fs.copyFileSync(photo, path.join(pDir, 'photo.png'));
});

console.log(`Built ${products.length} product(s) → ${outDir}`);
