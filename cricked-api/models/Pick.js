const mongoose = require('mongoose')

const pickSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickType: { type: String, enum: ['batsman', 'bowler','allrounder'], required: true },
    pickOrder: { type: Number, required: true },
    playerName: { type: String, required: true },
    squadPlayerId: String,
    isInXi: { type: Boolean, default: false },
    cascaded: { type: Boolean, default: false },
    autoPicked: { type: Boolean, default: false },
    runs: Number,
    wickets: Number
}, { timestamps: true })

module.exports = mongoose.model('Pick', pickSchema)