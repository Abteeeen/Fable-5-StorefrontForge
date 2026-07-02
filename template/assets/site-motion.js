/* StorefrontForge store motion — GSAP scroll choreography.
 * Loads after gsap.min.js + ScrollTrigger.min.js (see build.mjs script order).
 * If GSAP failed to load, or the visitor has reduced-motion set, the page is
 * left exactly as CSS renders it — nothing here is required for usability.
 */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('scrolled', y > 12);
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (!hasGsap || reduceMotion) return;

  document.documentElement.classList.add('motion-on');
  gsap.registerPlugin(ScrollTrigger);

  gsap.timeline()
    .from('.hero .kicker, .hero h1, .hero p.tagline, .hero .cta-button', {
      opacity: 0, y: 26, duration: 0.9, ease: 'power3.out', stagger: 0.1,
    });

  document.querySelectorAll('[data-reveal]').forEach(function (el, i) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.85, ease: 'power3.out',
      delay: Math.min(i % 6, 5) * 0.04,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  var viewer = document.querySelector('.spin-viewer, .product-layout .thumb');
  if (viewer) {
    gsap.to(viewer, {
      yPercent: -4, ease: 'none',
      scrollTrigger: { trigger: viewer, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }
})();
