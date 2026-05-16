import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface ProfileData {
    username: string
    pointsTotal: number
    matchesPlayed: number
    wins: number
    losses: number
    winRate: number
    createdAt: string
}

interface HistoryItem {
    resultId: string
    roomId: string
    opponent: string
    result: 'win' | 'loss'
    yourPoints: number
    opponentPoints: number
    date: string
}

export default function Profile() {
    const { username } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    const isOwnProfile = !username || username === user?.username

    useEffect(() => {
        const target = username || user?.username
        if (!target) return

        api.get(`/profile/${target}`)
            .then(res => setProfile(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))

        if (isOwnProfile) {
            api.get('/profile/me/history')
                .then(res => setHistory(res.data))
                .catch(console.error)
        }
    }, [username, user?.username, isOwnProfile])

    const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile?.username || ''}`

    if (loading) return <div className="page-loading">Loading profile...</div>
    if (!profile) return <div className="page-loading">User not found</div>

    return (
        <div className="profile-page">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>

            <div className="profile-header">
                <img src={avatarUrl} alt={profile.username} className="avatar-large" />
                <h1>@{profile.username}</h1>
                <p className="join-date">Joined {new Date(profile.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-value">{profile.pointsTotal}</span>
                    <span className="stat-label">Total Points</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{profile.matchesPlayed}</span>
                    <span className="stat-label">Matches</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{profile.wins}</span>
                    <span className="stat-label">Wins</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{profile.losses}</span>
                    <span className="stat-label">Losses</span>
                </div>
                <div className="stat-card stat-card-wide">
                    <span className="stat-value">{(profile.winRate * 100).toFixed(1)}%</span>
                    <span className="stat-label">Win Rate</span>
                </div>
            </div>

            {isOwnProfile && history.length > 0 && (
                <div className="history-section">
                    <h2 className="section-title">Recent Matches</h2>
                    {history.map(h => (
                        <div
                            key={h.resultId}
                            className={`history-item ${h.result === 'win' ? 'history-win' : 'history-loss'}`}
                            onClick={() => navigate(`/result/${h.roomId}`)}
                        >
                            <div className="history-info">
                                <span className="history-opponent">vs @{h.opponent}</span>
                                <span className="history-date">{new Date(h.date).toLocaleDateString()}</span>
                            </div>
                            <div className="history-result">
                                <span className={`result-tag ${h.result}`}>{h.result.toUpperCase()}</span>
                                <span className="history-pts">{h.yourPoints} - {h.opponentPoints}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
