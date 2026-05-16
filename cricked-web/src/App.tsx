import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import MatchDetail from './pages/MatchDetail'
import PreDraft from './pages/PreDraft'
import WaitingRoom from './pages/WaitingRoom'
import LiveDraft from './pages/LiveDraft'
import MatchResult from './pages/MatchResult'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Queue from './pages/Queue'

function App() {
  return (
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path='/login' element={<Login />} />
            <Route path='/auth/callback' element={<AuthCallback />} />
            <Route path='/dashboard' element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path='/' element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path='/match/:matchId' element={
              <ProtectedRoute><MatchDetail /></ProtectedRoute>
            } />
            <Route path='/predraft/:matchId' element={
              <ProtectedRoute><PreDraft /></ProtectedRoute>
            } />
            <Route path='/room/:roomId' element={
              <ProtectedRoute><WaitingRoom /></ProtectedRoute>
            } />
            <Route path='/draft/:roomId' element={
              <ProtectedRoute><LiveDraft /></ProtectedRoute>
            } />
            <Route path='/result/:roomId' element={
              <ProtectedRoute><MatchResult /></ProtectedRoute>
            } />
            <Route path='/queue/:matchId' element={
              <ProtectedRoute><Queue /></ProtectedRoute>
            } />
            <Route path='/profile/:username' element={<Profile />} />
            <Route path='/profile' element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />
            <Route path='/leaderboard' element={<Leaderboard />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
  )
}

export default App