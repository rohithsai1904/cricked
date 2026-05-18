const mongoose = require('mongoose')

const draftPickSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    squadPlayerId: { type: String, required: true },
    playerName: { type: String, required: true },
    team: { type: String },
    pickType: {
        type: String,
        enum: ['batsman', 'bowler', 'allrounder'],
        required: true
    },
    pickNumber: { type: Number, required: true },
    roundNumber: { type: Number, required: true },
    isAutoPick: { type: Boolean, default: false },
    isVoid: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('DraftPick', draftPickSchema)
