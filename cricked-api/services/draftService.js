const PreDraft = require('../models/PreDraft')
const Pick = require('../models/Pick')
const Match = require('../models/Match')

function getDraftOrder(firstPickUserId, player1Id, player2Id) {
    const A = firstPickUserId.toString()
    const B = A === player1Id.toString() ? player2Id.toString() : player1Id.toString()

    return {
        batsmen: [A, B, A, B, B, A, B, A],
        bowlers: [B, A, A, B]
    }
}

function getFullDraftOrder(firstPickUserId, player1Id, player2Id) {
    const order = getDraftOrder(firstPickUserId, player1Id, player2Id)
    return [
        ...order.batsmen.map((userId, i) => ({ userId, pickType: 'batsman', pickNumber: i + 1 })),
        ...order.bowlers.map((userId, i) => ({ userId, pickType: 'bowler', pickNumber: i + 1 }))
    ]
}

async function getAutoPick(userId, matchId, roomId, pickType) {
    const preDraft = await PreDraft.find({ userId, matchId, pickType })
        .sort({ rankOrder: 1 })

    const taken = await Pick.find({ roomId }).select('squadPlayerId')
    const takenIds = taken.map(p => p.squadPlayerId)

    const pick = preDraft.find(p => !takenIds.includes(p.squadPlayerId))
    if (pick) {
        return {
            playerName: pick.playerName,
            squadPlayerId: pick.squadPlayerId,
            autoPicked: true,
            cascaded: false
        }
    }

    const match = await Match.findById(matchId)
    const allPlayers = [...match.squadHome, ...match.squadAway]
        .filter(p => {
            if (pickType === 'batsman') return ['batsman', 'allrounder', 'wicketkeeper'].includes(p.role)
            return ['bowler', 'allrounder'].includes(p.role)
        })
        .filter(p => !takenIds.includes(p.playerId))

    if (allPlayers.length > 0) {
        return {
            playerName: allPlayers[0].playerName,
            squadPlayerId: allPlayers[0].playerId,
            autoPicked: true,
            cascaded: true
        }
    }

    return null
}

module.exports = { getDraftOrder, getFullDraftOrder, getAutoPick }
