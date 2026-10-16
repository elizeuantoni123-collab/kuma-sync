(() => {
  const S = { line: 0, pointers: new Map(), pinch: null, drag: null, resize: null };
  const cvEl = document.getElementById('cv');
  const sizeEl = document.getElementById('size');
  const txEl = document.getElementById('tx');
  const fontEl = document.getElementById('font');
  const fillEl = document.getElementById('fill');
  const strokeEl = document.getElementById('stroke');
  if (!cvEl || !sizeEl || !txEl) return;

  const fontOptions = [
    ['sans-serif-black','Grossa'],
    ['sans-serif-condensed','Condensada'],
    ['sans-serif-medium','Média'],
    ['sans-serif','Normal'],
    ['serif','Serifada'],
    ['monospace','Mono']
  ];
  if (fontEl) {
    fontEl.innerHTML = fontOptions.map(([v,n]) => `<option value="${v}">${n}</option>`).join('');
  }

  const css = document.createElement('style');
  css.textContent = `
    #uxQuick{position:fixed;left:10px;right:10px;bottom:10px;z-index:9999;background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:16px;padding:12px;box-shadow:0 12px 35px rgba(0,0,0,.28);display:none;gap:9px}
    #uxQuick.on{display:flex;flex-direction:column}
    #uxQuick textarea{width:100%;min-height:86px;background:var(--bg,#f4f4f4);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:10px;padding:10px;font-size:16px}
    #uxQuick .qh{display:flex;justify-content:space-between;align-items:center;font-weight:800;gap:8px}
    #uxQuick .qr{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:8px}
    #uxQuick select,#uxQuick input{width:100%}
    #uxQuick button{border:1px solid var(--line,#ddd);background:var(--bg,#f4f4f4);color:var(--ink,#111);border-radius:10px;padding:8px 10px;font-weight:700}
    @media(min-width:821px){#uxQuick{left:auto;right:18px;width:390px}}
  `;
  document.head.appendChild(css);

  const quick = document.createElement('div');
  quick.id = 'uxQuick';
  quick.innerHTML = `
    <div class="qh"><span id="uxTitle">Editar texto</span><button id="uxClose">Fechar</button></div>
    <textarea id="uxText" placeholder="Digite aqui..."></textarea>
    <div class="qr">
      <label>Fonte<select id="uxFont">${fontOptions.map(([v,n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
      <label>Cor<input id="uxFill" type="color"></label>
      <label>Contorno<input id="uxStroke" type="color"></label>
    </div>
    <label id="uxSizeLabel">Tamanho da linha<input id="uxSize" type="range" min="2" max="24" step=".1"></label>
    <div style="font-size:12px;opacity:.75">Toque no texto da imagem/vídeo para editar. Arraste com 1 dedo. Use os cantos azuis ou pinça com 2 dedos para aumentar/diminuir.</div>`;
  document.body.appendChild(quick);
  const qText = document.getElementById('uxText');
  const qFont = document.getElementById('uxFont');
  const qFill = document.getElementById('uxFill');
  const qStroke = document.getElementById('uxStroke');
  const qSize = document.getElementById('uxSize');
  document.getElementById('uxClose').onclick = () => quick.classList.remove('on');

  function ensureLines(L){
    if (!L || L.img) return [];
    const arr = (L.text || '').split('\n');
    if (!Array.isArray(L.lineSizes)) L.lineSizes = [];
    while (L.lineSizes.length < arr.length) L.lineSizes.push(L.size || 6);
    if (L.lineSizes.length > arr.length) L.lineSizes.length = arr.length;
    return arr;
  }
  function current(){ return sel >= 0 ? layers[sel] : null; }
  function updateSizeLabels(){
    const label = sizeEl.closest('label');
    if (label && label.firstChild) label.firstChild.textContent = `Tamanho da linha ${S.line + 1} `;
    const ql = document.getElementById('uxSizeLabel');
    if (ql && ql.firstChild) ql.firstChild.textContent = `Linha ${S.line + 1} `;
  }
  function syncQuick(focus){
    const L = current();
    if (!L || L.img) { quick.classList.remove('on'); return; }
    const lines = ensureLines(L);
    S.line = Math.max(0, Math.min(S.line, Math.max(0, lines.length - 1)));
    qText.value = L.text || '';
    qFont.value = fontOptions.some(x => x[0] === L.font) ? L.font : 'sans-serif-black';
    qFill.value = L.fill || '#ffffff';
    qStroke.value = L.stroke || '#000000';
    qSize.value = L.lineSizes[S.line] || L.size || 6;
    updateSizeLabels();
    quick.classList.add('on');
    if (focus) setTimeout(() => { qText.focus(); qText.setSelectionRange(qText.value.length,qText.value.length); }, 60);
  }
  function syncPanel(){
    const L = current();
    if (!L || L.img) return;
    ensureLines(L);
    txEl.value = L.text || '';
    if (fontEl) fontEl.value = fontOptions.some(x => x[0] === L.font) ? L.font : 'sans-serif-black';
    if (fillEl) fillEl.value = L.fill || '#ffffff';
    if (strokeEl) strokeEl.value = L.stroke || '#000000';
    sizeEl.max = 24;
    sizeEl.value = L.lineSizes[S.line] || L.size || 6;
    updateSizeLabels();
  }

  const oldSelect = select;
  select = function(i){ oldSelect(i); if (i < 0) { quick.classList.remove('on'); S.line = 0; } else { S.line = Math.min(S.line, Math.max(0, ensureLines(layers[i]).length - 1)); syncPanel(); } };

  txEl.oninput = () => {
    const L = current(); if (!L || L.img) return;
    L.text = txEl.value; ensureLines(L); renderLayers(); qText.value = L.text; syncPanel();
  };
  if (fontEl) fontEl.oninput = () => { const L=current(); if(!L||L.img)return; L.font=fontEl.value; qFont.value=L.font; };
  if (fillEl) fillEl.oninput = () => { const L=current(); if(!L||L.img)return; L.fill=fillEl.value; qFill.value=L.fill; };
  if (strokeEl) strokeEl.oninput = () => { const L=current(); if(!L||L.img)return; L.stroke=strokeEl.value; qStroke.value=L.stroke; };
  sizeEl.oninput = () => { const L=current(); if(!L)return; if(L.img){L.size=+sizeEl.value;return;} ensureLines(L); L.lineSizes[S.line]=+sizeEl.value; qSize.value=L.lineSizes[S.line]; };

  qText.oninput = () => { const L=current(); if(!L||L.img)return; L.text=qText.value; ensureLines(L); txEl.value=L.text; renderLayers(); syncPanel(); };
  qFont.oninput = () => { const L=current(); if(!L||L.img)return; L.font=qFont.value; if(fontEl)fontEl.value=L.font; };
  qFill.oninput = () => { const L=current(); if(!L||L.img)return; L.fill=qFill.value; if(fillEl)fillEl.value=L.fill; };
  qStroke.oninput = () => { const L=current(); if(!L||L.img)return; L.stroke=qStroke.value; if(strokeEl)strokeEl.value=L.stroke; };
  qSize.oninput = () => { const L=current(); if(!L||L.img)return; ensureLines(L); L.lineSizes[S.line]=+qSize.value; sizeEl.value=L.lineSizes[S.line]; };

  function handle(x,y){ ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fillStyle='#00b4ff'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); }
  draw = function(){
    if(media){
      const W=cv.width,H=cv.height;
      ctx.clearRect(0,0,W,H);
      try{ctx.drawImage(media,0,0,W,H)}catch(e){}
      layers.forEach((L,i)=>{
        if(L.img){
          const w=L.size/100*W,h=w*L.img.naturalHeight/L.img.naturalWidth;
          const x=L.x*W-w/2,y=L.y*H-h/2;
          try{ctx.drawImage(L.img,x,y,w,h)}catch(e){}
          L.box={x,y,w,h}; L.hitBox={x:x-24,y:y-24,w:w+48,h:h+48};
          if(i===sel&&!exporting){ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='#00b4ff';ctx.lineWidth=2;ctx.strokeRect(L.hitBox.x,L.hitBox.y,L.hitBox.w,L.hitBox.h);handle(L.hitBox.x,L.hitBox.y);handle(L.hitBox.x+L.hitBox.w,L.hitBox.y);handle(L.hitBox.x,L.hitBox.y+L.hitBox.h);handle(L.hitBox.x+L.hitBox.w,L.hitBox.y+L.hitBox.h);ctx.restore()}
          return;
        }
        const lines=ensureLines(L), metrics=[];
        lines.forEach((ln,j)=>{const fs=(L.lineSizes[j]||L.size||6)/100*W;ctx.font=`800 ${fs}px "${L.font||'sans-serif-black'}",sans-serif`;metrics.push({ln,fs,w:Math.max(18,ctx.measureText(ln||' ').width),h:Math.max(30,fs*1.2)});});
        const totalH=metrics.reduce((a,m)=>a+m.h,0); let cy=L.y*H-totalH/2; L.lineBoxes=[];
        ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
        let minX=Infinity,maxX=-Infinity;
        metrics.forEach((m,j)=>{const x=L.x*W,y=cy+m.h/2;cy+=m.h;ctx.font=`800 ${m.fs}px "${L.font||'sans-serif-black'}",sans-serif`;
          if(L.sw>0){ctx.shadowColor='transparent';ctx.lineWidth=L.sw*m.fs/30;ctx.strokeStyle=L.stroke;ctx.strokeText(m.ln,x,y)}
          if(L.sh>0){ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=L.sh*m.fs/12;ctx.shadowOffsetX=ctx.shadowOffsetY=L.sh*m.fs/40}
          ctx.fillStyle=L.fill;ctx.fillText(m.ln,x,y);ctx.shadowColor='transparent';
          const iw=Math.max(170,m.w+60), ih=Math.max(64,m.h+32), b={x:x-iw/2,y:y-ih/2,w:iw,h:ih}; L.lineBoxes[j]=b; minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x+b.w);
          if(i===sel&&j===S.line&&!exporting){ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='#00b4ff';ctx.lineWidth=2;ctx.strokeRect(b.x,b.y,b.w,b.h);handle(b.x,b.y);handle(b.x+b.w,b.y);handle(b.x,b.y+b.h);handle(b.x+b.w,b.y+b.h);ctx.restore()}
        });
        L.box={x:isFinite(minX)?minX:L.x*W-85,y:L.y*H-totalH/2-16,w:isFinite(maxX)?Math.max(170,maxX-minX):170,h:Math.max(64,totalH+32)};ctx.restore();
      });
    }
    requestAnimationFrame(draw);
  };

  const point = e => { const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height}; };
  const inside=(p,b)=>b&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
  const nearCorner=(p,b)=>{if(!b)return false;return [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].some(([x,y])=>Math.hypot(p.x-x,p.y-y)<30)};
  const hit=p=>{for(let i=layers.length-1;i>=0;i--){const L=layers[i];if(!L.img&&L.lineBoxes){for(let j=L.lineBoxes.length-1;j>=0;j--)if(inside(p,L.lineBoxes[j]))return{i,j,b:L.lineBoxes[j]};}if(inside(p,L.hitBox||L.box))return{i,j:0,b:L.hitBox||L.box};}return null;};
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

  cv.onpointerdown=e=>{
    const p=point(e);S.pointers.set(e.pointerId,p);try{cv.setPointerCapture(e.pointerId)}catch(_){}
    const h=hit(p);
    if(h){
      S.line=h.j; oldSelect(h.i); syncPanel(); syncQuick(true);
      const L=current(), b=L.img?(L.hitBox||L.box):(L.lineBoxes[S.line]||L.box);
      if(nearCorner(p,b)){S.resize={id:e.pointerId,base:L.img?L.size:(L.lineSizes[S.line]||L.size),cx:b.x+b.w/2,cy:b.y+b.h/2,start:Math.max(20,Math.hypot(p.x-(b.x+b.w/2),p.y-(b.y+b.h/2)))};S.drag=null;}
      else{S.drag={id:e.pointerId,dx:p.x-L.x*cv.width,dy:p.y-L.y*cv.height};S.resize=null;}
    }else{oldSelect(-1);quick.classList.remove('on');S.drag=null;S.resize=null;}
    if(S.pointers.size===2&&sel>=0){const [a,b]=[...S.pointers.values()],L=current();ensureLines(L);S.pinch={start:d(a,b),base:L.img?L.size:(L.lineSizes[S.line]||L.size)};S.drag=null;S.resize=null;}
  };
  cv.onpointermove=e=>{
    if(!S.pointers.has(e.pointerId))return;const p=point(e);S.pointers.set(e.pointerId,p);const L=current();if(!L)return;
    if(S.pinch&&S.pointers.size>=2){const [a,b]=[...S.pointers.values()],ratio=d(a,b)/Math.max(1,S.pinch.start),n=Math.max(L.img?5:2,Math.min(L.img?100:24,S.pinch.base*ratio));if(L.img)L.size=n;else{ensureLines(L);L.lineSizes[S.line]=n;sizeEl.value=n;qSize.value=n;}return;}
    if(S.resize&&S.resize.id===e.pointerId){const now=Math.hypot(p.x-S.resize.cx,p.y-S.resize.cy),ratio=now/S.resize.start,n=Math.max(L.img?5:2,Math.min(L.img?100:24,S.resize.base*ratio));if(L.img)L.size=n;else{ensureLines(L);L.lineSizes[S.line]=n;sizeEl.value=n;qSize.value=n;}return;}
    if(S.drag&&S.drag.id===e.pointerId){L.x=Math.max(0,Math.min(1,(p.x-S.drag.dx)/cv.width));L.y=Math.max(0,Math.min(1,(p.y-S.drag.dy)/cv.height));}
  };
  const end=e=>{S.pointers.delete(e.pointerId);if(S.pointers.size<2)S.pinch=null;if(S.drag&&S.drag.id===e.pointerId)S.drag=null;if(S.resize&&S.resize.id===e.pointerId)S.resize=null;};
  cv.onpointerup=end;cv.onpointercancel=end;

  preset = function(){
    const defs=[
      {text:'Sobrado à Venda\nBalneário Camboriú',font:'sans-serif-black',size:6.6,fill:YEL,y:.17,sw:3,sh:4},
      {text:'02 Dormitórios\n02 Banheiros\n01 Vaga garagem privativa\n55,06 área privativa\nÁrea de Lazer Completa',font:'sans-serif-black',size:5,fill:'#ffffff',y:.34,sw:3,sh:4},
      {text:'R$ 780.000,00',font:'sans-serif-black',size:9,fill:YEL,y:.5,sw:3,sh:4}
    ];
    let texts=layers.filter(L=>!L.img);
    while(texts.length<3){const d=defs[texts.length];layers.push(mk({text:d.text}));texts=layers.filter(L=>!L.img);}
    texts.slice(0,3).forEach((L,i)=>{const d=defs[i];if(!L.text||!L.text.trim())L.text=d.text;L.font=d.font;L.size=d.size;L.fill=d.fill;L.stroke='#000000';L.sw=d.sw;L.sh=d.sh;L.x=.5;L.y=d.y;L.lineSizes=(L.text||'').split('\n').map(()=>d.size);});
    S.line=0;oldSelect(layers.indexOf(texts[0]));syncPanel();syncQuick(true);
  };

  layers.forEach(L=>{if(!L.img){if(!fontOptions.some(x=>x[0]===L.font))L.font='sans-serif-black';ensureLines(L);}});
})();
