const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema({
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    inviteCode: { type: String, required: true, unique: true },
    player1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    player2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    firstPickUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roomType: { type: String, enum: ['friendly', 'daily_challenge'], default: 'friendly' },
    status: {
        type: String,
        enum: ['waiting', 'ready', 'drafting', 'completed'],
        default: 'waiting'
    }
}, { timestamps: true })

module.exports = mongoose.model('Room', roomSchema)