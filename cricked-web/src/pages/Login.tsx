export default function Login() {
    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:3001/auth/google'
    }

    return (
        <div className="login-page">
            <h1>Cricked</h1>
            <p>Draft your XI. Duel your rival.</p>
            <button className="google-btn" onClick={handleGoogleLogin}>
                Sign in with Google
            </button>
        </div>
    )
}