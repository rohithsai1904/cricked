import { useParams, useNavigate } from 'react-router-dom'

export default function DraftResult() {
    const { roomId } = useParams()
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
            <div className="text-center flex flex-col items-center gap-6">
                <div className="text-5xl">🏆</div>
                <h2 className="text-2xl font-bold">Draft Results</h2>
                <p className="text-gray-400 text-sm">Room: {roomId}</p>
                <p className="text-gray-500 text-xs">Results page coming soon...</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-xl transition"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    )
}
