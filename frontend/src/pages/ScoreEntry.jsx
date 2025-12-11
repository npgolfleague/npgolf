import { useState, useEffect } from 'react'
import { tournamentsAPI, coursesAPI, playersAPI, scoresAPI } from '../api'

export const ScoreEntry = () => {
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [foursomeGroup, setFoursomeGroup] = useState('')
  const [currentHole, setCurrentHole] = useState(1)
  const [holes, setHoles] = useState([])
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTournaments()
    fetchPlayers()
  }, [])

  useEffect(() => {
    if (selectedTournament) {
      fetchCourseHoles(selectedTournament.course_id)
    }
  }, [selectedTournament])

  const fetchTournaments = async () => {
    try {
      const response = await tournamentsAPI.upcoming()
      setTournaments(response.data)
    } catch (err) {
      console.error('Error fetching tournaments:', err)
    }
  }

  const fetchPlayers = async () => {
    try {
      const response = await playersAPI.list()
      setPlayers(response.data.filter(p => p.active))
    } catch (err) {
      console.error('Error fetching players:', err)
    }
  }

  const fetchCourseHoles = async (courseId) => {
    try {
      const response = await coursesAPI.get(courseId)
      if (response.data.holes) {
        setHoles(response.data.holes.sort((a, b) => a.hole_number - b.hole_number))
      }
    } catch (err) {
      console.error('Error fetching holes:', err)
    }
  }

  const handlePlayerToggle = (playerId) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId)
      } else if (prev.length < 4) {
        return [...prev, playerId]
      }
      return prev
    })
  }

  const handleScoreChange = (playerId, field, value) => {
    setScores(prev => ({
      ...prev,
      [`${currentHole}-${playerId}-${field}`]: value
    }))
  }

  const saveCurrentHole = async () => {
    if (selectedPlayers.length === 0 || !selectedTournament || !foursomeGroup) {
      alert('Please select tournament, players, and enter foursome group')
      return
    }

    const currentHoleData = holes.find(h => h.hole_number === currentHole)
    if (!currentHoleData) {
      alert('Hole data not found')
      return
    }

    const scoresToSave = selectedPlayers.map(playerId => {
      const scoreValue = scores[`${currentHole}-${playerId}-score`]
      const quotaValue = scores[`${currentHole}-${playerId}-quota`]
      if (!scoreValue) return null

      return {
        tournament_id: selectedTournament.id,
        player_id: playerId,
        hole_id: currentHoleData.id,
        score: parseInt(scoreValue),
        quota: quotaValue ? parseFloat(quotaValue) : null,
        foursome_group: foursomeGroup
      }
    }).filter(Boolean)

    if (scoresToSave.length === 0) {
      alert('Please enter at least one score')
      return
    }

    try {
      setSaving(true)
      await scoresAPI.saveScores(scoresToSave)
      
      // Move to next hole
      if (currentHole < holes.length) {
        setCurrentHole(currentHole + 1)
      } else {
        alert('All holes completed!')
      }
    } catch (err) {
      console.error('Error saving scores:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save scores'
      alert(`Error: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const getCurrentHoleData = () => {
    return holes.find(h => h.hole_number === currentHole)
  }

  const getPlayerTotal = (playerId) => {
    let total = 0
    for (let hole = 1; hole <= currentHole; hole++) {
      const scoreValue = scores[`${hole}-${playerId}-score`]
      if (scoreValue) {
        total += parseInt(scoreValue)
      }
    }
    return total
  }

  const getPlayerQuotaTotal = (playerId) => {
    let total = 0
    for (let hole = 1; hole <= currentHole; hole++) {
      const quotaValue = scores[`${hole}-${playerId}-quota`]
      if (quotaValue) {
        total += parseFloat(quotaValue)
      }
    }
    return total
  }

  const holeData = getCurrentHoleData()

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Score Entry</h1>

        {/* Tournament Selection */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Tournament <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full p-3 border border-gray-300 rounded-lg text-lg"
            value={selectedTournament?.id || ''}
            onChange={(e) => {
              const tournament = tournaments.find(t => t.id === parseInt(e.target.value))
              setSelectedTournament(tournament)
              setCurrentHole(1) // Reset to first hole when changing tournament
            }}
          >
            <option value="">Choose a tournament...</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {new Date(t.date).toLocaleDateString()} - {t.course_name}
              </option>
            ))}
          </select>
        </div>

        {/* Foursome Group */}
        {selectedTournament && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Foursome Group <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg text-lg"
              placeholder="e.g., Group A, Group 1"
              value={foursomeGroup}
              onChange={(e) => setFoursomeGroup(e.target.value)}
            />
            {foursomeGroup && (
              <p className="text-xs text-green-600 mt-1">✓ Group name set</p>
            )}
          </div>
        )}

        {/* Player Selection */}
        {selectedTournament && foursomeGroup && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Players (up to 4)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {players.map(player => (
                <button
                  key={player.id}
                  onClick={() => handlePlayerToggle(player.id)}
                  className={`p-3 rounded-lg border-2 transition text-left ${
                    selectedPlayers.includes(player.id)
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  <div className="font-semibold">{player.name}</div>
                  <div className="text-xs text-gray-600">Quota: {player.quota || '-'}</div>
                </button>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Selected: {selectedPlayers.length}/4
            </div>
          </div>
        )}

        {/* Score Entry for Current Hole */}
        {selectedPlayers.length > 0 && holeData && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            {/* Current Scores Display */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-semibold text-gray-700 mb-2">Current Scores</div>
              <div className="space-y-1">
                {selectedPlayers.map(playerId => {
                  const player = players.find(p => p.id === playerId)
                  const total = getPlayerTotal(playerId)
                  const quotaTotal = getPlayerQuotaTotal(playerId)
                  return (
                    <div key={playerId} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-800">{player?.name}</span>
                      <div className="flex gap-3">
                        <span className="text-blue-600 font-bold">{total || 0}</span>
                        <span className="text-green-600 font-semibold">Q: {quotaTotal.toFixed(1)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Hole {currentHole} of {holes.length}
              </h2>
              <div className="text-right">
                <div className="text-sm text-gray-600">Par</div>
                <div className="text-2xl font-bold text-blue-600">
                  {holeData.mens_par}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {selectedPlayers.map(playerId => {
                const player = players.find(p => p.id === playerId)
                return (
                  <div key={playerId} className="border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      {player?.name}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Score</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="15"
                          className="w-full p-3 border-2 border-gray-300 rounded-lg text-xl text-center font-bold focus:border-blue-500 focus:outline-none"
                          placeholder="#"
                          value={scores[`${currentHole}-${playerId}-score`] || ''}
                          onChange={(e) => handleScoreChange(playerId, 'score', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Quota</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          className="w-full p-3 border-2 border-gray-300 rounded-lg text-xl text-center font-bold focus:border-green-500 focus:outline-none"
                          placeholder="#"
                          value={scores[`${currentHole}-${playerId}-quota`] || ''}
                          onChange={(e) => handleScoreChange(playerId, 'quota', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
                disabled={currentHole === 1}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold disabled:opacity-50"
              >
                ← Previous
              </button>
              <button
                onClick={saveCurrentHole}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : currentHole < holes.length ? 'Save & Next →' : 'Save & Finish'}
              </button>
            </div>
          </div>
        )}

        {/* Hole Navigation */}
        {selectedPlayers.length > 0 && holes.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Quick Navigation</div>
            <div className="grid grid-cols-6 gap-2">
              {holes.map(hole => (
                <button
                  key={hole.hole_number}
                  onClick={() => setCurrentHole(hole.hole_number)}
                  className={`p-2 rounded text-sm font-semibold ${
                    currentHole === hole.hole_number
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {hole.hole_number}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
