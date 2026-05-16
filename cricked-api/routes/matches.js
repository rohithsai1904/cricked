const express = require('express')
const router = express.Router()
const Match = require('../models/Match')

// GET /matches — all upcoming matches
router.get('/', async (req, res) => {
    try {
        const matches = await Match.find({
            status: { $in: ['upcoming', 'drafting'] }
        }).sort({ startTime: 1 })
        res.json(matches)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /matches/:id — single match
router.get('/:id', async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
        if (!match) return res.status(404).json({ error: 'Match not found' })
        res.json(match)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /matches — create a match (admin only for now)
router.post('/', async (req, res) => {
    const { teamHome, teamAway, startTime, isDailyChallenge } = req.body
    try {
        const match = await Match.create({
            teamHome,
            teamAway,
            startTime,
            isDailyChallenge: isDailyChallenge || false
        })
        res.status(201).json(match)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router