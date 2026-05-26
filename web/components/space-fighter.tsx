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
class Invader implements GameObj {
  position: Pos; speed: number; radius: number; delete: boolean
  dir: 'left' | 'right'; bullets: Bullet[]; lastShot: number; shotCooldown: number
  constructor(pos: Pos, speed: number) {
    this.position = { ...pos }; this.speed = speed; this.radius = 50
    this.delete = false; this.dir = 'right'; this.bullets = []; this.lastShot = 0
    this.shotCooldown = 4000 + Math.random() * 7000
  }
  die() { this.delete = true }
  reverse() {
    this.dir = this.dir === 'right' ? 'left' : 'right'
    this.position.x += this.dir === 'right' ? 10 : -10
  }
  update() {
    this.position.x += this.dir === 'right' ? this.speed : -this.speed
    if (Date.now() - this.lastShot > this.shotCooldown) {
      this.bullets.push(new Bullet({ x: this.position.x, y: this.position.y + 14 }, 'down', 2.5))
      this.lastShot = Date.now(); this.shotCooldown = 4000 + Math.random() * 7000
    }
  }
  render(s: Screen) {
    this.bullets = this.bullets.filter(b => !b.delete)
    for (const b of this.bullets) { b.update(); b.render(s) }
    const ctx = s.context
    ctx.save(); ctx.translate(this.position.x, this.position.y)
    ctx.strokeStyle = '#FFFF00'; ctx.fillStyle = '#FFBD4A'; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-5, 25); ctx.lineTo(5, 25); ctx.lineTo(-5, 0)
    ctx.lineTo(15, 15); ctx.lineTo(15, -15); ctx.lineTo(-15, -15)
    ctx.lineTo(-15, 15); ctx.lineTo(5, 0)
    ctx.closePath(); ctx.fill(); ctx.stroke()
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

function makeWave(count: number, speed: number, width: number): Invader[] {
  const out: Invader[] = [], pos = { x: 100, y: 20 }; let swap = true
  for (let i = 0; i < count; i++) {
    out.push(new Invader({ x: pos.x, y: pos.y }, speed)); pos.x += 70
    if (pos.x + 100 >= width) { pos.x = swap ? 110 : 100; swap = !swap; pos.y += 70 }
  }
  return out
}

function TouchBtn({ onDown, onUp, children, className }: {
  onDown: () => void; onUp: () => void; children: React.ReactNode; className?: string
}) {
  return (
    <button className={className} style={{ touchAction: 'none', userSelect: 'none' }}
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
    let W = wrap.clientWidth, H = wrap.clientHeight
    canvas.width = W * ratio; canvas.height = H * ratio
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio)

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
      dying = false; score = 0; wave = 1; maxInvaders = 9
      orphanBullets = []; particles = []
      ship = new Ship({ x: W / 2, y: H - 70 }, die)
      invaders = makeWave(9, 1, W); gameState = 'playing'; setUiState('playing')
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

          let needReverse = false
          for (let i = invaders.length - 1; i >= 0; i--) {
            const inv = invaders[i]
            if (inv.delete) {
              spawnParticles(inv.position, ['#FFBD4A', '#ffe080', '#ffffff'], 14)
              orphanBullets.push(...inv.bullets.filter(b => !b.delete))
              invaders.splice(i, 1); score += 10; audio?.invaderDie(); continue
            }
            if (inv.position.x + inv.radius >= W || inv.position.x - inv.radius <= 0) needReverse = true
            // wave reaches bottom: game over
            if (inv.position.y + inv.radius >= H) { die(); break }
            inv.update(); inv.render(s)
          }
          if (needReverse) for (const inv of invaders) { inv.reverse(); inv.position.y += 50 }

          orphanBullets = orphanBullets.filter(b => !b.delete)
          for (const b of orphanBullets) { b.update(); b.render(s) }

          if (ship) {
            collideAll(ship.bullets, invaders)
            for (const inv of invaders) collideAll(inv.bullets, [ship!])
            collideAll(orphanBullets, [ship])
            collideAll([ship], invaders)
          }

          if (invaders.length === 0 && ship) {
            wave++; score += 100 * wave; maxInvaders = 9 * Math.min(wave, 3)
            invaders = makeWave(maxInvaders, 1 + wave * 0.3, W)
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

  return (
    <div ref={wrapRef} className="flex-1 min-h-0 relative bg-black select-none" style={{ minHeight: 0 }}>
      <canvas ref={canvasRef} className="block absolute inset-0" />

      {uiState === 'start' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[10px] tracking-widest uppercase mb-8 pointer-events-none" style={{ color: 'rgba(255,255,255,0.25)' }}>
            2019–2026
          </div>
          <div className="leading-none mb-10 text-center pointer-events-none" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>
            <span style={{ color: '#c0c8d0', fontSize: 'clamp(36px, 8vw, 72px)' }}>Space</span>
            <span style={{ color: '#c0c8d0', fontSize: 'clamp(36px, 8vw, 72px)' }}>Fighter</span>
            <span style={{ color: '#cc2222', fontSize: 'clamp(36px, 8vw, 72px)' }}>V</span>
          </div>
          <div className="hidden md:block font-mono text-[11px] tracking-widest uppercase pointer-events-none" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Press Enter to start
          </div>
          <div className="hidden md:block mt-2 font-mono text-[10px] tracking-widest uppercase pointer-events-none" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Arrow keys to move · Space to shoot
          </div>
          <button
            className="md:hidden font-mono text-[12px] tracking-widest uppercase border px-6 py-3 rounded mt-2"
            style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={() => { ensureAudioRef.current(); k.enter = true; setTimeout(() => { k.enter = false }, 80) }}
          >
            Tap to start
          </button>
          <div className="md:hidden mt-3 font-mono text-[10px] tracking-widest uppercase pointer-events-none" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Use the controls below
          </div>
        </div>
      )}

      {uiState === 'over' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Game Over
          </div>
          <div style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 'clamp(48px, 12vw, 96px)', color: '#ffffff', lineHeight: 1 }}>
            {finalScore}
          </div>
          <div className="font-mono text-[11px] tracking-widest uppercase" style={{ color: '#B82A14' }}>
            Score
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={restart}
              className="font-mono text-[11px] tracking-widest uppercase px-5 py-2.5 border rounded"
              style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              Play Again
            </button>
            {onSaveScore && !saved && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="font-mono text-[11px] tracking-widest uppercase px-5 py-2.5 rounded"
                style={{ background: '#B82A14', color: '#fff', opacity: saving ? 0.5 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Score'}
              </button>
            )}
            {saved && (
              <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)', paddingTop: '10px' }}>
                Saved
              </span>
            )}
          </div>
        </div>
      )}

      {uiState !== 'over' && (
        <div className="md:hidden absolute bottom-0 left-0 right-0 flex items-end justify-between px-5 pb-8 pointer-events-none">
          <div className="flex gap-3 pointer-events-auto">
            <TouchBtn onDown={() => { ensureAudioRef.current(); k.left = true }} onUp={() => { k.left = false }}
              className="w-16 h-16 rounded-full border flex items-center justify-center text-xl"
              style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
              ←
            </TouchBtn>
            <TouchBtn onDown={() => { ensureAudioRef.current(); k.right = true }} onUp={() => { k.right = false }}
              className="w-16 h-16 rounded-full border flex items-center justify-center text-xl"
              style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
              →
            </TouchBtn>
          </div>
          <TouchBtn onDown={() => { ensureAudioRef.current(); k.space = true }} onUp={() => { k.space = false }}
            className="w-20 h-20 rounded-full border flex items-center justify-center font-mono text-[10px] tracking-widest uppercase"
            style={{ borderColor: 'rgba(184,42,20,0.5)', background: 'rgba(184,42,20,0.1)', color: 'rgba(184,42,20,0.8)' }}>
            FIRE
          </TouchBtn>
        </div>
      )}
    </div>
  )
}
