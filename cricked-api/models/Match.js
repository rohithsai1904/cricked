const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema({
    playerId: String,
    playerName: String,
    role: String        // batsman / bowler / allrounder / wicketkeeper
})

const matchSchema = new mongoose.Schema({
    teamHome: { type: String, required: true },
    teamAway: { type: String, required: true },
    squadHome: [playerSchema],
    squadAway: [playerSchema],
    playingXiHome: [playerSchema],
    playingXiAway: [playerSchema],
    startTime: { type: Date, required: true },
    tossTime: Date,
    status: {
        type: String,
        enum: ['upcoming', 'drafting', 'live', 'completed'],
        default: 'upcoming'
    },
    isDailyChallenge: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('Match', matchSchema)