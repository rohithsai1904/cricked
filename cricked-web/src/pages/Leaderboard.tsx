import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface LeaderEntry {
    _id?: string
    username: string
    pointsTotal: number
    matchesPlayed: number
    wins: number
    losses: number
    winRate: number
}

interface WeeklyEntry {
    rank: number
    username: string
    points: number
    userId: string
}

export default function Leaderboard() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [tab, setTab] = useState<'alltime' | 'weekly'>('alltime')
    const [leaders, setLeaders] = useState<LeaderEntry[]>([])
    const [weekly, setWeekly] = useState<WeeklyEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (tab === 'alltime') {
            setLoading(true)
            api.get('/leaderboard')
                .then(res => setLeaders(res.data))
                .catch(console.error)
                .finally(() => setLoading(false))
        } else {
            setLoading(true)
            api.get('/leaderboard/weekly')
                .then(res => setWeekly(res.data.leaders || []))
                .catch(console.error)
                .finally(() => setLoading(false))
        }
    }, [tab])

    const avatarUrl = (username: string) =>
        `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}`

    return (
        <div className="leaderboard-page">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
            <h1>Leaderboard</h1>

            <div className="predraft-tabs">
                <button
                    className={`tab ${tab === 'alltime' ? 'tab-active' : ''}`}
                    onClick={() => setTab('alltime')}
                >
                    All Time
                </button>
                <button
                    className={`tab ${tab === 'weekly' ? 'tab-active' : ''}`}
                    onClick={() => setTab('weekly')}
                >
                    This Week
                </button>
            </div>

            {loading && <div className="page-loading">Loading...</div>}

            {!loading && tab === 'alltime' && (
                <div className="leaderboard-table">
                    <div className="lb-header">
                        <span className="lb-rank">Rank</span>
                        <span className="lb-player">Player</span>
                        <span className="lb-stat">Win Rate</span>
                        <span className="lb-stat">W/L</span>
                        <span className="lb-stat">Points</span>
                    </div>
                    {leaders.length === 0 && (
                        <p className="empty-state">No players with 5+ matches yet</p>
                    )}
                    {leaders.map((l, i) => (
                        <div
                            key={l._id || l.username}
                            className={`lb-row ${l.username === user?.username ? 'lb-row-you' : ''}`}
                            onClick={() => navigate(`/profile/${l.username}`)}
                        >
                            <span className="lb-rank">{i + 1}</span>
                            <span className="lb-player">
                                <img src={avatarUrl(l.username)} alt="" className="avatar-small" />
                                @{l.username}
                            </span>
                            <span className="lb-stat">{(l.winRate * 100).toFixed(1)}%</span>
                            <span className="lb-stat">{l.wins}/{l.losses}</span>
                            <span className="lb-stat">{l.pointsTotal}</span>
                        </div>
                    ))}
                </div>
            )}

            {!loading && tab === 'weekly' && (
                <div className="leaderboard-table">
                    <div className="lb-header">
                        <span className="lb-rank">Rank</span>
                        <span className="lb-player">Player</span>
                        <span className="lb-stat">Points</span>
                    </div>
                    {weekly.length === 0 && (
                        <p className="empty-state">No weekly entries yet</p>
                    )}
                    {weekly.map(w => (
                        <div
                            key={w.userId}
                            className={`lb-row ${w.username === user?.username ? 'lb-row-you' : ''}`}
                            onClick={() => navigate(`/profile/${w.username}`)}
                        >
                            <span className="lb-rank">{w.rank}</span>
                            <span className="lb-player">
                                <img src={avatarUrl(w.username)} alt="" className="avatar-small" />
                                @{w.username}
                            </span>
                            <span className="lb-stat">{w.points}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
