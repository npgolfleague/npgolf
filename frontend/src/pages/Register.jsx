import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authAPI } from '../api'

const LEAGUE_FINDER_STORAGE_KEY = 'npgolf_league_finder_profile'

function detectAliasFromPath() {
  const pathParts = window.location.pathname.split('/').filter((p) => p.length > 0)
  const commonRoutes = ['api', 'login', 'register', 'forgot-password', 'reset-password',
    'sms-consent', 'dashboard', 'about', 'app', 'assets', 'billing-entities']

  if (pathParts.length > 0 && !commonRoutes.includes(pathParts[0])) {
    return pathParts[0]
  }

  return ''
}

export const Register = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [sex, setSex] = useState('M')
  const [leagues, setLeagues] = useState([])
  const [leagueId, setLeagueId] = useState('')
  const [leaguesLoading, setLeaguesLoading] = useState(true)
  const [smsAllowed, setSmsAllowed] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const loadLeagues = async () => {
      try {
        setLeaguesLoading(true)
        const alias = detectAliasFromPath()
        const response = await axios.get('/api/league-select/all', {
          params: alias ? { alias } : undefined,
        })
        const allLeagues = Array.isArray(response.data) ? response.data : []
        setLeagues(allLeagues)

        // Prefer the first remembered league from league finder when available.
        const rememberedRaw = localStorage.getItem(LEAGUE_FINDER_STORAGE_KEY)
        if (rememberedRaw) {
          const remembered = JSON.parse(rememberedRaw)
          const rememberedLeagues = Array.isArray(remembered?.leagues) ? remembered.leagues : []
          const rememberedLeagueId = rememberedLeagues[0]?.id
          if (rememberedLeagueId && allLeagues.some((league) => Number(league.id) === Number(rememberedLeagueId))) {
            setLeagueId(String(rememberedLeagueId))
            return
          }
        }

        if (allLeagues.length > 0) {
          setLeagueId(String(allLeagues[0].id))
        }
      } catch (err) {
        console.error('Failed to load leagues for registration:', err)
        setError('Unable to load leagues. Please refresh and try again.')
      } finally {
        setLeaguesLoading(false)
      }
    }

    loadLeagues()
  }, [])

  const validatePassword = (pwd) => {
    if (pwd.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return false
    }
    if (!/[a-zA-Z]/.test(pwd)) {
      setPasswordError('Password must include at least one letter')
      return false
    }
    if (!/[0-9]/.test(pwd)) {
      setPasswordError('Password must include at least one number')
      return false
    }
    setPasswordError('')
    return true
  }

  const handlePasswordBlur = () => {
    if (password) {
      validatePassword(password)
    } else {
      setPasswordError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validate password before submission
    if (!validatePassword(password)) {
      return
    }

    if (!leagueId) {
      setError('Please select a league')
      return
    }

    const selectedLeague = leagues.find((league) => Number(league.id) === Number(leagueId))
    if (!selectedLeague) {
      setError('Selected league is no longer available. Please refresh and try again.')
      return
    }

    const currentAlias = detectAliasFromPath()
    const selectedAlias = String(selectedLeague.alias || '').trim()

    // Keep URL alias in sync with the chosen league before creating the player.
    if (currentAlias && selectedAlias && currentAlias.toLowerCase() !== selectedAlias.toLowerCase()) {
      window.history.replaceState({}, '', `/${selectedAlias}/register`)
    }
    
    setLoading(true)

    try {
      await authAPI.register(name, email, password, phone, sex, smsAllowed, Number(leagueId))
      navigate('/login', { state: { message: 'Registration successful! Check your email for further instructions.' } })
    } catch (err) {
      console.error('Registration error:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Registration failed'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">NPGOLF Sign Up</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="reg-name" className="block text-gray-700 font-semibold mb-2">Name</label>
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="reg-email" className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="reg-phone" className="block text-gray-700 font-semibold mb-2">Phone</label>
            <input
              id="reg-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="+18135550100"
              required
            />
            <p className="text-sm text-gray-600 mt-1">Include country code — e.g., +1 for US (+18135550100)</p>
          </div>

          <div className="mb-4">
            <label htmlFor="reg-gender" className="block text-gray-700 font-semibold mb-2">Gender</label>
            <select
              id="reg-gender"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="reg-league" className="block text-gray-700 font-semibold mb-2">League</label>
            <select
              id="reg-league"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
              disabled={leaguesLoading || leagues.length === 0}
            >
              {leagues.length === 0 && <option value="">No leagues available</option>}
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
            {leaguesLoading && <p className="text-sm text-gray-600 mt-1">Loading leagues...</p>}
          </div>

          <div className="mb-6">
            <label htmlFor="reg-password" className="block text-gray-700 font-semibold mb-2">Password</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handlePasswordBlur}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
            {passwordError && <p className="text-red-600 text-sm mt-1" role="alert">{passwordError}</p>}
            <p className="text-sm text-gray-600 mt-2">Min 8 chars, letters + numbers</p>
          </div>

          <div className="mb-6">
            <label htmlFor="reg-sms-consent" className="flex items-start">
              <input
                id="reg-sms-consent"
                type="checkbox"
                checked={smsAllowed}
                onChange={(e) => setSmsAllowed(e.target.checked)}
                className="mt-1 mr-3 h-4 w-4"
              />
              <span className="text-sm text-gray-700">
                I agree to receive SMS text messages from NPGOLF at the phone number provided above. 
                I understand I will receive tournament notifications and updates. Message and data rates may apply. 
                I can reply STOP to opt out at any time. See our{' '}
                <a href="/sms-consent" target="_blank" className="text-blue-600 hover:underline">SMS consent policy</a>.
              </span>
            </label>
          </div>

          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-500 hover:underline">
            Login
          </a>
        </p>
      </div>
    </div>
  )
}
