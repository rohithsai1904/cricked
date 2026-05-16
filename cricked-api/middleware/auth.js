const jwt = require('jsonwebtoken')
require('dotenv').config()

function authMiddleware(req, res, next) {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = header.split(' ')[1]

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded   // { userId, username, iat, exp }
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}

module.exports = authMiddleware
