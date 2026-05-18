const mongoose = require('mongoose')

const turnSchema = new mongoose.Schema({
    pickNumber: Number,
    roundNumber: Number,
    roundType: String,
    roundLabel: String,
    picksEach: Number,
    pickInRound: Number,
    totalInRound: Number,
    userId: String
}, { _id: false })

const pickSchema = new mongoose.Schema({
    userId: String,
    squadPlayerId: String,
    playerName: String,
    team: String,
    pickType: String,
    pickNumber: Number,
    roundNumber: Number,
    isAutoPick: { type: Boolean, default: false },
    isVoid: { type: Boolean, default: false }
}, { _id: false })

const draftStateSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, unique: true },
    player1Id: { type: String, required: true },
    player2Id: { type: String, required: true },
    firstPickUserId: { type: String, required: true },
    matchStartTime: { type: Date, default: null },
    turns: [turnSchema],
    currentTurn: { type: Number, default: 0 },
    picks: [pickSchema],
    pickedPlayerIds: [String],
    started: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    turnStartedAt: { type: Date, default: null }
}, { timestamps: true })

module.exports = mongoose.model('DraftState', draftStateSchema)
