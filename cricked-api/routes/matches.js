const express = require('express')
const router = express.Router()
const Match = require('../models/Match')
const authMiddleware = require('../middleware/auth')
const adminMiddleware = require('../middleware/admin')
const { syncMatches, syncSquad, syncMatchStatus, syncToss, syncScorecard } = require('../services/matchSync')
const { declareResultsForMatch } = require('../services/resultService')

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

// GET /matches/admin/all — all matches for admin panel
router.get('/admin/all', adminMiddleware, async (req, res) => {
    try {
        const matches = await Match.find().sort({ startTime: -1 })
        res.json(matches)
    } catch (err) {
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /matches/:id/sync-scorecard — fetch and store scorecard
router.post('/:id/sync-scorecard', async (req, res) => {
    try {
        const result = await syncScorecard(req.params.id)
        if (result.error) return res.status(400).json({ error: result.error })
        res.json({ message: 'Scorecard sync complete', ...result })
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

// ===== ADMIN ROUTES =====

// POST /matches/:id/playing-xi — set playing XI from squad
router.post('/:id/playing-xi', adminMiddleware, async (req, res) => {
    try {
        const { homePlayerIds, awayPlayerIds } = req.body
        const match = await Match.findById(req.params.id)
        if (!match) return res.status(404).json({ error: 'Match not found' })

        // Mark squad players and build playingXi arrays
        if (homePlayerIds?.length) {
            match.squadHome.forEach(p => {
                if (homePlayerIds.includes(p.playerId)) p.squadType = 'playingXI'
            })
            match.playingXiHome = match.squadHome.filter(p => homePlayerIds.includes(p.playerId))
        }
        if (awayPlayerIds?.length) {
            match.squadAway.forEach(p => {
                if (awayPlayerIds.includes(p.playerId)) p.squadType = 'playingXI'
            })
            match.playingXiAway = match.squadAway.filter(p => awayPlayerIds.includes(p.playerId))
        }

        await match.save()
        res.json({ message: 'Playing XI updated', playingXiHome: match.playingXiHome, playingXiAway: match.playingXiAway })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /matches/:id/impact — set impact players
router.post('/:id/impact', adminMiddleware, async (req, res) => {
    try {
        const { homePlayerIds, awayPlayerIds } = req.body
        const match = await Match.findById(req.params.id)
        if (!match) return res.status(404).json({ error: 'Match not found' })

        if (homePlayerIds?.length) {
            match.squadHome.forEach(p => {
                if (homePlayerIds.includes(p.playerId)) p.squadType = 'impact'
            })
        }
        if (awayPlayerIds?.length) {
            match.squadAway.forEach(p => {
                if (awayPlayerIds.includes(p.playerId)) p.squadType = 'impact'
            })
        }

        await match.save()
        res.json({ message: 'Impact players updated' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /matches/:id/manual-scorecard — manually set batting/bowling stats
router.post('/:id/manual-scorecard', adminMiddleware, async (req, res) => {
    try {
        const { battingStats, bowlingStats } = req.body
        const match = await Match.findById(req.params.id)
        if (!match) return res.status(404).json({ error: 'Match not found' })

        if (battingStats) match.battingStats = battingStats
        if (bowlingStats) match.bowlingStats = bowlingStats
        match.scorecardSynced = true
        await match.save()

        // Auto-declare results for all rooms of this match
        const resultInfo = await declareResultsForMatch(match._id)

        res.json({ message: 'Scorecard updated manually', battingCount: (battingStats || []).length, bowlingCount: (bowlingStats || []).length, results: resultInfo })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /matches/:id/declare-results — manually trigger result declaration
router.post('/:id/declare-results', adminMiddleware, async (req, res) => {
    try {
        const result = await declareResultsForMatch(req.params.id)
        res.json({ message: 'Results declared', ...result })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /matches/:id/admin-update — update match fields (status, matchStarted, matchEnded, etc)
router.post('/:id/admin-update', adminMiddleware, async (req, res) => {
    try {
        const updates = req.body
        const match = await Match.findByIdAndUpdate(req.params.id, updates, { new: true })
        if (!match) return res.status(404).json({ error: 'Match not found' })
        res.json(match)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router