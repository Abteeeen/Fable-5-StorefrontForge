/* SpinViewer — 360° product viewer from a sequence of frames.
 * Usage: <div class="spin-viewer" data-frames="spin/frame_%d.png" data-count="24"></div>
 * Drag / swipe / arrow keys to rotate. Auto-spins gently until first interaction.
 */
(function () {
  'use strict';

  function initViewer(el) {
    const pattern = el.dataset.frames;
    const count = parseInt(el.dataset.count, 10);
    if (!pattern || !count) return;

    const canvas = document.createElement('canvas');
    const hint = document.createElement('div');
    hint.className = 'spin-hint';
    hint.innerHTML = '<span>&#8634;</span> drag to rotate';
    el.appendChild(canvas);
    el.appendChild(hint);

    const ctx = canvas.getContext('2d');
    const frames = new Array(count);
    let loaded = 0;
    let current = 0;
    let autoSpin = true;
    let interacted = false;

    function src(i) {
      return pattern.replace('%d', String(i).padStart(2, '0'));
    }

    function draw() {
      const img = frames[Math.round(current) % count];
      if (!img || !img.complete) return;
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth, h = el.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    }

    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.onload = function () {
        loaded++;
        if (i === 0 || loaded === count) draw();
      };
      img.src = src(i);
      frames[i] = img;
    }

    function rotateBy(deltaFrames) {
      current = (current + deltaFrames + count * 1000) % count;
      draw();
    }

    // Pointer drag
    let dragging = false;
    let lastX = 0;
    const SENSITIVITY = 5; // px per frame step

    el.addEventListener('pointerdown', function (e) {
      dragging = true;
      lastX = e.clientX;
      interacted = true;
      autoSpin = false;
      hint.classList.add('spin-hint-hidden');
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      if (Math.abs(dx) >= SENSITIVITY) {
        rotateBy(Math.trunc(dx / SENSITIVITY));
        lastX = e.clientX;
      }
    });
    el.addEventListener('pointerup', function () { dragging = false; });
    el.addEventListener('pointercancel', function () { dragging = false; });

    // Keyboard
    el.tabIndex = 0;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { rotateBy(-1); interacted = true; autoSpin = false; }
      if (e.key === 'ArrowRight') { rotateBy(1); interacted = true; autoSpin = false; }
    });

    // Gentle auto-spin until first interaction
    let lastTick = 0;
    function tick(ts) {
      if (autoSpin && loaded === count) {
        if (ts - lastTick > 120) {
          rotateBy(1);
          lastTick = ts;
        }
      }
      if (!interacted || autoSpin) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.addEventListener('resize', draw);
  }

  function boot() {
    document.querySelectorAll('.spin-viewer').forEach(initViewer);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
