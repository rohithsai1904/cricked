import axios from 'axios'
import { getToken } from './auth'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001'
})

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export default api