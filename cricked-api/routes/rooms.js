const express = require('express')
const router = express.Router()
const Room = require('../models/Room')
const Match = require('../models/Match')
const RandomQueue = require('../models/RandomQueue')
const authMiddleware = require('../middleware/auth')

// Helper — generate random 6-char invite code
function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Helper — coin flip, returns one of two user IDs
function coinFlip(id1, id2) {
    return Math.random() < 0.5 ? id1 : id2
}

// POST /rooms/create — create a room for a match
router.post('/create', authMiddleware, async (req, res) => {
    const { matchId } = req.body
    const userId = req.user.userId

    try {
        // Check match exists and is upcoming
        const match = await Match.findById(matchId)
        if (!match) return res.status(404).json({ error: 'Match not found' })
        if (match.status === 'completed') {
            return res.status(400).json({ error: 'Match already completed' })
        }

        // Generate unique invite code
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
            roomType: 'friendly',
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

        // Coin flip for first pick
        const firstPickUserId = coinFlip(room.player1Id, userId)

        const updated = await Room.findByIdAndUpdate(
            room._id,
            {
                player2Id: userId,
                firstPickUserId,
                status: 'ready'
            },
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

        // Check if user already in queue for this match
        const alreadyQueued = await RandomQueue.findOne({
            userId,
            matchId,
            status: 'waiting'
        })
        if (alreadyQueued) {
            return res.status(400).json({ error: 'Already in queue for this match' })
        }

        // Check if someone else is waiting for this match
        const waiting = await RandomQueue.findOne({
            matchId,
            status: 'waiting',
            userId: { $ne: userId }
        })

        if (waiting) {
            // Match found — create a room
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

            // Mark both queue entries as matched
            await RandomQueue.findByIdAndUpdate(waiting._id, { status: 'matched' })

            return res.status(201).json({
                matched: true,
                room
            })
        }

        // No one waiting — add to queue
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

// GET /rooms/queue-status/:matchId — check if user has been matched
router.get('/queue-status/:matchId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId
        const matchId = req.params.matchId

        // Check if there's a room where this user was matched via random queue
        const room = await Room.findOne({
            matchId,
            $or: [{ player1Id: userId }, { player2Id: userId }],
            status: { $in: ['ready', 'drafting'] }
        })

        if (room) {
            return res.json({ matched: true, roomId: room._id })
        }

        // Check if still in queue
        const queueEntry = await RandomQueue.findOne({
            userId,
            matchId,
            status: 'waiting'
        })

        if (queueEntry) {
            return res.json({ matched: false, inQueue: true })
        }

        res.json({ matched: false, inQueue: false })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// DELETE /rooms/queue/:matchId — cancel queue
router.delete('/queue/:matchId', authMiddleware, async (req, res) => {
    try {
        await RandomQueue.deleteOne({
            userId: req.user.userId,
            matchId: req.params.matchId,
            status: 'waiting'
        })
        res.json({ message: 'Removed from queue' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /rooms/:id — get room state (must be after specific routes)
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

module.exports = router