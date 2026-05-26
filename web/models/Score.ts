import mongoose from 'mongoose'

const ScoreSchema = new mongoose.Schema({
  username: { type: String, required: true },
  score: { type: Number, required: true, min: 0 },
}, { timestamps: true })

export const Score = mongoose.models.Score ?? mongoose.model('Score', ScoreSchema)
