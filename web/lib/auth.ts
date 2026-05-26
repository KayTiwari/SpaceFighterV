import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const SECRET = process.env.JWT_SECRET
if (!SECRET) throw new Error('JWT_SECRET env var is not set')

export type TokenPayload = { userId: string; username: string }

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET!, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET!) as TokenPayload
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
