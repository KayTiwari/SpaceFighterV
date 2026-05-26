'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SpaceFighterGame } from '@/components/space-fighter'
import { AuthModal } from '@/components/auth-modal'

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('sfv_token')
    const u = localStorage.getItem('sfv_username')
    if (t && u) { setToken(t); setUsername(u) }
  }, [])

  const logout = () => {
    localStorage.removeItem('sfv_token'); localStorage.removeItem('sfv_username')
    setToken(null); setUsername(null)
  }

  const onSaveScore = async (score: number) => {
    if (!token) { setShowAuth(true); throw new Error('not authenticated') }
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) throw new Error('Failed to save')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
          SpaceFighterV
        </span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Link href="/scores" style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
            Scores
          </Link>
          {username ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                {username}
              </span>
              <button onClick={logout} style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Logout
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Login to save scores
            </button>
          )}
        </div>
      </div>

      {/* Game */}
      <SpaceFighterGame
        username={username ?? undefined}
        onSaveScore={token ? onSaveScore : undefined}
      />

      {showAuth && (
        <AuthModal
          onSuccess={(t, u) => { setToken(t); setUsername(u); setShowAuth(false) }}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  )
}
