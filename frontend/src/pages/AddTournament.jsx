import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, coursesAPI, leaguesAPI } from '../api'

export const AddTournament = () => {
  const navigate = useNavigate()
  const [date, setDate] = useState('')
  const [firstTeeTime, setFirstTeeTime] = useState('')
  const [shotgunStart, setShotgunStart] = useState(false)
  const [standardQuotaGame, setStandardQuotaGame] = useState(true)
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear())
  const [playoffStage, setPlayoffStage] = useState('regular')
  const [courseId, setCourseId] = useState('')
  const [numberOfHoles, setNumberOfHoles] = useState(18)
  const [nineHoleSide, setNineHoleSide] = useState('front')
  const [courses, setCourses] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCourses()
    fetchLeague()
  }, [])

  const fetchLeague = async () => {
    try {
      const response = await leaguesAPI.current()
      const currentSeasonYear = Number(response.data?.season_year)
      if (Number.isFinite(currentSeasonYear) && currentSeasonYear > 0) {
        setSeasonYear(currentSeasonYear)
      }
    } catch (err) {
      console.error('Error fetching current league:', err)
    }
  }

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.list()
      setCourses(response.data)
    } catch (err) {
      console.error('Error fetching courses:', err)
      setError('Failed to load courses')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!date || !courseId || !firstTeeTime) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      await tournamentsAPI.create(date, courseId, numberOfHoles, nineHoleSide, firstTeeTime, shotgunStart, standardQuotaGame, seasonYear, playoffStage)
      navigate('/tournaments')
    } catch (err) {
      console.error('Error creating tournament:', err)
      setError(err.response?.data?.error || 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/tournaments')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to Tournaments
          </button>
          <h2 className="text-3xl font-bold text-gray-800">Add New Tournament</h2>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Tournament Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={firstTeeTime}
                  onChange={(e) => setFirstTeeTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-gray-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={shotgunStart}
                    onChange={(e) => setShotgunStart(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Shotgun Start (all groups start at the same time)
                </label>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-gray-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={standardQuotaGame}
                    onChange={(e) => setStandardQuotaGame(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Standard quota game is being played
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-6">
                  Leave checked for normal quota leaderboard scoring. Uncheck for side-game-only events.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Season Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(Number(e.target.value) || new Date().getFullYear())}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Use the league season year this tournament belongs to.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Playoff Stage
                </label>
                <select
                  value={playoffStage}
                  onChange={(e) => setPlayoffStage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="regular">Regular Season</option>
                  <option value="semifinal">Playoff Semifinal</option>
                  <option value="final">Playoff Final</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Leave as regular season unless this event is part of the playoffs.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Course <span className="text-red-500">*</span>
                </label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select a course --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} - {course.address}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No courses available. Please add a course first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Number of Holes <span className="text-red-500">*</span>
                </label>
                <select
                  value={numberOfHoles}
                  onChange={(e) => {
                    const holes = parseInt(e.target.value)
                    setNumberOfHoles(holes)
                    if (holes !== 9) {
                      setNineHoleSide('front')
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value={9}>9 Holes</option>
                  <option value={18}>18 Holes</option>
                </select>
              </div>

              {numberOfHoles === 9 && (
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    9-Hole Side <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={nineHoleSide}
                    onChange={(e) => setNineHoleSide(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="front">Front (Holes 1-9)</option>
                    <option value="back">Back (Holes 10-18)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={loading || courses.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Tournament'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/tournaments')}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
