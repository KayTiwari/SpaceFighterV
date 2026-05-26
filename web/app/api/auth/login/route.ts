export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { signToken } from '@/lib/auth'
import { User } from '@/models/User'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    await connectDB()
    const user = await User.findOne({ username: username.trim() })
    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 403 })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 403 })
    }

    const token = signToken({ userId: String(user._id), username: user.username })
    return NextResponse.json({ token, username: user.username })
  } catch (err) {
    console.error('login error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
