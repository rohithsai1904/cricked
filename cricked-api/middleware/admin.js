const jwt = require('jsonwebtoken')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const User = require('../models/User')

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    try {
        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded

        const user = await User.findById(decoded.userId)
        if (!user || user.email !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Admin access only' })
        }

        next()
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}
