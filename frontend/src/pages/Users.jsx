import { useState, useEffect, useContext } from 'react'
import { playersAPI, tournamentsAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { EditPlayerModal } from '../components/EditPlayerModal'

export const Users = () => {
  const { user } = useContext(AuthContext)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [smsModal, setSmsModal] = useState({ open: false, player: null })
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsSuccess, setSmsSuccess] = useState('')
  const [quotaTooltip, setQuotaTooltip] = useState({ show: false, playerId: null, data: [] })

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

  const handleDelete = async (player) => {
    if (!confirm(`Are you sure you want to delete ${player.name}? This will deactivate the player.`)) return

    try {
      await playersAPI.delete(player.id)
      setPlayers(prev => prev.filter(p => p.id !== player.id))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete player')
    }
  }

  const handleOpenSmsModal = async (player) => {
    setSmsModal({ open: true, player })
    setSmsSuccess('')
    setError('')
    
    // Try to get next tournament and generate default message
    try {
      const response = await tournamentsAPI.next()
      const tournament = response.data
      
      if (tournament) {
        const tournamentDate = new Date(tournament.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const baseUrl = window.location.origin
        const rsvpLink = `${baseUrl}/api/tournaments/${tournament.id}/rsvp?playerId=${player.id}`
        const defaultMessage = `If you are playing ${tournament.course_name} ${tournamentDate} click this link ${rsvpLink}`
        setSmsMessage(defaultMessage)
      } else {
        setSmsMessage('')
      }
    } catch (err) {
      console.error('Failed to load tournament:', err)
      setSmsMessage('')
    }
  }

  const handleCloseSmsModal = () => {
    setSmsModal({ open: false, player: null })
    setSmsMessage('')
    setSmsSending(false)
  }

  const handleSendSMS = async () => {
    if (!smsMessage.trim()) return
    
    setSmsSending(true)
    setError('')
    setSmsSuccess('')
    
    try {
      await playersAPI.sendSMS(smsModal.player.id, smsMessage)
      setSmsSuccess(`SMS sent to ${smsModal.player.name}`)
      setTimeout(() => {
        handleCloseSmsModal()
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send SMS')
    } finally {
      setSmsSending(false)
    }
  }

  const handleQuotaHover = async (playerId) => {
    try {
      const response = await playersAPI.getQuotaHistory(playerId)
      setQuotaTooltip({ show: true, playerId, data: response.data })
    } catch (err) {
      console.error('Error loading quota history:', err)
    }
  }

  const handleQuotaLeave = () => {
    setQuotaTooltip({ show: false, playerId: null, data: [] })
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
                  <th className="px-6 py-3 text-center text-gray-700 font-semibold">Active</th>
                  <th className="px-6 py-3 text-center text-gray-700 font-semibold">SMS</th>
                  <th className="px-6 py-3 text-center text-gray-700 font-semibold">Email OK</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">18H Quota</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">9H Quota</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Paradise Pts</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Tournaments</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Total Prize Money YTD</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-6 py-4 text-center text-gray-600">
                      No players found
                    </td>
                  </tr>
                ) : (
                  players.map((player, index) => (
                    <tr key={index} className={`border-t hover:bg-gray-50 ${!player.active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 text-gray-900">{player.name}</td>
                      <td className="px-6 py-4 text-gray-900">{player.email}</td>
                      <td className="px-6 py-4 text-gray-900">{player.phone || '-'}</td>
                      <td className="px-6 py-4 text-center">{player.active ? '✓' : '-'}</td>
                      <td className="px-6 py-4 text-center">{player.sms_allowed ? '✓' : '-'}</td>
                      <td className="px-6 py-4 text-center">{player.email_allowed ? '✓' : '-'}</td>
                      <td className="px-6 py-4 text-gray-900 relative">
                        <div 
                          onMouseEnter={() => handleQuotaHover(player.id)}
                          onMouseLeave={handleQuotaLeave}
                          className="cursor-help inline-block"
                        >
                          {player.quota_18 || '-'}
                          {quotaTooltip.show && quotaTooltip.playerId === player.id && quotaTooltip.data.length > 0 && (
                            <div className="absolute z-10 left-0 bottom-full mb-1 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 w-48">
                              <div className="font-bold mb-2">Last 7 Rounds</div>
                              {quotaTooltip.data.map((round, idx) => (
                                <div key={idx} className="flex justify-between py-1 border-b border-gray-700 last:border-0">
                                  <span>{new Date(round.date).toLocaleDateString()}</span>
                                  <span className="font-semibold">{round.points} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{player.quota_9 || '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{player.fedex_points?.toLocaleString() || '0'}</td>
                      <td className="px-6 py-4 text-gray-900">{player.tournaments_played || '0'}</td>
                      <td className="px-6 py-4 text-gray-900">${(player.prize_money || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
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
                          {user?.role === 'admin' && player.phone && (
                            <button 
                              onClick={() => handleOpenSmsModal(player)}
                              className="text-green-600 hover:text-green-800 font-semibold ml-2"
                              title="Send SMS"
                            >
                              📱
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button 
                              onClick={() => handleDelete(player)}
                              className="text-red-600 hover:text-red-800 font-semibold ml-2"
                            >
                              Delete
                            </button>
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

        {smsModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Send SMS to {smsModal.player?.name}</h3>
              
              {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
              {smsSuccess && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded text-sm">{smsSuccess}</div>}
              
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Message</label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  rows="4"
                  placeholder="Enter your message..."
                  disabled={smsSending}
                />
                <p className="text-sm text-gray-600 mt-1">
                  To: {smsModal.player?.phone}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleSendSMS}
                  disabled={smsSending || !smsMessage.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
                >
                  {smsSending ? 'Sending...' : 'Send SMS'}
                </button>
                <button
                  onClick={handleCloseSmsModal}
                  disabled={smsSending}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
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
