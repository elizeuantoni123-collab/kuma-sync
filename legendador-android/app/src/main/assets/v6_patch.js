(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    html,body,.app,.stage,.side,.pane,.editorDetails,#layers,canvas {
      overflow-anchor: none !important;
    }
    html,body { scroll-behavior: auto !important; }
    canvas { touch-action: none !important; overscroll-behavior: none !important; }
  `;
  document.head.appendChild(style);

  let canvasLock = false;
  let lockX = 0;
  let lockY = 0;
  let releaseTimer = null;

  function restoreScroll() {
    if (!canvasLock) return;
    if (window.scrollX !== lockX || window.scrollY !== lockY) {
      window.scrollTo(lockX, lockY);
    }
  }

  function beginCanvasLock(e) {
    if (e && e.cancelable) e.preventDefault();
    if (releaseTimer) clearTimeout(releaseTimer);
    lockX = window.scrollX;
    lockY = window.scrollY;
    canvasLock = true;
    restoreScroll();
    requestAnimationFrame(restoreScroll);
    setTimeout(restoreScroll, 0);
    setTimeout(restoreScroll, 40);
  }

  function endCanvasLock(e) {
    if (e && e.cancelable) e.preventDefault();
    restoreScroll();
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      restoreScroll();
      canvasLock = false;
    }, 220);
  }

  cv.addEventListener('pointerdown', beginCanvasLock, {capture:true, passive:false});
  cv.addEventListener('pointermove', e => {
    if (canvasLock) {
      if (e.cancelable) e.preventDefault();
      restoreScroll();
    }
  }, {capture:true, passive:false});
  cv.addEventListener('pointerup', endCanvasLock, {capture:true, passive:false});
  cv.addEventListener('pointercancel', endCanvasLock, {capture:true, passive:false});
  cv.addEventListener('touchstart', beginCanvasLock, {capture:true, passive:false});
  cv.addEventListener('touchmove', e => {
    if (canvasLock) {
      if (e.cancelable) e.preventDefault();
      restoreScroll();
    }
  }, {capture:true, passive:false});
  cv.addEventListener('touchend', endCanvasLock, {capture:true, passive:false});
  cv.addEventListener('touchcancel', endCanvasLock, {capture:true, passive:false});
  cv.addEventListener('gesturestart', e => { if (e.cancelable) e.preventDefault(); }, {passive:false});

  window.addEventListener('scroll', restoreScroll, {capture:true, passive:true});

  try {
    const oldSelect = select;
    select = function(...args) {
      const x = window.scrollX, y = window.scrollY;
      const result = oldSelect.apply(this, args);
      if (canvasLock) {
        lockX = x; lockY = y;
        requestAnimationFrame(restoreScroll);
        setTimeout(restoreScroll, 0);
        setTimeout(restoreScroll, 60);
      }
      return result;
    };
  } catch (_) {}

  try {
    const oldSyncDetails = syncDetails;
    syncDetails = function(...args) {
      const x = window.scrollX, y = window.scrollY;
      const result = oldSyncDetails.apply(this, args);
      if (canvasLock) {
        lockX = x; lockY = y;
        requestAnimationFrame(restoreScroll);
        setTimeout(restoreScroll, 0);
        setTimeout(restoreScroll, 60);
      }
      return result;
    };
  } catch (_) {}
})();
