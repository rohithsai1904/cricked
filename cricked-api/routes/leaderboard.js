const express = require('express')
const router = express.Router()
const User = require('../models/User')
const DailyChallengeEntry = require('../models/DailyChallengeEntry')

// GET /leaderboard — top 50 by win rate (min 5 matches)
router.get('/', async (req, res) => {
    try {
        const leaders = await User.find({ matchesPlayed: { $gte: 5 } })
            .select('username pointsTotal matchesPlayed wins losses winRate')
            .sort({ winRate: -1 })
            .limit(50)

        res.json(leaders)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /leaderboard/weekly — weekly daily challenge leaderboard
router.get('/weekly', async (req, res) => {
    try {
        // Get current week number
        const now = new Date()
        const startOfYear = new Date(now.getFullYear(), 0, 1)
        const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)

        const entries = await DailyChallengeEntry.find({ weekNumber })
            .populate('userId', 'username')
            .sort({ points: -1 })
            .limit(50)

        const leaders = entries.map((e, i) => ({
            rank: i + 1,
            username: e.userId?.username,
            points: e.points,
            userId: e.userId?._id
        }))

        res.json({ weekNumber, leaders })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router
