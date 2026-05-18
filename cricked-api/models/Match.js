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
    draftOpensAt: { type: Date, default: null },
    matchStarted: { type: Boolean, default: false },
    matchEnded: { type: Boolean, default: false },
    matchWinner: { type: String, default: '' },
    matchStatusText: { type: String, default: '' },
    status: {
        type: String,
        enum: ['upcoming', 'drafting', 'live', 'completed'],
        default: 'upcoming'
    },
    isDailyChallenge: { type: Boolean, default: false },
    scorecardSynced: { type: Boolean, default: false },
    battingStats: [{
        playerId: String,
        playerName: String,
        runs: Number,
        balls: Number,
        fours: Number,
        sixes: Number,
        sr: Number,
        inning: String
    }],
    bowlingStats: [{
        playerId: String,
        playerName: String,
        overs: Number,
        maidens: Number,
        runs: Number,
        wickets: Number,
        eco: Number,
        inning: String
    }]
}, { timestamps: true })

module.exports = mongoose.model('Match', matchSchema)