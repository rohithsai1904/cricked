const Match = require('../models/Match')
const cricapi = require('./cricapi')

// Filter only T20 matches — skip ODI, Test, women's, TBC teams
const isValidMatch = (match) => {
    if (!match.matchType) return false
    if (match.matchType !== 't20') return false
    if (!match.teams || match.teams.includes('Tbc')) return false
    if (match.name.toLowerCase().includes('women')) return false
    return true
}

// Sync upcoming matches from CricAPI into your DB
const syncMatches = async () => {
    console.log('[matchSync] Starting match sync...')

    try {
        const data = await cricapi.getUpcomingMatches()

        if (data.status !== 'success') {
            console.error('[matchSync] API error:', data)
            return
        }
        console.log(data.data)
        // Support both single match (match_info) and list (series_info)
        const rawMatches = Array.isArray(data.data?.matchList) ? data.data.matchList
            : Array.isArray(data.data) ? data.data
            : data.data ? [data.data] : []
        const validMatches = rawMatches.filter(isValidMatch)
        console.log(`[matchSync] Found ${validMatches.length} valid T20 matches`)

        for (const m of validMatches) {
            // Check if match already exists in DB
            const existing = await Match.findOne({ cricapiId: m.id })

            if (!existing) {
                await Match.create({
                    cricapiId: m.id,
                    teamHome: m.teams[0],
                    teamAway: m.teams[1],
                    teamHomeImg: m.teamInfo?.[0]?.img || '',
                    teamAwayImg: m.teamInfo?.[1]?.img || '',
                    startTime: new Date(m.dateTimeGMT + 'Z'),
                    status: m.matchEnded ? 'completed' :
                        m.matchStarted ? 'live' : 'upcoming',
                    matchStarted: !!m.matchStarted,
                    matchEnded: !!m.matchEnded,
                    matchWinner: m.matchWinner || '',
                    matchStatusText: m.status || '',
                    venue: m.venue || ''
                })
                console.log(`[matchSync] Created: ${m.teams[0]} vs ${m.teams[1]}`)
            }
        }

        console.log('[matchSync] Sync complete')
    } catch (err) {
        console.error('[matchSync] Error:', err.message)
    }
}

// Sync squad for a specific match
const syncSquad = async (matchId) => {
    console.log(`[matchSync] Fetching squad for match ${matchId}`)

    try {
        const match = await Match.findById(matchId)
        if (!match || !match.cricapiId) return

        const data = await cricapi.getMatchDetail(match.cricapiId)
        if (data.status !== 'success') return

        const teams = data.data // array of { teamName, shortname, img, players[] }
        if (!teams || teams.length < 2) return

        // Match API teams to DB teams by name
        const homeTeam = teams.find(t => t.teamName === match.teamHome || t.shortname === match.teamHome)
        const awayTeam = teams.find(t => t.teamName === match.teamAway || t.shortname === match.teamAway)

        // Fallback: first = home, second = away
        const home = homeTeam || teams[0]
        const away = awayTeam || teams[1]

        if (home?.players?.length > 0) {
            match.squadHome = home.players.map(p => ({
                playerId: p.id || p.name,
                playerName: p.name,
                role: p.role || 'unknown'
            }))
            match.teamHomeImg = home.img || match.teamHomeImg
        }

        if (away?.players?.length > 0) {
            match.squadAway = away.players.map(p => ({
                playerId: p.id || p.name,
                playerName: p.name,
                role: p.role || 'unknown'
            }))
            match.teamAwayImg = away.img || match.teamAwayImg
        }

        await match.save()
        console.log(`[matchSync] Squad updated for ${match.teamHome} vs ${match.teamAway}`)
    } catch (err) {
        console.error('[matchSync] Squad sync error:', err.message)
    }
}

// Update match status and detect toss
const syncMatchStatus = async () => {
    console.log('[matchSync] Checking match statuses...')

    try {
        const data = await cricapi.getUpcomingMatches()
        if (data.status !== 'success') return

        const rawMatches = Array.isArray(data.data?.matchList) ? data.data.matchList
            : Array.isArray(data.data) ? data.data
            : data.data ? [data.data] : []

        for (const m of rawMatches) {
            const match = await Match.findOne({ cricapiId: m.id })
            if (!match) continue

            // Update status
            let newStatus = match.status
            if (m.matchEnded) newStatus = 'completed'
            else if (m.matchStarted) newStatus = 'live'
            else if (m.hasSquad) newStatus = 'drafting'

            let changed = false
            if (newStatus !== match.status) { match.status = newStatus; changed = true }
            if (m.matchStarted !== undefined && m.matchStarted !== match.matchStarted) { match.matchStarted = m.matchStarted; changed = true }
            if (m.matchEnded !== undefined && m.matchEnded !== match.matchEnded) { match.matchEnded = m.matchEnded; changed = true }
            if (m.matchWinner && m.matchWinner !== match.matchWinner) { match.matchWinner = m.matchWinner; changed = true }
            if (m.status && m.status !== match.matchStatusText) { match.matchStatusText = m.status; changed = true }

            if (changed) {
                await match.save()
                console.log(`[matchSync] ${match.teamHome} vs ${match.teamAway} → ${newStatus} | started=${match.matchStarted} ended=${match.matchEnded}`)
            }
        }
    } catch (err) {
        console.error('[matchSync] Status sync error:', err.message)
    }
}

// Fetch toss data for a specific match
const syncToss = async (matchId) => {
    console.log(`[matchSync] Fetching toss for match ${matchId}`)

    try {
        const match = await Match.findById(matchId)
        if (!match || !match.cricapiId) return

        const data = await cricapi.getMatchInfo(match.cricapiId)
        if (data.status !== 'success' || !data.data) {
            console.log(`[matchSync] Toss not available yet for ${match.teamHome} vs ${match.teamAway}`)
            return
        }

        const tossWinner = data.data.tossWinner || ''
        const tossChoice = data.data.tossChoice || ''

        if (tossWinner) {
            match.tossWinner = tossWinner
            match.tossChoice = tossChoice
            match.tossTime = new Date()
            if (match.status === 'upcoming') match.status = 'live'
            await match.save()
            console.log(`[matchSync] Toss done — ${match.teamHome} vs ${match.teamAway}`)
        } else {
            console.log(`[matchSync] No toss yet for ${match.teamHome} vs ${match.teamAway}`)
        }
    } catch (err) {
        console.error('[matchSync] Toss sync error:', err.message)
    }
}

// Fetch and store scorecard for a match
const syncScorecard = async (matchId) => {
    console.log(`[matchSync] Fetching scorecard for match ${matchId}`)

    try {
        const match = await Match.findById(matchId)
        if (!match || !match.cricapiId) return { error: 'Match not found or no cricapiId' }

        const data = await cricapi.getScorecard(match.cricapiId)
        if (data.status !== 'success' || !data.data) {
            return { error: 'Scorecard not available yet' }
        }

        const scorecard = data.data.scorecard || []

        // Flatten all batting and bowling entries across innings
        const battingStats = []
        const bowlingStats = []

        for (const inning of scorecard) {
            for (const b of (inning.batting || [])) {
                battingStats.push({
                    playerId: b.batsman?.id || '',
                    playerName: b.batsman?.name || '',
                    runs: b.r || 0,
                    balls: b.b || 0,
                    fours: b['4s'] || 0,
                    sixes: b['6s'] || 0,
                    sr: b.sr || 0,
                    inning: inning.inning || ''
                })
            }
            for (const bw of (inning.bowling || [])) {
                bowlingStats.push({
                    playerId: bw.bowler?.id || '',
                    playerName: bw.bowler?.name || '',
                    overs: bw.o || 0,
                    maidens: bw.m || 0,
                    runs: bw.r || 0,
                    wickets: bw.w || 0,
                    eco: bw.eco || 0,
                    inning: inning.inning || ''
                })
            }
        }

        match.battingStats = battingStats
        match.bowlingStats = bowlingStats
        match.scorecardSynced = true
        await match.save()

        console.log(`[matchSync] Scorecard stored: ${battingStats.length} batting, ${bowlingStats.length} bowling entries`)
        return { battingStats, bowlingStats }
    } catch (err) {
        console.error('[matchSync] Scorecard sync error:', err.message)
        return { error: err.message }
    }
}

module.exports = { syncMatches, syncSquad, syncMatchStatus, syncToss, syncScorecard }