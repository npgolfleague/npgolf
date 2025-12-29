import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, playersAPI } from '../api'

export const Dashboard = () => {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tournamentsRes, playersRes] = await Promise.all([
        tournamentsAPI.upcoming(),
        playersAPI.list()
      ])
      setTournaments(tournamentsRes.data)
      setPlayers(playersRes.data.filter(p => p.active).sort((a, b) => (b.fedex_points || 0) - (a.fedex_points || 0)))
      setError(null)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  const menuItems = [
    { path: '/scores', label: 'Score Entry', icon: '📝', color: 'blue' },
    { path: '/users', label: 'Players', icon: '👥', color: 'green' },
    { path: '/courses', label: 'Courses', icon: '⛳', color: 'yellow' },
    { path: '/courses/add', label: 'Add Course', icon: '➕', color: 'purple' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Menu */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">NPGolf League</h1>
            <div className="flex gap-2">
              {menuItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-${item.color}-500 hover:bg-${item.color}-600 text-white transition font-medium`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Upcoming Tournaments */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Tournaments</h2>
              
              {loading ? (
                <div className="text-center py-4 text-gray-600 text-sm">Loading...</div>
              ) : tournaments.length === 0 ? (
                <div className="text-center py-4 text-gray-600 text-sm">
                  No upcoming tournaments
                </div>
              ) : (
                <div className="space-y-3">
                  {tournaments.map((tournament, index) => (
                    <div 
                      key={tournament.id} 
                      className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow hover:border-blue-500"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">
                          {index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">
                            {tournament.course_name}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            📅 {formatDate(tournament.date)}
                          </p>
                          <p className="text-xs text-gray-600">
                            ⛳ {tournament.number_of_holes} holes
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => navigate(`/tournaments/${tournament.id}/players`)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              👥 Players
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => navigate(`/tournaments/${tournament.id}/leaderboard`)}
                              className="text-xs text-green-600 hover:text-green-800 font-medium"
                            >
                              🏆 Leaderboard
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Section - Player Rankings */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">FedEx Cup Standings</h2>
              </div>
              
              {loading ? (
                <div className="text-center py-12 text-gray-600">Loading players...</div>
              ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Player
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          FedEx Pts
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Tournaments
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Total Prize Money YTD
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {players.map((player, index) => (
                        <tr key={player.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {index < 3 ? (
                                <span className="text-2xl">
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-gray-900">
                                  #{index + 1}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                {player.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-semibold text-gray-900">
                                  {player.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Quota: {player.quota || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-lg font-bold text-blue-600">
                              {(player.fedex_points || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm text-gray-900">
                              {player.tournaments_played || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-semibold text-green-600">
                              ${(player.prize_money || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
