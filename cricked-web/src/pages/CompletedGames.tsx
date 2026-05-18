import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth'
import api from '../utils/api'

const formatIST = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    }) + ' IST'
}

interface Room {
    _id: string
    matchId: {
        _id: string
        teamHome: string
        teamAway: string
        startTime: string
        teamHomeImg?: string
        teamAwayImg?: string
    }
    player1Id: { _id: string; username: string; displayName: string }
    player2Id: { _id: string; username: string; displayName: string }
    status: string
    updatedAt: string
}

interface Pick {
    userId: string
    playerName: string
    team: string
    pickType: string
    pickNumber: number
    isAutoPick: boolean
    isVoid: boolean
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
    batsman: { label: 'BAT', color: 'bg-blue-500/10 text-blue-400' },
    bowler: { label: 'BOWL', color: 'bg-purple-500/10 text-purple-400' },
    allrounder: { label: 'AR', color: 'bg-amber-500/10 text-amber-400' }
}

export default function CompletedGames() {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState('')
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
    const [roomPicks, setRoomPicks] = useState<Record<string, Pick[]>>({})

    useEffect(() => {
        if (!isLoggedIn()) { navigate('/login'); return }
        const fetch = async () => {
            try {
                const [roomsRes, meRes] = await Promise.all([
                    api.get('/rooms/my-completed'),
                    api.get('/auth/me')
                ])
                setRooms(roomsRes.data)
                setCurrentUserId(meRes.data._id)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [])

    const getOpponent = (room: Room) => {
        if (room.player1Id._id === currentUserId) return room.player2Id
        return room.player1Id
    }

    const toggleExpand = async (roomId: string) => {
        if (expandedRoom === roomId) {
            setExpandedRoom(null)
            return
        }
        setExpandedRoom(roomId)
        if (!roomPicks[roomId]) {
            try {
                const res = await api.get(`/rooms/${roomId}/picks`)
                setRoomPicks(prev => ({ ...prev, [roomId]: res.data }))
            } catch (err) {
                console.error(err)
            }
        }
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition text-sm">
                        ← Back
                    </button>
                    <h1 className="text-lg font-bold">✅ Completed Games</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/live')}
                        className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                    >
                        Live Games
                    </button>
                </div>
            </div>

            <div className="w-full max-w-2xl mx-auto px-6 py-8">
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 rounded-full border-t-2 border-green-500 animate-spin" />
                    </div>
                )}

                {!loading && rooms.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4">📋</div>
                        <h2 className="text-xl font-bold text-gray-400 mb-2">No Completed Games</h2>
                        <p className="text-gray-600 text-sm">Finished drafts will appear here</p>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {rooms.map(room => {
                        const opp = getOpponent(room)
                        const match = room.matchId
                        const isExpanded = expandedRoom === room._id
                        const picks = roomPicks[room._id] || []
                        const myPicks = picks.filter(p => p.userId === currentUserId && !p.isVoid)
                        const oppPicks = picks.filter(p => p.userId !== currentUserId && !p.isVoid)

                        return (
                            <div
                                key={room._id}
                                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
                            >
                                {/* Match header */}
                                <button
                                    onClick={() => toggleExpand(room._id)}
                                    className="w-full text-left"
                                >
                                    <div className="bg-gray-800/30 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                                            <span className="text-sm font-semibold text-white">
                                                {match.teamHome} vs {match.teamAway}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-500">
                                            {formatIST(match.startTime)}
                                        </span>
                                    </div>

                                    <div className="px-5 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                                                <img
                                                    src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${opp.username}`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">
                                                    vs {opp.displayName || opp.username}
                                                </div>
                                                <div className="text-[11px] text-gray-500">
                                                    @{opp.username}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">
                                                Completed
                                            </span>
                                            <span className="text-gray-500 text-sm">
                                                {isExpanded ? '▲' : '▼'}
                                            </span>
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded picks */}
                                {isExpanded && (
                                    <div className="border-t border-gray-800 px-5 py-4">
                                        {picks.length === 0 ? (
                                            <div className="flex items-center justify-center py-6">
                                                <div className="w-6 h-6 rounded-full border-t-2 border-gray-500 animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Your Squad */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                                        <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">
                                                            Your Squad
                                                        </h4>
                                                        <span className="text-[10px] text-gray-600 ml-auto">
                                                            {myPicks.length} picks
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        {myPicks.map(pick => (
                                                            <div
                                                                key={pick.pickNumber}
                                                                className="flex items-center gap-2 bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2"
                                                            >
                                                                <span className="text-[10px] text-gray-500 font-mono w-4">
                                                                    #{pick.pickNumber}
                                                                </span>
                                                                <span className="text-xs text-white flex-1 truncate">
                                                                    {pick.playerName}
                                                                </span>
                                                                <span className="text-[9px] text-gray-500 shrink-0">
                                                                    {pick.team}
                                                                </span>
                                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                                    ROLE_BADGE[pick.pickType]?.color || 'bg-gray-700 text-gray-400'
                                                                }`}>
                                                                    {ROLE_BADGE[pick.pickType]?.label || pick.pickType}
                                                                </span>
                                                                {pick.isAutoPick && (
                                                                    <span className="text-yellow-400 text-[10px]" title="Auto-picked">⚡</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Opponent Squad */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                                                            {opp.displayName || opp.username}
                                                        </h4>
                                                        <span className="text-[10px] text-gray-600 ml-auto">
                                                            {oppPicks.length} picks
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        {oppPicks.map(pick => (
                                                            <div
                                                                key={pick.pickNumber}
                                                                className="flex items-center gap-2 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2"
                                                            >
                                                                <span className="text-[10px] text-gray-500 font-mono w-4">
                                                                    #{pick.pickNumber}
                                                                </span>
                                                                <span className="text-xs text-white flex-1 truncate">
                                                                    {pick.playerName}
                                                                </span>
                                                                <span className="text-[9px] text-gray-500 shrink-0">
                                                                    {pick.team}
                                                                </span>
                                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                                    ROLE_BADGE[pick.pickType]?.color || 'bg-gray-700 text-gray-400'
                                                                }`}>
                                                                    {ROLE_BADGE[pick.pickType]?.label || pick.pickType}
                                                                </span>
                                                                {pick.isAutoPick && (
                                                                    <span className="text-yellow-400 text-[10px]" title="Auto-picked">⚡</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
