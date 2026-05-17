import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isLoggedIn, removeToken } from '../utils/auth'
import api from '../utils/api'

// Inside the component, add:
interface Match {
    _id: string
    teamHome: string
    teamAway: string
    startTime: string
    status: string
    isDailyChallenge: boolean
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [matchedRooms, setMatchedRooms] = useState<any[]>([])
    const [waitingRooms, setWaitingRooms] = useState<any[]>([])
    const [currentUserId, setCurrentUserId] = useState('')
    const [user, setUser] = useState<any>(null)
    const [showProfile, setShowProfile] = useState(false)




    const fetchUser = async () => {
        try {
            const res = await api.get('/auth/me')
            setUser(res.data)
        } catch (err) {
            console.error(err)
        }
    }

    const fetchMatches = async () => {
        try {
            const res = await api.get('/matches')
            setMatches(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchPendingRooms = async () => {
        try {
            const res = await api.get('/rooms/my-pending')
            setMatchedRooms(res.data.matched)
            setWaitingRooms(res.data.waiting)
            setCurrentUserId(res.data.currentUserId)
        } catch (err) {
            console.error(err)
        }
    }

    const getOpponent = (room: any) => {
        if (room.player1Id._id === currentUserId) return room.player2Id.username
        return room.player1Id.username
    }

    useEffect(() => {
        if (!isLoggedIn()) { navigate('/login'); return }
        fetchUser()
        fetchMatches()
        fetchPendingRooms()
    }, [])

    const handleLogout = () => {
        removeToken()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h1 className="text-xl font-bold shrink-0">🏏 Cricked</h1>
                <div className="relative">
                    <button
                        onClick={() => setShowProfile(!showProfile)}
                        className="flex items-center gap-2.5 bg-gray-900 hover:bg-gray-800 rounded-full pl-3 pr-4 py-1.5 transition"
                    >
                        <div className="shrink-0" style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden' }}>
                            <img
                                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${user?.username || 'default'}`}
                                alt="avatar"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <span className="text-sm text-gray-300 max-w-[120px] truncate">
                            {user?.displayName || user?.username || '...'}
                        </span>
                    </button>

                    {showProfile && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                            <div className="absolute right-0 top-14 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl" style={{ width: '280px' }}>
                                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#374151' }}>
                                        <img
                                            src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${user?.username || 'default'}`}
                                            alt="avatar"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', wordBreak: 'break-word' }}>
                                            {user?.displayName || user?.username}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', wordBreak: 'break-all' }}>
                                            {user?.email}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                            @{user?.username}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #374151', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '12px 16px', textAlign: 'center', gap: '8px' }}>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{user?.matchesPlayed || 0}</div>
                                        <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matches</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{user?.wins || 0}</div>
                                        <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wins</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{user?.losses || 0}</div>
                                        <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Losses</div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #374151' }}>
                                    <button
                                        onClick={handleLogout}
                                        style={{ width: '100%', fontSize: '14px', color: '#f87171', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="w-full max-w-lg mx-auto px-6 py-8">

                {matchedRooms.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-3">
                            🎯 Matched Rooms
                        </h2>
                        <div className="flex flex-col gap-3">
                            {matchedRooms.map(room => (
                                <div
                                    key={room._id}
                                    className="bg-green-500/10 border border-green-500/30 rounded-xl p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium text-sm">
                                                {room.matchId.teamHome} vs {room.matchId.teamAway}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                vs <span className="text-white font-medium">{getOpponent(room)}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/room/${room._id}/details`)}
                                                className="bg-gray-800 text-white text-sm font-semibold px-3 py-2 rounded-lg"
                                            >
                                                Details
                                            </button>
                                            <button
                                                onClick={() => navigate(`/room/${room._id}/predraft`)}
                                                className="bg-green-500 text-black text-sm font-semibold px-3 py-2 rounded-lg"
                                            >
                                                Draft →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {waitingRooms.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-3">
                            ⏳ Waiting Rooms
                        </h2>
                        <div className="flex flex-col gap-3">
                            {waitingRooms.map(room => (
                                <div
                                    key={room._id}
                                    className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium text-sm">
                                                {room.matchId.teamHome} vs {room.matchId.teamAway}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {room.roomType === 'random' ? 'In random queue' : 'Waiting for opponent'}
                                            </div>
                                            {room.roomType !== 'random' && (
                                                <div className="text-xs text-yellow-400 font-mono mt-1">
                                                    Code: {room.inviteCode}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => navigate(`/room/${room._id}/predraft`)}
                                            className="bg-yellow-500 text-black text-sm font-semibold px-3 py-2 rounded-lg"
                                        >
                                            Edit Draft
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <h2 className="text-lg font-semibold mb-4">Upcoming Matches</h2>

                {loading && (
                    <p className="text-gray-500 text-sm">Loading matches...</p>
                )}

                {!loading && matches.length === 0 && (
                    <p className="text-gray-500 text-sm">No upcoming matches.</p>
                )}

                <div className="flex flex-col gap-3">
                    {matches.map((match) => (
                        <div
                            key={match._id}
                            className="bg-gray-900 rounded-xl p-4 flex items-center justify-between"
                        >
                            <div>
                                <div className="font-semibold">
                                    {match.teamHome} vs {match.teamAway}
                                </div>
                                <div className="text-sm text-gray-400 mt-1">
                                    {new Date(match.startTime).toLocaleString()}
                                </div>
                                {match.isDailyChallenge && (
                                    <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full mt-1 inline-block">
                    Daily Challenge
                  </span>
                                )}
                            </div>
                            <button onClick={() => navigate(`/play/${match._id}`)} className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition">
                                Play
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}