'use client'

import { useEffect, useRef, useState } from 'react'

type Pos = { x: number; y: number }
type Screen = { width: number; height: number; context: CanvasRenderingContext2D }
type Keys = { left: boolean; right: boolean; space: boolean; enter: boolean }

interface GameObj {
  position: Pos; radius: number; delete: boolean; die(): void
}

function hitTest(a: GameObj, b: GameObj) {
  const dx = a.position.x - b.position.x, dy = a.position.y - b.position.y
  return Math.sqrt(dx * dx + dy * dy) + 10 <= a.radius + b.radius
}
function collideAll(as: GameObj[], bs: GameObj[]) {
  for (let i = as.length - 1; i >= 0; i--)
    for (let j = bs.length - 1; j >= 0; j--)
      if (hitTest(as[i], bs[j])) { as[i].die(); bs[j].die() }
}
function bulletHitInvaders(bullets: Bullet[], targets: Invader[]) {
  for (let i = bullets.length - 1; i >= 0; i--)
    for (let j = targets.length - 1; j >= 0; j--)
      if (hitTest(bullets[i], targets[j])) { bullets[i].die(); targets[j].hit() }
}

// ---- Audio ----
class AudioEngine {
  private ctx: AudioContext | null = null
  private beatTimer: ReturnType<typeof setTimeout> | null = null
  private beat = 0
  private getCount: () => number = () => 9

  init() {
    try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); this.ctx?.resume() } catch { /* */ }
  }
  private tone(freq: number, type: OscillatorType, dur: number, gain: number, delay = 0) {
    const ctx = this.ctx; if (!ctx) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = type; osc.frequency.value = freq
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t); osc.stop(t + dur)
  }
  shoot() {
    const ctx = this.ctx; if (!ctx) return
    const osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination); osc.type = 'square'
    osc.frequency.setValueAtTime(900, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08)
    g.gain.setValueAtTime(0.04, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.start(); osc.stop(ctx.currentTime + 0.08)
  }
  invaderDie() { this.tone(160, 'sawtooth', 0.22, 0.09) }
  waveClear() { [330, 440, 550, 660].forEach((f, i) => this.tone(f, 'square', 0.15, 0.06, i * 0.09)) }
  shipDie() {
    const ctx = this.ctx; if (!ctx) return
    const dur = 0.9, buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain()
    src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(ctx.destination)
    flt.type = 'lowpass'; flt.frequency.value = 450
    g.gain.setValueAtTime(0.28, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    src.start(); src.stop(ctx.currentTime + dur); this.tone(55, 'sine', 0.7, 0.18)
  }
  startHeartbeat(getCount: () => number, maxCount: number) {
    this.getCount = getCount
    const notes = [82, 104]
    const tick = () => {
      const ratio = Math.max(0.05, this.getCount() / maxCount)
      this.tone(notes[this.beat++ % 2], 'square', 0.1, 0.05)
      this.beatTimer = setTimeout(tick, 180 + ratio * 620)
    }
    tick()
  }
  stopHeartbeat() { if (this.beatTimer) { clearTimeout(this.beatTimer); this.beatTimer = null } }
  destroy() { this.stopHeartbeat(); this.ctx?.close(); this.ctx = null }
}

// ---- Bullet ----
class Bullet implements GameObj {
  position: Pos; speed: number; radius: number; delete: boolean; dir: 'up' | 'down'
  constructor(pos: Pos, dir: 'up' | 'down', speed = 4) {
    this.position = { ...pos }; this.speed = speed; this.radius = 4; this.delete = false; this.dir = dir
  }
  die() { this.delete = true }
  update() { this.position.y += this.dir === 'up' ? -this.speed : this.speed }
  render(s: Screen) {
    if (this.position.y < -20 || this.position.y > s.height + 20) { this.die(); return }
    const ctx = s.context
    ctx.save(); ctx.translate(this.position.x, this.position.y)
    if (this.dir === 'up') {
      ctx.fillStyle = 'rgba(255,60,60,0.9)'; ctx.fillRect(-1.5, -11, 3, 22)
      ctx.fillStyle = 'rgba(255,200,200,1)'; ctx.fillRect(-0.5, -11, 1, 22)
      ctx.beginPath(); ctx.arc(0, -11, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.fill()
    } else {
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 0); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 0)
      ctx.closePath(); ctx.fillStyle = '#FFBD4A'; ctx.fill()
      ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 0.5; ctx.stroke()
    }
    ctx.restore()
  }
}

// ---- Ship ----
class Ship implements GameObj {
  position: Pos; speed: number; radius: number; delete: boolean
  bullets: Bullet[]; lastShot: number; private onDie: () => void
  constructor(pos: Pos, onDie: () => void) {
    this.position = { ...pos }; this.speed = 4.5; this.radius = 15
    this.delete = false; this.bullets = []; this.lastShot = 0; this.onDie = onDie
  }
  die() { this.onDie() }
  update(keys: Keys, width: number) {
    if (keys.left) this.position.x -= this.speed
    if (keys.right) this.position.x += this.speed
    if (this.position.x < 0) this.position.x = width
    if (this.position.x > width) this.position.x = 0
    if (keys.space && Date.now() - this.lastShot > 200) {
      this.bullets.push(new Bullet({ x: this.position.x, y: this.position.y - 12 }, 'up'))
      this.lastShot = Date.now()
    }
  }
  render(s: Screen) {
    this.bullets = this.bullets.filter(b => !b.delete)
    for (const b of this.bullets) { b.update(); b.render(s) }
    const ctx = s.context
    ctx.save(); ctx.translate(this.position.x, this.position.y)
    ctx.beginPath()
    ctx.moveTo(0, -24); ctx.lineTo(8, -6); ctx.lineTo(22, 10); ctx.lineTo(12, 8)
    ctx.lineTo(7, 18); ctx.lineTo(-7, 18); ctx.lineTo(-12, 8); ctx.lineTo(-22, 10); ctx.lineTo(-8, -6)
    ctx.closePath(); ctx.fillStyle = '#ccd8e0'; ctx.strokeStyle = '#e8f0f8'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(0, -10, 3, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#B82A14'; ctx.fill()
    for (const ex of [-4.5, 4.5]) { ctx.beginPath(); ctx.ellipse(ex, 19, 2.5, 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#FFBD4A'; ctx.fill() }
    ctx.restore()
  }
}

// ---- Invader ----
type InvaderType = 'drone' | 'gunner' | 'diver'

class Invader implements GameObj {
  position: Pos; speed: number; radius: number; delete: boolean
  dir: 'left' | 'right'; bullets: Bullet[]; lastShot: number; shotCooldown: number
  type: InvaderType; hp: number; hitFlash: number
  diverState: 'formation' | 'diving'; diverTargetX: number; diverArmed: number

  constructor(pos: Pos, speed: number, type: InvaderType = 'drone') {
    this.position = { ...pos }; this.speed = speed
    this.radius = type === 'gunner' ? 18 : 15
    this.delete = false; this.dir = 'right'; this.bullets = []
    this.lastShot = Date.now() + 500 + Math.random() * 1500
    this.type = type; this.hp = type === 'gunner' ? 2 : 1; this.hitFlash = 0
    this.diverState = 'formation'; this.diverTargetX = 0
    this.diverArmed = Date.now() + 3500 + Math.random() * 6000
    this.shotCooldown = type === 'gunner' ? 700 + Math.random() * 800
      : type === 'diver' ? 999999
      : 1800 + Math.random() * 2200
  }

  hit() { this.hp--; this.hitFlash = 6; if (this.hp <= 0) this.delete = true }
  die() { this.hp = 0; this.delete = true }

  reverse() {
    if (this.diverState === 'diving') return
    this.dir = this.dir === 'right' ? 'left' : 'right'
  }

  update(shipX: number) {
    if (this.hitFlash > 0) this.hitFlash--
    if (this.diverState === 'diving') {
      const dx = this.diverTargetX - this.position.x
      this.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 3.5)
      this.position.y += 5.5
    } else {
      this.position.x += this.dir === 'right' ? this.speed : -this.speed
      if (this.type === 'diver' && Date.now() > this.diverArmed) {
        this.diverState = 'diving'; this.diverTargetX = shipX
      }
      if (this.type !== 'diver') {
        const now = Date.now()
        if (now - this.lastShot > this.shotCooldown) {
          const bSpeed = this.type === 'gunner' ? 3.5 : 2.5
          this.bullets.push(new Bullet({ x: this.position.x, y: this.position.y + 14 }, 'down', bSpeed))
          this.lastShot = now
          this.shotCooldown = this.type === 'gunner'
            ? 700 + Math.random() * 800 : 1800 + Math.random() * 2200
        }
      }
    }
  }

  render(s: Screen) {
    this.bullets = this.bullets.filter(b => !b.delete)
    for (const b of this.bullets) { b.update(); b.render(s) }
    const ctx = s.context
    ctx.save(); ctx.translate(this.position.x, this.position.y)
    if (this.hitFlash > 0) ctx.globalAlpha = 0.3 + (this.hitFlash / 6) * 0.7

    if (this.type === 'drone') {
      ctx.strokeStyle = '#FFFF00'; ctx.fillStyle = '#FFBD4A'; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-5, 25); ctx.lineTo(5, 25); ctx.lineTo(-5, 0)
      ctx.lineTo(15, 15); ctx.lineTo(15, -15); ctx.lineTo(-15, -15)
      ctx.lineTo(-15, 15); ctx.lineTo(5, 0)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    } else if (this.type === 'gunner') {
      ctx.fillStyle = this.hp > 1 ? '#FF4400' : '#FF7744'
      ctx.strokeStyle = '#FF8800'; ctx.lineWidth = 2
      ctx.fillRect(-13, -11, 26, 22); ctx.strokeRect(-13, -11, 26, 22)
      ctx.fillStyle = '#FF2200'
      ctx.fillRect(-20, -4, 8, 8); ctx.fillRect(12, -4, 8, 8)
      ctx.fillStyle = '#FFCC00'
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill()
      if (this.hp === 2) { ctx.strokeStyle = '#FF8800'; ctx.lineWidth = 1; ctx.strokeRect(-11, -9, 22, 18) }
    } else {
      if (this.diverState === 'diving') ctx.rotate(Math.PI)
      ctx.fillStyle = '#00CCFF'; ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -18); ctx.lineTo(12, 8); ctx.lineTo(5, 3)
      ctx.lineTo(0, 12); ctx.lineTo(-5, 3); ctx.lineTo(-12, 8)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = this.diverState === 'diving' ? '#FF4400' : '#ffffff'
      ctx.beginPath(); ctx.arc(0, -4, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

// ---- Particle ----
class Particle {
  position: Pos; vx: number; vy: number; life: number; maxLife: number; color: string; size: number
  constructor(pos: Pos, color: string, speedMult = 1) {
    this.position = { ...pos }
    const angle = Math.random() * Math.PI * 2, speed = (2 + Math.random() * 7) * speedMult
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed
    this.life = 0; this.maxLife = 25 + Math.random() * 20; this.color = color; this.size = 1.5 + Math.random() * 3
  }
  update() { this.position.x += this.vx; this.position.y += this.vy; this.vy += 0.05; this.life++ }
  get dead() { return this.life >= this.maxLife }
  render(ctx: CanvasRenderingContext2D) {
    const alpha = 1 - this.life / this.maxLife
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = this.color
    ctx.fillRect(this.position.x, this.position.y, this.size, this.size)
    ctx.restore()
  }
}

type Star = { x: number; y: number; z: number }
function makeStars(count: number, w: number, h: number): Star[] {
  return Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, z: Math.random() }))
}
function renderStars(stars: Star[], ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (const s of stars) {
    s.y += 0.15 + s.z * 0.4; if (s.y > h) { s.y = 0; s.x = Math.random() * w }
    ctx.save(); ctx.globalAlpha = 0.15 + s.z * 0.6; ctx.fillStyle = '#ffffff'
    ctx.fillRect(s.x, s.y, 0.5 + s.z, 0.5 + s.z); ctx.restore()
  }
}

const FORMATIONS: string[][] = [
  ['   DDD   ', ' DDDDDDD ', '  DDDDD  '],
  ['    D    ', '   DDD   ', '  DDDDD  ', ' DDDDDDD ', '    G    '],
  ['   DDD   ', ' DDDDDDD ', 'G DDDDD G', 'V       V'],
  ['    V    ', '  D D D  ', ' DDDDDDD ', 'GD     DG'],
  ['V  DDD  V', 'DDDDDDDDD', 'G DDDDD G', '  DDDDD  '],
]

function makeFormation(wave: number, speed: number, W: number): Invader[] {
  const template = FORMATIONS[(wave - 1) % FORMATIONS.length]
  const cellW = 72, rowH = 62
  const startX = (W - 9 * cellW) / 2 + cellW / 2
  const startY = 48
  const out: Invader[] = []
  template.forEach((row, ri) => {
    for (let ci = 0; ci < 9; ci++) {
      const ch = row[ci] ?? ' '
      if (ch === ' ') continue
      const type: InvaderType = ch === 'G' ? 'gunner' : ch === 'V' ? 'diver' : 'drone'
      out.push(new Invader({ x: startX + ci * cellW, y: startY + ri * rowH }, speed, type))
    }
  })
  return out
}

function TouchBtn({ onDown, onUp, children, className, style }: {
  onDown: () => void; onUp: () => void; children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <button className={className} style={{ touchAction: 'none', userSelect: 'none', ...style }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onDown() }}
      onPointerUp={onUp} onPointerCancel={onUp}>
      {children}
    </button>
  )
}

type GState = 'start' | 'playing' | 'over'

export function SpaceFighterGame({ username, onSaveScore }: {
  username?: string
  onSaveScore?: (score: number) => Promise<void>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const keysRef = useRef<Keys>({ left: false, right: false, space: false, enter: false })
  const ensureAudioRef = useRef<() => void>(() => {})

  const [uiState, setUiState] = useState<GState>('start')
  const [finalScore, setFinalScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ratio = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')!
    let W = 0, H = 0

    const applySize = () => {
      const r = wrap.getBoundingClientRect()
      if (r.width === W && r.height === H) return
      W = r.width; H = r.height
      canvas.width = W * ratio; canvas.height = H * ratio
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      stars = makeStars(120, W, H)
    }

    const ro = new ResizeObserver(applySize)
    ro.observe(wrap)
    applySize()

    const keys = keysRef.current
    let gameState: GState = 'start', ship: Ship | null = null, invaders: Invader[] = []
    let orphanBullets: Bullet[] = [], particles: Particle[] = []
    let stars = makeStars(120, W, H), score = 0, wave = 1, maxInvaders = 9
    let raf = 0, dying = false, flashFrames = 0
    let shockwave: { pos: Pos; r: number } | null = null

    let audio: AudioEngine | null = null
    ensureAudioRef.current = () => {
      if (audio) return; audio = new AudioEngine(); audio.init()
    }

    const BOOM_COLORS = ['#B82A14', '#ff6644', '#ffcc44', '#ffffff', '#ff4400']
    const spawnParticles = (pos: Pos, colors: string[], count: number, speedMult = 1) => {
      for (let i = 0; i < count; i++) particles.push(new Particle(pos, colors[i % colors.length], speedMult))
    }

    const die = () => {
      if (dying) return; dying = true
      if (ship) { spawnParticles({ ...ship.position }, BOOM_COLORS, 60, 1.8); shockwave = { pos: { ...ship.position }, r: 0 } }
      audio?.shipDie(); flashFrames = 12; ship = null; invaders = []
      setTimeout(() => { gameState = 'over'; setFinalScore(score); setUiState('over'); setSaved(false) }, 500)
    }

    const startGame = () => {
      dying = false; score = 0; wave = 1
      orphanBullets = []; particles = []
      ship = new Ship({ x: W / 2, y: H - 70 }, die)
      invaders = makeFormation(1, 1, W); maxInvaders = invaders.length
      gameState = 'playing'; setUiState('playing')
      audio?.stopHeartbeat(); audio?.startHeartbeat(() => invaders.length, maxInvaders)
    }

    const downHandler = (e: KeyboardEvent) => {
      ensureAudioRef.current()
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true
      if (e.key === ' ') { keys.space = true; e.preventDefault() }
      if (e.key === 'Enter') keys.enter = true
    }
    const upHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false
      if (e.key === ' ') keys.space = false
      if (e.key === 'Enter') keys.enter = false
    }
    window.addEventListener('keydown', downHandler); window.addEventListener('keyup', upHandler)

    const loop = () => {
      const s: Screen = { width: W, height: H, context: ctx }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); renderStars(stars, ctx, W, H)

      if (gameState === 'start' && keys.enter) { keys.enter = false; startGame() }

      if (gameState === 'playing' || dying) {
        if (gameState === 'playing' && ship) {
          const before = ship.bullets.length
          ship.update(keys, W); ship.render(s)
          if (ship.bullets.length > before) audio?.shoot()

          const shipX = ship ? ship.position.x : W / 2
          let needReverse = false
          for (let i = invaders.length - 1; i >= 0; i--) {
            const inv = invaders[i]
            if (inv.delete) {
              const killColors = inv.type === 'gunner' ? ['#FF4400', '#FF8800', '#ffffff', '#ffcc44']
                : inv.type === 'diver' ? ['#00CCFF', '#00FFFF', '#ffffff', '#0088ff']
                : ['#FFBD4A', '#ffe080', '#ffffff']
              spawnParticles(inv.position, killColors, inv.type === 'gunner' ? 22 : 14)
              orphanBullets.push(...inv.bullets.filter(b => !b.delete))
              invaders.splice(i, 1)
              score += inv.type === 'gunner' ? 30 : inv.type === 'diver' ? 20 : 10
              audio?.invaderDie(); continue
            }
            if (inv.diverState === 'diving') {
              if (inv.position.y > H + 20) inv.die()
              inv.update(shipX); inv.render(s); continue
            }
            if (inv.position.x + inv.radius >= W || inv.position.x - inv.radius <= 0) needReverse = true
            if (inv.position.y + inv.radius >= H) { die(); break }
            inv.update(shipX); inv.render(s)
          }
          if (needReverse) for (const inv of invaders) {
            if (inv.diverState !== 'diving') { inv.reverse(); inv.position.y += 18 }
          }

          orphanBullets = orphanBullets.filter(b => !b.delete)
          for (const b of orphanBullets) { b.update(); b.render(s) }

          if (ship) {
            bulletHitInvaders(ship.bullets, invaders)
            for (const inv of invaders) collideAll(inv.bullets, [ship!])
            collideAll(orphanBullets, [ship])
            collideAll([ship], invaders)
          }

          if (invaders.length === 0 && ship) {
            wave++
            score += 50 * wave * wave
            invaders = makeFormation(wave, 0.8 + wave * 0.35, W)
            maxInvaders = invaders.length
            audio?.stopHeartbeat(); audio?.waveClear()
            setTimeout(() => audio?.startHeartbeat(() => invaders.length, maxInvaders), 600)
          }

          ctx.font = `${Math.round(13 * ratio) / ratio}px monospace`
          ctx.fillStyle = 'rgba(255,255,255,0.35)'
          ctx.fillText(`SCORE ${score}`, 12, 22)
          ctx.fillText(`WAVE ${wave}`, W - 80, 22)
          if (username) ctx.fillText(username, W / 2 - ctx.measureText(username).width / 2, 22)
        }

        particles = particles.filter(p => !p.dead)
        for (const p of particles) { p.update(); p.render(ctx) }

        if (shockwave) {
          shockwave.r += 4
          const alpha = Math.max(0, 1 - shockwave.r / 90)
          ctx.save(); ctx.globalAlpha = alpha * 0.7; ctx.strokeStyle = '#B82A14'; ctx.lineWidth = 2.5
          ctx.beginPath(); ctx.arc(shockwave.pos.x, shockwave.pos.y, shockwave.r, 0, Math.PI * 2)
          ctx.stroke(); ctx.restore()
          if (shockwave.r >= 90) shockwave = null
        }

        if (flashFrames > 0) {
          ctx.save(); ctx.globalAlpha = flashFrames / 12 * 0.45; ctx.fillStyle = '#B82A14'
          ctx.fillRect(0, 0, W, H); ctx.restore(); flashFrames--
        }
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', downHandler); window.removeEventListener('keyup', upHandler)
      audio?.destroy()
    }
  }, [username])

  const k = keysRef.current

  const handleSave = async () => {
    if (!onSaveScore || saving || saved) return
    setSaving(true)
    try { await onSaveScore(finalScore); setSaved(true) } catch { /* ignore */ } finally { setSaving(false) }
  }

  const restart = () => {
    setUiState('start'); setSaved(false)
    setTimeout(() => { k.enter = true; setTimeout(() => { k.enter = false }, 80) }, 50)
  }

  const mono: React.CSSProperties = { fontFamily: 'monospace' }
  const overlay: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }

  return (
    <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: 'relative', background: '#000', userSelect: 'none', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />

      {uiState === 'start' && (
        <div style={overlay}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 24, pointerEvents: 'none' }}>
            2019-2026
          </div>
          <div style={{ lineHeight: 1, marginBottom: 36, textAlign: 'center', pointerEvents: 'none', fontFamily: '"Impact", "Arial Black", sans-serif', letterSpacing: '0.04em' }}>
            <span style={{ color: '#d0d0d0', fontSize: 'clamp(42px, 10vw, 86px)', textTransform: 'uppercase', textShadow: '0 0 18px rgba(255,255,255,0.35), 0 0 40px rgba(255,255,255,0.12)' }}>SPACEFIGHTER</span>
            <span style={{ color: '#B82A14', fontSize: 'clamp(42px, 10vw, 86px)', textTransform: 'uppercase', textShadow: '0 0 14px rgba(184,42,20,0.9), 0 0 32px rgba(184,42,20,0.55), 0 0 60px rgba(184,42,20,0.25)' }}>V</span>
          </div>
          <div style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
            Press Enter or tap below to start
          </div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginTop: 8, pointerEvents: 'none' }}>
            Arrow keys to move · Space to shoot
          </div>
        </div>
      )}

      {uiState === 'over' && (
        <div style={{ ...overlay, gap: 12 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
            Game Over
          </div>
          <div style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: 'clamp(48px, 12vw, 96px)', color: '#fff', lineHeight: 1 }}>
            {finalScore}
          </div>
          <div style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B82A14' }}>
            Score
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button onClick={restart} style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 20px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, background: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              Play Again
            </button>
            {onSaveScore && !saved && (
              <button onClick={handleSave} disabled={saving} style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 20px', borderRadius: 4, border: 'none', background: '#B82A14', color: '#fff', opacity: saving ? 0.5 : 1, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save Score'}
              </button>
            )}
            {saved && (
              <span style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', paddingTop: 10 }}>
                Saved
              </span>
            )}
          </div>
        </div>
      )}

      {uiState !== 'over' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px 32px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
            <TouchBtn onDown={() => { ensureAudioRef.current(); k.left = true }} onUp={() => { k.left = false }}
              style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              ←
            </TouchBtn>
            <TouchBtn onDown={() => { ensureAudioRef.current(); k.right = true }} onUp={() => { k.right = false }}
              style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              →
            </TouchBtn>
          </div>
          <TouchBtn onDown={() => { ensureAudioRef.current(); k.space = true }} onUp={() => { k.space = false }}
            style={{ width: 80, height: 80, borderRadius: '50%', border: '1px solid rgba(184,42,20,0.5)', background: 'rgba(184,42,20,0.1)', color: 'rgba(184,42,20,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', pointerEvents: 'auto' }}>
            FIRE
          </TouchBtn>
        </div>
      )}
    </div>
  )
}
