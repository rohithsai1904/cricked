const mongoose = require('mongoose')

const dailyChallengeEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    weekNumber: { type: Number, required: true },
    points: { type: Number, default: 0 }
}, { timestamps: true })

dailyChallengeEntrySchema.index({ userId: 1, matchId: 1 }, { unique: true })

module.exports = mongoose.model('DailyChallengeEntry', dailyChallengeEntrySchema)
