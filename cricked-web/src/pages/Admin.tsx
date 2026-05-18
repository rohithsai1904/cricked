import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

interface Player {
    playerId: string
    playerName: string
    role: string
    squadType: string
    _id?: string
}

interface BattingStat {
    playerId: string
    playerName: string
    runs: number
    balls: number
    fours: number
    sixes: number
    sr: number
    inning: string
}

interface BowlingStat {
    playerId: string
    playerName: string
    overs: number
    maidens: number
    runs: number
    wickets: number
    eco: number
    inning: string
}

interface MatchData {
    _id: string
    teamHome: string
    teamAway: string
    teamHomeImg: string
    teamAwayImg: string
    startTime: string
    status: string
    matchStarted: boolean
    matchEnded: boolean
    tossWinner: string
    scorecardSynced: boolean
    squadHome: Player[]
    squadAway: Player[]
    playingXiHome: Player[]
    playingXiAway: Player[]
    battingStats: BattingStat[]
    bowlingStats: BowlingStat[]
}

const formatIST = (d: string) =>
    new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' IST'

const statusColors: Record<string, string> = {
    upcoming: 'bg-blue-500/20 text-blue-400',
    drafting: 'bg-yellow-500/20 text-yellow-400',
    live: 'bg-green-500/20 text-green-400',
    completed: 'bg-gray-500/20 text-gray-400'
}

export default function Admin() {
    const navigate = useNavigate()
    const [matches, setMatches] = useState<MatchData[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null)
    const [selectedHome, setSelectedHome] = useState<Set<string>>(new Set())
    const [selectedAway, setSelectedAway] = useState<Set<string>>(new Set())
    const [impactHome, setImpactHome] = useState<Set<string>>(new Set())
    const [impactAway, setImpactAway] = useState<Set<string>>(new Set())
    const [actionLoading, setActionLoading] = useState('')
    const [message, setMessage] = useState('')
    const [battingStats, setBattingStats] = useState<BattingStat[]>([])
    const [bowlingStats, setBowlingStats] = useState<BowlingStat[]>([])

    useEffect(() => {
        loadMatches()
    }, [])

    const [forbidden, setForbidden] = useState(false)

    const loadMatches = async () => {
        try {
            const res = await api.get('/matches/admin/all')
            setMatches(res.data)
        } catch (err: any) {
            if (err.response?.status === 403) setForbidden(true)
            else setMessage('Failed to load matches')
        } finally {
            setLoading(false)
        }
    }

    const selectMatch = (match: MatchData) => {
        setSelectedMatch(match)
        setMessage('')
        // Pre-select existing playing XI
        const homeIds = new Set((match.playingXiHome || []).map(p => p.playerId))
        const awayIds = new Set((match.playingXiAway || []).map(p => p.playerId))
        setSelectedHome(homeIds)
        setSelectedAway(awayIds)
        // Pre-select impact players
        const impHome = new Set((match.squadHome || []).filter(p => p.squadType === 'impact').map(p => p.playerId))
        const impAway = new Set((match.squadAway || []).filter(p => p.squadType === 'impact').map(p => p.playerId))
        setImpactHome(impHome)
        setImpactAway(impAway)
        // Load existing scorecard stats
        setBattingStats(match.battingStats || [])
        setBowlingStats(match.bowlingStats || [])
    }

    const updateBatting = (idx: number, field: keyof BattingStat, value: string) => {
        setBattingStats(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'playerName' || field === 'playerId' || field === 'inning' ? value : Number(value) || 0 } : s))
    }

    const updateBowling = (idx: number, field: keyof BowlingStat, value: string) => {
        setBowlingStats(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'playerName' || field === 'playerId' || field === 'inning' ? value : Number(value) || 0 } : s))
    }

    const addBattingRow = () => {
        setBattingStats(prev => [...prev, { playerId: '', playerName: '', runs: 0, balls: 0, fours: 0, sixes: 0, sr: 0, inning: '' }])
    }

    const addBowlingRow = () => {
        setBowlingStats(prev => [...prev, { playerId: '', playerName: '', overs: 0, maidens: 0, runs: 0, wickets: 0, eco: 0, inning: '' }])
    }

    const removeBattingRow = (idx: number) => setBattingStats(prev => prev.filter((_, i) => i !== idx))
    const removeBowlingRow = (idx: number) => setBowlingStats(prev => prev.filter((_, i) => i !== idx))

    const saveScorecard = async () => {
        if (!selectedMatch) return
        setActionLoading('scorecard')
        try {
            await api.post(`/matches/${selectedMatch._id}/manual-scorecard`, { battingStats, bowlingStats })
            setMessage(`✅ Scorecard saved (${battingStats.length} batting, ${bowlingStats.length} bowling)`)
            loadMatches()
        } catch {
            setMessage('❌ Failed to save scorecard')
        } finally {
            setActionLoading('')
        }
    }

    const togglePlayer = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
        const next = new Set(set)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setFn(next)
    }

    const savePlayingXI = async () => {
        if (!selectedMatch) return
        setActionLoading('xi')
        try {
            await api.post(`/matches/${selectedMatch._id}/playing-xi`, {
                homePlayerIds: Array.from(selectedHome),
                awayPlayerIds: Array.from(selectedAway)
            })
            setMessage(`✅ Playing XI saved (${selectedHome.size} home, ${selectedAway.size} away)`)
            loadMatches()
        } catch {
            setMessage('❌ Failed to save Playing XI')
        } finally {
            setActionLoading('')
        }
    }

    const saveImpact = async () => {
        if (!selectedMatch) return
        setActionLoading('impact')
        try {
            await api.post(`/matches/${selectedMatch._id}/impact`, {
                homePlayerIds: Array.from(impactHome),
                awayPlayerIds: Array.from(impactAway)
            })
            setMessage(`✅ Impact players saved`)
            loadMatches()
        } catch {
            setMessage('❌ Failed to save impact players')
        } finally {
            setActionLoading('')
        }
    }

    const syncAction = async (action: string) => {
        if (!selectedMatch) return
        setActionLoading(action)
        try {
            await api.post(`/matches/${selectedMatch._id}/${action}`)
            setMessage(`✅ ${action} complete`)
            loadMatches()
        } catch (err: any) {
            setMessage(`❌ ${action} failed: ${err.response?.data?.error || err.message}`)
        } finally {
            setActionLoading('')
        }
    }

    if (forbidden) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                    <p className="text-gray-400 text-sm mb-4">Admin access only</p>
                    <button onClick={() => navigate('/')} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">Back to Dashboard</button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="text-gray-400">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
                <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">← Back</button>
                <h1 className="text-lg font-bold flex-1 text-center">Admin Panel</h1>
                <div className="w-12" />
            </div>

            <div className="flex h-[calc(100vh-52px)]">
                {/* Match list sidebar */}
                <div className="w-80 border-r border-gray-800 overflow-y-auto">
                    {matches.map(m => (
                        <button
                            key={m._id}
                            onClick={() => selectMatch(m)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-800/50 hover:bg-gray-900 transition ${selectedMatch?._id === m._id ? 'bg-gray-900 border-l-2 border-l-green-500' : ''}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium truncate">{m.teamHome} vs {m.teamAway}</div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[m.status] || 'bg-gray-700 text-gray-400'}`}>
                                    {m.status}
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">{formatIST(m.startTime)}</div>
                            <div className="flex gap-2 mt-1">
                                {m.tossWinner && <span className="text-[10px] text-yellow-500">🪙 Toss</span>}
                                {m.scorecardSynced && <span className="text-[10px] text-green-500">📊 Scorecard</span>}
                                {(m.playingXiHome?.length > 0) && <span className="text-[10px] text-blue-400">XI ✓</span>}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Match detail */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!selectedMatch ? (
                        <div className="text-gray-500 text-center mt-20">Select a match from the sidebar</div>
                    ) : (
                        <div className="max-w-3xl mx-auto">
                            {/* Match header */}
                            <div className="flex items-center gap-4 mb-6">
                                {selectedMatch.teamHomeImg && <img src={selectedMatch.teamHomeImg} className="w-8 h-8" alt="" />}
                                <h2 className="text-xl font-bold">{selectedMatch.teamHome} vs {selectedMatch.teamAway}</h2>
                                {selectedMatch.teamAwayImg && <img src={selectedMatch.teamAwayImg} className="w-8 h-8" alt="" />}
                            </div>

                            <div className="text-sm text-gray-400 mb-1">{formatIST(selectedMatch.startTime)}</div>
                            <div className="flex gap-2 text-xs mb-6">
                                <span className={`px-2 py-1 rounded ${statusColors[selectedMatch.status]}`}>{selectedMatch.status}</span>
                                {selectedMatch.matchStarted && <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">Started</span>}
                                {selectedMatch.matchEnded && <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">Ended</span>}
                                {selectedMatch.scorecardSynced && <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">Scorecard ✓</span>}
                            </div>

                            {/* Message */}
                            {message && (
                                <div className="mb-4 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm">
                                    {message}
                                </div>
                            )}

                            {/* Quick actions */}
                            <div className="mb-8">
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Actions</h3>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => syncAction('sync-squad')} disabled={!!actionLoading}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium transition">
                                        {actionLoading === 'sync-squad' ? '...' : '📋 Sync Squad'}
                                    </button>
                                    <button onClick={() => syncAction('sync-toss')} disabled={!!actionLoading}
                                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-sm font-medium transition">
                                        {actionLoading === 'sync-toss' ? '...' : '🪙 Sync Toss'}
                                    </button>
                                    <button onClick={() => syncAction('sync-scorecard')} disabled={!!actionLoading}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg text-sm font-medium transition">
                                        {actionLoading === 'sync-scorecard' ? '...' : '📊 Sync Scorecard'}
                                    </button>
                                    <button onClick={() => syncAction('declare-results')} disabled={!!actionLoading}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-lg text-sm font-medium transition">
                                        {actionLoading === 'declare-results' ? '...' : '🏆 Declare Results'}
                                    </button>
                                </div>
                            </div>

                            {/* Playing XI selection */}
                            {(selectedMatch.squadHome?.length > 0 || selectedMatch.squadAway?.length > 0) && (
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-gray-300">Playing XI</h3>
                                        <button onClick={savePlayingXI} disabled={!!actionLoading}
                                            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg text-xs font-medium transition">
                                            {actionLoading === 'xi' ? 'Saving...' : `Save XI (${selectedHome.size} + ${selectedAway.size})`}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Home team */}
                                        <div>
                                            <div className="text-xs text-gray-500 mb-2 font-medium">{selectedMatch.teamHome} ({selectedHome.size}/11)</div>
                                            <div className="flex flex-col gap-1">
                                                {(selectedMatch.squadHome || []).map(p => (
                                                    <button
                                                        key={p.playerId}
                                                        onClick={() => togglePlayer(selectedHome, setSelectedHome, p.playerId)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                                                            selectedHome.has(p.playerId)
                                                                ? 'bg-green-500/20 border border-green-500/40 text-white'
                                                                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'
                                                        }`}
                                                    >
                                                        <span className="truncate">{p.playerName}</span>
                                                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">{p.role}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Away team */}
                                        <div>
                                            <div className="text-xs text-gray-500 mb-2 font-medium">{selectedMatch.teamAway} ({selectedAway.size}/11)</div>
                                            <div className="flex flex-col gap-1">
                                                {(selectedMatch.squadAway || []).map(p => (
                                                    <button
                                                        key={p.playerId}
                                                        onClick={() => togglePlayer(selectedAway, setSelectedAway, p.playerId)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                                                            selectedAway.has(p.playerId)
                                                                ? 'bg-green-500/20 border border-green-500/40 text-white'
                                                                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'
                                                        }`}
                                                    >
                                                        <span className="truncate">{p.playerName}</span>
                                                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">{p.role}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Impact player selection */}
                            {(selectedMatch.squadHome?.length > 0 || selectedMatch.squadAway?.length > 0) && (
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-gray-300">Impact Players</h3>
                                        <button onClick={saveImpact} disabled={!!actionLoading}
                                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-xs font-medium transition">
                                            {actionLoading === 'impact' ? 'Saving...' : `Save Impact (${impactHome.size} + ${impactAway.size})`}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-gray-500 mb-2 font-medium">{selectedMatch.teamHome}</div>
                                            <div className="flex flex-col gap-1">
                                                {(selectedMatch.squadHome || []).map(p => (
                                                    <button
                                                        key={p.playerId}
                                                        onClick={() => togglePlayer(impactHome, setImpactHome, p.playerId)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                                                            impactHome.has(p.playerId)
                                                                ? 'bg-purple-500/20 border border-purple-500/40 text-white'
                                                                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'
                                                        }`}
                                                    >
                                                        <span className="truncate">{p.playerName}</span>
                                                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">{p.role}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 mb-2 font-medium">{selectedMatch.teamAway}</div>
                                            <div className="flex flex-col gap-1">
                                                {(selectedMatch.squadAway || []).map(p => (
                                                    <button
                                                        key={p.playerId}
                                                        onClick={() => togglePlayer(impactAway, setImpactAway, p.playerId)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                                                            impactAway.has(p.playerId)
                                                                ? 'bg-purple-500/20 border border-purple-500/40 text-white'
                                                                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'
                                                        }`}
                                                    >
                                                        <span className="truncate">{p.playerName}</span>
                                                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">{p.role}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Manual Scorecard Editor */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-300">📊 Scorecard Editor</h3>
                                    <button onClick={saveScorecard} disabled={!!actionLoading}
                                        className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg text-xs font-medium transition">
                                        {actionLoading === 'scorecard' ? 'Saving...' : 'Save Scorecard'}
                                    </button>
                                </div>

                                {/* Batting */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400 font-medium">Batting ({battingStats.length})</span>
                                        <button onClick={addBattingRow} className="text-[10px] text-blue-400 hover:text-blue-300">+ Add row</button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-gray-500 border-b border-gray-800">
                                                    <th className="text-left py-1 pr-2">Player</th>
                                                    <th className="py-1 px-1 w-16">Runs</th>
                                                    <th className="py-1 w-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {battingStats.map((s, i) => (
                                                    <tr key={i} className="border-b border-gray-800/50">
                                                        <td className="py-1 pr-2">
                                                            <input value={s.playerName} onChange={e => updateBatting(i, 'playerName', e.target.value)}
                                                                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-full text-white text-xs" placeholder="Name" />
                                                        </td>
                                                        <td className="py-1 px-1">
                                                            <input type="number" value={s.runs} onChange={e => updateBatting(i, 'runs', e.target.value)}
                                                                className="bg-gray-900 border border-gray-700 rounded px-1 py-1 w-full text-center text-white text-xs" />
                                                        </td>
                                                        <td className="py-1">
                                                            <button onClick={() => removeBattingRow(i)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Bowling */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400 font-medium">Bowling ({bowlingStats.length})</span>
                                        <button onClick={addBowlingRow} className="text-[10px] text-blue-400 hover:text-blue-300">+ Add row</button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-gray-500 border-b border-gray-800">
                                                    <th className="text-left py-1 pr-2">Player</th>
                                                    <th className="py-1 px-1 w-16">Wickets</th>
                                                    <th className="py-1 w-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bowlingStats.map((s, i) => (
                                                    <tr key={i} className="border-b border-gray-800/50">
                                                        <td className="py-1 pr-2">
                                                            <input value={s.playerName} onChange={e => updateBowling(i, 'playerName', e.target.value)}
                                                                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-full text-white text-xs" placeholder="Name" />
                                                        </td>
                                                        <td className="py-1 px-1">
                                                            <input type="number" value={s.wickets} onChange={e => updateBowling(i, 'wickets', e.target.value)}
                                                                className="bg-gray-900 border border-gray-700 rounded px-1 py-1 w-full text-center text-white text-xs" />
                                                        </td>
                                                        <td className="py-1">
                                                            <button onClick={() => removeBowlingRow(i)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* No squad message */}
                            {!selectedMatch.squadHome?.length && !selectedMatch.squadAway?.length && (
                                <div className="text-gray-500 text-sm text-center py-8 bg-gray-900 rounded-xl">
                                    No squad data — click "Sync Squad" first
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
