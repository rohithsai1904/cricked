const mongoose = require('mongoose')

const preDraftSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    playerName: { type: String, required: true },
    squadPlayerId: String,
    rankOrder: { type: Number, required: true },
    pickType: { type: String, enum: ['batsman', 'bowler'], required: true }
}, { timestamps: true })

module.exports = mongoose.model('PreDraft', preDraftSchema)