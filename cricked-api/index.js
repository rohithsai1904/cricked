const express = require("express");
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const connectDB = require('./db')
require('dotenv').config()

const app = express();
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
    }
})

const passport = require('./config/passport');
const authRoutes = require('./routes/auth')
const matchRoutes = require('./routes/matches')
const roomRoutes = require('./routes/rooms')
const predraftRoutes = require('./routes/predraft')
const draftRoutes = require('./routes/draft')
const resultsRoutes = require('./routes/results')
const profileRoutes = require('./routes/profile')
const leaderboardRoutes = require('./routes/leaderboard')
const { setupDraftSocket } = require('./socket/draftSocket')

connectDB()

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}))
app.use(express.json())
app.use(passport.initialize());

app.use('/auth', authRoutes)
app.use('/matches', matchRoutes)
app.use('/rooms', roomRoutes)
app.use('/predraft', predraftRoutes)
app.use('/draft', draftRoutes)
app.use('/results', resultsRoutes)
app.use('/profile', profileRoutes)
app.use('/leaderboard', leaderboardRoutes)

setupDraftSocket(io)

app.get("/ping", (req, res) => {
    res.json({ message: "Cricked API is Live!" });
});

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
