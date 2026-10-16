(() => {
  const btn = document.getElementById('export');
  const msg = document.getElementById('msg');
  if (!btn || !msg) return;

  async function appendBlobToAndroid(id, blob) {
    const PART = 192 * 1024;
    for (let off = 0; off < blob.size; off += PART) {
      const ab = await blob.slice(off, Math.min(off + PART, blob.size)).arrayBuffer();
      const bytes = new Uint8Array(ab);
      let bin = '';
      const STEP = 0x8000;
      for (let i = 0; i < bytes.length; i += STEP) {
        bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + STEP, bytes.length)));
      }
      AndroidSave.appendChunk(id, btoa(bin));
    }
  }

  const oldExport = btn.onclick;
  btn.onclick = async () => {
    if (!media) return;
    if (kind !== 'video') {
      if (typeof oldExport === 'function') return oldExport();
      return;
    }

    if (!window.AndroidSave) {
      if (typeof oldExport === 'function') return oldExport();
      return;
    }

    const keep = sel;
    sel = -1;
    exporting = true;
    btn.disabled = true;
    btn.textContent = 'Preparando vídeo...';
    msg.textContent = 'Preparando a exportação. Não feche o app.';

    let saveId = null;
    let rec = null;
    let queue = Promise.resolve();

    try {
      if (!window.MediaRecorder || !cv.captureStream) {
        throw new Error('Este aparelho não oferece gravação de canvas no WebView.');
      }

      const mime = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm'
      ].find(m => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error('Nenhum formato de gravação de vídeo compatível foi encontrado.');

      const stream = cv.captureStream(30);
      try {
        const srcStream = media.captureStream ? media.captureStream() : (media.mozCaptureStream ? media.mozCaptureStream() : null);
        if (srcStream) srcStream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch (_) {}

      saveId = AndroidSave.beginSave('video-legendado-' + Date.now() + '.webm', 'video/webm');
      if (!saveId) throw new Error('O Android não conseguiu criar o arquivo de saída.');

      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });

      rec.ondataavailable = e => {
        if (!e.data || !e.data.size) return;
        queue = queue.then(() => appendBlobToAndroid(saveId, e.data));
      };

      rec.onerror = e => {
        msg.textContent = 'Erro durante a gravação do vídeo.';
      };

      rec.onstop = async () => {
        try {
          await queue;
          AndroidSave.finishSave(saveId);
          saveId = null;
          msg.textContent = 'Vídeo salvo em Filmes/Legendador no celular.';
          btn.textContent = 'Baixar resultado';
        } catch (e) {
          try { AndroidSave.cancelSave(); } catch (_) {}
          msg.textContent = 'Falha ao salvar o vídeo: ' + (e && e.message ? e.message : e);
        } finally {
          media.loop = true;
          media.muted = true;
          media.onended = null;
          try { media.play(); } catch (_) {}
          exporting = false;
          sel = keep;
          btn.disabled = false;
        }
      };

      media.loop = false;
      media.currentTime = 0;
      media.muted = false;
      media.onended = () => {
        try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) {}
      };

      btn.textContent = 'Gravando vídeo...';
      msg.textContent = 'Exportando o vídeo inteiro. Ele será salvo automaticamente no final.';
      rec.start(500);
      const playPromise = media.play();
      if (playPromise && playPromise.catch) {
        await playPromise.catch(err => { throw err; });
      }
    } catch (e) {
      try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) {}
      try { if (saveId) AndroidSave.cancelSave(); } catch (_) {}
      media.loop = true;
      media.muted = true;
      media.onended = null;
      try { media.play(); } catch (_) {}
      exporting = false;
      sel = keep;
      btn.disabled = false;
      btn.textContent = 'Baixar resultado';
      msg.textContent = 'Não foi possível exportar: ' + (e && e.message ? e.message : e);
    }
  };
})();
