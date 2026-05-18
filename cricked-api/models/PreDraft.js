const mongoose = require('mongoose')

const preDraftSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    playerName: { type: String, required: true },
    squadPlayerId: String,
    team: { type: String, default: '' },
    rankOrder: { type: Number, required: true },
    pickType: {
        type: String,
        enum: ['batsman', 'bowler', 'allrounder'],
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.model('PreDraft', preDraftSchema)