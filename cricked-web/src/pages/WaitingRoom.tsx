import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'

interface Room {
    _id: string
    inviteCode: string
    status: string
    player1Id: { _id: string; username: string }
    player2Id: { _id: string; username: string } | null
    matchId: { teamHome: string; teamAway: string; startTime: string }
}

export default function WaitingRoom() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const [room, setRoom] = useState<Room | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        fetchRoom()
        // Poll every 3 seconds until opponent joins
        const interval = setInterval(fetchRoom, 3000)
        return () => clearInterval(interval)
    }, [])

    const fetchRoom = async () => {
        try {
            const res = await api.get(`/rooms/${roomId}`)
            setRoom(res.data)
            // If both players joined, go to pre-draft
            if (res.data.status === 'ready' && res.data.player2Id) {
                navigate(`/room/${roomId}/predraft`)
            }
        } catch (err) {
            console.error(err)
        }
    }

    const copyCode = () => {
        if (!room) return
        navigator.clipboard.writeText(room.inviteCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!room) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <p className="text-gray-400">Loading...</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6">

                <div className="text-center">
                    <div className="text-lg font-semibold">
                        {room.matchId.teamHome} vs {room.matchId.teamAway}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                        {new Date(room.matchId.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'}
                    </div>
                </div>

                {/* Players */}
                <div className="w-full flex items-center justify-between bg-gray-900 rounded-2xl p-6">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-black font-bold text-lg">
                            {room.player1Id.username[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{room.player1Id.username}</span>
                        <span className="text-xs text-green-400">Ready</span>
                    </div>

                    <div className="text-2xl font-bold text-gray-600">VS</div>

                    <div className="flex flex-col items-center gap-2">
                        {room.player2Id ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                                    {room.player2Id.username[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{room.player2Id.username}</span>
                                <span className="text-xs text-green-400">Ready</span>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                                    ?
                                </div>
                                <span className="text-sm text-gray-400">Waiting...</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Invite code */}
                {!room.player2Id && (
                    <div className="w-full flex flex-col items-center gap-3">
                        <p className="text-sm text-gray-400">Share this code with your opponent</p>
                        <div className="text-3xl font-mono font-bold tracking-widest bg-gray-900 px-8 py-4 rounded-xl">
                            {room.inviteCode}
                        </div>
                        <button
                            onClick={copyCode}
                            className="text-sm text-green-400 hover:text-green-300 transition"
                        >
                            {copied ? '✓ Copied' : 'Copy code'}
                        </button>
                    </div>
                )}

                {room.player2Id && (
                    <p className="text-sm text-gray-400 animate-pulse">
                        Taking you to the draft...
                    </p>
                )}
            </div>
        </div>
    )
}