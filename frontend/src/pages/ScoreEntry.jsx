import { useState, useEffect } from 'react'
import { tournamentsAPI, coursesAPI, playersAPI, scoresAPI } from '../api'

export const ScoreEntry = () => {
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [foursomeGroup, setFoursomeGroup] = useState('')
  const [foursomeGroups, setFoursomeGroups] = useState([])
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
      fetchTournamentPlayers(selectedTournament.id)
      fetchFoursomeGroups(selectedTournament.id)
    }
  }, [selectedTournament])

  useEffect(() => {
    if (selectedTournament && foursomeGroup && selectedPlayers.length > 0) {
      loadExistingScores()
    }
  }, [selectedTournament, foursomeGroup, selectedPlayers])

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

  const fetchTournamentPlayers = async (tournamentId) => {
    try {
      const response = await tournamentsAPI.getPlayers(tournamentId)
      setPlayers(response.data)
    } catch (err) {
      console.error('Error fetching tournament players:', err)
      // Fall back to all active players if tournament players fetch fails
      fetchPlayers()
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

  const fetchFoursomeGroups = async (tournamentId) => {
    try {
      const response = await scoresAPI.getFoursomeGroups(tournamentId)
      setFoursomeGroups(response.data)
    } catch (err) {
      console.error('Error fetching foursome groups:', err)
      setFoursomeGroups([])
    }
  }

  const handleGroupSelect = async (groupName) => {
    setFoursomeGroup(groupName)
    if (groupName && selectedTournament) {
      try {
        // Get the scores for this group to find the players
        const response = await scoresAPI.getFoursomeScores(selectedTournament.id, groupName)
        const playerIds = [...new Set(response.data.map(score => score.player_id))]
        setSelectedPlayers(playerIds)
      } catch (err) {
        console.error('Error loading group players:', err)
      }
    }
  }

  const loadExistingScores = async () => {
    try {
      const response = await scoresAPI.getFoursomeScores(selectedTournament.id, foursomeGroup)
      const existingScores = response.data
      
      // Convert existing scores to the format expected by the component
      const loadedScores = {}
      existingScores.forEach(scoreRecord => {
        const hole = holes.find(h => h.id === scoreRecord.hole_id)
        if (hole) {
          loadedScores[`${hole.hole_number}-${scoreRecord.player_id}-score`] = scoreRecord.score
          loadedScores[`${hole.hole_number}-${scoreRecord.player_id}-quota`] = scoreRecord.quota
        }
      })
      
      setScores(loadedScores)
    } catch (err) {
      console.error('Error loading existing scores:', err)
      // Don't alert on 404 - just means no scores exist yet
      if (err.response?.status !== 404) {
        console.error('Failed to load existing scores')
      }
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

  // Calculate quota points based on score relative to par
  const calculateQuotaPoints = (score, par) => {
    if (!score || !par) return 0
    const scoreInt = parseInt(score)
    const parInt = parseInt(par)
    const relative = scoreInt - parInt

    // Ace (hole-in-one) = 8 points
    if (scoreInt === 1) return 8
    
    // 3 under par = 8 points (double eagle)
    if (relative === -3) return 8
    
    // 2 under par = 6 points (eagle)
    if (relative === -2) return 6
    
    // 1 under par = 4 points (birdie)
    if (relative === -1) return 4
    
    // Par = 2 points
    if (relative === 0) return 2
    
    // 1 over par = 1 point (bogey)
    if (relative === 1) return 1
    
    // 2+ over par = 0 points (double bogey or worse)
    if (relative >= 2) return 0
    
    return 0
  }

  // Calculate score based on quota points and par
  const calculateScoreFromQuota = (quotaPoints, par) => {
    if (quotaPoints === null || quotaPoints === undefined || quotaPoints === '' || !par) return ''
    const pts = parseInt(quotaPoints)
    const parInt = parseInt(par)

    // 8 points
    if (pts === 8) {
      // For par 3 or 4, ace (score 1)
      // For par 5, double eagle (score 2)
      return parInt === 5 ? 2 : 1
    }
    
    // 6 points = eagle (2 under par)
    if (pts === 6) return parInt - 2
    
    // 4 points = birdie (1 under par)
    if (pts === 4) return parInt - 1
    
    // 2 points = par
    if (pts === 2) return parInt
    
    // 1 point = bogey (1 over par)
    if (pts === 1) return parInt + 1
    
    // 0 points = double bogey or worse (2+ over par)
    if (pts === 0) return parInt + 2
    
    return ''
  }

  const handleScoreChange = (playerId, field, value) => {
    setScores(prev => {
      const newScores = {
        ...prev,
        [`${currentHole}-${playerId}-${field}`]: value
      }
      
      const currentHoleData = holes.find(h => h.hole_number === currentHole)
      const player = players.find(p => p.id === playerId)
      
      if (currentHoleData && player) {
        // Use mens_par or womens_par based on player's sex
        const par = player.sex === 'F' ? currentHoleData.womens_par : currentHoleData.mens_par
        
        // Auto-calculate quota points when score is entered
        if (field === 'score' && value) {
          const quotaPoints = calculateQuotaPoints(value, par)
          newScores[`${currentHole}-${playerId}-quota`] = quotaPoints
        }
        
        // Auto-calculate score when quota points are entered
        if (field === 'quota' && value !== '') {
          const score = calculateScoreFromQuota(value, par)
          if (score !== '') {
            newScores[`${currentHole}-${playerId}-score`] = score
          }
        }
      }
      
      return newScores
    })
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
        quota: quotaValue ? parseInt(quotaValue) : null,
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
        total += parseInt(quotaValue)
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
            
            {foursomeGroups.length > 0 && (
              <>
                <label className="block text-xs text-gray-600 mb-1">Select Existing Group</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg text-lg mb-2"
                  value={foursomeGroup}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                >
                  <option value="">Choose existing group or enter new...</option>
                  {foursomeGroups.map((group, idx) => (
                    <option key={idx} value={group.foursome_group}>
                      {group.foursome_group} ({group.players})
                    </option>
                  ))}
                </select>
                <label className="block text-xs text-gray-600 mb-1">Or Enter New Group Name</label>
              </>
            )}
            
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
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Select Players (up to 4)
              </label>
              {selectedPlayers.length > 0 && (
                <button
                  onClick={() => setSelectedPlayers([])}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  Clear All
                </button>
              )}
            </div>
            {players.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                No players registered for this tournament. Please add players to the tournament first.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {players.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handlePlayerToggle(player.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                        selectedPlayers.includes(player.id)
                          ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-md'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {selectedPlayers.includes(player.id) && (
                        <div className="absolute top-1 right-1 text-blue-600 text-xl">✓</div>
                      )}
                      <div className="font-semibold pr-6">{player.name}</div>
                      <div className="text-xs text-gray-600">Quota: {player.quota || '-'}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Selected: {selectedPlayers.length}/4
                  </div>
                  <div className="text-xs text-gray-500 italic">
                    Click players to add/remove
                  </div>
                </div>
              </>
            )}
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
                        <span className="text-green-600 font-semibold">Q: {Math.round(quotaTotal)}</span>
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
                          inputMode="numeric"
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
