const jwt = require('jsonwebtoken')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const Room = require('../models/Room')
const Match = require('../models/Match')
const PreDraft = require('../models/PreDraft')
const DraftPick = require('../models/DraftPick')
const DraftState = require('../models/DraftState')
const { declareResultsForMatch } = require('../services/resultService')

// In-memory draft cache keyed by roomId (source of truth is MongoDB)
const drafts = {}

// Persist current draft state to MongoDB
async function saveDraftState(roomId) {
    const draft = drafts[roomId]
    if (!draft) return
    try {
        await DraftState.findOneAndUpdate(
            { roomId },
            {
                player1Id: draft.player1Id,
                player2Id: draft.player2Id,
                firstPickUserId: draft.firstPickUserId,
                matchStartTime: draft.matchStartTime ? new Date(draft.matchStartTime) : null,
                turns: draft.turns,
                currentTurn: draft.currentTurn,
                picks: draft.picks,
                pickedPlayerIds: Array.from(draft.pickedPlayerIds),
                started: draft.started,
                completed: draft.currentTurn >= TOTAL_PICKS,
                turnStartedAt: draft.turnStartedAt ? new Date(draft.turnStartedAt) : null
            },
            { upsert: true }
        )
    } catch (err) {
        console.error(`[draft] saveDraftState error for ${roomId}:`, err.message)
    }
}

// Load draft state from MongoDB into memory
async function recoverDrafts() {
    try {
        const states = await DraftState.find({ completed: false })
        for (const s of states) {
            const roomId = s.roomId.toString()
            if (drafts[roomId]) continue
            drafts[roomId] = {
                roomId,
                player1Id: s.player1Id,
                player2Id: s.player2Id,
                firstPickUserId: s.firstPickUserId,
                matchStartTime: s.matchStartTime ? s.matchStartTime.getTime() : null,
                turns: s.turns,
                currentTurn: s.currentTurn,
                picks: s.picks,
                pickedPlayerIds: new Set(s.pickedPlayerIds),
                started: s.started,
                timer: null,
                turnStartedAt: s.turnStartedAt ? s.turnStartedAt.getTime() : null,
                turnTimeLimit: TURN_SECONDS,
                picking: false
            }
            console.log(`[draft] Recovered draft for room ${roomId} (turn ${s.currentTurn}/${TOTAL_PICKS}, started: ${s.started})`)
        }
    } catch (err) {
        console.error('[draft] recoverDrafts error:', err.message)
    }
}

const TURN_SECONDS = 30
const OFFLINE_GRACE_SECONDS = 20
const MAX_PER_TEAM = {
    batsman: 2,
    bowler: 1,
    allrounder: 1
}

// 3 rounds: batsmen(3 each), bowlers(2 each), allrounders(2 each) = 7 per player, 14 total
const ROUNDS = [
    { type: 'batsman', label: 'Batsmen', picksEach: 3, coinWinnerStarts: true },
    { type: 'bowler', label: 'Bowlers', picksEach: 2, coinWinnerStarts: false },
    { type: 'allrounder', label: 'All-rounders', picksEach: 2, coinWinnerStarts: true }
]

const TOTAL_PICKS = ROUNDS.reduce((sum, r) => sum + r.picksEach * 2, 0) // 14

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
        timeLimit,
        isOnline: online
    })

    draft.turnStartedAt = Date.now()
    draft.turnTimeLimit = timeLimit
    saveDraftState(roomId)
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
        await DraftState.findOneAndUpdate({ roomId }, { completed: true, currentTurn: draft.currentTurn, picks: draft.picks, pickedPlayerIds: Array.from(draft.pickedPlayerIds) })
        io.to(roomId).emit('draft:complete', { picks: draft.picks })
        delete drafts[roomId]
    } else {
        draft.picking = false
        saveDraftState(roomId)
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

    const matchStartTime = room.matchId?.startTime ? new Date(room.matchId.startTime).getTime() : null

    drafts[roomId] = {
        roomId,
        player1Id: p1,
        player2Id: p2,
        firstPickUserId: firstPick,
        turns: buildTurns(firstPick, p1, p2),
        currentTurn: 0,
        picks: [],
        started: false, // wait for both players (or deadline) before starting turns
        timer: null,
        turnStartedAt: null,
        turnTimeLimit: TURN_SECONDS,
        pickedPlayerIds: new Set(),
        picking: false,
        matchStartTime
    }

    await Room.findByIdAndUpdate(roomId, { status: 'drafting' })
    await saveDraftState(roomId)
    console.log(`[draft] Draft created for room ${roomId} — waiting for both players to connect`)
}

// Cron: detect toss and create draft immediately
async function checkAndStartDrafts(io) {
    try {
        const rooms = await Room.find({
            status: { $in: ['ready', 'drafting'] },
            player1Id: { $exists: true },
            player2Id: { $exists: true }
        }).populate('matchId', 'startTime tossWinner')

        for (const room of rooms) {
            if (!room.matchId || !room.matchId.tossWinner) continue
            const roomId = room._id.toString()
            if (drafts[roomId]) continue // already in memory
            console.log(`[draft] Toss confirmed for room ${roomId}, creating draft`)
            await initDraft(io, room)
        }
    } catch (err) {
        console.error('[draft] checkAndStartDrafts error:', err)
    }
}

// Cron: check draft deadlines (T-15: start if ≥1 online, T-5: force autopick)
async function checkDraftDeadlines(io) {
    try {
        const now = Date.now()
        for (const [roomId, draft] of Object.entries(drafts)) {
            if (draft.started || !draft.matchStartTime) continue

            const msBefore = draft.matchStartTime - now
            const p1Online = isUserOnline(io, draft, draft.player1Id)
            const p2Online = isUserOnline(io, draft, draft.player2Id)
            const anyOnline = p1Online || p2Online

            // 15 min before match: start if at least 1 player is connected
            if (msBefore <= 15 * 60 * 1000 && anyOnline) {
                draft.started = true
                console.log(`[draft] 15min deadline — starting draft for room ${roomId} (${p1Online ? 'P1' : 'P2'} online)`)
                io.to(roomId).emit('draft:started', {
                    turns: draft.turns,
                    firstPickUserId: draft.firstPickUserId
                })
                startTurn(io, roomId)
                continue
            }

            // 5 min before match: force-start even if no one is connected (auto-picks)
            if (msBefore <= 5 * 60 * 1000) {
                draft.started = true
                console.log(`[draft] 5min deadline — force-starting draft for room ${roomId} (auto-pick enabled)`)
                io.to(roomId).emit('draft:started', {
                    turns: draft.turns,
                    firstPickUserId: draft.firstPickUserId
                })
                startTurn(io, roomId)
            }
        }
    } catch (err) {
        console.error('[draft] checkDraftDeadlines error:', err)
    }
}

// Cron: complete rooms whose match has ended
async function checkMatchCompleted(io) {
    try {
        const rooms = await Room.find({
            status: { $in: ['ready', 'drafting'] }
        }).populate('matchId', 'matchEnded')

        for (const room of rooms) {
            if (!room.matchId || !room.matchId.matchEnded) continue
            const roomId = room._id.toString()

            // Clean up in-memory draft if running
            if (drafts[roomId]) {
                if (drafts[roomId].timer) clearTimeout(drafts[roomId].timer)
                io.to(roomId).emit('draft:complete', { picks: drafts[roomId].picks })
                delete drafts[roomId]
            }

            await Room.findByIdAndUpdate(roomId, { status: 'completed' })
            console.log(`[draft] Auto-completed room ${roomId} — match ended`)
        }
    } catch (err) {
        console.error('[draft] checkMatchCompleted error:', err)
    }
}

// Cron: auto-declare results for matches with synced scorecards
async function checkAndDeclareResults() {
    try {
        const rooms = await Room.find({ resultDeclared: { $ne: true }, status: 'completed' })
            .populate('matchId', 'scorecardSynced')

        const processedMatches = new Set()
        for (const room of rooms) {
            if (!room.matchId || !room.matchId.scorecardSynced) continue
            const matchId = room.matchId._id.toString()
            if (processedMatches.has(matchId)) continue
            processedMatches.add(matchId)

            const result = await declareResultsForMatch(room.matchId._id)
            if (result.declared > 0) {
                console.log(`[results] Auto-declared ${result.declared} room(s) for match ${matchId}`)
            }
        }
    } catch (err) {
        console.error('[results] checkAndDeclareResults error:', err)
    }
}

function setupDraft(io) {
    _io = io

    // Check every 2 min for toss detection / draft creation
    setInterval(() => checkAndStartDrafts(io), 2 * 60 * 1000)
    // Check every 30 seconds for draft deadlines (15min / 5min)
    setInterval(() => checkDraftDeadlines(io), 30 * 1000)
    // Check every 5 min for matches that have ended
    setInterval(() => checkMatchCompleted(io), 5 * 60 * 1000)
    // Check every 3 min for results to declare
    setInterval(() => checkAndDeclareResults(), 3 * 60 * 1000)
    // Recover persisted drafts from MongoDB, then run crons
    recoverDrafts().then(() => {
        console.log('[draft] Recovery complete')
        // Resume turns for any started drafts that were interrupted
        for (const [roomId, draft] of Object.entries(drafts)) {
            if (draft.started && draft.currentTurn < TOTAL_PICKS && !draft.timer) {
                console.log(`[draft] Resuming turns for room ${roomId}`)
                startTurn(io, roomId)
            }
        }
    })
    setTimeout(() => checkAndStartDrafts(io), 5000)
    setTimeout(() => checkDraftDeadlines(io), 8000)
    setTimeout(() => checkMatchCompleted(io), 10000)
    setTimeout(() => checkAndDeclareResults(), 15000)

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

                // If draft hasn't been created yet, nothing to do — wait for cron
                if (!draft) {
                    socket.emit('draft:waiting', { message: 'Draft will start automatically when toss is done' })
                    return
                }

                // If draft is created but turns haven't started yet
                if (!draft.started) {
                    const p1Online = isUserOnline(io, draft, draft.player1Id)
                    const p2Online = isUserOnline(io, draft, draft.player2Id)
                    emitOnlineStatus(io, draft)

                    if (p1Online && p2Online) {
                        // Both players connected — start immediately
                        draft.started = true
                        console.log(`[draft] Both players connected — starting draft for room ${roomId}`)
                        io.to(roomId).emit('draft:started', {
                            turns: draft.turns,
                            firstPickUserId: draft.firstPickUserId
                        })
                        startTurn(io, roomId)
                    } else {
                        socket.emit('draft:waiting', { message: 'Waiting for opponent to join...' })
                    }
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
