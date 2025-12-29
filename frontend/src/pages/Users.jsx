import { useState, useEffect, useContext } from 'react'
import { playersAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { EditPlayerModal } from '../components/EditPlayerModal'

export const Users = () => {
  const { user } = useContext(AuthContext)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingPlayer, setEditingPlayer] = useState(null)

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
      setError(err.response?.data?.error || 'Failed to fetch players')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (player) => {
    setEditingPlayer(player)
  }

  const handleCloseModal = () => {
    setEditingPlayer(null)
  }

  const handleSave = (updatedPlayer) => {
    // If it's a new player (not in list), add it; otherwise update
    const exists = players.some(p => p.id === updatedPlayer.id)
    if (exists) {
      setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p))
    } else {
      setPlayers(prev => [updatedPlayer, ...prev])
    }
    setEditingPlayer(null)
  }

  const canEditPlayer = (player) => {
    // Admin can edit all players, regular users can only edit themselves
    const isAdmin = user?.role === 'admin'
    return isAdmin || (user?.id === player?.id)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Players</h2>
          {user?.role === 'admin' && (
            <button
              onClick={() => setEditingPlayer({})}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              + Add Player
            </button>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-600">Loading players...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Phone</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">SMS</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Quota</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">FedEx Pts</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Tournaments</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Total Prize Money YTD</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-4 text-center text-gray-600">
                      No players found
                    </td>
                  </tr>
                ) : (
                  players.map((player, index) => (
                    <tr key={index} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900">{player.name}</td>
                      <td className="px-6 py-4 text-gray-900">{player.email}</td>
                      <td className="px-6 py-4 text-gray-900">{player.phone || '-'}</td>
                      <td className="px-6 py-4 text-center">{player.sms_allowed ? '✓' : '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{player.quota || '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{player.fedex_points?.toLocaleString() || '0'}</td>
                      <td className="px-6 py-4 text-gray-900">{player.tournaments_played || '0'}</td>
                      <td className="px-6 py-4 text-gray-900">${(player.prize_money || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">
                        {canEditPlayer(player) ? (
                          <button 
                            onClick={() => handleEdit(player)}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Edit
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {editingPlayer && (
          <EditPlayerModal
            player={editingPlayer}
            onClose={handleCloseModal}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  )
}
