import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function AuthCallback() {
    const { login } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const token = params.get('token')

        if (!token) {
            navigate('/login')
            return
        }

        // Store token then fetch user profile
        localStorage.setItem('token', token)

        api.get('/auth/me')
            .then(res => {
                const userData = { ...res.data, id: res.data._id }
                login(token, userData)
                navigate('/dashboard')
            })
            .catch(() => {
                navigate('/login')
            })
    }, [])

    return <div className="auth-loading">Signing you in...</div>
}