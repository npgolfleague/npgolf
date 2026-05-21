import { useEffect, useState } from 'react'
import axios from 'axios'
import { Shield, ArrowRight, Mail } from 'lucide-react'

const LEAGUE_FINDER_STORAGE_KEY = 'npgolf_league_finder_profile'

export const LeagueSelect = () => {
  const [leagues, setLeagues] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEAGUE_FINDER_STORAGE_KEY)
      if (!raw) return

      const saved = JSON.parse(raw)
      const savedEmail = String(saved?.email || '').trim()
      const savedLeagues = Array.isArray(saved?.leagues) ? saved.leagues : []

      if (savedEmail) {
        setEmail(savedEmail)
      }

      if (savedLeagues.length > 0) {
        setLeagues(savedLeagues)
        setSearched(true)
      }
    } catch (e) {
      localStorage.removeItem(LEAGUE_FINDER_STORAGE_KEY)
    }
  }, [])

  const handleEmailSearch = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await axios.get(`/api/league-select/by-email?email=${encodeURIComponent(email)}`)
      const validLeagues = (response.data || []).filter((league) => {
        const alias = String(league?.alias || '').trim()
        return alias.length > 0 && alias.toLowerCase() !== 'null'
      })

      if (validLeagues.length === 0) {
        setError('No leagues found for this email address. Please check your email or contact your league administrator.')
        setLeagues([])
      } else {
        setLeagues(validLeagues)
      }

      localStorage.setItem(
        LEAGUE_FINDER_STORAGE_KEY,
        JSON.stringify({
          email: email.trim(),
          leagues: validLeagues,
          updatedAt: new Date().toISOString(),
        })
      )

      setSearched(true)
    } catch (err) {
      console.error('Error searching leagues:', err)
      setError('Failed to search leagues. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLeagueSelect = (alias) => {
    const normalizedAlias = String(alias || '').trim()
    if (!normalizedAlias || normalizedAlias.toLowerCase() === 'null') {
      setError('This league is not configured with a valid URL alias. Please contact your administrator.')
      return
    }

    // Redirect to league-specific login
    window.location.href = `/${normalizedAlias}/login`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fairway-50 to-fairway-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fairway-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-fairway-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to NPGOLF</h1>
          <p className="text-gray-600">Enter your email to find your leagues</p>
        </div>

        {/* Email Search - Required */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="inline w-4 h-4 mr-1" />
            Email Address
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (searched) {
                  setSearched(false)
                  setLeagues([])
                }
                if (error) {
                  setError('')
                }
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleEmailSearch()}
              placeholder="your@email.com"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fairway-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleEmailSearch}
              disabled={loading}
              className="px-6 py-2 bg-fairway-600 text-white rounded-lg hover:bg-fairway-700 transition disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Find Leagues'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {searched && leagues.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Select your league to continue
            </h2>
            {leagues.map((league) => (
              <button
                key={league.id}
                onClick={() => handleLeagueSelect(league.alias)}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-fairway-500 hover:bg-fairway-50 transition group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-fairway-700">
                      {league.name}
                    </h3>
                    {league.description && (
                      <p className="text-sm text-gray-600 mt-1">{league.description}</p>
                    )}
                    {league.billing_entity_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        Managed by {league.billing_entity_name}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-fairway-600 transition" />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href="/register"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-fairway-500 hover:text-fairway-700 transition-colors"
          >
            Join a League
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-fairway-500 hover:text-fairway-700 transition-colors"
          >
            Find my league(s)
          </a>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Don't have an account? Contact your league administrator.</p>
        </div>
      </div>
    </div>
  )
}
