import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { formatDateOnly } from '../utils/date'

export const Tournaments = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteModalTournamentId, setInviteModalTournamentId] = useState(null)
  const [inviteResult, setInviteResult] = useState(null)
  const [sendingInvitations, setSendingInvitations] = useState(null)

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

  const openInviteModal = (tournamentId) => {
    setInviteModalTournamentId(tournamentId)
    setShowInviteModal(true)
  }

  const handleSendInvitations = async (method) => {
    try {
      setSendingInvitations(inviteModalTournamentId)
      setInviteResult(null)
      const response = await tournamentsAPI.sendInvitations(inviteModalTournamentId, method)
      setInviteResult({ tournamentId: inviteModalTournamentId, ...response.data })
      setShowInviteModal(false)
      setTimeout(() => setInviteResult(null), 15000) // Clear after 15 seconds
    } catch (err) {
      console.error('Error sending invitations:', err)
      setError(err.response?.data?.error || 'Failed to send invitations')
    } finally {
      setSendingInvitations(null)
    }
  }

  const formatHolesLabel = (tournament) => {
    if (tournament.number_of_holes === 9) {
      const side = tournament.nine_hole_side === 'back' ? 'back' : 'front'
      return `${tournament.number_of_holes} (${side})`
    }
    return String(tournament.number_of_holes)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">🏆 Tournaments</h2>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/tournaments/add')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition"
              >
                + Add Tournament
              </button>
            </div>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        {inviteResult && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            <p className="font-semibold">✓ Invitations Sent Successfully!</p>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <p className="font-medium">📱 SMS:</p>
                <p>✓ Sent: {inviteResult.sms?.sent || 0}</p>
                {inviteResult.sms?.failed?.length > 0 && (
                  <p className="text-red-600">✗ Failed: {inviteResult.sms.failed.length}</p>
                )}
              </div>
              <div>
                <p className="font-medium">📧 Email:</p>
                <p>✓ Sent: {inviteResult.email?.sent || 0}</p>
                {inviteResult.email?.failed?.length > 0 && (
                  <p className="text-red-600">✗ Failed: {inviteResult.email.failed.length}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setInviteResult(null)}
              className="mt-2 text-xs text-green-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

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
                        {formatDateOnly(tournament.date)}
                      </td>
                      <td className="px-6 py-4 text-gray-900">{tournament.course_name}</td>
                      <td className="px-6 py-4 text-gray-900">{formatHolesLabel(tournament)}</td>
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
                                onClick={() => openInviteModal(tournament.id)}
                                disabled={sendingInvitations === tournament.id}
                                className="text-purple-600 hover:text-purple-800 text-sm font-medium disabled:text-gray-400"
                              >
                                {sendingInvitations === tournament.id ? '📧 Sending...' : '📧 Invitations'}
                              </button>
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

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Send Tournament Invitations</h2>
              
              <p className="text-gray-600 mb-4">
                Choose how you'd like to invite players to confirm their participation:
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleSendInvitations('sms')}
                  disabled={sendingInvitations}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <span>📱</span>
                  <span>Send SMS Only</span>
                </button>

                <button
                  onClick={() => handleSendInvitations('email')}
                  disabled={sendingInvitations}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <span>📧</span>
                  <span>Send Email Only</span>
                </button>

                <button
                  onClick={() => handleSendInvitations('both')}
                  disabled={sendingInvitations}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <span>📱📧</span>
                  <span>Send Both SMS & Email</span>
                </button>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowInviteModal(false)}
                  disabled={sendingInvitations}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
