import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface RoomData {
    _id: string
    inviteCode: string
    matchId: { teamHome: string; teamAway: string; startTime: string; status: string }
    player1Id: { _id: string; username: string }
    player2Id: { _id: string; username: string } | null
    status: string
}

export default function WaitingRoom() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [room, setRoom] = useState<RoomData | null>(null)
    const [loading, setLoading] = useState(true)
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [opponentReady, setOpponentReady] = useState(false)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get(`/rooms/${roomId}`)
            .then(res => setRoom(res.data))
            .catch(() => setError('Room not found'))
            .finally(() => setLoading(false))
    }, [roomId])

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token || !roomId) return

        const s = io('http://localhost:3001', { auth: { token } })
        setSocket(s)

        s.emit('draft:join', { roomId })

        s.on('draft:opponent_joined', ({ username }) => {
            setRoom(prev => prev ? {
                ...prev,
                player2Id: { _id: '', username },
                status: 'ready'
            } : prev)
        })

        s.on('draft:player_ready', ({ userId }) => {
            if (userId === user?.id) {
                setIsReady(true)
            } else {
                setOpponentReady(true)
            }
        })

        s.on('draft:started', () => {
            navigate(`/draft/${roomId}`)
        })

        s.on('draft:error', ({ message }) => {
            setError(message)
        })

        return () => { s.disconnect() }
    }, [roomId, user?.id, navigate])

    const handleReady = () => {
        if (socket && roomId) {
            socket.emit('draft:ready', { roomId })
            setIsReady(true)
        }
    }

    const copyInviteCode = () => {
        if (room?.inviteCode) {
            navigator.clipboard.writeText(room.inviteCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const avatarUrl = (username: string) =>
        `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}`

    if (loading) return <div className="page-loading">Loading room...</div>
    if (error) return <div className="page-loading">{error}</div>
    if (!room) return <div className="page-loading">Room not found</div>

    const opponent = room.player1Id?._id === user?.id ? room.player2Id : room.player1Id
    const hasOpponent = !!room.player2Id

    return (
        <div className="waiting-room">
            <h1>Waiting Room</h1>
            <p className="match-info">
                {room.matchId?.teamHome} vs {room.matchId?.teamAway}
            </p>

            <div className="invite-section">
                <span className="invite-label">Invite Code:</span>
                <span className="invite-code">{room.inviteCode}</span>
                <button className="copy-btn" onClick={copyInviteCode}>
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>

            <div className="players-section">
                <div className={`player-card ${isReady ? 'player-ready' : ''}`}>
                    <img src={avatarUrl(user?.username || '')} alt="You" className="avatar" />
                    <span className="player-username">@{user?.username}</span>
                    {isReady && <span className="ready-badge">Ready</span>}
                </div>

                <span className="vs-label">VS</span>

                <div className={`player-card ${opponentReady ? 'player-ready' : ''}`}>
                    {hasOpponent ? (
                        <>
                            <img src={avatarUrl(opponent?.username || '')} alt="Opponent" className="avatar" />
                            <span className="player-username">@{opponent?.username}</span>
                            {opponentReady && <span className="ready-badge">Ready</span>}
                        </>
                    ) : (
                        <>
                            <div className="avatar-placeholder" />
                            <span className="player-username waiting-text">Waiting for opponent...</span>
                        </>
                    )}
                </div>
            </div>

            {hasOpponent && !isReady && (
                <button className="btn-primary btn-large" onClick={handleReady}>
                    I'm Ready
                </button>
            )}

            {isReady && !opponentReady && (
                <p className="waiting-text">Waiting for opponent to ready up...</p>
            )}

            <button className="back-btn" onClick={() => navigate('/dashboard')}>
                ← Back to Dashboard
            </button>
        </div>
    )
}
