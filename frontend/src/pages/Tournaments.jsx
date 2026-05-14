import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, cartTagsAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { ToastContext } from '../context/ToastContext'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatDateOnly } from '../utils/date'
import { Users, Trophy, Flag, Mail, Pencil, BarChart2, Trash2, Smartphone, Check, Tag, Sparkles } from 'lucide-react'

export const Tournaments = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { addToast } = useContext(ToastContext)
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
  const [confirmModal, setConfirmModal] = useState(null)

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

  const handleDelete = (id) => {
    const t = tournaments.find(t => t.id === id)
    const name = t ? `${t.course_name} (${formatDateOnly(t.date)})` : 'this tournament'
    setConfirmModal({
      title: 'Delete Tournament',
      message: `Delete "${name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await tournamentsAPI.delete(id)
          await fetchTournaments()
        } catch (err) {
          console.error('Error deleting tournament:', err)
          setError(err.response?.data?.error || 'Failed to delete tournament')
        }
      }
    })
  }

  const handleComplete = (id) => {
    const t = tournaments.find(t => t.id === id)
    const name = t ? `${t.course_name} (${formatDateOnly(t.date)})` : 'this tournament'
    setConfirmModal({
      title: 'Complete Tournament',
      message: `Complete "${name}"? This will update all players\' quota history.`,
      confirmLabel: 'Complete',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          const response = await tournamentsAPI.complete(id)
          addToast(`Tournament completed! ${response.data.playersUpdated} players updated.`, 'success')
          await fetchTournaments()
        } catch (err) {
          console.error('Error completing tournament:', err)
          setError(err.response?.data?.error || 'Failed to complete tournament')
        }
      }
    })
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

  const handleSendResultsEmail = () => {
    setConfirmModal({
      title: 'Send Results Email',
      message: 'Send results email to all players with email notifications enabled?',
      confirmLabel: 'Send',
      onConfirm: async () => {
        setConfirmModal(null)
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
    })
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
    // Open cart tags in new window for printing, with league prefix if present
    const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
    const commonRoutes = ['api', 'login', 'register', 'forgot-password', 'reset-password', 'sms-consent', 'dashboard', 'about', 'app', 'assets', 'billing-entities'];
    let leaguePrefix = '';
    if (pathParts.length > 0 && !commonRoutes.includes(pathParts[0])) {
      leaguePrefix = '/' + pathParts[0];
    }
    window.open(`${leaguePrefix}/api/cart-tags/tournament/${tournamentId}`, '_blank');
  }

  const handleSendCartTags = (tournamentId) => {
    const t = tournaments.find(t => t.id === tournamentId)
    const name = t ? `${t.course_name} (${formatDateOnly(t.date)})` : 'this tournament'
    setConfirmModal({
      title: 'Send Cart Tags',
      message: `Send cart tags and tee sheet for "${name}" to the golf course email configured in settings?`,
      confirmLabel: 'Send',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          setSendingCartTags(true)
          setCartTagsResult(null)
          const response = await cartTagsAPI.send(tournamentId)
          setCartTagsResult({ tournamentId, ...response.data })
          setTimeout(() => setCartTagsResult(null), 10000)
        } catch (err) {
          console.error('Error sending cart tags:', err)
          setError(err.response?.data?.error || 'Failed to send cart tags')
        } finally {
          setSendingCartTags(false)
        }
      }
    })
  }

  const formatHolesLabel = (tournament) => {
    if (tournament.number_of_holes === 9) {
      const side = tournament.nine_hole_side === 'back' ? 'back' : 'front'
      return `${tournament.number_of_holes} (${side})`
    }
    return String(tournament.number_of_holes)
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-6">
      <div className="w-full px-4 md:px-6 py-8 max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Tournaments</h1>
          <p className="text-slate-500 text-sm mt-1">Schedule and results</p>
        </div>
        <div className="flex justify-between items-center mb-6">
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/tournaments/add')}
                className="btn-primary"
              >
                <Trophy className="w-4 h-4" /> <span className="hidden sm:inline">Add Tournament</span>
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
                <p className="font-medium flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> SMS:</p>
                <p>✓ Sent: {inviteResult.sms?.sent || 0}</p>
                {inviteResult.sms?.failed?.length > 0 && (
                  <p className="text-red-600">✗ Failed: {inviteResult.sms.failed.length}</p>
                )}
              </div>
              <div>
                <p className="font-medium flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email:</p>
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
            <p className="text-xs mt-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Groups: {cartTagsResult.groups}</p>
            <button
              onClick={() => setCartTagsResult(null)}
              className="mt-2 text-xs text-green-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-200 rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th scope="col" aria-label="Tournament Date" className="px-4 md:px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th scope="col" aria-label="Golf Course" className="px-4 md:px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Course</th>
                    <th scope="col" aria-label="Number of Holes" className="px-4 md:px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Holes</th>
                    <th scope="col" aria-label="Location" className="px-4 md:px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Location</th>
                    <th scope="col" aria-label="Actions" className="px-4 md:px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 md:px-6 py-4 text-center text-gray-600">
                        No tournaments found
                      </td>
                    </tr>
                  ) : (
                    tournaments.map((tournament) => (
                      <tr key={tournament.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-4 text-gray-900 whitespace-nowrap">
                          {formatDateOnly(tournament.date)}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-gray-900 whitespace-nowrap">{tournament.course_name}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-900 whitespace-nowrap">{formatHolesLabel(tournament)}</td>
                        <td className="px-4 md:px-6 py-4 text-gray-900 whitespace-nowrap hidden md:table-cell">{tournament.course_address}</td>
                        <td className="px-4 md:px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 md:gap-2 flex-wrap">
                            <button
                              onClick={() => navigate(`/tournaments/${tournament.id}/players`)}
                              className="btn-ghost btn-xs text-blue-600 whitespace-nowrap"
                            >
                              <Users className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Players</span>
                            </button>
                            <button
                              onClick={() => navigate(`/tournaments/${tournament.id}/leaderboard`)}
                              className="btn-ghost btn-xs text-fairway-600 whitespace-nowrap"
                            >
                              <Trophy className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Leaderboard</span>
                            </button>
                            {Number(tournament.is_completed || 0) === 1 && (
                              <button
                                onClick={() => navigate(`/tournaments/${tournament.id}/hole-scores`)}
                                className="btn-ghost btn-xs text-indigo-600 whitespace-nowrap"
                              >
                                <Flag className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Hole Scores</span>
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => openInviteModal(tournament.id)}
                                  disabled={sendingInvitations === tournament.id}
                                  className="btn-ghost btn-xs text-purple-600 whitespace-nowrap"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">{sendingInvitations === tournament.id ? 'Sending...' : 'Invitations'}</span>
                                </button>
                                <button
                                  onClick={() => handleOpenCartTags(tournament.id)}
                                  className="text-cyan-600 hover:text-cyan-800 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                                  title="View/Print Cart Tags"
                                >
                                  <Tag className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Cart Tags</span>
                                </button>
                                <button
                                  onClick={() => handleSendCartTags(tournament.id)}
                                  disabled={sendingCartTags}
                                  className="text-teal-600 hover:text-teal-800 text-sm font-medium disabled:text-gray-400 flex items-center gap-1 whitespace-nowrap"
                                  title="Send Cart Tags to Golf Course"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">{sendingCartTags ? 'Sending...' : 'Send Tags'}</span>
                                </button>
                                <button
                                  onClick={() => navigate(`/tournaments/${tournament.id}/edit`)}
                                  className="text-yellow-600 hover:text-yellow-800 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Edit</span>
                                </button>
                                <button
                                  onClick={() => handleOpenResultsEmail(tournament.id)}
                                  className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                                >
                                  <BarChart2 className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Results</span>
                                </button>
                                <button
                                  onClick={() => handleComplete(tournament.id)}
                                  className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Complete</span>
                                </button>
                                <button
                                  onClick={() => handleDelete(tournament.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Delete</span>
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
          </div>
        )}

        <ConfirmModal
          isOpen={!!confirmModal}
          title={confirmModal?.title}
          message={confirmModal?.message}
          confirmLabel={confirmModal?.confirmLabel}
          danger={confirmModal?.danger}
          onConfirm={confirmModal?.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />

        {/* Results Email Modal */}
        {resultsEmailModal && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col my-8" style={{ maxHeight: '90vh' }}>
              <div className="flex justify-between items-start p-4 md:p-5 border-b">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate">Tournament Results Email</h2>
                  {!resultsEmailModal.noEmail && <p className="text-sm text-gray-500 mt-1 truncate">{resultsEmailModal.subject}</p>}
                  {resultsEmailModal.sent_at && (
                    <p className="text-xs text-green-600 mt-1">✓ Last sent: {new Date(resultsEmailModal.sent_at).toLocaleString()}</p>
                  )}
                  {!resultsEmailModal.noEmail && !resultsEmailModal.sent_at && (
                    <p className="text-xs text-yellow-600 mt-1">⚠ Not yet sent</p>
                  )}
                </div>
                <button onClick={() => { setResultsEmailModal(null); setResultsEmailSendResult(null); setIndividualEmail('') }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2 flex-shrink-0">&times;</button>
              </div>

              {resultsEmailModal.noEmail ? (
                <div className="flex flex-col items-center justify-center p-6 md:p-12 text-center gap-4 overflow-y-auto">
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
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 font-semibold flex items-center gap-2 mx-auto"
                  >
                    {sendingResultsEmail ? 'Generating...' : <><Sparkles className="w-4 h-4" /> Generate Results Email</>}
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
                <div className="mx-4 md:mx-5 mt-4 p-3 bg-green-100 border border-green-300 rounded text-sm text-green-800">
                  {resultsEmailSendResult.individual
                    ? `✓ Sent to ${resultsEmailSendResult.individual}`
                    : `✓ Sent to ${resultsEmailSendResult.sent} player${resultsEmailSendResult.sent !== 1 ? 's' : ''}`
                  }
                  {resultsEmailSendResult.failed?.length > 0 && (
                    <span className="text-red-600 ml-2">({resultsEmailSendResult.failed.length} failed)</span>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-auto p-4 md:p-5">
                <iframe
                  srcDoc={resultsEmailModal.html}
                  title="Results Email Preview"
                  className="w-full border border-gray-200 rounded"
                  style={{ height: '450px' }}
                  sandbox="allow-same-origin"
                />
              </div>

              <div className="p-4 md:p-5 border-t bg-gray-50 rounded-b-lg space-y-3">
                {/* Regenerate with custom message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Message (Optional)</label>
                  <div className="flex gap-2">
                    <textarea
                      value={resultsEmailMessage}
                      onChange={(e) => setResultsEmailMessage(e.target.value)}
                      placeholder="Add a custom message to include at the top of the results email..."
                      rows="2"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={handleGenerateResultsEmail}
                      disabled={sendingResultsEmail}
                      className="px-3 py-2 bg-orange-100 text-orange-700 border border-orange-300 rounded hover:bg-orange-200 disabled:bg-gray-100 text-sm font-semibold whitespace-nowrap self-start"
                    >
                      {sendingResultsEmail ? 'Regenerating...' : <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Regenerate</span>}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
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
                    {sendingIndividual ? 'Sending...' : <span className="flex items-center gap-1 justify-center"><Mail className="w-3.5 h-3.5" /> Send</span>}
                  </button>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
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
                    {sendingResultsEmail ? 'Sending...' : <span className="flex items-center gap-1 justify-center"><Mail className="w-3.5 h-3.5" /> Send to All Players</span>}
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
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg md:text-xl font-bold mb-4">Send Tournament Invitations</h2>
              
              <p className="text-gray-600 mb-4 text-sm md:text-base">
                Choose how you'd like to invite players to confirm their participation:
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleSendInvitations('sms')}
                  disabled={sendingInvitations}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Send SMS Only</span>
                </button>

                <button
                  onClick={() => handleSendInvitations('email')}
                  disabled={sendingInvitations}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Email Only</span>
                </button>

                <button
                  onClick={() => handleSendInvitations('both')}
                  disabled={sendingInvitations}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" /><Mail className="w-4 h-4" />
                  <span>Send Both SMS &amp; Email</span>
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
