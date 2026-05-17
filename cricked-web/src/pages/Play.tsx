import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'

export default function Play() {
    const { matchId } = useParams()
    const navigate = useNavigate()
    const [inviteCode, setInviteCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'choose' | 'join'>('choose')

    const handleCreate = () => {
        navigate(`/match/${matchId}/predraft`, { state: { mode: 'create' } })
    }

    const handleJoin = async () => {
        setLoading(true)
        try {
            const res = await api.post('/rooms/join', { inviteCode })
            navigate(`/room/${res.data._id}/predraft`)
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error joining room')
        } finally {
            setLoading(false)
        }
    }

    const handleRandom = () => {
        navigate(`/match/${matchId}/predraft`, { state: { mode: 'random' } })
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
            <div className="w-full max-w-sm flex flex-col gap-4">
                <button
                    onClick={() => navigate('/')}
                    className="text-gray-400 hover:text-white transition text-sm self-start"
                >
                    ← Back
                </button>
                <h2 className="text-2xl font-bold text-center mb-2">Find an Opponent</h2>

                {mode === 'choose' && (
                    <>
                        <button
                            onClick={handleCreate}
                            disabled={loading}
                            className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-4 rounded-xl transition"
                        >
                            Create Room
                        </button>

                        <button
                            onClick={() => setMode('join')}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 rounded-xl transition"
                        >
                            Join with Code
                        </button>

                        <button
                            onClick={handleRandom}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition"
                        >
                            Random Opponent
                        </button>
                    </>
                )}

                {mode === 'join' && (
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="Enter invite code"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl text-center text-xl tracking-widest font-mono uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
                            maxLength={8}
                        />
                        <button
                            onClick={handleJoin}
                            disabled={loading || inviteCode.length < 4}
                            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-4 rounded-xl transition"
                        >
                            Join Room
                        </button>
                        <button
                            onClick={() => setMode('choose')}
                            className="text-gray-400 text-sm text-center hover:text-white transition"
                        >
                            ← Back
                        </button>
                    </div>
                )}

            </div>
        </div>
    )
}