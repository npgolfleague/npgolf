import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tournamentsAPI, settingsAPI } from '../api';
import { AuthContext } from '../context/AuthContext';
import { formatDateOnly } from '../utils/date';

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
  const [inviteMessage, setInviteMessage] = useState('');
  const [editValues, setEditValues] = useState({});
  const [settings, setSettings] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileInput, setReconcileInput] = useState({ quota_collected: '', skins_collected: '' });
  const [reconcileSaved, setReconcileSaved] = useState(false);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  useEffect(() => {
    // initialize edit values from players
    const map = {}
    players.forEach(p => {
      map[p.id] = { foursome: p.foursome || '', pair: p.pair == null ? '' : String(p.pair), saving: false }
    })
    setEditValues(map)
  }, [players])

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [tournamentRes, playersRes, availableRes, settingsRes] = await Promise.all([
        tournamentsAPI.get(tournamentId),
        tournamentsAPI.getPlayers(tournamentId),
        tournamentsAPI.getAvailablePlayers(tournamentId),
        settingsAPI.get()
      ]);
      setTournament(tournamentRes.data);
      setPlayers(playersRes.data);
      setAvailablePlayers(availableRes.data);
      setSettings(settingsRes.data);
      // Sync reconcile inputs with saved values
      setReconcileInput({
        quota_collected: tournamentRes.data.quota_collected != null ? String(tournamentRes.data.quota_collected) : '',
        skins_collected: tournamentRes.data.skins_collected != null ? String(tournamentRes.data.skins_collected) : ''
      });
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
      const response = await tournamentsAPI.sendInvitations(tournamentId, method, null, inviteMessage.trim() || null);
      setInviteResult(response.data);
      setShowInviteModal(false);
      setInviteMessage(''); // Clear message after sending
    } catch (err) {
      console.error('Failed to send invitations:', err);
      setError(err.response?.data?.error || 'Failed to send invitations');
    } finally {
      setSendingSMS(false);
    }
  };

  const handleTogglePaid = async (playerId, currentPaidStatus) => {
    const newStatus = !currentPaidStatus;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, paid: newStatus } : p));
    try {
      await tournamentsAPI.updatePaidStatus(tournamentId, playerId, newStatus);
    } catch (err) {
      console.error('Failed to update paid status:', err);
      setError(err.response?.data?.error || 'Failed to update paid status');
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, paid: currentPaidStatus } : p));
    }
  };

  const handleToggleSkinsCtpPaid = async (playerId, currentStatus) => {
    const newStatus = !currentStatus;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, skins_ctp_paid: newStatus } : p));
    try {
      await tournamentsAPI.updateSkinsCtpPaidStatus(tournamentId, playerId, newStatus);
    } catch (err) {
      console.error('Failed to update skins/CTP paid status:', err);
      setError(err.response?.data?.error || 'Failed to update skins/CTP paid status');
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, skins_ctp_paid: currentStatus } : p));
    }
  };

  const saveFoursomePair = async (playerId) => {
    const ev = editValues[playerId]
    if (!ev) return
    const newGroup = ev.foursome && ev.foursome.trim() !== '' ? ev.foursome.trim() : null
    const newPair = ev.pair === '' ? null : Number(ev.pair)

    if (!newGroup) {
      // if trying to set pair without a group, prevent
      if (newPair != null) {
        alert('Please set a Foursome group before assigning a Pair')
        return
      }
      // nothing to do if both empty
      return
    }

    setEditValues(prev => ({ ...prev, [playerId]: { ...prev[playerId], saving: true } }))
    try {
      await tournamentsAPI.assignFoursomeGroup(tournamentId, newGroup, [playerId], { [playerId]: newPair })
      // update local players
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, foursome: newGroup, pair: newPair } : p))
    } catch (err) {
      console.error('Failed to save foursome/pair', err)
      setError(err.response?.data?.error || 'Failed to save foursome/pair')
    } finally {
      setEditValues(prev => ({ ...prev, [playerId]: { ...prev[playerId], saving: false } }))
    }
  }

  const handleEditChange = (playerId, field, value) => {
    setEditValues(prev => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }))
  }

  const handleMarkAllPaid = async () => {
    const unpaid = confirmedPlayers.filter(p => !p.paid);
    if (unpaid.length === 0) return;
    setPlayers(prev => prev.map(p => ({ ...p, paid: true })));
    try {
      await Promise.all(unpaid.map(p => tournamentsAPI.updatePaidStatus(tournamentId, p.id, true)));
    } catch (err) {
      console.error('Failed to mark all paid:', err);
      setError(err.response?.data?.error || 'Failed to mark all paid');
      await loadData();
    }
  };

  const handleMarkAllSkinsCtpPaid = async () => {
    const unpaid = confirmedPlayers.filter(p => !p.skins_ctp_paid);
    if (unpaid.length === 0) return;
    setPlayers(prev => prev.map(p => ({ ...p, skins_ctp_paid: true })));
    try {
      await Promise.all(unpaid.map(p => tournamentsAPI.updateSkinsCtpPaidStatus(tournamentId, p.id, true)));
    } catch (err) {
      console.error('Failed to mark all skins/CTP paid:', err);
      setError(err.response?.data?.error || 'Failed to mark all skins/CTP paid');
      await loadData();
    }
  };

  const handleSaveCollected = async () => {
    try {
      setReconciling(true);
      setReconcileSaved(false);
      await tournamentsAPI.updateCollected(
        tournamentId,
        reconcileInput.quota_collected !== '' ? reconcileInput.quota_collected : null,
        reconcileInput.skins_collected !== '' ? reconcileInput.skins_collected : null
      );
      // Refresh tournament data to reflect saved values
      const tournamentRes = await tournamentsAPI.get(tournamentId);
      setTournament(tournamentRes.data);
      setReconcileSaved(true);
    } catch (err) {
      console.error('Failed to save collected amounts:', err);
      setError(err.response?.data?.error || 'Failed to save collected amounts');
    } finally {
      setReconciling(false);
    }
  };

  const confirmedPlayers = players.filter(
    (player) => String(player.attending_status || '').toLowerCase() === 'yes'
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
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
              Date: {formatDateOnly(tournament.date)} | 
              Course ID: {tournament.course_id} | 
              Holes: {tournament.number_of_holes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={sendingSMS || actionLoading}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {sendingSMS ? 'Sending...' : '📧 Send Invitations'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleMarkAllPaid}
              disabled={confirmedPlayers.every(p => p.paid)}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-gray-400"
            >
              Mark All Quota Paid
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleMarkAllSkinsCtpPaid}
              disabled={confirmedPlayers.every(p => p.skins_ctp_paid)}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
            >
              Mark All Pins/Skins Paid
            </button>
          )}
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

      {/* Prize Money Reconciliation Panel - Admin Only */}
      {isAdmin && tournament && settings && (() => {
        const holeCount = Number(tournament.number_of_holes);
        const quotaFee = Number(holeCount === 9 ? settings.tournament_fee_9_holes : settings.tournament_fee_18_holes) || 0;
        const skinsFee = Number(holeCount === 9 ? settings.skins_ctp_fee_9_holes : settings.skins_ctp_fee_18_holes) || 0;
        const confirmedList = players.filter(p => String(p.attending_status || '').toLowerCase() === 'yes');
        const quotaPaidCount = confirmedList.filter(p => p.paid).length;
        const skinsPaidCount = confirmedList.filter(p => p.skins_ctp_paid).length;
        const calcQuota = quotaPaidCount * quotaFee;
        const calcSkins = skinsPaidCount * skinsFee;
        const enteredQuota = reconcileInput.quota_collected !== '' ? Number(reconcileInput.quota_collected) : null;
        const enteredSkins = reconcileInput.skins_collected !== '' ? Number(reconcileInput.skins_collected) : null;
        const quotaDiff = enteredQuota != null ? enteredQuota - calcQuota : null;
        const skinsDiff = enteredSkins != null ? enteredSkins - calcSkins : null;
        const quotaPrizePot = enteredQuota != null ? enteredQuota : calcQuota;
        const skinsTotalPot = enteredSkins != null ? enteredSkins : calcSkins;
        const isSaved = tournament.quota_collected != null || tournament.skins_collected != null;
        return (
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-5">
            <h3 className="text-lg font-bold text-amber-900 mb-1">💰 Prize Money Reconciliation</h3>
            <p className="text-xs text-amber-700 mb-4">
              Enter actual amounts collected. If different from calculated, the entered amount is used for all prize payouts on the leaderboard.
              {!isSaved && <span className="ml-1 font-semibold text-red-700">Dollar amounts will be hidden on the leaderboard until you save collected amounts below.</span>}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              {/* Quota Game */}
              <div className="bg-white rounded-lg border border-amber-200 p-4">
                <div className="font-semibold text-gray-800 mb-3">🏆 Quota Game</div>
                <div className="text-sm text-gray-600 mb-1">
                  Paid: <span className="font-semibold text-gray-900">{quotaPaidCount} players</span> × ${quotaFee.toFixed(2)} = <span className="font-semibold">${calcQuota.toFixed(2)}</span> calculated
                </div>
                <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">Actual Collected ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder={`${calcQuota.toFixed(2)}`}
                  value={reconcileInput.quota_collected}
                  onChange={e => { setReconcileInput(prev => ({ ...prev, quota_collected: e.target.value })); setReconcileSaved(false); }}
                />
                {quotaDiff != null && (
                  <div className={`mt-2 text-xs font-semibold ${quotaDiff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {quotaDiff === 0 ? '✓ Matches calculated' : `Discrepancy: ${quotaDiff > 0 ? '+' : ''}$${quotaDiff.toFixed(2)}`}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">Prize pot used: <span className="font-semibold text-gray-800">${quotaPrizePot.toFixed(2)}</span></div>
              </div>
              {/* Skins/CTP */}
              <div className="bg-white rounded-lg border border-amber-200 p-4">
                <div className="font-semibold text-gray-800 mb-3">🎯 Pins &amp; Skins</div>
                <div className="text-sm text-gray-600 mb-1">
                  Paid: <span className="font-semibold text-gray-900">{skinsPaidCount} players</span> × ${skinsFee.toFixed(2)} = <span className="font-semibold">${calcSkins.toFixed(2)}</span> calculated
                </div>
                <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">Actual Collected ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder={`${calcSkins.toFixed(2)}`}
                  value={reconcileInput.skins_collected}
                  onChange={e => { setReconcileInput(prev => ({ ...prev, skins_collected: e.target.value })); setReconcileSaved(false); }}
                />
                {skinsDiff != null && (
                  <div className={`mt-2 text-xs font-semibold ${skinsDiff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {skinsDiff === 0 ? '✓ Matches calculated' : `Discrepancy: ${skinsDiff > 0 ? '+' : ''}$${skinsDiff.toFixed(2)}`}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  Skins pot (60%): <span className="font-semibold text-gray-800">${(skinsTotalPot * 0.6).toFixed(2)}</span> &bull;
                  Pins pot (40%): <span className="font-semibold text-gray-800">${(skinsTotalPot * 0.4).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveCollected}
                disabled={reconciling}
                className="bg-amber-600 text-white px-5 py-2 rounded hover:bg-amber-700 disabled:bg-gray-400 font-semibold text-sm"
              >
                {reconciling ? 'Saving...' : '💾 Save Collected Amounts'}
              </button>
              {reconcileSaved && <span className="text-green-700 text-sm font-semibold">✓ Saved! Leaderboard will now show prize amounts.</span>}
              {isSaved && !reconcileSaved && <span className="text-blue-700 text-sm">Saved amounts loaded. Edit and save to update.</span>}
            </div>
          </div>
        );
      })()}

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-[980px] divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paid - Quota Game
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paid - Pins/Skins Game
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Foursome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pair
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
              )}
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quota
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registered
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {confirmedPlayers.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-6 py-4 text-center text-gray-500">
                  No players have confirmed they are playing yet
                </td>
              </tr>
            ) : (
              confirmedPlayers.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
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
                        {player.paid ? '✓ Quota Paid' : '✗ Not Paid'}
                      </button>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        player.paid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {player.paid ? '✓ Quota Paid' : '✗ Not Paid'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {isAdmin ? (
                      <button
                        onClick={() => handleToggleSkinsCtpPaid(player.id, player.skins_ctp_paid)}
                        disabled={actionLoading}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          player.skins_ctp_paid
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {player.skins_ctp_paid ? '✓ Skins Paid' : '✗ Not Paid'}
                      </button>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        player.skins_ctp_paid
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {player.skins_ctp_paid ? '✓ Skins Paid' : '✗ Not Paid'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAdmin ? (
                      <input
                        value={(editValues[player.id] && editValues[player.id].foursome) || ''}
                        onChange={(e) => handleEditChange(player.id, 'foursome', e.target.value)}
                        onBlur={() => saveFoursomePair(player.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveFoursomePair(player.id) }}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="e.g. 1"
                      />
                    ) : (
                      <div className="text-sm text-gray-500">{player.foursome || '-'}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAdmin ? (
                      <input
                        value={(editValues[player.id] && editValues[player.id].pair) || ''}
                        onChange={(e) => handleEditChange(player.id, 'pair', e.target.value)}
                        onBlur={() => saveFoursomePair(player.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveFoursomePair(player.id) }}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="-"
                      />
                    ) : (
                      <div className="text-sm text-gray-500">{player.pair == null ? '-' : player.pair}</div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{player.email}</div>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{player.phone || '-'}</div>
                    </td>
                  )}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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

            {/* Custom Message Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Message (Optional)
              </label>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Add a custom message to include in the invitation..."
                rows="3"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">This message will be added to the invitation</p>
            </div>

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
