import { useState, useEffect, useRef, useContext } from 'react'
import { tournamentsAPI, coursesAPI, playersAPI, scoresAPI } from '../api'
import { formatDateOnly } from '../utils/date'
import { AuthContext } from '../context/AuthContext'
import { isAdminCapable } from '../utils/roles'

export const ScoreEntry = () => {
  const { user } = useContext(AuthContext)
  const isAdmin = isAdminCapable(user)
  const [tournaments, setTournaments] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [foursomeGroup, setFoursomeGroup] = useState('')
  const [foursomeGroups, setFoursomeGroups] = useState([])
  const [foursomePairs, setFoursomePairs] = useState({})
  const [currentHole, setCurrentHole] = useState(1)
  const [holes, setHoles] = useState([])
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ctpData, setCtpData] = useState({})
  const [showCtpModal, setShowCtpModal] = useState(false)
  const [ctpPlayerId, setCtpPlayerId] = useState(null)
  const [ctpLeader, setCtpLeader] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [isPosted, setIsPosted] = useState(false)
  const [postedInfo, setPostedInfo] = useState(null)
  const [posting, setPosting] = useState(false)
  const [isFivesome, setIsFivesome] = useState(false)
  const scoreInputRefs = useRef({})

  // Helper to focus the next player's input for the same field
  const focusNext = (currentPlayerId, field) => {
    const idx = selectedPlayers.indexOf(currentPlayerId)
    const nextId = selectedPlayers[idx + 1]
    if (nextId != null) {
      const key = `${currentHole}-${nextId}-${field}`
      scoreInputRefs.current[key]?.focus()
      scoreInputRefs.current[key]?.select()
    }
  }

  const getDefaultStartHole = (tournament) => {
    if (!tournament) return 1
    return tournament.number_of_holes === 9 && tournament.nine_hole_side === 'back' ? 10 : 1
  }

  const getStartingHoleFromGroupName = (groupName) => {
    if (!groupName) return null
    const match = String(groupName).trim().match(/^(\d{1,2})/)
    if (!match) return null

    const hole = Number(match[1])
    return hole >= 1 && hole <= 18 ? hole : null
  }

  const isHolePlayableForTournament = (tournament, holeNumber) => {
    if (!tournament || !holeNumber) return false

    if (tournament.number_of_holes === 9) {
      const side = tournament.nine_hole_side || 'front'
      if (side === 'back') {
        return holeNumber >= 10 && holeNumber <= 18
      }
      return holeNumber >= 1 && holeNumber <= 9
    }

    return holeNumber >= 1 && holeNumber <= 18
  }

  const resolveStartHoleForGroup = (tournament, groupName) => {
    const parsedStartHole = getStartingHoleFromGroupName(groupName)
    if (parsedStartHole && isHolePlayableForTournament(tournament, parsedStartHole)) {
      return parsedStartHole
    }
    return getDefaultStartHole(tournament)
  }

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

  // If URL has query params (tid & foursome) allow direct link to a foursome
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tid = params.get('tid')
    const fq = params.get('foursome')
    if (!tid) return

    const loadFoursome = async () => {
      try {
        const tResp = await tournamentsAPI.get(tid)
        setSelectedTournament(tResp.data)
        setCurrentHole(resolveStartHoleForGroup(tResp.data, fq))
        await fetchTournamentPlayers(tid)
        if (fq) {
          setFoursomeGroup(fq)
          const res = await tournamentsAPI.getFoursome(tid, fq)
          const fps = {}
          const ids = res.data.map(p => {
            if (p.pair != null) fps[p.player_id] = p.pair
            return p.player_id
          })
          setSelectedPlayers(ids)
          setFoursomePairs(fps)
        }
      } catch (err) {
        console.error('Error loading foursome from URL:', err)
      }
    }

    loadFoursome()
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
      loadPostStatus()
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

  const loadPostStatus = async () => {
    if (!selectedTournament || !foursomeGroup) return
    try {
      const res = await scoresAPI.getFoursomePostStatus(selectedTournament.id, foursomeGroup)
      setIsPosted(res.data.posted)
      setPostedInfo(res.data.posted ? res.data : null)
    } catch (err) {
      console.error('Error loading post status:', err)
    }
  }

  const renderSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-slate-200 rounded-full" />
            <div className="h-5 bg-slate-200 rounded w-32" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )

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
      // API returns { course, tees: [{ holes: [{ hole_id, hole_number, par, handicap }] }] }
      const firstTee = response.data.tees?.[0]
      if (firstTee?.holes?.length > 0) {
        const mapped = firstTee.holes.map(h => ({
          id: h.hole_id,
          hole_number: h.hole_number,
          mens_par: h.par,
          womens_par: h.par,
          mens_handicap: h.handicap,
          ladies_handicap: h.handicap
        }))
        setHoles(mapped.sort((a, b) => a.hole_number - b.hole_number))
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
    setCurrentHole(resolveStartHoleForGroup(selectedTournament, groupName))
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
      // build pairs payload only for selected players
      const pairsPayload = {}
      selectedPlayers.forEach(pid => {
        if (foursomePairs[pid] !== undefined && foursomePairs[pid] !== null && foursomePairs[pid] !== '') {
          pairsPayload[pid] = Number(foursomePairs[pid])
        }
      })

      await tournamentsAPI.assignFoursomeGroup(selectedTournament.id, foursomeGroup, playerIds, Object.keys(pairsPayload).length ? pairsPayload : undefined)
      await fetchFoursomeGroups(selectedTournament.id)
      alert('Foursome group assigned to selected players')
    } catch (err) {
      console.error('Error assigning foursome group:', err)
      alert('Failed to assign foursome group')
    }
  }

  const autoPairSelected = () => {
    // Assign pair numbers 1/2 based on selection order: first two -> pair 1, next two -> pair 2
    const newPairs = {}
    selectedPlayers.forEach((pid, idx) => {
      const pairNum = Math.floor(idx / 2) + 1
      newPairs[pid] = pairNum
    })
    setFoursomePairs(prev => ({ ...prev, ...newPairs }))
  }

  const clearPairs = () => {
    setFoursomePairs(prev => {
      const copy = { ...prev }
      selectedPlayers.forEach(pid => { delete copy[pid] })
      return copy
    })
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

  const getScoreColor = (score, par) => {
    if (!score || !par) return 'bg-white'
    const scoreInt = parseInt(score)
    const parInt = parseInt(par)
    const relative = scoreInt - parInt

    if (scoreInt === 1) return 'bg-amber-100 border-amber-500 text-amber-900' // Ace
    if (relative <= -2) return 'bg-amber-50 border-amber-400 text-amber-800' // Eagle
    if (relative === -1) return 'bg-blue-50 border-blue-400 text-blue-800' // Birdie
    if (relative === 0) return 'bg-fairway-50 border-fairway-400 text-fairway-800' // Par
    if (relative === 1) return 'bg-slate-50 border-slate-300 text-slate-700' // Bogey
    return 'bg-red-50 border-red-300 text-red-700' // Double+
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
        // Last playable hole was saved. If anything is missing, jump to the earliest missing hole.
        const earliestIncompleteHole = findEarliestIncompleteHole(playableHoles, selectedPlayers, scores)
        if (earliestIncompleteHole != null) {
          setCurrentHole(earliestIncompleteHole)
        } else {
          // All holes done — show completion modal
          setShowCompletionModal(true)
        }
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

  const findEarliestIncompleteHole = (holeList, playerIds, scoreMap) => {
    for (const hole of holeList) {
      const hasMissingEntry = playerIds.some(playerId => {
        const scoreValue = scoreMap[`${hole.hole_number}-${playerId}-score`]
        return scoreValue === undefined || scoreValue === null || scoreValue === ''
      })

      if (hasMissingEntry) {
        return hole.hole_number
      }
    }

    return null
  }

  const handlePostScores = async () => {
    if (!selectedTournament || !foursomeGroup) return
    try {
      setPosting(true)
      const res = await scoresAPI.postFoursomeScores(selectedTournament.id, foursomeGroup)
      setIsPosted(true)
      setPostedInfo(res.data)
      setShowCompletionModal(false)
    } catch (err) {
      const status = err?.response?.status
      const serverError = err?.response?.data?.error
      const requestUrl = err?.config?.url
      const code = err?.code
      const message = serverError || err?.message || 'Unknown error'

      console.error('Error posting scores:', {
        status,
        code,
        message,
        serverError,
        requestUrl,
        foursomeGroup,
        tournamentId: selectedTournament?.id
      })

      const detail = status
        ? `(${status}) ${message}`
        : `${message}${code ? ` [${code}]` : ''}`
      alert(`Failed to post scores: ${detail}`)
    } finally {
      setPosting(false)
    }
  }

  // Build full scorecard summary for completion modal
  const getScorecardSummary = () => {
    return selectedPlayers.map(playerId => {
      const player = players.find(p => p.id === playerId)
      const holeScores = playableHoles.map(hole => ({
        hole_number: hole.hole_number,
        score: scores[`${hole.hole_number}-${playerId}-score`] || '',
        quota: scores[`${hole.hole_number}-${playerId}-quota`] ?? ''
      }))
      const totalScore = holeScores.reduce((sum, h) => sum + (parseInt(h.score) || 0), 0)
      const totalQuota = holeScores.reduce((sum, h) => sum + (parseInt(h.quota) || 0), 0)
      const playerQuota = getPlayerCurrentQuota(player)
      return { player, holeScores, totalScore, totalQuota, playerQuota }
    })
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Score Entry</h1>
          <p className="text-slate-500 text-sm mt-1">Enter tournament scores</p>
        </div>

        {/* Posted / Locked Banner */}
        {isPosted && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-4 flex items-center gap-2">
            <span className="text-green-700 font-semibold">✓ Scores Posted</span>
            {postedInfo?.posted_by_name && (
              <span className="text-green-600 text-sm">by {postedInfo.posted_by_name}</span>
            )}
            {!isAdmin && (
              <span className="ml-auto text-xs text-gray-500">Contact an admin to make changes</span>
            )}
            {isAdmin && (
              <span className="ml-auto text-xs text-blue-600">Admin: scores can still be edited</span>
            )}
          </div>
        )}

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
              setCurrentHole(getDefaultStartHole(tournament))
            }}
          >
            <option value="">Choose a tournament...</option>
            {tournaments.filter(t => !t.completed && !t.is_completed).map(t => (
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

        {/* Score Entry for Current Hole */}
        {selectedPlayers.length > 0 && holeData && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            {/* Current Scores Display */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-semibold text-gray-700 mb-2">Current Quota</div>
              <div className="space-y-1">
                {selectedPlayers.map(playerId => {
                  const player = players.find(p => p.id === playerId)
                  const quotaTotal = getPlayerQuotaTotal(playerId)
                  const quotaGoal = getPlayerCurrentQuota(player)
                  return (
                    <div key={playerId} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-800">{player?.name}</span>
                      <span className="text-green-600 font-bold">
                        {Math.round(quotaTotal)}{quotaGoal != null ? <span className="text-gray-500 font-normal"> / {quotaGoal}</span> : ''}
                      </span>
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
              {loading ? renderSkeleton() : selectedPlayers.map((playerId) => {
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
                          pattern="[0-9]*"
                          min="1"
                          max="9"
                          className={`w-full p-3 border-2 rounded-lg text-xl text-center font-bold focus:outline-none transition-colors ${
                            getScoreColor(scores[`${currentHole}-${playerId}-score`], holeData?.mens_par)
                          } ${
                            scores[`${currentHole}-${playerId}-score`] ? '' : 'border-gray-200'
                          }`}
                          placeholder="#"
                          ref={el => { scoreInputRefs.current[`${currentHole}-${playerId}-score`] = el }}
                          value={scores[`${currentHole}-${playerId}-score`] || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 9)) {
                              handleScoreChange(playerId, 'score', val)
                              if (val !== '') focusNext(playerId, 'score')
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Quota</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          max="9"
                          className="w-full p-3 border-2 border-gray-200 rounded-lg text-xl text-center font-bold focus:border-fairway-500 focus:outline-none bg-white"
                          placeholder="#"
                          ref={el => { scoreInputRefs.current[`${currentHole}-${playerId}-quota`] = el }}
                          value={scores[`${currentHole}-${playerId}-quota`] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 9)) {
                              handleScoreChange(playerId, 'quota', val)
                              if (val !== '') focusNext(playerId, 'quota')
                            }
                          }}
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
                          className={`w-full min-h-[44px] py-2 px-3 rounded-lg font-semibold text-sm transition ${
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
                  className={`p-2 min-h-[44px] min-w-[44px] rounded text-sm font-semibold ${
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

        {/* Player Selection */}
        {selectedTournament && foursomeGroup && (
          <div className="bg-white rounded-lg shadow p-4 mt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Select Players (up to {isFivesome ? 5 : 4})
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
                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={isFivesome}
                    onChange={(e) => {
                      setIsFivesome(e.target.checked)
                      if (!e.target.checked) {
                        setSelectedPlayers(prev => prev.slice(0, 4))
                      }
                    }}
                  />
                  <span className="text-sm text-gray-700">This is a fivesome</span>
                </label>
                <div className="flex flex-col gap-2">
                  {(isFivesome ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]).map(slot => (
                    <div key={slot} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16">Player {slot + 1}</span>
                      <select
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-base"
                        value={selectedPlayers[slot] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseInt(e.target.value)
                          setSelectedPlayers(prev => {
                            const next = [...prev]
                            if (val === null) {
                              next.splice(slot, 1)
                            } else {
                              next[slot] = val
                            }
                            return next.filter(Boolean)
                          })
                        }}
                      >
                        <option value="">— Select player —</option>
                        {players
                          .filter(p => !selectedPlayers.includes(p.id) || selectedPlayers[slot] === p.id)
                          .map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} (Quota: {getPlayerCurrentQuota(player) ?? '-'})
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <div className="text-sm text-gray-600">
                    Selected: {selectedPlayers.length}/{isFivesome ? 5 : 4}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Completion / Post Scores Modal */}
        {showCompletionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-screen overflow-y-auto">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">All Holes Complete!</h3>
                <p className="text-sm text-gray-600 mb-4">Review scores below, then post when ready.</p>

                {/* Scorecard summary */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left p-1 font-semibold">Player</th>
                        {playableHoles.map(h => (
                          <th key={h.hole_number} className="p-1 text-center w-7">{h.hole_number}</th>
                        ))}
                        <th className="p-1 text-center font-semibold">Score</th>
                        <th className="p-1 text-center font-semibold">Pts</th>
                        <th className="p-1 text-center font-semibold">Quota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getScorecardSummary().map(({ player, holeScores, totalScore, totalQuota, playerQuota }) => (
                        <tr key={player?.id} className="border-t border-gray-100">
                          <td className="p-1 font-medium text-gray-800 whitespace-nowrap">{player?.name}</td>
                          {holeScores.map(h => (
                            <td key={h.hole_number} className="p-1 text-center text-gray-700">{h.score || '-'}</td>
                          ))}
                          <td className="p-1 text-center font-semibold">{totalScore || '-'}</td>
                          <td className="p-1 text-center font-semibold text-green-700">{totalQuota}</td>
                          <td className="p-1 text-center text-gray-500">{playerQuota ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handlePostScores}
                    disabled={posting}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold text-base hover:bg-green-700 disabled:opacity-50"
                  >
                    {posting ? 'Posting...' : '✓ Post Scores'}
                  </button>
                  <button
                    onClick={() => setShowCompletionModal(false)}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Keep Editing
                  </button>
                </div>
              </div>
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
                      pattern="[0-9]*"
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
