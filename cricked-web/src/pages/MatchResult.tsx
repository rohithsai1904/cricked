import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

interface PickData {
    _id: string
    userId: string
    pickType: string
    pickOrder: number
    playerName: string
    runs?: number
    wickets?: number
    autoPicked: boolean
}

interface ResultData {
    winnerId: { _id: string; username: string }
    loserId: { _id: string; username: string }
    winnerPoints: number
    loserPoints: number
    runDiff: number
    wicketDiff: number
}

export default function MatchResult() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [result, setResult] = useState<ResultData | null>(null)
    const [picks, setPicks] = useState<PickData[]>([])
    const [status, setStatus] = useState<'pending' | 'completed'>('pending')
    const [matchStatus, setMatchStatus] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchResult = () => {
            api.get(`/results/${roomId}`)
                .then(res => {
                    setStatus(res.data.status)
                    setPicks(res.data.picks || [])
                    if (res.data.result) setResult(res.data.result)
                    if (res.data.matchStatus) setMatchStatus(res.data.matchStatus)
                })
                .catch(console.error)
                .finally(() => setLoading(false))
        }

        fetchResult()
        const interval = setInterval(fetchResult, 30000)
        return () => clearInterval(interval)
    }, [roomId])

    if (loading) return <div className="page-loading">Loading result...</div>

    const myPicks = picks.filter(p => p.userId === user?.id)
    const oppPicks = picks.filter(p => p.userId !== user?.id)

    const isWinner = result?.winnerId?._id === user?.id

    return (
        <div className="match-result">
            {status === 'pending' ? (
                <div className="result-pending">
                    <h1>Waiting for Match</h1>
                    <p>Match status: <span className="status-badge">{matchStatus}</span></p>
                    <p className="waiting-text">Points will be calculated once the match is completed.</p>
                    <div className="spinner" />
                </div>
            ) : (
                <>
                    <div className={`result-banner ${isWinner ? 'result-win' : 'result-loss'}`}>
                        <h1>{isWinner ? 'You Won!' : 'You Lost'}</h1>
                    </div>

                    <div className="result-scores">
                        <div className="score-card">
                            <span className="score-label">
                                {isWinner ? 'You' : result?.winnerId?.username}
                            </span>
                            <span className="score-value">{result?.winnerPoints} pts</span>
                        </div>
                        <span className="vs-label">vs</span>
                        <div className="score-card">
                            <span className="score-label">
                                {isWinner ? result?.loserId?.username : 'You'}
                            </span>
                            <span className="score-value">{result?.loserPoints} pts</span>
                        </div>
                    </div>

                    <div className="result-breakdown">
                        <h3>Breakdown</h3>
                        <p>Run Difference: <strong>{result?.runDiff}</strong> (x10 = {(result?.runDiff || 0) * 10} pts)</p>
                        <p>Wicket Difference: <strong>{result?.wicketDiff}</strong> (x100 = {(result?.wicketDiff || 0) * 100} pts)</p>
                    </div>

                    <div className="result-picks-table">
                        <div className="picks-col">
                            <h3>Your Picks</h3>
                            {myPicks.map(p => (
                                <div key={p._id} className="result-pick-row">
                                    <span className="pick-name">{p.playerName}</span>
                                    <span className="pick-stat">
                                        {p.pickType === 'batsman'
                                            ? `${p.runs ?? '-'} runs`
                                            : `${p.wickets ?? '-'} wkts`}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="picks-col">
                            <h3>Opponent Picks</h3>
                            {oppPicks.map(p => (
                                <div key={p._id} className="result-pick-row">
                                    <span className="pick-name">{p.playerName}</span>
                                    <span className="pick-stat">
                                        {p.pickType === 'batsman'
                                            ? `${p.runs ?? '-'} runs`
                                            : `${p.wickets ?? '-'} wkts`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <button className="btn-primary btn-large" onClick={() => navigate('/dashboard')}>
                Play Again
            </button>
        </div>
    )
}
