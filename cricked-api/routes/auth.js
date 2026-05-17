const express = require('express')
const router = express.Router()
const passport = require('../config/passport')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Step 1 — redirect user to Google
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
)

// Step 2 — Google redirects back here
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        session: false        // ← key change — no session
    }),
    async (req, res) => {
        try {
            // req.user is set by passport after Google auth
            const token = jwt.sign(
                { userId: req.user._id, username: req.user.username },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            )

            // Redirect to frontend with token in URL
            // Frontend grabs it and stores in localStorage
            res.redirect(
                `http://localhost:5173/auth/callback?token=${token}`
            )
        } catch (err) {
            console.error(err)
            res.redirect('/login')
        }
    }
)

// GET /auth/me — current user profile
const authMiddleware = require('../middleware/auth')
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-passwordHash')
        if (!user) return res.status(404).json({ error: 'User not found' })
        res.json(user)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router