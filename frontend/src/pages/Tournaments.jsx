import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI } from '../api'
import { AuthContext } from '../context/AuthContext'

export const Tournaments = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      setLoading(true)
      const response = await tournamentsAPI.list()
      setTournaments(response.data)
      setError('')
    } catch (err) {
      console.error('Error fetching tournaments:', err)
      setError('Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return

    try {
      await tournamentsAPI.delete(id)
      await fetchTournaments()
    } catch (err) {
      console.error('Error deleting tournament:', err)
      setError(err.response?.data?.error || 'Failed to delete tournament')
    }
  }

  const handleComplete = async (id) => {
    if (!confirm('Are you sure you want to complete this tournament? This will update all players\' quota history.')) return

    try {
      const response = await tournamentsAPI.complete(id)
      alert(`Tournament completed! ${response.data.playersUpdated} players updated.`)
      await fetchTournaments()
    } catch (err) {
      console.error('Error completing tournament:', err)
      setError(err.response?.data?.error || 'Failed to complete tournament')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">🏆 Tournaments</h2>
          {isAdmin && (
            <button
              onClick={() => navigate('/tournaments/add')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition"
            >
              + Add Tournament
            </button>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-600">Loading tournaments...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Date</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Course</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Holes</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Location</th>
                  <th className="px-6 py-3 text-right text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-600">
                      No tournaments found
                    </td>
                  </tr>
                ) : (
                  tournaments.map((tournament) => (
                    <tr key={tournament.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900">
                        {new Date(tournament.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-900">{tournament.course_name}</td>
                      <td className="px-6 py-4 text-gray-900">{tournament.number_of_holes}</td>
                      <td className="px-6 py-4 text-gray-900">{tournament.course_address}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => navigate(`/tournaments/${tournament.id}/players`)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            👥 Players
                          </button>
                          <button
                            onClick={() => navigate(`/tournaments/${tournament.id}/leaderboard`)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            🏆 Leaderboard
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => navigate(`/tournaments/${tournament.id}/edit`)}
                                className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleComplete(tournament.id)}
                                className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                              >
                                ✓ Complete
                              </button>
                              <button
                                onClick={() => handleDelete(tournament.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
