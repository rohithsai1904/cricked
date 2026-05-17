const mongoose = require('mongoose')

const randomQueueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    status: {
        type: String,
        enum: ['waiting', 'matched'],
        default: 'waiting'
    }
}, { timestamps: true })

module.exports = mongoose.model('RandomQueue', randomQueueSchema)
