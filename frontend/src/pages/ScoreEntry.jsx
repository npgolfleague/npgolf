import { useState, useEffect, useRef, useContext } from 'react'
import { tournamentsAPI, coursesAPI, playersAPI, scoresAPI } from '../api'
import { formatDateOnly } from '../utils/date'
import { AuthContext } from '../context/AuthContext'
import { isAdminCapable } from '../utils/roles'
import { isArchivedRound } from '../utils/season'
import { ConfirmModal } from '../components/ConfirmModal'

// How long to wait after the last score on a hole before saving it automatically.
const AUTOSAVE_DELAY_MS = 1200

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
  const [ctpMode, setCtpMode] = useState('regular')
  const [foursomeGameEnabled, setFoursomeGameEnabled] = useState(false)
  const [foursomeGameMatchAmount, setFoursomeGameMatchAmount] = useState('5')
  const [foursomeGameCtpAmount, setFoursomeGameCtpAmount] = useState('1')
  const [foursomeGameCtpData, setFoursomeGameCtpData] = useState({})
  const [ctpLeader, setCtpLeader] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [isPosted, setIsPosted] = useState(false)
  const [postedInfo, setPostedInfo] = useState(null)
  const [posting, setPosting] = useState(false)
  // Marker sign-off
  const [signing, setSigning] = useState(false)
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [attestError, setAttestError] = useState('')
  // Holes with score or CTP changes that haven't been saved yet
  const [dirtyHoles, setDirtyHoles] = useState(() => new Set())
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [saveError, setSaveError] = useState('')
  const [rosterSaving, setRosterSaving] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const [addPlayerId, setAddPlayerId] = useState('')
  // What the server last saved for each `${hole}-${playerId}`: the score and when
  // it last changed. A saved hole locks once that player has a later hole saved.
  const [savedScores, setSavedScores] = useState({})
  const scoreInputRefs = useRef({})
  const savingRef = useRef(false)
  // Set when the page was opened from a cart-tag QR link, so we don't
  // replace that foursome with the signed-in player's own.
  const deepLinkedRef = useRef(Boolean(new URLSearchParams(window.location.search).get('foursome')))

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
        // Scores in a closed season can't be changed, so don't open it for entry.
        if (isArchivedRound(tResp.data)) return
        setSelectedTournament(tResp.data)
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
          setCtpData({})
          setFoursomeGameCtpData({})
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

  // Load saved scores when the foursome (or the course's holes) changes. Adding or
  // dropping a player doesn't reload, so scores typed but not yet saved survive.
  const hasPlayers = selectedPlayers.length > 0
  useEffect(() => {
    if (selectedTournament && foursomeGroup && hasPlayers && holes.length > 0) {
      loadExistingScores()
      loadPostStatus()
    }
  }, [selectedTournament, foursomeGroup, hasPlayers, holes])

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
      setPostedInfo(res.data)
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

  // Order players pair 1 first, then pair 2, then anyone without a pair, so the
  // side game's first match is pair 1 against pair 2.
  const orderByPair = (ids, pairs) => {
    const rank = (pid) => (pairs[pid] == null || pairs[pid] === '' ? 99 : Number(pairs[pid]))
    return [...ids].sort((a, b) => rank(a) - rank(b))
  }

  const handleGroupSelect = async (groupName) => {
    setFoursomeGroup(groupName)
    setCtpData({})
    setFoursomeGameCtpData({})
    setDirtyHoles(new Set())
    setRosterError('')
    if (!groupName || !selectedTournament) {
      setSelectedPlayers([])
      setFoursomePairs({})
      return
    }
    try {
      // The foursome as set up in Tournament Players (with pairs)...
      const roster = await tournamentsAPI.getFoursome(selectedTournament.id, groupName)
      if (roster.data.length > 0) {
        const pairs = {}
        roster.data.forEach(p => { if (p.pair != null) pairs[p.player_id] = p.pair })
        setFoursomePairs(pairs)
        setSelectedPlayers(orderByPair(roster.data.map(p => p.player_id), pairs))
        return
      }
      // ...or, for a group that was only ever typed in, whoever has scores in it.
      const response = await scoresAPI.getFoursomeScores(selectedTournament.id, groupName)
      setFoursomePairs({})
      setSelectedPlayers([...new Set(response.data.map(score => score.player_id))])
    } catch (err) {
      console.error('Error loading group players:', err)
    }
  }

  const rosterLocked = isPosted && !isAdmin

  // Same rule the server enforces: a saved score locks (for non-admins) once
  // that player has a later hole saved.
  const isScoreLocked = (holeNumber, playerId) => {
    if (isAdmin) return false
    const mine = savedScores[`${holeNumber}-${playerId}`]
    if (!mine) return false
    return Object.entries(savedScores).some(([key, value]) =>
      key.endsWith(`-${playerId}`) && !key.startsWith(`${holeNumber}-`) && value.at > mine.at
    )
  }

  // Save the foursome's line-up so Tournament Players, cart tags and the
  // leaderboard all see the same group.
  const persistRoster = async (nextIds, nextPairs) => {
    if (!selectedTournament || !foursomeGroup) return false
    const pairsPayload = {}
    nextIds.forEach(pid => { pairsPayload[pid] = nextPairs[pid] ?? null })
    try {
      setRosterSaving(true)
      setRosterError('')
      await tournamentsAPI.saveFoursomeRoster(selectedTournament.id, foursomeGroup, nextIds, pairsPayload)
      fetchFoursomeGroups(selectedTournament.id)
      return true
    } catch (err) {
      console.error('Error saving foursome:', err)
      setRosterError(err.response?.data?.error || 'Could not save the foursome. Check your connection and try again.')
      return false
    } finally {
      setRosterSaving(false)
    }
  }

  const applyRoster = async (nextIds, nextPairs) => {
    const prevIds = selectedPlayers
    const prevPairs = foursomePairs
    const ordered = orderByPair(nextIds, nextPairs)
    setSelectedPlayers(ordered)
    setFoursomePairs(nextPairs)
    const ok = await persistRoster(ordered, nextPairs)
    if (!ok) {
      setSelectedPlayers(prevIds)
      setFoursomePairs(prevPairs)
    }
  }

  const handleAddPlayer = async (playerId) => {
    if (!playerId || selectedPlayers.includes(playerId) || selectedPlayers.length >= 4) return
    setAddPlayerId('')
    await applyRoster([...selectedPlayers, playerId], foursomePairs)
  }

  const playerHasSavedScores = (playerId) =>
    playableHoles.some(h => scores[`${h.hole_number}-${playerId}-score`])

  const handleRemovePlayer = async (playerId) => {
    const nextPairs = { ...foursomePairs }
    delete nextPairs[playerId]
    setPendingRemoval(null)
    await applyRoster(selectedPlayers.filter(id => id !== playerId), nextPairs)
  }

  const handlePairChange = async (playerId, value) => {
    const nextPairs = { ...foursomePairs, [playerId]: value === '' ? null : Number(value) }
    await applyRoster(selectedPlayers, nextPairs)
  }

  const markDirty = (holeNumber) => {
    setDirtyHoles(prev => {
      if (prev.has(holeNumber)) return prev
      const next = new Set(prev)
      next.add(holeNumber)
      return next
    })
    setSaveStatus('idle')
  }

  // keepUnsaved: keep values typed on holes not yet saved (false after a rejected save)
  const loadExistingScores = async ({ keepUnsaved = true } = {}) => {
    try {
      const response = await scoresAPI.getFoursomeScores(selectedTournament.id, foursomeGroup)
      const existingScores = response.data
      
      // Convert existing scores to the format expected by the component
      const loadedScores = {}
      const loadedFoursomeCtp = {}
      const loadedSaved = {}
      existingScores.forEach(scoreRecord => {
        const hole = holes.find(h => h.id === scoreRecord.hole_id)
        if (hole) {
          loadedSaved[`${hole.hole_number}-${scoreRecord.player_id}`] = {
            score: Number(scoreRecord.score),
            at: Date.parse(scoreRecord.entered_at) || 0
          }
          loadedScores[`${hole.hole_number}-${scoreRecord.player_id}-score`] = scoreRecord.score
          loadedScores[`${hole.hole_number}-${scoreRecord.player_id}-quota`] = scoreRecord.quota
          if (scoreRecord.foursome_ctp_feet !== null && scoreRecord.foursome_ctp_feet !== undefined) {
            loadedFoursomeCtp[hole.hole_number] = {
              playerId: scoreRecord.player_id,
              feet: scoreRecord.foursome_ctp_feet,
              inches: scoreRecord.foursome_ctp_inches,
              imagePreview: scoreRecord.foursome_ctp_image_url || null
            }
          }
        }
      })
      
      // Keep anything typed on holes that haven't been saved yet.
      setScores(prev => {
        const merged = { ...loadedScores }
        Object.keys(prev).forEach(key => {
          const holeNumber = Number(key.split('-')[0])
          if (keepUnsaved && dirtyHoles.has(holeNumber)) merged[key] = prev[key]
        })
        return merged
      })
      setFoursomeGameCtpData(loadedFoursomeCtp)
      setSavedScores(loadedSaved)
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
    markDirty(currentHole)
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

  const handleOpenCtpModal = (playerId, mode = 'regular') => {
    setCtpPlayerId(playerId)
    setCtpMode(mode)
    setShowCtpModal(true)
  }

  const handleCloseCtpModal = () => {
    setShowCtpModal(false)
    setCtpPlayerId(null)
    setCtpMode('regular')
  }

  const handleCtpChange = (field, value) => {
    markDirty(currentHole)
    if (ctpMode === 'foursome') {
      setFoursomeGameCtpData(prev => ({
        ...prev,
        [currentHole]: {
          ...prev[currentHole],
          playerId: ctpPlayerId,
          [field]: value
        }
      }))
      return
    }

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
      markDirty(currentHole)
      const reader = new FileReader()
      reader.onloadend = () => {
        if (ctpMode === 'foursome') {
          setFoursomeGameCtpData(prev => ({
            ...prev,
            [currentHole]: {
              ...prev[currentHole],
              playerId: ctpPlayerId,
              imageFile: file,
              imagePreview: reader.result
            }
          }))
          return
        }

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

  // Save one hole's scores. `advance` moves to the next hole afterwards (Save &
  // Next); `silent` reports problems inline instead of with a pop-up (auto-save).
  // Returns true when the hole is saved (or there was nothing to save).
  const saveHole = async (holeNumber, { advance = false, silent = false } = {}) => {
    const fail = (message) => {
      setSaveStatus('error')
      setSaveError(message)
      if (!silent) alert(message)
      return false
    }

    if (selectedPlayers.length === 0 || !selectedTournament || !foursomeGroup) {
      return fail('Please select a tournament, a foursome and players first')
    }

    const currentHoleData = playableHoles.find(h => h.hole_number === holeNumber)
    if (!currentHoleData) {
      return fail('Hole data not found')
    }

    const scoresToSave = selectedPlayers.map(playerId => {
      const scoreValue = scores[`${holeNumber}-${playerId}-score`]
      const quotaValue = scores[`${holeNumber}-${playerId}-quota`]
      const playerCtp = holeNumber === currentHole ? ctpData[playerId] : undefined
      const foursomeCtp = foursomeGameCtpData[holeNumber]
      if (!scoreValue) return null

      return {
        tournament_id: selectedTournament.id,
        player_id: playerId,
        hole_id: currentHoleData.id,
        score: parseInt(scoreValue),
        quota: quotaValue !== '' && quotaValue !== null && quotaValue !== undefined ? parseInt(quotaValue) : null,
        foursome_group: foursomeGroup,
        ctp_feet: playerCtp?.feet !== '' && playerCtp?.feet !== null && playerCtp?.feet !== undefined ? parseInt(playerCtp.feet) : null,
        ctp_inches: playerCtp?.inches !== '' && playerCtp?.inches !== null && playerCtp?.inches !== undefined ? parseFloat(playerCtp.inches) : null,
        ctp_image_url: playerCtp?.imagePreview || null,
        foursome_ctp_feet: foursomeCtp?.playerId === playerId && foursomeCtp?.feet !== '' && foursomeCtp?.feet !== null && foursomeCtp?.feet !== undefined ? parseInt(foursomeCtp.feet) : null,
        foursome_ctp_inches: foursomeCtp?.playerId === playerId && foursomeCtp?.inches !== '' && foursomeCtp?.inches !== null && foursomeCtp?.inches !== undefined ? parseFloat(foursomeCtp.inches) : null,
        foursome_ctp_image_url: foursomeCtp?.playerId === playerId ? foursomeCtp?.imagePreview || null : null
      }
    }).filter(Boolean)

    const goNext = () => {
      const index = playableHoles.findIndex(h => h.hole_number === holeNumber)
      if (index >= 0 && index < playableHoles.length - 1) {
        setCurrentHole(playableHoles[index + 1].hole_number)
      } else {
        // All holes done — show completion modal
        setShowCompletionModal(true)
      }
    }

    if (scoresToSave.length === 0) {
      if (advance) {
        alert('Please enter at least one score')
        return false
      }
      return true // nothing entered on this hole yet
    }

    if (savingRef.current) return false
    try {
      savingRef.current = true
      setSaving(true)
      setSaveStatus('saving')
      await scoresAPI.saveScores(scoresToSave)

      // Clear CTP data for saved players (it belongs to the hole just saved)
      if (holeNumber === currentHole) {
        setCtpData(prev => {
          const newData = { ...prev }
          selectedPlayers.forEach(playerId => delete newData[playerId])
          return newData
        })
      }
      setDirtyHoles(prev => {
        const next = new Set(prev)
        next.delete(holeNumber)
        return next
      })
      // The server only restamps a score when it changes; mirror that so the
      // lock state below matches what the server will enforce.
      const now = Date.now()
      setSavedScores(prev => {
        const next = { ...prev }
        scoresToSave.forEach(row => {
          const key = `${holeNumber}-${row.player_id}`
          if (!next[key] || next[key].score !== row.score) next[key] = { score: row.score, at: now }
        })
        return next
      })
      setSaveStatus('saved')
      setSaveError('')

      if (advance) goNext()
      return true
    } catch (err) {
      console.error('Error saving scores:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save scores'
      if (err.response?.status === 409) {
        // A locked hole was changed: put back what was saved.
        setDirtyHoles(prev => {
          const next = new Set(prev)
          next.delete(holeNumber)
          return next
        })
        loadExistingScores({ keepUnsaved: false })
      }
      return fail(`Hole ${holeNumber} not saved: ${errorMessage}`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const saveCurrentHole = () => saveHole(currentHole, { advance: true })

  // Moving to another hole saves the one you're leaving first.
  const goToHole = async (holeNumber) => {
    if (holeNumber === currentHole) return
    if (dirtyHoles.has(currentHole) && !rosterLocked) {
      const ok = await saveHole(currentHole, { silent: true })
      if (!ok) return
    }
    setCurrentHole(holeNumber)
  }

  // Save a hole on its own once every player in the foursome has a score on it.
  useEffect(() => {
    if (!dirtyHoles.has(currentHole) || rosterLocked || selectedPlayers.length === 0) return
    const allEntered = selectedPlayers.every(pid => scores[`${currentHole}-${pid}-score`])
    if (!allEntered) return
    const timer = setTimeout(() => { saveHole(currentHole, { silent: true }) }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [scores, currentHole, dirtyHoles, selectedPlayers, rosterLocked])

  // Warn before leaving the page with scores that haven't been saved.
  useEffect(() => {
    if (dirtyHoles.size === 0) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyHoles])

  // Open the signed-in player's own foursome when they have one in this tournament.
  useEffect(() => {
    if (deepLinkedRef.current || foursomeGroup || !user?.id || foursomeGroups.length === 0) return
    const mine = foursomeGroups.find(g => g.assigned && (g.player_ids || []).includes(Number(user.id)))
    if (mine) handleGroupSelect(mine.foursome_group)
  }, [foursomeGroups])

  const getCurrentHoleData = () => {
    return playableHoles.find(h => h.hole_number === currentHole)
  }

  const handlePostScores = async () => {
    if (!selectedTournament || !foursomeGroup) return
    try {
      setPosting(true)
      const res = await scoresAPI.postFoursomeScores(selectedTournament.id, foursomeGroup)
      setIsPosted(Boolean(res.data.posted))
      setPostedInfo(res.data)
      setShowCompletionModal(false)
    } catch (err) {
      console.error('Error posting scores:', err)
      alert('Failed to post scores. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  // Marker signs the card, or flags a problem for an admin
  const handleAttest = async (decision) => {
    if (!selectedTournament || !foursomeGroup) return
    try {
      setSigning(true)
      setAttestError('')
      const res = await scoresAPI.attestCard(selectedTournament.id, foursomeGroup, decision, decision === 'flag' ? flagNote : undefined)
      setIsPosted(Boolean(res.data.posted))
      setPostedInfo(res.data)
      setShowFlagForm(false)
      setFlagNote('')
    } catch (err) {
      setAttestError(err.response?.data?.error || 'Could not save. Check your connection and try again.')
    } finally {
      setSigning(false)
    }
  }

  const handleReopenCard = async () => {
    if (!selectedTournament || !foursomeGroup) return
    try {
      setSigning(true)
      setAttestError('')
      const res = await scoresAPI.reopenCard(selectedTournament.id, foursomeGroup)
      setIsPosted(Boolean(res.data.posted))
      setPostedInfo(res.data)
    } catch (err) {
      setAttestError(err.response?.data?.error || 'Could not reopen the card.')
    } finally {
      setSigning(false)
    }
  }

  // Once this card's holes are all entered, check its status every 20 seconds
  // so the marker's phone shows the card to sign as soon as it's submitted.
  const cardComplete = selectedPlayers.length > 0 && playableHoles.length > 0 &&
    playableHoles.every(h => selectedPlayers.every(pid => scores[`${h.hole_number}-${pid}-score`]))
  const cardFinal = postedInfo?.status === 'posted'
  useEffect(() => {
    if (!selectedTournament || !foursomeGroup || !cardComplete || cardFinal) return
    const timer = setInterval(() => { loadPostStatus() }, 20000)
    return () => clearInterval(timer)
  }, [selectedTournament, foursomeGroup, cardComplete, cardFinal])

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

  const getFoursomeGameSummary = () => {
    if (!selectedTournament || !foursomeGameEnabled || selectedPlayers.length !== 4 || playableHoles.length === 0) return null
    const matchAmt = Number(foursomeGameMatchAmount) || 0
    const ctpAmt = Number(foursomeGameCtpAmount) || 0
    const segSize = selectedTournament.number_of_holes === 9 ? 3 : 6
    const numSegs = 3
    const [A, B, C, D] = selectedPlayers.map(id => players.find(p => p.id === id))
    const segPairs = [[[A, B], [C, D]], [[A, C], [B, D]], [[A, D], [B, C]]]
    const getPairSegQuotaPoints = (pair, start, end) =>
      playableHoles.slice(start, end).reduce((sum, h) =>
        sum + pair.reduce((ps, p) => {
          const raw = scores[`${h.hole_number}-${p?.id}-quota`]
          if (raw === '' || raw === null || raw === undefined) return ps
          const parsed = Number(raw)
          return ps + (Number.isNaN(parsed) ? 0 : parsed)
        }, 0), 0)
    const getPairSegGoal = (pair) => {
      const pairQuotaTotal = pair.reduce((sum, p) => sum + (getPlayerCurrentQuota(p) || 0), 0)
      return Math.round(pairQuotaTotal / 3)
    }
    const segments = []
    for (let s = 0; s < numSegs; s++) {
      const start = s * segSize
      const end = start + segSize
      const [p0, p1] = segPairs[s]
      const goal0 = getPairSegGoal(p0)
      const goal1 = getPairSegGoal(p1)
      const actual0 = getPairSegQuotaPoints(p0, start, end)
      const actual1 = getPairSegQuotaPoints(p1, start, end)
      const seg0 = actual0 - goal0
      const seg1 = actual1 - goal1
      const pot = matchAmt
      let result
      if (seg0 > seg1) { result = { winner: 0, amount: matchAmt } }
      else if (seg1 > seg0) { result = { winner: 1, amount: matchAmt } }
      else { result = { winner: -1, amount: 0 } }
      segments.push({
        seg: s + 1,
        holes: `${playableHoles[start]?.hole_number}–${playableHoles[end - 1]?.hole_number}`,
        pair0: p0,
        pair1: p1,
        pair0score: seg0,
        pair1score: seg1,
        pair0goal: goal0,
        pair1goal: goal1,
        pair0actual: actual0,
        pair1actual: actual1,
        result,
        pot
      })
    }
    const playerTotals = {}
    selectedPlayers.forEach(id => { playerTotals[id] = 0 })
    segments.forEach(seg => {
      const winners = seg.result.winner === 0 ? seg.pair0 : seg.result.winner === 1 ? seg.pair1 : []
      const losers = seg.result.winner === 0 ? seg.pair1 : seg.result.winner === 1 ? seg.pair0 : []
      winners.forEach(p => { if (p?.id) playerTotals[p.id] = (playerTotals[p.id] || 0) + seg.result.amount })
      losers.forEach(p => { if (p?.id) playerTotals[p.id] = (playerTotals[p.id] || 0) - seg.result.amount })
    })
    const ctpPar3Holes = playableHoles.filter(h => h.mens_par === 3)
    let ctpCarryoverPerPlayer = ctpAmt
    const ctpRows = ctpPar3Holes.map((h, idx) => {
      const record = foursomeGameCtpData[h.hole_number]
      const winner = record?.playerId ? players.find(p => p.id === record.playerId) : null
      // CTP setup amount is per player; winner receives from the other players.
      const amount = winner ? ctpCarryoverPerPlayer * (selectedPlayers.length - 1) : 0
      const isLast = idx === ctpPar3Holes.length - 1

      if (winner) {
        ctpCarryoverPerPlayer = ctpAmt
      } else if (!isLast) {
        ctpCarryoverPerPlayer += ctpAmt
      }

      return { hole: h.hole_number, winner: winner?.name || '—', winnerId: winner?.id || null, amount }
    })
    // Apply CTP payouts to playerTotals
    ctpRows.forEach(row => {
      if (row.winnerId && row.amount > 0) {
        selectedPlayers.forEach(id => {
          if (id === row.winnerId) {
            playerTotals[id] = (playerTotals[id] || 0) + row.amount
          } else {
            playerTotals[id] = (playerTotals[id] || 0) - (row.amount / (selectedPlayers.length - 1))
          }
        })
      }
    })
    return { modeLabel: selectedTournament.number_of_holes === 9 ? '333' : '666', players: [A, B, C, D], segments, playerTotals, ctpRows, matchAmt, ctpAmt }
  }

  const foursomeGameSummary = getFoursomeGameSummary()
  const activeCtpRecord = ctpMode === 'foursome' ? foursomeGameCtpData[currentHole] : ctpData[ctpPlayerId]
  const activeCtpPlayerName = players.find(player => player.id === ctpPlayerId)?.name || ''

  const holeData = getCurrentHoleData()

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Score Entry</h1>
          <p className="text-slate-500 text-sm mt-1">Enter tournament scores</p>
        </div>

        {/* Card status: posted, waiting for the marker, or flagged */}
        {isPosted && postedInfo?.status === 'posted' && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2" role="status">
            <span className="text-green-700 font-semibold">✓ Scores Posted</span>
            {postedInfo?.posted_by_name && (
              <span className="text-green-600 text-sm">by {postedInfo.posted_by_name}</span>
            )}
            {postedInfo?.attested_by_name && (
              <span className="text-green-600 text-sm">· signed by {postedInfo.attested_by_name}</span>
            )}
            {!isAdmin && (
              <span className="ml-auto text-xs text-gray-500">Contact an admin to make changes</span>
            )}
            {isAdmin && (
              <span className="ml-auto text-xs text-blue-600">Admin: scores can still be edited</span>
            )}
          </div>
        )}
        {isPosted && postedInfo?.status === 'awaiting_marker' && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4" role="status">
            <div className="font-semibold text-amber-900">Waiting for the marker to sign</div>
            <p className="text-sm text-amber-800 mt-1">
              Submitted by {postedInfo.posted_by_name || 'your foursome'}.{' '}
              {postedInfo.marker_names?.length
                ? `${postedInfo.marker_names.join(' or ')} can sign it on their phone.`
                : 'Another player in the foursome can sign it on their phone.'}
              {' '}Scores are locked while the card is being signed.
            </p>
          </div>
        )}
        {isPosted && postedInfo?.status === 'disputed' && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4" role="alert">
            <div className="font-semibold text-red-900">The marker flagged this card</div>
            <p className="text-sm text-red-800 mt-1">
              {postedInfo.disputed_by_name ? `${postedInfo.disputed_by_name}: ` : ''}“{postedInfo.dispute_note}”
            </p>
            <p className="text-xs text-red-700 mt-1">{isAdmin ? 'Fix the scores if needed, then sign the card or reopen it.' : 'An admin will review it.'}</p>
          </div>
        )}

        {/* The marker reviews the whole card and signs it, or flags a problem */}
        {isPosted && postedInfo?.can_attest && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 border-2 border-amber-400">
            <h2 className="text-lg font-bold text-gray-900">{postedInfo.status === 'disputed' ? 'Sign the corrected card' : 'Sign this card'}</h2>
            <p className="text-sm text-gray-600 mb-3">Check every hole for every player before you sign.</p>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th scope="col" className="text-left p-1 font-semibold">Player</th>
                    {playableHoles.map(h => (
                      <th scope="col" key={h.hole_number} className="p-1 text-center w-7">{h.hole_number}</th>
                    ))}
                    <th scope="col" className="p-1 text-center font-semibold">Tot</th>
                    <th scope="col" className="p-1 text-center font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {getScorecardSummary().map(({ player, holeScores, totalScore, totalQuota }) => (
                    <tr key={player?.id} className="border-t border-gray-100">
                      <th scope="row" className="p-1 text-left font-medium text-gray-800 whitespace-nowrap">{player?.name}</th>
                      {holeScores.map(h => (
                        <td key={h.hole_number} className="p-1 text-center text-gray-700">{h.score || '–'}</td>
                      ))}
                      <td className="p-1 text-center font-semibold">{totalScore || '–'}</td>
                      <td className="p-1 text-center font-semibold text-green-700">{totalQuota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showFlagForm ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAttest('sign')}
                  disabled={signing}
                  className="flex-1 min-h-[44px] rounded-lg bg-green-600 font-bold text-white disabled:opacity-50"
                >
                  {signing ? 'Saving…' : '✓ I attest this card'}
                </button>
                {postedInfo.status !== 'disputed' && (
                  <button
                    type="button"
                    onClick={() => setShowFlagForm(true)}
                    disabled={signing}
                    className="flex-1 min-h-[44px] rounded-lg border-2 border-red-300 font-semibold text-red-700 disabled:opacity-50"
                  >
                    Flag a problem
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="flag-note" className="block text-sm font-semibold text-gray-700 mb-1">What looks wrong?</label>
                <textarea
                  id="flag-note"
                  className="w-full rounded-lg border border-gray-300 p-2 text-base"
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Hole 14: Fred had a 5, not a 4"
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAttest('flag')}
                    disabled={signing || !flagNote.trim()}
                    className="flex-1 min-h-[44px] rounded-lg bg-red-600 font-semibold text-white disabled:opacity-50"
                  >
                    Send to admin
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowFlagForm(false); setFlagNote('') }}
                    className="flex-1 min-h-[44px] rounded-lg bg-gray-200 font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {attestError && <p role="alert" className="mt-2 text-sm text-red-600">{attestError}</p>}
          </div>
        )}

        {isPosted && postedInfo?.can_reopen && postedInfo?.status !== 'posted' && (
          <div className="mb-4 text-right">
            <button
              type="button"
              onClick={handleReopenCard}
              disabled={signing}
              className="text-sm font-semibold text-blue-700 underline disabled:opacity-50"
            >
              Admin: reopen this card for the foursome to fix
            </button>
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
              setFoursomeGameEnabled(false)
              setFoursomeGameMatchAmount('5')
              setFoursomeGameCtpAmount('1')
              setFoursomeGameCtpData({})
              setFoursomeGroup('')
              setSelectedPlayers([])
              setFoursomePairs({})
              setScores({})
              setDirtyHoles(new Set())
              setSaveStatus('idle')
              const startHole = tournament?.number_of_holes === 9 && tournament?.nine_hole_side === 'back' ? 10 : 1
              setCurrentHole(startHole)
            }}
          >
            <option value="">Choose a tournament...</option>
            {tournaments.filter(t => !t.completed && !t.is_completed && !isArchivedRound(t)).map(t => (
              <option key={t.id} value={t.id}>
                {formatDateOnly(t.date)} - {t.course_name}{t.number_of_holes === 9 ? ` (${t.nine_hole_side === 'back' ? 'back' : 'front'})` : ''}
              </option>
            ))}
          </select>
          {selectedTournament?.standard_quota_game === 0 && (
            <div className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Standard quota game is disabled for this tournament
            </div>
          )}
        </div>

        {/* Foursome Group */}
        {selectedTournament && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <label htmlFor="foursome-select" className="block text-sm font-semibold text-gray-700 mb-2">
              Foursome <span className="text-red-500">*</span>
            </label>

            {foursomeGroups.length > 0 && (
              <select
                id="foursome-select"
                className="w-full p-3 border border-gray-300 rounded-lg text-lg mb-2"
                value={foursomeGroups.some(g => g.foursome_group === foursomeGroup) ? foursomeGroup : ''}
                onChange={(e) => handleGroupSelect(e.target.value)}
              >
                <option value="">Choose your foursome...</option>
                {foursomeGroups.map((group) => (
                  <option key={group.foursome_group} value={group.foursome_group}>
                    {group.foursome_group}{group.players ? ` — ${group.players}` : ''}
                  </option>
                ))}
              </select>
            )}

            <details className="text-sm" open={foursomeGroups.length === 0}>
              <summary className="cursor-pointer text-gray-600 py-1">Start a new foursome</summary>
              <label htmlFor="foursome-new" className="block text-xs text-gray-600 mt-2 mb-1">New foursome name</label>
              <input
                id="foursome-new"
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg text-lg"
                placeholder="e.g., 1, 2, Group A"
                value={foursomeGroups.some(g => g.foursome_group === foursomeGroup) ? '' : foursomeGroup}
                onChange={(e) => {
                  setFoursomeGroup(e.target.value.trimStart())
                  setSelectedPlayers([])
                  setFoursomePairs({})
                }}
              />
            </details>
          </div>
        )}

        {/* Foursome players: filled from the foursome's set-up, and the group can add or drop players */}
        {selectedTournament && foursomeGroup && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-700">Players ({selectedPlayers.length}/4)</div>
              {rosterSaving && <span className="text-xs text-gray-500">Saving…</span>}
            </div>

            {selectedPlayers.length === 0 && (
              <p className="text-sm text-gray-500 mb-2">No players in this foursome yet. Add them below.</p>
            )}

            {[1, 2, null].map(pairNumber => {
              const members = selectedPlayers.filter(pid =>
                pairNumber == null
                  ? foursomePairs[pid] == null || ![1, 2].includes(Number(foursomePairs[pid]))
                  : Number(foursomePairs[pid]) === pairNumber
              )
              if (members.length === 0) return null
              return (
                <div key={pairNumber ?? 'none'} className="mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    {pairNumber == null ? (selectedPlayers.some(pid => foursomePairs[pid] != null) ? 'No pair' : 'Players') : `Pair ${pairNumber}`}
                  </div>
                  <ul className="space-y-1">
                    {members.map(pid => {
                      const player = players.find(p => p.id === pid)
                      return (
                        <li key={pid} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                          <span className="flex-1 font-medium text-gray-800">
                            {player?.name || `Player ${pid}`}
                            <span className="ml-1 text-xs font-normal text-gray-500">Quota {getPlayerCurrentQuota(player) ?? '–'}</span>
                          </span>
                          <label className="sr-only" htmlFor={`pair-${pid}`}>Pair for {player?.name}</label>
                          <select
                            id={`pair-${pid}`}
                            className="min-h-[44px] rounded border border-gray-300 px-2 text-sm"
                            value={foursomePairs[pid] ?? ''}
                            disabled={rosterLocked || rosterSaving}
                            onChange={(e) => handlePairChange(pid, e.target.value)}
                          >
                            <option value="">No pair</option>
                            <option value="1">Pair 1</option>
                            <option value="2">Pair 2</option>
                          </select>
                          <button
                            type="button"
                            className="min-h-[44px] min-w-[44px] rounded px-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                            disabled={rosterLocked || rosterSaving}
                            aria-label={`Drop ${player?.name || 'player'} from this foursome`}
                            onClick={() => (playerHasSavedScores(pid) ? setPendingRemoval(pid) : handleRemovePlayer(pid))}
                          >
                            Drop
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}

            {!rosterLocked && selectedPlayers.length < 4 && (
              <div className="mt-3 flex gap-2">
                <label className="sr-only" htmlFor="add-player">Add a player</label>
                <select
                  id="add-player"
                  className="flex-1 min-h-[44px] p-2 border border-gray-300 rounded-lg text-base"
                  value={addPlayerId}
                  disabled={rosterSaving}
                  onChange={(e) => setAddPlayerId(e.target.value)}
                >
                  <option value="">Add a player…</option>
                  {players
                    .filter(p => !selectedPlayers.includes(p.id))
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.foursome && p.foursome !== foursomeGroup ? ` (now in ${p.foursome})` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="min-h-[44px] rounded-lg bg-fairway-600 px-4 font-semibold text-white disabled:opacity-50"
                  disabled={!addPlayerId || rosterSaving}
                  onClick={() => handleAddPlayer(Number(addPlayerId))}
                >
                  Add
                </button>
              </div>
            )}
            {rosterLocked && (
              <p className="mt-2 text-xs text-gray-500">This foursome's scores are posted, so only an admin can change its players.</p>
            )}
            {rosterError && <p role="alert" className="mt-2 text-sm text-red-600">{rosterError}</p>}
          </div>
        )}

        {/* Side Game Setup */}
        <div className="bg-white rounded-lg shadow p-4 mb-4 border border-emerald-200">
          <div className="text-sm font-semibold text-emerald-900 mb-2">
            {selectedTournament
              ? (selectedTournament.number_of_holes === 9 ? '333' : '666')
              : '333/666'} Side Game Setup
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <input
              type="checkbox"
              checked={foursomeGameEnabled}
              onChange={(e) => setFoursomeGameEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Play {selectedTournament ? (selectedTournament.number_of_holes === 9 ? '333' : '666') : '333/666'} side game
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-emerald-800 mb-1">
                Per {selectedTournament ? (selectedTournament.number_of_holes === 9 ? '3-hole' : '6-hole') : 'segment'} match ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={foursomeGameMatchAmount}
                onChange={(e) => setFoursomeGameMatchAmount(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                placeholder="5.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-800 mb-1">CTP amount per par 3 ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={foursomeGameCtpAmount}
                onChange={(e) => setFoursomeGameCtpAmount(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                placeholder="1.00"
              />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {selectedTournament
              ? 'Side-game calculations and side CTP details appear once you select players.'
              : 'Select a tournament to determine whether this side game runs as 333 (9 holes) or 666 (18 holes).'}
          </p>
        </div>

        {/* Side Game Results */}
        {foursomeGameEnabled && foursomeGameSummary && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 border border-emerald-300">
            <div className="text-sm font-semibold text-emerald-900 mb-3">{foursomeGameSummary.modeLabel} Side Game – Live Results</div>
            <div className="space-y-2 mb-3">
              {foursomeGameSummary.segments.map(seg => (
                <div key={seg.seg} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-1">
                    <span>Segment {seg.seg} (holes {seg.holes})</span>
                    <span className="text-emerald-700">Pot: ${seg.pot.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {seg.pair0.map(p => p?.name).join(' & ')}: <b>{seg.pair0score > 0 ? '+' : ''}{seg.pair0score}</b>
                      <span className="ml-2 text-xs text-gray-500 font-normal">(actual {seg.pair0actual}, goal {seg.pair0goal})</span>
                    </span>
                    <span className={seg.result.winner === 0 ? 'text-emerald-700 font-bold' : seg.result.winner === 1 ? 'text-red-500 font-bold' : 'text-gray-500 font-semibold'}>
                      {seg.result.winner === 0 ? '✓ WIN' : seg.result.winner === 1 ? 'loss' : 'PUSH'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {seg.pair1.map(p => p?.name).join(' & ')}: <b>{seg.pair1score > 0 ? '+' : ''}{seg.pair1score}</b>
                      <span className="ml-2 text-xs text-gray-500 font-normal">(actual {seg.pair1actual}, goal {seg.pair1goal})</span>
                    </span>
                    <span className={seg.result.winner === 1 ? 'text-emerald-700 font-bold' : seg.result.winner === 0 ? 'text-red-500 font-bold' : 'text-gray-500 font-semibold'}>
                      {seg.result.winner === 1 ? '✓ WIN' : seg.result.winner === 0 ? 'loss' : 'PUSH'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="text-xs font-semibold text-gray-600 mb-1">Running totals</div>
              <div className="grid grid-cols-2 gap-1">
                {foursomeGameSummary.players.map(p => p && (
                  <div key={p.id} className="flex justify-between text-sm font-semibold">
                    <span>{p.name}</span>
                    <span className={`text-sm font-semibold ${
                      (foursomeGameSummary.playerTotals[p.id] || 0) > 0 ? 'text-emerald-700' :
                      (foursomeGameSummary.playerTotals[p.id] || 0) < 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {(foursomeGameSummary.playerTotals[p.id] || 0) > 0
                        ? `wins $${(foursomeGameSummary.playerTotals[p.id]).toFixed(2)}`
                        : (foursomeGameSummary.playerTotals[p.id] || 0) < 0
                          ? `owes $${Math.abs(foursomeGameSummary.playerTotals[p.id]).toFixed(2)}`
                          : 'even'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {foursomeGameSummary.ctpRows.length > 0 && foursomeGameSummary.ctpAmt > 0 && (
              <div className="mt-3 border-t pt-2">
                <div className="text-xs font-semibold text-gray-600 mb-1">Side CTP (par 3s)</div>
                {foursomeGameSummary.ctpRows.map(r => (
                  <div key={r.hole} className="flex justify-between text-xs text-gray-700">
                    <span>Hole {r.hole}: {r.winner}</span>
                    <span>${r.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
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
                    <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>{player?.name}</span>
                      {isScoreLocked(currentHole, playerId) && (
                        <span className="text-xs font-normal text-gray-500" title="A later hole has been saved, so this score can only be changed by an admin">🔒 Locked</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`score-${currentHole}-${playerId}`} className="block text-xs text-gray-600 mb-1">Score</label>
                        <input
                          id={`score-${currentHole}-${playerId}`}
                          aria-label={`Score, ${player?.name || 'player'}`}
                          disabled={isScoreLocked(currentHole, playerId)}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="1"
                          max="9"
                          className={`w-full p-3 border-2 rounded-lg text-xl text-center font-bold focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
                        <label htmlFor={`quota-${currentHole}-${playerId}`} className="block text-xs text-gray-600 mb-1">Quota</label>
                        <input
                          id={`quota-${currentHole}-${playerId}`}
                          aria-label={`Quota points, ${player?.name || 'player'}`}
                          disabled={isScoreLocked(currentHole, playerId)}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          max="9"
                          className="w-full p-3 border-2 border-gray-200 rounded-lg text-xl text-center font-bold focus:border-fairway-500 focus:outline-none bg-white disabled:opacity-60 disabled:cursor-not-allowed"
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
                      <div className="mt-2 space-y-2">
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
                        {foursomeGameEnabled && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenCtpModal(playerId, 'foursome')}
                              className={`w-full min-h-[44px] py-2 px-3 rounded-lg font-semibold text-sm transition ${
                                foursomeGameCtpData[currentHole]?.playerId === playerId
                                  ? 'bg-amber-100 text-amber-900 border-2 border-amber-500'
                                  : 'bg-amber-50 text-amber-800 border-2 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {foursomeGameCtpData[currentHole]?.playerId === playerId ? '✓ Side CTP Recorded' : `📍 Set ${selectedTournament?.number_of_holes === 9 ? '333' : '666'} CTP`}
                            </button>
                            {foursomeGameCtpData[currentHole]?.playerId === playerId && (
                              <div className="text-xs text-gray-600 mt-1 text-center">
                                {foursomeGameCtpData[currentHole].feet}' {foursomeGameCtpData[currentHole].inches}"
                              </div>
                            )}
                          </>
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
                    goToHole(playableHoles[currentIndex - 1].hole_number)
                  }
                }}
                disabled={getCurrentHoleIndex() <= 0 || saving}
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
            <div className="mt-2 min-h-[1.25rem] text-center text-xs" aria-live="polite">
              {saveStatus === 'saving' && <span className="text-gray-500">Saving hole {currentHole}…</span>}
              {saveStatus === 'saved' && !dirtyHoles.has(currentHole) && <span className="text-green-700">✓ Saved</span>}
              {saveStatus === 'error' && <span role="alert" className="text-red-600">{saveError}</span>}
              {saveStatus === 'idle' && dirtyHoles.has(currentHole) && (
                <span className="text-amber-700">Not saved yet — saves when every player has a score, or when you change holes</span>
              )}
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
                  onClick={() => goToHole(hole.hole_number)}
                  className={`p-2 min-h-[44px] min-w-[44px] rounded text-sm font-semibold ${
                    currentHole === hole.hole_number
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  } ${dirtyHoles.has(hole.hole_number) ? 'ring-2 ring-amber-400' : ''}`}
                  aria-label={`Hole ${hole.hole_number}${dirtyHoles.has(hole.hole_number) ? ', not saved' : ''}`}
                  aria-current={currentHole === hole.hole_number ? 'step' : undefined}
                >
                  {hole.hole_number}
                </button>
              ))}
            </div>
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
                    {posting ? 'Posting...' : postedInfo?.require_attest ? '✓ Submit for marker to sign' : '✓ Post Scores'}
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

        <ConfirmModal
          isOpen={pendingRemoval != null}
          title="Drop player from this foursome?"
          message={`${players.find(p => p.id === pendingRemoval)?.name || 'This player'} already has scores saved in this foursome. Dropping them takes them off this card; the scores they already entered stay on record.`}
          confirmLabel="Drop player"
          danger
          onConfirm={() => handleRemovePlayer(pendingRemoval)}
          onCancel={() => setPendingRemoval(null)}
        />

        {/* CTP Modal */}
        {showCtpModal && ctpPlayerId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">{ctpMode === 'foursome' ? `${selectedTournament?.number_of_holes === 9 ? '333' : '666'} Side CTP` : 'Closest to Pin'} - {activeCtpPlayerName}</h3>
              
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
                      value={activeCtpRecord?.feet || ''}
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
                      value={activeCtpRecord?.inches || ''}
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
                {activeCtpRecord?.imagePreview && (
                  <div className="mt-2">
                    <img 
                      src={activeCtpRecord.imagePreview} 
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
