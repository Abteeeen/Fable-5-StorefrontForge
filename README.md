# StorefrontForge

Product photos + one sentence in → **live branded store with 360° product viewers + a scored
launch-ad kit** out. Built on a zero-cost stack: static site (GitHub Pages), 360° spin viewer
(vanilla JS), ad creatives rendered as HTML→PNG (Playwright), free-model copy drafting and
ad scoring (Groq).

See **[forge.md](forge.md)** for the operator playbook.

## Quick start

```bash
npm install
node forge/make-demo-frames.mjs        # synthetic demo turntable frames
node forge/build.mjs intake/demo dist  # build the demo store
node forge/preview.mjs                 # QA screenshots → qa/
node forge/render-ads.mjs              # launch-ad creatives → launch-kit/
node forge/score.mjs                   # rank creatives (Groq or fallback)
```

## Layout

| Path | What |
|---|---|
| `template/assets/` | Store CSS + 360° spin viewer |
| `forge/build.mjs` | Intake → static site generator (zero deps) |
| `forge/render-ads.mjs` | HTML→PNG ad creative renderer |
| `forge/score.mjs` | Creative scoring via Groq vision model |
| `forge/copywriter.mjs` | Brief → brand config draft via Groq |
| `forge/preview.mjs` | Visual QA screenshots |
| `forge/make-demo-frames.mjs` | Synthetic demo spin frames (Three.js headless) |
| `intake/demo/` | Example store: Aurora Ceramics (3 products) |
| `.github/workflows/pages.yml` | Auto-deploy to GitHub Pages |
