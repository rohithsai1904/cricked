import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface DraftTurn {
    userId: string
    pickType: string
    pickNumber: number
}

interface PickData {
    _id: string
    userId: string
    pickType: string
    pickOrder: number
    playerName: string
    squadPlayerId: string
    autoPicked: boolean
}

interface Player {
    playerId: string
    playerName: string
    role: string
}

export default function LiveDraft() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const socketRef = useRef<Socket | null>(null)

    const [draftOrder, setDraftOrder] = useState<DraftTurn[]>([])
    const [picks, setPicks] = useState<PickData[]>([])
    const [currentTurn, setCurrentTurn] = useState<DraftTurn | null>(null)
    const [timeLeft, setTimeLeft] = useState(60)
    const [status, setStatus] = useState<'loading' | 'waiting' | 'active' | 'complete'>('loading')
    const [allPlayers, setAllPlayers] = useState<Player[]>([])
    const [error, setError] = useState('')
    const [room, setRoom] = useState<any>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Load room + match data
    useEffect(() => {
        api.get(`/draft/${roomId}`)
            .then(res => {
                setDraftOrder(res.data.draftOrder)
                setPicks(res.data.picks)
                setRoom(res.data.room)
                if (res.data.isComplete) {
                    setStatus('complete')
                }
            })
            .catch(() => setError('Failed to load draft'))

        api.get(`/rooms/${roomId}`)
            .then(async res => {
                const matchRes = await api.get(`/matches/${res.data.matchId._id || res.data.matchId}`)
                const match = matchRes.data
                setAllPlayers([...(match.squadHome || []), ...(match.squadAway || [])])
            })
            .catch(() => {})
    }, [roomId])

    // Socket connection
    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token || !roomId) return

        const s = io('http://localhost:3001', { auth: { token } })
        socketRef.current = s

        s.emit('draft:join', { roomId })

        s.on('draft:state', (data) => {
            setDraftOrder(data.draftOrder)
            setPicks(data.picks)
            if (data.status === 'active') setStatus('active')
            else if (data.status === 'complete') setStatus('complete')
            else setStatus('waiting')
        })

        s.on('draft:started', (data) => {
            setStatus('active')
            setDraftOrder(data.draftOrder)
        })

        s.on('draft:turn', (data) => {
            setCurrentTurn({ userId: data.userId, pickType: data.pickType, pickNumber: data.pickNumber })
            setTimeLeft(data.timeLeft)
        })

        s.on('draft:pick_made', (data) => {
            setPicks(prev => [...prev, data.pick])
            if (data.nextTurn) {
                setCurrentTurn(data.nextTurn)
            }
        })

        s.on('draft:timeout', (data) => {
            setPicks(prev => [...prev, data.autoPick])
        })

        s.on('draft:complete', (data) => {
            setStatus('complete')
            setPicks(data.allPicks)
            setTimeout(() => navigate(`/result/${roomId}`), 2000)
        })

        s.on('draft:error', (data) => {
            setError(data.message)
        })

        return () => { s.disconnect() }
    }, [roomId, navigate])

    // Countdown timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (status === 'active' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [status, currentTurn])

    const handlePick = (player: Player) => {
        if (!socketRef.current || !currentTurn || currentTurn.userId !== user?.id) return
        socketRef.current.emit('draft:pick', {
            roomId,
            squadPlayerId: player.playerId,
            playerName: player.playerName,
            pickType: currentTurn.pickType
        })
    }

    const pickedIds = picks.map(p => p.squadPlayerId)
    const isMyTurn = currentTurn?.userId === user?.id
    const currentPhase = currentTurn?.pickType || 'batsman'

    const availablePlayers = allPlayers.filter(p => {
        if (pickedIds.includes(p.playerId)) return false
        if (currentPhase === 'batsman') return ['batsman', 'allrounder', 'wicketkeeper'].includes(p.role)
        return ['bowler', 'allrounder'].includes(p.role)
    })

    const myPicks = picks.filter(p => p.userId === user?.id)
    const opponentPicks = picks.filter(p => p.userId !== user?.id)

    const avatarUrl = (username: string) =>
        `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}`

    if (status === 'loading') return <div className="page-loading">Loading draft...</div>

    return (
        <div className="live-draft">
            <div className="draft-header">
                <h1>Live Draft</h1>
                {status === 'active' && currentTurn && (
                    <div className={`turn-indicator ${isMyTurn ? 'your-turn' : 'opponent-turn'}`}>
                        <span>{isMyTurn ? 'Your Turn' : "Opponent's Turn"}</span>
                        <span className="phase-label">Pick {currentPhase}</span>
                    </div>
                )}
                {status === 'active' && (
                    <div className={`timer ${timeLeft <= 10 ? 'timer-urgent' : ''}`}>
                        {timeLeft}s
                    </div>
                )}
                {status === 'complete' && (
                    <div className="draft-complete-banner">Draft Complete! Redirecting...</div>
                )}
            </div>

            {error && <div className="error-msg">{error}</div>}

            {/* Draft order indicator */}
            <div className="draft-order-bar">
                {draftOrder.map((turn, i) => (
                    <div
                        key={i}
                        className={`order-slot ${i < picks.length ? 'order-done' : ''} ${i === picks.length ? 'order-current' : ''} ${turn.userId === user?.id ? 'order-you' : 'order-opp'}`}
                    >
                        {i + 1}
                    </div>
                ))}
            </div>

            <div className="draft-columns">
                {/* Your picks */}
                <div className="draft-col">
                    <h3>Your Picks</h3>
                    {myPicks.length === 0 && <p className="empty-state">No picks yet</p>}
                    {myPicks.map(p => (
                        <div key={p._id} className={`pick-item ${p.autoPicked ? 'pick-auto' : ''}`}>
                            <span className="pick-name">{p.playerName}</span>
                            <span className={`pick-type pick-type-${p.pickType}`}>{p.pickType}</span>
                            {p.autoPicked && <span className="auto-tag">auto</span>}
                        </div>
                    ))}
                </div>

                {/* Opponent picks */}
                <div className="draft-col">
                    <h3>Opponent Picks</h3>
                    {opponentPicks.length === 0 && <p className="empty-state">No picks yet</p>}
                    {opponentPicks.map(p => (
                        <div key={p._id} className={`pick-item ${p.autoPicked ? 'pick-auto' : ''}`}>
                            <span className="pick-name">{p.playerName}</span>
                            <span className={`pick-type pick-type-${p.pickType}`}>{p.pickType}</span>
                            {p.autoPicked && <span className="auto-tag">auto</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Available players */}
            {status === 'active' && (
                <div className="available-players">
                    <h3>Available {currentPhase === 'batsman' ? 'Batsmen' : 'Bowlers'}</h3>
                    <div className="players-grid">
                        {availablePlayers.map(p => (
                            <button
                                key={p.playerId}
                                className={`available-player ${isMyTurn ? '' : 'disabled'}`}
                                onClick={() => handlePick(p)}
                                disabled={!isMyTurn}
                            >
                                <span className="player-name">{p.playerName}</span>
                                <span className={`role-tag role-${p.role}`}>{p.role}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
