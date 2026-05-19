import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isLoggedIn, removeToken } from '../utils/auth'
import api from '../utils/api'

const formatIST = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    }) + ' IST'
}

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
    const [draftingRooms, setDraftingRooms] = useState<any[]>([])
    const [completedRooms, setCompletedRooms] = useState<any[]>([])
    const [liveRooms, setLiveRooms] = useState<any[]>([])
    const [currentUserId, setCurrentUserId] = useState('')
    const [user, setUser] = useState<any>(null)
    const [showProfile, setShowProfile] = useState(false)
    const [activeTab, setActiveTab] = useState<'home' | 'live' | 'completed'>('home')




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
            const [pendingRes, liveRes, completedRes] = await Promise.all([
                api.get('/rooms/my-pending'),
                api.get('/rooms/my-live'),
                api.get('/rooms/my-completed')
            ])
            setMatchedRooms(pendingRes.data.matched)
            setWaitingRooms(pendingRes.data.waiting)
            setDraftingRooms(pendingRes.data.drafting || [])
            setCurrentUserId(pendingRes.data.currentUserId)
            setLiveRooms(liveRes.data)
            setCompletedRooms(completedRes.data)
        } catch (err) {
            console.error(err)
        }
    }

    const getOpponent = (room: any) => {
        if (!room.player1Id || !room.player2Id) return 'Unknown'
        if (room.player1Id._id === currentUserId) return room.player2Id.username
        return room.player1Id.username
    }

    useEffect(() => {
        if (!isLoggedIn()) { navigate('/login'); return }
        fetchUser()
        fetchMatches()
        fetchPendingRooms()

        // Poll every 30s for active drafts
        const interval = setInterval(fetchPendingRooms, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleLogout = () => {
        removeToken()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-bold shrink-0">🏏 Cricked</h1>
                    <nav className="flex items-center">
                        {[
                            { key: 'home' as const, label: 'Home', icon: '🏠' },
                            { key: 'live' as const, label: 'Live', icon: '🔴', count: liveRooms.length },
                            { key: 'completed' as const, label: 'Completed', icon: '✅' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`relative px-4 py-2 text-sm font-medium transition-all ${
                                    activeTab === tab.key
                                        ? 'text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="text-xs">{tab.icon}</span>
                                    {tab.label}
                                    {tab.count ? (
                                        <span className="ml-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                                            {tab.count}
                                        </span>
                                    ) : null}
                                </span>
                                {activeTab === tab.key && (
                                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
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
            <div className="w-full max-w-2xl mx-auto px-6 py-8">

                {/* ===== HOME TAB ===== */}
                {activeTab === 'home' && (
                    <>
                        {draftingRooms.length > 0 && (
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold mb-3">🔴 Live Drafts</h2>
                                <div className="flex flex-col gap-3">
                                    {draftingRooms.map(room => (
                                        <div key={room._id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{room.matchId.teamHome} vs {room.matchId.teamAway}</div>
                                                    <div className="text-xs text-gray-400 mt-1">vs <span className="text-white font-medium">{getOpponent(room)}</span></div>
                                                    <div className="text-xs text-red-400 mt-1 font-semibold">🔴 Draft in progress!</div>
                                                </div>
                                                <button onClick={() => navigate(`/room/${room._id}/draft`)} className="bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">Join Draft →</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {matchedRooms.length > 0 && (
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold mb-3">📋 Pre-Draft</h2>
                                <div className="flex flex-col gap-3">
                                    {matchedRooms.map(room => (
                                        <div key={room._id} className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{room.matchId.teamHome} vs {room.matchId.teamAway}</div>
                                                    <div className="text-xs text-gray-400 mt-1">vs <span className="text-white font-medium">{getOpponent(room)}</span></div>
                                                    <div className="text-xs text-blue-400 mt-1">⏳ Waiting for toss — set your draft rankings</div>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => navigate(`/room/${room._id}/details`)} className="bg-gray-800 text-white text-sm font-semibold px-3 py-2 rounded-lg">Details</button>
                                                    <button onClick={() => navigate(`/room/${room._id}/predraft`)} className="bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-lg">Edit Draft</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {waitingRooms.length > 0 && (
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold mb-3">⏳ Waiting Rooms</h2>
                                <div className="flex flex-col gap-3">
                                    {waitingRooms.map(room => (
                                        <div key={room._id} className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-sm">{room.matchId.teamHome} vs {room.matchId.teamAway}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{room.roomType === 'random' ? 'In random queue' : 'Waiting for opponent'}</div>
                                                    {room.roomType !== 'random' && (
                                                        <div className="text-xs text-yellow-400 font-mono mt-1">Code: {room.inviteCode}</div>
                                                    )}
                                                </div>
                                                <button onClick={() => navigate(`/room/${room._id}/predraft`)} className="bg-yellow-500 text-black text-sm font-semibold px-3 py-2 rounded-lg">Edit Draft</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Draft Flow Timeline */}
                        <div className="mb-6 bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                How the Draft Works
                            </h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-3 items-start">
                                    <div className="flex flex-col items-center">
                                        <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-[10px] text-green-400 font-bold shrink-0">1</div>
                                        <div className="w-px h-full bg-gray-700 mt-1" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-green-400">Toss → T-15 min</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Join after toss. Draft starts when both players are ready.</div>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <div className="flex flex-col items-center">
                                        <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-[10px] text-yellow-400 font-bold shrink-0">2</div>
                                        <div className="w-px h-full bg-gray-700 mt-1" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-yellow-400">T-15 min → T-5 min</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Draft keeps going. Auto-pick covers you if your opponent goes offline.</div>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <div className="flex flex-col items-center">
                                        <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-[10px] text-red-400 font-bold shrink-0">3</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-red-400">T-5 min → Match Start</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">Draft locks. Any unpicked slots are auto-filled from your pre-draft list.</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-[10px] text-gray-600 text-center">
                                T = Match start time
                            </div>
                        </div>

                        <h2 className="text-lg font-semibold mb-4">Upcoming Matches</h2>
                        {loading && <p className="text-gray-500 text-sm">Loading matches...</p>}
                        {!loading && matches.length === 0 && <p className="text-gray-500 text-sm">No upcoming matches.</p>}
                        <div className="flex flex-col gap-3">
                            {matches.map((match) => {
                                const locked = new Date(match.startTime).getTime() - Date.now() <= 5 * 60 * 1000
                                return (
                                <div key={match._id} className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold">{match.teamHome} vs {match.teamAway}</div>
                                        <div className="text-sm text-gray-400 mt-1">{formatIST(match.startTime)}</div>
                                        {match.isDailyChallenge && (
                                            <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full mt-1 inline-block">Daily Challenge</span>
                                        )}
                                    </div>
                                    {locked ? (
                                        <span className="text-xs text-red-400 font-semibold px-3 py-2">🔒 Locked</span>
                                    ) : (
                                        <button onClick={() => navigate(`/play/${match._id}`)} className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition">Play</button>
                                    )}
                                </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* ===== LIVE TAB ===== */}
                {activeTab === 'live' && (() => {
                    const drafting = liveRooms.filter(r => r.status === 'drafting')
                    const picked = liveRooms.filter(r => r.status === 'completed')
                    return (
                    <>
                        {liveRooms.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-5xl mb-4">🏏</div>
                                <h2 className="text-xl font-bold text-gray-400 mb-2">No Live Games</h2>
                                <p className="text-gray-600 text-sm">Your active games will appear here after toss</p>
                            </div>
                        ) : (
                            <>
                                {drafting.length > 0 && (
                                    <div className="mb-6">
                                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                            </span>
                                            Active Drafts
                                        </h2>
                                        <div className="flex flex-col gap-3">
                                            {drafting.map(room => (
                                                <div key={room._id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-red-500/30 transition">
                                                    <div className="bg-red-500/5 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-white">{room.matchId.teamHome} vs {room.matchId.teamAway}</span>
                                                        <span className="text-[10px] text-gray-500">{formatIST(room.matchId.startTime)}</span>
                                                    </div>
                                                    <div className="px-5 py-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${getOpponent(room)}`} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-white">vs {getOpponent(room)}</div>
                                                                <div className="text-[10px] text-yellow-400 mt-0.5">Draft in progress</div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => navigate(`/room/${room._id}/draft`)} className="bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-lg shadow-red-500/20">Join Draft →</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {picked.length > 0 && (
                                    <div className="mb-6">
                                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                            Match Live
                                        </h2>
                                        <div className="flex flex-col gap-3">
                                            {picked.map(room => {
                                                const myScore = room.player1Id._id === currentUserId ? room.player1Score : room.player2Score
                                                const oppScore = room.player1Id._id === currentUserId ? room.player2Score : room.player1Score
                                                const leading = myScore > oppScore ? 'text-green-400' : myScore < oppScore ? 'text-red-400' : 'text-yellow-400'
                                                return (
                                                <div key={room._id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-green-500/30 transition">
                                                    <div className="bg-green-500/5 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-white">{room.matchId.teamHome} vs {room.matchId.teamAway}</span>
                                                        <span className="text-[10px] text-gray-500">{formatIST(room.matchId.startTime)}</span>
                                                    </div>
                                                    <div className="px-5 py-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${getOpponent(room)}`} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-white">vs {getOpponent(room)}</div>
                                                                <div className="text-[10px] text-green-400 mt-0.5">Picks locked · Live now 🔴</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <div className={`text-lg font-bold ${leading}`}>{myScore} <span className="text-gray-600">-</span> {oppScore}</div>
                                                                <div className="text-[9px] text-gray-500 uppercase tracking-wide">pts</div>
                                                            </div>
                                                            <button onClick={() => navigate(`/room/${room._id}/result`)} className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-lg shadow-green-500/20">Scorecard</button>
                                                        </div>
                                                    </div>
                                                </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                    )
                })()}

                {/* ===== COMPLETED TAB ===== */}
                {activeTab === 'completed' && (
                    <>
                        {completedRooms.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-5xl mb-4">📋</div>
                                <h2 className="text-xl font-bold text-gray-400 mb-2">No Completed Games</h2>
                                <p className="text-gray-600 text-sm">Finished drafts will appear here</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {completedRooms.filter(r => r.matchId && r.player1Id && r.player2Id).map(room => (
                                    <div key={room._id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                                        <div className="bg-gray-800/30 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                                                <span className="text-sm font-semibold text-white">{room.matchId.teamHome} vs {room.matchId.teamAway}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500">
                                                {formatIST(room.matchId.startTime)}
                                            </span>
                                        </div>
                                        <div className="px-5 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                                                    <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${getOpponent(room)}`} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">vs {getOpponent(room)}</div>
                                                    {room.resultDeclared ? (
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {room.isDraw ? (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold">DRAW</span>
                                                            ) : room.winnerId?._id === currentUserId ? (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">WON</span>
                                                            ) : (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">LOST</span>
                                                            )}
                                                            <span className="text-[10px] text-gray-500">
                                                                {room.player1Id._id === currentUserId
                                                                    ? `${room.player1Score} - ${room.player2Score}`
                                                                    : `${room.player2Score} - ${room.player1Score}`
                                                                }
                                                            </span>
                                                        </div>
                                                    ) : room.matchId.matchStatusText ? (
                                                        <div className="text-[10px] text-gray-500 mt-0.5">{room.matchId.matchStatusText}</div>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <button onClick={() => navigate(`/room/${room._id}/result`)} className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">View Result</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}