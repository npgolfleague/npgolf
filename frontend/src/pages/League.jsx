import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leaguesAPI } from '../api'

export const League = () => {
  const navigate = useNavigate()
  const [league, setLeague] = useState(null)
  const [settings, setSettings] = useState(null)
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    fetchLeagueData()
  }, [])

  const fetchLeagueData = async () => {
    try {
      setLoading(true)
      // Resolve league from URL alias context when present (e.g. /tgl1/*)
      const currentLeagueResponse = await leaguesAPI.current()
      const currentLeague = currentLeagueResponse.data
      const leagueId = currentLeague.id
      setLeague(currentLeague)
      
      // Fetch league settings
      const settingsResponse = await leaguesAPI.getSettings(leagueId)
      setSettings(settingsResponse.data)
      
      // Fetch league players
      const playersResponse = await leaguesAPI.getPlayers(leagueId)
      setPlayers(playersResponse.data)
      
      // Fetch league tournaments
      const tournamentsResponse = await leaguesAPI.getTournaments(leagueId)
      setTournaments(tournamentsResponse.data)
      
      setError('')
    } catch (err) {
      console.error('Error fetching league data:', err)
      setError('Failed to load league information')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">Loading league information...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">League Information</h1>
          <button
            onClick={() => navigate('/app/dashboard')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>

        {league && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{league.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Billing Entity</p>
                  <p className="text-lg font-semibold">{league.billing_entity_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Billing Email</p>
                  <p className="text-lg font-semibold">{league.billing_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Season Year</p>
                  <p className="text-lg font-semibold">{league.season_year || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold">
                    <span className={`px-2 py-1 rounded ${league.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {league.active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                {league.start_date && (
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="text-lg font-semibold">{formatDate(league.start_date)}</p>
                  </div>
                )}
                {league.end_date && (
                  <div>
                    <p className="text-sm text-gray-600">End Date</p>
                    <p className="text-lg font-semibold">{formatDate(league.end_date)}</p>
                  </div>
                )}
              </div>
              {league.description && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-base text-gray-900">{league.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === 'info'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === 'players'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Players ({players.length})
              </button>
              <button
                onClick={() => setActiveTab('tournaments')}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === 'tournaments'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Tournaments ({tournaments.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'info' && settings && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">League Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">18 Hole Tournament Fee</p>
                    <p className="text-lg font-semibold">{formatCurrency(settings.tournament_fee_18_holes)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">9 Hole Tournament Fee</p>
                    <p className="text-lg font-semibold">{formatCurrency(settings.tournament_fee_9_holes)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">18 Hole Skins/CTP Fee</p>
                    <p className="text-lg font-semibold">{formatCurrency(settings.skins_ctp_fee_18_holes)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">9 Hole Skins/CTP Fee</p>
                    <p className="text-lg font-semibold">{formatCurrency(settings.skins_ctp_fee_9_holes)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600">Golf Course Email</p>
                    <p className="text-lg font-semibold">{settings.golf_course_email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'players' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">League Players</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {players.map((player) => (
                        <tr key={player.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.email || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.phone || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(player.joined_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'tournaments' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">League Tournaments</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holes</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tournaments.map((tournament) => (
                        <tr key={tournament.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(tournament.date)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tournament.course_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tournament.number_of_holes}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded ${tournament.completed ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {tournament.completed ? 'Completed' : 'Upcoming'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
