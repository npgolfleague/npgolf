import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { scoresAPI, tournamentsAPI } from '../api'
import { formatDateOnly } from '../utils/date'

export const TournamentHoleScores = () => {
  const { tournamentId } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [scoreRows, setScoreRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [tournamentId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [tournamentRes, scoresRes] = await Promise.all([
        tournamentsAPI.get(tournamentId),
        scoresAPI.list({ tournament_id: tournamentId })
      ])

      setTournament(tournamentRes.data)
      setScoreRows(scoresRes.data || [])
    } catch (err) {
      console.error('Error loading tournament hole scores:', err)
      setError(err.response?.data?.error || 'Failed to load hole-by-hole scores')
    } finally {
      setLoading(false)
    }
  }

  const holeNumbers = useMemo(() => {
    const unique = new Set(scoreRows.map(row => Number(row.hole_number)).filter(Boolean))
    return [...unique].sort((a, b) => a - b)
  }, [scoreRows])

  const playerRows = useMemo(() => {
    const players = new Map()

    scoreRows.forEach((row) => {
      const playerId = row.player_id
      if (!players.has(playerId)) {
        players.set(playerId, {
          player_id: playerId,
          player_name: row.player_name,
          scoresByHole: {},
          totalStrokes: 0,
          totalQuota: 0,
          holesPlayed: 0
        })
      }

      const player = players.get(playerId)
      const holeNumber = Number(row.hole_number)
      const score = Number(row.score)
      const quota = Number(row.quota)

      player.scoresByHole[holeNumber] = {
        score: Number.isNaN(score) ? null : score,
        quota: Number.isNaN(quota) ? null : quota
      }

      if (!Number.isNaN(score)) {
        player.totalStrokes += score
      }

      if (!Number.isNaN(quota)) {
        player.totalQuota += quota
      }

      if (!Number.isNaN(score) || !Number.isNaN(quota)) {
        player.holesPlayed += 1
      }
    })

    return [...players.values()].sort((a, b) => a.player_name.localeCompare(b.player_name))
  }, [scoreRows])

  const isCompleted = Number(tournament?.is_completed || 0) === 1

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-lg text-gray-700">Loading hole-by-hole scores...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <button
        onClick={() => navigate('/tournaments')}
        className="text-blue-600 hover:text-blue-800 mb-3"
      >
        ← Back to Tournaments
      </button>

      <h1 className="text-3xl font-bold text-gray-900">⛳ Hole-by-Hole Scores</h1>

      {tournament && (
        <p className="mt-2 text-gray-600">
          {formatDateOnly(tournament.date)} | {tournament.course_name} | {tournament.number_of_holes} holes
        </p>
      )}

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {!error && tournament && !isCompleted && (
        <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-800">
          This tournament is not marked as completed yet. Complete the tournament to view final hole-by-hole results.
        </div>
      )}

      {!error && isCompleted && playerRows.length === 0 && (
        <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-800">
          No hole-by-hole scores were found for this tournament.
        </div>
      )}

      {!error && isCompleted && playerRows.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-100">
              <tr>
                <th className="sticky left-0 bg-gray-100 px-4 py-3 text-left text-sm font-semibold text-gray-700">Player</th>
                {holeNumbers.map((holeNumber) => (
                  <th key={`hole-${holeNumber}`} className="px-3 py-3 text-center text-sm font-semibold text-gray-700">
                    H{holeNumber}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Quota Pts</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((player) => (
                <tr key={player.player_id} className="border-t">
                  <td className="sticky left-0 bg-white px-4 py-3 text-sm font-medium text-gray-900">
                    {player.player_name}
                  </td>
                  {holeNumbers.map((holeNumber) => {
                    const holeScore = player.scoresByHole[holeNumber]
                    return (
                      <td key={`player-${player.player_id}-hole-${holeNumber}`} className="px-3 py-3 text-center text-sm text-gray-900">
                        {holeScore?.score ?? '-'}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">{player.totalStrokes}</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-green-700">{player.totalQuota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
