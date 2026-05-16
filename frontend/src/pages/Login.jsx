import { useState, useContext, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Disc3 } from 'lucide-react'
import { authAPI } from '../api'
import { AuthContext } from '../context/AuthContext'

const LEAGUE_FINDER_STORAGE_KEY = 'npgolf_league_finder_profile'
const LAST_LOGIN_EMAIL_KEY = 'npgolf_last_login_email'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useContext(AuthContext)

  useEffect(() => {
    try {
      const savedLoginEmail = localStorage.getItem(LAST_LOGIN_EMAIL_KEY)
      if (savedLoginEmail) {
        setEmail(savedLoginEmail)
        return
      }

      const finderRaw = localStorage.getItem(LEAGUE_FINDER_STORAGE_KEY)
      if (!finderRaw) return
      const finderData = JSON.parse(finderRaw)
      const finderEmail = String(finderData?.email || '').trim()
      if (finderEmail) {
        setEmail(finderEmail)
      }
    } catch (e) {
      // Ignore malformed local storage and continue.
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authAPI.login(email, password)
      const { token, user, refreshToken } = response.data
      login(user, token, refreshToken)
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim())
      // Small delay to ensure localStorage is written
      setTimeout(() => {
        // Check if there's a redirect path from the location state
        const from = location.state?.from || '/app/dashboard'
        navigate(from, { replace: true })
      }, 100)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-fairway-500 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-slate-100">
        <div className="mb-8 flex flex-col items-center">
          <img src="/npgolf-logo.svg" alt="NPGOLF" className="h-16 w-auto mb-2" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 text-sm">Please enter your details to sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-slate-700 text-sm font-bold mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fairway-500/20 focus:border-fairway-500 transition-all placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="block text-slate-700 text-sm font-bold">Password</label>
              <a href="/forgot-password" disabled className="text-xs font-semibold text-fairway-700 hover:text-fairway-800 transition-colors">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fairway-500/20 focus:border-fairway-500 transition-all placeholder:text-slate-400"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-base shadow-lg shadow-fairway-600/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Disc3 className="w-5 h-5 animate-spin" />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href="/register"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-fairway-500 hover:text-fairway-700 transition-colors"
            >
              Join a League
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-fairway-500 hover:text-fairway-700 transition-colors"
            >
              Find my league(s)
            </a>
          </div>
          <p className="text-slate-500 text-sm">
            Don't have an account?{' '}
            <a href="/register" className="font-bold text-slate-900 hover:text-fairway-700 transition-colors">
              Request Access
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
