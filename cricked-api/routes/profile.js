const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Room = require('../models/Room')
const Result = require('../models/Result')
const authMiddleware = require('../middleware/auth')

// GET /profile/me/history — current user match history
router.get('/me/history', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId

        const results = await Result.find({
            $or: [{ winnerId: userId }, { loserId: userId }]
        })
            .populate('winnerId', 'username')
            .populate('loserId', 'username')
            .sort({ createdAt: -1 })
            .limit(10)

        const history = results.map(r => {
            const isWinner = r.winnerId._id.toString() === userId
            return {
                resultId: r._id,
                roomId: r.roomId,
                opponent: isWinner ? r.loserId.username : r.winnerId.username,
                result: isWinner ? 'win' : 'loss',
                yourPoints: isWinner ? r.winnerPoints : r.loserPoints,
                opponentPoints: isWinner ? r.loserPoints : r.winnerPoints,
                date: r.createdAt
            }
        })

        res.json(history)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /profile/:username — public profile
router.get('/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username pointsTotal matchesPlayed wins losses winRate createdAt')
        if (!user) return res.status(404).json({ error: 'User not found' })

        res.json(user)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router
