const mongoose = require('mongoose')

const resultSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, unique: true },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    loserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    winnerPoints: { type: Number, required: true },
    loserPoints: { type: Number, required: true },
    runDiff: { type: Number, required: true },
    wicketDiff: { type: Number, required: true }
}, { timestamps: true })

module.exports = mongoose.model('Result', resultSchema)