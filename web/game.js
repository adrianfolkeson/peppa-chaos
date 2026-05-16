// ============================================================
//  PEPPA CHAOS - 2D Pixel Art Chaos Game
// ============================================================

// ── Colors ──────────────────────────────────────────────
const C = {
  PINK:     '#FF69B4',
  PURPLE:   '#9B59B6',
  CYAN:     '#00FFFF',
  BLUE:     '#87CEEB',
  GREEN:    '#90EE90',
  YELLOW:   '#F1C40F',
  RED:      '#E74C3C',
  WHITE:    '#FFFFFF',
  BLACK:    '#1A1A2E',
  DIM:      'rgba(255,255,255,0.5)',
}

// ── Canvas setup ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
let W, H

function resize() {
  W = canvas.width  = canvas.offsetWidth
  H = canvas.height = canvas.offsetHeight
}
window.addEventListener('resize', () => { resize() })
resize()

// ── Save / Load ───────────────────────────────────────────────
const SAVE_KEY = 'peppachaos_v1'
let save = {
  highScore:       0,
  totalCoins:      0,
  levelProgress:   0,
  unlockedSkins:   ['pink'],
  activeSkin:      'pink',
  achievements:    [],
  settings:        { musicVol: 0.5, sfxVol: 0.5, particles: true, horrorMode: true },
  gamesPlayed:     0,
}

function loadSave() {
  try {
    const d = localStorage.getItem(SAVE_KEY)
    if (d) {
      const parsed = JSON.parse(d)
      save = { ...save, ...parsed }
      save.settings = { ...{ musicVol: 0.5, sfxVol: 0.5, particles: true, horrorMode: true }, ...parsed.settings }
    }
  } catch (e) {}
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch (e) {}
}

loadSave()

// ── Skins ─────────────────────────────────────────────────────
const SKINS = [
  { id: 'pink',     name: 'Pink Default', color: '#FF69B4', cost: 0 },
  { id: 'beach',    name: 'Beach Pig',    color: '#87CEEB', cost: 500 },
  { id: 'vampire',  name: 'Vampire Pig',  color: '#8B008B', cost: 1000 },
  { id: 'robot',    name: 'Robot Pig',    color: '#C0C0C0', cost: 2000 },
  { id: 'ghost',    name: 'Ghost Pig',    color: '#E8E8E8', cost: 3000 },
  { id: 'skeleton', name: 'Skeleton Pig', color: '#F5F5F5', cost: 5000 },
  { id: 'corrupted',name: 'Corrupted Pig',color: '#9B59B6', cost: 10000 },
  { id: 'memelord', name: 'Meme Lord',    color: '#FFD700', cost: 25000 },
  { id: 'rainbow',  name: 'Rainbow Pig',  color: 'rainbow', cost: 50000 },
  { id: 'void',     name: 'Void Pig',     color: '#1A1A2E', cost: 100000 },
]

// ── State machine ─────────────────────────────────────────────
let state = 'menu'

// ── Levels ─────────────────────────────────────────────────────
const LEVELS = [
  { id: 1, name: 'BEDROOM DISASTER', theme: 'bedroom', duration: 180 },
  { id: 2, name: 'SCHOOL CHAOS', theme: 'school', duration: 240 },
  { id: 3, name: 'BEACH DAY', theme: 'beach', duration: 300 },
  { id: 4, name: 'MALL DISASTER', theme: 'mall', duration: 300 },
  { id: 5, name: 'NEIGHBORHOOD', theme: 'neighborhood', duration: 360 },
  { id: 6, name: 'BLACK HOLE', theme: 'blackhole', duration: 420 },
]

// ── Game state ────────────────────────────────────────────────
let game = {}

function initGame() {
  game = {
    playerX:      W / 4,
    playerY:      H - 150,
    playerVX:     0,
    playerVY:     0,
    isJumping:    false,
    isSliding:    false,
    facing:       1, // 1 = right, -1 = left
    
    chaos:        0,       // 0-100
    score:        0,
    coins:        0,
    time:         0,
    level:        1,
    
    objects:      [],      // Interaktiva objekt
    enemies:      [],      // Fiender
    particles:    [],
    scorePopups:  [],
    
    objectives:   [],
    completedObjs:0,
    escapeActive: false,
    escapeTimer:  30,
    
    dead:         false,
    deathTimer:   0,
    shakeX:       0,
    shakeY:       0,
    shakeDuration:0,
    
    paused:       false,
    menuItems:    [],
    hoveredItem:   -1,
    
    jumpScareTimer:0,
    glitchIntensity: 0,
  }
}

// ── Keys ─────────────────────────────────────────────────────
const keys = { left: false, right: false, jump: false, action: false }

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left = true
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') keys.jump = true
  if (e.key === ' ') keys.action = true
  if (e.key === 'Escape') {
    if (state === 'playing' && !game.dead) {
      state = 'paused'
    } else if (state === 'paused') {
      state = 'playing'
    }
  }
})

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left = false
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false
  if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') keys.jump = false
  if (e.key === ' ') keys.action = false
})

// ── Touch controls ─────────────────────────────────────────────
let touchStartX = 0

canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX
  e.preventDefault()
  if (state === 'menu' || state === 'paused') {
    handleClick(e.touches[0].clientX, e.touches[0].clientY)
  }
}, { passive: false })

canvas.addEventListener('touchmove', e => {
  if (state === 'playing' && !game.dead) {
    const dx = e.touches[0].clientX - touchStartX
    if (dx < -40) { keys.left = true; keys.right = false }
    else if (dx > 40) { keys.right = true; keys.left = false }
  }
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', () => {
  keys.left = false
  keys.right = false
  touchStartX = 0
})

canvas.addEventListener('click', e => handleClick(e.clientX, e.clientY))
canvas.addEventListener('mousemove', e => handleMouseMove(e.clientX, e.clientY))

// ── Menu items ────────────────────────────────────────────────
function registerButton(x, y, w, h, action) {
  game.menuItems.push({ x, y, w, h, action })
}

function drawButton(x, y, w, h, text, highlighted, color) {
  if (highlighted === undefined) highlighted = false
  if (color === undefined) color = C.PINK
  ctx.save()
  if (highlighted) {
    ctx.shadowColor = color
    ctx.shadowBlur = 25
    ctx.strokeStyle = color
    ctx.fillStyle = hexToRgba(color, 0.2)
  } else {
    ctx.shadowBlur = 8
    ctx.shadowColor = color
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
  }
  ctx.lineWidth = 2
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = highlighted ? color : '#fff'
  ctx.font = `bold ${Math.min(16, Math.floor(h * 0.35))}px 'Press Start 2P', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowBlur = highlighted ? 12 : 0
  ctx.fillText(text, x + w/2, y + h/2)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Click handling ─────────────────────────────────────────────
function handleClick(cx, cy) {
  if (state === 'menu') {
    const rect = canvas.getBoundingClientRect()
    const x = (cx - rect.left) * (W / rect.width)
    const y = (cy - rect.top)  * (H / rect.height)
    for (const item of game.menuItems) {
      if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
        item.action()
        sfxMenuTick()
        return
      }
    }
  }
  if (state === 'paused') {
    const rect = canvas.getBoundingClientRect()
    const x = (cx - rect.left) * (W / rect.width)
    const y = (cy - rect.top)  * (H / rect.height)
    for (const item of game.menuItems) {
      if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
        item.action()
        sfxMenuTick()
        return
      }
    }
  }
}

function handleMouseMove(cx, cy) {
  const rect = canvas.getBoundingClientRect()
  const x = (cx - rect.left) * (W / rect.width)
  const y = (cy - rect.top)  * (H / rect.height)
  game.hoveredItem = -1
  game.menuItems.forEach((item, i) => {
    if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
      game.hoveredItem = i
    }
  })
}

// ── Audio ─────────────────────────────────────────────────────
let audioCtx = null

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function playTone(freq, duration, type, vol) {
  if (type === undefined) type = 'sine'
  if (vol === undefined) vol = 0.3
  if (save.settings.sfxVol === 0) return
  try {
    const ac = getAudioCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol * save.settings.sfxVol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.start()
    osc.stop(ac.currentTime + duration)
  } catch (e) {}
}

function sfxMenuTick()  { playTone(440, 0.05, 'sine', 0.15) }
function sfxConfirm()   { playTone(880, 0.1, 'sine', 0.25); setTimeout(() => playTone(1100, 0.1, 'sine', 0.2), 80) }
function sfxJump()      { playTone(600, 0.15, 'square', 0.3); playTone(800, 0.1, 'square', 0.2) }
function sfxBreak()     { playTone(200, 0.3, 'sawtooth', 0.4) }
function sfxCrash()     { playTone(100, 0.5, 'sawtooth', 0.5) }
function sfxAlarm()     { playTone(800, 0.2, 'square', 0.4); setTimeout(() => playTone(600, 0.2, 'square', 0.3), 200) }

// ── Particles ─────────────────────────────────────────────────
function spawnParticle(x, y, color, explosive) {
  if (!save.settings.particles) return
  const angle = Math.random() * Math.PI * 2
  const speed = explosive ? 100 + Math.random() * 200 : 30 + Math.random() * 80
  const life = 0.3 + Math.random() * 0.5
  game.particles.push({
    x, y, color,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 50,
    life, maxLife: life,
    r: explosive ? 3 + Math.random() * 4 : 2 + Math.random() * 2,
  })
}

function updateParticles(dt) {
  game.particles = game.particles.filter(p => {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 200 * dt
    p.life -= dt
    return p.life > 0
  })
}

// ── Draw player ───────────────────────────────────────────────
function drawPlayer() {
  const skin = SKINS.find(s => s.id === save.activeSkin) || SKINS[0]
  let color = skin.color
  if (color === 'rainbow') {
    color = `hsl(${(Date.now() / 10) % 360},100%,60%)`
  }
  
  const px = game.playerX
  const py = game.playerY
  const size = 60
  
  ctx.save()
  
  // Glitch effect
  if (game.chaos > 50) {
    ctx.globalAlpha = 0.5 + Math.random() * 0.5
    const glitchX = (Math.random() - 0.5) * 10
    ctx.translate(glitchX, 0)
  }
  
  // Body
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 20
  
  // Main body (oval)
  ctx.beginPath()
  ctx.ellipse(px, py, size/2, size/2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // Head
  ctx.beginPath()
  ctx.ellipse(px, py - size/2.5, size/3, size/3, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // Eyes
  ctx.fillStyle = C.WHITE
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.ellipse(px - 10, py - size/2.5 - 5, 8, 10, 0, 0, Math.PI * 2)
  ctx.ellipse(px + 10, py - size/2.5 - 5, 8, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // Pupils
  ctx.fillStyle = C.BLACK
  const lookDir = game.facing > 0 ? 3 : -3
  ctx.beginPath()
  ctx.arc(px - 10 + lookDir, py - size/2.5 - 5, 4, 0, Math.PI * 2)
  ctx.arc(px + 10 + lookDir, py - size/2.5 - 5, 4, 0, Math.PI * 2)
  ctx.fill()
  
  // Snout
  ctx.fillStyle = '#FFB6C1'
  ctx.beginPath()
  ctx.ellipse(px, py - size/2.5 + 15, 15, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // Nostrils
  ctx.fillStyle = '#FF69B4'
  ctx.beginPath()
  ctx.ellipse(px - 5, py - size/2.5 + 15, 4, 3, 0, 0, Math.PI * 2)
  ctx.ellipse(px + 5, py - size/2.5 + 15, 4, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // Ears
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(px - 25, py - size/2 - 10, 12, 18, -0.3, 0, Math.PI * 2)
  ctx.ellipse(px + 25, py - size/2 - 10, 12, 18, 0.3, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.restore()
}

// ── Draw chaos meter ──────────────────────────────────────────
function drawChaosMeter() {
  const meterW = 300
  const meterH = 30
  const meterX = W / 2 - meterW / 2
  const meterY = 30
  
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(meterX, meterY, meterW, meterH)
  
  // Fill
  const chaosColor = game.chaos < 25 ? C.GREEN : 
                     game.chaos < 50 ? C.YELLOW :
                     game.chaos < 75 ? C.PURPLE : C.RED
  ctx.fillStyle = chaosColor
  ctx.shadowColor = chaosColor
  ctx.shadowBlur = game.chaos > 50 ? 15 : 5
  ctx.fillRect(meterX, meterY, meterW * (game.chaos / 100), meterH)
  
  // Label
  ctx.shadowBlur = 0
  ctx.fillStyle = C.WHITE
  ctx.font = "10px 'Press Start 2P', monospace"
  ctx.textAlign = 'center'
  ctx.fillText(`CHAOS: ${Math.floor(game.chaos)}%`, W / 2, meterY + 20)
  
  // Pulse effect at high chaos
  if (game.chaos > 75) {
    ctx.strokeStyle = chaosColor
    ctx.lineWidth = 2
    ctx.globalAlpha = Math.sin(Date.now() / 100) * 0.5 + 0.5
    ctx.strokeRect(meterX - 2, meterY - 2, meterW + 4, meterH + 4)
    ctx.globalAlpha = 1
  }
}

// ── Draw HUD ───────────────────────────────────────────────────
function drawHUD() {
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  
  // Score
  ctx.fillStyle = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur = 10
  ctx.font = "bold 20px 'Press Start 2P', monospace"
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE: ${Math.floor(game.score)}`, 20, 40)
  
  // Coins
  ctx.fillStyle = C.YELLOW
  ctx.font = "12px 'Press Start 2P', monospace"
  ctx.fillText(`💰 ${Math.floor(game.coins)}`, 20, 65)
  
  // Level
  ctx.fillStyle = C.CYAN
  ctx.textAlign = 'right'
  ctx.fillText(`LEVEL ${game.level}`, W - 20, 40)
  
  // Time
  const levelData = LEVELS[game.level - 1]
  const timeLeft = Math.max(0, levelData.duration - game.time)
  ctx.fillStyle = timeLeft < 30 ? C.RED : C.WHITE
  ctx.fillText(`TIME: ${Math.floor(timeLeft)}s`, W - 20, 65)
  
  // Chaos meter
  drawChaosMeter()
  
  // Escape timer
  if (game.escapeActive) {
    ctx.fillStyle = C.RED
    ctx.font = "bold 32px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'
    ctx.shadowColor = C.RED
    ctx.shadowBlur = 30
    ctx.fillText(`ESCAPE! ${Math.floor(game.escapeTimer)}s`, W / 2, H / 2 - 50)
  }
  
  // Objectives
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = "10px 'Press Start 2P', monospace"
  ctx.textAlign = 'left'
  ctx.fillText(`OBJECTS: ${game.completedObjs}/${game.objectives.length}`, 20, H - 20)
  
  ctx.restore()
}

// ── Draw particles ─────────────────────────────────────────────
function drawParticles() {
  game.particles.forEach(p => {
    const a = Math.max(0, p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

// ── Draw glitch overlay ───────────────────────────────────────
function drawGlitchOverlay() {
  if (game.chaos < 25) return
  
  const intensity = (game.chaos - 25) / 75
  
  // Random horizontal lines
  ctx.save()
  ctx.globalAlpha = intensity * 0.3
  ctx.fillStyle = C.PURPLE
  for (let i = 0; i < intensity * 20; i++) {
    const y = Math.random() * H
    const h = 2 + Math.random() * 5
    ctx.fillRect(0, y, W, h)
  }
  
  // RGB shift
  if (intensity > 0.3) {
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(255,0,0,0.1)'
    ctx.fillRect(-5, 0, W, H)
    ctx.fillStyle = 'rgba(0,255,255,0.1)'
    ctx.fillRect(5, 0, W, H)
  }
  
  ctx.restore()
}

// ── Draw score popups ──────────────────────────────────────────
function drawScorePopups() {
  game.scorePopups = game.scorePopups.filter(p => {
    p.y -= 40 * 0.016
    p.life -= 0.016
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 10
    ctx.font = "bold 14px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'
    ctx.fillText(p.text, p.x || W / 2, p.y)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    return p.life > 0
  })
}

function addScorePopup(text, color, x, y) {
  game.scorePopups.push({ text, color, x: x || game.playerX, y: y || game.playerY - 50, life: 1.5 })
}

// ── Update ────────────────────────────────────────────────────
function update(dt) {
  if (game.dead || game.escapeActive) {
    game.deathTimer += dt
    updateParticles(dt)
    
    if (game.shakeDuration > 0) {
      game.shakeDuration -= dt
      const mag = 10 * Math.min(1, game.shakeDuration / 0.3)
      game.shakeX = (Math.random() - 0.5) * mag
      game.shakeY = (Math.random() - 0.5) * mag
    } else {
      game.shakeX = 0
      game.shakeY = 0
    }
    
    if (game.escapeActive) {
      game.escapeTimer -= dt
      if (game.escapeTimer <= 0) {
        triggerDeath()
      }
    }
    
    if (game.deathTimer > 2) {
      state = 'gameover'
      finalizeScore()
    }
    return
  }
  
  // Time
  game.time += dt
  
  // Player movement
  const moveSpeed = 300
  if (keys.left) {
    game.playerX -= moveSpeed * dt
    game.facing = -1
  }
  if (keys.right) {
    game.playerX += moveSpeed * dt
    game.facing = 1
  }
  
  // Jump
  if (keys.jump && !game.isJumping) {
    game.playerVY = -500
    game.isJumping = true
    sfxJump()
  }
  
  // Gravity
  game.playerVY += 1000 * dt
  game.playerY += game.playerVY * dt
  
  // Ground collision
  const groundY = H - 100
  if (game.playerY >= groundY) {
    game.playerY = groundY
    game.playerVY = 0
    game.isJumping = false
  }
  
  // Screen bounds
  game.playerX = Math.max(50, Math.min(W - 50, game.playerX))
  
  // Slide
  game.isSliding = keys.action && !game.isJumping
  
  // Chaos progression
  game.chaos = Math.min(100, game.chaos + 2 * dt)
  
  // Score
  game.score += 5 * dt
  game.coins += 2 * dt
  
  // Check escape trigger
  if (game.chaos >= 100 && !game.escapeActive) {
    game.escapeActive = true
    game.escapeTimer = 30
    sfxAlarm()
  }
  
  // Update particles
  updateParticles(dt)
  
  // Glitch intensity
  game.glitchIntensity = game.chaos / 100
}

// ── Trigger death ─────────────────────────────────────────────
function triggerDeath() {
  if (game.dead) return
  game.dead = true
  game.deathTimer = 0
  game.shakeDuration = 0.5
  
  for (let i = 0; i < 30; i++) {
    spawnParticle(game.playerX, game.playerY, Math.random() < 0.5 ? C.PINK : C.PURPLE, true)
  }
  sfxCrash()
}

// ── Finalize score ────────────────────────────────────────────
function finalizeScore() {
  const score = Math.floor(game.score)
  const coins = Math.floor(game.coins)
  
  if (score > save.highScore) {
    save.highScore = score
    save.totalCoins += coins + 500
  } else {
    save.totalCoins += coins
  }
  save.gamesPlayed++
  writeSave()
}

// ── Render menu ───────────────────────────────────────────────
let menuAnimTime = 0

function renderMenu() {
  game.menuItems = []
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, W, H)
  
  // Background effect
  ctx.strokeStyle = 'rgba(255,105,180,0.07)'
  ctx.lineWidth = 1
  const scroll = (menuAnimTime * 50) % 60
  for (let y = -scroll; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // Title
  const titleSize = Math.min(48, W * 0.08)
  ctx.font = `900 ${titleSize}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.PINK
  ctx.shadowColor = C.PINK
  ctx.shadowBlur = 40
  ctx.fillText('PEPPA', W / 2, H * 0.2)
  ctx.fillStyle = C.PURPLE
  ctx.shadowColor = C.PURPLE
  ctx.fillText('CHAOS', W / 2, H * 0.2 + titleSize)
  
  // Stats
  ctx.font = "12px 'Press Start 2P', monospace"
  ctx.shadowBlur = 0
  ctx.fillStyle = C.YELLOW
  ctx.fillText(`BEST: ${save.highScore}`, W / 2, H * 0.2 + titleSize * 2 + 20)
  ctx.fillStyle = C.YELLOW
  ctx.fillText(`COINS: ${Math.floor(save.totalCoins)}`, W / 2, H * 0.2 + titleSize * 2 + 45)
  
  ctx.restore()
  
  // Buttons
  const btnW = Math.min(280, W * 0.45)
  const btnH = Math.min(50, H * 0.07)
  const btnX = W / 2 - btnW / 2
  const startY = H * 0.55
  const gap = btnH + 14
  
  const buttons = [
    { text: '▶ PLAY',        action: () => { startGame() },     color: C.PINK },
    { text: '🏆 LEADERBOARD', action: () => { state = 'leaderboard' }, color: C.YELLOW },
    { text: '🎨 SHOP',       action: () => { state = 'shop' },   color: C.PURPLE },
    { text: '⚙️ SETTINGS',   action: () => { state = 'settings' }, color: C.CYAN },
    { text: '❓ HOW TO PLAY', action: () => { state = 'howtoplay' }, color: C.GREEN },
  ]
  
  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    drawButton(bx, by, btnW, btnH, btn.text, game.hoveredItem === i, btn.color)
    registerButton(bx, by, btnW, btnH, btn.action)
  })
}

// ── Render pause ─────────────────────────────────────────────
function renderPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(0, 0, W, H)
  
  game.menuItems = []
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  ctx.font = `900 ${Math.min(48, W * 0.08)}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.PINK
  ctx.shadowColor = C.PINK
  ctx.shadowBlur = 30
  ctx.fillText('PAUSED', W / 2, H * 0.25)
  ctx.shadowBlur = 0
  
  const btnW = Math.min(280, W * 0.4)
  const btnH = Math.min(45, H * 0.06)
  const btnX = W / 2 - btnW / 2
  const startY = H * 0.4
  const gap = btnH + 12
  
  const buttons = [
    { text: '▶ RESUME',  action: () => { state = 'playing' }, color: C.PINK },
    { text: '⚙️ SETTINGS', action: () => { state = 'settings' }, color: C.CYAN },
    { text: '🏠 MENU',   action: () => { state = 'menu' }, color: C.PURPLE },
    { text: '🔄 RESTART', action: () => { startGame() }, color: C.GREEN },
  ]
  
  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    drawButton(bx, by, btnW, btnH, btn.text, game.hoveredItem === i, btn.color)
    registerButton(bx, by, btnW, btnH, btn.action)
  })
  
  ctx.textBaseline = 'alphabetic'
}

// ── Render game over ─────────────────────────────────────────
let gameOverAnimTime = 0

function renderGameOver() {
  game.menuItems = []
  gameOverAnimTime += 0.016
  
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, W, H)
  
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const titleSize = Math.min(40, W * 0.07)
  ctx.font = `900 ${titleSize}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.RED
  ctx.shadowColor = C.RED
  ctx.shadowBlur = 40
  ctx.fillText('GAME OVER', W / 2, H * 0.2)
  ctx.shadowBlur = 0
  
  ctx.font = "bold 20px 'Press Start 2P', monospace"
  ctx.fillStyle = C.PINK
  ctx.fillText(`SCORE: ${Math.floor(game.score)}`, W / 2, H * 0.35)
  
  ctx.font = "12px 'Press Start 2P', monospace"
  ctx.fillStyle = C.YELLOW
  ctx.fillText(`BEST: ${save.highScore}`, W / 2, H * 0.42)
  ctx.fillText(`COINS: +${Math.floor(game.coins)}`, W / 2, H * 0.50)
  
  // Death message
  const messages = [
    'GROUNDED FOREVER',
    'MATH PRISON',
    'TIMEOUT CORNER',
    'NO DINNER TONIGHT',
    'CONSUMED BY VOID',
  ]
  ctx.fillStyle = C.PURPLE
  ctx.font = "14px 'Press Start 2P', monospace"
  ctx.fillText(messages[Math.floor(gameOverAnimTime) % messages.length], W / 2, H * 0.58)
  
  const btnW = Math.min(260, W * 0.4)
  const btnH = Math.min(45, H * 0.06)
  const btnX = W / 2 - btnW / 2
  const startY = H * 0.70
  const gap = btnH + 12
  
  const buttons = [
    { text: '▶ PLAY AGAIN', action: () => { startGame() }, color: C.PINK },
    { text: '🏠 MENU',     action: () => { state = 'menu' }, color: C.PURPLE },
  ]
  
  buttons.forEach((btn, i) => {
    const bx = btnX
    const by = startY + i * gap
    drawButton(bx, by, btnW, btnH, btn.text, game.hoveredItem === i, btn.color)
    registerButton(bx, by, btnW, btnH, btn.action)
  })
  
  ctx.textBaseline = 'alphabetic'
}

// ── Render settings ───────────────────────────────────────────
function renderSettings() {
  game.menuItems = []
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, W, H)
  
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.min(36, W * 0.06)}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.CYAN
  ctx.shadowColor = C.CYAN
  ctx.shadowBlur = 25
  ctx.fillText('SETTINGS', W / 2, H * 0.12)
  ctx.shadowBlur = 0
  
  const panelW = Math.min(400, W * 0.7)
  const panelX = W / 2 - panelW / 2
  let oy = H * 0.25
  
  ctx.textAlign = 'left'
  ctx.font = "12px 'Press Start 2P', monospace"
  
  function drawSlider(label, value, setFn, y) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(label, panelX, y)
    
    const slW = panelW * 0.5
    const slX = panelX + panelW * 0.4
    const slH = 12
    const slY = y - 8
    
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(slX, slY, slW, slH)
    ctx.fillStyle = C.CYAN
    ctx.shadowColor = C.CYAN
    ctx.shadowBlur = 8
    ctx.fillRect(slX, slY, slW * value, slH)
    ctx.shadowBlur = 0
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(value * 100)}%`, panelX + panelW, y)
    ctx.textAlign = 'left'
    
    registerButton(slX, slY - 5, slW, 20, (cx, cy) => {
      const rel = Math.max(0, Math.min(1, (cx - slX) / slW))
      setFn(rel)
      writeSave()
    })
  }
  
  const rowH = 50
  drawSlider('MUSIC VOL', save.settings.musicVol, v => { save.settings.musicVol = v }, oy); oy += rowH
  drawSlider('SFX VOL', save.settings.sfxVol, v => { save.settings.sfxVol = v }, oy); oy += rowH
  
  // Horror mode toggle
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('HORROR MODE', panelX, oy)
  const opts = ['ON', 'OFF']
  const oW = Math.min(80, panelW * 0.2)
  opts.forEach((o, i) => {
    const bx = panelX + panelW * 0.4 + i * (oW + 10)
    const by = oy - 18
    const hi = (o === 'ON') === save.settings.horrorMode
    drawButton(bx, by, oW, 36, o, hi, C.CYAN)
    registerButton(bx, by, oW, 36, () => { save.settings.horrorMode = (o === 'ON'); writeSave() })
  })
  oy += rowH
  
  // Particles toggle
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('PARTICLES', panelX, oy)
  const pOpts = ['ON', 'OFF']
  pOpts.forEach((p, i) => {
    const bx = panelX + panelW * 0.4 + i * (oW + 10)
    const by = oy - 18
    const hi = (p === 'ON') === save.settings.particles
    drawButton(bx, by, oW, 36, p, hi, C.CYAN)
    registerButton(bx, by, oW, 36, () => { save.settings.particles = (p === 'ON'); writeSave() })
  })
  oy += rowH + 10
  
  // Back button
  const btnW = Math.min(200, W * 0.35)
  const btnH = Math.min(45, H * 0.06)
  const btnX = W / 2 - btnW / 2
  drawButton(btnX, oy, btnW, btnH, '← BACK', game.hoveredItem === game.menuItems.length, C.PURPLE)
  registerButton(btnX, oy, btnW, btnH, () => { state = 'menu' })
  
  ctx.textBaseline = 'alphabetic'
}

// ── Render shop ───────────────────────────────────────────────
let shopScrollY = 0

function renderShop() {
  game.menuItems = []
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, W, H)
  
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.min(36, W * 0.06)}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.PURPLE
  ctx.shadowColor = C.PURPLE
  ctx.shadowBlur = 25
  ctx.fillText('SHOP', W / 2, H * 0.1)
  
  ctx.font = "12px 'Press Start 2P', monospace"
  ctx.fillStyle = C.YELLOW
  ctx.shadowBlur = 10
  ctx.fillText(`COINS: ${Math.floor(save.totalCoins)}`, W / 2, H * 0.17)
  ctx.shadowBlur = 0
  
  const panelW = Math.min(400, W * 0.7)
  const panelX = W / 2 - panelW / 2
  const itemH = 55
  const startY = H * 0.24
  
  SKINS.forEach((item, i) => {
    const iy = startY + i * (itemH + 8)
    if (iy > H - 80 || iy < H * 0.2) return
    
    const owned = save.unlockedSkins.includes(item.id)
    const active = save.activeSkin === item.id
    const canBuy = !owned && save.totalCoins >= item.cost
    
    const borderCol = active ? C.GREEN : owned ? 'rgba(0,255,65,0.4)' : 'rgba(255,255,255,0.15)'
    ctx.strokeStyle = borderCol
    ctx.lineWidth = active ? 2 : 1
    if (active) { ctx.shadowColor = C.GREEN; ctx.shadowBlur = 12 }
    ctx.fillStyle = active ? 'rgba(0,255,65,0.06)' : 'rgba(255,255,255,0.03)'
    ctx.fillRect(panelX, iy, panelW, itemH)
    ctx.strokeRect(panelX, iy, panelW, itemH)
    ctx.shadowBlur = 0
    
    // Color preview
    const color = item.color === 'rainbow' ? `hsl(${(Date.now() / 10) % 360},100%,60%)` : item.color
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.fillRect(panelX + 12, iy + itemH/2 - 12, 24, 24)
    ctx.shadowBlur = 0
    
    ctx.font = "bold 11px 'Press Start 2P', monospace"
    ctx.fillStyle = active ? C.GREEN : '#fff'
    ctx.textAlign = 'left'
    ctx.fillText(item.name, panelX + 50, iy + itemH/2 - 5)
    
    const btnW2 = Math.min(100, panelW * 0.25)
    const btnH2 = itemH * 0.55
    const btnX2 = panelX + panelW - btnW2 - 10
    const btnY2 = iy + (itemH - btnH2) / 2
    
    if (active) {
      drawButton(btnX2, btnY2, btnW2, btnH2, 'EQUIPPED', true, C.GREEN)
    } else if (owned) {
      drawButton(btnX2, btnY2, btnW2, btnH2, 'EQUIP', game.hoveredItem === game.menuItems.length, C.GREEN)
      registerButton(btnX2, btnY2, btnW2, btnH2, () => {
        save.activeSkin = item.id
        writeSave()
        sfxConfirm()
      })
    } else {
      const col = canBuy ? C.YELLOW : 'rgba(255,255,255,0.25)'
      drawButton(btnX2, btnY2, btnW2, btnH2, item.cost.toLocaleString(), game.hoveredItem === game.menuItems.length, col)
      if (canBuy) {
        registerButton(btnX2, btnY2, btnW2, btnH2, () => {
          if (save.totalCoins >= item.cost) {
            save.totalCoins -= item.cost
            save.unlockedSkins.push(item.id)
            writeSave()
            sfxConfirm()
          }
        })
      }
    }
  })
  
  ctx.textBaseline = 'alphabetic'
  
  const btnW = Math.min(200, W * 0.35)
  const btnH = Math.min(45, H * 0.06)
  const btnX = W / 2 - btnW / 2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, '← BACK', game.hoveredItem === game.menuItems.length, C.PINK)
  registerButton(btnX, btnY, btnW, btnH, () => { state = 'menu' })
}

// ── Render how to play ────────────────────────────────────────
function renderHowToPlay() {
  game.menuItems = []
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, W, H)
  
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.min(32, W * 0.055)}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.GREEN
  ctx.shadowColor = C.GREEN
  ctx.shadowBlur = 25
  ctx.fillText('HOW TO PLAY', W / 2, H * 0.1)
  ctx.shadowBlur = 0
  
  const lines = [
    { text: 'CONTROLS', col: C.CYAN, bold: true },
    { text: 'A/D or ←/→ — Move', col: '#fff' },
    { text: 'W or ↑ — Jump', col: '#fff' },
    { text: 'SPACE — Slide/Action', col: '#fff' },
    { text: 'ESC — Pause', col: '#fff' },
    { text: '', size: 10 },
    { text: 'GOAL', col: C.PINK, bold: true },
    { text: 'Cause chaos! Break things!', col: '#fff' },
    { text: 'Fill the chaos meter to 100%', col: '#fff' },
    { text: 'Then ESCAPE before time runs out!', col: '#fff' },
    { text: '', size: 10 },
    { text: 'WARNING', col: C.RED, bold: true },
    { text: 'Avoid Jennifer Pig!', col: '#fff' },
    { text: 'If she catches you = GAME OVER!', col: '#fff' },
  ]
  
  let y = H * 0.2
  ctx.font = "12px 'Press Start 2P', monospace"
  lines.forEach(line => {
    ctx.font = `${line.bold ? 'bold' : '400'} 12px 'Press Start 2P', monospace`
    ctx.fillStyle = line.col || '#fff'
    ctx.shadowBlur = line.bold ? 8 : 0
    if (line.text) ctx.fillText(line.text, W / 2, y)
    y += (line.size || 14) + 8
  })
  ctx.shadowBlur = 0
  
  const btnW = Math.min(240, W * 0.4)
  const btnH = Math.min(50, H * 0.07)
  const btnX = W / 2 - btnW / 2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, '▶ START', game.hoveredItem === 0, C.PINK)
  registerButton(btnX, btnY, btnW, btnH, () => { startGame() })
  
  ctx.textBaseline = 'alphabetic'
}

// ── Render leaderboard ────────────────────────────────────────
function renderLeaderboard() {
  game.menuItems = []
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, W, H)
  
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.min(32, W * 0.055)}px 'Press Start 2P', monospace`
  ctx.fillStyle = C.YELLOW
  ctx.shadowColor = C.YELLOW
  ctx.shadowBlur = 25
  ctx.fillText('LEADERBOARD', W / 2, H * 0.1)
  ctx.shadowBlur = 0
  
  const fakeScores = [
    { name: 'CHAOSKING', score: 12500 },
    { name: 'MUDDYMAX', score: 10200 },
    { name: 'WEEWEEWEE', score: 8500 },
    { name: 'GROUNDED', score: 6200 },
    { name: 'PIGGYPRO', score: 4100 },
    { name: 'PEPPAFAN', score: 2800 },
    { name: 'CHAOSBUD', score: 1500 },
  ]
  
  const panelW = Math.min(400, W * 0.7)
  const panelX = W / 2 - panelW / 2
  const rowH = Math.min(35, H * 0.05)
  const startY = H * 0.2
  
  fakeScores.forEach((entry, i) => {
    const ry = startY + i * (rowH + 4)
    const isPlayer = entry.score === save.highScore
    
    ctx.fillStyle = isPlayer ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.03)'
    ctx.strokeStyle = isPlayer ? C.GREEN : 'rgba(255,255,255,0.1)'
    ctx.lineWidth = isPlayer ? 2 : 1
    ctx.fillRect(panelX, ry, panelW, rowH)
    ctx.strokeRect(panelX, ry, panelW, rowH)
    
    ctx.font = "10px 'Press Start 2P', monospace"
    ctx.textAlign = 'left'
    ctx.fillStyle = i === 0 ? C.YELLOW : 'rgba(255,255,255,0.5)'
    ctx.fillText(`#${i + 1}`, panelX + 10, ry + rowH/2 + 4)
    
    ctx.fillStyle = isPlayer ? C.GREEN : '#fff'
    ctx.fillText(entry.name, panelX + 50, ry + rowH/2 + 4)
    
    ctx.textAlign = 'right'
    ctx.fillStyle = C.YELLOW
    ctx.fillText(entry.score.toLocaleString(), panelX + panelW - 10, ry + rowH/2 + 4)
  })
  
  ctx.textBaseline = 'alphabetic'
  
  const btnW = Math.min(200, W * 0.35)
  const btnH = Math.min(45, H * 0.06)
  const btnX = W / 2 - btnW / 2
  const btnY = H - btnH - 14
  drawButton(btnX, btnY, btnW, btnH, '← BACK', true, C.PINK)
  registerButton(btnX, btnY, btnW, btnH, () => { state = 'menu' })
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  resize()
  initGame()
  state = 'playing'
  gameOverAnimTime = 0
  sfxConfirm()
}

// ── Render main game ───────────────────────────────────────────
function renderGame() {
  ctx.save()
  ctx.translate(game.shakeX, game.shakeY)
  
  // Background - level specific
  const levelColors = ['#2D1B69', '#1B4D3E', '#4A6B8A', '#6B4A8A', '#3D6B4A', '#1A1A2E']
  ctx.fillStyle = levelColors[game.level - 1] || C.BLACK
  ctx.fillRect(-10, -10, W + 20, H + 20)
  
  // Ground
  ctx.fillStyle = '#0A0A1E'
  ctx.fillRect(0, H - 100, W, 100)
  
  // Platform decorations
  ctx.fillStyle = C.PURPLE
  ctx.shadowColor = C.PURPLE
  ctx.shadowBlur = 10
  ctx.fillRect(0, H - 102, W, 4)
  ctx.shadowBlur = 0
  
  // Draw player
  drawPlayer()
  
  // Draw particles
  drawParticles()
  
  // Glitch overlay
  drawGlitchOverlay()
  
  ctx.restore()
  
  // HUD (not affected by shake)
  drawHUD()
  drawScorePopups()
  
  // Pause icon
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.strokeRect(W - 55, 10, 40, 32)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillRect(W - 48, 16, 7, 18)
  ctx.fillRect(W - 37, 16, 7, 18)
  ctx.restore()
}

// ── Main loop ─────────────────────────────────────────────────
let lastTime = 0

function gameLoop(ts) {
  const dt = Math.min((ts - (lastTime || ts)) / 1000, 0.05)
  lastTime = ts
  menuAnimTime += dt
  
  switch (state) {
    case 'menu':
      renderMenu()
      break
    case 'playing':
      update(dt)
      renderGame()
      break
    case 'paused':
      renderGame()
      renderPause()
      break
    case 'gameover':
      renderGameOver()
      break
    case 'settings':
      renderSettings()
      break
    case 'shop':
      renderShop()
      break
    case 'howtoplay':
      renderHowToPlay()
      break
    case 'leaderboard':
      renderLeaderboard()
      break
  }
  
  requestAnimationFrame(gameLoop)
}

// ── Boot ──────────────────────────────────────────────────────
loadSave()
resize()
initGame()
requestAnimationFrame(gameLoop)

console.log('🎮 PEPPA CHAOS loaded!')
console.log('Controls: A/D or ←/→ to move, W to jump, SPACE to slide, ESC to pause')