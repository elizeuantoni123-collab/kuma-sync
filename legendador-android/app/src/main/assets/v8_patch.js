(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    html, body, .app, .stage, .side, .pane, .editorDetails, #layers, canvas {
      overflow-anchor: none !important;
    }
    html, body { scroll-behavior: auto !important; }
    canvas { touch-action: none !important; overscroll-behavior: none !important; }
  `;
  document.head.appendChild(style);

  const isEditorField = el => !!el && (
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !['range','color','file','button','submit'].includes((el.type || '').toLowerCase())) ||
    el.tagName === 'SELECT'
  );

  let keepUntil = 0;
  let wantedTop = 0;
  let wantedLeft = 0;
  let rafId = 0;

  function keepCanvasStable() {
    if (performance.now() > keepUntil) return;
    const r = cv.getBoundingClientRect();
    const dx = r.left - wantedLeft;
    const dy = r.top - wantedTop;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      window.scrollBy(dx, dy);
    }
    rafId = requestAnimationFrame(keepCanvasStable);
  }

  function startCanvasStabilizer() {
    const r = cv.getBoundingClientRect();
    wantedTop = r.top;
    wantedLeft = r.left;
    keepUntil = performance.now() + 900;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(keepCanvasStable);
    [0, 30, 80, 150, 250, 400, 650, 850].forEach(ms => {
      setTimeout(() => {
        if (performance.now() <= keepUntil) keepCanvasStable();
      }, ms);
    });
  }

  function blurEditorBeforeCanvasSelection(e) {
    const active = document.activeElement;
    if (!isEditorField(active)) return;

    if (e && e.cancelable) e.preventDefault();
    startCanvasStabilizer();

    try { active.blur(); } catch (_) {}

    // O fechamento do teclado altera o visual viewport em Android/WebView.
    // Mantém o canvas na mesma posição enquanto essa transição termina.
    requestAnimationFrame(keepCanvasStable);
    setTimeout(keepCanvasStable, 0);
    setTimeout(keepCanvasStable, 60);
    setTimeout(keepCanvasStable, 180);
    setTimeout(keepCanvasStable, 420);
  }

  cv.addEventListener('pointerdown', blurEditorBeforeCanvasSelection, {
    capture: true,
    passive: false
  });
  cv.addEventListener('touchstart', blurEditorBeforeCanvasSelection, {
    capture: true,
    passive: false
  });

  if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => {
      if (performance.now() <= keepUntil) keepCanvasStable();
    }, {passive:true});
    visualViewport.addEventListener('scroll', () => {
      if (performance.now() <= keepUntil) keepCanvasStable();
    }, {passive:true});
  }

  window.addEventListener('scroll', () => {
    if (performance.now() <= keepUntil) keepCanvasStable();
  }, {passive:true});
})();
