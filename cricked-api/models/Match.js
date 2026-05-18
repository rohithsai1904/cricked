const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema({
    playerId: String,
    playerName: String,
    role: String,
    squadType: {
        type: String,
        enum: ['playingXI', 'impact', 'squad'],
        default: 'squad'
    }
})

const matchSchema = new mongoose.Schema({
    cricapiId: { type: String, unique: true, sparse: true },
    teamHome: { type: String, required: true },
    teamAway: { type: String, required: true },
    teamHomeImg: { type: String, default: '' },
    teamAwayImg: { type: String, default: '' },
    venue: { type: String, default: '' },
    squadHome: [playerSchema],
    squadAway: [playerSchema],
    playingXiHome: [playerSchema],
    playingXiAway: [playerSchema],
    startTime: { type: Date, required: true },
    tossTime: Date,
    tossWinner: { type: String, default: '' },
    tossChoice: { type: String, default: '' },
    status: {
        type: String,
        enum: ['upcoming', 'drafting', 'live', 'completed'],
        default: 'upcoming'
    },
    isDailyChallenge: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('Match', matchSchema)