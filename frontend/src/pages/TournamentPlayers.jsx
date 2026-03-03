import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tournamentsAPI } from '../api';
import { AuthContext } from '../context/AuthContext';

export function TournamentPlayers() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsResult, setSmsResult] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [tournamentRes, playersRes, availableRes] = await Promise.all([
        tournamentsAPI.get(tournamentId),
        tournamentsAPI.getPlayers(tournamentId),
        tournamentsAPI.getAvailablePlayers(tournamentId)
      ]);
      setTournament(tournamentRes.data);
      setPlayers(playersRes.data);
      setAvailablePlayers(availableRes.data);
    } catch (err) {
      console.error('Failed to load tournament data:', err);
      setError(err.response?.data?.error || 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedPlayerId) return;
    
    try {
      setActionLoading(true);
      await tournamentsAPI.addPlayer(tournamentId, selectedPlayerId);
      setShowAddModal(false);
      setSelectedPlayerId('');
      await loadData();
    } catch (err) {
      console.error('Failed to add player:', err);
      setError(err.response?.data?.error || 'Failed to add player');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (!confirm('Are you sure you want to remove this player from the tournament?')) return;
    
    try {
      setActionLoading(true);
      await tournamentsAPI.removePlayer(tournamentId, playerId);
      await loadData();
    } catch (err) {
      console.error('Failed to remove player:', err);
      setError(err.response?.data?.error || 'Failed to remove player');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendSMSInvites = async () => {
    if (!confirm('Send SMS invites to all active players with SMS enabled?')) return;
    
    try {
      setSendingSMS(true);
      setSmsResult(null);
      const response = await tournamentsAPI.sendInviteSMS(tournamentId);
      setSmsResult(response.data);
    } catch (err) {
      console.error('Failed to send SMS invites:', err);
      setError(err.response?.data?.error || 'Failed to send SMS invites');
    } finally {
      setSendingSMS(false);
    }
  };

  const handleSendInvitations = async (method) => {
    try {
      setSendingSMS(true);
      setInviteResult(null);
      const response = await tournamentsAPI.sendInvitations(tournamentId, method);
      setInviteResult(response.data);
      setShowInviteModal(false);
    } catch (err) {
      console.error('Failed to send invitations:', err);
      setError(err.response?.data?.error || 'Failed to send invitations');
    } finally {
      setSendingSMS(false);
    }
  };

  const handleTogglePaid = async (playerId, currentPaidStatus) => {
    try {
      setActionLoading(true);
      await tournamentsAPI.updatePaidStatus(tournamentId, playerId, !currentPaidStatus);
      await loadData();
    } catch (err) {
      console.error('Failed to update paid status:', err);
      setError(err.response?.data?.error || 'Failed to update paid status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('/tournaments')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to Tournaments
          </button>
          <h1 className="text-3xl font-bold">Tournament Players</h1>
          {tournament && (
            <p className="text-gray-600 mt-2">
              Date: {new Date(tournament.date).toLocaleDateString()} | 
              Course ID: {tournament.course_id} | 
              Holes: {tournament.number_of_holes}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            disabled={sendingSMS || actionLoading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {sendingSMS ? 'Sending...' : '📧 Send Invitations'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={actionLoading || availablePlayers.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Add Player
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {inviteResult && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
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

      {smsResult && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-semibold">SMS Invites Sent Successfully!</p>
          <p className="text-sm mt-1">✓ Sent: {smsResult.sent} messages</p>
          {smsResult.failed && smsResult.failed.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-red-600">✗ Failed: {smsResult.failed.length} messages</p>
              <ul className="text-xs mt-1 ml-4 list-disc">
                {smsResult.failed.map((fail, idx) => (
                  <li key={idx}>{fail.phone}: {fail.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quota
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registered
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paid
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  No players registered for this tournament
                </td>
              </tr>
            ) : (
              players.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{player.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{player.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {tournament?.number_of_holes === 9 ? player.quota_9 || '-' : player.quota_18 || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(player.registration_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      player.attending_status === 'yes'
                        ? 'bg-green-100 text-green-800'
                        : player.attending_status === 'no'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {player.attending_status === 'yes' && '✓ Yes'}
                      {player.attending_status === 'no' && '✗ No'}
                      {player.attending_status === 'pending' && '⏱ Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {isAdmin ? (
                      <button
                        onClick={() => handleTogglePaid(player.id, player.paid)}
                        disabled={actionLoading}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          player.paid
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } disabled:opacity-50`}
                      >
                        {player.paid ? '✓ Paid' : '✗ Unpaid'}
                      </button>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        player.paid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {player.paid ? '✓ Paid' : '✗ Unpaid'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {isAdmin && (
                      <button
                        onClick={() => handleRemovePlayer(player.id)}
                        disabled={actionLoading}
                        className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                disabled={sendingSMS}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                <span>📱</span>
                <span>Send SMS Only</span>
              </button>

              <button
                onClick={() => handleSendInvitations('email')}
                disabled={sendingSMS}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                <span>📧</span>
                <span>Send Email Only</span>
              </button>

              <button
                onClick={() => handleSendInvitations('both')}
                disabled={sendingSMS}
                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                <span>📱📧</span>
                <span>Send Both SMS & Email</span>
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowInviteModal(false)}
                disabled={sendingSMS}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add Player to Tournament</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Player
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">-- Select a player --</option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.email})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedPlayerId('');
                  setError('');
                }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                disabled={!selectedPlayerId || actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {actionLoading ? 'Adding...' : 'Add Player'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
