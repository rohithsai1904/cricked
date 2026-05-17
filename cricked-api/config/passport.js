const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../models/User')

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:3001/auth/google/callback'
        },
        async function (accessToken, refreshToken, profile, done) {
            try {
                // Check if user already exists
                let user = await User.findOne({ googleId: profile.id })

                if (!user) {
                    // Generate a clean username from Google display name
                    // e.g. "Rohith Sai" → "rohithsai_x4k2"
                    const baseName = profile.displayName
                        .toLowerCase()
                        .replace(/\s+/g, '')
                        .replace(/[^a-z0-9]/g, '')
                        .slice(0, 20)
                    const suffix = Math.random().toString(36).slice(2, 6)
                    const username = `${baseName}_${suffix}`
                    const displayName = profile.displayName
                    user = await User.create({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        displayName,
                        username
                    })
                }

                return done(null, user)
            } catch (err) {
                return done(err, null)
            }
        }
    )
)

module.exports = passport