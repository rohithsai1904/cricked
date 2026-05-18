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
}

export default function LiveGames() {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState('')

    const fetchLive = async () => {
        try {
            const [liveRes, meRes] = await Promise.all([
                api.get('/rooms/my-live'),
                api.get('/auth/me')
            ])
            setRooms(liveRes.data)
            setCurrentUserId(meRes.data._id)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!isLoggedIn()) { navigate('/login'); return }
        fetchLive()
        const interval = setInterval(fetchLive, 15000)
        return () => clearInterval(interval)
    }, [])

    const getOpponent = (room: Room) => {
        if (room.player1Id._id === currentUserId) return room.player2Id
        return room.player1Id
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition text-sm">
                        ← Back
                    </button>
                    <h1 className="text-lg font-bold">🔴 Live Games</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/completed')}
                        className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                    >
                        Completed
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
                        <div className="text-5xl mb-4">🏏</div>
                        <h2 className="text-xl font-bold text-gray-400 mb-2">No Live Games</h2>
                        <p className="text-gray-600 text-sm">Your active drafts will appear here</p>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {rooms.map(room => {
                        const opp = getOpponent(room)
                        const match = room.matchId
                        return (
                            <div
                                key={room._id}
                                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-red-500/30 transition"
                            >
                                {/* Match header */}
                                <div className="bg-red-500/5 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                        </span>
                                        <span className="text-sm font-semibold text-white">
                                            {match.teamHome} vs {match.teamAway}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-gray-500">
                                        {formatIST(match.startTime)}
                                    </span>
                                </div>

                                {/* Body */}
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
                                    <button
                                        onClick={() => navigate(`/room/${room._id}/draft`)}
                                        className="bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-lg shadow-red-500/20"
                                    >
                                        Join Draft →
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
