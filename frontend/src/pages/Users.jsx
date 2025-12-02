import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersAPI } from '../api'
import { AuthContext } from '../context/AuthContext'

export const Users = () => {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await usersAPI.list()
      setPlayers(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch players')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">npgolf</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {user?.name}!</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Players</h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-600">Loading players...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">ID</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Sex</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Active</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Quota</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Created At</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-600">
                      No players found
                    </td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <tr key={player.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900">{player.id}</td>
                      <td className="px-6 py-4 text-gray-900">{player.name}</td>
                      <td className="px-6 py-4 text-gray-900">{player.email}</td>
                      <td className="px-6 py-4 text-gray-900">{player.sex || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${player.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {player.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{player.quota || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(player.created_at).toLocaleDateString()}</td>
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
