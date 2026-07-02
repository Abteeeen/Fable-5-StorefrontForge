#!/usr/bin/env node
/* Assembles site/console/index.html from forge/console-template.html.
 *
 * The template authors the console UI/logic normally, but the store it forges
 * needs GSAP + ScrollTrigger baked in as plain, visible <script> tags — so a
 * downloaded store HTML file works fully offline, with nothing that looks like
 * an obfuscated payload (no eval/atob/base64) when a client opens it or a mail
 * scanner inspects it. This script splices the real vendored library source
 * into the two placeholders inside storeHtml()'s template literal.
 *
 * Run this after editing forge/console-template.html or after updating the
 * vendored GSAP files in template/assets/vendor/.
 *
 * Usage: node forge/build-console.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(ROOT, 'forge/console-template.html');
const outPath = path.join(ROOT, 'site/console/index.html');

const gsapSrc = fs.readFileSync(path.join(ROOT, 'template/assets/vendor/gsap.min.js'), 'utf8');
const scrollTriggerSrc = fs.readFileSync(path.join(ROOT, 'template/assets/vendor/ScrollTrigger.min.js'), 'utf8');

for (const src of [gsapSrc, scrollTriggerSrc]) {
  if (/<\/script|<!--|<script/i.test(src)) {
    throw new Error('vendored library source contains a raw-text-terminating sequence (</script, <!--, <script) — unsafe to splice. Check template/assets/vendor/.');
  }
}

let html = fs.readFileSync(templatePath, 'utf8');
const before = html.length;
html = html.replace('__GSAP_SOURCE__', () => gsapSrc).replace('__SCROLLTRIGGER_SOURCE__', () => scrollTriggerSrc);
if (html.length === before) throw new Error('placeholders not found in console-template.html — did the template change?');

fs.writeFileSync(outPath, html);
console.log(`Built ${outPath} (${(html.length / 1024).toFixed(0)} KB, GSAP + ScrollTrigger inlined)`);
