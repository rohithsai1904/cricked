import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Queue() {
    const { matchId } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const poll = setInterval(() => {
            api.get(`/rooms/queue-status/${matchId}`)
                .then(res => {
                    if (res.data.matched) {
                        clearInterval(poll)
                        navigate(`/room/${res.data.roomId}`)
                    } else if (!res.data.inQueue) {
                        clearInterval(poll)
                        setError('You are no longer in the queue')
                    }
                })
                .catch(console.error)
        }, 3000)

        return () => clearInterval(poll)
    }, [matchId, navigate])

    const handleCancel = async () => {
        setLoading(true)
        try {
            await api.delete(`/rooms/queue/${matchId}`)
            navigate('/dashboard')
        } catch {
            setError('Failed to cancel')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="queue-page">
            <div className="queue-content">
                <div className="spinner" />
                <h1>Looking for opponent...</h1>
                <p className="waiting-text">You'll be matched automatically when someone joins.</p>

                {error && <div className="error-msg">{error}</div>}

                <button
                    className="btn-secondary btn-large"
                    onClick={handleCancel}
                    disabled={loading}
                >
                    {loading ? 'Cancelling...' : 'Cancel'}
                </button>
            </div>
        </div>
    )
}
