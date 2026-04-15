import { useState, useEffect } from 'react'
import { tournamentsAPI, coursesAPI, playersAPI, scoresAPI } from '../api'
import { formatDateOnly } from '../utils/date'

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
  const [ctpData, setCtpData] = useState({})
  const [showCtpModal, setShowCtpModal] = useState(false)
  const [ctpPlayerId, setCtpPlayerId] = useState(null)
  const [ctpLeader, setCtpLeader] = useState(null)

  const getPlayableHoles = () => {
    if (!selectedTournament) return holes

    if (selectedTournament.number_of_holes === 9) {
      const side = selectedTournament.nine_hole_side || 'front'
      if (side === 'back') {
        return holes.filter(h => h.hole_number >= 10 && h.hole_number <= 18)
      }
      return holes.filter(h => h.hole_number >= 1 && h.hole_number <= 9)
    }

    return holes
  }

  const playableHoles = getPlayableHoles()

  const getCurrentHoleIndex = () => playableHoles.findIndex(h => h.hole_number === currentHole)

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

  useEffect(() => {
    if (selectedTournament && currentHole) {
      loadCtpLeader()
    }
  }, [selectedTournament, currentHole])

  const loadCtpLeader = async () => {
    const hole = playableHoles.find(h => h.hole_number === currentHole)
    if (!hole || hole.mens_par !== 3) {
      setCtpLeader(null)
      return
    }

    try {
      const response = await scoresAPI.getCtpLeader(selectedTournament.id, hole.id)
      setCtpLeader(response.data)
    } catch (err) {
      console.error('Error loading CTP leader:', err)
      setCtpLeader(null)
    }
  }

  const fetchTournaments = async () => {
    try {
      const response = await tournamentsAPI.list()
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

  const assignGroupToSelectedPlayers = async () => {
    if (!selectedTournament || !foursomeGroup || selectedPlayers.length === 0) {
      alert('Please select tournament, players, and enter foursome group')
      return
    }

    try {
      const playerIds = selectedPlayers
      await tournamentsAPI.assignFoursomeGroup(selectedTournament.id, foursomeGroup, playerIds)
      await fetchFoursomeGroups(selectedTournament.id)
      alert('Foursome group assigned to selected players')
    } catch (err) {
      console.error('Error assigning foursome group:', err)
      alert('Failed to assign foursome group')
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

  const getPlayerCurrentQuota = (player) => {
    if (!player || !selectedTournament) return null

    const quotaValue = selectedTournament.number_of_holes === 9
      ? player.quota_9
      : player.quota_18

    if (quotaValue === null || quotaValue === undefined || quotaValue === '') {
      return null
    }

    const parsed = Number(quotaValue)
    return Number.isNaN(parsed) ? null : parsed
  }

  const hasCurrentQuota = (player) => getPlayerCurrentQuota(player) !== null

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

  const handleOpenCtpModal = (playerId) => {
    setCtpPlayerId(playerId)
    setShowCtpModal(true)
  }

  const handleCloseCtpModal = () => {
    setShowCtpModal(false)
    setCtpPlayerId(null)
  }

  const handleCtpChange = (field, value) => {
    setCtpData(prev => ({
      ...prev,
      [ctpPlayerId]: {
        ...prev[ctpPlayerId],
        [field]: value
      }
    }))
  }

  const handleCtpImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCtpData(prev => ({
          ...prev,
          [ctpPlayerId]: {
            ...prev[ctpPlayerId],
            imageFile: file,
            imagePreview: reader.result
          }
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveCtp = () => {
    handleCloseCtpModal()
  }

  const saveCurrentHole = async () => {
    if (selectedPlayers.length === 0 || !selectedTournament || !foursomeGroup) {
      alert('Please select tournament, players, and enter foursome group')
      return
    }

    const currentHoleData = playableHoles.find(h => h.hole_number === currentHole)
    if (!currentHoleData) {
      alert('Hole data not found')
      return
    }

    const scoresToSave = selectedPlayers.map(playerId => {
      const scoreValue = scores[`${currentHole}-${playerId}-score`]
      const quotaValue = scores[`${currentHole}-${playerId}-quota`]
      const playerCtp = ctpData[playerId]
      if (!scoreValue) return null

      return {
        tournament_id: selectedTournament.id,
        player_id: playerId,
        hole_id: currentHoleData.id,
        score: parseInt(scoreValue),
        quota: quotaValue !== '' && quotaValue !== null && quotaValue !== undefined ? parseInt(quotaValue) : null,
        foursome_group: foursomeGroup,
        ctp_feet: playerCtp?.feet ? parseInt(playerCtp.feet) : null,
        ctp_inches: playerCtp?.inches ? parseFloat(playerCtp.inches) : null,
        ctp_image_url: playerCtp?.imagePreview || null
      }
    }).filter(Boolean)

    if (scoresToSave.length === 0) {
      alert('Please enter at least one score')
      return
    }

    try {
      setSaving(true)
      await scoresAPI.saveScores(scoresToSave)
      
      // Clear CTP data for saved players
      setCtpData(prev => {
        const newData = { ...prev }
        selectedPlayers.forEach(playerId => delete newData[playerId])
        return newData
      })
      
      // Move to next hole
      const currentIndex = getCurrentHoleIndex()
      if (currentIndex >= 0 && currentIndex < playableHoles.length - 1) {
        setCurrentHole(playableHoles[currentIndex + 1].hole_number)
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
    return playableHoles.find(h => h.hole_number === currentHole)
  }

  const getPlayerTotal = (playerId) => {
    let total = 0
    const currentIndex = getCurrentHoleIndex()
    const holesToCount = currentIndex >= 0 ? playableHoles.slice(0, currentIndex + 1) : []
    for (const hole of holesToCount) {
      const scoreValue = scores[`${hole.hole_number}-${playerId}-score`]
      if (scoreValue) {
        total += parseInt(scoreValue)
      }
    }
    return total
  }

  const getPlayerQuotaTotal = (playerId) => {
    let total = 0
    const currentIndex = getCurrentHoleIndex()
    const holesToCount = currentIndex >= 0 ? playableHoles.slice(0, currentIndex + 1) : []
    for (const hole of holesToCount) {
      const quotaValue = scores[`${hole.hole_number}-${playerId}-quota`]
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
              const startHole = tournament?.number_of_holes === 9 && tournament?.nine_hole_side === 'back' ? 10 : 1
              setCurrentHole(startHole)
            }}
          >
            <option value="">Choose a tournament...</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {formatDateOnly(t.date)} - {t.course_name}{t.number_of_holes === 9 ? ` (${t.nine_hole_side === 'back' ? 'back' : 'front'})` : ''}
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
                      <div className="text-xs text-gray-600">Quota: {getPlayerCurrentQuota(player) ?? '-'}</div>
                    </button>
                  ))}
                </div>
                  <div className="mt-2 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Selected: {selectedPlayers.length}/4
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 italic">Click players to add/remove</div>
                      {foursomeGroup && selectedPlayers.length > 0 && (
                        <button
                          onClick={assignGroupToSelectedPlayers}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg font-semibold"
                        >
                          Assign Group to Selected Players
                        </button>
                      )}
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

            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Hole {currentHole} of {playableHoles.length}
                </h2>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Par</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {holeData.mens_par}
                  </div>
                </div>
              </div>
              {holeData.mens_par === 3 && ctpLeader && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-green-800">📍 Current CTP Leader</div>
                      <div className="text-lg font-bold text-green-900">{ctpLeader.player_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {ctpLeader.ctp_feet}' {ctpLeader.ctp_inches}"
                      </div>
                      <div className="text-xs text-gray-600">to beat</div>
                    </div>
                  </div>
                </div>
              )}
              {holeData.mens_par === 3 && !ctpLeader && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-semibold text-blue-800">📍 No CTP recorded yet - be the first!</div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {selectedPlayers.map(playerId => {
                const player = players.find(p => p.id === playerId)
                const playerHasQuota = hasCurrentQuota(player)
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
                          value={scores[`${currentHole}-${playerId}-quota`] ?? ''}
                          onChange={(e) => handleScoreChange(playerId, 'quota', e.target.value)}
                        />
                        {!playerHasQuota && (
                          <div className="text-xs text-gray-500 mt-1 text-center">No quota</div>
                        )}
                      </div>
                    </div>
                    {holeData.mens_par === 3 && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => handleOpenCtpModal(playerId)}
                          className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition ${
                            ctpData[playerId] 
                              ? 'bg-green-100 text-green-800 border-2 border-green-500' 
                              : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {ctpData[playerId] ? '✓ CTP Recorded' : '📍 Set Closest to Pin'}
                        </button>
                        {ctpData[playerId] && (
                          <div className="text-xs text-gray-600 mt-1 text-center">
                            {ctpData[playerId].feet}' {ctpData[playerId].inches}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  const currentIndex = getCurrentHoleIndex()
                  if (currentIndex > 0) {
                    setCurrentHole(playableHoles[currentIndex - 1].hole_number)
                  }
                }}
                disabled={getCurrentHoleIndex() <= 0}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold disabled:opacity-50"
              >
                ← Previous
              </button>
              <button
                onClick={saveCurrentHole}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : getCurrentHoleIndex() < playableHoles.length - 1 ? 'Save & Next →' : 'Save & Finish'}
              </button>
            </div>
          </div>
        )}

        {/* Hole Navigation */}
        {selectedPlayers.length > 0 && playableHoles.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Quick Navigation</div>
            <div className="grid grid-cols-6 gap-2">
              {playableHoles.map(hole => (
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

        {/* CTP Modal */}
        {showCtpModal && ctpPlayerId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Closest to Pin - {players.find(p => p.id === ctpPlayerId)?.name}</h3>
              
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Distance</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Feet</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="0"
                      value={ctpData[ctpPlayerId]?.feet || ''}
                      onChange={(e) => handleCtpChange('feet', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Inches</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="11.9"
                      step="0.1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="0.0"
                      value={ctpData[ctpPlayerId]?.inches || ''}
                      onChange={(e) => handleCtpChange('inches', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCtpImageChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                {ctpData[ctpPlayerId]?.imagePreview && (
                  <div className="mt-2">
                    <img 
                      src={ctpData[ctpPlayerId].imagePreview} 
                      alt="CTP measurement" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCtp}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Save
                </button>
                <button
                  onClick={handleCloseCtpModal}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
