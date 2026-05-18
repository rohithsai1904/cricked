const express = require('express')
const router = express.Router()
const Room = require('../models/Room')
const Match = require('../models/Match')
const RandomQueue = require('../models/RandomQueue')
const authMiddleware = require('../middleware/auth')
const PreDraft = require('../models/PreDraft')

// Helper — generate random 6-char invite code
function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Helper — coin flip, returns one of two user IDs
function coinFlip(id1, id2) {
    return Math.random() < 0.5 ? id1 : id2
}

// Reusable helper — put this at the top of routes/rooms.js
const checkRoomLimit = async (userId, matchId) => {
    const count = await Room.countDocuments({
        matchId,
        $or: [
            { player1Id: userId },
            { player2Id: userId }
        ]
    })
    return count >= 10
}

// POST /rooms/create — create a room for a match
router.post('/create', authMiddleware, async (req, res) => {
    const { matchId, roomType: reqRoomType } = req.body
    const userId = req.user.userId

    try {
        const match = await Match.findById(matchId)
        if (!match) return res.status(404).json({ error: 'Match not found' })
        if (match.status === 'completed') {
            return res.status(400).json({ error: 'Match already completed' })
        }

        // 5 room limit
        const atLimit = await checkRoomLimit(userId, matchId)
        if (atLimit) {
            return res.status(400).json({
                error: 'You can only join 5 rooms per match'
            })
        }

        let inviteCode
        let exists = true
        while (exists) {
            inviteCode = generateInviteCode()
            exists = await Room.findOne({ inviteCode })
        }

        const room = await Room.create({
            matchId,
            inviteCode,
            player1Id: userId,
            roomType: reqRoomType || 'friendly',
            status: 'waiting'
        })

        res.status(201).json(room)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /rooms/join — join via invite code
router.post('/join', authMiddleware, async (req, res) => {
    const { inviteCode } = req.body
    const userId = req.user.userId

    try {
        const room = await Room.findOne({ inviteCode })
        if (!room) return res.status(404).json({ error: 'Room not found' })
        if (room.status !== 'waiting') {
            return res.status(400).json({ error: 'Room is no longer open' })
        }
        if (room.player1Id.toString() === userId) {
            return res.status(400).json({ error: 'Cannot join your own room' })
        }

        // 5 room limit
        const atLimit = await checkRoomLimit(userId, room.matchId)
        if (atLimit) {
            return res.status(400).json({
                error: 'You can only join 5 rooms per match'
            })
        }

        const firstPickUserId = coinFlip(room.player1Id, userId)

        const updated = await Room.findByIdAndUpdate(
            room._id,
            { player2Id: userId, firstPickUserId, status: 'ready' },
            { new: true }
        )

        res.json(updated)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /rooms/random — join random queue
router.post('/random', authMiddleware, async (req, res) => {
    const { matchId } = req.body
    const userId = req.user.userId

    try {
        const match = await Match.findById(matchId)
        if (!match) return res.status(404).json({ error: 'Match not found' })

        // 5 room limit
        const atLimit = await checkRoomLimit(userId, matchId)
        if (atLimit) {
            return res.status(400).json({
                error: 'You can only join 5 rooms per match'
            })
        }

        const alreadyQueued = await RandomQueue.findOne({
            userId, matchId, status: 'waiting'
        })
        if (alreadyQueued) {
            return res.status(400).json({
                error: 'Already in queue for this match'
            })
        }

        const waiting = await RandomQueue.findOne({
            matchId,
            status: 'waiting',
            userId: { $ne: userId }
        })

        if (waiting) {
            let inviteCode
            let exists = true
            while (exists) {
                inviteCode = generateInviteCode()
                exists = await Room.findOne({ inviteCode })
            }

            const firstPickUserId = coinFlip(waiting.userId, userId)

            const room = await Room.create({
                matchId,
                inviteCode,
                player1Id: waiting.userId,
                player2Id: userId,
                firstPickUserId,
                roomType: 'friendly',
                status: 'ready'
            })

            await RandomQueue.findByIdAndUpdate(waiting._id, {
                status: 'matched'
            })

            return res.status(201).json({ matched: true, room })
        }

        await RandomQueue.create({ userId, matchId, status: 'waiting' })
        res.status(201).json({
            matched: false,
            message: 'Added to queue. Waiting for opponent.'
        })

    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /rooms/:id/queue — add existing room to random queue and try to match
router.post('/:id/queue', authMiddleware, async (req, res) => {
    const userId = req.user.userId
    try {
        const room = await Room.findById(req.params.id)
        if (!room) return res.status(404).json({ error: 'Room not found' })

        const matchId = room.matchId

        const alreadyQueued = await RandomQueue.findOne({
            userId, matchId, status: 'waiting'
        })
        if (alreadyQueued) {
            return res.json({ queued: true, matched: false, message: 'Already in queue' })
        }

        // Check for another waiting user for this match
        const opponent = await RandomQueue.findOne({
            matchId,
            status: 'waiting',
            userId: { $ne: userId }
        })

        if (opponent && opponent.roomId) {
            // Match found — join current user into opponent's room as player2
            const opponentRoom = await Room.findById(opponent.roomId)
            if (!opponentRoom) {
                // Stale queue entry — remove it and add current user to queue
                await RandomQueue.findByIdAndDelete(opponent._id)
                await RandomQueue.create({ userId, matchId, roomId: room._id, status: 'waiting' })
                return res.json({ queued: true, matched: false, message: 'Added to queue' })
            }
            const firstPick = coinFlip(opponent.userId, userId)

            await Room.findByIdAndUpdate(opponentRoom._id, {
                player2Id: userId,
                firstPickUserId: firstPick,
                status: 'ready'
            })

            // Delete current user's empty room (they'll use opponent's room)
            await Room.findByIdAndDelete(room._id)

            // Mark opponent as matched
            await RandomQueue.findByIdAndUpdate(opponent._id, { status: 'matched' })

            // Copy current user's predraft picks to the opponent's room
            const PreDraft = require('../models/PreDraft')
            await PreDraft.updateMany(
                { roomId: room._id, userId },
                { roomId: opponentRoom._id }
            )

            return res.json({ queued: true, matched: true, roomId: opponentRoom._id })
        }

        // No match — add to queue
        await RandomQueue.create({ userId, matchId, roomId: room._id, status: 'waiting' })
        res.json({ queued: true, matched: false, message: 'Added to queue' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /rooms/my-pending — matched + waiting rooms for current user
router.get('/my-pending', authMiddleware, async (req, res) => {
    const userId = req.user.userId
    try {
        const matched = await Room.find({
            $or: [{ player1Id: userId }, { player2Id: userId }],
            status: 'ready',
            player1Id: { $exists: true },
            player2Id: { $exists: true }
        })
            .populate('matchId', 'teamHome teamAway startTime tossWinner tossChoice')
            .populate('player1Id', 'username')
            .populate('player2Id', 'username')
            .sort({ createdAt: -1 })

        const waiting = await Room.find({
            player1Id: userId,
            status: 'waiting'
        })
            .populate('matchId', 'teamHome teamAway startTime')
            .sort({ createdAt: -1 })

        const drafting = await Room.find({
            $or: [{ player1Id: userId }, { player2Id: userId }],
            status: 'drafting'
        })
            .populate('matchId', 'teamHome teamAway startTime')
            .populate('player1Id', 'username')
            .populate('player2Id', 'username')
            .sort({ createdAt: -1 })

        res.json({ matched, waiting, drafting, currentUserId: userId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /rooms/:id — get room state
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate('player1Id', 'username')
            .populate('player2Id', 'username')
            .populate('matchId', 'teamHome teamAway startTime status')
        if (!room) return res.status(404).json({ error: 'Room not found' })
        res.json(room)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})



// POST /rooms/:id/predraft — save pre-draft rankings
router.post('/:id/predraft', authMiddleware, async (req, res) => {
    const { batsmen, bowlers, allrounders } = req.body
    const userId = req.user.userId
    const roomId = req.params.id

    try {
        await PreDraft.deleteMany({ userId, roomId })

        const entries = []

        batsmen?.forEach((p, i) => entries.push({
            roomId,
            userId,
            playerName: p.playerName,
            squadPlayerId: p.playerId,
            team: p.team || '',
            rankOrder: i + 1,
            pickType: 'batsman'
        }))

        bowlers?.forEach((p, i) => entries.push({
            roomId,
            userId,
            playerName: p.playerName,
            squadPlayerId: p.playerId,
            team: p.team || '',
            rankOrder: i + 1,
            pickType: 'bowler'
        }))

        allrounders?.forEach((p, i) => entries.push({
            roomId,
            userId,
            playerName: p.playerName,
            squadPlayerId: p.playerId,
            team: p.team || '',
            rankOrder: i + 1,
            pickType: 'allrounder'
        }))

        await PreDraft.insertMany(entries)

        res.json({ message: 'Pre-draft saved', count: entries.length })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /rooms/:id/predraft — get saved pre-draft
router.get('/:id/predraft', authMiddleware, async (req, res) => {
    try {
        const entries = await PreDraft.find({
            roomId: req.params.id,
            userId: req.user.userId
        }).sort({ pickType: 1, rankOrder: 1 })

        const batsmen = entries.filter(e => e.pickType === 'batsman')
        const bowlers = entries.filter(e => e.pickType === 'bowler')
        const allrounders = entries.filter(e => e.pickType === 'allrounder')

        res.json({ batsmen, bowlers, allrounders })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /rooms/:id/squad — get squad for the match in this room
router.get('/:id/squad', authMiddleware, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate('matchId')

        if (!room) return res.status(404).json({ error: 'Room not found' })

        const match = room.matchId
        const allPlayers = [
            ...match.squadHome.map(p => ({
                ...p.toObject(),
                team: match.teamHome
            })),
            ...match.squadAway.map(p => ({
                ...p.toObject(),
                team: match.teamAway
            }))
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

        const addStatus = (p) => ({
            ...p,
            squadStatus: p.squadType || 'squad'
        })

        res.json({
            match: {
                id: match._id,
                teamHome: match.teamHome,
                teamAway: match.teamAway,
                startTime: match.startTime
            },
            batsmen: batsmen.map(addStatus),
            bowlers: bowlers.map(addStatus),
            allrounders: allrounders.map(addStatus)
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router