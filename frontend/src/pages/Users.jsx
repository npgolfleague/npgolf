import { useState, useEffect, useContext } from 'react'
import { playersAPI, tournamentsAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { EditPlayerModal } from '../components/EditPlayerModal'
import { formatDateOnly } from '../utils/date'

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
  const [invitingPlayerId, setInvitingPlayerId] = useState(null)
  const [inviteModal, setInviteModal] = useState({ open: false, player: null })
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [quotaTooltip, setQuotaTooltip] = useState({ show: false, playerId: null, data: [] })

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await playersAPI.list()
      setPlayers([...response.data].sort((a, b) => {
        if (b.active !== a.active) return b.active - a.active
        return a.name.localeCompare(b.name)
      }))
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
        const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
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

  const handleOpenInviteModal = (player) => {
    setInviteModal({ open: true, player })
    setError('')
    setInviteSuccess('')
  }

  const handleCloseInviteModal = () => {
    if (invitingPlayerId) return
    setInviteModal({ open: false, player: null })
  }

  const handleSendInvitation = async (method) => {
    const player = inviteModal.player
    if (!player) return

    const eligibility = getInviteEligibility(player)
    if (method === 'sms' && !eligibility.smsEligible) {
      setError(eligibility.smsReason || 'Player is not eligible for SMS invites')
      return
    }
    if (method === 'email' && !eligibility.emailEligible) {
      setError(eligibility.emailReason || 'Player is not eligible for email invites')
      return
    }
    if (method === 'both' && !eligibility.smsEligible && !eligibility.emailEligible) {
      setError('Player is not eligible for SMS or email invites')
      return
    }

    setInvitingPlayerId(player.id)
    setError('')
    setInviteSuccess('')

    try {
      const nextTournamentResponse = await tournamentsAPI.next()
      const nextTournament = nextTournamentResponse.data

      if (!nextTournament) {
        setError('No upcoming tournament found to send invitations for')
        return
      }

      const response = await tournamentsAPI.sendInvitations(nextTournament.id, method, player.id)
      const smsSent = response.data?.sms?.sent || 0
      const emailSent = response.data?.email?.sent || 0

      setInviteSuccess(`Invitation sent to ${player.name} (SMS: ${smsSent}, Email: ${emailSent})`)
      setInviteModal({ open: false, player: null })
    } catch (err) {
      setError(err.response?.data?.error || `Failed to send invitation to ${player.name}`)
    } finally {
      setInvitingPlayerId(null)
    }
  }

  const canEditPlayer = (player) => {
    // Admin can edit all players, regular users can only edit themselves
    const isAdmin = user?.role === 'admin'
    return isAdmin || (user?.id === player?.id)
  }

  const getInviteEligibility = (player) => {
    if (!player) {
      return {
        smsEligible: false,
        emailEligible: false,
        smsReason: 'No player selected',
        emailReason: 'No player selected'
      }
    }

    if (!player.active) {
      return {
        smsEligible: false,
        emailEligible: false,
        smsReason: 'Player is inactive',
        emailReason: 'Player is inactive'
      }
    }

    const hasPhone = Boolean(player.phone && String(player.phone).trim())
    const hasEmail = Boolean(player.email && String(player.email).trim())

    const smsEligible = Boolean(player.sms_allowed && hasPhone)
    const emailEligible = Boolean(player.email_allowed && hasEmail)

    let smsReason = ''
    if (!player.sms_allowed) smsReason = 'SMS not enabled by player'
    else if (!hasPhone) smsReason = 'No phone number on file'

    let emailReason = ''
    if (!player.email_allowed) emailReason = 'Email not enabled by player'
    else if (!hasEmail) emailReason = 'No email on file'

    return { smsEligible, emailEligible, smsReason, emailReason }
  }

  const inviteEligibility = getInviteEligibility(inviteModal.player)
  const bothInviteEligible = inviteEligibility.smsEligible || inviteEligibility.emailEligible

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="w-full px-4 py-8">
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
        {inviteSuccess && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{inviteSuccess}</div>}

        {loading ? (
          <div className="text-center text-gray-600">Loading players...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Actions</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Name</th>
                  {user?.role === 'admin' && <th className="px-6 py-3 text-left text-gray-700 font-semibold">Email</th>}
                  {user?.role === 'admin' && <th className="px-6 py-3 text-left text-gray-700 font-semibold">Phone</th>}
                  <th className="px-6 py-3 text-center text-gray-700 font-semibold">Active</th>
                  <th className="px-6 py-3 text-center text-gray-700 font-semibold">SMS</th>
                  <th className="px-6 py-3 text-center text-gray-700 font-semibold">Email OK</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">18H Quota</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">9H Quota</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Paradise Pts</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Tournaments</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-semibold">Total Prize Money YTD</th>
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
                              onClick={() => handleOpenInviteModal(player)}
                              disabled={invitingPlayerId === player.id}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold ml-2 disabled:opacity-50"
                              title="Send invitation for the next tournament"
                            >
                              {invitingPlayerId === player.id ? 'Sending...' : 'Invite...'}
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
                      <td className="px-6 py-4 text-gray-900">{player.name}</td>
                      {user?.role === 'admin' && <td className="px-6 py-4 text-gray-900">{player.email}</td>}
                      {user?.role === 'admin' && <td className="px-6 py-4 text-gray-900">{player.phone || '-'}</td>}
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
                                  <span>{formatDateOnly(round.date)}</span>
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

        {inviteModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-2">Send Invitation</h3>
              <p className="text-gray-700 mb-4">
                Send next tournament invitation to <span className="font-semibold">{inviteModal.player?.name}</span> using:
              </p>

              <div className="grid grid-cols-1 gap-2 mb-4">
                <button
                  onClick={() => handleSendInvitation('sms')}
                  disabled={Boolean(invitingPlayerId) || !inviteEligibility.smsEligible}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                >
                  {invitingPlayerId ? 'Sending...' : 'SMS Only'}
                </button>
                {!inviteEligibility.smsEligible && (
                  <p className="text-xs text-gray-600">SMS unavailable: {inviteEligibility.smsReason}</p>
                )}
                <button
                  onClick={() => handleSendInvitation('email')}
                  disabled={Boolean(invitingPlayerId) || !inviteEligibility.emailEligible}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50"
                >
                  {invitingPlayerId ? 'Sending...' : 'Email Only'}
                </button>
                {!inviteEligibility.emailEligible && (
                  <p className="text-xs text-gray-600">Email unavailable: {inviteEligibility.emailReason}</p>
                )}
                <button
                  onClick={() => handleSendInvitation('both')}
                  disabled={Boolean(invitingPlayerId) || !bothInviteEligible}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50"
                >
                  {invitingPlayerId ? 'Sending...' : 'Both SMS + Email'}
                </button>
                {!bothInviteEligible && (
                  <p className="text-xs text-gray-600">No available invitation channels for this player.</p>
                )}
              </div>

              <button
                onClick={handleCloseInviteModal}
                disabled={Boolean(invitingPlayerId)}
                className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
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
