const express = require('express')
const router = express.Router()
const Match = require('../models/Match')
const authMiddleware = require('../middleware/auth')
const { syncMatches, syncSquad, syncMatchStatus, syncToss } = require('../services/matchSync')

// GET /matches — all upcoming matches
router.get('/', async (req, res) => {
    try {
        const matches = await Match.find({
            status: { $in: ['upcoming'] }
        }).sort({ startTime: 1 })
        res.json(matches)
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

// POST /matches/sync — manually trigger match sync (dev only)
router.post('/sync', async (req, res) => {
    try {
        await syncMatches()
        res.json({ message: 'Sync complete' })
    } catch (err) {
        console.error('[SYNC ERROR]', err)
        res.status(500).json({ error: err.message })
    }
})

// POST /matches/:id/sync-squad — manually sync squad for one match
router.post('/:id/sync-squad', async (req, res) => {
    try {
        await syncSquad(req.params.id)
        res.json({ message: 'Squad sync complete' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /matches/:id/sync-toss — manually sync toss for one match
router.post('/:id/sync-toss', async (req, res) => {
    try {
        await syncToss(req.params.id)
        res.json({ message: 'Toss sync complete' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// GET /matches/:id — single match (must be AFTER /sync to avoid catching "sync" as :id)
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

// GET /matches/:id/squad — squad split by role
router.get('/:id/squad', authMiddleware, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
        if (!match) return res.status(404).json({ error: 'Match not found' })

        const allPlayers = [
            ...match.squadHome.map(p => ({ ...p.toObject(), team: match.teamHome })),
            ...match.squadAway.map(p => ({ ...p.toObject(), team: match.teamAway }))
        ]

        const batsmen = allPlayers.filter(p =>
            ['Batsman', 'WK-Batsman'].includes(p.role)
        )
        const bowlers = allPlayers.filter(p =>
            p.role === 'Bowler'
        )
        const allrounders = allPlayers.filter(p =>
            ['Batting Allrounder', 'Bowling Allrounder'].includes(p.role)
        )

        res.json({
            match: {
                id: match._id,
                teamHome: match.teamHome,
                teamAway: match.teamAway,
                startTime: match.startTime
            },
            batsmen,
            bowlers,
            allrounders
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router