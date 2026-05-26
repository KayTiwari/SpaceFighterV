import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { signToken } from '@/lib/auth'
import { User } from '@/models/User'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (
      typeof username !== 'string' || typeof password !== 'string' ||
      username.trim().length < 2 || username.trim().length > 24 ||
      password.length < 6 || password.length > 128
    ) {
      return NextResponse.json(
        { error: 'Username must be 2-24 chars, password 6-128 chars' },
        { status: 400 },
      )
    }

    await connectDB()
    const existing = await User.findOne({ username: username.trim() })
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ username: username.trim(), passwordHash })
    const token = signToken({ userId: String(user._id), username: user.username })

    return NextResponse.json({ token, username: user.username }, { status: 201 })
  } catch (err) {
    console.error('signup error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
