import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    trim: true, minlength: 2, maxlength: 24,
  },
  passwordHash: { type: String, required: true },
}, { timestamps: true })

export const User = mongoose.models.User ?? mongoose.model('User', UserSchema)
