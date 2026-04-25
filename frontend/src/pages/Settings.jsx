import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { settingsAPI } from '../api'

export const Settings = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [settings, setSettings] = useState({
    tournament_fee_18_holes: 0,
    tournament_fee_9_holes: 0,
    golf_course_email: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Redirect non-admin users
  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/app/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await settingsAPI.get()
      setSettings({
        tournament_fee_18_holes: response.data.tournament_fee_18_holes,
        tournament_fee_9_holes: response.data.tournament_fee_9_holes,
        golf_course_email: response.data.golf_course_email || ''
      })
      setError('')
    } catch (err) {
      console.error('Error fetching settings:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    // For numeric fields, parse as float; otherwise keep as string
    const newValue = name.includes('fee') ? (parseFloat(value) || 0) : value
    setSettings(prev => ({
      ...prev,
      [name]: newValue
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const response = await settingsAPI.update(settings)
      setSettings({
        tournament_fee_18_holes: response.data.tournament_fee_18_holes,
        tournament_fee_9_holes: response.data.tournament_fee_9_holes,
        golf_course_email: response.data.golf_course_email || ''
      })
      setSuccess('Settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err.response?.data?.error || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading settings...</div>
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
        <h1 className="text-3xl font-bold text-gray-800">⚙️ Settings</h1>
        <p className="text-gray-600 mt-2">Configure tournament fees and other settings</p>
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
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
            <p className="text-sm text-gray-500 mt-1">
              Fee charged for 18 hole tournaments
            </p>
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
            <p className="text-sm text-gray-500 mt-1">
              Fee charged for 9 hole tournaments
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Golf Course Email
            </label>
            <input
              type="email"
              name="golf_course_email"
              value={settings.golf_course_email}
              onChange={handleChange}
              placeholder="course@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Email address to send cart tags and tee sheets to the golf course
            </p>
          </div>
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
    </div>
  )
}
