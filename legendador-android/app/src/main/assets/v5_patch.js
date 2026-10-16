(() => {
  'use strict';

  // v7: sem redimensionamento individual por linha.
  const style = document.createElement('style');
  style.textContent = `
    .editorDetails{display:block!important}
    #inlineEdit{display:none!important}
  `;
  document.head.appendChild(style);

  try { openInline = function() {}; } catch (_) {}
  try { hideInline(); } catch (_) {}

  const sizeInput = document.getElementById('size');
  if (sizeInput && sizeInput.parentElement) sizeInput.parentElement.style.display = 'none';

  const swLabel = document.getElementById('sw')?.parentElement;
  if (swLabel && swLabel.firstChild) swLabel.firstChild.textContent = 'Espessura da borda';
  const delBtn = document.getElementById('del');
  if (delBtn) delBtn.textContent = 'Excluir texto selecionado';

  const legend = document.querySelector('#textPane .legend');
  if (legend) legend.innerHTML = '<span><i class="dot yellow"></i>bloco inteiro</span>';
  const hints = document.querySelectorAll('#textPane .hint');
  if (hints.length) hints[hints.length - 1].textContent = 'Toque no texto para selecionar ou mover o bloco. Use somente os cantos amarelos para aumentar ou diminuir o bloco inteiro.';

  try {
    const oldNearHandle = nearHandle;
    nearHandle = function(p, b, r = 30) {
      const L = sel >= 0 ? layers[sel] : null;
      if (L && b === L.blockRect) return oldNearHandle(p, b, r);
      return null;
    };
  } catch (_) {}

  try {
    const oldHandle = handle;
    handle = function(context, x, y, color, r = 12, square = false) {
      if (String(color).toLowerCase() === String(BLUE).toLowerCase()) return;
      return oldHandle(context, x, y, color, r, square);
    };
  } catch (_) {}

  try {
    const proto = CanvasRenderingContext2D.prototype;
    if (!proto.__legendadorV7StrokeRect) {
      proto.__legendadorV7StrokeRect = proto.strokeRect;
      proto.strokeRect = function(x, y, w, h) {
        if (this.canvas === cv && String(this.strokeStyle).toLowerCase() === String(BLUE).toLowerCase()) return;
        return proto.__legendadorV7StrokeRect.call(this, x, y, w, h);
      };
    }
  } catch (_) {}

  saveBlob = async function(blob, name) {
    if (window.AndroidSave) {
      const id = AndroidSave.beginSave(name, blob.type || 'application/octet-stream');
      await blobToAndroid(id, blob);
      return Number(AndroidSave.finishSave(id));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return -1;
  };

  const exportBtn = $('export');
  exportBtn.onclick = async () => {
    if (!media) return;
    const keep = sel, keepLine = selLine;
    try { hideInline(); } catch (_) {}
    sel = -1;
    exporting = true;
    exportBtn.disabled = true;

    let timer = null;
    let rec = null;
    let failed = null;
    let maxMediaTime = 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    try {
      if (kind === 'image') {
        progressSet(20, 'Preparando imagem...');
        await sleep(50);
        const blob = await new Promise((resolve, reject) =>
          cv.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao gerar imagem')), 'image/png'));
        progressSet(80, 'Salvando imagem...');
        await saveBlob(blob, 'imagem-legendada.png');
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

      const chunks = [];
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4500000 });
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((resolve, reject) => {
        rec.onerror = e => reject(new Error((e.error && e.error.message) || 'Erro na gravação'));
        rec.onstop = () => failed ? reject(failed) : resolve();
      });

      media.pause();
      media.loop = false;
      media.playbackRate = 1;
      media.muted = false;
      try { media.currentTime = 0; } catch (_) {}
      if (media.readyState < 2) {
        await Promise.race([new Promise(r => media.addEventListener('canplay', r, {once:true})), sleep(1500)]);
      }
      if (media.currentTime > 0.05) {
        await Promise.race([new Promise(r => media.addEventListener('seeked', r, {once:true})), sleep(1200)]);
      }

      const duration = Number(media.duration) || 0;
      let lastTime = 0;
      let lastAdvance = performance.now();
      const startedAt = performance.now();
      const stop = () => { try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) {} };
      media.onended = stop;
      progressSet(0, 'Exportando vídeo... 0%');
      rec.start();
      await media.play();

      timer = setInterval(() => {
        const now = performance.now();
        const t = Number(media.currentTime) || 0;
        maxMediaTime = Math.max(maxMediaTime, t);
        if (t > lastTime + 0.01) { lastTime = t; lastAdvance = now; }
        const ratio = duration > 0 && isFinite(duration) ? Math.min(1, t / duration) : 0;
        const shown = Math.min(90, ratio * 90);
        progressSet(shown, 'Exportando vídeo... ' + Math.round(shown) + '%');
        if (duration > 0 && isFinite(duration) && t >= duration - 0.06) { stop(); return; }
        const stalledFor = now - lastAdvance;
        if (stalledFor > 1200 && !media.ended) media.play().catch(() => {});
        if (stalledFor > 5000 && !media.ended) {
          failed = new Error('O vídeo parou durante a exportação. Nenhum arquivo quebrado foi salvo.');
          stop();
        }
        if (duration > 0 && isFinite(duration) && now - startedAt > duration * 1000 + 20000) {
          failed = new Error('A exportação excedeu o tempo esperado e foi cancelada para não gerar vídeo corrompido.');
          stop();
        }
      }, 150);

      await stopped;
      if (timer) { clearInterval(timer); timer = null; }
      media.onended = null;

      if (duration > 0 && isFinite(duration)) {
        const required = Math.max(0.25, duration - 0.35);
        if (maxMediaTime < required) throw new Error('A gravação terminou antes do fim do vídeo e não será salva.');
      }
      if (!chunks.length) throw new Error('O gravador não produziu dados de vídeo.');

      progressSet(92, 'Montando vídeo... 92%');
      const blob = new Blob(chunks, {type: mime});
      if (blob.size < 4096) throw new Error('O arquivo de vídeo gerado ficou vazio.');

      progressSet(95, 'Corrigindo duração do vídeo... 95%');
      const finalDurationMs = await saveBlob(blob, 'video-legendado-' + Date.now() + '.webm');
      if (window.AndroidSave && !(finalDurationMs > 0)) throw new Error('O Android não conseguiu validar a duração do vídeo final.');

      progressSet(100, 'Vídeo salvo com sucesso.');
      progressHide();
      media.loop = true;
      media.muted = true;
      media.play().catch(() => {});
    } catch (e) {
      if (timer) clearInterval(timer);
      try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) {}
      $('msg').textContent = 'Não foi possível exportar: ' + (e && e.message ? e.message : e);
      $('progress').classList.remove('on');
      try { if (window.AndroidSave) AndroidSave.cancelSave(); } catch (_) {}
      if (media && kind === 'video') {
        media.onended = null;
        media.loop = true;
        media.muted = true;
        media.play().catch(() => {});
      }
    } finally {
      exporting = false;
      sel = keep;
      selLine = keepLine;
      exportBtn.disabled = false;
      syncDetails();
    }
  };
})();
