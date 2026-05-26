import mongoose from 'mongoose'

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
const cached: Cache = (global as any).__mongoose ?? { conn: null, promise: null }
;(global as any).__mongoose = cached

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) throw new Error('MONGODB_URI env var is not set')
  if (cached.conn) return cached.conn
  if (!cached.promise) cached.promise = mongoose.connect(MONGODB_URI).then(m => m)
  cached.conn = await cached.promise
  return cached.conn
}
