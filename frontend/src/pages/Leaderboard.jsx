import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leaderboardAPI, tournamentsAPI, scoresAPI } from '../api';
import { formatDateOnly } from '../utils/date';

export function Leaderboard() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [tournamentPlayers, setTournamentPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [ctpWinners, setCtpWinners] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedPlayerScores, setSelectedPlayerScores] = useState([]);
  const [loadingPlayerScores, setLoadingPlayerScores] = useState(false);
  const [playerScoresError, setPlayerScoresError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  useEffect(() => {
    if (!selectedPlayerId || !tournamentId) {
      setSelectedPlayerScores([]);
      setPlayerScoresError('');
      return;
    }

    loadSelectedPlayerScores(selectedPlayerId);
  }, [selectedPlayerId, tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [tournamentRes, playersRes, leaderboardRes, ctpRes] = await Promise.all([
        tournamentsAPI.get(tournamentId),
        tournamentsAPI.getPlayers(tournamentId),
        leaderboardAPI.get(tournamentId),
        scoresAPI.getCtpWinners(tournamentId)
      ]);
      setTournament(tournamentRes.data);
      setTournamentPlayers(playersRes.data || []);
      setLeaderboard(leaderboardRes.data);
      setCtpWinners(ctpRes.data);
      setSelectedPlayerId('');
      setSelectedPlayerScores([]);
      setPlayerScoresError('');
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError(err.response?.data?.error || 'Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const getScoreColor = (overUnder) => {
    if (overUnder > 0) return 'text-green-600 font-bold';
    if (overUnder < 0) return 'text-red-600 font-bold';
    return 'text-gray-600 font-bold';
  };

  const loadSelectedPlayerScores = async (playerId) => {
    try {
      setLoadingPlayerScores(true);
      setPlayerScoresError('');

      const response = await scoresAPI.list({
        tournament_id: tournamentId,
        player_id: playerId
      });

      const sortedScores = [...response.data].sort((a, b) => a.hole_number - b.hole_number);
      setSelectedPlayerScores(sortedScores);
    } catch (err) {
      console.error('Failed to load selected player scores:', err);
      setSelectedPlayerScores([]);
      setPlayerScoresError(err.response?.data?.error || 'Failed to load player scores');
    } finally {
      setLoadingPlayerScores(false);
    }
  };

  const selectedPlayerTotals = selectedPlayerScores.reduce(
    (totals, scoreRow) => {
      totals.strokes += Number(scoreRow.score || 0);
      totals.quotaPoints += Number(scoreRow.quota || 0);
      return totals;
    },
    { strokes: 0, quotaPoints: 0 }
  );

  const payoutSummary = leaderboard.length > 0
    ? {
        skinsPlayers: leaderboard[0].skins_ctp_paid_players || 0,
        skinsFee: Number(leaderboard[0].skins_ctp_fee || 0),
        totalPot: Number(leaderboard[0].skins_ctp_total_pot || 0),
        skinsPot: Number(leaderboard[0].skin_prize_pot || 0),
        pinsPot: Number(leaderboard[0].ctp_prize_pot || 0)
      }
    : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/dashboard')}
          className="text-blue-600 hover:text-blue-800 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold">🏆 Tournament Leaderboard</h1>
        {tournament && (
          <p className="text-gray-600 mt-2">
            Date: {formatDateOnly(tournament.date)} | 
            Course: {tournament.course_name} | 
            Holes: {tournament.number_of_holes}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {leaderboard.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 text-lg">No scores recorded yet for this tournament.</p>
        </div>
      ) : (
        <>
        {payoutSummary && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-900 mb-1">Pins &amp; Skins Split</h3>
            <p className="text-sm text-indigo-800">
              Paid players: {payoutSummary.skinsPlayers} × ${payoutSummary.skinsFee.toFixed(2)} = ${payoutSummary.totalPot.toFixed(2)} total
            </p>
            <p className="text-sm text-indigo-800">
              Skins Pot (60%): <span className="font-semibold">${payoutSummary.skinsPot.toFixed(2)}</span> | Pins Pot (40%): <span className="font-semibold">${payoutSummary.pinsPot.toFixed(2)}</span>
            </p>
          </div>
        )}
        <div className="bg-white shadow-md rounded-lg overflow-x-auto w-full">
          <table className="min-w-[1200px] w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Quota
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Total Pts
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Over/Under
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Quota Prize
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Skins
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Skin Prize
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  CTP Prize
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Holes
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                  Strokes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((player) => (
                <tr 
                  key={player.id} 
                  className={`hover:bg-gray-50 ${
                    player.rank <= 3 ? 'bg-yellow-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-2xl font-bold text-gray-900">
                      {getMedalEmoji(player.rank)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
                    <div className="text-xs text-gray-500">{player.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">{Math.round(player.player_quota)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-semibold text-blue-600">
                      {Math.round(player.total_quota_points)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className={`text-lg ${getScoreColor(player.over_under)}`}>
                      {player.over_under > 0 ? '+' : ''}{Math.round(player.over_under)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {player.quota_prize_money > 0 ? (
                      <div className="text-sm font-bold text-green-600">
                        ${player.quota_prize_money}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">-</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {player.skins > 0 ? (
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600">
                          {player.skins} 🔥
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Holes: {player.skin_holes.sort((a, b) => a - b).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">-</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {player.skin_prize_money > 0 ? (
                      <div className="text-sm font-bold text-green-600">
                        ${player.skin_prize_money}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">-</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {player.ctp_prize_money > 0 ? (
                      <div className="text-sm font-bold text-green-600">
                        ${player.ctp_prize_money}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">-</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-500">{player.holes_played}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-500">{player.total_strokes}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* CTP Winners */}
      {ctpWinners.length > 0 && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-green-900 mb-4">📍 Closest to the Pin Winners</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ctpWinners.map((winner) => (
              <div key={`hole-${winner.hole_number}`} className="bg-white rounded-lg p-4 shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-lg font-bold text-gray-900">Hole {winner.hole_number}</div>
                    <div className="text-sm text-gray-600">Par {winner.mens_par}</div>
                  </div>
                  <div className="text-3xl">🏌️</div>
                </div>
                <div className="text-xl font-bold text-green-700 mb-2">{winner.player_name}</div>
                <div className="text-2xl font-bold text-blue-600 mb-3">
                  {winner.ctp_feet}' {winner.ctp_inches}"
                </div>
                {winner.ctp_image_url && (
                  <button
                    onClick={() => {
                      setSelectedImage({ url: winner.ctp_image_url, player: winner.player_name, hole: winner.hole_number, distance: `${winner.ctp_feet}' ${winner.ctp_inches}"` });
                      setShowImageModal(true);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
                  >
                    📷 View Photo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Player Scores */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Player Scores For This Tournament</h2>

        <div className="max-w-md mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Player
          </label>
          <select
            className="w-full p-3 border border-gray-300 rounded-lg"
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            disabled={tournamentPlayers.length === 0}
          >
            <option value="">{tournamentPlayers.length === 0 ? 'No players in tournament' : 'Choose a player...'}</option>
            {tournamentPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>

        {loadingPlayerScores && (
          <div className="text-sm text-gray-600">Loading player scores...</div>
        )}

        {playerScoresError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {playerScoresError}
          </div>
        )}

        {!loadingPlayerScores && selectedPlayerId && !playerScoresError && selectedPlayerScores.length === 0 && (
          <div className="text-sm text-gray-600">No scores recorded yet for this player in this tournament.</div>
        )}

        {!loadingPlayerScores && selectedPlayerScores.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4 max-w-sm">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Total Strokes</div>
                <div className="text-2xl font-bold text-blue-900">{selectedPlayerTotals.strokes}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs text-green-700 font-semibold uppercase tracking-wide">Quota Points</div>
                <div className="text-2xl font-bold text-green-900">{Math.round(selectedPlayerTotals.quotaPoints)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[620px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hole</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Par</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quota</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Entered</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedPlayerScores.map((scoreRow) => (
                    <tr key={scoreRow.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{scoreRow.hole_number}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">{scoreRow.mens_par ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{scoreRow.score ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900">{scoreRow.quota ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-center text-gray-500">
                        {scoreRow.entered_at ? new Date(scoreRow.entered_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      {leaderboard.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Legend</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><span className="font-semibold">Quota:</span> Player's handicap quota</p>
            <p><span className="font-semibold">Total Pts:</span> Sum of all quota points earned this tournament</p>
            <p><span className="font-semibold">Over/Under:</span> Total Pts minus Quota (positive is better)</p>
            <p><span className="font-semibold">Quota Prize:</span> 1st place 50%, 2nd 30%, 3rd 20% of the required-fee quota pot</p>
            <p><span className="font-semibold">Skins 🔥:</span> Number of holes where player had the best score alone</p>
            <p><span className="font-semibold">Skin Prize:</span> Prize money earned from the Skins Pot (60% of optional pins &amp; skins pot)</p>
            <p><span className="font-semibold">Pins Pot:</span> Closest-to-pin prizes paid from the Pins Pot (40% of optional pins &amp; skins pot)</p>
            <p className="mt-2"><span className="text-green-600 font-bold">Green = Over Quota</span> | <span className="text-red-600 font-bold">Red = Under Quota</span></p>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedImage.player}</h3>
                <p className="text-gray-600">Hole {selectedImage.hole} - {selectedImage.distance}</p>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
              >
                ×
              </button>
            </div>
            <img 
              src={selectedImage.url} 
              alt={`CTP measurement by ${selectedImage.player}`}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
