import * as THREE from 'three';

/* ================= Save ================= */
const SAVE_KEY = 'hgc-save-v1';
let save = { char: null, power: 0, totalEarned: 0, done: [], stars: {}, sound: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch(e) {}
function persist(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch(e){} }

/* ================= Levels & treadmills ================= */
const LEVELS = [
  { id:1, name:'Sunny Hop',        dist:75,  startH:30, rec:0,   rings:4, wind:0,   color:0x22c55e, desc:'A short hop to a sunny island. Great first flight!' },
  { id:2, name:'Canyon Crossing',  dist:150, startH:28, rec:60,  rings:5, wind:0.8, color:0xf59e0b, desc:'A long canyon gap. Charge to about 60⚡ and grab the rings!' },
  { id:3, name:'Sky Peak Dash',    dist:235, startH:38, rec:150, rings:7, wind:2.2, color:0xa855f7, desc:'The big one — a high peak launch! Charge to about 150⚡, use rings and BOOST!' },
];
const MILLS = [
  { name:'Jogger',   rate:1.2, unlock:0,   color:0x22c55e, x:-17 },
  { name:'Sprinter', rate:3.5, unlock:25,  color:0x3b82f6, x:0 },
  { name:'Turbo',    rate:9,   unlock:100, color:0xa855f7, x:17 },
];
const CHARS = {
  cat:   { body:0xf97316, belly:0xfff7ed, name:'Cat' },
  bunny: { body:0xf1f5f9, belly:0xffffff, name:'Bunny' },
  dog:   { body:0xb45309, belly:0xfde68a, name:'Dog' },
  fox:   { body:0xea580c, belly:0xfff7ed, name:'Fox' },
};

/* ================= Audio (tiny beeps, no assets) ================= */
let actx = null;
function tone(f, d=0.12, type='sine', v=0.15, when=0){
  if (!save.sound) return;
  try {
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f;
    const t = actx.currentTime + when;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t+d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t+d);
  } catch(e){}
}
const sfx = {
  click: ()=>tone(660,0.07,'square',0.08),
  jump:  ()=>tone(300,0.15,'sine',0.12),
  charge:()=>tone(880,0.08,'sine',0.06),
  ring:  ()=>{ tone(990,0.1,'sine',0.14); tone(1320,0.14,'sine',0.12,0.07); },
  boost: ()=>tone(200,0.25,'sawtooth',0.08),
  win:   ()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,0.18,'triangle',0.15,i*0.11)); },
  splash:()=>{ tone(400,0.3,'sine',0.15); tone(180,0.4,'sine',0.15,0.1); },
};

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const ui = { power:$('power-val'), hud:$('hud'), touch:$('touch-ui'), menu:$('menu'),
  chargeWrap:$('charge-bar-wrap'), chargeRate:$('charge-rate'), chargeFill:$('charge-fill'),
  levelPill:$('level-pill'), levelName:$('level-name'), prog:$('progress-fill'),
  glideStats:$('glide-stats'), speed:$('stat-speed'), alt:$('stat-alt'), rings:$('stat-rings'),
  toast:$('toast'), prompt:$('prompt'), action:$('btn-action'), boost:$('btn-boost'), jump:$('btn-jump') };
let toastTimer = null;
function toast(msg, ms=2200){
  ui.toast.textContent = msg; ui.toast.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>ui.toast.classList.add('hidden'), ms);
}

/* ================= Three setup ================= */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x38bdf8);
scene.fog = new THREE.Fog(0x7dd3fc, 90, 260);
const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 600);
scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x65a30d, 1.15));
const sun = new THREE.DirectionalLight(0xfff7cc, 1.6); sun.position.set(30,50,20); scene.add(sun);
addEventListener('resize', ()=>{ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const MAT = (c, extra={}) => new THREE.MeshLambertMaterial({ color:c, ...extra });
function box(w,h,d,c,x=0,y=0,z=0){ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), MAT(c)); m.position.set(x,y,z); return m; }
function ball(r,c,x=0,y=0,z=0,sx=1,sy=1,sz=1){ const m = new THREE.Mesh(new THREE.SphereGeometry(r,18,14), MAT(c)); m.position.set(x,y,z); m.scale.set(sx,sy,sz); return m; }
function cone(r,h,c,x=0,y=0,z=0){ const m = new THREE.Mesh(new THREE.ConeGeometry(r,h,14), MAT(c)); m.position.set(x,y,z); return m; }
function textSprite(text, { size=44, color='#ffffff', bg='rgba(0,0,0,0.45)', scale=1 } = {}){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(6,14,500,100,28); g.fill();
  g.font = `800 ${size}px system-ui, sans-serif`; g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle = color; g.fillText(text, 256, 66);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true, depthWrite:false }));
  sp.scale.set(8*scale, 2*scale, 1); return sp;
}

/* clouds (shared, drift) */
const clouds = new THREE.Group(); scene.add(clouds);
for (let i=0;i<16;i++){
  const cl = new THREE.Group();
  const n = 3+Math.floor(Math.random()*3);
  for (let j=0;j<n;j++) cl.add(ball(1.4+Math.random()*1.6, 0xffffff, j*1.9-n, Math.random()*0.5, Math.random()*1.2));
  cl.position.set((Math.random()-0.5)*220, 26+Math.random()*36, -Math.random()*260+40);
  cl.scale.y = 0.55; clouds.add(cl);
}

/* ================= Character builder ================= */
function limb(r,len,c){ // pivot at top, geometry hangs down
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), MAT(c));
  m.position.y = -len/2; g.add(m); return g;
}
function buildCharacter(type){
  const cfg = CHARS[type], col = cfg.body;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 6, 14), MAT(col)); body.position.y = 0.95; g.add(body);
  const belly = ball(0.27, cfg.belly, 0, 0.92, -0.17, 0.8, 1, 0.45); g.add(belly);
  const head = ball(0.36, col, 0, 1.62, 0); g.add(head);
  const muzzle = ball(0.16, cfg.belly, 0, 1.54, -0.27, 1.1, 0.8, 0.9); g.add(muzzle);
  const nose = ball(0.055, type==='bunny'?0xec4899:0x1f2937, 0, 1.58, -0.42); g.add(nose);
  g.add(ball(0.06, 0x111827, -0.14, 1.7, -0.3)); g.add(ball(0.06, 0x111827, 0.14, 1.7, -0.3));
  // ears per species
  if (type==='cat' || type==='fox'){
    const eL = cone(0.13, 0.32, col, -0.2, 1.98, 0), eR = cone(0.13, 0.32, col, 0.2, 1.98, 0); g.add(eL, eR);
    if (type==='fox'){ g.add(ball(0.05,0x1f2937,-0.2,2.12,0)); g.add(ball(0.05,0x1f2937,0.2,2.12,0)); }
  } else if (type==='bunny'){
    const eL = limb(0.09, 0.5, col); eL.position.set(-0.15, 1.9, 0); eL.rotation.z = 0.15;
    const eR = limb(0.09, 0.5, col); eR.position.set(0.15, 2.12, 0); eR.rotation.z = -0.3; eR.rotation.x = 3.4;
    // long ears point UP: rebuild as capsules standing up
    eL.children[0].position.y = 0.28; eR.children[0].position.y = 0.28; eR.rotation.x = 0.15; eR.rotation.z = -0.12; eL.rotation.x = 0;
    g.add(eL, eR);
  } else if (type==='dog'){
    const eL = box(0.13,0.36,0.07, 0x92400e, -0.36, 1.72, 0); eL.rotation.z = 0.25;
    const eR = box(0.13,0.36,0.07, 0x92400e, 0.36, 1.72, 0); eR.rotation.z = -0.25; g.add(eL, eR);
    const spot = ball(0.11, 0x92400e, 0.2, 1.74, -0.28, 1, 1, 0.4); g.add(spot);
  }
  // tail
  const tail = limb(0.09, type==='fox'?0.55:0.34, col); tail.position.set(0, 1.05, 0.3); tail.rotation.x = -2.2; g.add(tail);
  if (type==='fox'){ const tip = ball(0.115, 0xffffff, 0, 1.45, 0.85); g.add(tip); }
  if (type==='bunny'){ g.add(ball(0.13, 0xffffff, 0, 1.0, 0.34)); }
  // limbs
  const legL = limb(0.1, 0.34, col); legL.position.set(-0.17, 0.62, 0);
  const legR = limb(0.1, 0.34, col); legR.position.set(0.17, 0.62, 0);
  const armL = limb(0.085, 0.32, col); armL.position.set(-0.42, 1.28, 0); armL.rotation.z = 0.25;
  const armR = limb(0.085, 0.32, col); armR.position.set(0.42, 1.28, 0); armR.rotation.z = -0.25;
  g.add(legL, legR, armL, armR);
  // glider (hidden until flying)
  const glider = new THREE.Group();
  const wingC = { cat:0xef4444, bunny:0xec4899, dog:0x3b82f6, fox:0xf59e0b }[type];
  const wingL = box(1.7, 0.07, 0.85, wingC, -0.85, 0, 0.1); wingL.rotation.z = 0.1;
  const wingR = box(1.7, 0.07, 0.85, wingC, 0.85, 0, 0.1); wingR.rotation.z = -0.1;
  const wingM = box(0.8, 0.08, 0.95, wingC, 0, 0, 0.08);
  glider.add(wingL, wingR, wingM);
  const strutG = new THREE.CylinderGeometry(0.03,0.03,0.85);
  [[-0.7,-0.3],[0.7,-0.3],[-0.7,0.35],[0.7,0.35]].forEach(([x,z])=>{
    const s = new THREE.Mesh(strutG, MAT(0x374151)); s.position.set(x,-0.42,z); glider.add(s);
  });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.5), MAT(0x374151));
  bar.rotation.z = Math.PI/2; bar.position.set(0,-0.82,-0.3); glider.add(bar);
  glider.position.y = 2.45; glider.visible = false; g.add(glider);
  g.userData = { legL, legR, armL, armR, glider, tail, type };
  return g;
}

/* ================= Hub world ================= */
const hub = new THREE.Group(); scene.add(hub);
const treadmills = [], pads = [];
let hubGroundY = 0;
{
  const ground = box(76, 2, 66, 0x4ade80, 0, -1, 0); hub.add(ground);
  const plaza = box(40, 0.22, 30, 0xfde68a, 0, 0.11, 6); hub.add(plaza);
  const cliff = box(76, 26, 4, 0xb45309, 0, -13, -34); hub.add(cliff); // cliff face at north edge
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600,600), MAT(0x0284c7));
  water.rotation.x = -Math.PI/2; water.position.y = -24; water.name='hubWater'; hub.add(water);
  // rainbow arch on the way to the launch pads (north, in the player's initial view)
  [0xef4444,0xf59e0b,0xfacc15,0x22c55e,0x3b82f6].forEach((c,i)=>{
    const t = new THREE.Mesh(new THREE.TorusGeometry(13-i*0.55, 0.32, 8, 32, Math.PI), MAT(c));
    t.position.set(0, 0, -18); hub.add(t);
  });
  const sign = textSprite('🪂 HANG GLIDE CHARGER ⚡', { size:40, scale:1.5 }); sign.position.set(0, 9.5, -18); hub.add(sign);
  // trees
  for (let i=0;i<14;i++){
    const x = (Math.random()<0.5?-1:1)*(24+Math.random()*10), z = -24+Math.random()*50;
    const tr = new THREE.Group();
    tr.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,1.6), MAT(0x92400e)));
    tr.children[0].position.y = 0.8;
    tr.add(cone(1.3, 2.8, 0x16a34a, 0, 3, 0)); tr.add(cone(1, 2.2, 0x22c55e, 0, 4.2, 0));
    tr.position.set(x, 0, z); hub.add(tr);
  }
  // treadmills (run toward -Z / the cliff)
  MILLS.forEach((m, i)=>{
    const grp = new THREE.Group(); grp.position.set(m.x, 0, 2);
    const beltMat = MAT(0x1f2937);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 10), beltMat); belt.position.y = 0.18; grp.add(belt);
    const stripes = [];
    for (let s=0;s<6;s++){ const st = box(4.6, 0.37, 0.35, 0xfacc15); st.position.set(0, 0.18, -5 + s*1.9); st.material = MAT(0x9ca3af); grp.add(st); stripes.push(st); }
    grp.add(box(0.35, 0.7, 10.4, m.color, -2.5, 0.35, 0)); grp.add(box(0.35, 0.7, 10.4, m.color, 2.5, 0.35, 0));
    grp.add(box(5.4, 1.1, 0.4, m.color, 0, 0.9, -5.2)); // front console
    const label = textSprite(`${m.name} ⚡${m.rate}/s`, { size:40, scale:0.8, color:'#fde047' });
    label.position.set(0, 2.6, -5.2); grp.add(label);
    if (m.unlock > 0){ const lock = textSprite(`🔒 earn ${m.unlock}⚡ total`, { size:36, scale:0.8, color:'#fca5a5' }); lock.position.set(0, 2.6, 1); lock.name='lockLabel'; grp.add(lock); }
    hub.add(grp);
    treadmills.push({ ...m, group:grp, stripes, beltMat, bounds:{ x1:m.x-2.3, x2:m.x+2.3, z1:-3, z2:7 } });
  });
  // launch pads at cliff edge (z = -27)
  LEVELS.forEach((lv, i)=>{
    const x = (i-1)*20;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 24), MAT(lv.color));
    pad.position.set(x, 0.2, -27); hub.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.18, 8, 28), MAT(0xffffff));
    ring.rotation.x = Math.PI/2; ring.position.set(x, 2.8, -27); ring.name='padRing'; hub.add(ring);
    const label = textSprite(`Level ${lv.id}: ${lv.name}`, { size:38, scale:0.95, color:'#ffffff' });
    label.position.set(x, 5.2, -27); hub.add(label);
    const rec = textSprite(lv.rec ? `needs ~${lv.rec}⚡` : 'easy — just fly!', { size:36, scale:0.8, color:'#fde047' });
    rec.position.set(x, 4.1, -27); hub.add(rec);
    pads.push({ level:lv, x, z:-27, ring });
  });
}

/* ================= Glide level builder ================= */
let levelGroup = null, levelRings = [], levelData = null;
function clearLevel(){
  if (levelGroup){ scene.remove(levelGroup); levelGroup.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); levelGroup = null; }
  levelRings = [];
}
function buildLevel(lv){
  clearLevel();
  levelGroup = new THREE.Group(); scene.add(levelGroup); levelData = lv;
  const startH = lv.startH;
  // start cliff
  const startTop = box(18, 2, 14, 0x4ade80, 0, startH-1, 2); levelGroup.add(startTop);
  levelGroup.add(box(18, startH, 4, 0xb45309, 0, startH/2, 8.5));
  const startLabel = textSprite(`🪂 ${lv.name} — GO!`, { size:40, scale:1.1 }); startLabel.position.set(0, startH+4.5, 2); levelGroup.add(startLabel);
  // water below everything
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700,700), MAT(0x0284c7));
  water.rotation.x = -Math.PI/2; water.position.set(0, 0, -lv.dist/2); levelGroup.add(water);
  // landing island
  const landZ = -lv.dist;
  const island = box(24, 3, 16, 0xfde68a, 0, 0.5, landZ); levelGroup.add(island); // top at y=2
  const grass = box(24, 0.5, 16, 0x4ade80, 0, 2.2, landZ); levelGroup.add(grass); // top ~2.45
  const target = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.25, 26), MAT(0xef4444));
  target.position.set(0, 2.55, landZ); levelGroup.add(target);
  const targetIn = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.27, 26), MAT(0xffffff));
  targetIn.position.set(0, 2.56, landZ); levelGroup.add(targetIn);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,7), MAT(0x78716c));
  flagPole.position.set(7, 6, landZ-5); levelGroup.add(flagPole);
  const flag = box(2.6, 1.5, 0.08, 0x22c55e, 8.3, 8.8, landZ-5); levelGroup.add(flag);
  const landLabel = textSprite('🏝️ LAND HERE!', { size:42, scale:1.1, color:'#fde047' }); landLabel.position.set(0, 9, landZ); levelGroup.add(landLabel);
  // deco islands + canyon walls for level 2+
  for (let i=0;i<7;i++){
    const side = i%2 ? 1 : -1;
    const x = side*(20+Math.random()*16), z = -15 - i*(lv.dist/7);
    if (lv.id >= 2){ const wall = box(8, 16+Math.random()*10, 14, 0xd97706, x, 6, z); levelGroup.add(wall); }
    else { const isl = ball(3.5, 0x4ade80, x, 0.4, z, 1, 0.45, 1); levelGroup.add(isl); }
  }
  // golden rings along a gentle S path
  levelRings = [];
  for (let i=0;i<lv.rings;i++){
    const t = (i+1)/(lv.rings+1);
    const z = -lv.dist * t;
    const x = Math.sin(t*Math.PI*1.6) * 7;
    const y = startH - (startH-4) * t + Math.sin(t*Math.PI)*3;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.32, 10, 26),
      new THREE.MeshLambertMaterial({ color:0xfacc15, emissive:0x92600a }));
    ring.position.set(x, y, z); levelGroup.add(ring);
    const star = textSprite('⭐', { size:60, bg:'rgba(0,0,0,0)', scale:0.55 }); star.position.set(x, y, z); levelGroup.add(star);
    levelRings.push({ mesh:ring, star, got:false, x, y, z });
  }
  return { landZ, landTop: 2.6 };
}

/* ================= Player ================= */
let player = null, playerType = save.char || 'cat';
function spawnPlayer(type){
  if (player) scene.remove(player);
  player = buildCharacter(type); playerType = type;
  player.position.set(0, 0, 18); player.rotation.y = 0;
  scene.add(player);
}
spawnPlayer(playerType);
const blobShadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20),
  new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.25, depthWrite:false }));
blobShadow.rotation.x = -Math.PI/2; scene.add(blobShadow);

/* ================= State & input ================= */
let mode = 'menu'; // menu | hub | glide
let vy = 0, grounded = true, walkPhase = 0;
let camYaw = 0, camPitch = 0.32, camDist = 8;
let charging = null; // treadmill object or null
let nearPad = null;
let currentLevel = null, landInfo = null, ringsGot = 0;
const glide = { yaw:Math.PI, pitch:-0.06, speed:0, boostT:0, t:0, startZ:0 };
const input = { jx:0, jy:0, keys:{} };
let floatPower = save.power || 0;

addEventListener('keydown', e=>{ input.keys[e.code] = true;
  if (e.code==='Space'){ e.preventDefault(); doJump(); }
  if (e.code==='KeyE') doAction();
  if (e.code==='KeyB' || e.code==='ShiftLeft') doBoost();
});
addEventListener('keyup', e=>{ input.keys[e.code] = false; });
function keyVec(){
  let x = input.jx, y = input.jy;
  if (input.keys.KeyA || input.keys.ArrowLeft) x -= 1;
  if (input.keys.KeyD || input.keys.ArrowRight) x += 1;
  if (input.keys.KeyW || input.keys.ArrowUp) y -= 1;
  if (input.keys.KeyS || input.keys.ArrowDown) y += 1;
  const l = Math.hypot(x,y); if (l>1){ x/=l; y/=l; }
  return { x, y };
}
/* joystick */
const joy = $('joystick'), stick = $('stick');
let joyId = null;
function joyMove(e){
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2);
  const max = r.width/2 - 8, l = Math.hypot(dx,dy);
  if (l > max){ dx = dx/l*max; dy = dy/l*max; }
  stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  input.jx = dx/max; input.jy = dy/max;
}
joy.addEventListener('pointerdown', e=>{ joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', e=>{ if (e.pointerId===joyId) joyMove(e); });
const joyEnd = e=>{ if (e.pointerId===joyId){ joyId=null; input.jx=0; input.jy=0; stick.style.transform='translate(-50%,-50%)'; } };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
/* camera drag: anywhere on canvas (mouse or touch on right side) */
let camDrag = null, camHoldUntil = 0;
canvas.addEventListener('pointerdown', e=>{ camDrag = { id:e.pointerId, x:e.clientX, y:e.clientY }; camHoldUntil = performance.now() + 3000; });
addEventListener('pointermove', e=>{
  if (camDrag && e.pointerId===camDrag.id){
    camYaw -= (e.clientX - camDrag.x) * 0.0055;
    camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - camDrag.y) * 0.004, -0.05, 1.1);
    camDrag.x = e.clientX; camDrag.y = e.clientY;
    camHoldUntil = performance.now() + 3000;
  }
});
addEventListener('pointerup', e=>{ if (camDrag && e.pointerId===camDrag.id) camDrag = null; });
/* buttons */
function holdBtn(el, fn){ el.addEventListener('pointerdown', e=>{ e.preventDefault(); fn(); }); }
holdBtn(ui.jump, ()=>doJump());
holdBtn(ui.boost, ()=>doBoost());
holdBtn(ui.action, ()=>doAction());
$('btn-char').addEventListener('click', ()=>{ sfx.click(); openMenu(); });
$('btn-help').addEventListener('click', ()=>{ sfx.click(); $('help').classList.remove('hidden'); });
$('btn-help-close').addEventListener('click', ()=>{ sfx.click(); $('help').classList.add('hidden'); });
$('btn-sound').addEventListener('click', e=>{ save.sound = !save.sound; persist(); e.target.textContent = save.sound?'🔊':'🔇'; toast(save.sound?'Sound on 🔊':'Sound off 🔇', 900); });
$('btn-sound').textContent = save.sound ? '🔊' : '🔇';

function doJump(){
  if (mode==='hub' && grounded){ vy = 8.2; grounded = false; sfx.jump(); }
}
function doAction(){
  if (mode==='hub' && nearPad) startLevel(nearPad.level);
}
function doBoost(){
  if (mode!=='glide') return;
  if (floatPower >= 10 && glide.boostT <= 0){
    floatPower -= 10; glide.boostT = 1.1; glide.speed += 6; sfx.boost();
    toast('BOOST! ⚡', 700);
  } else if (glide.boostT <= 0) toast('Need 10⚡ to boost — charge on a treadmill!', 1600);
}

/* ================= Hub logic ================= */
function updateHub(dt){
  const v = keyVec();
  const moving = Math.hypot(v.x, v.y) > 0.12;
  // which treadmill are we on?
  charging = null;
  for (const m of treadmills){
    const p = player.position;
    if (p.x > m.bounds.x1 && p.x < m.bounds.x2 && p.z > m.bounds.z1 && p.z < m.bounds.z2){
      if (save.totalEarned >= m.unlock) charging = m;
      break;
    }
  }
  const lockedMill = !charging && treadmills.find(m => save.totalEarned < m.unlock &&
    player.position.x > m.bounds.x1 && player.position.x < m.bounds.x2 &&
    player.position.z > m.bounds.z1 && player.position.z < m.bounds.z2);

  if (charging){
    // run in place facing the cliff (-Z), charge even with no input (AFK friendly!)
    player.rotation.y = 0;
    walkPhase += dt * 13;
    floatPower += charging.rate * dt;
    save.totalEarned += charging.rate * dt;
    charging.stripes.forEach(s=>{ s.position.z += dt * 7; if (s.position.z > 5.4) s.position.z -= 11.4; });
    if (Math.random() < dt*1.6) sfx.charge();
    ui.chargeWrap.classList.remove('hidden');
    ui.chargeRate.textContent = charging.rate;
    ui.chargeFill.style.width = ((floatPower % 25) / 25 * 100) + '%';
  } else {
    ui.chargeWrap.classList.add('hidden');
    if (lockedMill) toast(`🔒 ${lockedMill.name} treadmill unlocks after earning ${lockedMill.unlock}⚡ total`, 1200);
    if (moving){
      // Camera basis: forward = away from camera = (-sin(camYaw), -cos(camYaw)); right = (cos(camYaw), -sin(camYaw))
      const fwd = -v.y; // stick up (jy=-1) => forward +1
      let mx = Math.cos(camYaw) * v.x + (-Math.sin(camYaw)) * fwd;
      let mz = -Math.sin(camYaw) * v.x + (-Math.cos(camYaw)) * fwd;
      const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const speed = 6.2;
      player.position.x += mx * speed * dt;
      player.position.z += mz * speed * dt;
      walkPhase += dt * 10;
      // model faces -Z at rotation 0: facing angle for dir (mx,mz) is atan2(mx,mz)+PI
      const targetYaw = Math.atan2(mx, mz) + Math.PI;
      player.rotation.y += (((targetYaw - player.rotation.y + Math.PI*3) % (Math.PI*2)) - Math.PI) * Math.min(1, dt*12);
    }
  }
  // gravity / jump
  if (!grounded || player.position.y > 0){
    vy -= 22 * dt; player.position.y += vy * dt;
    if (player.position.y <= 0){ player.position.y = 0; vy = 0; grounded = true; }
  }
  // hub bounds (cliff edge at z=-30 except pads area is fine up to -29)
  player.position.x = THREE.MathUtils.clamp(player.position.x, -36, 36);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -28.6, 31);
  // launch pads proximity
  nearPad = null;
  for (const p of pads){
    p.ring.rotation.z += dt * 0.8;
    if (Math.hypot(player.position.x - p.x, player.position.z - p.z) < 3.1) nearPad = p;
  }
  if (nearPad){
    ui.prompt.textContent = `Level ${nearPad.level.id}: ${nearPad.level.name} — ${nearPad.level.rec ? `~${nearPad.level.rec}⚡` : 'easy flight'} · you have ${Math.floor(floatPower)}⚡`;
    ui.prompt.classList.remove('hidden');
    ui.action.textContent = `LAUNCH L${nearPad.level.id} 🚀`;
    ui.action.classList.remove('hidden');
  } else {
    ui.prompt.classList.add('hidden');
    ui.action.classList.add('hidden');
  }
  animateCharacter(dt, charging ? 1.4 : (moving ? 1 : 0));
}

/* ================= Glide logic ================= */
function startLevel(lv){
  currentLevel = lv;
  landInfo = buildLevel(lv);
  hub.visible = false;
  mode = 'glide';
  ringsGot = 0;
  player.userData.glider.visible = true;
  player.position.set(0, lv.startH + 0.1, 6);
  glide.yaw = 0; glide.pitch = -0.05; // heading 0 => forward is -Z (model convention)
  glide.speed = 11 + Math.min(floatPower, 260) * 0.07;
  glide.boostT = 0; glide.t = 0; glide.startZ = 6;
  camYaw = 0; camPitch = 0.3; camDist = 9.5;
  ui.levelPill.classList.remove('hidden'); ui.levelName.textContent = lv.name;
  ui.glideStats.classList.remove('hidden');
  ui.boost.classList.remove('hidden'); ui.jump.classList.add('hidden');
  ui.action.classList.add('hidden'); ui.prompt.classList.add('hidden'); ui.chargeWrap.classList.add('hidden');
  toast(`🪂 ${lv.name}! Glide ${lv.dist}m to the island!`, 2400);
  sfx.click();
}
function endGlideToHub(){
  clearLevel(); hub.visible = true; mode = 'hub';
  player.userData.glider.visible = false;
  player.position.set(0, 0, 14); player.rotation.set(0, 0, 0);
  vy = 0; grounded = true; camDist = 8;
  ui.levelPill.classList.add('hidden'); ui.glideStats.classList.add('hidden');
  ui.boost.classList.add('hidden'); ui.jump.classList.remove('hidden');
  $('result').classList.add('hidden');
}
function finishLevel(won, reason){
  if (won){
    if (!save.done.includes(currentLevel.id)) save.done.push(currentLevel.id);
    const stars = ringsGot >= Math.ceil(currentLevel.rings*0.8) ? 3 : ringsGot >= Math.ceil(currentLevel.rings*0.4) ? 2 : 1;
    save.stars[currentLevel.id] = Math.max(save.stars[currentLevel.id]||0, stars);
    floatPower += 10; save.totalEarned += 10;
    persist(); sfx.win();
    $('result-title').textContent = '🎉 You made it!';
    $('result-text').innerHTML = `You landed on the island in <b>${glide.t.toFixed(1)}s</b> and got <b>${ringsGot}/${currentLevel.rings} rings</b>!<br>Bonus: +10⚡`;
    $('result-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
  } else {
    sfx.splash();
    $('result-title').textContent = '💦 Splash!';
    $('result-text').innerHTML = reason || `You landed in the water. Charge more power on the treadmills and try again!<br>You have <b>${Math.floor(floatPower)}⚡</b> — this level likes ~${currentLevel.rec}⚡.`;
    $('result-stars').textContent = '';
  }
  mode = 'result';
  $('result').classList.remove('hidden');
}
$('btn-result-hub').addEventListener('click', ()=>{ sfx.click(); endGlideToHub(); });
$('btn-result-retry').addEventListener('click', ()=>{ sfx.click(); $('result').classList.add('hidden'); startLevel(currentLevel); });

function updateGlide(dt){
  glide.t += dt;
  const v = keyVec();
  // steering: stick X turns (right stick = turn right on screen), stick Y pitches (stick up = climb)
  // Heading convention: forward = (-sin(yaw), -cos(yaw)); at yaw 0 that's -Z.
  // Facing -Z, turning right heads toward +X, which is decreasing yaw.
  glide.yaw   += -v.x * 1.5 * dt;
  glide.pitch += -v.y * 1.1 * dt;
  glide.pitch = THREE.MathUtils.clamp(glide.pitch, -0.55, 0.38);
  if (glide.boostT > 0) glide.boostT -= dt;
  // speed physics: diving gains, climbing loses, drag pulls toward ~cruise
  glide.speed += (-Math.sin(glide.pitch) * 10 - (glide.speed - 13) * 0.12) * dt;
  if (glide.boostT > 0) glide.speed += 5 * dt;
  glide.speed = THREE.MathUtils.clamp(glide.speed, 5, 42);
  // sink: base sink, worse when stalling (slow), better when boosted
  let sink = 2.8;
  if (glide.speed < 10) sink += (10 - glide.speed) * 0.45;
  if (glide.boostT > 0) sink -= 1.1;
  // move along heading
  const fx = -Math.sin(glide.yaw), fz = -Math.cos(glide.yaw);
  player.position.x += fx * glide.speed * Math.cos(glide.pitch) * dt;
  player.position.z += fz * glide.speed * Math.cos(glide.pitch) * dt;
  // wind (levels 2-3 push sideways)
  player.position.x += currentLevel.wind * dt * Math.sin(glide.t * 0.7);
  // vertical
  const vyG = glide.speed * Math.sin(glide.pitch) - sink + (glide.boostT > 0 ? 1.6 : 0);
  player.position.y += vyG * dt;
  // ring collection
  for (const r of levelRings){
    if (r.got) continue;
    r.mesh.rotation.z += dt;
    const d = player.position.distanceTo(r.mesh.position);
    if (d < 2.6){
      r.got = true; ringsGot++; r.mesh.visible = false; r.star.visible = false;
      glide.speed = Math.min(glide.speed + 4.5, 42);
      floatPower += 3; save.totalEarned += 3;
      sfx.ring(); toast(`⭐ Ring! +speed, +3⚡ (${ringsGot}/${currentLevel.rings})`, 900);
    }
  }
  // orientation: face heading, bank into turns, pitch visual
  player.rotation.set(0, 0, 0);
  player.rotation.y = glide.yaw;
  player.rotation.x = -glide.pitch * 0.7;
  player.rotation.z = THREE.MathUtils.clamp(-v.x * 0.5, -0.6, 0.6);
  // HUD
  const doneDist = THREE.MathUtils.clamp((glide.startZ - player.position.z) / currentLevel.dist, 0, 1);
  ui.prog.style.width = (doneDist * 100) + '%';
  ui.speed.textContent = Math.round(glide.speed);
  ui.alt.textContent = Math.max(0, Math.round(player.position.y - 2));
  ui.rings.textContent = ringsGot;
  // landing / water checks
  const landZ = landInfo.landZ;
  const onIslandX = Math.abs(player.position.x) < 13, onIslandZ = Math.abs(player.position.z - landZ) < 9;
  if (onIslandX && onIslandZ && player.position.y <= landInfo.landTop + 0.4){
    player.position.y = landInfo.landTop; finishLevel(true); return;
  }
  if (player.position.y <= 1.0){
    finishLevel(false); return;
  }
  if (glide.t > 90){ finishLevel(false, '⏰ The wind carried you too far! Try again.'); return; }
  animateCharacter(dt, 0, true);
}

/* ================= Character animation ================= */
function animateCharacter(dt, runAmt, gliding=false){
  const u = player.userData;
  if (gliding){
    u.legL.rotation.x = 0.5; u.legR.rotation.x = 0.35;
    u.armL.rotation.x = -2.6; u.armR.rotation.x = -2.6; // arms up holding the bar
    u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.5;
    u.tail.rotation.x = -2.2 + Math.sin(performance.now()*0.006)*0.15;
    return;
  }
  const s = Math.sin(walkPhase), c = Math.cos(walkPhase);
  const amp = runAmt > 0 ? 0.75 : 0;
  u.legL.rotation.x = s * amp; u.legR.rotation.x = -s * amp;
  u.armL.rotation.x = -s * amp * 0.8; u.armR.rotation.x = s * amp * 0.8;
  u.armL.rotation.z = 0.25; u.armR.rotation.z = -0.25;
  if (runAmt > 0) player.children[0].position.y = 0.95 + Math.abs(c) * 0.05 * runAmt;
  else player.children[0].position.y = 0.95;
}

/* ================= Camera ================= */
function updateCamera(dt){
  let target, dist = camDist, pitch = camPitch;
  if (mode === 'menu'){
    const t = performance.now() * 0.00012;
    camera.position.set(Math.sin(t)*26, 13, Math.cos(t)*26 + 4);
    camera.lookAt(0, 2, -4); return;
  }
  if (mode === 'glide'){
    // chase behind heading
    const back = new THREE.Vector3(Math.sin(glide.yaw), 0, Math.cos(glide.yaw));
    target = player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const desired = target.clone().add(back.multiplyScalar(dist)).add(new THREE.Vector3(0, dist * Math.sin(pitch) + 1.5, 0));
    camera.position.lerp(desired, Math.min(1, dt*4));
    camera.lookAt(target); return;
  }
  // hub: orbit around player; when not dragging, the camera gently settles
  // behind the player (Roblox-style follow) — camYaw target = player facing
  if (performance.now() > camHoldUntil){
    const targetYaw = player.rotation.y;
    const diff = ((targetYaw - camYaw + Math.PI*3) % (Math.PI*2)) - Math.PI;
    camYaw += diff * Math.min(1, dt * 2.0);
  }
  target = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(camYaw) * Math.cos(pitch)
  ).multiplyScalar(dist);
  camera.position.lerp(target.clone().add(off), Math.min(1, dt*10));
  camera.lookAt(target);
}

/* ================= Menu ================= */
document.querySelectorAll('.char-card').forEach(card=>{
  card.addEventListener('click', ()=>{
    document.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    save.char = card.dataset.char; persist();
    spawnPlayer(save.char);
    player.position.set(0,0,18);
    $('btn-char').textContent = card.querySelector('.char-emoji').textContent;
    $('btn-play').disabled = false; sfx.click();
  });
  if (card.dataset.char === playerType){ card.classList.add('selected'); $('btn-play').disabled = false; }
});
$('btn-char').textContent = { cat:'🐱', bunny:'🐰', dog:'🐶', fox:'🦊' }[playerType] || '🐱';
function openMenu(){
  mode = 'menu';
  if (levelGroup){ endGlideToHub(); mode = 'menu'; }
  hub.visible = true;
  $('menu-power').textContent = Math.floor(floatPower);
  $('menu-done').textContent = `${save.done.length}/3`;
  $('menu-save').classList.toggle('hidden', !(save.power > 0 || save.done.length));
  ui.menu.classList.remove('hidden');
  ui.hud.classList.add('hidden'); ui.touch.classList.add('hidden');
}
$('btn-play').addEventListener('click', ()=>{
  if (!save.char) return;
  sfx.click();
  ui.menu.classList.add('hidden');
  ui.hud.classList.remove('hidden'); ui.touch.classList.remove('hidden');
  mode = 'hub';
  player.position.set(0, 0, 18); player.rotation.y = 0; camYaw = 0;
  toast('🏃 Charge up on a treadmill, then head to a launch gate!', 3200);
});
$('loading').style.display = 'none';
openMenu();

/* ================= Main loop ================= */
const clock = new THREE.Clock();
let saveTick = 0, popTick = 0;
function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  clouds.children.forEach((c,i)=>{ c.position.x += dt * (0.4 + (i%3)*0.2); if (c.position.x > 130) c.position.x = -130; });
  if (mode === 'hub') updateHub(dt);
  else if (mode === 'glide') updateGlide(dt);
  // blob shadow follows on ground plane of current area
  if (player){
    blobShadow.position.set(player.position.x, (mode==='glide' ? 0.06 : 0.06), player.position.z);
    const h = Math.max(player.position.y, 0);
    const s = THREE.MathUtils.clamp(1.6 - h*0.02, 0.4, 1.6);
    blobShadow.scale.setScalar(mode==='glide' ? s : 1);
    blobShadow.material.opacity = mode==='glide' ? THREE.MathUtils.clamp(0.3 - h*0.004, 0.05, 0.3) : 0.25;
    blobShadow.visible = mode !== 'menu';
  }
  ui.power.textContent = Math.floor(floatPower);
  saveTick += dt;
  if (saveTick > 2){ saveTick = 0; if (Math.floor(save.power) !== Math.floor(floatPower)){ save.power = floatPower; persist(); } }
  updateCamera(dt);
  renderer.render(scene, camera);
}
loop();

/* debug/testing hooks */
window.HGC = { get mode(){return mode}, get power(){return floatPower}, setPower(v){ floatPower=v; save.power=v; persist(); },
  startLevel:i=>startLevel(LEVELS[i]), get save(){return save}, THREE, scene };
