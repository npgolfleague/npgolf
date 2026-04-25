import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, cartTagsAPI } from '../api'
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
  const [resultsEmailModal, setResultsEmailModal] = useState(null) // { subject, html, generated_at, sent_at, tournamentId }
  const [sendingResultsEmail, setSendingResultsEmail] = useState(false)
  const [resultsEmailSendResult, setResultsEmailSendResult] = useState(null)
  const [individualEmail, setIndividualEmail] = useState('')
  const [sendingIndividual, setSendingIndividual] = useState(false)
  const [resultsEmailMessage, setResultsEmailMessage] = useState('')
  const [sendingCartTags, setSendingCartTags] = useState(false)
  const [cartTagsResult, setCartTagsResult] = useState(null)

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

  const handleOpenResultsEmail = async (tournamentId) => {
    try {
      const response = await tournamentsAPI.getResultsEmail(tournamentId)
      setResultsEmailSendResult(null)
      setResultsEmailModal({ ...response.data, tournamentId })
    } catch (err) {
      if (err.response?.status === 404) {
        setResultsEmailSendResult(null)
        setResultsEmailModal({ noEmail: true, tournamentId })
      } else {
        setError(err.response?.data?.error || 'Failed to load results email')
      }
    }
  }

  const handleSendResultsEmail = async () => {
    if (!confirm('Send results email to all players with email notifications enabled?')) return
    try {
      setSendingResultsEmail(true)
      setResultsEmailSendResult(null)
      const response = await tournamentsAPI.sendResultsEmail(resultsEmailModal.tournamentId)
      setResultsEmailSendResult(response.data)
      setResultsEmailModal(prev => ({ ...prev, sent_at: new Date().toISOString() }))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send results email')
    } finally {
      setSendingResultsEmail(false)
    }
  }

  const handleSendIndividualEmail = async () => {
    if (!individualEmail.trim()) return
    try {
      setSendingIndividual(true)
      setResultsEmailSendResult(null)
      const response = await tournamentsAPI.sendResultsEmail(resultsEmailModal.tournamentId, individualEmail.trim())
      setResultsEmailSendResult({ sent: response.data.sent, failed: response.data.failed, individual: individualEmail.trim() })
      setIndividualEmail('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send results email')
    } finally {
      setSendingIndividual(false)
    }
  }

  const handleGenerateResultsEmail = async () => {
    try {
      setSendingResultsEmail(true)
      const response = await tournamentsAPI.generateResultsEmail(
        resultsEmailModal.tournamentId,
        resultsEmailMessage.trim() || null
      )
      setResultsEmailModal({ ...response.data, tournamentId: resultsEmailModal.tournamentId })
      setResultsEmailMessage('') // Clear message after generating
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate results email')
    } finally {
      setSendingResultsEmail(false)
    }
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

  const handleOpenCartTags = (tournamentId) => {
    // Open cart tags in new window for printing
    window.open(`/api/cart-tags/tournament/${tournamentId}`, '_blank')
  }

  const handleSendCartTags = async (tournamentId) => {
    if (!confirm('Send cart tags and tee sheet to the golf course email configured in settings?')) return
    try {
      setSendingCartTags(true)
      setCartTagsResult(null)
      const response = await cartTagsAPI.send(tournamentId)
      setCartTagsResult({ tournamentId, ...response.data })
      setTimeout(() => setCartTagsResult(null), 10000) // Clear after 10 seconds
    } catch (err) {
      console.error('Error sending cart tags:', err)
      setError(err.response?.data?.error || 'Failed to send cart tags')
    } finally {
      setSendingCartTags(false)
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

        {cartTagsResult && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            <p className="font-semibold">✓ Cart Tags Sent Successfully!</p>
            <p className="text-sm mt-1">{cartTagsResult.message}</p>
            <p className="text-xs mt-1">📧 Groups: {cartTagsResult.groups}</p>
            <button
              onClick={() => setCartTagsResult(null)}
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
                          {Number(tournament.is_completed || 0) === 1 && (
                            <button
                              onClick={() => navigate(`/tournaments/${tournament.id}/hole-scores`)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              ⛳ Hole Scores
                            </button>
                          )}
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
                                onClick={() => handleOpenCartTags(tournament.id)}
                                className="text-cyan-600 hover:text-cyan-800 text-sm font-medium"
                                title="View/Print Cart Tags"
                              >
                                🏷️ Cart Tags
                              </button>
                              <button
                                onClick={() => handleSendCartTags(tournament.id)}
                                disabled={sendingCartTags}
                                className="text-teal-600 hover:text-teal-800 text-sm font-medium disabled:text-gray-400"
                                title="Send Cart Tags to Golf Course"
                              >
                                {sendingCartTags ? '📧 Sending...' : '📧 Send Tags'}
                              </button>
                              <button
                                onClick={() => navigate(`/tournaments/${tournament.id}/edit`)}
                                className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleOpenResultsEmail(tournament.id)}
                                className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                              >
                                📊 Results Email
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

        {/* Results Email Modal */}
        {resultsEmailModal && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
              <div className="flex justify-between items-start p-5 border-b">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">📊 Tournament Results Email</h2>
                  {!resultsEmailModal.noEmail && <p className="text-sm text-gray-500 mt-1">{resultsEmailModal.subject}</p>}
                  {resultsEmailModal.sent_at && (
                    <p className="text-xs text-green-600 mt-1">✓ Last sent: {new Date(resultsEmailModal.sent_at).toLocaleString()}</p>
                  )}
                  {!resultsEmailModal.noEmail && !resultsEmailModal.sent_at && (
                    <p className="text-xs text-yellow-600 mt-1">⚠ Not yet sent</p>
                  )}
                </div>
                <button onClick={() => { setResultsEmailModal(null); setResultsEmailSendResult(null); setIndividualEmail('') }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              {resultsEmailModal.noEmail ? (
                <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
                  <p className="text-gray-600">No results email has been generated for this tournament yet.</p>
                  
                  {/* Custom Message Input */}
                  <div className="w-full max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                      Custom Message (Optional)
                    </label>
                    <textarea
                      value={resultsEmailMessage}
                      onChange={(e) => setResultsEmailMessage(e.target.value)}
                      placeholder="Add a custom message to include at the top of the results email..."
                      rows="3"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-left">This message will appear at the top of the results email</p>
                  </div>
                  
                  <button
                    onClick={handleGenerateResultsEmail}
                    disabled={sendingResultsEmail}
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-semibold"
                  >
                    {sendingResultsEmail ? 'Generating...' : '✨ Generate Results Email'}
                  </button>
                  <button
                    onClick={() => { setResultsEmailModal(null); setResultsEmailSendResult(null) }}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
              <>
              {resultsEmailSendResult && (
                <div className="mx-5 mt-4 p-3 bg-green-100 border border-green-300 rounded text-sm text-green-800">
                  {resultsEmailSendResult.individual
                    ? `✓ Sent to ${resultsEmailSendResult.individual}`
                    : `✓ Sent to ${resultsEmailSendResult.sent} player${resultsEmailSendResult.sent !== 1 ? 's' : ''}`
                  }
                  {resultsEmailSendResult.failed?.length > 0 && (
                    <span className="text-red-600 ml-2">({resultsEmailSendResult.failed.length} failed)</span>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-auto p-5">
                <iframe
                  srcDoc={resultsEmailModal.html}
                  title="Results Email Preview"
                  className="w-full border border-gray-200 rounded"
                  style={{ height: '450px' }}
                  sandbox="allow-same-origin"
                />
              </div>

              <div className="p-5 border-t bg-gray-50 rounded-b-lg space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={individualEmail}
                    onChange={e => setIndividualEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendIndividualEmail()}
                    placeholder="Send to a specific email address..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400"
                    disabled={sendingIndividual}
                  />
                  <button
                    onClick={handleSendIndividualEmail}
                    disabled={sendingIndividual || !individualEmail.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm font-semibold whitespace-nowrap"
                  >
                    {sendingIndividual ? 'Sending...' : '📧 Send'}
                  </button>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => { setResultsEmailModal(null); setResultsEmailSendResult(null); setIndividualEmail('') }}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSendResultsEmail}
                    disabled={sendingResultsEmail}
                    className="px-5 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 font-semibold"
                  >
                    {sendingResultsEmail ? 'Sending...' : '📧 Send to All Players'}
                  </button>
                </div>
              </div>
              </>
              )}
            </div>
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
