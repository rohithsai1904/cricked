const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema({
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    inviteCode: { type: String, required: true, unique: true },
    player1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    player2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    firstPickUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roomType: { type: String, enum: ['friendly', 'random', 'daily_challenge'], default: 'friendly' },
    status: {
        type: String,
        enum: ['waiting', 'ready', 'drafting', 'completed'],
        default: 'waiting'
    },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    player1Score: { type: Number, default: 0 },
    player2Score: { type: Number, default: 0 },
    isDraw: { type: Boolean, default: false },
    resultDeclared: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('Room', roomSchema)