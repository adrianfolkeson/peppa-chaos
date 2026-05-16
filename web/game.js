// ============================================================
//  PEPPA CHAOS — Complete 2D Pixel-Art Chaos Sidescroller
//  Virtual 320×180, scaled to fill browser. All vanilla JS.
// ============================================================

// ── 1. CONSTANTS & CANVAS ────────────────────────────────────
const VW = 320, VH = 180

const virtualCanvas = document.createElement('canvas')
virtualCanvas.width  = VW
virtualCanvas.height = VH
const vc = virtualCanvas.getContext('2d')
vc.imageSmoothingEnabled = false

const canvas = document.getElementById('gameCanvas')
const ctx    = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false

function resize() {
  canvas.width  = canvas.offsetWidth  || window.innerWidth
  canvas.height = canvas.offsetHeight || window.innerHeight
}
window.addEventListener('resize', resize)
resize()

function blitToScreen() {
  ctx.imageSmoothingEnabled = false
  const scale = Math.min(canvas.width / VW, canvas.height / VH)
  const ox = (canvas.width  - VW * scale) / 2
  const oy = (canvas.height - VH * scale) / 2
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(virtualCanvas, ox, oy, VW * scale, VH * scale)
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
    vc.fillRect(Math.round(p.x - p.size/2), Math.round(p.y - p.size/2), p.size, p.size)
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

function drawScanlines() {
  vc.fillStyle = 'rgba(0,0,0,0.15)'
  for (let y = 0; y < VH; y += 2) vc.fillRect(0, y, VW, 1)
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
    bossSpawned: false, bossDefeated: false,
    boss: null,
    shakeX: 0, shakeY: 0, shakeDur: 0,
    flashColor: null, flashTimer: 0,
    cameraX: 0,
    nextRandomEvent: 8,
    nearItem: null,
  }
}

// ── PLAYER DRAW ──────────────────────────────────────────────
function drawPlayer(g) {
  const px   = Math.round(g.x - g.cameraX)
  const py   = Math.round(g.y)
  const flip = !g.facingRight

  if (g.invincible > 0 && Math.floor(g.invincible * 10) % 2 === 0) return

  const skin = SKINS[g.skin] || SKINS['default']
  const bodyC = skin.color

  vc.save()
  if (flip) {
    vc.translate(px + PLAYER_W / 2, 0)
    vc.scale(-1, 1)
    vc.translate(-(px + PLAYER_W / 2), 0)
  }

  const walk = Math.floor(g.animFrame % 4)

  // Legs
  vc.fillStyle = skin.darkColor
  if (g.onGround) {
    if (walk < 2) {
      vc.fillRect(px,     py + 11, 3, 3)
      vc.fillRect(px + 7, py + 12, 3, 2)
    } else {
      vc.fillRect(px + 1, py + 11, 3, 3)
      vc.fillRect(px + 6, py + 11, 3, 3)
    }
  } else {
    vc.fillRect(px + 1, py + 11, 3, 3)
    vc.fillRect(px + 6, py + 11, 3, 3)
  }

  // Body
  vc.fillStyle = bodyC
  vc.fillRect(px, py + 4, PLAYER_W, 8)

  // Head
  vc.fillRect(px + 1, py, PLAYER_W - 2, 6)

  // Snout
  vc.fillStyle = skin.darkColor
  vc.fillRect(px + 6, py + 2, 4, 3)

  // Eyes
  vc.fillStyle = '#111111'
  vc.fillRect(px + 2, py + 1, 2, 2)
  vc.fillRect(px + 6, py + 1, 2, 2)

  // Nostrils
  vc.fillStyle = skin.darkColor
  vc.fillRect(px + 7, py + 3, 1, 1)
  vc.fillRect(px + 9, py + 3, 1, 1)

  // Ears
  vc.fillStyle = bodyC
  vc.fillRect(px,     py - 2, 3, 3)
  vc.fillRect(px + 7, py - 2, 3, 3)

  // Chaos aura
  if (g.chaos > 50) {
    const glowC = g.chaos > 75 ? '#FF0000' : '#FF69B4'
    vc.globalAlpha = (g.chaos - 50) / 100
    vc.fillStyle   = glowC
    vc.fillRect(px - 2, py - 2, PLAYER_W + 4, PLAYER_H + 4)
    vc.globalAlpha = 1
  }

  vc.restore()
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
  vc.fillStyle = '#333'; vc.fillRect(x, y, w, 2)
  vc.fillStyle = '#00FF00'
  vc.fillRect(x, y, Math.round(w * (hp / maxHp)), 2)
}

function drawEnemy(e, cameraX) {
  const ex = Math.round(e.x - cameraX)
  const ey = Math.round(e.y)
  const w = 12, h = 14
  if (ex < -20 || ex > VW + 20) return

  if (e.type === 'mama') {
    vc.fillStyle = '#CC3380'
    vc.fillRect(ex - 1, ey + 3, w + 2, 9)
    vc.fillStyle = '#FF4499'
    vc.fillRect(ex, ey, w, 7)
    vc.fillStyle = '#AA2255'
    vc.fillRect(ex + 7, ey + 2, 5, 3)
    vc.fillStyle = '#FF0000'
    vc.fillRect(ex + 1, ey + 1, 2, 2)
    vc.fillRect(ex + 8, ey + 1, 2, 2)
    vc.fillStyle = '#000000'
    vc.fillRect(ex + 1, ey, 3, 1)
    vc.fillRect(ex + 8, ey, 3, 1)
    drawHpBar(ex, ey - 5, w, e.hp, 3)
  } else if (e.type === 'teacher') {
    vc.fillStyle = '#3A5A8A'
    vc.fillRect(ex, ey + 4, w, 8)
    vc.fillStyle = '#5A7AAA'
    vc.fillRect(ex + 1, ey, w - 2, 6)
    vc.fillStyle = '#000'
    vc.fillRect(ex + 2, ey + 1, 2, 2)
    vc.fillRect(ex + 7, ey + 1, 2, 2)
    vc.fillStyle = '#888'
    vc.fillRect(ex + 1, ey + 1, 3, 3)
    vc.fillRect(ex + 6, ey + 1, 3, 3)
    drawHpBar(ex, ey - 5, w, e.hp, 3)
  } else if (e.type === 'guard') {
    vc.fillStyle = '#2A2A5A'
    vc.fillRect(ex, ey + 4, w, 8)
    vc.fillStyle = '#4A4A7A'
    vc.fillRect(ex + 1, ey, w - 2, 6)
    vc.fillStyle = '#FF8800'
    vc.fillRect(ex + 3, ey + 5, 4, 4)
    vc.fillStyle = '#000'
    vc.fillRect(ex + 2, ey + 1, 2, 2)
    vc.fillRect(ex + 7, ey + 1, 2, 2)
    drawHpBar(ex, ey - 5, w, e.hp, 3)
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
  g.score += item.points
  g.coins += Math.ceil(item.points / 5)
  g.chaos  = Math.min(100, g.chaos + item.chaosAdd)
  spawnBurst(item.x - g.cameraX + item.w/2, item.y + item.h/2, C.PINK, 12)
  sfxBreak(); sfxChaos()
  triggerShakeG(g, 2, 0.2)
  checkObjectives(g)
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
  const bx = 4, by = 4, bw = 60, bh = 6
  vc.fillStyle = '#222'; vc.fillRect(bx, by, bw, bh)
  const col = pct < 0.25 ? '#00FF00' : pct < 0.5 ? '#FFFF00' : pct < 0.75 ? '#FF8800' : '#FF0000'
  vc.fillStyle = col
  vc.fillRect(bx, by, Math.round(bw * pct), bh)
  vc.strokeStyle = '#FFF'; vc.lineWidth = 0.5
  vc.strokeRect(bx, by, bw, bh)
  vc.fillStyle = '#FFF'; vc.font = '4px monospace'; vc.textAlign = 'left'
  vc.fillText('CHAOS', bx, by - 1)
  if (g.chaos >= 100) {
    vc.fillStyle = 'rgba(255,0,0,' + (0.3 + 0.3 * Math.sin(Date.now() * 0.01)) + ')'
    vc.fillRect(0, 0, VW, VH)
    vc.fillStyle = '#FFF'; vc.textAlign = 'center'; vc.font = '8px monospace'
    vc.fillText('ESCAPE NOW!', VW / 2, VH / 2)
    vc.textAlign = 'left'
  }
}

// ── 13. HUD ──────────────────────────────────────────────────
function drawHUD(g) {
  // HP hearts
  for (let i = 0; i < g.maxHp; i++) {
    vc.fillStyle = i < g.hp ? '#FF3333' : '#333'
    vc.fillRect(4 + i * 10, 14, 8, 7)
    vc.fillRect(5 + i * 10, 13, 6, 2)
    vc.fillRect(4 + i * 10, 14, 3, 2)
    vc.fillRect(7 + i * 10, 14, 3, 2)
  }
  // Score
  vc.fillStyle = '#FFD700'; vc.font = '5px monospace'; vc.textAlign = 'right'
  vc.fillText(g.score + 'pts', VW - 4, 9)
  // Level name
  vc.fillStyle = '#FFF'; vc.textAlign = 'center'
  vc.fillText('LV.' + (g.level + 1) + ': ' + LEVELS[g.level].name, VW / 2, 9)
  // Objectives
  vc.textAlign = 'right'; vc.font = '4px monospace'
  g.objectives.forEach((obj, i) => {
    vc.fillStyle = obj.done ? '#00FF88' : '#AAAAFF'
    vc.fillText((obj.done ? '✓ ' : 'o ') + obj.text, VW - 2, 18 + i * 7)
  })
  // Chaos bar
  drawChaosBar(g)
  // Interact hint
  if (g.nearItem && !g.nearItem.broken) {
    vc.fillStyle = 'rgba(0,0,0,0.7)'; vc.fillRect(VW/2 - 30, VH - 18, 60, 10)
    vc.fillStyle = '#FFF'; vc.textAlign = 'center'; vc.font = '4px monospace'
    vc.fillText('[SPC/E] ' + g.nearItem.type.toUpperCase(), VW / 2, VH - 11)
  }
  // Boss objective note for level 6
  if (g.level === 5 && !g.bossSpawned) {
    vc.fillStyle = '#FFD700'; vc.textAlign = 'center'; vc.font = '4px monospace'
    vc.fillText('RAISE CHAOS TO 40% TO SUMMON BOSS', VW / 2, VH / 2 - 20)
  }
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
  if (lvl.id === 1) {
    vc.fillStyle = '#2A1A4A'; vc.fillRect(0, 80, VW, 84)
    vc.fillStyle = '#87CEEB'; vc.fillRect(240, 40, 50, 40)
    vc.fillStyle = '#4A4A8A'
    vc.fillRect(240, 40, 2, 40); vc.fillRect(265, 40, 2, 40); vc.fillRect(240, 59, 50, 2)
  } else if (lvl.id === 2) {
    vc.fillStyle = '#0A2A0A'; vc.fillRect(0, 0, VW, VH)
    // Chalkboard
    vc.fillStyle = '#1A4A1A'; vc.fillRect(20, 20, 80, 50)
    vc.fillStyle = '#FFF'; vc.font = '4px monospace'; vc.textAlign = 'left'
    vc.fillText('2+2=5', 30, 45)
    vc.textAlign = 'left'
  } else if (lvl.id === 3) {
    vc.fillStyle = '#87CEEB'; vc.fillRect(0, 0, VW, 100)
    vc.fillStyle = '#4A90D9'; vc.fillRect(0, 100, VW, 64)
    vc.fillStyle = '#F1C40F'; vc.fillRect(280, 20, 20, 20)
  } else if (lvl.id === 4) {
    vc.fillStyle = '#2A1A2A'; vc.fillRect(0, 0, VW, VH)
    // Neon signs
    vc.fillStyle = '#FF00FF'
    vc.fillRect(10, 30, 30, 12); vc.fillRect(260, 25, 40, 12)
    vc.fillStyle = '#000'; vc.font = '4px monospace'; vc.textAlign = 'center'
    vc.fillText('SHOP', 25, 39); vc.fillText('MALL', 280, 34)
    vc.textAlign = 'left'
  } else if (lvl.id === 5) {
    vc.fillStyle = '#0A1A0A'; vc.fillRect(0, 0, VW, VH)
    // Houses
    vc.fillStyle = '#3A2A1A'
    vc.fillRect(10, 100, 40, 64); vc.fillRect(270, 95, 40, 69)
    vc.fillStyle = '#5A3A2A'
    vc.fillRect(10, 90, 40, 14); vc.fillRect(270, 85, 40, 14)
    // Windows
    vc.fillStyle = '#FFFF00'
    vc.fillRect(20, 110, 8, 8); vc.fillRect(35, 110, 8, 8)
    vc.fillRect(280, 105, 8, 8); vc.fillRect(295, 105, 8, 8)
  } else if (lvl.id === 6) {
    const t = Date.now() * 0.001
    vc.fillStyle = 'rgba(50,0,100,' + (0.5 + 0.3 * Math.sin(t)) + ')'
    vc.fillRect(0, 0, VW, VH)
    for (let i = 0; i < 5; i++) {
      vc.fillStyle = 'rgba(150,0,255,' + (Math.random() * 0.3) + ')'
      vc.fillRect(Math.random() * VW, Math.random() * VH, Math.random() * 40 + 5, 2 + Math.random() * 8)
    }
  }
}

function drawLevel(g) {
  const lvl = LEVELS[g.level]
  vc.fillStyle = lvl.bgColor; vc.fillRect(0, 0, VW, VH)

  drawBackground(g, lvl)

  g.platforms.forEach(p => {
    const px = Math.round(p.x - g.cameraX)
    vc.fillStyle = p.c; vc.fillRect(px, p.y, p.w, p.h)
    vc.fillStyle = lightenColor(p.c); vc.fillRect(px, p.y, p.w, 1)
  })

  g.interactables.forEach(item => {
    if (item.broken) return
    const ix = Math.round(item.x - g.cameraX)
    vc.fillStyle = item.color; vc.fillRect(ix, item.y, item.w, item.h)
    vc.fillStyle = '#FFF'; vc.font = '3px monospace'; vc.textAlign = 'center'
    const labels = { toy:'TOY', juice:'JUICE', wall:'MARK', alarm:'!', speaker:'SND', frogs:'FRG', wave:'~' }
    vc.fillText(labels[item.type] || '?', ix + item.w/2, item.y + item.h/2 + 1)
    vc.textAlign = 'left'
  })

  g.enemies.forEach(e => { if (e.hp > 0) drawEnemy(e, g.cameraX) })

  if (g.boss && g.boss.hp > 0) drawBoss(g.boss, g.cameraX)

  g.projectiles.forEach(p => {
    const px2 = Math.round(p.x - g.cameraX)
    vc.fillStyle = p.color; vc.fillRect(px2 - p.r, Math.round(p.y) - p.r, p.r * 2, p.r * 2)
  })

  drawPlayer(g)
  drawParticles()

  // Escape zone
  const canEscape = g.objectivesCompleted >= g.objectives.length || g.chaos >= 90 || g.bossDefeated
  if (canEscape) {
    const ez = Math.round(g.escapeX - g.cameraX)
    vc.fillStyle = 'rgba(0,255,0,' + (0.3 + 0.2 * Math.sin(Date.now() * 0.008)) + ')'
    vc.fillRect(ez, g.escapeY - 30, 14, 30)
    vc.fillStyle = '#00FF00'; vc.font = '4px monospace'; vc.textAlign = 'center'
    vc.fillText('EXIT', ez + 7, g.escapeY - 32)
    vc.textAlign = 'left'
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

  // Chaos auto-rise
  g.chaos = Math.min(100, g.chaos + dt * 0.5)

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
    // Mark first 2 objectives done on boss spawn
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

  // Escape check — use world coords
  const escX = g.escapeX
  const canEscape = g.objectivesCompleted >= g.objectives.length || g.chaos >= 90 || g.bossDefeated
  if (canEscape && Math.abs(g.x - escX) < 20 && Math.abs(g.y + PLAYER_H - g.escapeY) < 20) {
    g.escaped = true
    save.highScores[g.level] = Math.max(save.highScores[g.level], g.score)
    if (g.level + 1 < LEVELS.length) save.unlockedLevels[g.level + 1] = true
    save.coins += g.coins
    writeSave()
    state = 'win'
    sfxWin()
  }

  // Stomp enemies — player lands on top
  g.enemies.forEach(e => {
    if (e.hp <= 0) return
    const ex = e.x - g.cameraX
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
function render() {
  if (!game) return
  const g = game
  vc.save()
  vc.translate(Math.round(g.shakeX || 0), Math.round(g.shakeY || 0))
  drawLevel(g)
  drawHUD(g)

  if (eventPopup) {
    const alpha = Math.min(1, eventPopup.timer)
    vc.globalAlpha = alpha
    vc.fillStyle = 'rgba(0,0,0,0.7)'; vc.fillRect(VW/2 - 35, VH/2 - 8, 70, 12)
    vc.fillStyle = '#FF69B4'; vc.font = '6px monospace'; vc.textAlign = 'center'
    vc.fillText(eventPopup.text, VW/2, VH/2 + 1)
    vc.globalAlpha = 1; vc.textAlign = 'left'
  }

  if (g.dead) {
    const fade = Math.min(0.8, (g.deathTimer || 0) * 0.4)
    vc.fillStyle = 'rgba(0,0,0,' + fade + ')'; vc.fillRect(0, 0, VW, VH)
    vc.fillStyle = '#FF0000'; vc.font = '10px monospace'; vc.textAlign = 'center'
    vc.fillText('GROUNDED!', VW/2, VH/2 - 8)
    vc.fillStyle = '#FFF'; vc.font = '5px monospace'
    vc.fillText(g.deathReason, VW/2, VH/2 + 4)
    vc.textAlign = 'left'
  }

  if (g.flashTimer > 0 && g.flashColor) {
    vc.fillStyle = g.flashColor; vc.globalAlpha = g.flashTimer * 0.4
    vc.fillRect(0, 0, VW, VH); vc.globalAlpha = 1
  }

  vc.restore()
}

// ── 19. BUTTON SYSTEM ────────────────────────────────────────
let menuItems  = []
let menuHovX   = -1
let menuHovY   = -1

function clearButtons() { menuItems = [] }

function registerButton(x, y, w, h, action) {
  menuItems.push({ x, y, w, h, action })
}

function isHovered(x, y, w, h) {
  return menuHovX >= x && menuHovX <= x + w && menuHovY >= y && menuHovY <= y + h
}

function drawButton(x, y, w, h, text, highlighted, color) {
  if (color === undefined) color = C.PINK
  vc.fillStyle   = highlighted ? color : '#333355'
  vc.fillRect(x, y, w, h)
  vc.strokeStyle = highlighted ? '#FFF' : '#666688'
  vc.lineWidth   = 0.5
  vc.strokeRect(x, y, w, h)
  vc.fillStyle = highlighted ? '#FFFFFF44' : '#FFFFFF22'
  vc.fillRect(x, y, w, 1); vc.fillRect(x, y, 1, h)
  vc.fillStyle = '#FFF'
  const fs = Math.min(6, Math.max(3, Math.floor(h * 0.38)))
  vc.font = fs + 'px monospace'
  vc.textAlign = 'center'; vc.textBaseline = 'middle'
  vc.fillText(text, x + w/2, y + h/2)
  vc.textBaseline = 'alphabetic'; vc.textAlign = 'left'
}

// Map real coords → virtual
function realToVirt(cx, cy) {
  const scale = Math.min(canvas.width / VW, canvas.height / VH)
  const ox    = (canvas.width  - VW * scale) / 2
  const oy    = (canvas.height - VH * scale) / 2
  return {
    vx: (cx - ox) / scale,
    vy: (cy - oy) / scale,
  }
}

function handleClick(cx, cy) {
  const { vx, vy } = realToVirt(cx, cy)
  for (const item of menuItems) {
    if (vx >= item.x && vx <= item.x + item.w && vy >= item.y && vy <= item.y + item.h) {
      item.action(vx, vy); sfxMenu(); return
    }
  }
}

function handleMouseMove(cx, cy) {
  const { vx, vy } = realToVirt(cx, cy)
  menuHovX = vx; menuHovY = vy
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

// --- MENU ---
let menuTime    = 0
let selectedLevel = 0

function renderMenu() {
  clearButtons()
  const t = menuTime

  // Background
  vc.fillStyle = C.BLACK; vc.fillRect(0, 0, VW, VH)

  // Animated grid
  vc.strokeStyle = 'rgba(255,105,180,0.07)'; vc.lineWidth = 0.5
  const scroll = (t * 20) % 30
  for (let y = -scroll; y < VH; y += 30) { vc.beginPath(); vc.moveTo(0, y); vc.lineTo(VW, y); vc.stroke() }
  for (let x = 0; x < VW; x += 40) { vc.beginPath(); vc.moveTo(x, 0); vc.lineTo(x, VH); vc.stroke() }

  // Bouncing pig decoration
  const pigY = 28 + Math.sin(t * 2) * 3
  drawDecoPig(VW / 2 - 5, pigY)

  // Title
  vc.fillStyle = C.PINK; vc.font = 'bold 14px monospace'; vc.textAlign = 'center'
  vc.fillText('PEPPA', VW / 2, 50)
  vc.fillStyle = C.PURPLE
  vc.fillText('CHAOS', VW / 2, 62)

  // Glitch title flicker
  if (Math.random() < 0.02) {
    vc.globalAlpha = 0.7; vc.fillStyle = C.CYAN
    vc.fillText('CHAOS', VW / 2 + (Math.random() - 0.5) * 6, 62)
    vc.globalAlpha = 1
  }

  // Stats
  vc.fillStyle = C.YELLOW; vc.font = '4px monospace'
  vc.fillText('COINS: ' + save.coins, VW / 2, 72)

  // Buttons
  const bw = 70, bh = 11, bx = VW/2 - bw/2
  const btns = [
    { label: 'PLAY',     col: C.PINK,   action: () => { startLevel(0) } },
    { label: 'LEVELS',   col: C.BLUE,   action: () => { state = 'levelSelect' } },
    { label: 'SHOP',     col: C.PURPLE, action: () => { state = 'shop' } },
    { label: 'SETTINGS', col: C.CYAN,   action: () => { state = 'settings' } },
  ]
  btns.forEach((b, i) => {
    const by = 82 + i * (bh + 4)
    const hi = isHovered(bx, by, bw, bh)
    drawButton(bx, by, bw, bh, b.label, hi, b.col)
    registerButton(bx, by, bw, bh, b.action)
  })

  // Controls hint
  vc.fillStyle = 'rgba(255,255,255,0.4)'; vc.font = '3px monospace'; vc.textAlign = 'center'
  vc.fillText('A/D move  W/UP jump  SPC/E interact', VW / 2, VH - 3)
  vc.textAlign = 'left'
}

function drawDecoPig(px, py) {
  vc.fillStyle = C.PINK
  vc.fillRect(px, py + 4, 10, 8)
  vc.fillRect(px + 1, py, 8, 6)
  vc.fillStyle = C.DPINK
  vc.fillRect(px + 6, py + 2, 4, 3)
  vc.fillStyle = '#111'
  vc.fillRect(px + 2, py + 1, 2, 2)
  vc.fillRect(px + 6, py + 1, 2, 2)
  vc.fillStyle = C.PINK
  vc.fillRect(px, py - 2, 3, 3)
  vc.fillRect(px + 7, py - 2, 3, 3)
}

// --- LEVEL SELECT ---
function renderLevelSelect() {
  clearButtons()
  vc.fillStyle = C.BLACK; vc.fillRect(0, 0, VW, VH)
  vc.fillStyle = C.CYAN; vc.font = 'bold 8px monospace'; vc.textAlign = 'center'
  vc.fillText('SELECT LEVEL', VW / 2, 14)

  const cols = 3, rows = 2
  const cw = 90, ch = 50, padX = (VW - cols * cw) / 2, padY = 22

  LEVELS.forEach((lvl, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x   = padX + col * cw + 3
    const y   = padY + row * ch + 5
    const w   = cw - 6, h = ch - 8
    const unlocked = save.unlockedLevels[i]
    const hi       = isHovered(x, y, w, h)
    const border   = unlocked ? (hi ? C.YELLOW : C.PINK) : C.GRAY

    vc.fillStyle = unlocked ? (hi ? 'rgba(255,105,180,0.3)' : 'rgba(255,105,180,0.1)') : 'rgba(50,50,80,0.5)'
    vc.fillRect(x, y, w, h)
    vc.strokeStyle = border; vc.lineWidth = 0.5; vc.strokeRect(x, y, w, h)

    vc.fillStyle = unlocked ? '#FFF' : C.GRAY
    vc.font = '4px monospace'; vc.textAlign = 'center'
    vc.fillText('LV.' + (i + 1), x + w/2, y + 10)

    vc.font = '3px monospace'
    if (unlocked) {
      // Wrap level name
      const words = lvl.name.split(' ')
      let line1 = words.slice(0, Math.ceil(words.length/2)).join(' ')
      let line2 = words.slice(Math.ceil(words.length/2)).join(' ')
      vc.fillText(line1, x + w/2, y + 18)
      vc.fillText(line2, x + w/2, y + 24)
      vc.fillStyle = C.YELLOW
      vc.fillText('BEST: ' + save.highScores[i], x + w/2, y + 33)
    } else {
      vc.fillStyle = C.GRAY; vc.fillText('LOCKED', x + w/2, y + 22)
    }

    if (unlocked) registerButton(x, y, w, h, () => { startLevel(i) })
  })

  const bw = 50, bh = 10, bx = VW/2 - bw/2, by = VH - 14
  const hiBack = isHovered(bx, by, bw, bh)
  drawButton(bx, by, bw, bh, 'BACK', hiBack, C.PURPLE)
  registerButton(bx, by, bw, bh, () => { state = 'menu' })
  vc.textAlign = 'left'
}

// --- PAUSE ---
function renderPause() {
  vc.fillStyle = 'rgba(0,0,0,0.7)'; vc.fillRect(0, 0, VW, VH)

  vc.fillStyle = C.PINK; vc.font = 'bold 10px monospace'; vc.textAlign = 'center'
  vc.fillText('PAUSED', VW / 2, VH / 2 - 32)

  const bw = 70, bh = 11, bx = VW/2 - bw/2
  const btns = [
    { label: 'RESUME',  col: C.PINK,   action: () => { state = 'playing' } },
    { label: 'SETTINGS',col: C.CYAN,   action: () => { state = 'settings' } },
    { label: 'MENU',    col: C.PURPLE, action: () => { state = 'menu' } },
  ]
  btns.forEach((b, i) => {
    const by = VH / 2 - 18 + i * (bh + 4)
    const hi = isHovered(bx, by, bw, bh)
    drawButton(bx, by, bw, bh, b.label, hi, b.col)
    registerButton(bx, by, bw, bh, b.action)
  })
  vc.textAlign = 'left'
}

// --- GAME OVER ---
function renderGameOver() {
  clearButtons()
  vc.fillStyle = C.BLACK; vc.fillRect(0, 0, VW, VH)

  // Glitchy red title
  vc.fillStyle = '#FF0000'; vc.font = 'bold 12px monospace'; vc.textAlign = 'center'
  vc.fillText('GROUNDED!', VW / 2, 30)
  if (Math.random() < 0.1) {
    vc.globalAlpha = 0.5; vc.fillText('GROUNDED!', VW / 2 + (Math.random()-0.5)*4, 30); vc.globalAlpha = 1
  }

  if (game) {
    vc.fillStyle = C.DPINK; vc.font = '5px monospace'
    vc.fillText(game.deathReason, VW / 2, 44)
    vc.fillStyle = C.YELLOW
    vc.fillText('SCORE: ' + game.score, VW / 2, 56)
    vc.fillStyle = C.LEMON
    vc.fillText('COINS: +' + game.coins, VW / 2, 65)
    vc.fillStyle = '#AAF'
    vc.fillText('BEST: ' + save.highScores[game.level], VW / 2, 74)
  }

  const bw = 70, bh = 11, bx = VW/2 - bw/2
  const btns = [
    { label: 'RETRY', col: C.PINK,   action: () => { if (game) startLevel(game.level) } },
    { label: 'MENU',  col: C.PURPLE, action: () => { state = 'menu' } },
  ]
  btns.forEach((b, i) => {
    const by = 88 + i * (bh + 4)
    const hi = isHovered(bx, by, bw, bh)
    drawButton(bx, by, bw, bh, b.label, hi, b.col)
    registerButton(bx, by, bw, bh, b.action)
  })
  vc.textAlign = 'left'
}

// --- WIN ---
function renderWin() {
  clearButtons()
  vc.fillStyle = C.BLACK; vc.fillRect(0, 0, VW, VH)

  vc.fillStyle = C.DGREEN; vc.font = 'bold 10px monospace'; vc.textAlign = 'center'
  vc.fillText('ESCAPED!', VW / 2, 25)
  vc.fillStyle = C.PINK; vc.font = '4px monospace'
  vc.fillText('You glorious chaos pig!', VW / 2, 36)

  if (game) {
    vc.fillStyle = C.YELLOW; vc.font = '5px monospace'
    vc.fillText('SCORE: ' + game.score, VW / 2, 50)
    vc.fillStyle = C.LEMON
    vc.fillText('COINS: +' + game.coins, VW / 2, 60)
    vc.fillStyle = '#0F0'; vc.font = '4px monospace'
    vc.fillText('NEW BEST: ' + save.highScores[game.level], VW / 2, 70)
  }

  const bw = 70, bh = 11, bx = VW/2 - bw/2
  const nextLvl = game ? game.level + 1 : -1
  const btns = []
  if (nextLvl < LEVELS.length && save.unlockedLevels[nextLvl]) {
    btns.push({ label: 'NEXT LV', col: C.DGREEN, action: () => { startLevel(nextLvl) } })
  }
  btns.push({ label: 'MENU', col: C.PURPLE, action: () => { state = 'menu' } })

  // Boss level special ending
  if (game && game.level === 5 && game.bossDefeated) {
    vc.fillStyle = C.CYAN; vc.font = '4px monospace'
    const ending = game.score > 1000 ? 'SECRET ENDING: VOID QUEEN!' : game.score > 500 ? 'GOOD ENDING: HERO PIG!' : 'BAD ENDING: JUST LUCKY'
    vc.fillText(ending, VW / 2, 82)
  }

  btns.forEach((b, i) => {
    const by = 90 + i * (bh + 4)
    const hi = isHovered(bx, by, bw, bh)
    drawButton(bx, by, bw, bh, b.label, hi, b.col)
    registerButton(bx, by, bw, bh, b.action)
  })
  vc.textAlign = 'left'
}

// --- SETTINGS ---
function renderSettings() {
  clearButtons()
  vc.fillStyle = C.BLACK; vc.fillRect(0, 0, VW, VH)
  vc.fillStyle = C.CYAN; vc.font = 'bold 8px monospace'; vc.textAlign = 'center'
  vc.fillText('SETTINGS', VW / 2, 14)

  const panelX = 30, panelW = VW - 60

  function drawSlider(label, val, setFn, y) {
    vc.fillStyle = '#FFF'; vc.font = '4px monospace'; vc.textAlign = 'left'
    vc.fillText(label, panelX, y - 1)
    const slX = panelX, slW = panelW, slY = y + 2, slH = 6
    vc.fillStyle = '#333'; vc.fillRect(slX, slY, slW, slH)
    vc.fillStyle = C.CYAN; vc.fillRect(slX, slY, slW * val, slH)
    vc.strokeStyle = '#FFF'; vc.lineWidth = 0.5; vc.strokeRect(slX, slY, slW, slH)
    vc.fillStyle = '#FFF'; vc.textAlign = 'right'
    vc.fillText(Math.round(val * 100) + '%', panelX + panelW, y - 1)
    registerButton(slX, slY - 2, slW, slH + 4, (vx) => {
      const rel = Math.max(0, Math.min(1, (vx - slX) / slW))
      setFn(rel); writeSave()
    })
  }

  drawSlider('SFX VOL',   save.settings.sfxVol,   v => { save.settings.sfxVol   = v }, 32)
  drawSlider('MUSIC VOL', save.settings.musicVol,  v => { save.settings.musicVol = v }, 52)

  const bw = 50, bh = 10, bx = VW/2 - bw/2, by = VH - 20
  const hiBack = isHovered(bx, by, bw, bh)
  drawButton(bx, by, bw, bh, 'BACK', hiBack, C.PURPLE)
  registerButton(bx, by, bw, bh, () => { state = prevState || 'menu' })
  vc.textAlign = 'left'
}

// --- SHOP ---
function renderShop() {
  clearButtons()
  vc.fillStyle = C.BLACK; vc.fillRect(0, 0, VW, VH)
  vc.fillStyle = C.PURPLE; vc.font = 'bold 8px monospace'; vc.textAlign = 'center'
  vc.fillText('SHOP', VW / 2, 12)
  vc.fillStyle = C.YELLOW; vc.font = '4px monospace'
  vc.fillText('COINS: ' + save.coins, VW / 2, 21)

  const skinList = Object.entries(SKINS)
  const startY   = 28
  const rowH     = 19
  const panelX   = 8, panelW = VW - 16

  skinList.forEach(([id, skin], i) => {
    const y       = startY + i * rowH
    const owned   = save.unlockedSkins.includes(id)
    const active  = save.activeSkin === id
    const canBuy  = !owned && save.coins >= skin.cost
    const hi      = isHovered(panelX, y, panelW, rowH - 2)

    vc.fillStyle   = active ? 'rgba(0,255,100,0.15)' : hi ? 'rgba(255,105,180,0.1)' : 'rgba(255,255,255,0.03)'
    vc.fillRect(panelX, y, panelW, rowH - 2)
    vc.strokeStyle = active ? C.DGREEN : owned ? 'rgba(255,255,255,0.3)' : C.GRAY
    vc.lineWidth   = 0.5; vc.strokeRect(panelX, y, panelW, rowH - 2)

    // Color swatch
    vc.fillStyle = skin.color; vc.fillRect(panelX + 3, y + 3, 10, 10)

    // Name
    vc.fillStyle = active ? C.DGREEN : '#FFF'
    vc.font = '4px monospace'; vc.textAlign = 'left'
    vc.fillText(skin.name, panelX + 17, y + 9)

    // Button
    const bw2 = 38, bh2 = 10, bx2 = panelX + panelW - bw2 - 3, by2 = y + 3
    if (active) {
      drawButton(bx2, by2, bw2, bh2, 'EQUIPPED', false, C.DGREEN)
    } else if (owned) {
      const hiEq = isHovered(bx2, by2, bw2, bh2)
      drawButton(bx2, by2, bw2, bh2, 'EQUIP', hiEq, C.DGREEN)
      registerButton(bx2, by2, bw2, bh2, () => {
        save.activeSkin = id; writeSave(); sfxConfirm()
        if (game) game.skin = id
      })
    } else {
      const hiBy = isHovered(bx2, by2, bw2, bh2)
      drawButton(bx2, by2, bw2, bh2, skin.cost + 'c', hiBy && canBuy, canBuy ? C.YELLOW : C.GRAY)
      if (canBuy) {
        registerButton(bx2, by2, bw2, bh2, () => {
          save.coins -= skin.cost; save.unlockedSkins.push(id); writeSave(); sfxConfirm()
        })
      }
    }
  })

  const bw = 50, bh = 10, bx = VW/2 - bw/2, by = VH - 12
  drawButton(bx, by, bw, bh, 'BACK', isHovered(bx, by, bw, bh), C.PINK)
  registerButton(bx, by, bw, bh, () => { state = 'menu' })
  vc.textAlign = 'left'
}

// ── 23. GAME FLOW ─────────────────────────────────────────────
function startLevel(idx) {
  if (idx === undefined) idx = 0
  getAC() // ensure audio context created on user gesture
  game  = initGame(idx)
  state = 'playing'
  sfxConfirm()
  // clear lingering particles
  particles.length = 0
  eventPopup = null
}

// ── 24. MAIN LOOP ─────────────────────────────────────────────
let lastTime = 0

function gameLoop(ts) {
  const dt = Math.min((ts - (lastTime || ts)) / 1000, 0.05)
  lastTime = ts
  menuTime += dt

  vc.fillStyle = '#000'
  vc.fillRect(0, 0, VW, VH)

  if (state === 'playing') {
    update(dt)
    render()
    // In-game action keys
    if (keys.space)    { if (game) doAction(game); keys.space = false }
    if (keys.interact) { if (game) doAction(game); keys.interact = false }
    keys.jump = keys.up  // unify jump keys
    drawScanlines()
    if (game) {
      chaosEffect = game.chaos > 30 ? (game.chaos - 30) / 140 : 0
      if (chaosEffect > 0) drawGlitch()
    }
  } else if (state === 'paused') {
    render()
    renderPause()
    drawScanlines()
  } else if (state === 'menu') {
    clearButtons()
    renderMenu()
  } else if (state === 'levelSelect') {
    clearButtons()
    renderLevelSelect()
  } else if (state === 'gameover') {
    renderGameOver()
  } else if (state === 'win') {
    renderWin()
  } else if (state === 'shop') {
    renderShop()
  } else if (state === 'settings') {
    renderSettings()
  }

  blitToScreen()
  requestAnimationFrame(gameLoop)
}

// ── BOOT ──────────────────────────────────────────────────────
resize()
requestAnimationFrame(gameLoop)
