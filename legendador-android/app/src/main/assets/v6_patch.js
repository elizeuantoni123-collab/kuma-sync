(() => {
  'use strict';

  // v8 efetiva: sem edição flutuante, sem redimensionamento individual por linha
  // e sem salto da página quando o campo de texto inferior está focado.
  const style = document.createElement('style');
  style.textContent = `
    html,body,.app,.stage,.side,.pane,.editorDetails,#layers,canvas {
      overflow-anchor:none!important;
    }
    html,body { scroll-behavior:auto!important; }
    canvas { touch-action:none!important; overscroll-behavior:none!important; }
    #inlineEdit { display:none!important; }
    .editorDetails { display:block!important; }
  `;
  document.head.appendChild(style);

  try { openInline = function() {}; } catch (_) {}
  try { hideInline(); } catch (_) {}

  const sizeInput = document.getElementById('size');
  if (sizeInput && sizeInput.parentElement) sizeInput.parentElement.style.display = 'none';

  const legend = document.querySelector('#textPane .legend');
  if (legend) legend.innerHTML = '<span><i class="dot yellow"></i>bloco inteiro</span>';
  const hints = document.querySelectorAll('#textPane .hint');
  if (hints.length) {
    hints[hints.length - 1].textContent = 'Toque no texto para selecionar ou mover. Use os cantos amarelos para aumentar ou diminuir o bloco inteiro.';
  }

  const swLabel = document.getElementById('sw')?.parentElement;
  if (swLabel && swLabel.firstChild) swLabel.firstChild.textContent = 'Espessura da borda';
  const delBtn = document.getElementById('del');
  if (delBtn) delBtn.textContent = 'Excluir texto selecionado';

  // Qualquer chamada antiga para mudar apenas uma linha passa a escalar o bloco inteiro.
  try {
    setLineSize = function(L, j, target) {
      if (!L || L.img) return;
      ensureSizes(L);
      const current = Math.max(0.001, pctSize(L, j));
      const ratio = Math.max(0.25, Math.min(4, Number(target) / current));
      L.lineSizes = L.lineSizes.map(v => Math.max(2, Math.min(28, v * ratio)));
      L.size = Math.max(2, Math.min(28, L.size * ratio));
      try { syncDetails(); } catch (_) {}
    };
  } catch (_) {}

  // Remove visualmente toda indicação azul de edição individual.
  try {
    const originalHandle = handle;
    handle = function(context, x, y, color, r = 12, square = false) {
      if (String(color).toLowerCase() === String(BLUE).toLowerCase()) return;
      return originalHandle(context, x, y, color, r, square);
    };
  } catch (_) {}

  try {
    const proto = CanvasRenderingContext2D.prototype;
    if (!proto.__legendadorNoBlueStroke) {
      proto.__legendadorNoBlueStroke = proto.strokeRect;
      proto.strokeRect = function(x, y, w, h) {
        if (this.canvas === cv && String(this.strokeStyle).toLowerCase() === String(BLUE).toLowerCase()) return;
        return proto.__legendadorNoBlueStroke.call(this, x, y, w, h);
      };
    }
  } catch (_) {}

  // Problema reportado: textarea inferior focado + toque no texto do canvas fazia o
  // WebView rolar para manter o textarea/teclado visível. Desfoca antes da seleção
  // e ancora visualmente o canvas enquanto o teclado fecha.
  const isFocusedEditor = el => !!el && (
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' && !['range','color','file','button','submit'].includes((el.type || '').toLowerCase()))
  );

  let anchorUntil = 0;
  let anchorTop = 0;
  let anchorLeft = 0;
  let anchorRaf = 0;

  function restoreCanvasAnchor() {
    if (performance.now() > anchorUntil) return;
    const r = cv.getBoundingClientRect();
    const dx = r.left - anchorLeft;
    const dy = r.top - anchorTop;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) window.scrollBy(dx, dy);
    anchorRaf = requestAnimationFrame(restoreCanvasAnchor);
  }

  function beginAnchor() {
    const r = cv.getBoundingClientRect();
    anchorTop = r.top;
    anchorLeft = r.left;
    anchorUntil = performance.now() + 1000;
    if (anchorRaf) cancelAnimationFrame(anchorRaf);
    anchorRaf = requestAnimationFrame(restoreCanvasAnchor);
    [0,30,70,120,200,320,500,750,950].forEach(ms => setTimeout(restoreCanvasAnchor, ms));
  }

  function blurBeforeCanvas(e) {
    const active = document.activeElement;
    if (!isFocusedEditor(active)) return;
    if (e && e.cancelable) e.preventDefault();
    beginAnchor();
    try { active.blur(); } catch (_) {}
    requestAnimationFrame(restoreCanvasAnchor);
  }

  // Usa window em capture: acontece antes dos listeners antigos do canvas.
  window.addEventListener('pointerdown', e => {
    if (e.target === cv) blurBeforeCanvas(e);
  }, {capture:true, passive:false});
  window.addEventListener('touchstart', e => {
    if (e.target === cv) blurBeforeCanvas(e);
  }, {capture:true, passive:false});

  if (window.visualViewport) {
    visualViewport.addEventListener('resize', restoreCanvasAnchor, {passive:true});
    visualViewport.addEventListener('scroll', restoreCanvasAnchor, {passive:true});
  }
  window.addEventListener('scroll', restoreCanvasAnchor, {passive:true});
})();
