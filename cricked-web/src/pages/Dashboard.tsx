import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface Match {
    _id: string
    teamHome: string
    teamAway: string
    startTime: string
    status: string
    isDailyChallenge: boolean
}

export default function Dashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [joinCode, setJoinCode] = useState('')
    const [joinError, setJoinError] = useState('')

    useEffect(() => {
        api.get('/matches')
            .then(res => setMatches(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleJoinByCode = async () => {
        if (!joinCode.trim()) return
        setJoinError('')
        try {
            const res = await api.post('/rooms/join', { inviteCode: joinCode.trim().toUpperCase() })
            navigate(`/room/${res.data._id}`)
        } catch (err: any) {
            setJoinError(err.response?.data?.error || 'Failed to join room')
        }
    }

    const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.username || ''}`

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Cricked</h1>
                <div className="user-bar">
                    <img src={avatarUrl} alt="" className="avatar-small" onClick={() => navigate(`/profile/${user?.username}`)} style={{ cursor: 'pointer' }} />
                    <span className="username" onClick={() => navigate(`/profile/${user?.username}`)} style={{ cursor: 'pointer' }}>@{user?.username}</span>
                    <span className="sep">·</span>
                    <span className="points">{user?.pointsTotal} pts</span>
                    <button className="logout-btn" onClick={() => navigate('/leaderboard')}>Leaderboard</button>
                    <button className="logout-btn" onClick={logout}>Logout</button>
                </div>
            </div>

            <div className="join-section">
                <h2 className="section-title">Join a Friend's Room</h2>
                <div className="join-row">
                    <input
                        type="text"
                        className="join-input"
                        placeholder="Enter invite code"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value)}
                        maxLength={6}
                    />
                    <button className="btn-primary" onClick={handleJoinByCode}>Join</button>
                </div>
                {joinError && <p className="error-msg">{joinError}</p>}
            </div>

            <h2 className="section-title">Upcoming Matches</h2>

            {loading && <p>Loading matches...</p>}

            {!loading && matches.length === 0 && (
                <p className="empty-state">No upcoming matches. Check back soon.</p>
            )}

            {matches.map(match => (
                <div key={match._id} className="match-card" onClick={() => navigate(`/match/${match._id}`)} style={{ cursor: 'pointer' }}>
                    <span className="match-teams">{match.teamHome} vs {match.teamAway}</span>
                    {match.isDailyChallenge && <span className="daily-badge">Daily Challenge</span>}
                    <p className="match-time">{new Date(match.startTime).toLocaleString()}</p>
                </div>
            ))}
        </div>
    )
}