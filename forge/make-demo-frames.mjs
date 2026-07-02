#!/usr/bin/env node
/* Renders demo 360° spin frames using Three.js in headless Chromium.
 * Stand-in for real turntable photos so the pipeline can be demoed end-to-end.
 * Usage: node forge/make-demo-frames.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRAME_COUNT = 24;
const SIZE = 800;

const PRODUCTS = [
  { slug: 'terra-mug', kind: 'mug', colors: { body: '#c96f4a', glaze: '#f2e8dc', handle: '#c96f4a' } },
  { slug: 'ridge-vase', kind: 'vase', colors: { body: '#8fa696', glaze: '#f0ece2' } },
  { slug: 'ember-bowl', kind: 'bowl', colors: { body: '#8a4b3c', glaze: '#f5efe4' } },
];

const pageHtml = `<!DOCTYPE html>
<html><head><style>body{margin:0;background:transparent}</style></head>
<body>
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE}, ${SIZE});
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const key = new THREE.DirectionalLight(0xfff4e6, 1.8);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe9ff, 0.7);
rim.position.set(-5, 3, -4);
scene.add(rim);

function lathe(points, mat) {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), 64), mat);
}
function mat(color, rough = 0.55) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, side: THREE.DoubleSide });
}

window.buildProduct = function (kind, colors) {
  const group = new THREE.Group();
  if (kind === 'mug') {
    const body = lathe([[0,0],[0.62,0],[0.68,0.06],[0.7,0.5],[0.68,1.0],[0.66,1.05],[0.6,1.05]], mat(colors.body));
    const inner = lathe([[0.6,1.05],[0.58,1.0],[0.56,0.2],[0,0.18]], mat(colors.glaze, 0.35));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.075, 24, 48, Math.PI * 1.5), mat(colors.handle));
    handle.position.set(0.72, 0.55, 0);
    handle.rotation.z = Math.PI / 4 + Math.PI;
    group.add(body, inner, handle);
    group.position.y = -0.5;
  } else if (kind === 'vase') {
    // smooth belly profile via sine curve, flaring neck
    const pts = [[0, 0], [0.42, 0]];
    for (let t = 0; t <= 1; t += 0.05) {
      const y = 0.03 + t * 1.05;
      const r = 0.34 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.3;
      pts.push([r, y]);
    }
    pts.push([0.3, 1.18], [0.34, 1.38], [0.4, 1.46], [0.37, 1.47], [0.31, 1.38], [0.27, 1.16], [0, 1.14]);
    const body = lathe(pts, mat(colors.body, 0.45));
    // carved ridge rings following the belly silhouette
    for (let i = 0; i < 6; i++) {
      const t = 0.18 + i * 0.115;
      const y = 0.03 + t * 1.05;
      const r = 0.34 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.3;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.008, 0.014, 12, 64), mat(colors.glaze, 0.5));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      group.add(ring);
    }
    group.add(body);
    group.position.y = -0.72;
  } else if (kind === 'bowl') {
    const body = lathe([[0,0],[0.5,0],[0.55,0.02],[0.95,0.42],[1.0,0.6],[0.97,0.6],[0.9,0.44],[0.52,0.1],[0,0.08]], mat(colors.body, 0.5));
    const glaze = lathe([[0,0.09],[0.5,0.11],[0.88,0.44],[0.95,0.59]], mat(colors.glaze, 0.3));
    group.add(body, glaze);
    group.position.y = -0.32;
  }
  scene.clear();
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  scene.add(key); scene.add(rim);
  scene.add(group);
  window._target = group;
};

window.renderFrame = function (angleDeg) {
  const a = angleDeg * Math.PI / 180;
  const r = 3.4, h = 1.1;
  camera.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
  camera.lookAt(0, 0.05, 0);
  renderer.render(scene, camera);
};
window.ready = true;
</script>
</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
// Serve three.js from node_modules — the sandbox proxy blocks CDN traffic.
await page.route('**/build/three*.js', (route) => {
  const file = route.request().url().split('/').pop();
  route.fulfill({
    body: fs.readFileSync(path.join(ROOT, 'node_modules/three/build', file), 'utf8'),
    contentType: 'application/javascript',
  });
});
await page.setContent(pageHtml, { waitUntil: 'networkidle' });
await page.waitForFunction('window.ready === true', { timeout: 30000 });

for (const product of PRODUCTS) {
  const outDir = path.join(ROOT, 'intake/demo/products', product.slug, 'spin');
  fs.mkdirSync(outDir, { recursive: true });
  await page.evaluate(([kind, colors]) => window.buildProduct(kind, colors), [product.kind, product.colors]);
  for (let i = 0; i < FRAME_COUNT; i++) {
    await page.evaluate((deg) => window.renderFrame(deg), (360 / FRAME_COUNT) * i);
    const canvas = page.locator('#c');
    await canvas.screenshot({
      path: path.join(outDir, `frame_${String(i).padStart(2, '0')}.png`),
      omitBackground: true,
    });
  }
  console.log(`${product.slug}: ${FRAME_COUNT} frames → ${outDir}`);
}

await browser.close();
