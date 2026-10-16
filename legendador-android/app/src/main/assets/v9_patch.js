(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    #legendadorSplash,#exportShield{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif}
    #legendadorSplash{background:radial-gradient(circle at 30% 20%,#3a2b05 0,#171717 34%,#050505 78%);color:#fff;transition:opacity .35s ease}
    #legendadorSplash.hide{opacity:0;pointer-events:none}
    .ls-card{width:min(88vw,420px);text-align:center}
    .ls-logo{width:104px;height:104px;margin:0 auto 24px;border-radius:28px;border:4px solid #ffc928;background:#111;display:grid;place-items:center;box-shadow:0 0 42px #ffbf003f;position:relative}
    .ls-logo:before{content:'L';font-weight:900;font-size:64px;line-height:1;color:#fff;transform:translateX(-4px)}
    .ls-logo:after{content:'';position:absolute;right:19px;top:38px;border-left:22px solid #ffc928;border-top:14px solid transparent;border-bottom:14px solid transparent}
    .ls-title{font-size:42px;font-weight:900;letter-spacing:-2px;margin:0}.ls-title b{color:#ffc928}
    .ls-sub{font-size:17px;color:#d8d8d8;margin-top:8px}.ls-line{height:4px;width:120px;background:#ffc928;border-radius:99px;margin:18px auto 0}

    #exportShield{display:none;background:rgba(5,5,5,.96);color:#fff;pointer-events:all;touch-action:none;overscroll-behavior:none}
    #exportShield.on{display:flex}
    .ex-card{width:min(84vw,390px);padding:32px 26px;border-radius:26px;background:#141414;border:1px solid #2c2c2c;text-align:center;box-shadow:0 18px 60px #000b}
    .ex-logo{width:64px;height:64px;border-radius:18px;margin:0 auto 20px;background:#ffc928;color:#111;display:grid;place-items:center;font-size:34px;font-weight:900}
    .ex-title{font-size:24px;font-weight:800;margin-bottom:8px}.ex-msg{min-height:24px;color:#cfcfcf;font-size:14px;margin-bottom:20px}
    .ex-pct{font-size:44px;font-weight:900;color:#ffc928;font-variant-numeric:tabular-nums;margin-bottom:14px}
    .ex-track{height:12px;border-radius:999px;background:#2a2a2a;overflow:hidden}.ex-fill{height:100%;width:0;background:linear-gradient(90deg,#ffb800,#ffd84a);border-radius:999px;transition:width .15s linear}
    .ex-note{font-size:12px;color:#8d8d8d;margin-top:16px}
    body.legendador-export-lock{overflow:hidden!important;touch-action:none!important}
  `;
  document.head.appendChild(style);

  const splash = document.createElement('div');
  splash.id = 'legendadorSplash';
  splash.innerHTML = `<div class="ls-card"><div class="ls-logo"></div><h1 class="ls-title">Legenda<b>dor</b></h1><div class="ls-sub">Texto fácil sobre fotos e vídeos</div><div class="ls-line"></div></div>`;
  document.body.appendChild(splash);
  const closeSplash = () => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 420); };
  splash.addEventListener('click', closeSplash, {once:true});
  setTimeout(closeSplash, 1500);

  const shield = document.createElement('div');
  shield.id = 'exportShield';
  shield.setAttribute('role','status');
  shield.innerHTML = `<div class="ex-card"><div class="ex-logo">L</div><div class="ex-title">Gerando vídeo</div><div class="ex-msg">Preparando exportação...</div><div class="ex-pct">0%</div><div class="ex-track"><div class="ex-fill"></div></div><div class="ex-note">A edição fica bloqueada até o vídeo terminar.</div></div>`;
  document.body.appendChild(shield);
  const pctEl = shield.querySelector('.ex-pct');
  const msgEl = shield.querySelector('.ex-msg');
  const fillEl = shield.querySelector('.ex-fill');

  const showShield = (p=0,msg='Preparando exportação...') => {
    const n = Math.max(0, Math.min(100, Number(p) || 0));
    shield.classList.add('on');
    document.body.classList.add('legendador-export-lock');
    try { document.activeElement?.blur?.(); } catch (_) {}
    pctEl.textContent = Math.round(n) + '%';
    fillEl.style.width = n + '%';
    msgEl.textContent = msg || 'Gerando vídeo...';
  };
  const updateShield = (p,msg) => {
    const n = Math.max(0, Math.min(100, Number(p) || 0));
    pctEl.textContent = Math.round(n) + '%';
    fillEl.style.width = n + '%';
    if (msg) msgEl.textContent = msg;
  };
  const hideShield = () => {
    shield.classList.remove('on');
    document.body.classList.remove('legendador-export-lock');
  };

  ['pointerdown','pointermove','pointerup','touchstart','touchmove','touchend','wheel','click'].forEach(type => {
    shield.addEventListener(type, e => {
      if (!shield.classList.contains('on')) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    }, {capture:true,passive:false});
  });

  try {
    const oldProgressSet = progressSet;
    progressSet = function(p,msg) {
      const r = oldProgressSet.apply(this, arguments);
      if (shield.classList.contains('on')) updateShield(p,msg);
      return r;
    };
  } catch (_) {}

  try {
    const oldProgressHide = progressHide;
    progressHide = function() {
      const r = oldProgressHide.apply(this, arguments);
      if (shield.classList.contains('on')) {
        updateShield(100,'Finalizado.');
        setTimeout(hideShield, 550);
      }
      return r;
    };
  } catch (_) {}

  const btn = document.getElementById('export');
  if (btn && btn.onclick) {
    const oldExport = btn.onclick;
    btn.onclick = async function(e) {
      const isVideo = typeof kind !== 'undefined' && kind === 'video';
      if (isVideo) showShield(0,'Preparando vídeo...');
      try {
        return await oldExport.call(this,e);
      } finally {
        if (isVideo) {
          const wait = () => {
            if (typeof exporting !== 'undefined' && exporting) return setTimeout(wait,150);
            setTimeout(hideShield,450);
          };
          wait();
        }
      }
    };
  }
})();
