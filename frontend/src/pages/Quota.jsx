import { useEffect, useState, useContext } from 'react'
import { playersAPI } from '../api'
import { AuthContext } from '../context/AuthContext'

const rounds = [1, 2, 3, 4, 5, 6, 7]

export const Quota = () => {
  const { user } = useContext(AuthContext)
  const [players, setPlayers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [quotaRow, setQuotaRow] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingRow, setLoadingRow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await playersAPI.list()
      setPlayers(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const normalizeDate = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value.slice(0, 10)
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }

  const loadQuotaRow = async (playerId) => {
    if (!playerId) return
    setLoadingRow(true)
    setError('')
    setSuccess('')
    try {
      const response = await playersAPI.getQuotaRow(playerId)
      const row = response.data || {}
      setQuotaRow(row)
      const nextForm = {}
      rounds.forEach((round) => {
        nextForm[`date_${round}`] = normalizeDate(row[`date_${round}`])
        nextForm[`points_${round}`] = row[`points_${round}`] ?? ''
        nextForm[`quota_diff_${round}`] = row[`quota_diff_${round}`] ?? ''
      })
      setForm(nextForm)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quota row')
      setQuotaRow(null)
      setForm({})
    } finally {
      setLoadingRow(false)
    }
  }

  const handleSelectPlayer = (e) => {
    const value = e.target.value
    setSelectedId(value)
    if (value) {
      loadQuotaRow(Number(value))
    } else {
      setQuotaRow(null)
      setForm({})
    }
  }

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const buildPayload = () => {
    const payload = {}
    rounds.forEach((round) => {
      const dateKey = `date_${round}`
      const pointsKey = `points_${round}`
      const diffKey = `quota_diff_${round}`

      payload[dateKey] = form[dateKey] === '' ? null : form[dateKey]
      payload[pointsKey] = form[pointsKey] === '' ? null : Number(form[pointsKey])

      payload[diffKey] = form[diffKey] === '' ? null : Number(form[diffKey])
    })
    return payload
  }

  const saveQuotaRow = async () => {
    if (!selectedId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = buildPayload()
      const response = await playersAPI.updateQuotaRow(selectedId, payload)
      setQuotaRow(response.data)
      setSuccess('Quota row updated')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update quota row')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6 text-gray-700">
            You do not have access to this page.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-800">🎯 Player Quota History</h2>
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="playerSelect">
              Select Player
            </label>
            <select
              id="playerSelect"
              value={selectedId}
              onChange={handleSelectPlayer}
              className="w-full md:w-96 border rounded px-3 py-2"
            >
              <option value="">-- Choose a player --</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{success}</div>}

        {loading ? (
          <div className="text-center text-gray-600">Loading players...</div>
        ) : selectedId ? (
          loadingRow ? (
            <div className="text-center text-gray-600">Loading quota row...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-700 font-semibold">Round</th>
                    <th className="px-6 py-3 text-left text-gray-700 font-semibold">Date</th>
                    <th className="px-6 py-3 text-left text-gray-700 font-semibold">Points</th>
                    <th className="px-6 py-3 text-left text-gray-700 font-semibold">Quota Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((round) => (
                    <tr key={round} className="border-t">
                      <td className="px-6 py-4 text-gray-900">{round}</td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={form[`date_${round}`] || ''}
                          onChange={(e) => handleFieldChange(`date_${round}`, e.target.value)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          className="w-24 border rounded px-2 py-1"
                          value={form[`points_${round}`] ?? ''}
                          onChange={(e) => handleFieldChange(`points_${round}`, e.target.value)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          className="w-24 border rounded px-2 py-1"
                          value={form[`quota_diff_${round}`] ?? ''}
                          onChange={(e) => handleFieldChange(`quota_diff_${round}`, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex justify-end">
                <button
                  onClick={saveQuotaRow}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Quota Row'}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center text-gray-600">Select a player to edit quota history.</div>
        )}
      </div>
    </div>
  )
}
