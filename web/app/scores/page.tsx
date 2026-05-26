import Link from 'next/link'

type ScoreDoc = { _id: string; username: string; score: number; createdAt: string }

async function getScores(): Promise<ScoreDoc[]> {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${base}/api/scores`, { next: { revalidate: 30 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function ScoresPage() {
  const scores = await getScores()

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          Leaderboard
        </h1>
        <Link href="/" style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
          Play
        </Link>
      </div>

      {scores.length === 0 ? (
        <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>No scores yet. Be the first.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', textAlign: 'left', paddingBottom: 12, fontWeight: 'normal', width: 32 }}>#</th>
              <th style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', textAlign: 'left', paddingBottom: 12, fontWeight: 'normal' }}>Player</th>
              <th style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', textAlign: 'right', paddingBottom: 12, fontWeight: 'normal' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '12px 0' }}>{i + 1}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: i === 0 ? '#FFBD4A' : 'rgba(255,255,255,0.7)', padding: '12px 0' }}>{s.username}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'right', padding: '12px 0' }}>{s.score.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
