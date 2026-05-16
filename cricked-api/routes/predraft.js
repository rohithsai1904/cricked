const express = require('express')
const router = express.Router()
const PreDraft = require('../models/PreDraft')
const Match = require('../models/Match')
const authMiddleware = require('../middleware/auth')

// POST /predraft/save — save pre-draft for a match
router.post('/save', authMiddleware, async (req, res) => {
    const { matchId, batsmen, bowlers } = req.body
    const userId = req.user.userId

    try {
        // Validate counts
        if (!batsmen || batsmen.length !== 8) {
            return res.status(400).json({ error: 'Exactly 8 batsmen required' })
        }
        if (!bowlers || bowlers.length !== 4) {
            return res.status(400).json({ error: 'Exactly 4 bowlers required' })
        }

        // Verify match exists
        const match = await Match.findById(matchId)
        if (!match) return res.status(404).json({ error: 'Match not found' })

        // Delete existing pre-draft for this user+match
        await PreDraft.deleteMany({ userId, matchId })

        // Build entries
        const entries = []
        batsmen.forEach((b, i) => {
            entries.push({
                userId,
                matchId,
                playerName: b.playerName,
                squadPlayerId: b.squadPlayerId,
                rankOrder: i + 1,
                pickType: 'batsman'
            })
        })
        bowlers.forEach((b, i) => {
            entries.push({
                userId,
                matchId,
                playerName: b.playerName,
                squadPlayerId: b.squadPlayerId,
                rankOrder: i + 1,
                pickType: 'bowler'
            })
        })

        await PreDraft.insertMany(entries)
        res.status(201).json({ message: 'Pre-draft saved', count: entries.length })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /predraft/:matchId — get current user's pre-draft
router.get('/:matchId', authMiddleware, async (req, res) => {
    try {
        const preDraft = await PreDraft.find({
            userId: req.user.userId,
            matchId: req.params.matchId
        }).sort({ pickType: 1, rankOrder: 1 })

        res.json(preDraft)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router
