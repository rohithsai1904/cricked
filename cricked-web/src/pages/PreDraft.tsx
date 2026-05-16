import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../api'

interface Player {
    playerId: string
    playerName: string
    role: string
}

interface SelectedPlayer {
    playerName: string
    squadPlayerId: string
}

export default function PreDraft() {
    const { matchId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const action = (location.state as any)?.action || 'create'
    const inviteCode = (location.state as any)?.inviteCode

    const [allPlayers, setAllPlayers] = useState<Player[]>([])
    const [batsmen, setBatsmen] = useState<SelectedPlayer[]>([])
    const [bowlers, setBowlers] = useState<SelectedPlayer[]>([])
    const [activeTab, setActiveTab] = useState<'batsman' | 'bowler'>('batsman')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get(`/matches/${matchId}`)
            .then(res => {
                const match = res.data
                const combined = [
                    ...(match.squadHome || []),
                    ...(match.squadAway || [])
                ]
                setAllPlayers(combined)
            })
            .catch(() => setError('Failed to load match'))
            .finally(() => setLoading(false))
    }, [matchId])

    const batsmenPool = allPlayers.filter(p =>
        ['batsman', 'allrounder', 'wicketkeeper'].includes(p.role)
    )
    const bowlerPool = allPlayers.filter(p =>
        ['bowler', 'allrounder'].includes(p.role)
    )

    const addBatsman = (p: Player) => {
        if (batsmen.length >= 8) return
        if (batsmen.some(b => b.squadPlayerId === p.playerId)) return
        setBatsmen([...batsmen, { playerName: p.playerName, squadPlayerId: p.playerId }])
    }

    const addBowler = (p: Player) => {
        if (bowlers.length >= 4) return
        if (bowlers.some(b => b.squadPlayerId === p.playerId)) return
        setBowlers([...bowlers, { playerName: p.playerName, squadPlayerId: p.playerId }])
    }

    const removeBatsman = (idx: number) => {
        setBatsmen(batsmen.filter((_, i) => i !== idx))
    }

    const removeBowler = (idx: number) => {
        setBowlers(bowlers.filter((_, i) => i !== idx))
    }

    const moveUp = (list: SelectedPlayer[], setList: (l: SelectedPlayer[]) => void, idx: number) => {
        if (idx === 0) return
        const newList = [...list]
        ;[newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]]
        setList(newList)
    }

    const moveDown = (list: SelectedPlayer[], setList: (l: SelectedPlayer[]) => void, idx: number) => {
        if (idx === list.length - 1) return
        const newList = [...list]
        ;[newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]]
        setList(newList)
    }

    const canSave = batsmen.length === 8 && bowlers.length === 4

    const handleSave = async () => {
        if (!canSave) return
        setSaving(true)
        setError('')

        try {
            await api.post('/predraft/save', { matchId, batsmen, bowlers })

            if (action === 'create') {
                const res = await api.post('/rooms/create', { matchId })
                navigate(`/room/${res.data._id}`)
            } else if (action === 'join') {
                const res = await api.post('/rooms/join', { inviteCode })
                navigate(`/room/${res.data._id}`)
            } else if (action === 'random') {
                const res = await api.post('/rooms/random', { matchId })
                if (res.data.matched) {
                    navigate(`/room/${res.data.room._id}`)
                } else {
                    navigate(`/queue/${matchId}`)
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Something went wrong')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="page-loading">Loading squads...</div>

    return (
        <div className="predraft">
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
            <h1>Pre-Draft Priority List</h1>
            <p className="predraft-subtitle">Rank your picks. If you time out during the draft, your top available pick is auto-selected.</p>

            {error && <div className="error-msg">{error}</div>}

            <div className="predraft-tabs">
                <button
                    className={`tab ${activeTab === 'batsman' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('batsman')}
                >
                    Batsmen ({batsmen.length}/8)
                </button>
                <button
                    className={`tab ${activeTab === 'bowler' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('bowler')}
                >
                    Bowlers ({bowlers.length}/4)
                </button>
            </div>

            <div className="predraft-content">
                {/* Selected list */}
                <div className="selected-list">
                    <h3>Your Priority Order</h3>
                    {activeTab === 'batsman' ? (
                        batsmen.length === 0 ? (
                            <p className="empty-state">Tap players below to add batsmen</p>
                        ) : (
                            batsmen.map((b, i) => (
                                <div key={b.squadPlayerId} className="selected-item">
                                    <span className="rank-number rank-batsman">{i + 1}</span>
                                    <span className="selected-name">{b.playerName}</span>
                                    <div className="selected-actions">
                                        <button className="move-btn" onClick={() => moveUp(batsmen, setBatsmen, i)}>↑</button>
                                        <button className="move-btn" onClick={() => moveDown(batsmen, setBatsmen, i)}>↓</button>
                                        <button className="remove-btn" onClick={() => removeBatsman(i)}>×</button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        bowlers.length === 0 ? (
                            <p className="empty-state">Tap players below to add bowlers</p>
                        ) : (
                            bowlers.map((b, i) => (
                                <div key={b.squadPlayerId} className="selected-item">
                                    <span className="rank-number rank-bowler">{i + 1}</span>
                                    <span className="selected-name">{b.playerName}</span>
                                    <div className="selected-actions">
                                        <button className="move-btn" onClick={() => moveUp(bowlers, setBowlers, i)}>↑</button>
                                        <button className="move-btn" onClick={() => moveDown(bowlers, setBowlers, i)}>↓</button>
                                        <button className="remove-btn" onClick={() => removeBowler(i)}>×</button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* Player pool */}
                <div className="player-pool">
                    <h3>Available Players</h3>
                    {activeTab === 'batsman' ? (
                        batsmenPool.map(p => {
                            const isSelected = batsmen.some(b => b.squadPlayerId === p.playerId)
                            return (
                                <button
                                    key={p.playerId}
                                    className={`pool-player ${isSelected ? 'pool-player-selected' : ''}`}
                                    onClick={() => addBatsman(p)}
                                    disabled={isSelected || batsmen.length >= 8}
                                >
                                    <span>{p.playerName}</span>
                                    <span className={`role-tag role-${p.role}`}>{p.role}</span>
                                </button>
                            )
                        })
                    ) : (
                        bowlerPool.map(p => {
                            const isSelected = bowlers.some(b => b.squadPlayerId === p.playerId)
                            return (
                                <button
                                    key={p.playerId}
                                    className={`pool-player ${isSelected ? 'pool-player-selected' : ''}`}
                                    onClick={() => addBowler(p)}
                                    disabled={isSelected || bowlers.length >= 4}
                                >
                                    <span>{p.playerName}</span>
                                    <span className={`role-tag role-${p.role}`}>{p.role}</span>
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            <button
                className="btn-primary btn-large save-btn"
                disabled={!canSave || saving}
                onClick={handleSave}
            >
                {saving ? 'Saving...' : 'Save & Continue'}
            </button>
        </div>
    )
}
