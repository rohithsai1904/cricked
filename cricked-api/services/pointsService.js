function calculatePoints(player1Picks, player2Picks) {
    const p1Runs = player1Picks
        .filter(p => p.pickType === 'batsman')
        .reduce((sum, p) => sum + (p.runs || 0), 0)
    const p2Runs = player2Picks
        .filter(p => p.pickType === 'batsman')
        .reduce((sum, p) => sum + (p.runs || 0), 0)

    const p1Wickets = player1Picks
        .filter(p => p.pickType === 'bowler')
        .reduce((sum, p) => sum + (p.wickets || 0), 0)
    const p2Wickets = player2Picks
        .filter(p => p.pickType === 'bowler')
        .reduce((sum, p) => sum + (p.wickets || 0), 0)

    const runDiff = p1Runs - p2Runs
    const wicketDiff = p1Wickets - p2Wickets

    const p1Points = (Math.max(runDiff, 0) * 10) + (Math.max(wicketDiff, 0) * 100)
    const p2Points = (Math.max(-runDiff, 0) * 10) + (Math.max(-wicketDiff, 0) * 100)

    return {
        player1Points: p1Points,
        player2Points: p2Points,
        runDiff: Math.abs(runDiff),
        wicketDiff: Math.abs(wicketDiff),
        winnerId: p1Points >= p2Points ? player1Picks[0].userId : player2Picks[0].userId,
        loserId: p1Points < p2Points ? player1Picks[0].userId : player2Picks[0].userId
    }
}

module.exports = { calculatePoints }
