import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken, isLoggedIn } from '../utils/auth'

export default function AuthCallback() {
    const navigate = useNavigate()

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const token = params.get('token')

        if (token) {
            setToken(token)
            navigate('/', { replace: true })
        } else if (!isLoggedIn()) {
            navigate('/login', { replace: true })
        } else {
            navigate('/', { replace: true })
        }
    },[])

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-gray-500">Signing you in...</p>
        </div>
    )
}