// ============================================================
//  PEPPA CHAOS — Complete 2D Pixel-Art Chaos Sidescroller
//  Virtual 320×180, scaled to fill browser. All vanilla JS.
// ============================================================

// ── 1. CONSTANTS & CANVAS ────────────────────────────────────
// Virtual game coordinates: 320×180 design space
// All physics/collision in virtual space; only drawing scales to native res
const VW_BASE = 320, VH_BASE = 180

const canvas = document.getElementById('gameCanvas')
const ctx    = canvas.getContext('2d')
// vc = ctx: no virtual canvas — render directly at native resolution, no blur
const vc = ctx

// VW/VH stay at 320×180 — all game/menu logic uses virtual coords
// Native resolution handled by _S scale factor
const VW = VW_BASE, VH = VH_BASE
let _S = 1, _SOX = 0, _SOY = 0

function resize() {
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  ctx.imageSmoothingEnabled = false
  _S   = Math.min(canvas.width / VW_BASE, canvas.height / VH_BASE)
  _SOX = (canvas.width  - VW_BASE * _S) / 2
  _SOY = (canvas.height - VH_BASE * _S) / 2
}
window.addEventListener('resize', resize)
resize()

// Scale helpers: convert virtual coords → screen coords
const sp  = (v)    => v * _S                    // scale position or size
const spx = (v)    => _SOX + v * _S             // scale X with centering
const spy = (v)    => _SOY + v * _S             // scale Y with centering
const ss  = (v)    => Math.max(1, v * _S)       // scale size (min 1px)

function blitToScreen() { /* no-op: vc===ctx, already drawn to screen */ }

let _menuScale = 1, _menuOX = 0, _menuOY = 0

function beginMenuDraw() {
  _menuScale = _S
  _menuOX    = _SOX
  _menuOY    = _SOY
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(_menuOX, _menuOY)
  ctx.scale(_menuScale, _menuScale)
}

function endMenuDraw() {
  ctx.restore()
}

const C = {
  PINK:'#FF69B4', DPINK:'#CC4490', PURPLE:'#9B59B6',
  CYAN:'#00FFFF', BLUE:'#87CEEB', DBLUE:'#4A90D9',
  GREEN:'#90EE90', DGREEN:'#2ECC71', YELLOW:'#F1C40F',
  RED:'#E74C3C', DRED:'#922B21', WHITE:'#FFFFFF',
  BLACK:'#1A1A2E', GRAY:'#555577', DGRAY:'#333350',
  ORANGE:'#FF8C00', LEMON:'#FFE44D',
}

// ── STATE ────────────────────────────────────────────────────
let game      = null
let state     = 'menu'
let prevState = 'menu'

// ── 2. SAVE / LOAD ───────────────────────────────────────────
const SAVE_KEY = 'peppachaos_v2'
let save = {
  coins: 0,
  highScores: [0, 0, 0, 0, 0, 0],
  unlockedLevels: [true, false, false, false, false, false],
  unlockedSkins: ['default'],
  activeSkin: 'default',
  settings: { sfxVol: 0.6, musicVol: 0.5 },
}

function loadSave() {
  try {
    const d = localStorage.getItem(SAVE_KEY)
    if (d) {
      const p = JSON.parse(d)
      save.coins          = p.coins          || 0
      save.highScores     = p.highScores     || [0,0,0,0,0,0]
      save.unlockedLevels = p.unlockedLevels || [true,false,false,false,false,false]
      save.unlockedSkins  = p.unlockedSkins  || ['default']
      save.activeSkin     = p.activeSkin     || 'default'
      save.settings       = Object.assign({ sfxVol:0.6, musicVol:0.5 }, p.settings || {})
    }
  } catch(e) {}
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch(e) {}
}

loadSave()

// ── 3. AUDIO ─────────────────────────────────────────────────
let audioCtx = null
function getAC() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}
function playTone(freq, dur, type, vol) {
  if (type === undefined) type = 'square'
  if (vol  === undefined) vol  = 0.3
  try {
    const ac  = getAC()
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = type; osc.frequency.value = freq
    g.gain.setValueAtTime(vol * save.settings.sfxVol, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
    osc.start(); osc.stop(ac.currentTime + dur)
  } catch(e) {}
}
function sfxJump()    { playTone(400,0.1,'square',0.3); setTimeout(()=>playTone(600,0.08,'square',0.2),80) }
function sfxBreak()   { playTone(150,0.25,'sawtooth',0.4) }
function sfxChaos()   { playTone(800,0.15,'square',0.35); setTimeout(()=>playTone(400,0.1,'sawtooth',0.3),100) }
function sfxHurt()    { playTone(200,0.3,'sawtooth',0.5) }
function sfxCoin()    { playTone(1000,0.08,'sine',0.3); setTimeout(()=>playTone(1400,0.08,'sine',0.25),80) }
function sfxBoss()    { [200,300,400,200].forEach((f,i)=>setTimeout(()=>playTone(f,0.15,'sawtooth',0.4),i*100)) }
function sfxWin()     { [500,700,900,1200].forEach((f,i)=>setTimeout(()=>playTone(f,0.2,'square',0.3),i*100)) }
function sfxAlarm()   { playTone(800,0.2,'square',0.4); setTimeout(()=>playTone(600,0.2,'square',0.3),200) }
function sfxMenu()    { playTone(440,0.05,'sine',0.15) }
function sfxConfirm() { playTone(880,0.1,'sine',0.25); setTimeout(()=>playTone(1100,0.1,'sine',0.2),80) }

// ── 4. PARTICLE SYSTEM ───────────────────────────────────────
const particles = []
function spawnParticle(x, y, color, vx, vy, life, size) {
  if (size === undefined) size = 2
  particles.push({ x, y, vx, vy, life, maxLife: life, color, size })
}
function spawnBurst(x, y, color, count) {
  if (count === undefined) count = 8
  for (let i = 0; i < count; i++) {
    const a  = (i / count) * Math.PI * 2
    const sp = 1 + Math.random() * 2
    spawnParticle(x, y, color, Math.cos(a)*sp, Math.sin(a)*sp, 0.4+Math.random()*0.4, 2+Math.random()*2)
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= dt
    if (p.life <= 0) particles.splice(i, 1)
  }
}
function drawParticles() {
  particles.forEach(p => {
    vc.globalAlpha = Math.max(0, p.life / p.maxLife)
    vc.fillStyle   = p.color
    const ps = Math.max(2, ss(p.size))
    vc.fillRect(Math.round(spx(p.x) - ps/2), Math.round(spy(p.y) - ps/2), ps, ps)
  })
  vc.globalAlpha = 1
}

// ── 5. SCREEN EFFECTS ────────────────────────────────────────
let chaosEffect = 0

function drawGlitch() {
  if (chaosEffect < 0.3) return
  const lines = Math.floor(chaosEffect * 8)
  for (let i = 0; i < lines; i++) {
    const y      = Math.floor(Math.random() * VH)
    const h      = 1 + Math.floor(Math.random() * 3)
    const offset = (Math.random() - 0.5) * chaosEffect * 20
    try {
      const slice = vc.getImageData(0, y, VW, h)
      vc.putImageData(slice, offset, y)
    } catch(e) {}
  }
  if (chaosEffect > 0.6) {
    vc.globalCompositeOperation = 'screen'
    vc.globalAlpha = chaosEffect * 0.15
    vc.fillStyle = '#FF0000'; vc.fillRect(-3, 0, VW, VH)
    vc.fillStyle = '#0000FF'; vc.fillRect(3,  0, VW, VH)
    vc.globalAlpha = 1
    vc.globalCompositeOperation = 'source-over'
  }
}

// ── 6. LEVEL DATA ────────────────────────────────────────────
const LEVELS = [
  {
    id:1, name:'BEDROOM DISASTER',
    bgColor:'#1A0A2E', floorColor:'#4A3060',
    objectives:['Break 3 toys','Spill juice','Draw on wall'],
    platforms:[
      {x:0,   y:164, w:320, h:16, c:'#4A3060'},
      {x:20,  y:130, w:60,  h:8,  c:'#6A4090'},
      {x:200, y:120, w:50,  h:8,  c:'#3A2050'},
      {x:120, y:100, w:40,  h:8,  c:'#5A3070'},
    ],
    interactables:[
      {id:'toy1',  x:40,  y:122, w:12, h:12, type:'toy',   points:10, chaosAdd:5,  broken:false, color:'#FF69B4'},
      {id:'toy2',  x:220, y:112, w:12, h:12, type:'toy',   points:10, chaosAdd:5,  broken:false, color:'#87CEEB'},
      {id:'toy3',  x:60,  y:122, w:10, h:12, type:'toy',   points:10, chaosAdd:5,  broken:false, color:'#F1C40F'},
      {id:'juice', x:140, y:92,  w:8,  h:14, type:'juice', points:15, chaosAdd:8,  broken:false, color:'#FF4500'},
      {id:'wall',  x:280, y:80,  w:30, h:40, type:'wall',  points:20, chaosAdd:10, broken:false, color:'#BDB9D0'},
    ],
    enemies:[
      {type:'mama', x:250, y:150, hp:3, patrol:true, patrolDist:60, dir:1, patrolTimer:0},
    ],
    escapeX:300, escapeY:148, duration:180,
  },
  {
    id:2, name:'SCHOOL CHAOS',
    bgColor:'#0A1A0A', floorColor:'#2A4A2A',
    objectives:['Pull fire alarm','Hack speakers','Release frogs'],
    platforms:[
      {x:0,   y:164, w:320, h:16, c:'#2A4A2A'},
      {x:0,   y:110, w:80,  h:8,  c:'#1A3A1A'},
      {x:160, y:100, w:80,  h:8,  c:'#1A3A1A'},
      {x:260, y:130, w:60,  h:8,  c:'#1A3A1A'},
    ],
    interactables:[
      {id:'alarm',  x:30,  y:100, w:12, h:20, type:'alarm',   points:30, chaosAdd:15, broken:false, color:'#FF0000'},
      {id:'speaker',x:175, y:90,  w:16, h:12, type:'speaker', points:25, chaosAdd:12, broken:false, color:'#888888'},
      {id:'frogs',  x:270, y:120, w:14, h:12, type:'frogs',   points:50, chaosAdd:25, broken:false, color:'#00BB00'},
    ],
    enemies:[
      {type:'teacher', x:200, y:150, hp:3, patrol:true, patrolDist:80, dir:1,  patrolTimer:0},
      {type:'mama',    x:80,  y:150, hp:3, patrol:true, patrolDist:50, dir:-1, patrolTimer:0},
    ],
    escapeX:310, escapeY:148, duration:240,
  },
  {
    id:3, name:'BEACH CHAOS',
    bgColor:'#87CEEB', floorColor:'#F4D03F',
    objectives:['Summon wave','Scare sunbathers','Steal ice cream'],
    platforms:[
      {x:0,   y:164, w:320, h:16, c:'#F4D03F'},
      {x:60,  y:140, w:40,  h:8,  c:'#E8C934'},
      {x:180, y:130, w:50,  h:8,  c:'#E8C934'},
    ],
    interactables:[
      {id:'wave',    x:10,  y:140, w:20, h:20, type:'wave',  points:60, chaosAdd:30, broken:false, color:'#4A90D9'},
      {id:'chair',   x:100, y:155, w:20, h:10, type:'toy',   points:10, chaosAdd:5,  broken:false, color:'#FF6B35'},
      {id:'icecream',x:200, y:120, w:10, h:16, type:'juice', points:15, chaosAdd:8,  broken:false, color:'#FFB3D9'},
    ],
    enemies:[
      {type:'mama', x:150, y:150, hp:3, patrol:true, patrolDist:70, dir:1,  patrolTimer:0},
      {type:'mama', x:280, y:150, hp:3, patrol:true, patrolDist:30, dir:-1, patrolTimer:0},
    ],
    escapeX:305, escapeY:148, duration:300,
  },
  {
    id:4, name:'MALL DISASTER',
    bgColor:'#1A0A1A', floorColor:'#3A1A3A',
    objectives:['Break displays','Ride escalator','Escape security'],
    platforms:[
      {x:0,   y:164, w:320, h:16, c:'#3A1A3A'},
      {x:40,  y:120, w:50,  h:8,  c:'#5A2A5A'},
      {x:140, y:100, w:60,  h:8,  c:'#5A2A5A'},
      {x:240, y:120, w:60,  h:8,  c:'#5A2A5A'},
    ],
    interactables:[
      {id:'display1',x:50,  y:110, w:16, h:14, type:'toy',   points:20, chaosAdd:10, broken:false, color:'#FF69B4'},
      {id:'display2',x:155, y:90,  w:16, h:14, type:'toy',   points:20, chaosAdd:10, broken:false, color:'#87CEEB'},
      {id:'shop',    x:260, y:110, w:20, h:14, type:'alarm', points:30, chaosAdd:15, broken:false, color:'#FF4500'},
    ],
    enemies:[
      {type:'guard', x:180, y:150, hp:3, patrol:true, patrolDist:100, dir:1,  patrolTimer:0},
      {type:'guard', x:80,  y:150, hp:3, patrol:true, patrolDist:60,  dir:-1, patrolTimer:0},
      {type:'mama',  x:260, y:150, hp:3, patrol:true, patrolDist:40,  dir:1,  patrolTimer:0},
    ],
    escapeX:305, escapeY:148, duration:300,
  },
  {
    id:5, name:'NEIGHBORHOOD',
    bgColor:'#0A1A0A', floorColor:'#2A5A1A',
    objectives:['Start 3 fires','Flood street','Wake neighbors'],
    platforms:[
      {x:0,   y:164, w:320, h:16, c:'#2A5A1A'},
      {x:30,  y:130, w:40,  h:8,  c:'#3A6A2A'},
      {x:120, y:120, w:50,  h:8,  c:'#3A6A2A'},
      {x:220, y:110, w:60,  h:8,  c:'#3A6A2A'},
      {x:80,  y:90,  w:30,  h:8,  c:'#3A6A2A'},
    ],
    interactables:[
      {id:'fire1',  x:40,  y:120, w:14, h:14, type:'alarm', points:25, chaosAdd:12, broken:false, color:'#FF4500'},
      {id:'fire2',  x:130, y:110, w:14, h:14, type:'alarm', points:25, chaosAdd:12, broken:false, color:'#FF6600'},
      {id:'hydrant',x:230, y:100, w:10, h:16, type:'wave',  points:40, chaosAdd:20, broken:false, color:'#FF3333'},
    ],
    enemies:[
      {type:'guard', x:200, y:150, hp:3, patrol:true, patrolDist:80, dir:1,  patrolTimer:0},
      {type:'guard', x:60,  y:150, hp:3, patrol:true, patrolDist:50, dir:-1, patrolTimer:0},
      {type:'mama',  x:280, y:150, hp:3, patrol:true, patrolDist:30, dir:1,  patrolTimer:0},
    ],
    escapeX:305, escapeY:148, duration:360,
  },
  {
    id:6, name:'VOID.EXE',
    bgColor:'#000000', floorColor:'#1A0030',
    objectives:['Survive the void','Defeat Chaos Mama','Escape reality'],
    platforms:[
      {x:0,   y:164, w:320, h:16, c:'#1A0030'},
      {x:40,  y:130, w:50,  h:8,  c:'#2A0050'},
      {x:140, y:110, w:60,  h:8,  c:'#3A0070'},
      {x:250, y:90,  w:50,  h:8,  c:'#2A0050'},
      {x:80,  y:70,  w:40,  h:8,  c:'#3A0060'},
    ],
    interactables:[],
    enemies:[],
    escapeX:305, escapeY:148, duration:420,
    isBossLevel:true,
  },
]

// ── 7. PLAYER & SKIN SYSTEM ──────────────────────────────────
const PLAYER_W = 10, PLAYER_H = 14
const GRAVITY   = 0.35
const JUMP_POWER = -6.5
const MOVE_SPEED = 1.8

const SKINS = {
  default:   { color:'#FF69B4', darkColor:'#CC4490', name:'Piggy',      cost:0     },
  beach:     { color:'#FFB347', darkColor:'#CC8020', name:'Beach Pig',  cost:100   },
  vampire:   { color:'#C0392B', darkColor:'#922B21', name:'Vampire Pig',cost:250   },
  robot:     { color:'#95A5A6', darkColor:'#7F8C8D', name:'Robot Pig',  cost:500   },
  ghost:     { color:'#ECF0F1', darkColor:'#BDC3C7', name:'Ghost Pig',  cost:750   },
  corrupted: { color:'#9B59B6', darkColor:'#6C3483', name:'Glitch Pig', cost:1000  },
}

const DEATH_REASONS = [
  'GROUNDED FOREVER','MATH PRISON','VACUUM CLEANER ATTACK',
  'SWALLOWED BY BLACK HOLE','EATEN BY DAD','TIMEOUT CORNER',
  'SENT TO BED WITHOUT DINNER','GAME CRASHED','TOO MUCH CHAOS',
]

function initGame(levelIdx) {
  if (levelIdx === undefined) levelIdx = 0
  const lvl = LEVELS[levelIdx]
  return {
    x: 30, y: lvl.platforms[0].y - PLAYER_H,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    animFrame: 0, animTimer: 0,
    skin: save.activeSkin,
    invincible: 0,
    level: levelIdx,
    chaos: 0,
    score: 0,
    coins: 0,
    hp: 3, maxHp: 3,
    time: 0,
    objectives: lvl.objectives.map(o => ({ text:o, done:false })),
    objectivesCompleted: 0,
    platforms:    lvl.platforms.map(p => Object.assign({}, p)),
    interactables:lvl.interactables.map(i => Object.assign({}, i)),
    enemies:      lvl.enemies.map(e => Object.assign({}, e)),
    projectiles: [],
    dead: false, deathTimer: 0,
    deathReason: 'GROUNDED!',
    escaped: false,
    escapeActive: false,
    escapeTimer: 30,    // seconds to reach exit once chaos=100%
    bossSpawned: false, bossDefeated: false,
    boss: null,
    shakeX: 0, shakeY: 0, shakeDur: 0,
    flashColor: null, flashTimer: 0,
    cameraX: 0,
    nextRandomEvent: 8,
    nearItem: null,
    scorePopups: [],
    spawnTimer:  3,      // countdown to next object spawn
    comboCount:  0,
    comboTimer:  0,
    enemySpawnChaos: 0,  // last chaos level we spawned extra enemies at
  }
}

// ── DRAWING HELPERS ──────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}

// ── BACKGROUND PARTICLES ─────────────────────────────────────
const bgParticles = Array.from({length: 20}, () => ({
  x: Math.random() * VW,
  y: Math.random() * VH,
  vx: (Math.random() - 0.5) * 0.15,
  vy: -0.1 - Math.random() * 0.2,
  c: ['#FF69B4','#9B59B6','#00FFFF'][Math.floor(Math.random() * 3)]
}))

function updateBgParticles() {
  bgParticles.forEach(p => {
    p.x += p.vx; p.y += p.vy
    if (p.y < -4) { p.y = VH + 4; p.x = Math.random() * VW }
    if (p.x < -4) p.x = VW + 4
    if (p.x > VW + 4) p.x = -4
  })
}

// ── SHARED ANIMATED MENU BG ──────────────────────────────────
function drawMenuBg() {
  ctx.fillStyle = '#0A0A0F'; ctx.fillRect(0, 0, VW, VH)
  ctx.fillStyle = 'rgba(26,10,46,0.8)'; ctx.fillRect(0, 0, VW, VH)
  const go = (menuTime * 20) % 12
  ctx.strokeStyle = 'rgba(0,255,255,0.10)'; ctx.lineWidth = 0.5
  for (let y = -go; y < VH; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke() }
  for (let x = 0; x < VW; x += 20)  { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VH); ctx.stroke() }
  bgParticles.forEach(p => {
    ctx.fillStyle = p.c; ctx.globalAlpha = 0.5
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
    ctx.globalAlpha = 1
  })
}

// ── PLAYER DRAW ──────────────────────────────────────────────
function drawPlayer(g) {
  if (g.invincible > 0 && Math.floor(g.invincible * 10) % 2 === 0) return
  const skin = SKINS[g.skin] || SKINS['default']
  const bc = skin.color, dc = skin.darkColor
  const flip = !g.facingRight

  // Virtual coords (for positioning)
  const vhx = g.x - g.cameraX, vhy = g.y
  // Sprite is 16×20 virtual units centered on hitbox
  const pw = 16, ph = 20
  const vpx = vhx - (pw - PLAYER_W) / 2
  const vpy = vhy - (ph - PLAYER_H)
  // Screen coords
  const px = spx(vpx), py = spy(vpy)

  // Bob in virtual units → scale to screen
  const bobV = g.onGround && Math.abs(g.vx) > 0.3 ? Math.sin(g.animFrame * 0.8) : 0
  const bob  = ss(bobV)
  // Helper: draw pixel-rect at virtual offset from sprite origin (px,py)
  const r = (dx, dy, dw, dh) => vc.fillRect(Math.round(px+ss(dx)), Math.round(py+ss(dy)), Math.max(1,ss(dw)), Math.max(1,ss(dh)))

  vc.save()
  if (flip) { vc.translate(px+ss(pw)/2, 0); vc.scale(-1,1); vc.translate(-(px+ss(pw)/2),0) }

  // Ground shadow
  vc.fillStyle = 'rgba(0,0,0,0.28)'
  vc.fillRect(Math.round(px+ss(2)), Math.round(spy(g.y+PLAYER_H)), ss(pw-4), Math.max(2,ss(2)))

  // Legs
  const walk = Math.floor(g.animFrame % 4)
  vc.fillStyle = dc
  if (!g.onGround) {
    r(3, ph-4, 4, 3); r(10, ph-4, 4, 3)  // tucked
  } else if (walk < 2) {
    r(2, ph-1, 4, 5); r(10, ph-3, 4, 3)
  } else {
    r(2, ph-3, 4, 3); r(10, ph-1, 4, 5)
  }

  // Chaos aura
  if (g.chaos > 50) {
    const gp = (g.chaos-50)/50
    vc.globalAlpha = gp*0.38*(0.6+0.4*Math.sin(menuTime*8))
    vc.fillStyle = g.chaos>75?'#FF0000':'#9B59B6'
    vc.fillRect(Math.round(px+ss(-3)), Math.round(py+ss(-2)-bob), ss(pw+6), ss(ph+6))
    vc.globalAlpha = 1
  }

  // Body oval
  vc.fillStyle = bc
  r(2, 11+bobV, pw-4, 9); r(1, 12+bobV, pw-2, 7); r(3, 10+bobV, pw-6, 10)

  // Head
  r(3, 1+bobV, pw-6, 11); r(4, 0+bobV, pw-8, 12); r(2, 3+bobV, pw-4, 8)

  // Ears
  vc.fillStyle = bc
  r(3, -4+bobV, 5, 5); r(9, -4+bobV, 5, 5)
  vc.fillStyle = '#FFB6C1'
  r(4, -3+bobV, 2, 3); r(10, -3+bobV, 2, 3)

  // Snout
  vc.fillStyle = '#FFB6C1'
  r(11, 5+bobV, 6, 5); r(10, 6+bobV, 7, 3)
  vc.fillStyle = dc
  r(12, 7+bobV, 2, 2); r(15, 7+bobV, 2, 2)

  // Eyes
  vc.fillStyle = '#FFFFFF'
  r(4, 3+bobV, 4, 4); r(8, 3+bobV, 4, 4)
  vc.fillStyle = '#111'
  r(6, 4+bobV, 2, 2); r(10, 4+bobV, 2, 2)

  // Mouth
  vc.fillStyle = dc
  r(8, 8+bobV, 3, 1)

  vc.restore()

  // Trail particles when moving
  if (Math.abs(g.vx) > 0.8 && Math.random() > 0.4) {
    spawnParticle(px+pw/2, py+ph-4+bob, bc, (Math.random()-0.5)*0.4, -0.2, 0.25+Math.random()*0.2, 1)
  }
  // Jump sparkle
  if (!g.onGround && g.vy < -3 && Math.random() > 0.5) {
    spawnParticle(px+pw/2, py+ph+bob, '#00FFFF', (Math.random()-0.5)*1.5, Math.random()*0.5, 0.2, 1)
  }
}

// ── 8. ENEMY SYSTEM ──────────────────────────────────────────
function updateEnemies(g, dt) {
  g.enemies.forEach(e => {
    if (e.hp <= 0) return
    e.patrolTimer = (e.patrolTimer || 0) + dt
    e.x += e.dir * 0.8 * (1 + g.chaos / 200)
    if (e.patrolTimer > 2 + Math.random()) { e.dir *= -1; e.patrolTimer = 0 }

    // Chase at high chaos
    if (g.chaos > 50) {
      const dx = g.x - e.x
      if (Math.abs(dx) < 80) e.x += Math.sign(dx) * 0.5
    }

    e.x = Math.max(8, Math.min(VW - 8 + g.cameraX, e.x))

    // Hurt player
    const ex = e.x - g.cameraX
    if (!g.dead && g.invincible <= 0 &&
        Math.abs(ex - g.x) < 12 && Math.abs(e.y - g.y) < 14) {
      g.hp--; g.invincible = 2.0
      triggerShakeG(g, 3, 0.3); sfxHurt()
      spawnBurst(g.x, g.y, C.RED, 6)
      if (g.hp <= 0) {
        g.dead = true
        g.deathReason = DEATH_REASONS[Math.floor(Math.random() * DEATH_REASONS.length)]
      }
    }
  })
}

function drawHpBar(x, y, w, hp, maxHp) {
  // x,y,w already in screen coords
  const bh = Math.max(2, ss(2))
  vc.fillStyle = '#333'; vc.fillRect(x, y, w, bh)
  vc.fillStyle = '#00FF00'; vc.fillRect(x, y, Math.round(w*(hp/maxHp)), bh)
}

function drawEnemy(e, cameraX) {
  const exV = e.x - cameraX, eyV = e.y
  if (exV < -40 || exV > VW_BASE + 40) return
  const ex = spx(exV), ey = spy(eyV)
  const w = ss(12), h = ss(14)

  // Helper: draw relative to enemy top-left using virtual offsets
  const er = (dx,dy,dw,dh) => vc.fillRect(Math.round(ex+ss(dx)), Math.round(ey+ss(dy)), Math.max(1,ss(dw)), Math.max(1,ss(dh)))

  if (e.type === 'mama') {
    vc.fillStyle='#CC3380'; er(-1,3,14,9)
    vc.fillStyle='#FF4499'; er(0,0,12,7)
    vc.fillStyle='#AA2255'; er(7,2,5,3)
    vc.fillStyle='#FF0000'; er(1,1,2,2); er(8,1,2,2)
    vc.fillStyle='#000';    er(1,0,3,1); er(8,0,3,1)
    drawHpBar(ex, ey-ss(6), w, e.hp, 3)
  } else if (e.type === 'teacher') {
    vc.fillStyle='#3A5A8A'; er(0,4,12,8)
    vc.fillStyle='#5A7AAA'; er(1,0,10,6)
    vc.fillStyle='#000';    er(2,1,2,2); er(7,1,2,2)
    vc.fillStyle='#888';    er(1,1,3,3); er(6,1,3,3)
    drawHpBar(ex, ey-ss(6), w, e.hp, 3)
  } else if (e.type === 'guard') {
    vc.fillStyle='#2A2A5A'; er(0,4,12,8)
    vc.fillStyle='#4A4A7A'; er(1,0,10,6)
    vc.fillStyle='#FF8800'; er(3,5,4,4)
    vc.fillStyle='#000';    er(2,1,2,2); er(7,1,2,2)
    drawHpBar(ex, ey-ss(6), w, e.hp, 3)
  }
}

// ── 9. BOSS SYSTEM ───────────────────────────────────────────
function initBoss() {
  return {
    x: VW * 0.7, y: 80,
    hp: 20, maxHp: 20,
    phase: 1,
    vx: 1.5, vy: 0,
    attackTimer: 0,
    size: 22,
  }
}

function updateBoss(g, dt) {
  const b = g.boss
  if (!b || b.hp <= 0) return

  if (b.hp < b.maxHp * 0.66 && b.phase < 2) { b.phase = 2; b.vx = 2.5 }
  if (b.hp < b.maxHp * 0.33 && b.phase < 3) { b.phase = 3; b.vx = 4; triggerShakeG(g, 5, 0.5) }

  b.x += b.vx; b.vy += GRAVITY * 0.5; b.y += b.vy
  if (b.x < 20 || b.x > VW - 20) b.vx *= -1
  if (b.y > 140) { b.y = 140; b.vy = -3 - b.phase }

  b.attackTimer -= dt
  if (b.attackTimer <= 0) {
    b.attackTimer = 2 - b.phase * 0.4
    const dx = g.x - b.x, dy = g.y - b.y
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
    g.projectiles.push({
      x: b.x, y: b.y,
      vx: dx / dist * 3, vy: dy / dist * 3,
      life: 3, r: 3, color: '#9B59B6',
    })
    sfxBoss()
  }

  const bx = b.x - g.cameraX
  if (!g.dead && g.invincible <= 0 &&
      Math.abs(bx - g.x) < b.size && Math.abs(b.y - g.y) < b.size) {
    g.hp--; g.invincible = 2.0; sfxHurt()
    triggerShakeG(g, 4, 0.3)
    if (g.hp <= 0) { g.dead = true; g.deathReason = 'CHAOS CONSUMED YOU!' }
  }
}

function drawBoss(b, cameraX) {
  const bx = Math.round(b.x - cameraX), by = Math.round(b.y)
  const s  = b.size
  const phaseColor = b.phase === 1 ? '#CC3380' : b.phase === 2 ? '#9B1A60' : '#660000'

  vc.fillStyle = phaseColor
  vc.fillRect(bx - s/2, by - s/2, s, s)

  if (b.phase >= 2) {
    vc.fillStyle = 'rgba(150,0,255,' + (b.phase === 3 ? '0.5' : '0.25') + ')'
    vc.fillRect(bx - s/2 + 2, by - s/2 + 2, s - 4, s - 4)
  }

  vc.fillStyle = '#FF0000'
  vc.fillRect(bx - Math.floor(s/4) - 3, by - Math.floor(s/4), 5, 5)
  vc.fillRect(bx + Math.floor(s/4) - 2, by - Math.floor(s/4), 5, 5)

  const bw = 40
  vc.fillStyle = '#333'; vc.fillRect(bx - bw/2, by - s/2 - 8, bw, 4)
  vc.fillStyle = '#FF3333'
  vc.fillRect(bx - bw/2, by - s/2 - 8, Math.round(bw * (b.hp / b.maxHp)), 4)

  vc.fillStyle = '#FFF'
  vc.font = '4px monospace'; vc.textAlign = 'center'
  vc.fillText('CHAOS MAMA', bx, by - s/2 - 11)
  vc.textAlign = 'left'
}

// ── 10. PHYSICS & COLLISION ───────────────────────────────────
function updatePlayer(g, dt) {
  if (g.dead || g.escaped) return

  g.vx = 0
  if (keys.left)  { g.vx = -MOVE_SPEED; g.facingRight = false }
  if (keys.right) { g.vx =  MOVE_SPEED; g.facingRight = true  }

  g.vy += GRAVITY
  if (g.vy > 8) g.vy = 8

  if ((keys.jump || keys.up) && g.onGround) {
    g.vy = JUMP_POWER; sfxJump()
    keys.jump = false; keys.up = false
  }

  g.x += g.vx
  g.x = Math.max(0, Math.min(VW + g.cameraX - PLAYER_W, g.x))

  g.y += g.vy
  g.onGround = false

  g.platforms.forEach(p => {
    const gRight = g.x + PLAYER_W, gBot = g.y + PLAYER_H
    if (g.x < p.x + p.w && gRight > p.x && gBot > p.y && gBot < p.y + p.h + 8 && g.vy >= 0) {
      g.y = p.y - PLAYER_H; g.vy = 0; g.onGround = true
    }
  })

  // Camera — simple follow
  const levelW = 320
  g.cameraX = Math.max(0, Math.min(g.x - VW * 0.35, levelW - VW))

  if (g.y > VH + 20) {
    g.dead = true
    g.deathReason = DEATH_REASONS[Math.floor(Math.random() * DEATH_REASONS.length)]
  }

  if (g.invincible > 0) g.invincible -= dt

  g.animTimer += dt
  if (g.animTimer > 0.12) { g.animFrame++; g.animTimer = 0 }

  g.time += dt

  g.nextRandomEvent -= dt
  if (g.nextRandomEvent <= 0) {
    triggerRandomEvent(g)
    g.nextRandomEvent = 8 + Math.random() * 12
  }
}

// ── 11. INTERACTABLES ────────────────────────────────────────
function checkInteract(g) {
  g.nearItem = null
  g.interactables.forEach(item => {
    if (item.broken) return
    const ix   = item.x - g.cameraX
    const dist = Math.abs(ix + item.w/2 - g.x - PLAYER_W/2) + Math.abs(item.y + item.h/2 - g.y - PLAYER_H/2)
    if (dist < 18) g.nearItem = item
  })
}

function doAction(g) {
  if (!g.nearItem || g.nearItem.broken) return
  const item = g.nearItem
  item.broken = true

  // Combo system — chain breaks within 3s for multiplier
  g.comboCount++
  g.comboTimer = 3.0
  const multi = Math.min(g.comboCount, 5)
  const pts = item.points * multi
  const coins = Math.ceil(pts / 5)

  g.score += pts
  g.coins += coins
  g.chaos  = Math.min(100, g.chaos + item.chaosAdd)
  spawnBurst(item.x - g.cameraX + item.w/2, item.y + item.h/2, multi > 2 ? '#F1C40F' : C.PINK, multi > 1 ? 18 : 10)
  sfxBreak(); sfxChaos()
  triggerShakeG(g, multi > 1 ? 3 : 2, 0.2)
  checkObjectives(g)

  if (!g.scorePopups) g.scorePopups = []
  const popText = multi > 1 ? `+${pts} x${multi}!` : `+${pts}`
  g.scorePopups.push({
    text: popText,
    x: item.x + item.w/2,
    y: item.y - 4,
    life: 1.2,
    color: multi > 2 ? '#F1C40F' : multi > 1 ? '#FF69B4' : '#F1C40F',
    vy: -0.5
  })
  g.nearItem = null
}

function checkObjectives(g) {
  const broken = g.interactables.filter(i => i.broken).length
  const total  = g.interactables.length
  if (total === 0) return
  g.objectives.forEach((obj, i) => {
    if (!obj.done && broken >= Math.ceil(total * (i + 1) / g.objectives.length)) {
      obj.done = true; g.objectivesCompleted++
      spawnBurst(VW / 2, VH / 2, '#FFD700', 20)
      sfxWin()
    }
  })
}

// ── 12. CHAOS METER ──────────────────────────────────────────
function drawChaosBar(g) {
  const pct = g.chaos / 100
  const bx = canvas.width/2 - ss(45), by = ss(2), bw = ss(90), bh = ss(8)
  // Background
  vc.fillStyle = 'rgba(0,0,0,0.7)'; vc.fillRect(bx-1, by-1, bw+2, bh+4)
  // Gradient fill (green→yellow→orange→red)
  const col = pct<0.25?'#2ECC71':pct<0.5?'#F1C40F':pct<0.75?'#E67E22':'#E74C3C'
  const pulse = g.chaos>75 ? 0.7+0.3*Math.sin(menuTime*10) : 1
  vc.save()
  if (g.chaos>75) { vc.shadowColor=col; vc.shadowBlur=6*pulse }
  vc.fillStyle=col; vc.fillRect(bx, by, Math.round(bw*pct), bh)
  // Shine strip on top
  vc.fillStyle='rgba(255,255,255,0.25)'; vc.fillRect(bx, by, Math.round(bw*pct), 2)
  // Neon border — purple normally, red when danger
  vc.shadowColor=g.chaos>75?col:'#9B59B6'; vc.shadowBlur=g.chaos>75?6:3
  vc.strokeStyle=g.chaos>75?col:'#9B59B6'; vc.lineWidth=0.75
  vc.strokeRect(bx, by, bw, bh)
  vc.shadowBlur=0
  // Label
  vc.fillStyle='#FFF'; vc.font='4px monospace'; vc.textAlign='center'
  vc.fillText('CHAOS '+Math.round(g.chaos)+'%', VW/2, by+bh+5)
  // Escape warning banner at 100%
  if (g.chaos>=100) {
    const wig=Math.floor(menuTime*20)%2===0?0:1
    vc.fillStyle=`rgba(200,0,0,${0.5+0.3*Math.sin(menuTime*12)})`
    vc.fillRect(0, 17, VW, 11)
    vc.shadowColor='#FF0000'; vc.shadowBlur=4
    vc.fillStyle='#FFF'; vc.font='7px monospace'
    vc.fillText('ESCAPE NOW!', VW/2+wig, 25)
    vc.shadowBlur=0
  }
  vc.restore()
}

// ── 13. HUD ──────────────────────────────────────────────────
function hudPanel(x, y, w, h, borderCol) {
  vc.fillStyle='rgba(0,0,15,0.72)'; vc.fillRect(x,y,w,h)
  vc.shadowColor=borderCol; vc.shadowBlur=Math.max(4,ss(4))
  vc.strokeStyle=borderCol; vc.lineWidth=Math.max(1,ss(0.75)); vc.strokeRect(x,y,w,h)
  vc.fillStyle='rgba(255,255,255,0.08)'; vc.fillRect(x,y,w,Math.max(1,ss(2)))
  vc.shadowBlur=0
}

function drawHUD(g) {
  const fs = Math.max(10, ss(5))   // font size
  const fsBig = Math.max(12, ss(6))

  // Top-left: score + coins — neon CYAN panel
  const panW = ss(70), panH = ss(26)
  hudPanel(_SOX+ss(2), _SOY+ss(2), panW, panH, '#00FFFF')
  vc.font=`${fs}px monospace`; vc.textAlign='left'
  vc.fillStyle='rgba(255,255,255,0.5)'; vc.fillText('SCORE', _SOX+ss(5), _SOY+ss(10))
  vc.shadowColor='#00FFFF'; vc.shadowBlur=ss(5)
  vc.fillStyle='#00FFFF'; vc.font=`${fsBig}px monospace`
  vc.fillText(g.score.toLocaleString(), _SOX+ss(5), _SOY+ss(18))
  vc.shadowBlur=0
  vc.fillStyle='#F1C40F'; vc.font=`${fs}px monospace`
  vc.fillText('$ '+g.coins, _SOX+ss(5), _SOY+ss(26))

  // Top-right: level name + timer — neon PINK panel
  const rx = _SOX+ss(VW_BASE)-ss(70)
  hudPanel(rx, _SOY+ss(2), panW, panH, '#FF69B4')
  vc.textAlign='right'
  vc.shadowColor='#FF69B4'; vc.shadowBlur=ss(5)
  vc.fillStyle='#FF69B4'; vc.font=`${fs}px monospace`
  vc.fillText('LV.'+(g.level+1), _SOX+ss(VW_BASE)-ss(5), _SOY+ss(11))
  vc.shadowBlur=0
  vc.fillStyle='rgba(255,255,255,0.6)'; vc.font=`${Math.max(8,ss(4))}px monospace`
  vc.fillText(LEVELS[g.level].name.substring(0,14), _SOX+ss(VW_BASE)-ss(5), _SOY+ss(18))
  const timeLeft=Math.max(0,LEVELS[g.level].duration-g.time)
  const timerBlink=timeLeft<5&&Math.floor(menuTime*4)%2===0
  const timerCol=timeLeft<15?(timerBlink?'#FF0000':'#FF5500'):'#FFF'
  vc.fillStyle=timerCol; vc.font=`${fsBig}px monospace`
  vc.fillText(Math.ceil(timeLeft)+'s', _SOX+ss(VW_BASE)-ss(5), _SOY+ss(26))

  // Chaos bar — center top
  drawChaosBar(g)

  // Bottom-left: HP hearts
  for (let i = 0; i < g.maxHp; i++) {
    vc.fillStyle = i < g.hp ? '#FF3333' : '#333'
    const hx2 = _SOX+ss(4+i*11), hy2 = _SOY+ss(VH_BASE-11)
    const hs = Math.max(3,ss(4))
    vc.fillRect(hx2, hy2, hs, hs)
    vc.fillRect(hx2-ss(2), hy2-ss(2), Math.max(2,ss(3)), Math.max(2,ss(3)))
    vc.fillRect(hx2+ss(4), hy2-ss(2), Math.max(2,ss(3)), Math.max(2,ss(3)))
    vc.fillRect(hx2-ss(1), hy2-ss(3), Math.max(3,ss(4)), Math.max(1,ss(2)))
  }

  // Bottom-center: interact hint
  if (g.nearItem && !g.nearItem.broken) {
    const hintW=ss(60), hintH=ss(12)
    const hintX=canvas.width/2-hintW/2, hintY=_SOY+ss(VH_BASE)-hintH-ss(4)
    vc.fillStyle='rgba(0,0,0,0.75)'; vc.fillRect(hintX, hintY, hintW, hintH)
    vc.shadowColor='#F1C40F'; vc.shadowBlur=ss(6)
    vc.fillStyle='#F1C40F'; vc.font=`${Math.max(9,ss(5))}px monospace`; vc.textAlign='center'
    vc.fillText('[SPACE] '+g.nearItem.type.toUpperCase(), canvas.width/2, hintY+hintH*0.72)
    vc.shadowBlur=0
  }

  // Bottom-right: objectives
  const objFs=Math.max(8,ss(4))
  vc.textAlign='right'; vc.font=`${objFs}px monospace`
  g.objectives.forEach((obj,i)=>{
    vc.fillStyle=obj.done?'#2ECC71':'rgba(255,255,255,0.5)'
    vc.fillText((obj.done?'✓ ':'· ')+obj.text.substring(0,16), _SOX+ss(VW_BASE)-ss(2), _SOY+ss(VH_BASE)-ss(16)+i*ss(7))
  })

  // Escape countdown HUD
  if (g.escapeActive && !g.escaped && !g.dead) {
    const etLeft = Math.ceil(Math.max(0, g.escapeTimer))
    const etCol = etLeft < 10 ? (Math.floor(menuTime*6)%2===0?'#FF0000':'#FF6600') : '#00FFFF'
    const etFs = Math.max(10, ss(5))
    const etW = ss(80), etH = ss(13)
    const etX = canvas.width/2 - etW/2, etY = _SOY + ss(14)
    vc.fillStyle = 'rgba(0,0,0,0.75)'; vc.fillRect(etX, etY, etW, etH)
    vc.shadowColor = etCol; vc.shadowBlur = ss(8)
    vc.fillStyle = etCol; vc.font = `bold ${etFs}px monospace`; vc.textAlign = 'center'
    vc.fillText(`REACH EXIT: ${etLeft}s`, canvas.width/2, etY + etH*0.75)
    vc.shadowBlur = 0
    // Arrow pointing right toward exit
    vc.fillStyle = '#00FFFF'; vc.font = `${Math.max(8,ss(6))}px monospace`
    vc.fillText('→ →', _SOX + ss(VW-20), etY + etH*0.75)
  }

  // Combo display
  if (g.comboCount > 1 && g.comboTimer > 0) {
    const cPulse = 0.85 + 0.15*Math.sin(menuTime*12)
    const cfs = Math.max(12, ss(7)*cPulse)
    vc.shadowColor='#F1C40F'; vc.shadowBlur=ss(12)
    vc.fillStyle='#F1C40F'; vc.font=`bold ${cfs}px monospace`; vc.textAlign='center'
    vc.fillText(`COMBO x${Math.min(g.comboCount,5)}!`, canvas.width/2, canvas.height/2 - ss(30))
    // Timer bar
    const ctW=ss(60), ctX=canvas.width/2-ctW/2, ctY=canvas.height/2-ss(24)
    vc.fillStyle='rgba(0,0,0,0.5)'; vc.fillRect(ctX,ctY,ctW,ss(4))
    vc.fillStyle='#F1C40F'; vc.fillRect(ctX,ctY,Math.round(ctW*g.comboTimer/3),ss(4))
    vc.shadowBlur=0
  }

  // "KEEP CAUSING CHAOS!" when nothing to break and chaos decaying
  const activeNow = g.interactables.filter(i=>!i.broken).length
  if (activeNow === 0 && g.chaos > 5 && !g.escapeActive && Math.floor(menuTime*2)%2===0) {
    vc.shadowColor='#E74C3C'; vc.shadowBlur=ss(8)
    vc.fillStyle='#E74C3C'; vc.font=`bold ${Math.max(9,ss(5))}px monospace`; vc.textAlign='center'
    vc.fillText('KEEP CAUSING CHAOS!', canvas.width/2, _SOY+ss(VH_BASE)-ss(28))
    vc.shadowBlur=0
  }

  // Boss hint
  if (g.level===5 && !g.bossSpawned) {
    vc.fillStyle='#FFD700'; vc.textAlign='center'; vc.font=`${Math.max(9,ss(5))}px monospace`
    vc.fillText('RAISE CHAOS TO 40% TO SUMMON BOSS!', canvas.width/2, canvas.height/2-ss(20))
  }

  // Score popups (in screen space)
  if (!g.scorePopups) g.scorePopups = []
  const dt_approx=0.016
  g.scorePopups=g.scorePopups.filter(p=>{
    p.y+=p.vy; p.x+=(Math.random()-0.5)*0.3; p.life-=dt_approx
    const a=Math.max(0,Math.min(1,p.life))
    vc.globalAlpha=a; vc.fillStyle=p.color
    vc.font=`${Math.max(12,ss(6))}px monospace`; vc.textAlign='center'
    vc.shadowColor=p.color; vc.shadowBlur=ss(5)
    vc.fillText(p.text, spx(p.x-g.cameraX), spy(p.y))
    vc.globalAlpha=1; vc.shadowBlur=0
    return p.life>0
  })

  vc.textAlign = 'left'
}

// ── 14. LEVEL RENDERING ──────────────────────────────────────
function lightenColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return '#' +
    Math.min(255, r + 30).toString(16).padStart(2, '0') +
    Math.min(255, g + 30).toString(16).padStart(2, '0') +
    Math.min(255, b + 30).toString(16).padStart(2, '0')
}

function drawBackground(g, lvl) {
  // Apply scale transform so all virtual coords map to native resolution
  vc.save()
  vc.translate(_SOX, _SOY)
  vc.scale(_S, _S)
  switch (lvl.id) {
    case 1: { // Bedroom — soft purple night
      vc.fillStyle = '#2A1540'; vc.fillRect(0, 0, VW, VH)
      // Window frame
      vc.fillStyle = '#1A3A5A'; vc.fillRect(240, 20, 50, 50)
      vc.fillStyle = '#87CEEB'; vc.fillRect(242, 22, 22, 22); vc.fillRect(266, 22, 22, 22)
      vc.fillRect(242, 46, 22, 22); vc.fillRect(266, 46, 22, 22)
      vc.fillStyle = '#4A3060'; vc.fillRect(263, 22, 3, 46); vc.fillRect(242, 43, 46, 3)
      // Moon
      vc.fillStyle = '#FFFACD'; vc.fillRect(250, 28, 12, 12); vc.fillRect(252, 26, 8, 2)
      // Stars
      vc.fillStyle = 'rgba(255,255,220,0.6)'
      ;[[10,15],[30,8],[200,25],[300,12],[15,50]].forEach(function(s) { vc.fillRect(s[0], s[1], 1, 1); vc.fillRect(s[0]+1, s[1], 1, 1) })
      // Wallpaper dots
      vc.fillStyle = 'rgba(160,100,220,0.12)'
      for (let x = 0; x < VW; x += 16) for (let y = 0; y < VH; y += 16) vc.fillRect(x + 7, y + 7, 2, 2)
      // Rug/floor
      vc.fillStyle = '#3D2060'; vc.fillRect(0, 155, VW, 9)
      vc.fillStyle = 'rgba(255,200,100,0.15)'
      for (let x = 0; x < VW; x += 10) vc.fillRect(x, 155, 5, 9)
      break
    }
    case 2: { // School — yellow classroom
      vc.fillStyle = '#D4C17F'; vc.fillRect(0, 0, VW, VH)
      vc.fillStyle = '#2C6E3F'; vc.fillRect(0, 30, VW, 60)
      vc.fillStyle = 'rgba(255,255,255,0.15)'; vc.font = '6px monospace'; vc.textAlign = 'left'
      vc.fillText('2+2=5  ABC  XYZ', 10, 50)
      vc.fillText('HOMEWORK DUE', 10, 65)
      vc.fillStyle = '#CCC'; vc.fillRect(0, 140, VW, VH)
      vc.fillStyle = '#AAA'
      for (let x = 0; x < VW; x += 20) vc.fillRect(x, 140, 1, VH)
      for (let y = 140; y < VH; y += 15) vc.fillRect(0, y, VW, 1)
      break
    }
    case 3: { // Beach — sunny
      vc.fillStyle = '#87CEEB'; vc.fillRect(0, 0, VW, 100)
      vc.fillStyle = '#B0E2FF'; vc.fillRect(0, 0, VW, 50)
      // Sun
      vc.fillStyle = '#FFD700'; vc.fillRect(260, 10, 22, 22)
      vc.fillStyle = 'rgba(255,220,0,0.4)'
      for (let a = 0; a < 8; a++) {
        const ra = a * Math.PI / 4
        const rx = 271 + Math.cos(ra) * 15, ry = 21 + Math.sin(ra) * 15
        vc.fillRect(rx, ry, 3, 3)
      }
      // Sea
      vc.fillStyle = '#1A78C2'; vc.fillRect(0, 100, VW, 64)
      vc.fillStyle = 'rgba(255,255,255,0.25)'
      for (let x = 0; x < VW; x += 30) vc.fillRect(x + ((menuTime * 15) | 0) % 30, 110, 15, 2)
      // Sandy ground
      vc.fillStyle = '#F4D03F'; vc.fillRect(0, 148, VW, VH)
      // Palm tree
      vc.fillStyle = '#5D4037'; vc.fillRect(40, 115, 5, 35)
      vc.fillStyle = '#2ECC71'
      ;[[-15,-8,20,8],[-10,-16,18,6],[0,-20,12,6],[10,-12,16,6],[8,-5,18,8]].forEach(function(t) {
        vc.fillRect(40 + t[0], 115 + t[1], t[2], t[3])
      })
      break
    }
    case 4: { // Mall — bright neon
      vc.fillStyle = '#F0E6FF'; vc.fillRect(0, 0, VW, VH)
      vc.font = '5px monospace'; vc.textAlign = 'center'
      ;[['SALE',40,'#FF69B4'],['SHOP',120,'#00FFFF'],['FOOD',200,'#F1C40F'],['EXIT',290,'#E74C3C']].forEach(function(s) {
        vc.fillStyle = 'rgba(0,0,0,0.5)'; vc.fillRect(s[1] - 14, 25, 28, 12)
        vc.shadowColor = s[2]; vc.shadowBlur = 6; vc.fillStyle = s[2]
        vc.fillText(s[0], s[1], 34); vc.shadowBlur = 0
      })
      vc.fillStyle = '#E8D5FF'; vc.fillRect(0, 148, VW, VH)
      vc.fillStyle = 'rgba(255,255,255,0.4)'
      for (let x = 0; x < VW; x += 24) vc.fillRect(x, 148, 12, VH)
      break
    }
    case 5: { // Neighborhood — green suburban
      vc.fillStyle = '#87CEEB'; vc.fillRect(0, 0, VW, 100)
      vc.fillStyle = '#FFFFFF'; vc.fillRect(100, 20, 40, 15); vc.fillRect(200, 15, 30, 12)
      ;[[20,80],[120,85],[220,75],[290,82]].forEach(function(h) {
        const hx = h[0], hy = h[1]
        vc.fillStyle = '#CC8844'; vc.fillRect(hx, hy, 30, 30)
        vc.fillStyle = '#882222'; vc.fillRect(hx - 3, hy - 8, 36, 10)
        vc.fillStyle = '#4A3A2A'; vc.fillRect(hx + 11, hy + 15, 8, 15)
        vc.fillStyle = '#87CEEB'; vc.fillRect(hx + 2, hy + 5, 8, 8); vc.fillRect(hx + 20, hy + 5, 8, 8)
      })
      vc.fillStyle = '#4CAF50'; vc.fillRect(0, 148, VW, VH)
      vc.fillStyle = '#388E3C'
      for (let x = 0; x < VW; x += 8) vc.fillRect(x, 148, 4, 3)
      break
    }
    case 6: { // Void — black hole chaos
      vc.fillStyle = '#000000'; vc.fillRect(0, 0, VW, VH)
      const vt = menuTime * 0.5
      for (let i = 0; i < 8; i++) {
        const a = vt + i * Math.PI / 4, r = 20 + i * 5
        const vx2 = VW/2 + Math.cos(a) * r, vy2 = VH/2 + Math.sin(a) * r
        vc.fillStyle = 'rgba(' + (100 + i * 15) + ',0,' + (150 + i * 10) + ',' + (0.3 + i * 0.05) + ')'
        vc.fillRect(vx2, vy2, 4 + i, 4 + i)
      }
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2 + (menuTime * 0.3)
        const r = 40 + i * 4
        const sx = VW_BASE/2 + Math.cos(angle) * r, sy = VH_BASE/2 + Math.sin(angle) * r
        vc.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.4) + ')'
        vc.fillRect(sx, sy, 1, 1)
      }
      if (Math.random() > 0.7) {
        vc.fillStyle = 'rgba(' + ((Math.random() * 255) | 0) + ',0,255,0.2)'
        vc.fillRect(0, (Math.random() * VH_BASE) | 0, VW_BASE, 2 + ((Math.random() * 5) | 0))
      }
      break
    }
  }
  vc.restore()  // end drawBackground scale transform
}

function drawLevel(g) {
  const lvl = LEVELS[g.level]
  // Clear full native canvas first, then fill virtual game area
  vc.fillStyle = '#000'; vc.fillRect(0, 0, canvas.width, canvas.height)
  vc.fillStyle = lvl.bgColor
  vc.fillRect(_SOX, _SOY, VW_BASE * _S, VH_BASE * _S)

  drawBackground(g, lvl)

  // Floating bg particles
  bgParticles.forEach(p => {
    vc.globalAlpha = 0.35; vc.fillStyle = p.c
    // Particles drift across the full screen area
    const bpx = _SOX + p.x * _S, bpy = _SOY + p.y * _S
    vc.fillRect(Math.round(bpx), Math.round(bpy), Math.max(2, ss(2)), Math.max(2, ss(2)))
    vc.globalAlpha = 1
  })

  g.platforms.forEach(p => {
    const px = spx(p.x - g.cameraX), py = spy(p.y)
    const pw = ss(p.w), ph = ss(p.h)
    vc.fillStyle = p.c; vc.fillRect(px, py, pw, ph)
    // Neon scrolling grid
    vc.fillStyle = 'rgba(0,255,255,0.10)'
    const gridOff = (g.cameraX * _S) % ss(10)
    const gridStep = Math.max(6, ss(10))
    for (let gx = px - gridOff % gridStep; gx < px + pw; gx += gridStep) vc.fillRect(gx, py, 1, ph)
    for (let gy = py; gy < py + ph; gy += Math.max(4, ss(6))) vc.fillRect(px, gy, pw, 1)
    // Top neon edges
    vc.fillStyle = 'rgba(255,0,255,0.65)'; vc.fillRect(px, py, pw, Math.max(1, ss(1)))
    vc.fillStyle = 'rgba(0,255,255,0.30)'; vc.fillRect(px, py + Math.max(1,ss(1)), pw, Math.max(1,ss(1)))
  })

  g.interactables.forEach(item => {
    if (item.broken) return
    const ix = spx(item.x - g.cameraX), iy = spy(item.y)
    const iw = ss(item.w), ih = ss(item.h)
    vc.fillStyle = item.color; vc.fillRect(ix, iy, iw, ih)
    // Label
    const fs = Math.max(8, ss(5))
    vc.fillStyle = '#FFF'; vc.font = `${fs}px monospace`; vc.textAlign = 'center'
    const labels = { toy:'TOY', juice:'JUICE', wall:'MARK', alarm:'!!', speaker:'SND', frogs:'FRG', wave:'~' }
    vc.fillText(labels[item.type]||'?', ix+iw/2, iy+ih/2+fs*0.35)
    vc.textAlign = 'left'
  })

  g.enemies.forEach(e => { if (e.hp > 0) drawEnemy(e, g.cameraX) })
  if (g.boss && g.boss.hp > 0) drawBoss(g.boss, g.cameraX)

  g.projectiles.forEach(p => {
    const px2 = spx(p.x - g.cameraX), py2 = spy(p.y), pr = ss(p.r)
    vc.fillStyle = p.color; vc.fillRect(px2-pr, py2-pr, pr*2, pr*2)
  })

  drawPlayer(g)
  drawParticles()

  // Escape door — always draw but much more prominent when escapeActive
  // Exit door — when escapeActive draw FIXED on right side of screen (always visible)
  if (g.escapeActive || g.objectivesCompleted >= g.objectives.length || g.bossDefeated || g.chaos >= 90) {
    const pulse = 0.55 + 0.45*Math.abs(Math.sin(menuTime * (g.escapeActive ? 7 : 2.5)))
    const doorCol = g.escapeActive ? '#00FFFF' : '#00FF88'

    // When escapeActive: fixed right-edge position always on screen
    const DOOR_W = ss(28), DOOR_H = ss(55)
    const DOOR_X = g.escapeActive
      ? _SOX + VW_BASE*_S - DOOR_W - ss(4)      // fixed right side of game area
      : spx(g.escapeX - g.cameraX)              // world position otherwise
    const DOOR_Y = g.escapeActive
      ? _SOY + VH_BASE*_S - DOOR_H - ss(16)     // above floor, fixed
      : spy(g.escapeY - 55)

    // Door frame fill
    vc.fillStyle = `rgba(0,10,30,0.85)`; vc.fillRect(DOOR_X, DOOR_Y, DOOR_W, DOOR_H)
    // Neon border + glow
    vc.shadowColor = doorCol; vc.shadowBlur = g.escapeActive ? ss(18)*pulse : ss(8)
    vc.strokeStyle = doorCol; vc.lineWidth = Math.max(2, ss(2))
    vc.strokeRect(DOOR_X, DOOR_Y, DOOR_W, DOOR_H)
    // Inner glow fill
    vc.fillStyle = `rgba(0,255,255,${0.08*pulse})`; vc.fillRect(DOOR_X, DOOR_Y, DOOR_W, DOOR_H)
    // Left shine strip
    vc.fillStyle = `rgba(255,255,255,${0.18*pulse})`; vc.fillRect(DOOR_X, DOOR_Y, ss(3), DOOR_H)
    vc.shadowBlur = 0

    // EXIT label above door
    const dfs = Math.max(10, ss(5))
    vc.fillStyle = doorCol; vc.font = `bold ${dfs}px monospace`; vc.textAlign = 'center'
    vc.shadowColor = doorCol; vc.shadowBlur = ss(8)
    vc.fillText('EXIT', DOOR_X+DOOR_W/2, DOOR_Y - ss(4))

    if (g.escapeActive) {
      // Pulsing arrows pointing to door
      const arrOff = Math.sin(menuTime*8)*ss(3)
      vc.fillStyle = '#00FFFF'; vc.font = `bold ${Math.max(14,ss(7))}px monospace`
      vc.fillText('→', DOOR_X+DOOR_W/2+arrOff, DOOR_Y+DOOR_H*0.55)
      // Scrolling arrow trail left of door
      vc.font = `${Math.max(10,ss(5))}px monospace`
      vc.fillStyle = `rgba(0,255,255,${0.5+0.3*Math.sin(menuTime*5)})`
      vc.fillText('→→→', DOOR_X - ss(30), DOOR_Y+DOOR_H*0.55)
      // Particle sparkles
      if (Math.random() > 0.55) {
        const sx = (DOOR_X + DOOR_W/2 - _SOX) / _S
        const sy = (DOOR_Y + DOOR_H*Math.random() - _SOY) / _S
        spawnParticle(sx, sy, '#00FFFF', (Math.random()-0.5)*0.8, -0.6-Math.random(), 0.5, 1)
      }
    }
    vc.shadowBlur = 0; vc.textAlign = 'left'
  }
}

// ── 15. RANDOM EVENTS ─────────────────────────────────────────
const RANDOM_EVENTS = [
  { name: 'GIANT DUCK!',   fn: g => { triggerShakeG(g, 5, 0.5); g.chaos = Math.min(100, g.chaos + 15); spawnBurst(VW/2, VH/2, '#F1C40F', 20) } },
  { name: 'FROG RAIN!',    fn: g => { for (let i = 0; i < 5; i++) spawnBurst(Math.random()*VW, 0, '#00BB00', 5) } },
  { name: 'METEOR!',       fn: g => { g.score += 100; g.chaos = Math.min(100, g.chaos + 20); triggerShakeG(g, 6, 0.6) } },
  { name: 'GHOST MODE!',   fn: g => { g.invincible = 3; spawnBurst(g.x, g.y, '#FFFFFF', 15) } },
  { name: 'COIN SHOWER!',  fn: g => { g.coins += 25; spawnBurst(g.x, g.y - 10, '#FFD700', 18); sfxCoin() } },
]

let eventPopup = null

function triggerRandomEvent(g) {
  const evt = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)]
  evt.fn(g)
  eventPopup = { text: evt.name, timer: 2.5 }
  sfxChaos()
}

// ── 16. PROJECTILES ──────────────────────────────────────────
function updateProjectiles(g, dt) {
  g.projectiles = g.projectiles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.life -= dt
    if (!g.dead && g.invincible <= 0 &&
        Math.abs(p.x - g.cameraX - g.x) < 8 && Math.abs(p.y - g.y) < 8) {
      g.hp--; g.invincible = 1.5; p.life = 0; sfxHurt(); triggerShakeG(g, 3, 0.2)
      if (g.hp <= 0) { g.dead = true; g.deathReason = 'ZAP! CHAOS GOT YOU!' }
    }
    return p.life > 0
  })
}

// ── 17. UPDATE LOOP ──────────────────────────────────────────
function triggerShakeG(g, intensity, dur) {
  g.shakeDur = dur; g.shakeX = intensity; g.shakeY = intensity
}

// ── SPAWN INTERACTABLE ────────────────────────────────────────
const SPAWN_TYPES = [
  {type:'toy',   color:'#FF69B4', w:10, h:12, points:10, chaosAdd:6,  label:'TOY'},
  {type:'juice', color:'#FF8C00', w:8,  h:14, points:15, chaosAdd:9,  label:'JCE'},
  {type:'toy',   color:'#87CEEB', w:11, h:11, points:10, chaosAdd:6,  label:'BLK'},
  {type:'alarm', color:'#FF0000', w:10, h:18, points:25, chaosAdd:14, label:'ALM'},
  {type:'toy',   color:'#F1C40F', w:13, h:10, points:12, chaosAdd:7,  label:'BK'},
  {type:'speaker',color:'#9B59B6',w:14, h:12, points:20, chaosAdd:11, label:'SPK'},
]

function spawnInteractable(g) {
  const def = SPAWN_TYPES[Math.floor(Math.random() * SPAWN_TYPES.length)]
  const platform = g.platforms[Math.floor(Math.random() * Math.max(1, g.platforms.length - 1))]
  const px = platform ? platform.x + Math.random() * (platform.w - def.w) : 20 + Math.random() * (VW_BASE - 40)
  const py = platform ? platform.y - def.h : VH_BASE - 40
  const id = 'spawn_' + Date.now() + '_' + Math.floor(Math.random()*9999)
  g.interactables.push({ id, x:px, y:py, w:def.w, h:def.h, type:def.type, color:def.color, points:def.points, chaosAdd:def.chaosAdd, label:def.label, broken:false, spawned:true })
}

function spawnExtraEnemy(g, side) {
  const platform = g.platforms[0]
  const ex = side === 'left' ? 20 : VW_BASE - 20
  const ey = platform ? platform.y - 14 : VH_BASE - 28
  g.enemies.push({ type:'mama', x:ex + g.cameraX, y:ey, hp:3, dir:side==='left'?1:-1, patrol:true, patrolDist:60, id:Math.random() })
}

function update(dt) {
  if (!game) return
  const g = game

  if (g.dead) {
    g.deathTimer = (g.deathTimer || 0) + dt
    updateParticles(dt)
    if (g.shakeDur > 0) {
      g.shakeDur -= dt
      g.shakeX = (Math.random() - 0.5) * 4 * Math.max(0, g.shakeDur)
      g.shakeY = (Math.random() - 0.5) * 4 * Math.max(0, g.shakeDur)
    } else { g.shakeX = 0; g.shakeY = 0 }
    if (g.deathTimer > 2.5) state = 'gameover'
    return
  }
  if (g.escaped) return

  g.nearItem = null
  updatePlayer(g, dt)
  checkInteract(g)
  updateEnemies(g, dt)
  updateBoss(g, dt)
  updateProjectiles(g, dt)
  updateParticles(dt)

  // ── Combo timer decay ─────────────────────────────────────────
  if (g.comboTimer > 0) { g.comboTimer -= dt; if (g.comboTimer <= 0) g.comboCount = 0 }

  // ── Object spawning — respawn every 3-5s ──────────────────────
  const activeItems = g.interactables.filter(i => !i.broken).length
  g.spawnTimer -= dt
  if (g.spawnTimer <= 0 && activeItems < 5 && !g.escapeActive) {
    spawnInteractable(g)
    g.spawnTimer = 3 + Math.random() * 2.5
    sfxCoin()
  }

  // ── Chaos dynamics ────────────────────────────────────────────
  // Faster fill when there are active objects (player has things to do)
  // Decay slowly if NO objects left (motivates breaking things quickly)
  const chaosSpeed = activeItems > 0
    ? 1.5 + g.time * 0.04   // rises faster over time
    : -4                     // decays if nothing to break
  g.chaos = Math.max(0, Math.min(100, g.chaos + chaosSpeed * dt))

  // ── Escalating enemies ────────────────────────────────────────
  if (g.chaos > 50 && g.enemySpawnChaos < 50 && g.enemies.length < 3) {
    spawnExtraEnemy(g, 'left'); g.enemySpawnChaos = 50
    sfxAlarm()
  }
  if (g.chaos > 75 && g.enemySpawnChaos < 75 && g.enemies.length < 4) {
    spawnExtraEnemy(g, 'right'); g.enemySpawnChaos = 75
    sfxAlarm()
  }
  // Enemies speed up at 90%+
  if (g.chaos > 90) {
    g.enemies.forEach(e => { if (e.hp > 0) e.patrolDist = Math.min(100, (e.patrolDist||60) + dt * 3) })
  }

  // Screen shake decay
  if (g.shakeDur > 0) {
    g.shakeDur -= dt
    g.shakeX = (Math.random() - 0.5) * 4 * Math.max(0, g.shakeDur)
    g.shakeY = (Math.random() - 0.5) * 4 * Math.max(0, g.shakeDur)
  } else { g.shakeX = 0; g.shakeY = 0 }

  if (eventPopup) { eventPopup.timer -= dt; if (eventPopup.timer <= 0) eventPopup = null }
  if (g.flashTimer > 0) g.flashTimer -= dt

  // Level 6 boss spawn
  if (g.level === 5 && !g.bossSpawned && g.chaos > 40) {
    g.boss = initBoss(); g.bossSpawned = true
    triggerShakeG(g, 8, 1.0); sfxBoss()
    g.objectives[0].done = true; g.objectives[1].done = true
    g.objectivesCompleted = 2
  }

  // Boss defeated
  if (g.boss && g.boss.hp <= 0 && !g.bossDefeated) {
    g.bossDefeated = true; g.score += 500; g.coins += 200
    spawnBurst(VW/2, VH/2, '#9B59B6', 30); sfxWin()
    g.chaos = 100
    g.objectives[2].done = true; g.objectivesCompleted = 3
    triggerShakeG(g, 6, 0.8)
  }

  // ── Escape system ─────────────────────────────────────────────
  // Activate escape mode at 100% chaos
  if (g.chaos >= 100 && !g.escapeActive && !g.dead) {
    g.escapeActive = true
    g.escapeTimer  = 30
    sfxAlarm()
    triggerShakeG(g, 5, 0.6)
    spawnBurst(g.escapeX - g.cameraX, g.escapeY - 20, '#00FFFF', 20)
    if (!g.scorePopups) g.scorePopups = []
    g.scorePopups.push({ text: 'ESCAPE NOW!', color: '#FF0000', x: VW/2, y: VH/2 - 20, life: 2.0, vy: -0.2 })
  }
  // Count down and kill if time expires
  if (g.escapeActive && !g.escaped && !g.dead) {
    g.escapeTimer -= dt
    // Alarm flash every second when < 10s
    if (g.escapeTimer < 10 && Math.floor(g.escapeTimer * 2) % 2 === 0) {
      g.flashColor = '#FF0000'; g.flashTimer = 0.08
    }
    if (g.escapeTimer <= 0) {
      g.dead = true
      g.deathReason = 'GROUNDED FOREVER!'
      sfxCrash()
      triggerShakeG(g, 8, 1.0)
    }
  }

  // Escape check
  // When escapeActive: door is fixed at right edge in screen space (VW-32 in virtual)
  // Map back to world x for collision
  const canEscape = g.escapeActive || g.objectivesCompleted >= g.objectives.length || g.bossDefeated
  const doorVX = g.escapeActive ? VW_BASE - 32 + g.cameraX : g.escapeX  // virtual world x of door
  if (canEscape && g.x + PLAYER_W > doorVX && g.x < doorVX + 28) {
    g.escaped = true
    g.score += 500; g.coins += 100   // escape bonus
    save.highScores[g.level] = Math.max(save.highScores[g.level], g.score)
    if (g.level + 1 < LEVELS.length) save.unlockedLevels[g.level + 1] = true
    save.coins += g.coins
    writeSave()
    state = 'levelcomplete'
    sfxWin()
  }

  // Stomp enemies — player lands on top
  g.enemies.forEach(e => {
    if (e.hp <= 0) return
    if (g.vy > 0 && g.x + PLAYER_W > e.x - 6 && g.x < e.x + 12 &&
        g.y + PLAYER_H > e.y && g.y + PLAYER_H < e.y + 8) {
      e.hp--; g.vy = -4
      spawnBurst(e.x - g.cameraX, e.y, C.YELLOW, 8)
      sfxBreak()
      if (e.hp <= 0) { g.score += 50; g.coins += 10; g.chaos = Math.min(100, g.chaos + 5) }
    }
  })
}

// ── 18. RENDER ───────────────────────────────────────────────
function drawPostFX() {
  const vg = vc.createRadialGradient(VW/2, VH/2, VH * 0.25, VW/2, VH/2, VW * 0.7)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  vc.fillStyle = vg; vc.fillRect(0, 0, VW, VH)
  vc.fillStyle = 'rgba(0,0,0,0.08)'
  for (let y = 0; y < VH; y += 2) vc.fillRect(0, y, VW, 1)
}

function render() {
  if (!game) return
  const g = game
  vc.save()
  vc.translate(Math.round((g.shakeX||0)*_S), Math.round((g.shakeY||0)*_S))
  drawLevel(g)
  drawHUD(g)

  if (eventPopup) {
    const alpha=Math.min(1,eventPopup.timer)
    vc.globalAlpha=alpha
    const epW=ss(80),epH=ss(14)
    vc.fillStyle='rgba(0,0,0,0.7)'; vc.fillRect(canvas.width/2-epW/2, canvas.height/2-epH/2, epW, epH)
    vc.fillStyle='#FF69B4'; vc.font=`${Math.max(10,ss(6))}px monospace`; vc.textAlign='center'
    vc.fillText(eventPopup.text, canvas.width/2, canvas.height/2+ss(2))
    vc.globalAlpha=1; vc.textAlign='left'
  }

  if (g.dead) {
    const fade=Math.min(0.8,(g.deathTimer||0)*0.4)
    vc.fillStyle='rgba(0,0,0,'+fade+')'; vc.fillRect(0, 0, canvas.width, canvas.height)
    vc.fillStyle='#FF0000'; vc.font=`${Math.max(16,ss(10))}px monospace`; vc.textAlign='center'
    vc.fillText('GROUNDED!', canvas.width/2, canvas.height/2-ss(8))
    vc.fillStyle='#FFF'; vc.font=`${Math.max(10,ss(5))}px monospace`
    vc.fillText(g.deathReason, canvas.width/2, canvas.height/2+ss(4))
    vc.textAlign='left'
  }

  if (g.flashTimer>0 && g.flashColor) {
    vc.fillStyle=g.flashColor; vc.globalAlpha=g.flashTimer*0.4
    vc.fillRect(0, 0, canvas.width, canvas.height); vc.globalAlpha=1
  }

  vc.restore()
}

// ── 19. BUTTON SYSTEM ────────────────────────────────────────
let menuItems  = []
let menuHovX   = -1
let menuHovY   = -1
let menuHovered = -1

function clearButtons() { menuItems = []; menuHovered = -1 }

function registerButton(x, y, w, h, action) {
  const idx = menuItems.length
  menuItems.push({ x, y, w, h, action })
  if (menuHovX >= x && menuHovX <= x + w && menuHovY >= y && menuHovY <= y + h) {
    menuHovered = idx
  }
}

function isHovered(x, y, w, h) {
  return menuHovX >= x && menuHovX <= x + w && menuHovY >= y && menuHovY <= y + h
}

function drawButton(x, y, w, h, text, highlighted, color) {
  if (color === undefined) color = '#FF69B4'
  const glow = highlighted ? 18 : 8
  ctx.save()
  ctx.shadowColor = color; ctx.shadowBlur = glow
  ctx.fillStyle = hexAlpha(color, highlighted ? 0.35 : 0.18)
  roundRect(ctx, x, y, w, h, 3)
  ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = highlighted ? 1.5 : 1
  roundRect(ctx, x, y, w, h, 3)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  roundRect(ctx, x, y, w, 2, 3)
  ctx.fill()
  ctx.shadowBlur = 4
  ctx.fillStyle = '#FFF'
  ctx.font = Math.min(6, h * 0.38) + 'px monospace'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w/2, y + h/2)
  ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0
  ctx.restore()
}

// Map real coords → virtual
function screenToVirtual(cx, cy) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const screenX = (cx - rect.left) * scaleX
  const screenY = (cy - rect.top)  * scaleY
  const scale = Math.min(canvas.width / VW, canvas.height / VH)
  const ox = (canvas.width  - VW * scale) / 2
  const oy = (canvas.height - VH * scale) / 2
  return { x: (screenX - ox) / scale, y: (screenY - oy) / scale }
}

function realToVirt(cx, cy) {
  const v = screenToVirtual(cx, cy)
  return { vx: v.x, vy: v.y }
}

function handleClick(cx, cy) {
  const v = screenToVirtual(cx, cy)
  for (const item of menuItems) {
    if (v.x >= item.x && v.x <= item.x + item.w && v.y >= item.y && v.y <= item.y + item.h) {
      item.action(v.x, v.y); sfxMenu(); return
    }
  }
}

function handleMouseMove(cx, cy) {
  const v = screenToVirtual(cx, cy)
  menuHovX = v.x; menuHovY = v.y
}

canvas.addEventListener('click',     e => handleClick(e.clientX, e.clientY))
canvas.addEventListener('mousemove', e => handleMouseMove(e.clientX, e.clientY))

// ── 20. TOUCH CONTROLS ───────────────────────────────────────
let touchStartX = 0, touchStartY = 0

canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  e.preventDefault()
  handleClick(e.touches[0].clientX, e.touches[0].clientY)
}, { passive: false })

canvas.addEventListener('touchmove', e => {
  if (state === 'playing') {
    const dx = e.touches[0].clientX - touchStartX
    const dy = e.touches[0].clientY - touchStartY
    keys.left  = dx < -20; keys.right = dx > 20
    if (dy < -30 && !keys.up) { keys.up = true; setTimeout(() => { keys.up = false }, 120) }
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && !keys._tapFired) {
      keys._tapFired = true
      if (game) doAction(game)
      setTimeout(() => { keys._tapFired = false }, 300)
    }
  }
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', e => {
  keys.left = false; keys.right = false
  e.preventDefault()
}, { passive: false })

// ── 21. KEYBOARD INPUT ────────────────────────────────────────
const keys = {}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = true
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') keys.up    = true
  if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') keys.down  = true
  if (e.key === ' ') { keys.space = true; e.preventDefault() }
  if (e.key === 'e' || e.key === 'E') keys.interact = true
  if (e.key === 'Escape') {
    if      (state === 'playing') state = 'paused'
    else if (state === 'paused')  state = 'playing'
    else if (state !== 'menu')    state = 'menu'
  }
})

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left  = false
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') keys.up    = false
  if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') keys.down  = false
  if (e.key === ' ')                                              keys.space = false
  if (e.key === 'e' || e.key === 'E')                            keys.interact = false
})

// ── 22. SCREEN RENDERERS ─────────────────────────────────────

let menuTime = 0
let selectedLevel = 0

// --- MENU ---
function renderMenu() {
  clearButtons()

  // Background
  ctx.fillStyle = '#0A0A0F'; ctx.fillRect(0, 0, VW, VH)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, VH)
  bgGrad.addColorStop(0, '#0A0A0F')
  bgGrad.addColorStop(1, '#1A0A2E')
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, VW, VH)

  // Scrolling cyan grid
  const gridOff = (menuTime * 20) % 12
  ctx.strokeStyle = 'rgba(0,255,255,0.15)'; ctx.lineWidth = 0.5
  for (let y = -gridOff; y < VH; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke() }
  for (let x = 0; x < VW; x += 20)        { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VH); ctx.stroke() }

  // Starfield
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ;[[12,8],[40,22],[80,6],[140,14],[190,5],[240,19],[290,9],[30,40],[100,35],[200,42],[260,30],[310,38],[55,55],[160,60],[280,55]].forEach(function(s, idx) {
    const twinkle = 0.3 + 0.4 * Math.sin(menuTime * 1.5 + idx * 0.8)
    ctx.globalAlpha = twinkle
    ctx.fillRect(s[0], s[1], 1, 1)
  })
  ctx.globalAlpha = 1

  // Ambient floating particles
  bgParticles.forEach(p => {
    ctx.fillStyle = p.c; ctx.globalAlpha = 0.5
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
    ctx.globalAlpha = 1
  })

  // Stats corners
  ctx.font = '5px monospace'
  const hiScore = save.highScores.reduce((a, b) => Math.max(a, b), 0)
  ctx.fillStyle = '#F1C40F'; ctx.textAlign = 'left'
  ctx.fillText('HI ' + hiScore.toLocaleString(), 3, 8)
  ctx.textAlign = 'right'
  ctx.fillText('COINS ' + save.coins.toLocaleString(), VW - 3, 8)

  // Title "PEPPA CHAOS"
  const titlePulse = 0.85 + 0.15 * Math.sin(menuTime * 3)
  const titleY = 35

  // PEPPA
  ctx.save()
  ctx.shadowColor = '#FF69B4'; ctx.shadowBlur = 20
  ctx.fillStyle = '#FF69B4'
  ctx.font = '14px monospace'; ctx.textAlign = 'center'
  ctx.translate(VW/2, titleY)
  ctx.scale(titlePulse, titlePulse)
  ctx.fillText('PEPPA', 0, 0)
  ctx.restore()

  // CHAOS with glitch
  const glitchOff = (Math.floor(menuTime * 2) % 2 === 0) ? 0 : (Math.random() > 0.7 ? (Math.random() - 0.5) * 3 : 0)
  ctx.save()
  ctx.shadowColor = '#9B59B6'; ctx.shadowBlur = 20
  ctx.fillStyle = '#9B59B6'
  ctx.font = '14px monospace'; ctx.textAlign = 'center'
  ctx.translate(VW/2 + glitchOff, titleY + 16)
  ctx.scale(titlePulse, titlePulse)
  ctx.fillText('CHAOS', 0, 0)
  ctx.restore()

  // Subtitle
  ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 4
  ctx.fillStyle = '#00FFFF'; ctx.font = '5px monospace'; ctx.textAlign = 'center'
  ctx.fillText('2D PIXEL CHAOS', VW/2, titleY + 26)
  ctx.shadowBlur = 0

  // Press start blink
  if (Math.floor(menuTime * 1.25) % 2 === 0) {
    ctx.fillStyle = '#FFFFFF'; ctx.font = '6px monospace'; ctx.textAlign = 'center'
    ctx.fillText('PRESS START', VW/2, titleY + 37)
  }

  // Buttons
  const bw = 80, bh = 12, bx = VW/2 - bw/2
  const btns = [
    { label: 'PLAY',        col: '#FF69B4', action: () => { startLevel(0) } },
    { label: 'LEVELS',      col: '#F1C40F', action: () => { state = 'levelSelect' } },
    { label: 'SHOP',        col: '#9B59B6', action: () => { state = 'shop' } },
    { label: 'SETTINGS',    col: '#00FFFF', action: () => { prevState = 'menu'; state = 'settings' } },
    { label: 'HOW TO PLAY', col: '#2ECC71', action: () => { state = 'howtoplay' } },
  ]
  const startBY = titleY + 46
  btns.forEach((b, i) => {
    const by = startBY + i * (bh + 3)
    const hi = isHovered(bx, by, bw, bh)
    drawButton(bx, by, bw, bh, b.label, hi, b.col)
    registerButton(bx, by, bw, bh, b.action)
  })

  ctx.textAlign = 'left'; ctx.shadowBlur = 0
}

// --- HOW TO PLAY ---
function renderHowToPlay() {
  clearButtons()
  drawMenuBg()
  ctx.fillStyle = '#2ECC71'; ctx.font = '7px monospace'; ctx.textAlign = 'center'
  ctx.fillText('HOW TO PLAY', VW/2, 16)
  const lines = [
    ['MOVE', 'A/D or LEFT/RIGHT'],
    ['JUMP', 'W or UP'],
    ['ACTION', 'SPACE or E'],
    ['PAUSE', 'ESC'],
  ]
  lines.forEach(function(pair, i) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '4px monospace'; ctx.textAlign = 'left'
    ctx.fillText(pair[0], 20, 30 + i * 15)
    ctx.fillStyle = '#00FFFF'; ctx.textAlign = 'right'; ctx.fillText(pair[1], VW - 20, 30 + i * 15)
  })
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '4px monospace'; ctx.textAlign = 'center'
  ctx.fillText('Break objects to fill CHAOS meter', VW/2, 92)
  ctx.fillText('Reach 90% to unlock EXIT', VW/2, 102)
  ctx.fillText('Escape before time runs out!', VW/2, 112)
  drawButton(VW/2 - 30, VH - 18, 60, 12, 'BACK', isHovered(VW/2 - 30, VH - 18, 60, 12), '#9B59B6')
  registerButton(VW/2 - 30, VH - 18, 60, 12, () => { state = 'menu' })
  ctx.textAlign = 'left'
}

// --- LEVEL SELECT ---
function renderLevelSelect() {
  clearButtons()
  drawMenuBg()
  ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 10
  ctx.fillStyle = '#00FFFF'; ctx.font = '8px monospace'; ctx.textAlign = 'center'
  ctx.fillText('SELECT LEVEL', VW/2, 18)
  ctx.shadowBlur = 0

  LEVELS.forEach((lvl, i) => {
    const col = i % 3, row = Math.floor(i / 3)
    const bx = 8 + col * 104, by = 28 + row * 66, bw = 96, bh = 56
    const unlocked = save.unlockedLevels[i]
    const hs = save.highScores[i]

    ctx.fillStyle = unlocked ? 'rgba(255,105,180,0.12)' : 'rgba(0,0,0,0.4)'
    roundRect(ctx, bx, by, bw, bh, 3); ctx.fill()
    ctx.strokeStyle = unlocked ? 'rgba(255,105,180,0.5)' : 'rgba(80,80,80,0.4)'
    ctx.lineWidth = unlocked ? 1 : 0.5; roundRect(ctx, bx, by, bw, bh, 3); ctx.stroke()

    if (!unlocked) {
      ctx.fillStyle = 'rgba(150,150,150,0.5)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
      ctx.fillText('?', bx + bw/2, by + bh/2 + 4)
    } else {
      ctx.fillStyle = '#FF69B4'; ctx.font = '5px monospace'; ctx.textAlign = 'center'
      ctx.fillText('LV.' + lvl.id, bx + bw/2, by + 12)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '4px monospace'
      const nameStr = lvl.name.length > 12 ? lvl.name.substring(0, 12) + '..' : lvl.name
      ctx.fillText(nameStr, bx + bw/2, by + 22)
      if (hs > 0) { ctx.fillStyle = '#F1C40F'; ctx.fillText('BEST:' + hs, bx + bw/2, by + 32) }
      drawButton(bx + 8, by + bh - 18, bw - 16, 12, 'PLAY', isHovered(bx + 8, by + bh - 18, bw - 16, 12), '#FF69B4')
      registerButton(bx + 8, by + bh - 18, bw - 16, 12, () => { startLevel(i) })
    }
  })

  drawButton(VW/2 - 30, VH - 14, 60, 10, 'BACK', isHovered(VW/2 - 30, VH - 14, 60, 10), '#9B59B6')
  registerButton(VW/2 - 30, VH - 14, 60, 10, () => { state = 'menu' })
  ctx.textAlign = 'left'
}

// --- PAUSE ---
function renderPause() {
  clearButtons()
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VW, VH)
  ctx.fillStyle = 'rgba(26,10,46,0.4)'; ctx.fillRect(0, 0, VW, VH)

  const pulse = 0.88 + 0.12 * Math.sin(menuTime * 4)
  ctx.shadowColor = '#FF69B4'; ctx.shadowBlur = 10
  ctx.fillStyle = '#FF69B4'; ctx.font = Math.round(10 * pulse) + 'px monospace'; ctx.textAlign = 'center'
  ctx.fillText('PAUSED', VW/2, 38)
  ctx.shadowBlur = 0

  const bw = 90, bh = 13, bx = VW/2 - bw/2
  const btns = [
    ['RESUME',   '#FF69B4', () => { state = 'playing' }],
    ['SETTINGS', '#00FFFF', () => { prevState = 'paused'; state = 'settings' }],
    ['RESTART',  '#2ECC71', () => { game = initGame(game ? game.level : 0); state = 'playing'; sfxConfirm() }],
    ['MENU',     '#9B59B6', () => { state = 'menu' }],
  ]
  btns.forEach((b, i) => {
    drawButton(bx, 52 + i * 18, bw, bh, b[0], isHovered(bx, 52 + i * 18, bw, bh), b[1])
    registerButton(bx, 52 + i * 18, bw, bh, b[2])
  })
  ctx.textAlign = 'left'
}

// --- GAME OVER ---
function renderGameOver() {
  clearButtons()
  ctx.fillStyle = '#0A0005'; ctx.fillRect(0, 0, VW, VH)
  ctx.fillStyle = 'rgba(200,0,0,0.2)'; ctx.fillRect(0, 0, VW, VH)

  // Glitch effect
  if (Math.random() > 0.6) {
    ctx.fillStyle = 'rgba(200,0,0,0.15)'
    ctx.fillRect(((Math.random() * VW) | 0) - 10, (Math.random() * VH) | 0, VW + 20, 3)
  }
  // Falling particles
  ctx.fillStyle = 'rgba(200,0,100,0.5)'
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(((i * 47 + menuTime * 15) % VW) | 0, ((menuTime * 30 + i * 23) % VH) | 0, 2, 2)
  }

  // GAME OVER title
  const gx = Math.random() > 0.9 ? (Math.random() - 0.5) * 4 : 0
  ctx.save()
  ctx.shadowColor = '#E74C3C'; ctx.shadowBlur = 20
  ctx.fillStyle = '#E74C3C'; ctx.font = '14px monospace'; ctx.textAlign = 'center'
  ctx.fillText('GAME OVER', VW/2 + gx, 30)
  ctx.restore()

  const msg = (game && game.deathReason) ? game.deathReason : 'GROUNDED!'
  ctx.fillStyle = '#9B59B6'; ctx.font = '5px monospace'; ctx.textAlign = 'center'
  ctx.fillText(msg, VW/2, 44)

  // Stats box
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VW/2 - 50, 50, 100, 54)
  ctx.strokeStyle = 'rgba(150,0,255,0.5)'; ctx.lineWidth = 0.5; ctx.strokeRect(VW/2 - 50, 50, 100, 54)
  const rows = [
    ['SCORE', (game ? game.score : 0).toLocaleString(), '#00FFFF'],
    ['BEST',  Math.max.apply(null, save.highScores).toLocaleString(), '#F1C40F'],
    ['COINS', '+' + (game ? game.coins : 0), '#F1C40F'],
    ['TIME',  ((game ? game.time : 0) | 0) + 's', '#FFF'],
  ]
  ctx.font = '4px monospace'
  rows.forEach((row, i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'left'; ctx.fillText(row[0], VW/2 - 46, 62 + i * 11)
    ctx.fillStyle = row[2]; ctx.textAlign = 'right'; ctx.fillText(row[1], VW/2 + 46, 62 + i * 11)
  })

  const bw = 80, bh = 12, bx = VW/2 - bw/2
  drawButton(bx, 112, bw, bh, 'PLAY AGAIN', isHovered(bx, 112, bw, bh), '#FF69B4')
  registerButton(bx, 112, bw, bh, () => { game = initGame(game ? game.level : 0); state = 'playing'; sfxConfirm() })
  drawButton(bx, 128, bw, bh, 'MENU', isHovered(bx, 128, bw, bh), '#9B59B6')
  registerButton(bx, 128, bw, bh, () => { state = 'menu' })
  ctx.textAlign = 'left'
}

// --- WIN ---
function renderLevelComplete() {
  clearButtons()
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, VW, VH)

  // Confetti
  for (let i = 0; i < 30; i++) {
    const cols = ['#00FFFF','#FF69B4','#F1C40F','#2ECC71','#9B59B6']
    ctx.fillStyle = cols[(i + Math.floor(menuTime*4)) % cols.length]
    ctx.fillRect(((i*47+menuTime*60)%VW)|0, ((menuTime*40+i*23)%VH)|0, 4, 4)
  }

  // LEVEL COMPLETE title
  const pulse = 0.88 + 0.12*Math.sin(menuTime*5)
  ctx.save()
  ctx.shadowColor = '#2ECC71'; ctx.shadowBlur = 30
  ctx.fillStyle = '#2ECC71'
  ctx.font = `bold ${Math.min(20, VW*0.065)*pulse|0}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText('LEVEL COMPLETE!', VW/2, VH*0.20)
  ctx.restore()

  // Level name
  ctx.fillStyle = '#FF69B4'; ctx.font = `bold ${Math.min(8,VW*0.025)|0}px monospace`; ctx.textAlign='center'
  ctx.fillText(LEVELS[game?.level||0]?.name||'', VW/2, VH*0.30)

  // Stats box
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(VW/2-55, VH*0.36, 110, 55)
  ctx.strokeStyle='rgba(0,255,255,0.5)'; ctx.lineWidth=0.75; ctx.strokeRect(VW/2-55, VH*0.36, 110, 55)
  const rows=[
    ['SCORE', (game?.score||0).toLocaleString(), '#00FFFF'],
    ['+BONUS','500 pts','#F1C40F'],
    ['COINS', '+'+(game?.coins||0), '#F1C40F'],
  ]
  ctx.font=`${Math.min(6,VW*0.019)|0}px monospace`
  rows.forEach(([l,v,c],i)=>{
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.textAlign='left'; ctx.fillText(l, VW/2-50, VH*0.36+14+i*14)
    ctx.fillStyle=c; ctx.textAlign='right'; ctx.fillText(v, VW/2+50, VH*0.36+14+i*14)
  })

  const bw=Math.min(90,VW*0.28), bh=13, bx=VW/2-bw/2
  const nextLvl=(game?.level||0)+1
  if (nextLvl < LEVELS.length) {
    drawButton(bx, VH*0.68, bw, bh, 'NEXT LEVEL', menuHovered===0, '#2ECC71')
    registerButton(bx, VH*0.68, bw, bh, ()=>{ game=initGame(nextLvl); state='playing'; sfxConfirm() })
    drawButton(bx, VH*0.68+bh+6, bw, bh, 'MENU', menuHovered===1, '#9B59B6')
    registerButton(bx, VH*0.68+bh+6, bw, bh, ()=>{ state='menu' })
  } else {
    // All levels done — final win
    ctx.fillStyle='#F1C40F'; ctx.font=`bold ${Math.min(8,VW*0.025)|0}px monospace`; ctx.textAlign='center'
    ctx.fillText('ALL LEVELS COMPLETE!', VW/2, VH*0.66)
    drawButton(bx, VH*0.72, bw, bh, 'MENU', menuHovered===0, '#FF69B4')
    registerButton(bx, VH*0.72, bw, bh, ()=>{ state='menu' })
  }
}

function renderWin() {
  clearButtons()
  ctx.fillStyle = '#0A1A0A'; ctx.fillRect(0, 0, VW, VH)

  // Confetti
  const confettiCols = ['#FF69B4','#9B59B6','#00FFFF','#F1C40F','#2ECC71']
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = confettiCols[(i + Math.floor(menuTime * 3)) % confettiCols.length]
    ctx.fillRect(((i * 31 + menuTime * 40) % VW) | 0, ((menuTime * 25 + i * 17) % VH) | 0, 3, 3)
  }

  const pulse = 0.9 + 0.1 * Math.sin(menuTime * 5)
  ctx.save()
  ctx.shadowColor = '#2ECC71'; ctx.shadowBlur = 15
  ctx.fillStyle = '#2ECC71'; ctx.font = ((12 * pulse) | 0) + 'px monospace'; ctx.textAlign = 'center'
  ctx.fillText('ESCAPED!', VW/2, 28)
  ctx.restore()

  ctx.fillStyle = '#FF69B4'; ctx.font = '5px monospace'; ctx.textAlign = 'center'
  ctx.fillText((game && LEVELS[game.level]) ? LEVELS[game.level].name : '', VW/2, 40)

  // Boss ending text
  if (game && game.level === 5 && game.bossDefeated) {
    const ending = game.score > 1000 ? 'SECRET ENDING: VOID QUEEN!' : game.score > 500 ? 'GOOD ENDING: HERO PIG!' : 'BAD ENDING: JUST LUCKY'
    ctx.fillStyle = '#00FFFF'; ctx.font = '4px monospace'; ctx.fillText(ending, VW/2, 46)
  }

  // Stats box
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(VW/2 - 50, 50, 100, 48)
  ctx.strokeStyle = 'rgba(46,204,113,0.5)'; ctx.lineWidth = 0.5; ctx.strokeRect(VW/2 - 50, 50, 100, 48)
  const winRows = [
    ['SCORE', (game ? game.score : 0).toLocaleString(), '#00FFFF'],
    ['COINS', '+' + (game ? game.coins : 0), '#F1C40F'],
    ['TIME',  ((game ? game.time : 0) | 0) + 's', '#FFF'],
  ]
  winRows.forEach((row, i) => {
    ctx.font = '4px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'left'
    ctx.fillText(row[0], VW/2 - 46, 62 + i * 13)
    ctx.fillStyle = row[2]; ctx.textAlign = 'right'; ctx.fillText(row[1], VW/2 + 46, 62 + i * 13)
  })

  const bw = 80, bx = VW/2 - bw/2
  const nextLvl = game ? game.level + 1 : -1
  if (nextLvl >= 0 && nextLvl < LEVELS.length && save.unlockedLevels[nextLvl]) {
    drawButton(bx, 102, bw, 12, 'NEXT LEVEL', isHovered(bx, 102, bw, 12), '#2ECC71')
    registerButton(bx, 102, bw, 12, () => { game = initGame(nextLvl); state = 'playing'; sfxConfirm() })
    drawButton(bx, 118, bw, 12, 'MENU', isHovered(bx, 118, bw, 12), '#9B59B6')
    registerButton(bx, 118, bw, 12, () => { state = 'menu' })
  } else {
    drawButton(bx, 102, bw, 12, 'PLAY AGAIN', isHovered(bx, 102, bw, 12), '#FF69B4')
    registerButton(bx, 102, bw, 12, () => { game = initGame(game ? game.level : 0); state = 'playing'; sfxConfirm() })
    drawButton(bx, 118, bw, 12, 'MENU', isHovered(bx, 118, bw, 12), '#9B59B6')
    registerButton(bx, 118, bw, 12, () => { state = 'menu' })
  }
  ctx.textAlign = 'left'
}

// --- SETTINGS ---
function renderSettings() {
  clearButtons()
  drawMenuBg()
  ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 8; ctx.fillStyle = '#00FFFF'
  ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText('SETTINGS', VW/2, 18); ctx.shadowBlur = 0

  const sliders = [['SFX VOL', 'sfxVol', 50], ['MUSIC VOL', 'musicVol', 80]]
  sliders.forEach(function(s) {
    const label = s[0], key = s[1], by = s[2]
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '5px monospace'; ctx.textAlign = 'left'
    ctx.fillText(label, 20, by)
    const val = (save.settings[key] !== undefined) ? save.settings[key] : 0.5
    const bw = 160, bx = 20
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx, by + 4, bw, 6)
    ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by + 4, bw, 6)
    ctx.fillStyle = '#00FFFF'; ctx.fillRect(bx, by + 4, Math.round(bw * val), 6)
    // Minus button
    drawButton(bx + bw + 4, by + 2, 12, 10, '-', isHovered(bx + bw + 4, by + 2, 12, 10), '#E74C3C')
    registerButton(bx + bw + 4, by + 2, 12, 10, () => {
      save.settings[key] = Math.max(0, (save.settings[key] || 0) - 0.1); writeSave()
    })
    // Plus button
    drawButton(bx + bw + 18, by + 2, 12, 10, '+', isHovered(bx + bw + 18, by + 2, 12, 10), '#2ECC71')
    registerButton(bx + bw + 18, by + 2, 12, 10, () => {
      save.settings[key] = Math.min(1, (save.settings[key] || 0) + 0.1); writeSave()
    })
  })

  drawButton(VW/2 - 30, VH - 18, 60, 12, 'BACK', isHovered(VW/2 - 30, VH - 18, 60, 12), '#9B59B6')
  registerButton(VW/2 - 30, VH - 18, 60, 12, () => { state = prevState || 'menu' })
  ctx.textAlign = 'left'
}

// --- SHOP ---
function renderShop() {
  clearButtons()
  drawMenuBg()
  ctx.shadowColor = '#F1C40F'; ctx.shadowBlur = 12
  ctx.fillStyle = '#F1C40F'; ctx.font = '8px monospace'; ctx.textAlign = 'center'
  ctx.fillText('SHOP', VW/2, 18)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#F1C40F'; ctx.font = '5px monospace'
  ctx.fillText('COINS: ' + save.coins.toLocaleString(), VW/2, 28)

  const skinList = Object.entries(SKINS)
  const priceList = { default:0, beach:500, vampire:1000, robot:2000, ghost:3000, corrupted:5000 }

  skinList.forEach(function(entry, i) {
    const id = entry[0], sk = entry[1]
    const col = Math.floor(i / 2), row = i % 2
    const bx = 8 + col * (VW/2 - 6), by = 36 + row * 36, bw = VW/2 - 14, bh = 28
    const owned = save.unlockedSkins.includes(id)
    const active = save.activeSkin === id
    const price = priceList[id] !== undefined ? priceList[id] : 999

    // Card background
    ctx.fillStyle = active ? 'rgba(255,105,180,0.25)' : owned ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.4)'
    roundRect(ctx, bx, by, bw, bh, 2); ctx.fill()
    ctx.strokeStyle = active ? '#FF69B4' : owned ? 'rgba(255,255,255,0.3)' : 'rgba(100,100,100,0.4)'
    ctx.lineWidth = active ? 1.5 : 0.75; roundRect(ctx, bx, by, bw, bh, 2); ctx.stroke()

    // Color swatch
    ctx.fillStyle = sk.color; ctx.fillRect(bx + 3, by + 3, 10, 10)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5; ctx.strokeRect(bx + 3, by + 3, 10, 10)

    // Name
    ctx.fillStyle = '#FFF'; ctx.font = '4px monospace'; ctx.textAlign = 'left'
    ctx.fillText(sk.name, bx + 16, by + 9)

    if (active) {
      ctx.fillStyle = '#2ECC71'; ctx.fillText('EQUIPPED', bx + 16, by + 18)
    } else if (owned) {
      drawButton(bx + bw - 26, by + 3, 24, 10, 'EQUIP', isHovered(bx + bw - 26, by + 3, 24, 10), '#2ECC71')
      registerButton(bx + bw - 26, by + 3, 24, 10, () => { save.activeSkin = id; writeSave(); sfxConfirm() })
    } else {
      ctx.fillStyle = save.coins >= price ? '#F1C40F' : 'rgba(200,200,200,0.4)'
      ctx.fillText(price + ' C', bx + 16, by + 18)
      if (save.coins >= price) {
        drawButton(bx + bw - 24, by + 3, 22, 10, 'BUY', isHovered(bx + bw - 24, by + 3, 22, 10), '#F1C40F')
        registerButton(bx + bw - 24, by + 3, 22, 10, () => {
          save.coins -= price
          save.unlockedSkins.push(id)
          writeSave(); sfxCoin(); sfxConfirm()
        })
      }
    }
  })

  drawButton(VW/2 - 30, VH - 18, 60, 12, 'BACK', isHovered(VW/2 - 30, VH - 18, 60, 12), '#9B59B6')
  registerButton(VW/2 - 30, VH - 18, 60, 12, () => { state = 'menu' })
  ctx.textAlign = 'left'
}

// ── 23. GAME FLOW ─────────────────────────────────────────────
function startLevel(idx) {
  if (idx === undefined) idx = 0
  getAC()
  game  = initGame(idx)
  state = 'playing'
  sfxConfirm()
  particles.length = 0
  eventPopup = null
}

// ── 24. MAIN LOOP ─────────────────────────────────────────────
let lastTime = 0

function gameLoop(ts) {
  const dt = Math.min((ts - (lastTime || ts)) / 1000, 0.05)
  lastTime = ts
  menuTime += dt

  if (state === 'playing') {
    // Clear and render game world to virtual canvas, then blit to screen
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    update(dt)
    render()
    if (keys.space)    { if (game) doAction(game); keys.space = false }
    if (keys.interact) { if (game) doAction(game); keys.interact = false }
    keys.jump = keys.up
    drawPostFX()
    if (game) {
      chaosEffect = game.chaos > 30 ? (game.chaos - 30) / 140 : 0
      if (chaosEffect > 0) drawGlitch()
    }
    updateBgParticles()
    blitToScreen()
  } else if (state === 'paused') {
    // Game world on vc, pause overlay on ctx at native resolution
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    render()
    blitToScreen()
    beginMenuDraw()
    renderPause()
    endMenuDraw()
  } else {
    // All other states: menus draw directly to ctx at native resolution
    updateBgParticles()
    beginMenuDraw()
    if      (state === 'menu')        renderMenu()
    else if (state === 'levelSelect') renderLevelSelect()
    else if (state === 'gameover')      renderGameOver()
    else if (state === 'levelcomplete') renderLevelComplete()
    else if (state === 'win')           renderWin()
    else if (state === 'shop')        renderShop()
    else if (state === 'settings')    renderSettings()
    else if (state === 'howtoplay')   renderHowToPlay()
    endMenuDraw()
  }

  requestAnimationFrame(gameLoop)
}

// ── BOOT ──────────────────────────────────────────────────────
resize()
requestAnimationFrame(gameLoop)
