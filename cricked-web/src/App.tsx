import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import Play from './pages/Play'
import WaitingRoom from './pages/WaitingRoom'
import PreDraft from './pages/PreDraft'
import RoomDetails from './pages/RoomDetails'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/play/:matchId" element={<Play />} />
                <Route path="/room/:roomId" element={<WaitingRoom />} />
                <Route path="/room/:roomId/predraft" element={<PreDraft />} />
                <Route path="/match/:matchId/predraft" element={<PreDraft />} />
                <Route path="/room/:roomId/details" element={<RoomDetails />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App