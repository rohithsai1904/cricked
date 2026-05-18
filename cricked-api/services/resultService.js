const Room = require('../models/Room')
const DraftPick = require('../models/DraftPick')
const Match = require('../models/Match')
const User = require('../models/User')

function calcPoints(pick, battingStats, bowlingStats) {
    const name = pick.playerName
    const pickType = pick.pickType

    const batting = battingStats.find(b => b.playerName.toLowerCase() === name.toLowerCase())
    const bowling = bowlingStats.find(b => b.playerName.toLowerCase() === name.toLowerCase())

    const runs = batting?.runs || 0
    const wickets = bowling?.wickets || 0

    let points = 0

    if (pickType === 'batsman') {
        points += runs * 8
        if (runs >= 100) points += 100
        else if (runs >= 50) points += 50
    } else if (pickType === 'bowler') {
        points += wickets * 120
        if (wickets >= 3) points += 50
    } else if (pickType === 'allrounder') {
        points += runs * 8
        points += wickets * 120
        if (runs >= 30 && wickets >= 2) points += 50
    }

    return points
}

async function declareResultsForMatch(matchId) {
    const match = await Match.findById(matchId)
    if (!match || !match.scorecardSynced) return { declared: 0, skipped: 'No scorecard' }

    const rooms = await Room.find({ matchId, resultDeclared: { $ne: true } })
        .populate('player1Id')
        .populate('player2Id')

    let declared = 0

    for (const room of rooms) {
        if (!room.player1Id || !room.player2Id) continue

        const picks = await DraftPick.find({ roomId: room._id })
        const p1Id = room.player1Id._id.toString()
        const p2Id = room.player2Id._id.toString()

        let p1Score = 0, p2Score = 0
        for (const pick of picks) {
            const pts = calcPoints(pick, match.battingStats || [], match.bowlingStats || [])
            if (pick.userId.toString() === p1Id) p1Score += pts
            else p2Score += pts
        }

        room.player1Score = p1Score
        room.player2Score = p2Score
        room.status = 'completed'
        room.resultDeclared = true

        if (p1Score > p2Score) {
            room.winnerId = room.player1Id._id
            room.isDraw = false
        } else if (p2Score > p1Score) {
            room.winnerId = room.player2Id._id
            room.isDraw = false
        } else {
            room.winnerId = null
            room.isDraw = true
        }

        await room.save()

        // Update user stats
        const winnerId = room.winnerId?.toString()
        const loserId = winnerId === p1Id ? p2Id : winnerId === p2Id ? p1Id : null

        if (room.isDraw) {
            await User.findByIdAndUpdate(p1Id, {
                $inc: { matchesPlayed: 1, pointsTotal: p1Score }
            })
            await User.findByIdAndUpdate(p2Id, {
                $inc: { matchesPlayed: 1, pointsTotal: p2Score }
            })
        } else {
            await User.findByIdAndUpdate(winnerId, {
                $inc: { matchesPlayed: 1, wins: 1, pointsTotal: winnerId === p1Id ? p1Score : p2Score }
            })
            await User.findByIdAndUpdate(loserId, {
                $inc: { matchesPlayed: 1, losses: 1, pointsTotal: loserId === p1Id ? p1Score : p2Score }
            })
        }

        // Recalculate winRate for both
        for (const uid of [p1Id, p2Id]) {
            const u = await User.findById(uid)
            if (u && u.matchesPlayed > 0) {
                u.winRate = Math.round((u.wins / u.matchesPlayed) * 100)
                await u.save()
            }
        }

        declared++
        console.log(`[results] Room ${room._id}: P1=${p1Score} P2=${p2Score} Winner=${room.isDraw ? 'DRAW' : winnerId}`)
    }

    return { declared, matchId: matchId.toString() }
}

module.exports = { declareResultsForMatch }
