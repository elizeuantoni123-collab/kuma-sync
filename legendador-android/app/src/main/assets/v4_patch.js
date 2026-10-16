(() => {
  'use strict';

  const oldInline = document.getElementById('inlineEdit');
  if (!oldInline) return;

  const style = document.createElement('style');
  style.textContent = `
    @media(max-width:820px){
      .editorDetails{display:block!important}
      .inlineEdit{left:8px!important;right:8px!important;width:auto!important;max-width:none!important;max-height:72vh;overflow:auto}
    }
    .inlineEdit{max-height:72vh;overflow:auto;padding:8px}
    .inlineEdit input[type=text]{width:100%;font-size:18px;font-weight:800;background:#080808;color:#fff;border:0;border-radius:7px;padding:10px;outline:none}
    .inlineTools{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
    .inlineTools label{background:#111;border:1px solid var(--line);border-radius:8px;padding:6px;color:#ddd;font-size:11px}
    .inlineTools input[type=color]{width:100%;height:36px;border:0;background:transparent}
    .inlineTools input[type=range]{width:100%}
    .inlineBtns{display:grid!important;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}
    .inlineDelete{border-color:#8b2d2d!important;color:#ffaaa4!important}
  `;
  document.head.appendChild(style);

  const swLabel = document.getElementById('sw')?.parentElement;
  if (swLabel && swLabel.firstChild) swLabel.firstChild.textContent = 'Espessura da borda';
  const delBtn = document.getElementById('del');
  if (delBtn) delBtn.textContent = 'Excluir texto selecionado';

  oldInline.innerHTML = `
    <input id="inlineInput" type="text" aria-label="Editar linha">
    <div class="inlineTools">
      <label>Cor do texto<input id="inlineFill" type="color"></label>
      <label>Cor da borda<input id="inlineStroke" type="color"></label>
      <label>Espessura da borda<input id="inlineSw" type="range" min="0" max="10" step=".5"></label>
      <label>Sombra<input id="inlineSh" type="range" min="0" max="10" step=".5"></label>
    </div>
    <div class="inlineBtns">
      <button class="btn primary" id="inlineOk">OK</button>
      <button class="btn inlineDelete" id="inlineDelete">Excluir texto</button>
      <button class="btn" id="inlineCancel">Fechar</button>
    </div>`;

  openInline = function(i, j) {
    const L = layers[i];
    if (!L || L.img) return;
    const lines = ensureSizes(L);
    $('inlineInput').value = lines[j] || '';
    $('inlineFill').value = L.fill;
    $('inlineStroke').value = L.stroke;
    $('inlineSw').value = L.sw;
    $('inlineSh').value = L.sh;
    $('inlineEdit').dataset.layer = i;
    $('inlineEdit').dataset.line = j;
    $('inlineEdit').classList.add('on');
    positionInline();
    setTimeout(() => {
      $('inlineInput').focus();
      $('inlineInput').select();
    }, 30);
  };

  positionInline = function() {
    if (!$('inlineEdit').classList.contains('on') || sel < 0) return;
    const L = layers[sel], r = L.lineRects && L.lineRects[selLine];
    if (!r) return;
    const cr = cv.getBoundingClientRect(), scaleX = cr.width / cv.width, scaleY = cr.height / cv.height;
    const left = cr.left + r.x * scaleX, top = cr.top + r.y * scaleY;
    const width = Math.max(220, Math.min(window.innerWidth - 16, r.w * scaleX));
    const el = $('inlineEdit');
    el.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, left)) + 'px';
    el.style.top = Math.max(8, Math.min(window.innerHeight - 285, top)) + 'px';
    el.style.width = width + 'px';
  };

  commitInline = function() {
    const el = $('inlineEdit'), i = +el.dataset.layer, j = +el.dataset.line, L = layers[i];
    if (L && !L.img) {
      const a = ensureSizes(L);
      a[j] = $('inlineInput').value;
      L.text = a.join('\n');
      renderLayerButtons();
      syncDetails();
    }
    hideInline();
  };

  hideInline = function() {
    $('inlineEdit').classList.remove('on');
    $('inlineInput')?.blur();
  };

  $('inlineOk').onclick = commitInline;
  $('inlineCancel').onclick = hideInline;
  $('inlineDelete').onclick = () => {
    const i = +$('inlineEdit').dataset.layer;
    if (i >= 0 && layers[i] && !layers[i].img) {
      layers.splice(i, 1);
      hideInline();
      select(-1, 0);
      renderLayerButtons();
    }
  };
  $('inlineFill').oninput = () => {
    const L = layers[+$('inlineEdit').dataset.layer];
    if (L && !L.img) { L.fill = $('inlineFill').value; $('fill').value = L.fill; }
  };
  $('inlineStroke').oninput = () => {
    const L = layers[+$('inlineEdit').dataset.layer];
    if (L && !L.img) { L.stroke = $('inlineStroke').value; $('stroke').value = L.stroke; }
  };
  $('inlineSw').oninput = () => {
    const L = layers[+$('inlineEdit').dataset.layer];
    if (L && !L.img) { L.sw = +$('inlineSw').value; $('sw').value = L.sw; }
  };
  $('inlineSh').oninput = () => {
    const L = layers[+$('inlineEdit').dataset.layer];
    if (L && !L.img) { L.sh = +$('inlineSh').value; $('sh').value = L.sh; }
  };
  $('inlineInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitInline(); }
    else if (e.key === 'Escape') hideInline();
  });

  const exportBtn = $('export');
  exportBtn.onclick = async () => {
    if (!media) return;
    const keep = sel, keepLine = selLine;
    hideInline();
    sel = -1;
    exporting = true;
    exportBtn.disabled = true;

    let timer = null;
    let rec = null;
    let saveId = null;
    let stopped = false;
    let timedOut = false;
    let resumeHandler = null;

    const stopRecorder = () => {
      if (stopped) return;
      stopped = true;
      try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) {}
    };

    try {
      if (kind === 'image') {
        progressSet(20, 'Preparando imagem...');
        await new Promise(r => setTimeout(r, 50));
        const b = await new Promise((res, rej) => cv.toBlob(x => x ? res(x) : rej(new Error('Falha ao gerar imagem')), 'image/png'));
        progressSet(82, 'Salvando imagem...');
        await saveBlob(b, 'imagem-legendada.png');
        progressSet(100, 'Imagem salva.');
        progressHide();
        return;
      }

      if (!window.MediaRecorder || !cv.captureStream) throw new Error('Este aparelho não suporta gravação de canvas.');
      const mime = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ].find(m => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error('Nenhum formato de vídeo compatível foi encontrado.');

      let stream;
      try { stream = cv.captureStream(30); }
      catch (e) { throw new Error('Canvas não pôde ser capturado: ' + e.message); }

      try {
        const src = media.captureStream ? media.captureStream() : (media.mozCaptureStream ? media.mozCaptureStream() : null);
        if (src) src.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch (_) {}

      saveId = window.AndroidSave ? AndroidSave.beginSave('video-legendado-' + Date.now() + '.webm', 'video/webm') : null;
      let chunks = [];
      let queue = Promise.resolve();

      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
      rec.ondataavailable = e => {
        if (!e.data || !e.data.size) return;
        if (saveId) queue = queue.then(() => blobToAndroid(saveId, e.data));
        else chunks.push(e.data);
      };

      const done = new Promise((resolve, reject) => {
        rec.onerror = e => reject(new Error((e.error && e.error.message) || 'Erro na gravação'));
        rec.onstop = async () => {
          try {
            progressSet(95, 'Finalizando vídeo... 95%');
            await queue;
            progressSet(98, 'Salvando arquivo... 98%');
            if (saveId) {
              AndroidSave.finishSave(saveId);
              saveId = null;
            } else {
              await saveBlob(new Blob(chunks, { type: mime }), 'video-legendado.webm');
            }
            resolve();
          } catch (e) { reject(e); }
        };
      });

      media.pause();
      media.loop = false;
      media.playbackRate = 1;
      media.currentTime = 0;
      const duration = Number(media.duration) || 0;
      const startedAt = performance.now();
      let lastTime = 0, lastAdvance = startedAt, recoveries = 0;
      progressSet(0, 'Exportando vídeo... 0%');

      resumeHandler = () => {
        if (exporting && !media.ended) media.play().catch(() => {});
      };
      media.addEventListener('waiting', resumeHandler);
      media.addEventListener('stalled', resumeHandler);
      media.onended = stopRecorder;

      timer = setInterval(() => {
        if (!rec || rec.state === 'inactive') return;
        const now = performance.now(), t = Number(media.currentTime) || 0, d = Number(media.duration) || duration;
        if (t > lastTime + 0.015) { lastTime = t; lastAdvance = now; }

        const mediaRatio = d > 0 && isFinite(d) ? t / d : 0;
        const elapsedRatio = d > 0 && isFinite(d) ? (now - startedAt) / (d * 1000) : 0;
        const ratio = Math.max(mediaRatio, Math.min(elapsedRatio, 0.96));
        const shown = Math.min(94, ratio * 94);
        progressSet(shown, 'Exportando vídeo... ' + Math.round(shown) + '%');

        if (d > 0 && isFinite(d) && t >= d - 0.08) {
          stopRecorder();
          return;
        }

        const stalledFor = now - lastAdvance;
        if (stalledFor > 1200 && !media.ended) resumeHandler();
        if (stalledFor > 2600 && d > 0 && isFinite(d) && t < d - 0.15 && recoveries < 5) {
          recoveries++;
          lastAdvance = now;
          try { media.currentTime = Math.min(d - 0.08, t + 0.12); } catch (_) {}
          resumeHandler();
          $('msg').textContent = 'Recuperando exportação... ' + Math.round(shown) + '%';
        }

        if (d > 0 && isFinite(d) && now - startedAt > d * 1000 + 15000) {
          timedOut = true;
          stopRecorder();
        }
      }, 200);

      rec.start(2000);
      await media.play();
      await done;
      if (timedOut) throw new Error('A exportação demorou demais e foi interrompida para não ficar travada.');

      if (timer) { clearInterval(timer); timer = null; }
      progressSet(100, 'Vídeo salvo em Filmes/Legendador. 100%');
      progressHide();
    } catch (e) {
      if (timer) clearInterval(timer);
      $('msg').textContent = 'Não foi possível exportar: ' + (e && e.message ? e.message : e);
      $('progress').classList.remove('on');
      try { if (saveId && window.AndroidSave) AndroidSave.cancelSave(); } catch (_) {}
    } finally {
      if (resumeHandler) {
        try { media.removeEventListener('waiting', resumeHandler); media.removeEventListener('stalled', resumeHandler); } catch (_) {}
      }
      try {
        media.onended = null;
        if (kind === 'video') {
          media.loop = true;
          media.muted = true;
          media.play().catch(() => {});
        }
      } catch (_) {}
      exporting = false;
      sel = keep;
      selLine = keepLine;
      exportBtn.disabled = false;
      syncDetails();
    }
  };

  console.log('Legendador v4 patch ativo');
})();
