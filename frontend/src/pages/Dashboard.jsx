import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, playersAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { formatDateOnly } from '../utils/date'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const isAdmin = user?.role === 'admin'
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshingQuotas, setRefreshingQuotas] = useState(false)
  const [quotaRefreshMessage, setQuotaRefreshMessage] = useState('')

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
    return formatDateOnly(dateString, 'en-US', {
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

  const publicMenuItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: '🏠', enabled: false },
    { path: '/scores', label: 'Score Entry', icon: '📝', enabled: false },
    { path: '/users', label: 'Players', icon: '👥', enabled: false },
    { path: '/tournaments', label: 'Tournaments', icon: '🏆', enabled: false },
    { path: '/courses', label: 'Courses', icon: '⛳', enabled: false },
    { path: '/rules', label: 'Rules', icon: '📋', enabled: false },
    { path: '/about', label: 'About', icon: 'ℹ️', enabled: true }
  ]

  const handleRefreshQuotas = async () => {
    if (!confirm('Refresh quota values from stored quota history for all players?')) return

    try {
      setRefreshingQuotas(true)
      setQuotaRefreshMessage('')
      setError(null)

      const response = await playersAPI.refreshQuotas()
      const playersTouched = response.data?.playersTouched ?? 0
      const updated18 = response.data?.updated18 ?? 0
      const updated9 = response.data?.updated9 ?? 0

      setQuotaRefreshMessage(`Quota values refreshed. Players: ${playersTouched}, 18-hole updated: ${updated18}, 9-hole updated: ${updated9}`)
      await fetchData()
    } catch (err) {
      console.error('Error refreshing quota values:', err)
      setError(err.response?.data?.error || 'Failed to refresh quota values')
    } finally {
      setRefreshingQuotas(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Menu */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <img src="/npgolf-logo.svg" alt="NPGOLF" className="h-14 w-auto" />
            <div className="flex gap-2 items-center">
              {!user && (
                <>
                  <button
                    onClick={() => navigate('/register')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition font-medium"
                  >
                    <span>➕</span>
                    <span>Join</span>
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition font-medium"
                  >
                    <span>🔐</span>
                    <span>Sign In</span>
                  </button>
                </>
              )}
              {user && menuItems.map(item => (
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
            {!user && (
              <div className="bg-white rounded-lg shadow p-4 mb-4 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Menu</h2>
                <div className="space-y-2">
                  {publicMenuItems.map((item) => (
                    item.enabled ? (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ) : (
                      <div
                        key={item.path}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded bg-gray-100 text-gray-400 cursor-not-allowed"
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-gray-800">Paradise Cup Standings</h2>
                  {isAdmin && (
                    <button
                      onClick={handleRefreshQuotas}
                      disabled={refreshingQuotas}
                      className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {refreshingQuotas ? 'Refreshing...' : 'Refresh Quotas'}
                    </button>
                  )}
                </div>
              </div>

              {quotaRefreshMessage && (
                <div className="mx-6 mt-4 p-3 bg-green-100 text-green-700 rounded text-sm">
                  {quotaRefreshMessage}
                </div>
              )}
              
              {loading ? (
                <div className="text-center py-12 text-gray-600">Loading players...</div>
              ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[920px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Player
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Paradise Pts
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
                                  Quota 18: {player.quota_18 ?? '-'} | Quota 9: {player.quota_9 ?? '-'}
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
