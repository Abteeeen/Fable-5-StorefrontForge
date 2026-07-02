# StorefrontForge — Operator Playbook

Photos + one sentence in → live branded store with 360° product viewers + a scored launch-ad kit out.
Free stack: static site on GitHub Pages, Playwright-rendered ads, Groq for free-model steps.

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
2. **Draft brand + copy.** `GROQ_API_KEY=... node forge/copywriter.mjs intake/<store>`
   drafts `store.json` from `brief.txt` with a cheap model. **Review before building** —
   cheap models draft, a human (or stronger model) approves. Write `product.json` per product.
3. **Build.** `node forge/build.mjs intake/<store> dist` — full static site in `dist/`.
   Premium editorial template (`template/assets/store.css`) with GSAP scroll motion
   (`template/assets/site-motion.js`, vendored `template/assets/vendor/`) — no CDN dependency.
4. **QA.** `node forge/preview.mjs` — serves `dist/` and screenshots home + product page to `qa/`.
5. **Ads.** `node forge/render-ads.mjs intake/<store> launch-kit` — 4 creatives per product
   (clean/bold × square/story), rendered from the store's real product imagery. $0.
6. **Score.** `GROQ_API_KEY=... node forge/score.mjs launch-kit` — free vision model
   scores each creative on hook/clarity/thumbnail/brand; `scores.json` ranks them and names
   top picks. Falls back to a heuristic without a key.
7. **Deploy.** Push to a branch listed in `.github/workflows/pages.yml`; GitHub Pages builds
   and publishes automatically. One-time setup: repo Settings → Pages → Source = "GitHub Actions".
8. **Deliver.** Send client: live URL + top-3 creatives + spin viewer link. Order flow is the
   `orderLink` in `store.json` (WhatsApp / form / email) — no checkout liability in v1.

## Main frontend (the business's own site)

`site/` is the public StorefrontForge landing page — WebGL particle hero (three.js),
GSAP scroll choreography, offer, live demo (served at `/demo/`), ad-kit samples, and the
client CTA section. GSAP + three.js are vendored in `site/assets/vendor/` (CDNs are
blocked in the sandbox, and vendoring keeps Pages self-contained). The Pages workflow
assembles `dist/ = site/ + demo build at /demo/` on every push.

- QA: `node forge/test-landing.mjs` — desktop + mobile viewports, console errors, WebGL,
  scroll reveals, horizontal-overflow check; screenshots → `qa/landing-*.png`.
- Motion degrades gracefully: `prefers-reduced-motion` disables WebGL + animations, and
  if scripts fail to load the page renders fully static (reveal classes only hide content
  once GSAP is confirmed running).

### Intake form fields (create as a Google Form, then embed)

1. Business name — short answer, required
2. Your one sentence — paragraph, required. Helper text: "What do you sell, what's the vibe,
   how do you take orders? Example: 'Small-batch handmade stoneware from a home studio; warm,
   earthy, modern; sells mugs, vases and bowls; orders via WhatsApp.'"
3. WhatsApp number (with country code) — short answer, required
4. Product photos — file upload, required (allow images, up to 10 files). Helper: "Clear
   shots on a plain background, one or more per product."
5. 360° turntable videos — file upload, optional (allow video, up to 10 files). Helper:
   "10 seconds per product, slowly rotating on a table. This powers the drag-to-rotate viewer."
6. Product names + prices — paragraph, required. Helper: "One per line, e.g. 'Terra Mug — $34'."
7. Existing website / Instagram / product links — short answer, optional
8. Email — short answer, optional (for the preview link if not WhatsApp)

To wire it in: Google Forms → Send → `< >` (embed) → copy the iframe `src` into
`site/index.html` (marked with an `INTAKE FORM` comment), delete the placeholder div.
New submissions land in Drive/Sheets → operator copies them into `intake/<store>/` and
runs the pipeline (steps below).

## Operator console (`/console/`)

A passcode-gated, fully client-side demo of the pipeline at `site/console/`: intake form
(photos + one sentence) → live "pipeline log" showing each backend step → forged store
preview in an iframe, with 360° spin when a product has 6+ photos, plus download/full-screen.
Nothing is uploaded anywhere — it runs entirely in the visitor's browser, so it costs $0 and
works on GitHub Pages. Production differences are labeled in the log (AI copywriter, ad kit,
scoring, public deploy).

The store the console forges is a **single self-contained downloadable HTML file** — this is
the current deliverable clients receive (no hosting pipeline is wired up yet; see "Downloaded
store vs. hosted store" below). It carries the same premium editorial design and GSAP scroll
motion as the production template, and GSAP + ScrollTrigger are baked in so the file works
fully offline once downloaded — no CDN call, nothing breaks if opened with no network.

- **`site/console/index.html` is a generated file** — edit `forge/console-template.html`
  instead, then run `node forge/build-console.mjs` to rebuild it. The template contains two
  placeholders (`__GSAP_SOURCE__`, `__SCROLLTRIGGER_SOURCE__`) inside inert
  `<script type="text/plain">` blocks near the top of `<body>`; the build script splices in
  the real vendored library source from `template/assets/vendor/`. `storeHtml()` then reads
  that source via `.textContent` (DOM read, not a JS string literal) and interpolates it into
  the generated store's `<script>` tags — reading through the DOM this way preserves every
  backslash exactly. **Do not** splice raw library text directly into a JS template literal's
  source code: the browser's own escape-sequence parsing runs before any of our code does,
  which silently corrupts patterns like `\d` into `d` inside the library (this was a real bug,
  caught by `forge/test-console.mjs`'s offline pageerror check).
- Gate: SHA-256 hash comparison in `forge/console-template.html` (`PASS_HASH`). To change the
  passcode: `node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW-CODE')).then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))"`,
  replace the constant, then rebuild with `node forge/build-console.mjs`. This is demo-grade
  privacy (keeps casual visitors out), not security — anyone determined can read the client JS.
- E2E test: `node forge/test-console.mjs` — unlock → intake → forge → verifies the live
  preview's GSAP motion ran, downloads the store to disk, then opens the **downloaded file**
  in a fresh browser context with all non-`file://` network requests blocked, to prove it
  really works standalone offline (GSAP, ScrollTrigger, spin viewer, scroll reveals).

### Downloaded store vs. hosted store

Today the console (and thus this whole client-facing flow) produces a downloadable file, not
a URL — see the "realistic cases" discussion: nothing is hosted per-client, there's no
persistence, and a client can only receive the store by being sent the file directly (email,
WhatsApp, AirDrop). This is intentional for now (staying lean pre-revenue) — the fulfillment
pipeline (real hosted URL per client) is deliberately deferred until there's paying-client
volume to justify it. See the "v2 backlog" section below.

## Demo assets

`forge/make-demo-frames.mjs` renders synthetic turntable frames (Three.js, headless Chromium)
for the demo store in `intake/demo`. Real stores use real photos; this file exists only so the
whole pipeline can be exercised without a client.

## Cost + routing model

- Hosting: GitHub Pages — $0.
- Media: Playwright renders + client photos — $0.
- Free-model steps (Groq): copy drafting + ad scoring — $0 per store on Groq's free tier.
  Set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) in the environment.
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
