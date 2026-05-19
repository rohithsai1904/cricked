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

function formatCountdown(ms: number): string {
    if (ms <= 0) return '0m'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

export default function WaitingRoom() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const [room, setRoom] = useState<Room | null>(null)
    const [copied, setCopied] = useState(false)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        fetchRoom()
        // Poll every 3 seconds until opponent joins
        const interval = setInterval(fetchRoom, 3000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const tick = setInterval(() => setNow(Date.now()), 10000)
        return () => clearInterval(tick)
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

                {/* Contextual Draft Timeline */}
                {(() => {
                    const startMs = new Date(room.matchId.startTime).getTime()
                    const msLeft = startMs - now
                    const t15 = startMs - 15 * 60000
                    const t5 = startMs - 5 * 60000
                    const phase = now >= t5 ? 3 : now >= t15 ? 2 : 1
                    const matchTimeStr = new Date(room.matchId.startTime).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    }) + ' IST'

                    return (
                        <div className="w-full bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden mt-2">
                            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                                <div className="text-xs font-semibold text-white">
                                    {room.matchId.teamHome} vs {room.matchId.teamAway}
                                </div>
                                <div className="text-[10px] text-gray-500">{matchTimeStr}</div>
                            </div>
                            <div className="px-4 py-3 flex flex-col gap-2.5">
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm ${phase === 1 ? '' : 'opacity-40'}`}>🟡</span>
                                    <div className="flex-1">
                                        <div className={`text-xs font-semibold ${phase === 1 ? 'text-yellow-400' : 'text-gray-600'}`}>Toss → T-15</div>
                                        <div className={`text-[11px] mt-0.5 ${phase === 1 ? 'text-gray-400' : 'text-gray-600'}`}>Join now to draft live</div>
                                    </div>
                                    {phase === 1 && <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full font-semibold">NOW</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm ${phase === 2 ? '' : 'opacity-40'}`}>🟠</span>
                                    <div className="flex-1">
                                        <div className={`text-xs font-semibold ${phase === 2 ? 'text-orange-400' : 'text-gray-600'}`}>T-15 → T-5</div>
                                        <div className={`text-[11px] mt-0.5 ${phase === 2 ? 'text-gray-400' : 'text-gray-600'}`}>Draft auto-continues</div>
                                    </div>
                                    {phase === 2 && <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full font-semibold">NOW</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm ${phase === 3 ? '' : 'opacity-40'}`}>🔴</span>
                                    <div className="flex-1">
                                        <div className={`text-xs font-semibold ${phase === 3 ? 'text-red-400' : 'text-gray-600'}`}>T-5 → Start</div>
                                        <div className={`text-[11px] mt-0.5 ${phase === 3 ? 'text-gray-400' : 'text-gray-600'}`}>Picks lock, auto-filled</div>
                                    </div>
                                    {phase === 3 && <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-semibold">NOW</span>}
                                </div>
                            </div>
                            <div className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-center gap-2">
                                <span className="text-[11px] text-gray-500">Match starts in</span>
                                <span className={`text-sm font-bold ${msLeft <= 5 * 60000 ? 'text-red-400' : msLeft <= 15 * 60000 ? 'text-yellow-400' : 'text-white'}`}>
                                    {msLeft > 0 ? formatCountdown(msLeft) : 'Started'}
                                </span>
                            </div>
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}