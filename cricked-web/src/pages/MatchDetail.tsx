import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

interface Match {
    _id: string
    teamHome: string
    teamAway: string
    startTime: string
    status: string
    isDailyChallenge: boolean
    squadHome: Array<{ playerId: string; playerName: string; role: string }>
    squadAway: Array<{ playerId: string; playerName: string; role: string }>
}

export default function MatchDetail() {
    const { matchId } = useParams()
    const navigate = useNavigate()
    const [match, setMatch] = useState<Match | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get(`/matches/${matchId}`)
            .then(res => setMatch(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [matchId])

    if (loading) return <div className="page-loading">Loading match...</div>
    if (!match) return <div className="page-loading">Match not found</div>

    return (
        <div className="match-detail">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>

            <div className="match-detail-header">
                <h1>{match.teamHome} vs {match.teamAway}</h1>
                {match.isDailyChallenge && <span className="daily-badge">Daily Challenge</span>}
                <p className="match-time">{new Date(match.startTime).toLocaleString()}</p>
                <span className={`status-badge status-${match.status}`}>{match.status}</span>
            </div>

            <div className="match-detail-actions">
                <button
                    className="btn-primary btn-large"
                    onClick={() => navigate(`/predraft/${matchId}`, { state: { action: 'create' } })}
                >
                    Create Room (Invite Friend)
                </button>
                <button
                    className="btn-secondary btn-large"
                    onClick={() => navigate(`/predraft/${matchId}`, { state: { action: 'random' } })}
                >
                    Find Random Opponent
                </button>
            </div>

            {(match.squadHome.length > 0 || match.squadAway.length > 0) && (
                <div className="squads-section">
                    <h2 className="section-title">Squads</h2>
                    <div className="squads-grid">
                        <div className="squad-col">
                            <h3>{match.teamHome}</h3>
                            {match.squadHome.map(p => (
                                <div key={p.playerId} className="squad-player">
                                    <span className="player-name">{p.playerName}</span>
                                    <span className={`role-tag role-${p.role}`}>{p.role}</span>
                                </div>
                            ))}
                        </div>
                        <div className="squad-col">
                            <h3>{match.teamAway}</h3>
                            {match.squadAway.map(p => (
                                <div key={p.playerId} className="squad-player">
                                    <span className="player-name">{p.playerName}</span>
                                    <span className={`role-tag role-${p.role}`}>{p.role}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
