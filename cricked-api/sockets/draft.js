const jwt = require('jsonwebtoken')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const Room = require('../models/Room')
const Match = require('../models/Match')
const PreDraft = require('../models/PreDraft')
const DraftPick = require('../models/DraftPick')

// In-memory draft state keyed by roomId
const drafts = {}

const TURN_SECONDS = 60
const OFFLINE_GRACE_SECONDS = 10
const MAX_PER_TEAM = {
    batsman: 2,
    bowler: 1,
    allrounder: 1
}

// 3 rounds: batsmen(4 each), bowlers(2 each), allrounders(2 each) = 8 per player, 16 total
const ROUNDS = [
    { type: 'batsman', label: 'Batsmen', picksEach: 4, coinWinnerStarts: true },
    { type: 'bowler', label: 'Bowlers', picksEach: 2, coinWinnerStarts: false },
    { type: 'allrounder', label: 'All-rounders', picksEach: 2, coinWinnerStarts: true }
]

const TOTAL_PICKS = ROUNDS.reduce((sum, r) => sum + r.picksEach * 2, 0) // 16

let _io = null

function snakeOrder(totalPicks, starter, other) {
    const order = []
    for (let i = 0; i < totalPicks; i++) {
        const block = Math.floor(i / 2)
        const pos = i % 2
        if (block % 2 === 0) {
            order.push(pos === 0 ? starter : other)
        } else {
            order.push(pos === 0 ? other : starter)
        }
    }
    return order
}

function buildTurns(coinWinner, p1, p2) {
    const other = coinWinner === p1 ? p2 : p1
    const turns = []
    let pickNumber = 0
    for (let r = 0; r < ROUNDS.length; r++) {
        const round = ROUNDS[r]
        const totalRoundPicks = round.picksEach * 2
        const starter = round.coinWinnerStarts ? coinWinner : other
        const nonStarter = starter === coinWinner ? other : coinWinner
        const order = snakeOrder(totalRoundPicks, starter, nonStarter)
        for (let i = 0; i < order.length; i++) {
            pickNumber++
            turns.push({
                pickNumber,
                roundNumber: r + 1,
                roundType: round.type,
                roundLabel: round.label,
                picksEach: round.picksEach,
                pickInRound: i + 1,
                totalInRound: totalRoundPicks,
                userId: order[i]
            })
        }
    }
    return turns
}

// Get team counts for a specific user, grouped by pickType + team
function getUserTeamCounts(draft, userId) {
    const counts = {}
    for (const pick of draft.picks) {
        if (pick.userId === userId && !pick.isVoid && pick.team) {
            const key = `${pick.pickType}:${pick.team}`
            counts[key] = (counts[key] || 0) + 1
        }
    }
    return counts
}

async function autoPickForUser(draft, turn) {
    const userId = turn.userId
    const roomId = draft.roomId
    const pickType = turn.roundType
    const teamCounts = getUserTeamCounts(draft, userId)

    const preDraftPicks = await PreDraft.find({
        roomId, userId, pickType
    }).sort({ rankOrder: 1 })

    for (const pd of preDraftPicks) {
        if (draft.pickedPlayerIds.has(pd.squadPlayerId)) continue
        const limit = MAX_PER_TEAM[pickType] || 1
        const key = `${pickType}:${pd.team}`
        if (pd.team && (teamCounts[key] || 0) >= limit) continue

        return {
            squadPlayerId: pd.squadPlayerId,
            playerName: pd.playerName,
            team: pd.team || '',
            isVoid: false
        }
    }

    return {
        squadPlayerId: 'VOID',
        playerName: 'VOID',
        team: '',
        isVoid: true
    }
}

// Check if a user is currently connected to the draft room
function isUserOnline(io, draft, userId) {
    const room = io.sockets.adapter.rooms.get(draft.roomId)
    if (!room) return false
    for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId)
        if (s && s.userId === userId) return true
    }
    return false
}

function emitOnlineStatus(io, draft) {
    const p1Online = isUserOnline(io, draft, draft.player1Id)
    const p2Online = isUserOnline(io, draft, draft.player2Id)
    io.to(draft.roomId).emit('draft:online', {
        [draft.player1Id]: p1Online,
        [draft.player2Id]: p2Online
    })
}

function startTurn(io, roomId) {
    const draft = drafts[roomId]
    if (!draft || draft.currentTurn >= draft.turns.length) return

    const turn = draft.turns[draft.currentTurn]
    const online = isUserOnline(io, draft, turn.userId)
    const timeLimit = online ? TURN_SECONDS : OFFLINE_GRACE_SECONDS

    io.to(roomId).emit('draft:turn', {
        pickNumber: turn.pickNumber,
        roundNumber: turn.roundNumber,
        roundType: turn.roundType,
        roundLabel: turn.roundLabel,
        picksEach: turn.picksEach,
        pickInRound: turn.pickInRound,
        totalInRound: turn.totalInRound,
        userId: turn.userId,
        timeLimit
    })

    draft.turnStartedAt = Date.now()
    draft.turnTimeLimit = timeLimit
    draft.timer = setTimeout(async () => {
        if (draft.picking) return
        const player = await autoPickForUser(draft, turn)
        await makePick(io, roomId, turn.userId, player.squadPlayerId, player.playerName, player.team, true, player.isVoid)
    }, timeLimit * 1000)
}

async function makePick(io, roomId, userId, squadPlayerId, playerName, team, isAutoPick, isVoid) {
    const draft = drafts[roomId]
    if (!draft) return
    if (draft.picking) return
    draft.picking = true

    const turn = draft.turns[draft.currentTurn]
    if (!turn) { draft.picking = false; return }

    if (draft.timer) {
        clearTimeout(draft.timer)
        draft.timer = null
    }

    if (!isVoid) {
        draft.pickedPlayerIds.add(squadPlayerId)
    }

    const pickData = {
        roomId,
        userId,
        squadPlayerId,
        playerName,
        team: team || '',
        pickType: turn.roundType,
        pickNumber: turn.pickNumber,
        roundNumber: turn.roundNumber,
        isAutoPick: !!isAutoPick,
        isVoid: !!isVoid
    }

    await DraftPick.create(pickData)
    draft.picks.push(pickData)
    io.to(roomId).emit('draft:pick', pickData)

    draft.currentTurn++

    if (draft.currentTurn >= TOTAL_PICKS) {
        await Room.findByIdAndUpdate(roomId, { status: 'completed' })
        io.to(roomId).emit('draft:complete', { picks: draft.picks })
        delete drafts[roomId]
    } else {
        draft.picking = false
        startTurn(io, roomId)
    }
}

// --- Server-side draft auto-start ---
async function initDraft(io, room) {
    const roomId = room._id.toString()
    if (drafts[roomId]) return // already running

    const p1 = room.player1Id.toString()
    const p2 = room.player2Id.toString()
    const firstPick = (room.firstPickUserId || room.player1Id).toString()

    drafts[roomId] = {
        roomId,
        player1Id: p1,
        player2Id: p2,
        firstPickUserId: firstPick,
        turns: buildTurns(firstPick, p1, p2),
        currentTurn: 0,
        picks: [],
        started: true,
        timer: null,
        turnStartedAt: null,
        turnTimeLimit: TURN_SECONDS,
        pickedPlayerIds: new Set(),
        picking: false
    }

    await Room.findByIdAndUpdate(roomId, { status: 'drafting' })

    io.to(roomId).emit('draft:started', {
        turns: drafts[roomId].turns,
        firstPickUserId: firstPick
    })

    console.log(`[draft] Auto-started draft for room ${roomId}`)
    startTurn(io, roomId)
}

// Cron: check rooms that should auto-start
async function checkAndStartDrafts(io) {
    try {
        const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000)
        const rooms = await Room.find({
            status: 'ready',
            player1Id: { $exists: true },
            player2Id: { $exists: true }
        }).populate('matchId', 'startTime')

        for (const room of rooms) {
            if (!room.matchId || !room.matchId.startTime) continue
            const matchStart = new Date(room.matchId.startTime)
            if (matchStart <= tenMinFromNow) {
                await initDraft(io, room)
            }
        }
    } catch (err) {
        console.error('[draft] checkAndStartDrafts error:', err)
    }
}

function setupDraft(io) {
    _io = io

    // Check every 30 seconds for rooms that need auto-start
    setInterval(() => checkAndStartDrafts(io), 30 * 1000)
    // Run once on startup too
    setTimeout(() => checkAndStartDrafts(io), 5000)

    io.on('connection', (socket) => {

        socket.on('auth', (token) => {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                socket.userId = decoded.userId
                socket.emit('auth:success', { userId: decoded.userId })
            } catch (err) {
                socket.emit('auth:error', { error: 'Invalid token' })
                socket.disconnect()
            }
        })

        socket.on('draft:join', async (roomId) => {
            if (!socket.userId) {
                socket.emit('auth:error', { error: 'Not authenticated' })
                return
            }

            try {
                const room = await Room.findById(roomId)
                if (!room) {
                    socket.emit('draft:error', { error: 'Room not found' })
                    return
                }

                const p1 = room.player1Id.toString()
                const p2 = room.player2Id.toString()
                const uid = socket.userId

                if (uid !== p1 && uid !== p2) {
                    socket.emit('draft:error', { error: 'Not a player in this room' })
                    return
                }

                socket.join(roomId)
                socket.roomId = roomId

                const draft = drafts[roomId]

                // If draft hasn't been auto-started yet, nothing to do — wait for cron
                if (!draft) {
                    socket.emit('draft:waiting', { message: 'Draft will start automatically before match time' })
                    return
                }

                // Send current state
                if (draft.started) {
                    socket.emit('draft:started', {
                        turns: draft.turns,
                        firstPickUserId: draft.firstPickUserId
                    })

                    for (const pick of draft.picks) {
                        socket.emit('draft:pick', pick)
                    }

                    if (draft.currentTurn < draft.turns.length) {
                        const turn = draft.turns[draft.currentTurn]
                        const elapsed = Math.floor((Date.now() - draft.turnStartedAt) / 1000)
                        const remaining = Math.max(0, (draft.turnTimeLimit || TURN_SECONDS) - elapsed)
                        socket.emit('draft:turn', {
                            pickNumber: turn.pickNumber,
                            roundNumber: turn.roundNumber,
                            roundType: turn.roundType,
                            roundLabel: turn.roundLabel,
                            picksEach: turn.picksEach,
                            pickInRound: turn.pickInRound,
                            totalInRound: turn.totalInRound,
                            userId: turn.userId,
                            timeLimit: remaining
                        })
                    }

                    if (draft.currentTurn >= TOTAL_PICKS) {
                        socket.emit('draft:complete', { picks: draft.picks })
                    }
                }

                // Broadcast updated online status
                emitOnlineStatus(io, draft)
            } catch (err) {
                console.error('draft:join error:', err)
                socket.emit('draft:error', { error: 'Server error' })
            }
        })

        socket.on('draft:pick', async ({ roomId, squadPlayerId, playerName, team }) => {
            if (!socket.userId) return

            const draft = drafts[roomId]
            if (!draft) {
                socket.emit('draft:error', { error: 'No active draft' })
                return
            }

            const turn = draft.turns[draft.currentTurn]
            if (!turn) return

            if (turn.userId !== socket.userId) {
                socket.emit('draft:error', { error: 'Not your turn' })
                return
            }

            if (draft.pickedPlayerIds.has(squadPlayerId)) {
                socket.emit('draft:error', { error: 'Player already picked' })
                return
            }

            if (team) {
                const pickType = turn.roundType
                const limit = MAX_PER_TEAM[pickType] || 1
                const teamCounts = getUserTeamCounts(draft, socket.userId)
                const key = `${pickType}:${team}`
                if ((teamCounts[key] || 0) >= limit) {
                    socket.emit('draft:error', { error: `Max ${limit} ${pickType}${limit > 1 ? 's' : ''} per team` })
                    return
                }
            }

            await makePick(io, roomId, socket.userId, squadPlayerId, playerName, team, false, false)
        })

        socket.on('disconnect', () => {
            const roomId = socket.roomId
            if (roomId && drafts[roomId]) {
                // Broadcast updated online status
                setTimeout(() => {
                    if (drafts[roomId]) emitOnlineStatus(io, drafts[roomId])
                }, 500)
            }
        })
    })
}

module.exports = setupDraft
