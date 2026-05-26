'use client'

import { useState } from 'react'

type Mode = 'login' | 'signup'

async function callAuth(mode: Mode, username: string, password: string) {
  const res = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as { token: string; username: string }
}

export function AuthModal({ onSuccess, onClose }: {
  onSuccess: (token: string, username: string) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { token, username: name } = await callAuth(mode, username.trim(), password)
      localStorage.setItem('sfv_token', token)
      localStorage.setItem('sfv_username', name)
      onSuccess(token, name)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#0a0a0a] border border-white/10 rounded p-8 w-full max-w-sm">
        <div className="font-mono text-[10px] tracking-widest uppercase text-white/30 mb-6">
          {mode === 'login' ? 'Login' : 'Create account'}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            className="bg-white/5 border border-white/10 rounded px-4 py-2.5 text-white font-mono text-[13px] focus:outline-none focus:border-white/30"
            placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoFocus required
          />
          <input
            type="password"
            className="bg-white/5 border border-white/10 rounded px-4 py-2.5 text-white font-mono text-[13px] focus:outline-none focus:border-white/30"
            placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
          />
          {error && <div className="font-mono text-[11px] text-[#B82A14]">{error}</div>}
          <button
            type="submit" disabled={loading}
            className="font-mono text-[11px] tracking-widest uppercase py-2.5 rounded disabled:opacity-40"
            style={{ background: '#B82A14', color: '#fff' }}
          >
            {loading ? '...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
        <button
          className="mt-4 font-mono text-[10px] tracking-widest uppercase text-white/30 hover:text-white/60 transition-colors"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
        >
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Login'}
        </button>
      </div>
    </div>
  )
}
