# StorefrontForge — Operator Playbook

Photos + one sentence in → live branded store with 360° product viewers + a scored launch-ad kit out.
Free stack: static site on GitHub Pages, Playwright-rendered ads, OpenRouter for cheap-model steps.

## Pipeline (per store)

```
intake/<store>/
  brief.txt                    # the client's one sentence
  store.json                   # brand config + copy (drafted, then human-approved)
  products/<slug>/
    product.json               # name, price, description, highlights, adLine?
    spin/frame_00.png ...      # 360° turntable frames (8–36, evenly spaced)
    photo.png                  # fallback still if no spin frames
```

1. **Intake.** Client sends product photos + one sentence. For 360° spins, ask for a
   short turntable video per product (put product on a lazy susan, phone on a tripod,
   one slow rotation) — extract frames with:
   `ffmpeg -i turntable.mp4 -vf "fps=<count/duration>" frame_%02d.png`
   Background removal (optional, recommended): `rembg` (open source, CPU) on each frame.
2. **Draft brand + copy.** `OPENROUTER_API_KEY=... node forge/copywriter.mjs intake/<store>`
   drafts `store.json` from `brief.txt` with a cheap model. **Review before building** —
   cheap models draft, a human (or stronger model) approves. Write `product.json` per product.
3. **Build.** `node forge/build.mjs intake/<store> dist` — full static site in `dist/`.
4. **QA.** `node forge/preview.mjs` — serves `dist/` and screenshots home + product page to `qa/`.
5. **Ads.** `node forge/render-ads.mjs intake/<store> launch-kit` — 4 creatives per product
   (clean/bold × square/story), rendered from the store's real product imagery. $0.
6. **Score.** `OPENROUTER_API_KEY=... node forge/score.mjs launch-kit` — cheap vision model
   scores each creative on hook/clarity/thumbnail/brand; `scores.json` ranks them and names
   top picks. Falls back to a heuristic without a key.
7. **Deploy.** Push to a branch listed in `.github/workflows/pages.yml`; GitHub Pages builds
   and publishes automatically. One-time setup: repo Settings → Pages → Source = "GitHub Actions".
8. **Deliver.** Send client: live URL + top-3 creatives + spin viewer link. Order flow is the
   `orderLink` in `store.json` (WhatsApp / form / email) — no checkout liability in v1.

## Demo assets

`forge/make-demo-frames.mjs` renders synthetic turntable frames (Three.js, headless Chromium)
for the demo store in `intake/demo`. Real stores use real photos; this file exists only so the
whole pipeline can be exercised without a client.

## Cost + routing model

- Hosting: GitHub Pages — $0.
- Media: Playwright renders + client photos — $0.
- Cheap-model steps (OpenRouter): copy drafting + ad scoring — fractions of a cent per store.
  Set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) in the environment.
- Claude: pipeline engineering, judgment calls, fixes. Routine per-store production should not
  need Claude at all once the template fits the vertical.

## Environment notes (Claude Code sandbox)

- Chromium: launch with `executablePath: '/opt/pw-browsers/chromium'` (or `CHROMIUM_PATH`).
- CDNs are blocked for browser traffic; `make-demo-frames.mjs` serves three.js from
  `node_modules` via request interception.

## v2 backlog (post-revenue)

- Real 3D meshes via Replicate (Hunyuan3D / TripoSR) + `<model-viewer>` embeds (~$0.05–0.30/SKU).
- Launch video via ffmpeg from spin frames.
- Analytics loop: page metrics → weekly refresh of copy/creatives (scheduled run).
- Custom domains per client; payment links (Stripe Payment Links = no checkout code).
