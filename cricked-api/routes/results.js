const express = require('express')
const router = express.Router()
const Result = require('../models/Result')
const Pick = require('../models/Pick')
const Room = require('../models/Room')
const authMiddleware = require('../middleware/auth')

// GET /results/:roomId — get match result
router.get('/:roomId', authMiddleware, async (req, res) => {
    try {
        const result = await Result.findOne({ roomId: req.params.roomId })
            .populate('winnerId', 'username')
            .populate('loserId', 'username')

        if (!result) {
            // Check if room exists and match is still live
            const room = await Room.findById(req.params.roomId)
                .populate('matchId', 'status')
            if (!room) return res.status(404).json({ error: 'Room not found' })

            const picks = await Pick.find({ roomId: req.params.roomId }).sort({ createdAt: 1 })

            return res.json({
                status: 'pending',
                matchStatus: room.matchId?.status || 'unknown',
                picks
            })
        }

        const picks = await Pick.find({ roomId: req.params.roomId }).sort({ createdAt: 1 })

        res.json({
            status: 'completed',
            result,
            picks
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router
