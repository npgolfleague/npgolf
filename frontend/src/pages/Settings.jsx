import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { leaguesAPI } from '../api'
import { isAdminCapable } from '../utils/roles'

const DEFAULT_SETTINGS = {
  tournament_fee_18_holes: 20,
  tournament_fee_9_holes: 10,
  golf_course_email: '',
  quota_points_albatross: 8,
  quota_points_eagle: 8,
  quota_points_birdie: 6,
  quota_points_par: 4,
  quota_points_bogey: 2,
  quota_points_double_bogey: 1,
  quota_points_worse: 0,
  live_scoring: 1
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function settingsFromResponse(data) {
  return {
    tournament_fee_18_holes: data.tournament_fee_18_holes ?? DEFAULT_SETTINGS.tournament_fee_18_holes,
    tournament_fee_9_holes: data.tournament_fee_9_holes ?? DEFAULT_SETTINGS.tournament_fee_9_holes,
    golf_course_email: data.golf_course_email || '',
    quota_points_albatross: data.quota_points_albatross ?? DEFAULT_SETTINGS.quota_points_albatross,
    quota_points_eagle: data.quota_points_eagle ?? DEFAULT_SETTINGS.quota_points_eagle,
    quota_points_birdie: data.quota_points_birdie ?? DEFAULT_SETTINGS.quota_points_birdie,
    quota_points_par: data.quota_points_par ?? DEFAULT_SETTINGS.quota_points_par,
    quota_points_bogey: data.quota_points_bogey ?? DEFAULT_SETTINGS.quota_points_bogey,
    quota_points_double_bogey: data.quota_points_double_bogey ?? DEFAULT_SETTINGS.quota_points_double_bogey,
    quota_points_worse: data.quota_points_worse ?? DEFAULT_SETTINGS.quota_points_worse,
    live_scoring: data.live_scoring != null ? Number(data.live_scoring) : 1
  }
}

export const Settings = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const adminCapable = isAdminCapable(user)
  const [leagues, setLeagues] = useState([])
  const [selectedLeagueId, setSelectedLeagueId] = useState(null)
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS })
  const [loadingLeagues, setLoadingLeagues] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Redirect non-admin users
  useEffect(() => {
    if (!adminCapable) {
      navigate('/app/dashboard')
    }
  }, [adminCapable, navigate])

  // Load league list
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const response = await leaguesAPI.list()
        const activeLeagues = response.data.filter(l => l.active)
        setLeagues(activeLeagues)
        if (activeLeagues.length > 0) {
          setSelectedLeagueId(activeLeagues[0].id)
        }
      } catch (err) {
        console.error('Error fetching leagues:', err)
        setError('Failed to load leagues')
      } finally {
        setLoadingLeagues(false)
      }
    }
    fetchLeagues()
  }, [])

  // Load settings when selected league changes
  useEffect(() => {
    if (!selectedLeagueId) return
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true)
        setError('')
        const response = await leaguesAPI.getSettings(selectedLeagueId)
        setSettings(settingsFromResponse(response.data))
      } catch (err) {
        console.error('Error fetching settings:', err)
        setError('Failed to load settings')
      } finally {
        setLoadingSettings(false)
      }
    }
    fetchSettings()
  }, [selectedLeagueId])

  const handleLeagueChange = (e) => {
    setSelectedLeagueId(Number(e.target.value))
    setSuccess('')
    setError('')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const newValue = name.includes('fee') ? (parseFloat(value) || 0)
      : name.startsWith('quota_points') ? (parseInt(value, 10) || 0)
      : value
    setSettings(prev => ({ ...prev, [name]: newValue }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const rawEmails = String(settings.golf_course_email || '').trim()
      if (rawEmails) {
        const emails = rawEmails.split(';').map(v => v.trim()).filter(Boolean)
        const invalid = emails.find(email => !EMAIL_REGEX.test(email))
        if (invalid) {
          throw new Error(`Invalid email address: ${invalid}`)
        }
      }

      const response = await leaguesAPI.updateSettings(selectedLeagueId, settings)
      setSettings(settingsFromResponse(response.data))
      const leagueName = leagues.find(l => l.id === selectedLeagueId)?.name || 'League'
      setSuccess(`${leagueName} settings saved!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err.response?.data?.error || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!adminCapable) return null

  if (loadingLeagues) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/dashboard')}
          className="text-blue-600 hover:text-blue-800 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">League configuration</p>
      </div>

      {/* League selector */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-2">League</label>
        <select
          value={selectedLeagueId || ''}
          onChange={handleLeagueChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {leagues.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {loadingSettings ? (
        <div className="flex justify-center items-center h-32">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                18 Hole Tournament Fee ($)
              </label>
              <input
                type="number"
                name="tournament_fee_18_holes"
                value={settings.tournament_fee_18_holes}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                9 Hole Tournament Fee ($)
              </label>
              <input
                type="number"
                name="tournament_fee_9_holes"
                value={settings.tournament_fee_9_holes}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Golf Course Email
              </label>
              <input
                type="text"
                name="golf_course_email"
                value={settings.golf_course_email}
                onChange={handleChange}
                placeholder="course@example.com; proshop@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                One or more emails separated by a semicolon (;)
              </p>
            </div>

            <hr className="border-gray-200" />

            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Quota Point Values</h2>
              <p className="text-sm text-gray-500 mb-4">
                Points awarded per hole when seeding a new player's initial quota.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'quota_points_albatross', label: 'Albatross / Hole-in-One' },
                  { name: 'quota_points_eagle', label: 'Eagle' },
                  { name: 'quota_points_birdie', label: 'Birdie' },
                  { name: 'quota_points_par', label: 'Par' },
                  { name: 'quota_points_bogey', label: 'Bogey' },
                  { name: 'quota_points_double_bogey', label: 'Double Bogey' },
                  { name: 'quota_points_worse', label: 'Worse than Double Bogey' },
                ].map(({ name, label }) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type="number"
                      name={name}
                      value={settings[name]}
                      onChange={handleChange}
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Scoring Toggle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Leaderboard Settings</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.live_scoring}
                onChange={e => setSettings(prev => ({ ...prev, live_scoring: e.target.checked ? 1 : 0 }))}
                className="w-5 h-5 accent-blue-600"
              />
              <div>
                <span className="font-medium text-gray-800">Live Scoring</span>
                <p className="text-sm text-gray-500">When enabled, scores appear on the leaderboard as they are entered. When disabled, scores only appear after a foursome posts their scores.</p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/dashboard')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

