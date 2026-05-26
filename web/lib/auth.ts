import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

export type TokenPayload = { userId: string; username: string }

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is not set')
  return s
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret()) as TokenPayload
}

export function getAuthUser(req: NextRequest): TokenPayload | null {
  try {
    const header = req.headers.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}
