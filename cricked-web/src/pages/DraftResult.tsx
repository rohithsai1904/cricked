import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../utils/api'

interface PickStats {
    runs: number
    wickets: number
    balls: number
    sr: number
    overs: number
    eco: number
}

interface EnrichedPick {
    _id: string
    userId: string
    playerName: string
    team: string
    pickType: string
    pickNumber: number
    roundNumber: number
    isAutoPick: boolean
    isVoid: boolean
    points: number
    breakdown: string[]
    stats: PickStats
}

interface Player {
    _id: string
    username: string
    displayName?: string
}

interface ResultData {
    room: {
        _id: string
        status: string
        player1: Player
        player2: Player
    }
    match: {
        teamHome: string
        teamAway: string
        startTime: string
        matchStatusText: string
        matchWinner: string
        matchEnded: boolean
        scorecardSynced: boolean
    }
    picks: EnrichedPick[]
    scores: Record<string, number>
}

const formatIST = (d: string) =>
    new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' IST'

const typeLabels: Record<string, string> = {
    batsman: '🏏 Batsmen',
    bowler: '🎳 Bowlers',
    allrounder: '⭐ All-rounders'
}

export default function DraftResult() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState<ResultData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get(`/rooms/${roomId}/results`)
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.error || 'Failed to load results'))
            .finally(() => setLoading(false))
    }, [roomId])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="text-gray-400">Loading results...</div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={() => navigate('/')} className="bg-gray-800 text-white px-4 py-2 rounded-lg">Back</button>
                </div>
            </div>
        )
    }

    const { room, match, picks, scores } = data
    const p1 = room.player1
    const p2 = room.player2
    const p1Score = scores[p1._id] || 0
    const p2Score = scores[p2._id] || 0
    const winner = p1Score > p2Score ? p1 : p2Score > p1Score ? p2 : null

    const p1Picks = picks.filter(p => p.userId === p1._id)
    const p2Picks = picks.filter(p => p.userId === p2._id)

    const renderPickRow = (pick: EnrichedPick, isMe: boolean) => (
        <div key={pick._id} className={`flex items-center justify-between py-2 px-3 rounded-lg ${isMe ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{pick.playerName}</span>
                    {pick.isVoid && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">VOID</span>}
                    {pick.isAutoPick && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">AUTO</span>}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                    {pick.team} · {pick.breakdown.join(' | ')}
                </div>
            </div>
            <div className="text-right shrink-0 ml-3">
                <div className={`text-sm font-bold ${pick.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>{pick.points}</div>
                <div className="text-[10px] text-gray-600">pts</div>
            </div>
        </div>
    )

    const renderSection = (type: string, p1TypePicks: EnrichedPick[], p2TypePicks: EnrichedPick[]) => {
        const p1TypeTotal = p1TypePicks.reduce((s, p) => s + p.points, 0)
        const p2TypeTotal = p2TypePicks.reduce((s, p) => s + p.points, 0)

        return (
            <div key={type} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-300">{typeLabels[type] || type}</h3>
                    <div className="flex gap-4 text-xs">
                        <span className="text-blue-400">{p1TypeTotal} pts</span>
                        <span className="text-red-400">{p2TypeTotal} pts</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                        {p1TypePicks.map(p => renderPickRow(p, true))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {p2TypePicks.map(p => renderPickRow(p, false))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
                <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="flex-1 text-center">
                    <div className="text-sm font-semibold">{match.teamHome} vs {match.teamAway}</div>
                    <div className="text-[10px] text-gray-500">{formatIST(match.startTime)}</div>
                </div>
            </div>

            {/* Match status */}
            {match.matchStatusText && (
                <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-center">
                    <span className="text-xs text-gray-400">{match.matchStatusText}</span>
                </div>
            )}

            {/* Scorecard sync status */}
            {!match.scorecardSynced && (
                <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-center">
                    <span className="text-xs text-yellow-400">⏳ Scorecard not synced yet — points will update after match</span>
                </div>
            )}

            {/* Score comparison */}
            <div className="px-4 py-5">
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="text-center flex-1">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 mx-auto flex items-center justify-center mb-2 overflow-hidden">
                                <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${p1.username}`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-xs text-gray-400 truncate">{p1.displayName || p1.username}</div>
                            <div className={`text-3xl font-black mt-1 ${p1Score >= p2Score ? 'text-green-400' : 'text-white'}`}>{p1Score}</div>
                        </div>

                        <div className="px-4 flex flex-col items-center">
                            {winner ? (
                                <div className="text-2xl">🏆</div>
                            ) : (
                                <div className="text-lg text-gray-600">vs</div>
                            )}
                            <div className="text-[10px] text-gray-600 mt-1">
                                {match.matchEnded ? 'FINAL' : 'LIVE'}
                            </div>
                        </div>

                        <div className="text-center flex-1">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 mx-auto flex items-center justify-center mb-2 overflow-hidden">
                                <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${p2.username}`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-xs text-gray-400 truncate">{p2.displayName || p2.username}</div>
                            <div className={`text-3xl font-black mt-1 ${p2Score >= p1Score ? 'text-green-400' : 'text-white'}`}>{p2Score}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Player names legend */}
            <div className="px-4 pb-2 flex justify-between text-xs">
                <span className="text-blue-400 font-medium">{p1.displayName || p1.username}</span>
                <span className="text-red-400 font-medium">{p2.displayName || p2.username}</span>
            </div>

            {/* Picks by type */}
            <div className="px-4 pb-8">
                {['batsman', 'bowler', 'allrounder'].map(type =>
                    renderSection(
                        type,
                        p1Picks.filter(p => p.pickType === type),
                        p2Picks.filter(p => p.pickType === type)
                    )
                )}
            </div>
        </div>
    )
}
