/* ═══════════════════════════════════════
   MULTILABEL - YOLO ANNOTATION TOOL
   Application JavaScript
   ═══════════════════════════════════════ */

// ═══════════════════════════════════════
// PALETTE – 24 distinct colors
// ═══════════════════════════════════════
const PAL = [
  '#FF4F6D','#5B8CFF','#3DDC84','#FFB300','#C77DFF',
  '#00C9FF','#FF7C40','#AAFF3E','#FF40C8','#40FFD6',
  '#FF8080','#80B0FF','#80FFB0','#FFD080','#D080FF',
  '#80E8FF','#FFA870','#D8FF80','#FF80E0','#80FFE8',
  '#FF6060','#6090FF','#60E070','#FFC060','#B060FF',
];
const pc = id => PAL[id % PAL.length];

// ═══════════════════════════════════════
// ZOOM / PAN STATE
// ═══════════════════════════════════════
const VP = {
  scale: 1,
  ox: 0,        // viewport translate X
  oy: 0,        // viewport translate Y
  panMode: false,
  spaceDown: false,
  middleDown: false,
  panStart: null,
  panOrigin: null,
  MIN_SCALE: 0.1,
  MAX_SCALE: 16,
};

const viewport   = document.getElementById('zoom-viewport');
const canvasWrap = document.getElementById('canvas-wrap');
const zoomHud    = document.getElementById('zoom-hud');
const zoomLabel  = document.getElementById('zoom-label');

function applyTransform(){
  viewport.style.transform = `translate(${VP.ox}px,${VP.oy}px) scale(${VP.scale})`;
  const pct = Math.round(VP.scale * 100) + '%';
  zoomHud.textContent  = pct;
  zoomLabel.textContent = pct;
}

function zoomBy(delta, cx, cy){
  const rect = canvasWrap.getBoundingClientRect();
  if(cx===undefined){ cx = rect.width/2;  cy = rect.height/2; }
  const newScale = Math.min(VP.MAX_SCALE, Math.max(VP.MIN_SCALE, VP.scale * (1 + delta)));
  const factor = newScale / VP.scale;
  VP.ox = cx - factor*(cx - VP.ox);
  VP.oy = cy - factor*(cy - VP.oy);
  VP.scale = newScale;
  applyTransform();
}

function zoomTo(s){
  VP.scale = Math.min(VP.MAX_SCALE, Math.max(VP.MIN_SCALE, s));
  applyTransform();
}

function fitToView(){
  if(S.imgIdx < 0) return;
  const wRect = canvasWrap.getBoundingClientRect();
  const iw = S.imgW, ih = S.imgH;
  if(!iw || !ih) return;
  const pad = 20;
  const scaleX = (wRect.width  - pad*2) / iw;
  const scaleY = (wRect.height - pad*2) / ih;
  VP.scale = Math.min(scaleX, scaleY, VP.MAX_SCALE);
  VP.ox = (wRect.width  - iw * VP.scale) / 2;
  VP.oy = (wRect.height - ih * VP.scale) / 2;
  applyTransform();
}

function togglePanMode(){
  VP.panMode = !VP.panMode;
  const btn = document.getElementById('btn-pan');
  btn.style.background   = VP.panMode ? 'var(--warn)'   : '';
  btn.style.borderColor  = VP.panMode ? 'var(--warn)'   : '';
  btn.style.color        = VP.panMode ? '#000'           : '';
  canvasWrap.style.cursor = VP.panMode ? 'grab' : '';
}

function clientToImg(cx, cy){
  const wRect = canvasWrap.getBoundingClientRect();
  const wx = cx - wRect.left;
  const wy = cy - wRect.top;
  return {
    x: (wx - VP.ox) / VP.scale,
    y: (wy - VP.oy) / VP.scale,
  };
}

function isPanning(){ return VP.panMode || VP.spaceDown || VP.middleDown; }

// ── Wheel zoom ──────────────────────────────────────────────────
canvasWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvasWrap.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const delta = e.deltaY < 0 ? 0.15 : -0.15;
  if(e.shiftKey){
    VP.ox -= e.deltaY * 0.5;
    applyTransform();
  } else {
    zoomBy(delta, cx, cy);
  }
}, {passive:false});

// ── Middle mouse pan ────────────────────────────────────────────
canvasWrap.addEventListener('mousedown', e => {
  if(e.button === 1){
    e.preventDefault();
    VP.middleDown = true;
    VP.panStart   = {x:e.clientX, y:e.clientY};
    VP.panOrigin  = {ox:VP.ox, oy:VP.oy};
    canvasWrap.classList.add('panning');
  }
});

// ── Space bar pan ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if(e.code === 'Space' && !['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){
    e.preventDefault();
    if(!VP.spaceDown){
      VP.spaceDown = true;
      canvasWrap.style.cursor = 'grab';
    }
  }
}, true);
document.addEventListener('keyup', e => {
  if(e.code === 'Space'){
    VP.spaceDown = false;
    if(!VP.panMode) canvasWrap.style.cursor = '';
  }
});

// ═══════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════
const S = {
  sessions: [],
  sessIdx: -1,
  images: [],
  classes: [],
  imgIdx: -1,
  sessionFolder: null,
  boxes: [],
  selBox: -1,
  drawing:false, drawStart:null, drawRect:null,
  editMode:null, editIdx:-1, editAnchor:null,
  imgW:1, imgH:1,
  dirty:false,
  labeledSet: new Set(),
};

// ═══════════════════════════════════════
// CANVAS SETUP
// ═══════════════════════════════════════
const canvas = document.getElementById('label-canvas');
const ctx    = canvas.getContext('2d');
const imgEl  = document.getElementById('bg-img');
const wrap   = document.getElementById('canvas-container');

imgEl.addEventListener('load', ()=>{
  S.imgW=imgEl.naturalWidth; S.imgH=imgEl.naturalHeight;
  canvas.width=S.imgW; canvas.height=S.imgH;
  imgEl.width=S.imgW; imgEl.height=S.imgH;
  redraw();
  setTimeout(fitToView,40);
});
window.addEventListener('resize',()=>{ if(S.imgIdx>=0) fitToView(); });

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const normR=(x1,y1,x2,y2)=>({x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1)});

function hitBox(px,py){
  for(let i=S.boxes.length-1;i>=0;i--){
    const b=S.boxes[i];
    if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h) return i;
  }
  return -1;
}
function hs(){ return 7/VP.scale; }
function getHandle(b,px,py){
  const h=hs();
  const pts=[
    {n:'nw',x:b.x,y:b.y},{n:'ne',x:b.x+b.w,y:b.y},
    {n:'sw',x:b.x,y:b.y+b.h},{n:'se',x:b.x+b.w,y:b.y+b.h},
    {n:'n',x:b.x+b.w/2,y:b.y},{n:'s',x:b.x+b.w/2,y:b.y+b.h},
    {n:'w',x:b.x,y:b.y+b.h/2},{n:'e',x:b.x+b.w,y:b.y+b.h/2},
  ];
  for(const pt of pts) if(Math.abs(px-pt.x)<=h&&Math.abs(py-pt.y)<=h) return pt.n;
  return null;
}

// ═══════════════════════════════════════
// CANVAS MOUSE EVENTS
// ═══════════════════════════════════════
canvasWrap.addEventListener('mousedown', e=>{
  if(e.button===1) return;
  if(isPanning()&&e.button===0){
    VP.panStart={x:e.clientX,y:e.clientY};
    VP.panOrigin={ox:VP.ox,oy:VP.oy};
    canvasWrap.classList.add('panning'); return;
  }
  if(S.imgIdx<0||!S.sessionFolder) return;
  const {x,y}=clientToImg(e.clientX,e.clientY);
  if(x<0||y<0||x>S.imgW||y>S.imgH) return;
  if(S.selBox>=0){
    const h=getHandle(S.boxes[S.selBox],x,y);
    if(h){ S.editMode='resize'; S.editIdx=S.selBox;
      const b=S.boxes[S.selBox];
      S.editAnchor={h,ox:x,oy:y,bx:b.x,by:b.y,bw:b.w,bh:b.h}; return; }
  }
  const hit=hitBox(x,y);
  if(hit>=0){
    S.selBox=hit; const b=S.boxes[hit];
    S.editMode='move'; S.editIdx=hit;
    S.editAnchor={ox:x,oy:y,bx:b.x,by:b.y};
    redraw(); renderAnnList(); return;
  }
  S.selBox=-1; S.drawing=true; S.drawStart={x,y}; S.drawRect=null;
});

window.addEventListener('mousemove', e=>{
  if(VP.panStart&&(isPanning()||VP.middleDown)){
    VP.ox=VP.panOrigin.ox+(e.clientX-VP.panStart.x);
    VP.oy=VP.panOrigin.oy+(e.clientY-VP.panStart.y);
    applyTransform(); return;
  }
  if(S.imgIdx<0) return;
  const {x,y}=clientToImg(e.clientX,e.clientY);
  if(S.editMode==='move'&&S.editAnchor){
    const b=S.boxes[S.editIdx];
    b.x=clamp(S.editAnchor.bx+(x-S.editAnchor.ox),0,S.imgW-b.w);
    b.y=clamp(S.editAnchor.by+(y-S.editAnchor.oy),0,S.imgH-b.h);
    S.dirty=true; redraw(); return;
  }
  if(S.editMode==='resize'&&S.editAnchor){
    const a=S.editAnchor; let {bx,by,bw,bh}=a;
    const dx=x-a.ox,dy=y-a.oy,h=a.h;
    if(h.includes('e')) bw=Math.max(2/VP.scale,bw+dx);
    if(h.includes('s')) bh=Math.max(2/VP.scale,bh+dy);
    if(h.includes('w')){bx+=dx;bw=Math.max(2/VP.scale,bw-dx)}
    if(h.includes('n')){by+=dy;bh=Math.max(2/VP.scale,bh-dy)}
    const b=S.boxes[S.editIdx]; b.x=bx;b.y=by;b.w=bw;b.h=bh;
    S.dirty=true; redraw(); return;
  }
  if(S.drawing&&S.drawStart){ S.drawRect=normR(S.drawStart.x,S.drawStart.y,x,y); redraw(); return; }
  if(isPanning()){ canvasWrap.style.cursor='grab'; return; }
  const cmap={n:'n-resize',s:'s-resize',e:'e-resize',w:'w-resize',
    ne:'ne-resize',nw:'nw-resize',se:'se-resize',sw:'sw-resize'};
  if(S.selBox>=0&&x>=0&&y>=0&&x<=S.imgW&&y<=S.imgH){
    const h=getHandle(S.boxes[S.selBox],x,y);
    canvas.style.cursor=h?cmap[h]:(hitBox(x,y)>=0?'move':'crosshair');
  } else { canvas.style.cursor=hitBox(x,y)>=0?'move':'crosshair'; }
});

window.addEventListener('mouseup', e=>{
  if(VP.panStart&&(isPanning()||e.button===1)){
    VP.panStart=null; VP.panOrigin=null;
    if(e.button===1) VP.middleDown=false;
    canvasWrap.classList.remove('panning');
    if(!VP.panMode&&!VP.spaceDown) canvasWrap.style.cursor='';
    return;
  }
  if(S.editMode){ S.editMode=null; S.editAnchor=null; renderAnnList(); return; }
  if(!S.drawing) return;
  S.drawing=false;
  if(!S.drawRect) return;
  const r=S.drawRect, minPx=4/VP.scale;
  if(r.w<minPx||r.h<minPx){ S.drawRect=null; redraw(); return; }
  const cls=activeCls();
  S.boxes.push({x:r.x,y:r.y,w:r.w,h:r.h,class_id:cls.id,class_name:cls.name,conf:null});
  S.selBox=S.boxes.length-1; S.drawRect=null; S.dirty=true;
  redraw(); renderAnnList(); updateStats();
  document.getElementById('btn-undo').disabled=false;
});

// ═══════════════════════════════════════
// DRAW
// ═══════════════════════════════════════
function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const lw=1.5/VP.scale, lwS=2.5/VP.scale, hSize=hs();
  S.boxes.forEach((b,i)=>{
    const col=pc(b.class_id), sel=i===S.selBox;
    ctx.fillStyle=col; ctx.globalAlpha=sel?.18:.1;
    ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.globalAlpha=sel?1:.9;
    ctx.strokeStyle=col; ctx.lineWidth=sel?lwS:lw; ctx.setLineDash([]);
    ctx.strokeRect(b.x,b.y,b.w,b.h);
    const cl=Math.min(16/VP.scale,b.w*.25,b.h*.25);
    ctx.lineWidth=sel?lwS:lw; ctx.globalAlpha=1;
    [[b.x,b.y,1,1],[b.x+b.w,b.y,-1,1],[b.x,b.y+b.h,1,-1],[b.x+b.w,b.y+b.h,-1,-1]]
      .forEach(([px,py,sx,sy])=>{
        ctx.beginPath(); ctx.moveTo(px+sx*cl,py); ctx.lineTo(px,py); ctx.lineTo(px,py+sy*cl); ctx.stroke();
      });
    const fs=Math.max(10,Math.min(14,11/VP.scale));
    const conf=b.conf!=null?` ${(b.conf*100).toFixed(0)}%`:'';
    const label=`${b.class_id}:${b.class_name}${conf}`;
    ctx.font=`bold ${fs}px JetBrains Mono,monospace`;
    const tw=ctx.measureText(label).width;
    const bh2=fs+4, bw2=tw+8/VP.scale;
    const lx=clamp(b.x,0,S.imgW-bw2);
    const ly=b.y>=(bh2+2)/VP.scale?b.y-2/VP.scale:b.y+b.h+bh2/VP.scale+2/VP.scale;
    ctx.fillStyle=col; ctx.globalAlpha=.9;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(lx-2/VP.scale,ly-bh2+2/VP.scale,bw2,bh2,2/VP.scale);
    else ctx.rect(lx-2/VP.scale,ly-bh2+2/VP.scale,bw2,bh2);
    ctx.fill();
    ctx.fillStyle='#000'; ctx.globalAlpha=1;
    ctx.fillText(label,lx+2/VP.scale,ly);
    if(sel){
      [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h],
       [b.x+b.w/2,b.y],[b.x+b.w/2,b.y+b.h],[b.x,b.y+b.h/2],[b.x+b.w,b.y+b.h/2]]
      .forEach(([hx,hy])=>{
        ctx.fillStyle='#fff'; ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.globalAlpha=1;
        ctx.beginPath(); ctx.rect(hx-hSize,hy-hSize,hSize*2,hSize*2); ctx.fill(); ctx.stroke();
      });
    }
    ctx.globalAlpha=1;
  });
  if(S.drawRect){
    const r=S.drawRect, col=pc(activeCls().id);
    ctx.setLineDash([5/VP.scale,3/VP.scale]); ctx.strokeStyle=col;
    ctx.lineWidth=lw; ctx.globalAlpha=.7;
    ctx.strokeRect(r.x,r.y,r.w,r.h);
    ctx.fillStyle=col; ctx.globalAlpha=.08; ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.setLineDash([]); ctx.globalAlpha=1;
  }
}

// ═══════════════════════════════════════
// FILE BROWSER
// ═══════════════════════════════════════
let _browserPath = null;

function openBrowser(){
  document.getElementById('browser-overlay').classList.add('open');
  browseDir(S.sessionFolder || '~');
}
function closeBrowser(){
  document.getElementById('browser-overlay').classList.remove('open');
}
async function browseDir(path){
  document.getElementById('browser-path-input').value = path;
  try{
    const r=await post('/api/browse',{path});
    if(!r.ok){ showToast(await r.text(),'err'); return; }
    const data=await r.json();
    _browserPath=data.current;
    renderBrowserEntries(data);
  }catch(err){ showToast(err.message,'err'); }
}
function renderBrowserEntries(data){
  const list=document.getElementById('browser-entries');
  list.innerHTML='';
  const st=document.getElementById('browser-status');
  st.textContent=`Current: ${data.current}  ·  ${data.direct_images} direct image${data.direct_images!==1?'s':''}`;
  const canLoad = data.direct_images>0 || data.entries.some(e=>e.has_images);
  document.getElementById('btn-load-ds').disabled=!canLoad;

  data.entries.forEach(e=>{
    const row=document.createElement('div');
    const hasData=e.has_images;
    row.className='b-row'+(hasData?' has-data':'');
    const icon=e.type==='parent'?'↩ ..':e.direct_images>0?'🖼':'📁';
    const meta=e.direct_images>0
      ?`${e.direct_images} img`
      :e.nested_images>0?`${e.nested_images} img (sub)`:'';
    row.innerHTML=`
      <span class="b-icon">${icon}</span>
      <span class="b-name">${e.type==='parent'?'Parent Directory':e.name}</span>
      <span class="b-meta">${meta}</span>
      ${hasData?`<span class="b-tag">${e.direct_images||e.nested_images} imgs</span>`:''}
    `;
    row.addEventListener('click', ()=>{
      list.querySelectorAll('.b-row').forEach(r=>r.classList.remove('selected-row'));
      row.classList.add('selected-row');
      _browserPath=e.path;
      document.getElementById('browser-path-input').value=e.path;
      document.getElementById('browser-status').textContent=`Selected: ${e.name}`;
      document.getElementById('btn-load-ds').disabled=!e.has_images;
    });
    row.addEventListener('dblclick', ()=>browseDir(e.path));
    list.appendChild(row);
  });
}
async function loadSelectedDataset(){
  if(!_browserPath) return;
  closeBrowser();
  await loadDataset(_browserPath);
}
document.getElementById('browser-path-input').addEventListener('keydown', e=>{
  if(e.key==='Enter') browseDir(e.target.value);
});

// ═══════════════════════════════════════
// DATASET LOAD
// ═══════════════════════════════════════
async function loadDataset(path){
  showToast('Scanning…','info');
  try{
    const r=await post('/api/load_dataset',{folder:path});
    if(!r.ok){ const t=await r.text(); showToast(t,'err'); return; }
    const data=await r.json();
    S.sessions=data.sessions;
    S.sessIdx=-1; S.imgIdx=-1; S.boxes=[]; S.selBox=-1;
    S.labeledSet=new Set();

    document.getElementById('path-display').textContent=`📂  ${data.root}`;
    document.getElementById('welcome').style.display='none';
    document.getElementById('sess-cnt').textContent=data.sessions.length;
    document.getElementById('sb-folder').textContent=data.root_name;
    document.getElementById('sb-labeled').textContent=`${data.total_labeled}/${data.total_images}`;

    renderSessionList();
    if(data.sessions.length>0) selectSession(0);
    showToast(`Loaded ${data.sessions.length} session${data.sessions.length!==1?'s':''}, ${data.total_images} images`,'ok');
    localStorage.setItem('ml_last_path', path);
  }catch(err){ showToast(err.message,'err'); }
}

// ═══════════════════════════════════════
// SESSION
// ═══════════════════════════════════════
function renderSessionList(){
  const list=document.getElementById('session-list');
  list.innerHTML='';
  S.sessions.forEach((s,i)=>{
    const el=document.createElement('div');
    el.className='sess-item';
    const pct=s.total?Math.round(s.labeled/s.total*100):0;
    el.innerHTML=`
      <div class="sess-name">${s.name}</div>
      <div class="sess-meta">${s.labeled}/${s.total} · ${s.classes.length} cls</div>
      <div class="sess-prog"><div class="sess-prog-fill" style="width:${pct}%"></div></div>
    `;
    el.addEventListener('click',()=>selectSession(i));
    list.appendChild(el);
  });
}
function selectSession(i){
  S.sessIdx=i;
  const s=S.sessions[i];
  S.sessionFolder=s.folder;
  S.images=s.images;
  S.classes=s.classes.length?s.classes:['object'];
  S.imgIdx=-1; S.boxes=[]; S.selBox=-1; S.dirty=false;
  S.labeledSet=new Set();

  document.querySelectorAll('.sess-item').forEach((el,j)=>el.classList.toggle('active',j===i));
  document.getElementById('img-total-cnt').textContent=s.images.length;
  document.getElementById('btn-save-cls').disabled=false;

  buildClassUI();
  renderImgList();

  if(s.images.length>0) selectImage(0);
}

// ═══════════════════════════════════════
// IMAGE LIST
// ═══════════════════════════════════════
function renderImgList(){
  const list=document.getElementById('img-list');
  list.innerHTML='';
  S.images.forEach((fn,i)=>{
    const el=document.createElement('div');
    el.className='img-item'; el.dataset.idx=i;
    el.innerHTML=`<div class="i-dot"></div><span class="i-name">${fn}</span><span class="i-cnt"></span>`;
    el.addEventListener('click',()=>{ if(S.dirty) saveLabels().then(()=>selectImage(i)); else selectImage(i); });
    list.appendChild(el);
    fetch(`/api/labels?folder=${enc(S.sessionFolder)}&filename=${enc(fn)}`)
      .then(r=>r.json()).then(d=>{
        if(!document.querySelector(`.img-item[data-idx="${i}"]`)) return;
        const cnt=d.boxes.length;
        if(cnt>0){ el.classList.add('labeled'); S.labeledSet.add(i); }
        el.querySelector('.i-cnt').textContent=cnt||'';
      });
  });
}
function filterImgs(q){
  document.querySelectorAll('.img-item').forEach(el=>{
    const fn=S.images[el.dataset.idx]||'';
    el.style.display=fn.toLowerCase().includes(q.toLowerCase())?'':'none';
  });
}

// ═══════════════════════════════════════
// IMAGE LOAD
// ═══════════════════════════════════════
async function selectImage(idx){
  if(S.dirty) await saveLabels();
  S.imgIdx=idx;
  const fn=S.images[idx];

  document.querySelectorAll('.img-item').forEach((el,i)=>el.classList.toggle('active',i===idx));
  document.getElementById('btn-prev').disabled=idx<=0;
  document.getElementById('btn-next').disabled=idx>=S.images.length-1;
  document.getElementById('nav-info').textContent=`${idx+1} / ${S.images.length}`;
  document.getElementById('btn-save').disabled=false;
  document.getElementById('btn-clear').disabled=false;

  try{
    const [ir,lr]=await Promise.all([
      fetch(`/api/image?folder=${enc(S.sessionFolder)}&filename=${enc(fn)}`),
      fetch(`/api/labels?folder=${enc(S.sessionFolder)}&filename=${enc(fn)}`),
    ]);
    if(!ir.ok) throw new Error(`Image not found: ${fn}`);
    const id=await ir.json(), ld=await lr.json();

    ld.boxes.forEach(b=>{
      while(S.classes.length<=b.class_id) S.classes.push(`class_${S.classes.length}`);
    });
    buildClassUI();

    imgEl.src=id.data;
    wrap.style.display='inline-block';
    document.getElementById('canvas-container').style.display='inline-block';
    await new Promise(res=>{ imgEl.onload=res; if(imgEl.complete&&imgEl.naturalWidth) res(); });

    S.imgW=imgEl.naturalWidth; S.imgH=imgEl.naturalHeight;

    S.boxes=ld.boxes.map(b=>({
      x:(b.cx-b.bw/2)*S.imgW,
      y:(b.cy-b.bh/2)*S.imgH,
      w:b.bw*S.imgW,
      h:b.bh*S.imgH,
      class_id:b.class_id,
      class_name:b.class_name,
      conf:b.conf??null,
    }));
    S.selBox=-1; S.dirty=false;

    canvas.width=S.imgW; canvas.height=S.imgH;
    imgEl.width=S.imgW; imgEl.height=S.imgH;
    redraw(); renderAnnList(); updateStats();
    setTimeout(fitToView,30);
    document.getElementById('sb-img').textContent=fn;
    document.getElementById('sb-size').textContent=`${S.imgW}×${S.imgH}`;
    document.getElementById('btn-undo').disabled=S.boxes.length===0;

    const el=document.querySelector(`.img-item[data-idx="${idx}"]`);
    if(el) el.scrollIntoView({block:'nearest'});
  }catch(err){ showToast(err.message,'err'); }
}
function navigate(dir){
  const n=S.imgIdx+dir;
  if(n<0||n>=S.images.length) return;
  selectImage(n);
}

// ═══════════════════════════════════════
// SAVE
// ═══════════════════════════════════════
async function saveLabels(){
  if(!S.sessionFolder||S.imgIdx<0) return;
  const fn=S.images[S.imgIdx];
  try{
    const r=await post('/api/labels',{
      folder:S.sessionFolder, filename:fn, labels:S.boxes,
      img_width:S.imgW, img_height:S.imgH,
    });
    if(!r.ok) throw new Error(await r.text());
    S.dirty=false;
    const el=document.querySelector(`.img-item[data-idx="${S.imgIdx}"]`);
    if(el){
      el.classList.toggle('labeled',S.boxes.length>0);
      const cnt=el.querySelector('.i-cnt');
      if(cnt) cnt.textContent=S.boxes.length||'';
    }
    if(S.boxes.length>0) S.labeledSet.add(S.imgIdx); else S.labeledSet.delete(S.imgIdx);
    updateProgress();
    if(S.sessIdx>=0){
      S.sessions[S.sessIdx].labeled=S.labeledSet.size;
      renderSessionList();
      document.querySelectorAll('.sess-item')[S.sessIdx]?.classList.add('active');
    }
    showToast(`Saved ${S.boxes.length} box${S.boxes.length!==1?'es':''}`,'ok');
  }catch(err){ showToast(err.message,'err'); }
}

// ═══════════════════════════════════════
// ANN LIST
// ═══════════════════════════════════════
function renderAnnList(){
  const list=document.getElementById('ann-list');
  list.innerHTML='';
  S.boxes.forEach((b,i)=>{
    const col=pc(b.class_id);
    const el=document.createElement('div');
    el.className='ann-item'+(i===S.selBox?' sel':'');
    const confStr=b.conf!=null?`<span class="a-conf"> · ${(b.conf*100).toFixed(1)}%</span>`:'';
    el.innerHTML=`
      <div class="a-sw" style="background:${col}"></div>
      <div class="a-info">
        <div class="a-cls">${b.class_id}: ${b.class_name}${confStr}</div>
        <div class="a-meta">${Math.round(b.x)},${Math.round(b.y)}  ${Math.round(b.w)}×${Math.round(b.h)}</div>
      </div>
      <button class="a-del" title="Delete">×</button>
    `;
    el.addEventListener('click', e=>{
      if(e.target.classList.contains('a-del')) return;
      S.selBox=i; redraw(); renderAnnList();
    });
    el.querySelector('.a-del').addEventListener('click',()=>{
      S.boxes.splice(i,1);
      if(S.selBox>=S.boxes.length) S.selBox=-1;
      S.dirty=true; redraw(); renderAnnList(); updateStats();
    });
    list.appendChild(el);
  });
  document.getElementById('ann-cnt').textContent=S.boxes.length;
}

// ═══════════════════════════════════════
// CLASS UI
// ═══════════════════════════════════════
function activeCls(){
  const id=parseInt(document.getElementById('class-select').value)||0;
  return{id, name:S.classes[id]||`class_${id}`};
}
function onClassChange(){
  const id=parseInt(document.getElementById('class-select').value)||0;
  document.getElementById('active-dot').style.background=pc(id);
  document.querySelectorAll('.cls-row').forEach((r,i)=>r.classList.toggle('act',i===id));
  if(S.selBox>=0){
    S.boxes[S.selBox].class_id=id;
    S.boxes[S.selBox].class_name=S.classes[id]||`class_${id}`;
    S.dirty=true; redraw(); renderAnnList();
  }
}
function buildClassUI(){
  const sel=document.getElementById('class-select');
  const prev=parseInt(sel.value)||0;
  sel.innerHTML='';
  S.classes.forEach((c,i)=>{
    const o=document.createElement('option');
    o.value=i; o.textContent=`[${i}] ${c}`; sel.appendChild(o);
  });
  sel.value=Math.min(prev,S.classes.length-1)||0;
  onClassChange();
  renderClsList();
  document.getElementById('cls-cnt').textContent=S.classes.length;
}
function renderClsList(){
  const list=document.getElementById('cls-list');
  list.innerHTML='';
  const actId=parseInt(document.getElementById('class-select').value)||0;
  S.classes.forEach((c,i)=>{
    const row=document.createElement('div');
    row.className='cls-row'+(i===actId?' act':'');
    row.innerHTML=`
      <div class="c-sw" style="background:${pc(i)}"></div>
      <div class="c-id">${i}</div>
      <input class="c-inp" value="${c}" title="Click to rename">
      <button class="c-del" title="Remove">×</button>
    `;
    row.addEventListener('click', e=>{
      if(['c-del','c-inp'].some(cl=>e.target.classList.contains(cl))) return;
      document.getElementById('class-select').value=i; onClassChange();
    });
    const inp=row.querySelector('.c-inp');
    inp.addEventListener('change',()=>{
      const v=inp.value.trim(); if(!v){inp.value=c;return}
      S.classes[i]=v;
      S.boxes.forEach(b=>{if(b.class_id===i)b.class_name=v});
      buildClassUI(); redraw(); renderAnnList();
    });
    row.querySelector('.c-del').addEventListener('click',()=>{
      if(S.classes.length<=1){showToast('Need at least 1 class','err');return}
      S.classes.splice(i,1);
      S.boxes.forEach(b=>{
        if(b.class_id>=i) b.class_id=Math.max(0,b.class_id-1);
      });
      S.boxes.forEach(b=>{b.class_name=S.classes[b.class_id]||`class_${b.class_id}`});
      buildClassUI(); redraw(); renderAnnList();
    });
    list.appendChild(row);
  });
}
function addClass(){
  const inp=document.getElementById('new-cls-inp');
  const name=inp.value.trim();
  if(!name){showToast('Enter a name','err');return}
  S.classes.push(name); inp.value='';
  buildClassUI();
  document.getElementById('class-select').value=S.classes.length-1;
  onClassChange();
  showToast(`Added class [${S.classes.length-1}] ${name}`,'ok');
}
async function saveClasses(){
  if(!S.sessionFolder) return;
  try{
    const r=await post('/api/save_classes',{folder:S.sessionFolder,classes:S.classes});
    if(!r.ok) throw new Error(await r.text());
    showToast('classes.txt saved','ok');
  }catch(err){ showToast(err.message,'err'); }
}

// ═══════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════
function clearAll(){
  S.boxes=[]; S.selBox=-1; S.dirty=true;
  redraw(); renderAnnList(); updateStats();
}
function undoLast(){
  if(!S.boxes.length) return;
  S.boxes.pop(); if(S.selBox>=S.boxes.length) S.selBox=-1;
  S.dirty=true; redraw(); renderAnnList(); updateStats();
  document.getElementById('btn-undo').disabled=S.boxes.length===0;
}
function updateStats(){
  document.getElementById('sb-boxes').textContent=S.boxes.length;
  document.getElementById('btn-undo').disabled=S.boxes.length===0;
}
function updateProgress(){
  const tot=S.images.length, lab=S.labeledSet.size;
  const pct=tot?lab/tot*100:0;
  document.getElementById('prog-fill').style.width=pct+'%';
  document.getElementById('sb-labeled').textContent=`${lab}/${tot}`;
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
const enc=s=>encodeURIComponent(s);
const post=(url,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
let _toastT;
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='show '+(type||'');
  clearTimeout(_toastT); _toastT=setTimeout(()=>t.className='',2600);
}

// ═══════════════════════════════════════
// KEYBOARD
// ═══════════════════════════════════════
document.addEventListener('keydown', e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if(e.key==='Delete'||e.key==='Backspace'){
    if(S.selBox>=0){
      S.boxes.splice(S.selBox,1); S.selBox=-1; S.dirty=true;
      redraw(); renderAnnList(); updateStats();
    }
  }
  if((e.key==='s'||e.key==='S')&&!e.ctrlKey) saveLabels();
  if((e.key==='z'||e.key==='Z')&&(e.ctrlKey||e.metaKey)) undoLast();
  if(e.key==='a'||e.key==='A') navigate(-1);
  if(e.key==='d'||e.key==='D') navigate(1);
  if(e.key==='Escape'){S.selBox=-1; redraw(); renderAnnList();}
  if(/^[0-9]$/.test(e.key)){
    const id=parseInt(e.key);
    if(id<S.classes.length){document.getElementById('class-select').value=id; onClassChange();}
  }
});

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  S.classes=['object']; buildClassUI();
  const saved=localStorage.getItem('ml_last_path');
  if(saved) document.getElementById('path-display').textContent=`📂  ${saved}  (click to reload)`;
});
