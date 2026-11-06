import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, playersAPI, leaguesAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { ToastContext } from '../context/ToastContext'
import { ConfirmModal } from '../components/ConfirmModal'
import { formatDateOnly } from '../utils/date'
import { isAdminCapable } from '../utils/roles'
import {
  ClipboardList, Users, Flag, Plus, Lock, LayoutDashboard,
  Trophy, BookOpen, Info, CalendarDays, Activity, Disc3
} from 'lucide-react'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { addToast } = useContext(ToastContext)
  const isAdmin = isAdminCapable(user)
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [currentLeague, setCurrentLeague] = useState(null)
  const [playoffOverview, setPlayoffOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshingQuotas, setRefreshingQuotas] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tournamentsRes, playersRes, leagueRes] = await Promise.all([
        tournamentsAPI.upcoming(),
        // The player list needs a login (it includes contact details)
        user ? playersAPI.list() : Promise.resolve({ data: [] }),
        leaguesAPI.current()
      ])
      setTournaments(tournamentsRes.data)
      setPlayers(playersRes.data.filter(p => p.active).sort((a, b) => (b.fedex_points || 0) - (a.fedex_points || 0)))
      setCurrentLeague(leagueRes.data)

      if (leagueRes.data?.id) {
        try {
          const playoffRes = await leaguesAPI.getPlayoffOverview(leagueRes.data.id)
          setPlayoffOverview(playoffRes.data)
        } catch (playoffErr) {
          console.error('Error fetching playoff overview:', playoffErr)
          setPlayoffOverview(null)
        }
      } else {
        setPlayoffOverview(null)
      }

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

  const cupName = currentLeague?.cup_name || 'Paradise Cup'

  const menuItems = [
    { path: '/scores', label: 'Score Entry', icon: ClipboardList, color: 'blue' },
    { path: '/users', label: 'Players', icon: Users, color: 'green' },
    { path: '/courses', label: 'Courses', icon: Flag, color: 'yellow' },
    ...(isAdmin ? [{ path: '/courses/add', label: 'Add Course', icon: Plus, color: 'purple' }] : [])
  ]

  const publicMenuItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: false },
    { path: '/scores', label: 'Score Entry', icon: ClipboardList, enabled: false },
    { path: '/users', label: 'Players', icon: Users, enabled: false },
    { path: '/tournaments', label: 'Tournaments', icon: Trophy, enabled: false },
    { path: '/courses', label: 'Courses', icon: Flag, enabled: false },
    { path: '/rules', label: 'Rules', icon: BookOpen, enabled: false },
    { path: '/about', label: 'About', icon: Info, enabled: true }
  ]

  const handleRefreshQuotas = () => {
    setConfirmModal({
      title: 'Refresh Quota Values',
      message: 'Refresh quota values from stored quota history for all players? This will recalculate all player quotas.',
      confirmLabel: 'Refresh',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          setRefreshingQuotas(true)
          setError(null)

          const response = await playersAPI.refreshQuotas()
          const playersTouched = response.data?.playersTouched ?? 0
          const updated18 = response.data?.updated18 ?? 0
          const updated9 = response.data?.updated9 ?? 0
          const prizePlayersTouched = response.data?.prizePlayersTouched ?? 0

          addToast(`Quota refreshed: ${playersTouched} players, 18H: ${updated18}, 9H: ${updated9}, Prize: ${prizePlayersTouched}`, 'success')
          await fetchData()
        } catch (err) {
          console.error('Error refreshing quota values:', err)
          setError(err.response?.data?.error || 'Failed to refresh quota values')
        } finally {
          setRefreshingQuotas(false)
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-fairway-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
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
                    <Plus className="w-4 h-4" />
                    <span>Join</span>
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition font-medium"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                </>
              )}
              {user && menuItems.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-${item.color}-500 hover:bg-${item.color}-600 text-white transition font-medium`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">{cupName} — {currentLeague?.season_year || new Date().getFullYear()} Season</p>
        </div>
        {/* Priority 5: Dashboard Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Next Event */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Next Event</p>
              <p className="text-lg font-bold text-slate-900 truncate">
                {tournaments.length > 0 ? formatDate(tournaments[0].date) : 'TBD'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {tournaments.length > 0 ? tournaments[0].course_name : 'No scheduled events'}
              </p>
            </div>
          </div>

          {/* Card 2: Field Strength */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-fairway-50 flex items-center justify-center text-fairway-600 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Field</p>
              <p className="text-2xl font-bold text-slate-900">{players.length}</p>
              <p className="text-xs text-slate-500">Registered Players</p>
            </div>
          </div>

          {/* Card 3: League Leader */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Points Leader</p>
              <p className="text-lg font-bold text-slate-900 truncate">
                {players.length > 0 ? players[0].name : '---'}
              </p>
              <p className="text-xs text-slate-500">
                {players.length > 0 ? `${Math.round(players[0].fedex_points || 0)} Points` : 'No results yet'}
              </p>
            </div>
          </div>

          {/* Card 4: Prize Pool Estimate */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Season Status</p>
              <p className="text-lg font-bold text-slate-900">Active</p>
              <p className="text-xs text-slate-500">Tournament Mode</p>
            </div>
          </div>
        </div>

          {playoffOverview && playoffOverview.playoff_format === 'fedex_cup' && (
            <div className="mb-8 grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 xl:col-span-1">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Playoff Season</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">{playoffOverview.season_year}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Championship Pot: ${Number(playoffOverview.championship_pot || 0).toFixed(2)}
                </p>
                <p className="text-sm text-slate-600">
                  Losers Bracket Pot: ${Number(playoffOverview.losers_bracket_pot || 0).toFixed(2)}
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="rounded-lg bg-fairway-50 px-3 py-2 text-fairway-900">
                    Champion: {playoffOverview.champion_player_id ? 'Recorded' : 'Pending'}
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-800">
                    Tiebreak: {playoffOverview.champion_tiebreak_player_id ? 'Manual selection recorded' : 'Not needed yet'}
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    Losers Winner: {playoffOverview.losers_winner_player_id ? 'Recorded' : 'Pending'}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 xl:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Playoff Standings</h2>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {playoffOverview.season_year}
                  </span>
                </div>
                {playoffOverview.standings?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500 uppercase tracking-wider text-xs">
                        <tr>
                          <th className="py-2 pr-4">Rank</th>
                          <th className="py-2 pr-4">Player</th>
                          <th className="py-2 pr-4 text-right">Regular</th>
                          <th className="py-2 pr-4 text-right">Playoff</th>
                          <th className="py-2 pr-4 text-right">Losers</th>
                          <th className="py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playoffOverview.standings.slice(0, 8).map((row) => (
                          <tr key={row.player_id} className="border-t border-slate-100">
                            <td className="py-2 pr-4 font-semibold text-slate-700">#{row.rank}</td>
                            <td className="py-2 pr-4 text-slate-900">{row.name}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{Math.round(row.regular_points)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{Math.round(row.playoff_points)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{Math.round(row.losers_bracket_points)}</td>
                            <td className="py-2 text-right font-semibold text-slate-900">{Math.round(row.total_points)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No playoff standings are available yet.</p>
                )}
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Upcoming Tournaments */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-fairway-600" />
                  Upcoming
                </h2>
                <button 
                  onClick={() => navigate('/tournaments')}
                  className="text-xs font-semibold text-fairway-700 hover:text-fairway-800"
                >
                  View All
                </button>
              </div>
              
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : tournaments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <Flag className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm italic">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tournaments.slice(0, 3).map((tournament) => (
                    <div 
                      key={tournament.id} 
                      className="group relative bg-slate-50 hover:bg-white border border-transparent hover:border-fairway-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
                      onClick={() => navigate(`/tournaments/${tournament.id}/leaderboard`)}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-fairway-700 bg-fairway-50 px-2 py-0.5 rounded uppercase">
                            {formatDate(tournament.date)}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-fairway-700 transition-colors">
                          {tournament.course_name}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Disc3 className="w-3 h-3" /> {tournament.number_of_holes} Holes
                          </span>
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{cupName} Standings</h2>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleRefreshQuotas}
                    disabled={refreshingQuotas}
                    className="btn-secondary btn-sm"
                  >
                    {refreshingQuotas ? 'Refreshing...' : 'Refresh Quotas'}
                  </button>
                )}
              </div>
              
              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-slate-200 rounded-lg" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[920px]">
                    <thead className="bg-slate-50 border-y border-slate-200">
                      <tr>
                        <th scope="col" aria-label="Rank" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Rank
                        </th>
                        <th scope="col" aria-label="Player" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Player
                        </th>
                        <th scope="col" aria-label={`${cupName} Points`} className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {cupName} Pts
                        </th>
                        <th scope="col" aria-label="18-Hole Quota" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Quota 18H
                        </th>
                        <th scope="col" aria-label="9-Hole Quota" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Quota 9H
                        </th>
                        <th scope="col" aria-label="Tournaments Played" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Tournaments
                        </th>
                        <th scope="col" aria-label="Prize Money Year to Date" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Prize Money YTD
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {players.map((player, index) => (
                        <tr key={player.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {index < 3 ? (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                  index === 0 ? 'bg-amber-100 text-amber-600' :
                                  index === 1 ? 'bg-slate-200 text-slate-600' :
                                  'bg-orange-100 text-orange-500'
                                }`}>
                                  {index + 1}
                                </div>
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
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-lg font-bold text-blue-600">
                              {(player.fedex_points || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-semibold text-gray-900">{player.quota_18 ?? '-'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-semibold text-gray-900">{player.quota_9 ?? '-'}</span>
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
      </main>
      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  )
}
