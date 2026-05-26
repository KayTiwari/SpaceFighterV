import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { getAuthUser } from '@/lib/auth'
import { Score } from '@/models/Score'

export async function GET() {
  try {
    await connectDB()
    const scores = await Score.find().sort({ score: -1 }).limit(100)
    return NextResponse.json(scores)
  } catch (err) {
    console.error('scores GET error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const { score } = await req.json()
    if (typeof score !== 'number' || score < 0 || !Number.isInteger(score)) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
    }

    await connectDB()
    // username comes from the verified JWT, not the client body
    const saved = await Score.create({ username: user.username, score })
    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    console.error('scores POST error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
