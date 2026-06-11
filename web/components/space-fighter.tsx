'use client'

import { useEffect, useRef, useState } from 'react'

// ---- Types ----
type Pos = { x: number; y: number }
type Screen = { width: number; height: number; context: CanvasRenderingContext2D }
type Keys = { left: boolean; right: boolean; space: boolean; enter: boolean }

interface GameObj {
  position: Pos
  radius: number
  delete: boolean
  die(): void
}

// ---- Collision ----
function hitTest(a: GameObj, b: GameObj): boolean {
  const dx = a.position.x - b.position.x
  const dy = a.position.y - b.position.y
  return dx * dx + dy * dy <= (a.radius + b.radius) * (a.radius + b.radius)
}
function collideAll(as: GameObj[], bs: GameObj[]) {
  for (let i = as.length - 1; i >= 0; i--)
    for (let j = bs.length - 1; j >= 0; j--)
      if (hitTest(as[i], bs[j])) { as[i].die(); bs[j].die() }
}
function bulletHitInvaders(bullets: Bullet[], targets: Invader[]) {
  const playerShotPadding = 8
  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = targets.length - 1; j >= 0; j--) {
      const b = bullets[i], inv = targets[j]
      const hitRadius = b.radius + inv.radius + playerShotPadding
      const r2 = hitRadius * hitRadius
      const hit = [0, 0.5, 1].some(t => {
        const sx = inv.position.x - inv.speed * t
        const dx = b.position.x - sx
        const dy = b.position.y - inv.position.y
        return dx * dx + dy * dy <= r2
      })
      if (hit) { b.die(); inv.hit() }
    }
  }
}

// ---- Audio engine (Web Audio API, procedural) ----
class AudioEngine {
  private ctx: AudioContext | null = null
  private seqTimer: ReturnType<typeof setTimeout> | null = null
  private step = 0
  private mode: 'none' | 'game' | 'boss' = 'none'
  private getCount: () => number = () => 9
  private maxCount = 9

  init() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (this.ctx.state === 'suspended') this.ctx.resume()
    } catch { /* audio not available */ }
  }

  private tone(freq: number, type: OscillatorType, dur: number, gain: number, delay = 0) {
    const ctx = this.ctx; if (!ctx) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = type; osc.frequency.value = freq
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t); osc.stop(t + dur)
  }

  shoot() {
    const ctx = this.ctx; if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(900, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08)
    g.gain.setValueAtTime(0.04, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.start(); osc.stop(ctx.currentTime + 0.08)
  }

  invaderDie() { this.tone(160, 'sawtooth', 0.22, 0.09) }

  waveClear() {
    [330, 440, 550, 660].forEach((f, i) => this.tone(f, 'square', 0.15, 0.06, i * 0.09))
  }

  shipDie() {
    const ctx = this.ctx; if (!ctx) return
    const dur = 0.9
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    const flt = ctx.createBiquadFilter()
    const g = ctx.createGain()
    src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(ctx.destination)
    flt.type = 'lowpass'; flt.frequency.value = 450
    g.gain.setValueAtTime(0.28, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    src.start(); src.stop(ctx.currentTime + dur)
    this.tone(55, 'sine', 0.7, 0.18)
  }

  startHeartbeat(getCount: () => number, maxCount: number) {
    this.getCount = getCount; this.maxCount = maxCount
    this.stopHeartbeat()
    this.mode = 'game'
    this.step = 0
    const bass = [82, 104, 123, 104]
    const lead = [330, 392, 494, 392, 523, 494, 392, 330]
    const tick = () => {
      if (this.mode !== 'game') return
      const ratio = Math.max(0.05, this.getCount() / this.maxCount)
      const ms = 145 + ratio * 420
      this.tone(bass[this.step % bass.length], 'square', 0.08, 0.035)
      if (this.step % 2 === 1) this.tone(lead[this.step % lead.length], 'triangle', 0.07, 0.022, 0.03)
      this.step++
      this.seqTimer = setTimeout(tick, ms)
    }
    tick()
  }

  startBossTheme() {
    this.stopHeartbeat()
    this.mode = 'boss'
    this.step = 0
    const bass = [98, 98, 147, 131, 98, 98, 175, 165]
    const lead = [392, 466, 523, 466, 587, 523, 466, 392]
    const tick = () => {
      if (this.mode !== 'boss') return
      this.tone(bass[this.step % bass.length], 'sawtooth', 0.1, 0.05)
      if (this.step % 2 === 0) this.tone(lead[this.step % lead.length], 'square', 0.08, 0.025, 0.04)
      if (this.step % 8 === 7) this.tone(196, 'triangle', 0.18, 0.035, 0.08)
      this.step++
      this.seqTimer = setTimeout(tick, 155)
    }
    tick()
  }

  stopHeartbeat() {
    this.mode = 'none'
    if (this.seqTimer) { clearTimeout(this.seqTimer); this.seqTimer = null }
  }

  destroy() { this.stopHeartbeat(); this.ctx?.close(); this.ctx = null }
}

// ---- Bullet ----
type BulletKind = 'ship' | 'enemy' | 'boss'
class Bullet implements GameObj {
  position: Pos; radius: number; delete: boolean; dir: 'up' | 'down'
  vx: number; vy: number; kind: BulletKind
  constructor(pos: Pos, dir: 'up' | 'down', vx?: number, vy?: number, kind: BulletKind = dir === 'up' ? 'ship' : 'enemy') {
    this.position = { ...pos }; this.delete = false; this.dir = dir
    this.kind = kind
    this.radius = kind === 'boss' ? 6 : 4
    this.vx = vx ?? 0
    this.vy = vy ?? (dir === 'up' ? -4 : 2.7)
  }
  die() { this.delete = true }
  update() { this.position.x += this.vx; this.position.y += this.vy }
  render(s: Screen) {
    if (this.position.y < -20 || this.position.y > s.height + 20 || this.position.x < -20 || this.position.x > s.width + 20) { this.die(); return }
    const ctx = s.context
    ctx.save()
    ctx.translate(this.position.x, this.position.y)
    if (this.dir === 'up') {
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createLinearGradient(0, -12, 0, 10)
      g.addColorStop(0, 'rgba(160,235,255,0.95)')
      g.addColorStop(1, 'rgba(40,120,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(-1.6, -12, 3.2, 22)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillRect(-0.6, -12, 1.2, 18)
      const tip = ctx.createRadialGradient(0, -11, 0, 0, -11, 3.2)
      tip.addColorStop(0, 'rgba(255,255,255,1)')
      tip.addColorStop(1, 'rgba(120,200,255,0)')
      ctx.beginPath(); ctx.arc(0, -11, 3.2, 0, Math.PI * 2)
      ctx.fillStyle = tip; ctx.fill()
    } else if (this.kind === 'boss') {
      // Purple plasma orb with glow
      ctx.shadowColor = '#c050ff'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#b13bff'; ctx.fill()
      ctx.shadowBlur = 0
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#f0d0ff'; ctx.fill()
    } else {
      ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0)
      ctx.closePath()
      ctx.fillStyle = '#FFBD4A'; ctx.fill()
      ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 0.5; ctx.stroke()
    }
    ctx.restore()
  }
}

// ---- Beam (telegraphed vertical laser, used by laser enemy + boss) ----
class Beam {
  x: number; originY: number; chargeMs: number; fireMs: number; half: number
  color: string; t0: number; state: 'charge' | 'fire'; delete: boolean
  constructor(x: number, originY: number, chargeMs: number, fireMs: number, half: number, color = '#ff4060') {
    this.x = x; this.originY = originY; this.chargeMs = chargeMs; this.fireMs = fireMs
    this.half = half; this.color = color; this.t0 = Date.now(); this.state = 'charge'; this.delete = false
  }
  get firing() { return this.state === 'fire' }
  update() {
    const e = Date.now() - this.t0
    if (this.state === 'charge' && e > this.chargeMs) { this.state = 'fire'; this.t0 = Date.now() }
    else if (this.state === 'fire' && e > this.fireMs) { this.delete = true }
  }
  hits(g: GameObj): boolean {
    if (!this.firing) return false
    return Math.abs(g.position.x - this.x) < this.half + g.radius && g.position.y > this.originY - g.radius
  }
  render(s: Screen) {
    const ctx = s.context
    const bottom = s.height
    ctx.save()
    if (this.state === 'charge') {
      const pulse = 0.35 + 0.35 * Math.sin(Date.now() / 45)
      ctx.globalAlpha = pulse
      ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.setLineDash([8, 8])
      ctx.beginPath(); ctx.moveTo(this.x, this.originY); ctx.lineTo(this.x, bottom); ctx.stroke()
      ctx.setLineDash([])
    } else {
      const e = Date.now() - this.t0
      const flick = 0.85 + 0.15 * Math.sin(e / 25)
      ctx.globalAlpha = flick
      ctx.shadowColor = this.color; ctx.shadowBlur = 18
      const grad = ctx.createLinearGradient(this.x - this.half, 0, this.x + this.half, 0)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, this.color)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(this.x - this.half, this.originY, this.half * 2, bottom - this.originY)
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(this.x - 1.5, this.originY, 3, bottom - this.originY)
    }
    ctx.restore()
  }
}

// ---- Ship ----
class Ship implements GameObj {
  position: Pos; speed: number; radius: number; delete: boolean
  bullets: Bullet[]; lastShot: number; tilt: number; private onDie: () => void
  constructor(pos: Pos, onDie: () => void) {
    this.position = { ...pos }; this.speed = 4.5; this.radius = 15
    this.delete = false; this.bullets = []; this.lastShot = 0; this.tilt = 0; this.onDie = onDie
  }
  die() { this.onDie() }
  update(keys: Keys, width: number) {
    if (keys.left) this.position.x -= this.speed
    if (keys.right) this.position.x += this.speed
    this.tilt += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0) - this.tilt) * 0.16
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
    const flick = 0.7 + 0.3 * Math.sin(Date.now() / 36)
    ctx.save()
    ctx.translate(this.position.x, this.position.y)
    ctx.rotate(this.tilt * 0.16)
    ctx.transform(1, 0, -this.tilt * 0.1, 1, 0, 0)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const ex of [-12.5, 12.5]) {
      const flameH = 11 * flick
      const g = ctx.createRadialGradient(ex, 14, 0, ex, 14 + flameH / 2, flameH)
      g.addColorStop(0, 'rgba(140,225,255,0.9)')
      g.addColorStop(0.4, 'rgba(50,140,255,0.45)')
      g.addColorStop(1, 'rgba(40,80,255,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(ex, 14 + flameH / 2, 3, flameH, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()

    const body = ctx.createLinearGradient(0, -18, 0, 16)
    body.addColorStop(0, '#f2f7fb')
    body.addColorStop(0.55, '#aebfcc')
    body.addColorStop(1, '#5d7282')
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.lineTo(16, 14)
    ctx.lineTo(9.5, 14)
    ctx.lineTo(0, -2)
    ctx.lineTo(-9.5, 14)
    ctx.lineTo(-16, 14)
    ctx.closePath()
    ctx.fillStyle = body
    ctx.fill()
    ctx.strokeStyle = 'rgba(140,230,255,0.9)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.beginPath(); ctx.ellipse(0, -10, 2.2, 4.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#B82A14'; ctx.fill()
    ctx.beginPath(); ctx.ellipse(-0.7, -12, 0.8, 1.6, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,220,210,0.9)'; ctx.fill()
    ctx.restore()
  }
}

// ---- Invader ----
type InvaderType = 'drone' | 'gunner' | 'diver' | 'laser'

// Speeds and descents below are tuned in absolute pixels for desktop-width
// canvases. Small screens scale the pace down so a phone is not fast-forward.
let worldScale = 1

class Invader implements GameObj {
  position: Pos; speed: number; radius: number; delete: boolean
  dir: 'left' | 'right'; bullets: Bullet[]; lastShot: number; shotCooldown: number
  type: InvaderType; hp: number; hitFlash: number
  diverState: 'formation' | 'diving'; diverTargetX: number; diverArmed: number; diverPasses: number
  fireScale: number
  beam: Beam | null; beamArmed: number

  constructor(pos: Pos, speed: number, type: InvaderType = 'drone') {
    this.position = { ...pos }; this.speed = speed
    this.radius = type === 'gunner' ? 18 : type === 'laser' ? 17 : 15
    this.delete = false; this.dir = 'right'; this.bullets = []
    this.lastShot = Date.now() + 200 + Math.random() * 800
    this.type = type
    this.hp = type === 'gunner' ? 2 : type === 'laser' ? 2 : 1
    this.hitFlash = 0
    this.diverState = 'formation'; this.diverTargetX = 0; this.diverPasses = 0
    this.diverArmed = Date.now() + 4500 + Math.random() * 7000
    this.fireScale = 1
    this.beam = null
    this.beamArmed = Date.now() + 2200 + Math.random() * 3000
    this.shotCooldown = type === 'gunner' ? 400 + Math.random() * 500
      : type === 'diver' ? 999999
      : 900 + Math.random() * 1100
  }

  hit() { this.hp--; this.hitFlash = 6; if (this.hp <= 0) this.delete = true }
  die() { this.hp = 0; this.delete = true }

  reverse() {
    if (this.diverState === 'diving') return
    this.dir = this.dir === 'right' ? 'left' : 'right'
  }

  update(shipX: number, shipY: number) {
    if (this.hitFlash > 0) this.hitFlash--
    if (this.diverState === 'diving') {
      // Continuous homing: re-aim at the ship each frame, but the horizontal
      // cap (4.2) is below ship speed (4.5) so it stays outrunnable / killable.
      this.diverTargetX = shipX
      const dx = this.diverTargetX - this.position.x
      this.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 4.2 * Math.max(0.75, worldScale))
      this.position.y += 5.0 * Math.max(0.7, worldScale)
      return
    }

    if (this.type === 'laser') {
      // Laser enemy: drift in formation, then lock, telegraph, and fire a
      // straight-down beam. Freezes horizontally while charging/firing.
      const now = Date.now()
      if (this.beam) {
        this.beam.update()
        if (this.beam.delete) { this.beam = null; this.beamArmed = now + 2600 + Math.random() * 2600 }
      } else if (now > this.beamArmed) {
        this.beam = new Beam(this.position.x, this.position.y + this.radius, 800, 460, 11, '#ff3b6b')
      } else {
        this.position.x += this.dir === 'right' ? this.speed : -this.speed
      }
      return
    }

    this.position.x += this.dir === 'right' ? this.speed : -this.speed
    if (this.type === 'diver' && Date.now() > this.diverArmed) {
      this.diverState = 'diving'; this.diverTargetX = shipX
    }
    if (this.type !== 'diver') {
      const now = Date.now()
      if (now - this.lastShot > this.shotCooldown / this.fireScale) {
        const fromX = this.position.x
        const fromY = this.position.y + 14
        const spread = (Math.random() - 0.5) * 90
        const dx = shipX - fromX + spread
        const dy = Math.max(shipY - fromY, 80)
        const dist = Math.sqrt(dx * dx + dy * dy)
        const bSpeed = this.type === 'gunner' ? 4.5 : 3.2
        this.bullets.push(new Bullet({ x: fromX, y: fromY }, 'down', (dx / dist) * bSpeed, (dy / dist) * bSpeed))
        if (this.type === 'gunner' && Math.random() < 0.4) {
          const dx2 = shipX - fromX + (Math.random() - 0.5) * 140
          const dist2 = Math.sqrt(dx2 * dx2 + dy * dy)
          this.bullets.push(new Bullet({ x: fromX, y: fromY }, 'down', (dx2 / dist2) * bSpeed, (dy / dist2) * bSpeed))
        }
        this.lastShot = now
        this.shotCooldown = this.type === 'gunner'
          ? 400 + Math.random() * 500 : 900 + Math.random() * 1100
      }
    }
  }

  render(s: Screen) {
    this.bullets = this.bullets.filter(b => !b.delete)
    for (const b of this.bullets) { b.update(); b.render(s) }
    if (this.beam) this.beam.render(s)
    const ctx = s.context
    ctx.save(); ctx.translate(this.position.x, this.position.y)
    if (this.hitFlash > 0) ctx.globalAlpha = 0.3 + (this.hitFlash / 6) * 0.7
    const auraColor = this.type === 'gunner' ? '255,90,30'
      : this.type === 'diver' ? '0,200,255'
      : this.type === 'laser' ? '255,60,110'
      : '255,190,74'
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 26)
    aura.addColorStop(0, `rgba(${auraColor},0.16)`)
    aura.addColorStop(1, `rgba(${auraColor},0)`)
    ctx.fillStyle = aura
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    if (this.type === 'laser') {
      const charging = this.beam?.state === 'charge'
      ctx.fillStyle = charging ? '#ff5a7a' : '#d52a55'
      ctx.strokeStyle = '#ff8aa6'; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -16); ctx.lineTo(15, -4); ctx.lineTo(10, 12)
      ctx.lineTo(-10, 12); ctx.lineTo(-15, -4)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      // emitter eye that glows while locking on
      const eyeGlow = charging ? 0.6 + 0.4 * Math.sin(Date.now() / 50) : 1
      ctx.globalAlpha = (this.hitFlash > 0 ? 0.3 + (this.hitFlash / 6) * 0.7 : 1) * eyeGlow
      ctx.fillStyle = charging ? '#ffe0e8' : '#3a0010'
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ff2a55'
      ctx.beginPath(); ctx.arc(0, 7, 2.5, 0, Math.PI * 2); ctx.fill()
      ctx.restore(); return
    }

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
    const angle = Math.random() * Math.PI * 2
    const speed = (2 + Math.random() * 7) * speedMult
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed
    this.life = 0; this.maxLife = 25 + Math.random() * 20
    this.color = color; this.size = 1.5 + Math.random() * 3
  }
  update() { this.position.x += this.vx; this.position.y += this.vy; this.vy += 0.05; this.life++ }
  get dead() { return this.life >= this.maxLife }
  render(ctx: CanvasRenderingContext2D) {
    const k = 1 - this.life / this.maxLife
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = k
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.position.x, this.position.y, Math.max(0.4, this.size * k), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ---- Expanding shock ring drawn on kills ----
class Ring {
  pos: Pos; r: number; max: number; color: string
  constructor(pos: Pos, max: number, color: string) {
    this.pos = { ...pos }; this.r = 0; this.max = max; this.color = color
  }
  get dead() { return this.r >= this.max }
  step(ctx: CanvasRenderingContext2D) {
    this.r += this.max / 16
    const a = Math.max(0, 1 - this.r / this.max)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = a * 0.7
    ctx.strokeStyle = this.color
    ctx.lineWidth = 1.5 + a * 1.5
    ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  }
}

// ---- Boss (level 10: purple one-eyed void monster) ----
type EyeState = 'closed' | 'opening' | 'open' | 'closing'
class Boss implements GameObj {
  position: Pos; radius: number; delete: boolean
  hp: number; maxHp: number; W: number
  bullets: Bullet[]; beams: Beam[]
  dir: 1 | -1; hitFlash: number
  eyeState: EyeState; eyeT: number
  lastAimed: number; lastRadial: number; lastBeam: number
  aimX: number; aimY: number
  defeated: boolean

  constructor(x: number, y: number, W: number) {
    this.position = { x, y }; this.radius = 52; this.delete = false
    this.maxHp = 32; this.hp = 32; this.W = W
    this.bullets = []; this.beams = []
    this.dir = 1; this.hitFlash = 0
    this.eyeState = 'closed'; this.eyeT = Date.now()
    const now = Date.now()
    this.lastAimed = now + 1200; this.lastRadial = now + 2200; this.lastBeam = now + 3000
    this.aimX = x; this.aimY = y + 200; this.defeated = false
  }

  get vulnerable() { return this.eyeState === 'open' }
  get phase() { return this.hp < this.maxHp * 0.34 ? 2 : this.hp < this.maxHp * 0.67 ? 1 : 0 }

  // Returns true if damage landed (eye open). Otherwise the shot deflects.
  hit(): boolean {
    if (!this.vulnerable) return false
    this.hp--; this.hitFlash = 5
    if (this.hp <= 0) { this.hp = 0; this.delete = true; this.defeated = true }
    return true
  }
  die() { this.hp = 0; this.delete = true; this.defeated = true }

  // Smooth 0..1 eye openness for rendering.
  eyeOpenAmt(): number {
    const since = Date.now() - this.eyeT
    if (this.eyeState === 'closed') return 0
    if (this.eyeState === 'opening') return Math.min(1, since / 650)
    if (this.eyeState === 'open') return 1
    return Math.max(0, 1 - since / 450)
  }

  update(shipX: number, shipY: number) {
    if (this.hitFlash > 0) this.hitFlash--
    this.aimX = shipX; this.aimY = shipY
    const now = Date.now()
    const ph = this.phase

    // Drift horizontally, faster as it loses health
    const drift = 1.2 + ph * 0.5
    this.position.x += this.dir * drift
    if (this.position.x > this.W - 70) this.dir = -1
    if (this.position.x < 70) this.dir = 1

    // Eye cycle: long armored window, brief telegraph, then vulnerable opening
    const since = now - this.eyeT
    const closedMs = 3600 - ph * 500
    if (this.eyeState === 'closed' && since > closedMs) { this.eyeState = 'opening'; this.eyeT = now }
    else if (this.eyeState === 'opening' && since > 650) { this.eyeState = 'open'; this.eyeT = now }
    else if (this.eyeState === 'open' && since > 2700) { this.eyeState = 'closing'; this.eyeT = now }
    else if (this.eyeState === 'closing' && since > 450) { this.eyeState = 'closed'; this.eyeT = now }

    // Aimed spread at the player
    const aimedCd = 1700 - ph * 350
    if (now - this.lastAimed > aimedCd) {
      this.lastAimed = now
      const fromX = this.position.x, fromY = this.position.y + this.radius * 0.4
      const base = Math.atan2(shipY - fromY, shipX - fromX)
      const offs = ph >= 1 ? [-0.24, 0, 0.24] : [-0.16, 0.16]
      for (const off of offs) {
        const a = base + off, sp = 3.4
        this.bullets.push(new Bullet({ x: fromX, y: fromY }, 'down', Math.cos(a) * sp, Math.sin(a) * sp, 'boss'))
      }
    }

    // Radial bullet-hell ring
    const radialCd = 3600 - ph * 650
    if (now - this.lastRadial > radialCd) {
      this.lastRadial = now
      const n = 14 + ph * 4
      const spin = Math.random() * Math.PI
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2, sp = 2.4
        this.bullets.push(new Bullet({ x: this.position.x, y: this.position.y }, 'down', Math.cos(a) * sp, Math.sin(a) * sp, 'boss'))
      }
    }

    // Dodgeable vertical beams (more once enraged)
    const beamCd = 2800 - ph * 500
    if (now - this.lastBeam > beamCd) {
      this.lastBeam = now
      const count = 1 + ph
      for (let i = 0; i < count; i++) {
        const bx = 60 + Math.random() * (this.W - 120)
        this.beams.push(new Beam(bx, 0, 780, 460, 13, '#c050ff'))
      }
    }

    for (const bm of this.beams) bm.update()
    this.beams = this.beams.filter(b => !b.delete)
  }

  render(s: Screen) {
    // Bullets + beams first (under the body)
    this.bullets = this.bullets.filter(b => !b.delete)
    for (const b of this.bullets) { b.update(); b.render(s) }
    for (const bm of this.beams) bm.render(s)

    const ctx = s.context
    const t = Date.now() / 1000
    const open = this.eyeOpenAmt()
    ctx.save(); ctx.translate(this.position.x, this.position.y)

    // Outer aura
    const aura = ctx.createRadialGradient(0, 0, this.radius * 0.4, 0, 0, this.radius * 1.8)
    aura.addColorStop(0, 'rgba(150,60,255,0.28)')
    aura.addColorStop(1, 'rgba(150,60,255,0)')
    ctx.fillStyle = aura
    ctx.beginPath(); ctx.arc(0, 0, this.radius * 1.8, 0, Math.PI * 2); ctx.fill()

    // Tentacles
    ctx.strokeStyle = '#5a1a86'; ctx.lineWidth = 7; ctx.lineCap = 'round'
    for (let i = -2; i <= 2; i++) {
      const bx = i * 18
      const sway = Math.sin(t * 2 + i) * 10
      ctx.beginPath(); ctx.moveTo(bx, this.radius * 0.5)
      ctx.quadraticCurveTo(bx + sway, this.radius * 1.1, bx + sway * 1.6, this.radius * 1.5)
      ctx.stroke()
    }

    // Body
    const body = ctx.createRadialGradient(-14, -16, 8, 0, 0, this.radius)
    body.addColorStop(0, '#a24bd8')
    body.addColorStop(0.6, '#7a1fb0')
    body.addColorStop(1, '#4a1170')
    ctx.fillStyle = body
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill()

    // Armor plates (top crown)
    ctx.strokeStyle = '#3a0d5c'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(0, 0, this.radius - 5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke()
    ctx.fillStyle = '#2c0a47'
    for (let i = -2; i <= 2; i++) {
      ctx.save(); ctx.rotate(i * 0.32); ctx.beginPath()
      ctx.moveTo(-6, -this.radius + 2); ctx.lineTo(6, -this.radius + 2); ctx.lineTo(0, -this.radius - 11)
      ctx.closePath(); ctx.fill(); ctx.restore()
    }

    // Eye socket
    ctx.fillStyle = '#1a0526'
    ctx.beginPath(); ctx.arc(0, 2, 26, 0, Math.PI * 2); ctx.fill()

    if (open > 0.02) {
      // Sclera
      ctx.save(); ctx.globalAlpha = open
      const glow = this.vulnerable ? 0.6 + 0.4 * Math.sin(t * 9) : 0.4
      ctx.shadowColor = '#ff60d0'; ctx.shadowBlur = 22 * glow
      ctx.fillStyle = '#ffe6ff'
      ctx.beginPath(); ctx.ellipse(0, 2, 22, 13 + open * 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      // Iris tracks the player
      const ang = Math.atan2(this.aimY - this.position.y, this.aimX - this.position.x)
      const ex = Math.cos(ang) * 7, ey = 2 + Math.sin(ang) * 5
      ctx.fillStyle = '#b13bff'
      ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a0526'
      ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(ex - 2, ey - 2, 1.6, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      // Vulnerable ring cue
      if (this.vulnerable) {
        ctx.strokeStyle = `rgba(255,90,210,${0.5 + 0.4 * Math.sin(t * 9)})`
        ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.arc(0, 2, 30, 0, Math.PI * 2); ctx.stroke()
      }
    } else {
      // Armored slit when closed
      ctx.strokeStyle = '#ff5ad0'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.moveTo(-20, 2); ctx.lineTo(20, 2); ctx.stroke()
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#2c0a47'; ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(0, 2, 24, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 2, 24, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
    }

    if (this.hitFlash > 0) {
      ctx.globalAlpha = (this.hitFlash / 5) * 0.6
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

// ---- Star field ----
type Star = { x: number; y: number; z: number; tw: number; c: string }
const STAR_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#bcd6ff', '#ffe2bd', '#d7c7ff']
function makeStars(count: number, w: number, h: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h, z: Math.random(),
    tw: Math.random() * Math.PI * 2,
    c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  }))
}
let comet: { x: number; y: number; vx: number; vy: number } | null = null
function renderStars(stars: Star[], ctx: CanvasRenderingContext2D, w: number, h: number) {
  const t = Date.now() / 1000
  ctx.save()
  for (const s of stars) {
    s.y += 0.12 + s.z * s.z * 0.55
    if (s.y > h) { s.y = 0; s.x = Math.random() * w }
    const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + s.z * 2.5) + s.tw)
    ctx.globalAlpha = (0.12 + s.z * 0.65) * tw
    ctx.fillStyle = s.c
    const r = 0.5 + s.z * 1.1
    ctx.fillRect(s.x, s.y, r, r)
  }
  ctx.restore()
  if (!comet && Math.random() < 0.0035) {
    comet = { x: w * 0.1 + Math.random() * w * 0.8, y: -10, vx: (Math.random() - 0.5) * 5, vy: 7 + Math.random() * 4 }
  }
  if (comet) {
    comet.x += comet.vx; comet.y += comet.vy
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createLinearGradient(comet.x - comet.vx * 6, comet.y - comet.vy * 6, comet.x, comet.y)
    g.addColorStop(0, 'rgba(150,200,255,0)')
    g.addColorStop(1, 'rgba(220,240,255,0.8)')
    ctx.strokeStyle = g
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(comet.x - comet.vx * 6, comet.y - comet.vy * 6)
    ctx.lineTo(comet.x, comet.y)
    ctx.stroke()
    ctx.restore()
    if (comet.y > h + 20 || comet.x < -20 || comet.x > w + 20) comet = null
  }
}

// Faint nebula haze, prerendered per size so each frame is a cheap blit.
let nebulaCache: HTMLCanvasElement | null = null
let nebulaW = 0
let nebulaH = 0
function renderNebula(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (!nebulaCache || nebulaW !== w || nebulaH !== h) {
    nebulaCache = document.createElement('canvas')
    nebulaCache.width = w
    nebulaCache.height = h
    const nctx = nebulaCache.getContext('2d')!
    const blobs = [
      { x: 0.22 * w, y: 0.3 * h, r: Math.max(w, h) * 0.42, c: '38,18,64' },
      { x: 0.8 * w, y: 0.62 * h, r: Math.max(w, h) * 0.38, c: '8,36,58' },
      { x: 0.55 * w, y: 0.88 * h, r: Math.max(w, h) * 0.3, c: '52,16,28' },
    ]
    for (const b of blobs) {
      const g = nctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
      g.addColorStop(0, `rgba(${b.c},0.55)`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      nctx.fillStyle = g
      nctx.fillRect(0, 0, w, h)
    }
    nebulaW = w
    nebulaH = h
  }
  const t = Date.now() / 9000
  ctx.drawImage(nebulaCache, Math.sin(t) * 8, Math.cos(t * 0.8) * 6)
}

const FINAL_WAVE = 10

// ---- Formation templates (9 cols: D=drone G=gunner V=diver L=laser space=empty) ----
const FORMATIONS: string[][] = [
  ['   DDD   ', ' DDDDDDD ', '  DDDDD  '],
  ['    D    ', '   DDD   ', '  DDDDD  ', ' DDDDDDD ', '    G    '],
  ['   DDD   ', ' DDDDDDD ', 'G DDDDD G', 'V       V'],
  ['    L    ', '  D D D  ', ' DDDDDDD ', 'GV     VG'],
  ['V  DLD  V', 'DDDDDDDDD', 'G DDDDD G', '  DLDLD  '],
  ['L   D   L', ' DGDGDGD ', 'V DDDDD V', '  G D G  '],
  ['V L D L V', ' DDG GDD ', '  DDLDD  ', ' G  D  G '],
  ['L G D G L', ' DDDDDDD ', 'V G D G V', '  L D L  '],
  ['V L G L V', ' DDDDDDD ', 'G D L D G', ' V G G V '],
]

function makeFormation(wave: number, speed: number, W: number): Invader[] {
  const template = FORMATIONS[Math.min(wave - 1, FORMATIONS.length - 1)]
  const widthFrac = W < 560 ? 0.72 : 0.88
  const cellW = Math.min(72, Math.floor(W * widthFrac / 9))
  const rowH = Math.min(62, Math.round(cellW * 62 / 72))
  const startX = (W - 9 * cellW) / 2 + cellW / 2
  const startY = 48
  const out: Invader[] = []
  template.forEach((row, ri) => {
    for (let ci = 0; ci < 9; ci++) {
      const ch = row[ci] ?? ' '
      if (ch === ' ') continue
      const type: InvaderType = ch === 'G' ? 'gunner' : ch === 'V' ? 'diver' : ch === 'L' ? 'laser' : 'drone'
      out.push(new Invader({ x: startX + ci * cellW, y: startY + ri * rowH }, speed, type))
    }
  })
  return out
}

// ---- Touch button (pointer capture keeps up/cancel reliable) ----
function TouchBtn({ onDown, onUp, children, style }: {
  onDown: () => void; onUp: () => void; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <button
      style={{ touchAction: 'none', userSelect: 'none', ...style }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onDown() }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {children}
    </button>
  )
}

// ---- Game States ----
type GState = 'start' | 'playing' | 'over'

const monoBase: React.CSSProperties = {
  fontFamily: 'monospace',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

export function SpaceFighterGame({ username, onSaveScore }: {
  username?: string
  onSaveScore?: (score: number) => Promise<void>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const keysRef = useRef<Keys>({ left: false, right: false, space: false, enter: false })
  const ensureAudioRef = useRef<() => void>(() => {})
  const restartRef = useRef<() => void>(() => {})

  const [uiState, setUiState] = useState<GState>('start')
  const [finalScore, setFinalScore] = useState(0)
  const [endTitle, setEndTitle] = useState('Game Over')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ratio = window.devicePixelRatio || 1
    // CSS fills wrapper; buffer dimensions match container
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    let W = wrap.offsetWidth
    worldScale = Math.max(0.55, Math.min(1, W / 900))
    let H = wrap.offsetHeight
    canvas.width = W * ratio; canvas.height = H * ratio
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)

    const keys = keysRef.current
    let gameState: GState = 'start'
    let ship: Ship | null = null
    let invaders: Invader[] = []
    let boss: Boss | null = null
    let orphanBullets: Bullet[] = []
    let particles: Particle[] = []
    let rings: Ring[] = []
    let shake = 0
    let waveBannerUntil = 0
    let bannerText = ''
    let stars = makeStars(120, W, H)
    let score = 0
    let wave = 1
    let maxInvaders = 9
    let baseSpeed = 1.0
    let raf = 0
    let dying = false
    let flashFrames = 0
    let shockwave: { pos: Pos; r: number } | null = null

    let audio: AudioEngine | null = null
    ensureAudioRef.current = () => {
      if (audio) return
      audio = new AudioEngine()
      audio.init()
    }

    const shipExplosionColors = ['#B82A14', '#ff6644', '#ffcc44', '#ffffff', '#ff4400']
    const spawnParticles = (pos: Pos, colors: string[], count: number, speedMult = 1) => {
      for (let i = 0; i < count; i++)
        particles.push(new Particle(pos, colors[i % colors.length], speedMult))
    }

    const die = () => {
      if (dying) return
      dying = true
      if (ship) {
        const pos = { ...ship.position }
        spawnParticles(pos, shipExplosionColors, 80, 2.0)
        spawnParticles(pos, ['#ffffff', '#ffcc44', '#ff8844'], 30, 3.5)
        shockwave = { pos, r: 0 }
        audio?.shipDie()
      }
      flashFrames = 22
      ship = null; invaders = []; boss = null
      setEndTitle('Game Over')
      setTimeout(() => { gameState = 'over'; setFinalScore(score); setUiState('over') }, 1200)
    }

    const winGame = () => {
      if (dying) return
      dying = true
      const pos = boss ? { ...boss.position } : { x: W / 2, y: H * 0.25 }
      score += 2500
      spawnParticles(pos, ['#c050ff', '#ff60d0', '#ffffff', '#7a1fb0'], 120, 2.8)
      shockwave = { pos, r: 0 }
      ship = null; invaders = []; boss = null
      audio?.stopHeartbeat()
      audio?.waveClear()
      flashFrames = 26
      setEndTitle('Victory')
      setTimeout(() => { gameState = 'over'; setFinalScore(score); setUiState('over') }, 1400)
    }

    const startGame = () => {
      dying = false; score = 0; wave = 1
      orphanBullets = []; particles = []; rings = []; shake = 0; boss = null
      baseSpeed = 1.0
      ship = new Ship({ x: W / 2, y: H - 70 }, die)
      invaders = makeFormation(1, baseSpeed, W)
      bannerText = 'WAVE 1'; waveBannerUntil = Date.now() + 1500
      maxInvaders = invaders.length
      gameState = 'playing'
      setUiState('playing')
      setSaved(false)
      setEndTitle('Game Over')
      audio?.stopHeartbeat()
      audio?.startHeartbeat(() => invaders.length, maxInvaders)
    }

    restartRef.current = startGame

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
    window.addEventListener('keydown', downHandler)
    window.addEventListener('keyup', upHandler)

    const loop = () => {
      const s: Screen = { width: W, height: H, context: ctx }
      ctx.fillStyle = '#03040a'; ctx.fillRect(0, 0, W, H)
      renderNebula(ctx, W, H)
      renderStars(stars, ctx, W, H)
      ctx.save()
      if (shake > 0.3) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
        shake *= 0.88
      } else {
        shake = 0
      }

      if (gameState === 'start' || gameState === 'over') {
        if (keys.enter) { keys.enter = false; startGame() }
      }

      if (gameState === 'playing' || dying) {
        if (gameState === 'playing' && ship) {
          const bulletsBefore = ship.bullets.length
          ship.update(keys, W); ship.render(s)
          if (ship.bullets.length > bulletsBefore) audio?.shoot()

          const shipX = ship ? ship.position.x : W / 2
          const shipY = ship ? ship.position.y : H - 70

          // Speed scales up as enemies are destroyed, capped at 8
          const fractionLeft = Math.max(invaders.length, 1) / maxInvaders
          const dynamicSpeed = Math.min(baseSpeed * worldScale * (1 + (1 - fractionLeft) * 1.6), 6.5 * worldScale)
          for (const inv of invaders) {
            inv.fireScale = Math.min(1 + (wave - 1) * 0.11, 1.85)
            if (inv.diverState !== 'diving') inv.speed = dynamicSpeed
          }

          let needReverse = false
          for (let i = invaders.length - 1; i >= 0; i--) {
            const inv = invaders[i]
            if (inv.delete) {
              const killColors = inv.type === 'gunner' ? ['#FF4400', '#FF8800', '#ffffff', '#ffcc44']
                : inv.type === 'diver' ? ['#00CCFF', '#00FFFF', '#ffffff', '#0088ff']
                : inv.type === 'laser' ? ['#ff3b6b', '#ff9ab0', '#ffffff']
                : ['#FFBD4A', '#ffe080', '#ffffff']
              spawnParticles(inv.position, killColors, inv.type === 'gunner' ? 22 : 14)
              rings.push(new Ring(inv.position, inv.type === 'gunner' ? 52 : 34, killColors[0]))
              if (inv.type === 'gunner') shake = Math.max(shake, 5)
              orphanBullets.push(...inv.bullets.filter(b => !b.delete))
              invaders.splice(i, 1)
              score += inv.type === 'gunner' ? 30 : inv.type === 'diver' ? 20 : inv.type === 'laser' ? 35 : 10
              audio?.invaderDie()
              continue
            }
            if (inv.diverState === 'diving') {
              if (inv.position.y > H + 24) {
                inv.position.y = -24
                inv.position.x = Math.max(24, Math.min(W - 24, inv.position.x + (Math.random() - 0.5) * 80))
                inv.diverPasses++
              }
              inv.update(shipX, shipY); inv.render(s)
              continue
            }
            if (inv.position.y + inv.radius >= H) { die(); break }
            inv.update(shipX, shipY); inv.render(s)
            if (inv.position.x + inv.radius >= W || inv.position.x - inv.radius <= 0) needReverse = true
          }
          if (needReverse) for (const inv of invaders) {
            if (inv.diverState !== 'diving') { inv.reverse(); inv.position.y += Math.max(8, Math.round(16 * worldScale)) }
          }

          orphanBullets = orphanBullets.filter(b => !b.delete)
          for (const b of orphanBullets) { b.update(); b.render(s) }

          if (ship) {
            bulletHitInvaders(ship.bullets, invaders)
            for (const inv of invaders) {
              if (!ship) break
              collideAll(inv.bullets, [ship])
              if (ship && inv.beam?.hits(ship)) die()
            }
            if (ship) collideAll(orphanBullets, [ship])
            if (ship) collideAll([ship], invaders)
          }

          if (boss && ship) {
            boss.update(shipX, shipY)
            boss.render(s)

            for (let i = ship.bullets.length - 1; i >= 0; i--) {
              const b = ship.bullets[i]
              const bossHitRadius = b.radius + boss.radius + 10
              const dx = b.position.x - boss.position.x
              const dy = b.position.y - boss.position.y
              if (dx * dx + dy * dy > bossHitRadius * bossHitRadius) continue
              b.die()
              if (boss.hit()) {
                score += 45
                spawnParticles(b.position, ['#ff60d0', '#ffffff', '#c050ff'], 8, 1.2)
              } else {
                spawnParticles(b.position, ['#7a1fb0', '#c050ff'], 5, 0.8)
              }
            }
            collideAll(boss.bullets, [ship])
            if (ship) {
              for (const beam of boss.beams) if (beam.hits(ship)) die()
            }
            if (ship && hitTest(ship, boss)) die()
            if (boss.delete) {
              winGame()
            } else {
              const barW = Math.min(320, W * 0.62)
              const barX = (W - barW) / 2
              const barY = 34
              ctx.save()
              ctx.fillStyle = 'rgba(80,16,110,0.55)'
              ctx.fillRect(barX, barY, barW, 8)
              ctx.fillStyle = '#ff60d0'
              ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), 8)
              ctx.strokeStyle = 'rgba(255,255,255,0.35)'
              ctx.strokeRect(barX, barY, barW, 8)
              ctx.font = `${Math.round(11 * ratio) / ratio}px monospace`
              ctx.fillStyle = 'rgba(255,255,255,0.55)'
              ctx.fillText(boss.vulnerable ? 'EYE OPEN' : 'ARMORED', barX, barY - 7)
              ctx.restore()
            }
          }

          if (invaders.length === 0 && ship && !boss) {
            audio?.stopHeartbeat()
            audio?.waveClear()
            if (wave >= FINAL_WAVE - 1) {
              wave = FINAL_WAVE
              score += 50 * wave * wave
              boss = new Boss(W / 2, Math.min(120, H * 0.24), W)
              bannerText = 'FINAL WAVE'; waveBannerUntil = Date.now() + 1800
              maxInvaders = 1
              setTimeout(() => audio?.startBossTheme(), 500)
            } else {
              wave++
              score += 50 * wave * wave
              bannerText = `WAVE ${wave}`; waveBannerUntil = Date.now() + 1500
              baseSpeed = Math.min(0.7 + wave * 0.28, 2.2)
              invaders = makeFormation(wave, baseSpeed, W)
              maxInvaders = invaders.length
              setTimeout(() => audio?.startHeartbeat(() => invaders.length, maxInvaders), 600)
            }
          }

          ctx.font = `${Math.round(13 * ratio) / ratio}px monospace`
          ctx.fillStyle = 'rgba(160,210,255,0.5)'
          ctx.fillText('SCORE', 12, 22)
          ctx.fillStyle = 'rgba(235,245,255,0.9)'
          ctx.fillText(`${score}`, 66, 22)
          ctx.fillStyle = 'rgba(160,210,255,0.5)'
          ctx.fillText('WAVE', W - 96, 22)
          ctx.fillStyle = 'rgba(235,245,255,0.9)'
          ctx.fillText(`${wave}`, W - 48, 22)
          if (Date.now() < waveBannerUntil) {
            const left = (waveBannerUntil - Date.now()) / 1500
            ctx.save()
            ctx.globalAlpha = Math.min(1, left * 3) * 0.85
            ctx.font = `${Math.round(30 * ratio) / ratio}px monospace`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#bfe2ff'
            ctx.fillText(bannerText, W / 2, H * 0.3)
            ctx.restore()
          }
        }

        rings = rings.filter(r => !r.dead)
        for (const r of rings) r.step(ctx)
        particles = particles.filter(p => !p.dead)
        for (const p of particles) { p.update(); p.render(ctx) }

        if (shockwave) {
          shockwave.r += 5
          const alpha = Math.max(0, 1 - shockwave.r / 140)
          ctx.save(); ctx.globalAlpha = alpha * 0.85
          ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 3
          ctx.beginPath(); ctx.arc(shockwave.pos.x, shockwave.pos.y, shockwave.r, 0, Math.PI * 2)
          ctx.stroke()
          ctx.strokeStyle = '#ff8844'; ctx.lineWidth = 1.5; ctx.globalAlpha = alpha * 0.5
          ctx.beginPath(); ctx.arc(shockwave.pos.x, shockwave.pos.y, shockwave.r * 0.55, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
          if (shockwave.r >= 140) shockwave = null
        }

        if (flashFrames > 0) {
          ctx.save(); ctx.globalAlpha = (flashFrames / 22) * 0.5
          ctx.fillStyle = '#B82A14'; ctx.fillRect(0, 0, W, H)
          ctx.restore(); flashFrames--
        }
      }

      ctx.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', downHandler)
      window.removeEventListener('keyup', upHandler)
      audio?.destroy()
    }
  }, [])

  const k = keysRef.current

  const handleSaveScore = async () => {
    if (!onSaveScore || saving || saved) return
    setSaving(true)
    try {
      await onSaveScore(finalScore)
      setSaved(true)
    } catch {
      // save failed silently
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = () => {
    ensureAudioRef.current()
    // Signal through keys ref so the game loop handles restart (same as mobile tap-to-start)
    k.enter = true
    setTimeout(() => { k.enter = false }, 80)
  }

  return (
    <div
      ref={wrapRef}
      style={{ flex: '1 1 0', minHeight: 0, position: 'relative', background: '#000', userSelect: 'none' as const }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}
      />

      {uiState === 'start' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...monoBase, fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '24px', pointerEvents: 'none' }}>
            2019-2026
          </div>
          <div style={{ lineHeight: 1, marginBottom: '40px', textAlign: 'center', pointerEvents: 'none', fontFamily: '"Impact", "Arial Black", sans-serif', letterSpacing: '0.04em' }}>
            <span style={{
              fontSize: 'clamp(42px, 10vw, 86px)',
              color: '#d0d0d0',
              textShadow: '0 0 18px rgba(255,255,255,0.35), 0 0 40px rgba(255,255,255,0.12)',
              textTransform: 'uppercase',
            }}>SPACEFIGHTER</span>
            <span style={{
              fontSize: 'clamp(42px, 10vw, 86px)',
              color: '#B82A14',
              textShadow: '0 0 14px rgba(184,42,20,0.9), 0 0 32px rgba(184,42,20,0.55), 0 0 60px rgba(184,42,20,0.25)',
              textTransform: 'uppercase',
            }}>V</span>
          </div>
          <div style={{ ...monoBase, fontSize: '11px', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
            Press Enter to start
          </div>
          <div style={{ ...monoBase, fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '8px', pointerEvents: 'none' }}>
            Arrow keys to move · Space to shoot
          </div>
          <button
            style={{ ...monoBase, fontSize: '12px', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 24px', borderRadius: '4px', background: 'none', cursor: 'pointer', marginTop: '16px' }}
            onClick={() => {
              ensureAudioRef.current()
              k.enter = true; setTimeout(() => { k.enter = false }, 80)
            }}
          >
            Tap to start
          </button>
          <div style={{ ...monoBase, fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '12px', pointerEvents: 'none' }}>
            Use the controls below on mobile
          </div>
        </div>
      )}

      {uiState === 'over' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...monoBase, fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '16px' }}>
            {endTitle}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', color: '#ffffff', lineHeight: 1, marginBottom: '8px', fontSize: 'clamp(48px, 12vw, 96px)' }}>
            {finalScore}
          </div>
          <div style={{ ...monoBase, fontSize: '11px', color: '#B82A14', marginTop: '4px' }}>
            Score
          </div>
          {username && onSaveScore && (
            <button
              onClick={handleSaveScore}
              disabled={saving || saved}
              style={{
                ...monoBase, fontSize: '11px',
                color: saved ? 'rgba(255,255,255,0.3)' : '#B82A14',
                border: '1px solid',
                borderColor: saved ? 'rgba(255,255,255,0.15)' : 'rgba(184,42,20,0.5)',
                background: 'none', padding: '10px 24px',
                cursor: saved ? 'default' : 'pointer',
                marginTop: '24px',
              }}
            >
              {saved ? 'Saved' : saving ? 'Saving...' : 'Save Score'}
            </button>
          )}
          <button
            onClick={handleRestart}
            style={{
              ...monoBase, fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'none', padding: '10px 24px',
              cursor: 'pointer',
              marginTop: '10px',
            }}
          >
            Play Again
          </button>
          {!username && (
            <div style={{ ...monoBase, fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '20px' }}>
              Log in to save your score
            </div>
          )}
        </div>
      )}

      {uiState !== 'over' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px 32px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
            <TouchBtn
              onDown={() => { ensureAudioRef.current(); k.left = true }}
              onUp={() => { k.left = false }}
              style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer' }}
            >
              ←
            </TouchBtn>
            <TouchBtn
              onDown={() => { ensureAudioRef.current(); k.right = true }}
              onUp={() => { k.right = false }}
              style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer' }}
            >
              →
            </TouchBtn>
          </div>
          <TouchBtn
            onDown={() => { ensureAudioRef.current(); k.space = true }}
            onUp={() => { k.space = false }}
            style={{ width: '80px', height: '80px', borderRadius: '50%', border: '1px solid rgba(184,42,20,0.5)', background: 'rgba(184,42,20,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...monoBase, fontSize: '10px', color: 'rgba(184,42,20,0.8)', cursor: 'pointer', pointerEvents: 'auto' }}
          >
            FIRE
          </TouchBtn>
        </div>
      )}
    </div>
  )
}
