import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leaderboardAPI, tournamentsAPI } from '../api';

export function Leaderboard() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [tournamentRes, leaderboardRes] = await Promise.all([
        tournamentsAPI.get(tournamentId),
        leaderboardAPI.get(tournamentId)
      ]);
      setTournament(tournamentRes.data);
      setLeaderboard(leaderboardRes.data);
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
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:text-blue-800 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold">🏆 Tournament Leaderboard</h1>
        {tournament && (
          <p className="text-gray-600 mt-2">
            Date: {new Date(tournament.date).toLocaleDateString()} | 
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
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
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
                  Skins
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
      )}

      {/* Legend */}
      {leaderboard.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Legend</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><span className="font-semibold">Quota:</span> Player's handicap quota</p>
            <p><span className="font-semibold">Total Pts:</span> Sum of all quota points earned this tournament</p>
            <p><span className="font-semibold">Over/Under:</span> Total Pts minus Quota (positive is better)</p>
            <p><span className="font-semibold">Skins 🔥:</span> Number of holes where player had the best score alone</p>
            <p className="mt-2"><span className="text-green-600 font-bold">Green = Over Quota</span> | <span className="text-red-600 font-bold">Red = Under Quota</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
