const jwt = require('jsonwebtoken')
const Room = require('../models/Room')
const Pick = require('../models/Pick')
const { getFullDraftOrder, getAutoPick } = require('../services/draftService')

const draftStates = new Map()

function setupDraftSocket(io) {
    // Auth middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token
        if (!token) return next(new Error('Unauthorized'))
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            socket.userId = decoded.userId
            socket.username = decoded.username
            next()
        } catch {
            next(new Error('Unauthorized'))
        }
    })

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.username} (${socket.userId})`)

        socket.on('draft:join', async ({ roomId }) => {
            socket.join(roomId)
            socket.roomId = roomId

            const room = await Room.findById(roomId)
                .populate('player1Id', 'username')
                .populate('player2Id', 'username')
            if (!room) {
                socket.emit('draft:error', { message: 'Room not found' })
                return
            }

            // Notify opponent
            socket.to(roomId).emit('draft:opponent_joined', { username: socket.username })

            // Initialize draft state if not exists
            if (!draftStates.has(roomId)) {
                const draftOrder = getFullDraftOrder(
                    room.firstPickUserId,
                    room.player1Id._id || room.player1Id,
                    room.player2Id._id || room.player2Id
                )
                draftStates.set(roomId, {
                    roomId,
                    status: 'waiting',
                    currentPickIndex: 0,
                    phase: 'batsman',
                    draftOrder,
                    picks: [],
                    timer: null,
                    readyPlayers: new Set(),
                    matchId: room.matchId
                })
            }

            const state = draftStates.get(roomId)
            socket.emit('draft:state', {
                roomId,
                draftOrder: state.draftOrder,
                currentPickIndex: state.currentPickIndex,
                picks: state.picks,
                status: state.status,
                readyPlayers: Array.from(state.readyPlayers)
            })
        })

        socket.on('draft:ready', async ({ roomId }) => {
            const state = draftStates.get(roomId)
            if (!state) return

            state.readyPlayers.add(socket.userId)
            io.to(roomId).emit('draft:player_ready', { userId: socket.userId })

            if (state.readyPlayers.size >= 2 && state.status === 'waiting') {
                state.status = 'active'

                await Room.findByIdAndUpdate(roomId, { status: 'drafting' })

                io.to(roomId).emit('draft:started', {
                    roomId,
                    draftOrder: state.draftOrder,
                    currentTurn: state.draftOrder[0]
                })

                startTurnTimer(io, roomId)
            }
        })

        socket.on('draft:pick', async ({ roomId, squadPlayerId, playerName, pickType }) => {
            const state = draftStates.get(roomId)
            if (!state || state.status !== 'active') return

            const currentTurn = state.draftOrder[state.currentPickIndex]
            if (currentTurn.userId !== socket.userId) {
                socket.emit('draft:error', { message: 'Not your turn' })
                return
            }

            // Check player not already picked
            const alreadyPicked = state.picks.some(p => p.squadPlayerId === squadPlayerId)
            if (alreadyPicked) {
                socket.emit('draft:error', { message: 'Player already picked' })
                return
            }

            // Clear timer
            if (state.timer) {
                clearTimeout(state.timer)
                state.timer = null
            }

            // Save pick
            const pick = await Pick.create({
                roomId,
                userId: socket.userId,
                pickType: currentTurn.pickType,
                pickOrder: currentTurn.pickNumber,
                playerName,
                squadPlayerId,
                autoPicked: false
            })

            state.picks.push(pick)
            state.currentPickIndex++

            // Check if draft complete
            if (state.currentPickIndex >= state.draftOrder.length) {
                state.status = 'complete'
                await Room.findByIdAndUpdate(roomId, { status: 'completed' })

                io.to(roomId).emit('draft:complete', {
                    roomId,
                    allPicks: state.picks
                })

                draftStates.delete(roomId)
                return
            }

            const nextTurn = state.draftOrder[state.currentPickIndex]
            io.to(roomId).emit('draft:pick_made', {
                pick,
                nextTurn
            })

            startTurnTimer(io, roomId)
        })

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.username}`)
        })
    })
}

function startTurnTimer(io, roomId) {
    const state = draftStates.get(roomId)
    if (!state || state.status !== 'active') return

    const currentTurn = state.draftOrder[state.currentPickIndex]
    const TURN_DURATION = 60

    // Emit turn event with timer
    io.to(roomId).emit('draft:turn', {
        userId: currentTurn.userId,
        pickType: currentTurn.pickType,
        pickNumber: currentTurn.pickNumber,
        timeLeft: TURN_DURATION
    })

    state.timer = setTimeout(async () => {
        // Auto-pick on timeout
        const autoPick = await getAutoPick(
            currentTurn.userId,
            state.matchId,
            roomId,
            currentTurn.pickType
        )

        if (!autoPick) {
            io.to(roomId).emit('draft:error', { message: 'No available players for auto-pick' })
            return
        }

        const pick = await Pick.create({
            roomId,
            userId: currentTurn.userId,
            pickType: currentTurn.pickType,
            pickOrder: currentTurn.pickNumber,
            playerName: autoPick.playerName,
            squadPlayerId: autoPick.squadPlayerId,
            autoPicked: true,
            cascaded: autoPick.cascaded || false
        })

        state.picks.push(pick)
        state.currentPickIndex++

        io.to(roomId).emit('draft:timeout', {
            userId: currentTurn.userId,
            autoPick: pick
        })

        if (state.currentPickIndex >= state.draftOrder.length) {
            state.status = 'complete'
            await Room.findByIdAndUpdate(roomId, { status: 'completed' })

            io.to(roomId).emit('draft:complete', {
                roomId,
                allPicks: state.picks
            })

            draftStates.delete(roomId)
            return
        }

        startTurnTimer(io, roomId)
    }, TURN_DURATION * 1000)
}

module.exports = { setupDraftSocket }
