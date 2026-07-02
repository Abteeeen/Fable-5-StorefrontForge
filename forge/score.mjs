#!/usr/bin/env node
/* Ad-creative scoring via OpenRouter (cheap vision model).
 * Ranks the launch-kit creatives against a fixed rubric and writes scores.json.
 *
 * Usage: OPENROUTER_API_KEY=sk-or-... node forge/score.mjs [launch-kit-dir]
 * Optional: OPENROUTER_MODEL (default: a low-cost vision-capable model).
 *
 * Without an API key it falls back to a deterministic heuristic ranking so the
 * pipeline never blocks; the report marks which path was used.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kitDir = path.resolve(process.argv[2] || path.join(ROOT, 'launch-kit'));
const manifest = JSON.parse(fs.readFileSync(path.join(kitDir, 'manifest.json'), 'utf8'));

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

const RUBRIC = `You are a performance-marketing creative reviewer. Score this ad creative 0-10 on each criterion:
1. hook: does it stop the scroll? Is the first visual impression strong?
2. clarity: is the product, price, and action obvious within 2 seconds?
3. thumbnail: does it stay readable when small (feed thumbnail size)?
4. brand: does it feel like a coherent, premium brand?
Reply with STRICT JSON only: {"hook":n,"clarity":n,"thumbnail":n,"brand":n,"note":"one short improvement suggestion"}`;

async function scoreWithModel(file) {
  const img = fs.readFileSync(path.join(kitDir, file)).toString('base64');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: RUBRIC },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } },
        ],
      }],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices[0].message.content;
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const total = (json.hook + json.clarity + json.thumbnail + json.brand) / 4;
  return { ...json, total: Math.round(total * 10) / 10 };
}

function heuristicScore(entry) {
  // Deterministic fallback: prefers square (feed-first), 'clean' product-forward
  // layouts, and stable ordering. Replace with model scores once a key is set.
  let total = 6;
  if (entry.format.startsWith('1080x1080')) total += 0.5;
  if (entry.variant === 'clean') total += 0.5;
  return { hook: null, clarity: null, thumbnail: null, brand: null, total, note: 'heuristic fallback — set OPENROUTER_API_KEY for model scoring' };
}

const results = [];
for (const entry of manifest) {
  let score;
  if (API_KEY) {
    try {
      score = await scoreWithModel(entry.file);
    } catch (e) {
      console.error(`score failed for ${entry.file}: ${e.message}`);
      score = heuristicScore(entry);
    }
  } else {
    score = heuristicScore(entry);
  }
  results.push({ ...entry, ...score });
  console.log(`${entry.file}: ${score.total}`);
}

results.sort((a, b) => b.total - a.total);
const report = {
  scoredAt: new Date().toISOString(),
  method: API_KEY ? `openrouter:${MODEL}` : 'heuristic-fallback',
  topPicks: results.slice(0, 3).map((r) => r.file),
  results,
};
fs.writeFileSync(path.join(kitDir, 'scores.json'), JSON.stringify(report, null, 2));
console.log(`\nTop picks: ${report.topPicks.join(', ')}`);
console.log(`Report → ${path.join(kitDir, 'scores.json')} (method: ${report.method})`);
