import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'

interface PreDraftEntry {
    playerName: string
    squadPlayerId: string
    rankOrder: number
    pickType: string
}

export default function RoomDetails() {
    const { roomId } = useParams()
    const navigate = useNavigate()

    const [room, setRoom] = useState<any>(null)
    const [predraft, setPredraft] = useState<{
        batsmen: PreDraftEntry[]
        bowlers: PreDraftEntry[]
        allrounders: PreDraftEntry[]
    }>({ batsmen: [], bowlers: [], allrounders: [] })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDetails()
    }, [])

    const fetchDetails = async () => {
        try {
            const [roomRes, predraftRes] = await Promise.all([
                api.get(`/rooms/${roomId}`),
                api.get(`/rooms/${roomId}/predraft`)
            ])
            setRoom(roomRes.data)
            setPredraft(predraftRes.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <p className="text-gray-400">Loading...</p>
        </div>
    )

    if (!room) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <p className="text-gray-400">Room not found</p>
        </div>
    )

    const opponent =
        room.player1Id?.username && room.player2Id?.username
            ? room.player1Id._id === room.player2Id._id
                ? room.player1Id.username
                : room.player1Id.username // will figure out which is opponent below
            : 'Waiting...'

    const getOpponentName = () => {
        if (!room.player1Id || !room.player2Id) return 'Waiting...'
        // The GET /rooms/:id populates both players, we need to know who "we" are
        // We'll show both and highlight opponent
        return `${room.player1Id.username} vs ${room.player2Id.username}`
    }

    const renderList = (title: string, entries: PreDraftEntry[]) => {
        if (entries.length === 0) return null
        return (
            <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {title}
                </h3>
                <div className="flex flex-col gap-1">
                    {entries.map((entry, i) => (
                        <div
                            key={entry.squadPlayerId || i}
                            className="flex items-center gap-3 bg-gray-900 px-3 py-2 rounded-lg"
                        >
                            <span className="text-green-400 font-bold text-sm w-6">
                                {i + 1}
                            </span>
                            <span className="text-sm">{entry.playerName}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-800">
                <button
                    onClick={() => navigate('/')}
                    className="text-gray-400 text-sm hover:text-white transition mb-2"
                >
                    ← Back
                </button>
                <div className="font-semibold">
                    {room.matchId?.teamHome} vs {room.matchId?.teamAway}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    {room.matchId?.startTime && new Date(room.matchId.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'}
                </div>
            </div>

            {/* Opponent */}
            <div className="px-4 py-4 border-b border-gray-800">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Players</div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{room.player1Id?.username}</span>
                    <span className="text-gray-500 text-xs">vs</span>
                    <span className="text-sm font-medium">{room.player2Id?.username || 'Waiting...'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    First pick: {room.firstPickUserId === room.player1Id?._id
                        ? room.player1Id?.username
                        : room.player2Id?.username}
                </div>
            </div>

            {/* Pre-Draft Rankings */}
            <div className="px-4 py-4 max-w-lg mx-auto">
                <h2 className="text-lg font-semibold mb-4">Your Pre-Draft Rankings</h2>

                {predraft.batsmen.length === 0 && predraft.bowlers.length === 0 && predraft.allrounders.length === 0 ? (
                    <p className="text-gray-500 text-sm">You haven't set your pre-draft yet.</p>
                ) : (
                    <>
                        {renderList('Batsmen', predraft.batsmen)}
                        {renderList('Bowlers', predraft.bowlers)}
                        {renderList('All-rounders', predraft.allrounders)}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
                <button
                    onClick={() => navigate(`/room/${roomId}/predraft`)}
                    className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-3 rounded-xl transition"
                >
                    Edit Pre-Draft
                </button>
            </div>
            <div className="h-20" />
        </div>
    )
}
