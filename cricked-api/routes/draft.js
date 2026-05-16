const express = require('express')
const router = express.Router()
const Room = require('../models/Room')
const Pick = require('../models/Pick')
const authMiddleware = require('../middleware/auth')
const { getFullDraftOrder } = require('../services/draftService')

// GET /draft/:roomId — get current draft state
router.get('/:roomId', authMiddleware, async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId)
            .populate('player1Id', 'username')
            .populate('player2Id', 'username')
        if (!room) return res.status(404).json({ error: 'Room not found' })

        const picks = await Pick.find({ roomId: room._id }).sort({ createdAt: 1 })

        const draftOrder = getFullDraftOrder(
            room.firstPickUserId,
            room.player1Id._id || room.player1Id,
            room.player2Id._id || room.player2Id
        )

        res.json({
            room,
            picks,
            draftOrder,
            currentPickIndex: picks.length,
            isComplete: picks.length >= 12
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

// POST /draft/:roomId/ready — signal ready to draft
router.post('/:roomId/ready', authMiddleware, async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId)
        if (!room) return res.status(404).json({ error: 'Room not found' })

        res.json({ message: 'Ready signal sent. Use socket.io for real-time draft.' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router
