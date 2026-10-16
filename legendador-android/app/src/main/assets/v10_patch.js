(() => {
  'use strict';

  const mainInput = $('file');
  const overlayInput = $('overlayFile');

  function cleanSource(source) {
    const test = document.createElement('canvas');
    test.width = 2;
    test.height = 2;
    const tctx = test.getContext('2d', {willReadFrequently:true});
    tctx.drawImage(source, 0, 0, 2, 2);
    tctx.getImageData(0, 0, 1, 1);
    return true;
  }

  function loadSafeMain(url, mime) {
    const isVideo = String(mime || '').toLowerCase().startsWith('video/');
    if (isVideo) {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.onerror = () => { $('msg').textContent = 'Não foi possível abrir o vídeo selecionado.'; };
      v.onloadeddata = () => {
        try {
          cleanSource(v);
        } catch (e) {
          $('msg').textContent = 'O Android bloqueou a origem deste vídeo. Selecione o arquivo novamente nesta versão.';
          return;
        }
        setMedia(v, 'video', v.videoWidth, v.videoHeight);
        $('msg').textContent = 'Vídeo carregado com origem segura. Pronto para exportar.';
        v.play().catch(() => {});
      };
      v.src = url;
      v.load();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => { $('msg').textContent = 'Não foi possível abrir a imagem selecionada.'; };
    img.onload = () => {
      try {
        cleanSource(img);
      } catch (e) {
        $('msg').textContent = 'O Android bloqueou a origem desta imagem. Selecione o arquivo novamente nesta versão.';
        return;
      }
      setMedia(img, 'image', img.naturalWidth, img.naturalHeight);
      $('msg').textContent = 'Imagem carregada com origem segura.';
    };
    img.src = url;
  }

  function loadSafeOverlay(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => { $('msg').textContent = 'Não foi possível abrir a imagem de sobreposição.'; };
    img.onload = () => {
      try {
        cleanSource(img);
      } catch (e) {
        $('msg').textContent = 'A imagem de sobreposição foi bloqueada pelo Android.';
        return;
      }
      layers.push(mk({img, size:28, x:.5, y:.8}));
      select(layers.length - 1, 0);
      renderLayerButtons();
      setTab('text');
    };
    img.src = url;
  }

  window.LegendadorNativeMediaSelected = function(url, mime, overlay) {
    if (!url) return;
    if (overlay) loadSafeOverlay(url);
    else loadSafeMain(url, mime || 'application/octet-stream');
  };

  async function browserClone(file, overlay) {
    try {
      const bytes = await file.arrayBuffer();
      const blob = new Blob([bytes], {type:file.type || 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      window.LegendadorNativeMediaSelected(url, file.type || 'application/octet-stream', overlay);
    } catch (e) {
      $('msg').textContent = 'Não foi possível preparar a mídia: ' + (e && e.message ? e.message : e);
    }
  }

  // No Android, o seletor nativo envia a mídia pelo endpoint same-origin interno.
  // Fora do Android, recria o Blob a partir dos bytes para não reutilizar diretamente o File externo.
  if (window.AndroidSave) {
    mainInput.onchange = () => {};
    overlayInput.onchange = () => {};
  } else {
    mainInput.onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (f) browserClone(f, false);
    };
    overlayInput.onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (f) browserClone(f, true);
    };
  }

  // Preflight antes da exportação. Se um canvas antigo já tiver sido contaminado,
  // recria o backing store e deixa dois frames redesenharem a mídia segura.
  const exportBtn = $('export');
  const previousExport = exportBtn.onclick;
  exportBtn.onclick = async function(e) {
    if (media) {
      let clean = true;
      try { ctx.getImageData(0, 0, 1, 1); } catch (_) { clean = false; }
      if (!clean) {
        const w = cv.width, h = cv.height;
        cv.width = w;
        cv.height = h;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        try {
          ctx.getImageData(0, 0, 1, 1);
        } catch (_) {
          $('msg').textContent = 'Não foi possível exportar: a mídia ainda está com origem bloqueada. Selecione o vídeo novamente nesta versão.';
          return;
        }
      }
    }
    return previousExport ? previousExport.call(this, e) : undefined;
  };
})();
