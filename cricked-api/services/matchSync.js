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
        const validMatches = data.data.matchList.filter(isValidMatch)
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
                    startTime: new Date(m.dateTimeGMT),
                    status: m.matchStarted ? 'live' :
                        m.matchEnded ? 'completed' : 'upcoming',
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

        for (const m of data.data) {
            const match = await Match.findOne({ cricapiId: m.id })
            if (!match) continue

            // Update status
            let newStatus = match.status
            if (m.matchEnded) newStatus = 'completed'
            else if (m.matchStarted) newStatus = 'live'
            else if (m.hasSquad) newStatus = 'drafting'

            if (newStatus !== match.status) {
                match.status = newStatus
                await match.save()
                console.log(`[matchSync] ${match.teamHome} vs ${match.teamAway} → ${newStatus}`)
            }
        }
    } catch (err) {
        console.error('[matchSync] Status sync error:', err.message)
    }
}

module.exports = { syncMatches, syncSquad, syncMatchStatus }