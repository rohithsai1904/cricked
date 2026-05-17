const express = require('express')
const cors = require('cors')
const passport = require('passport')
const connectDB = require('./db')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const matchRoutes = require('./routes/matches')
const roomRoutes = require('./routes/rooms')

const app = express()

connectDB()

app.use(cors())
app.use(express.json())
app.use(passport.initialize())       // ← no passport.session()

app.use('/auth', authRoutes)
app.use('/matches', matchRoutes)
app.use('/rooms', roomRoutes)

app.get('/ping', (req, res) => {
    res.json({ message: 'Cricked API is alive' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`)
})