#!/usr/bin/env node
/* Brand-config + copy drafting via Groq (free, fast hosted inference).
 * Turns intake/<store>/brief.txt into a draft store.json (brand voice, palette,
 * headline, tagline) — the step that would otherwise spend Claude tokens.
 *
 * Usage: GROQ_API_KEY=gsk_... node forge/copywriter.mjs <intake-dir>
 * Optional: GROQ_MODEL (default: a free Llama 3.3 70B).
 *
 * Writes store.json only if it does not already exist (never overwrites a
 * hand-tuned config). Review the draft before building — cheap models draft,
 * a human or stronger model approves.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intakeDir = path.resolve(process.argv[2] || path.join(ROOT, 'intake/demo'));
const briefPath = path.join(intakeDir, 'brief.txt');
const outPath = path.join(intakeDir, 'store.json');

if (!fs.existsSync(briefPath)) {
  console.error(`No brief.txt in ${intakeDir}`);
  process.exit(1);
}
if (fs.existsSync(outPath)) {
  console.log(`store.json already exists — not overwriting. Delete it to re-draft.`);
  process.exit(0);
}
const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error('GROQ_API_KEY not set. Either set it, or write store.json by hand (see intake/demo/store.json for the schema).');
  process.exit(1);
}
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const brief = fs.readFileSync(briefPath, 'utf8').trim();
const example = fs.readFileSync(path.join(ROOT, 'intake/demo/store.json'), 'utf8');

const prompt = `You are a brand copywriter and art director. From this one-line business brief, draft a storefront brand config.

BRIEF: ${brief}

Reply with STRICT JSON only, matching exactly this schema (an example from another store — do NOT copy its content, only its structure and field style):
${example}

Rules: palette must be tasteful and match the brief's vibe (bg near-white or near-black, accent saturated, text high-contrast on bg). headline max 8 words. tagline max 25 words. orderLink: keep the placeholder wa.me link if no contact given. fonts.googleFonts must be a valid Google Fonts css2 query for the two families you pick.`;

const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
});
if (!res.ok) {
  console.error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const data = await res.json();
const text = data.choices[0].message.content;
const draft = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
fs.writeFileSync(outPath, JSON.stringify(draft, null, 2));
console.log(`Draft store.json → ${outPath} (model: ${MODEL})`);
console.log('Review it before building — cheap models draft, you approve.');
