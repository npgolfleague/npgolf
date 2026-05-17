import { useState, useEffect, useRef, useContext } from 'react'
import { coursesAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { isAdminCapable } from '../utils/roles'

const TEE_COLOR_DEFAULTS = {
  Black: '#000000',
  Blue: '#1D4ED8',
  White: '#FFFFFF',
  Gold: '#CA8A04',
  Red: '#DC2626',
}

export const ScorecardUpload = () => {
  const { user } = useContext(AuthContext)
  const isAdmin = isAdminCapable(user)

  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [editedTees, setEditedTees] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const fileInputRef = useRef()

  useEffect(() => {
    coursesAPI.list().then(r => setCourses(r.data)).catch(() => {})
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setParsedData(null)
    setEditedTees([])
    setParseError('')
    setSaveSuccess('')
    setSaveError('')
  }

  const handleParse = async () => {
    if (!imageFile) return
    const formData = new FormData()
    formData.append('image', imageFile)
    setParsing(true)
    setParseError('')
    setSaveSuccess('')
    try {
      const res = await coursesAPI.parseScorecard(formData)
      const tees = res.data.tees || []
      // Inject default tee colors if missing
      const teesWithColors = tees.map(t => ({
        ...t,
        tee_color: t.tee_color || TEE_COLOR_DEFAULTS[t.tee_name] || '#FFFFFF'
      }))
      setParsedData(res.data)
      setEditedTees(JSON.parse(JSON.stringify(teesWithColors)))
    } catch (err) {
      setParseError(err.response?.data?.error || 'Failed to parse scorecard')
    } finally {
      setParsing(false)
    }
  }

  const handleTeeChange = (teeIdx, field, value) => {
    setEditedTees(prev => {
      const tees = [...prev]
      tees[teeIdx] = { ...tees[teeIdx], [field]: value }
      return tees
    })
  }

  const handleHoleChange = (teeIdx, holeIdx, field, value) => {
    setEditedTees(prev => {
      const tees = [...prev]
      const holes = [...(tees[teeIdx].holes || [])]
      holes[holeIdx] = { ...holes[holeIdx], [field]: value === '' ? null : Number(value) }
      tees[teeIdx] = { ...tees[teeIdx], holes }
      return tees
    })
  }

  const handleSave = async () => {
    if (!selectedCourseId) { setSaveError('Please select a course first'); return }
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')
    try {
      // Load existing tees so we can upsert (update if name exists, add if not)
      const existingRes = await coursesAPI.getTees(selectedCourseId)
      const existingTees = existingRes.data || []

      for (const tee of editedTees) {
        const existing = existingTees.find(
          t => t.tee_name.toLowerCase() === tee.tee_name.toLowerCase()
        )

        let teeId
        if (existing) {
          // Update metadata on the existing tee
          await coursesAPI.updateTee(selectedCourseId, existing.id, {
            tee_name: tee.tee_name,
            tee_color: tee.tee_color || '#FFFFFF',
            gender: tee.gender || 'M',
            course_rating: tee.course_rating || null,
            slope_rating: tee.slope_rating || null
          })
          teeId = existing.id
        } else {
          const teeRes = await coursesAPI.addTee(selectedCourseId, {
            tee_name: tee.tee_name,
            tee_color: tee.tee_color || '#FFFFFF',
            gender: tee.gender || 'M',
            course_rating: tee.course_rating || null,
            slope_rating: tee.slope_rating || null
          })
          teeId = teeRes.data.id
        }

        if (tee.holes && tee.holes.length > 0) {
          await coursesAPI.setTeeHoles(selectedCourseId, teeId, tee.holes)
        }
      }
      setSaveSuccess(`Saved ${editedTees.length} tee(s) to the course successfully!`)
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save tees')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return <div className="p-6 text-red-600 font-semibold">Admin access required.</div>
  }

  return (
    <div className="w-full p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Parse Scorecard</h1>
      <p className="text-gray-600 mb-6">
        Upload a scorecard photo to extract tee and hole data automatically using AI, then review and save it to a course.
      </p>

      {/* Step 1: Upload */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Step 1: Upload Scorecard Image</h2>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="block mb-4 text-sm"
        />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Scorecard preview"
            className="max-w-full max-h-72 object-contain border rounded mb-4"
          />
        )}
        <button
          onClick={handleParse}
          disabled={!imageFile || parsing}
          className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
        >
          {parsing ? 'Parsing with AI...' : '🔍 Parse Scorecard'}
        </button>
        {parseError && (
          <div className="mt-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{parseError}</div>
        )}
      </div>

      {/* Step 2: Review */}
      {editedTees.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Step 2: Review &amp; Edit Parsed Data</h2>
          {parsedData?.course_name && (
            <p className="text-gray-600 mb-4 text-sm">
              Detected course: <strong>{parsedData.course_name}</strong>
            </p>
          )}

          {editedTees.map((tee, teeIdx) => (
            <div key={teeIdx} className="mb-8 border border-gray-200 rounded-lg p-4">
              <div className="flex flex-wrap gap-4 mb-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tee Name</label>
                  <input
                    value={tee.tee_name || ''}
                    onChange={e => handleTeeChange(teeIdx, 'tee_name', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                  <input
                    type="color"
                    value={tee.tee_color || '#FFFFFF'}
                    onChange={e => handleTeeChange(teeIdx, 'tee_color', e.target.value)}
                    className="border rounded h-8 w-14 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select
                    value={tee.gender || 'M'}
                    onChange={e => handleTeeChange(teeIdx, 'gender', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="M">Men</option>
                    <option value="F">Ladies</option>
                    <option value="A">All</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tee.course_rating ?? ''}
                    onChange={e => handleTeeChange(teeIdx, 'course_rating', e.target.value === '' ? null : Number(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Slope Rating</label>
                  <input
                    type="number"
                    value={tee.slope_rating ?? ''}
                    onChange={e => handleTeeChange(teeIdx, 'slope_rating', e.target.value === '' ? null : Number(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                  />
                </div>
              </div>

              {tee.holes && tee.holes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse min-w-max">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Hole</th>
                        {tee.holes.map(h => (
                          <th key={h.hole_number} className="border border-gray-300 px-2 py-1 text-center font-semibold">{h.hole_number}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {['distance', 'par', 'handicap'].map(field => (
                        <tr key={field} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1 font-medium capitalize">
                            {field === 'distance' ? 'Yardage' : field.charAt(0).toUpperCase() + field.slice(1)}
                          </td>
                          {tee.holes.map((h, holeIdx) => (
                            <td key={h.hole_number} className="border border-gray-300 px-1 py-0.5">
                              <input
                                type="number"
                                value={h[field] ?? ''}
                                onChange={e => handleHoleChange(teeIdx, holeIdx, field, e.target.value)}
                                className="w-16 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 rounded text-xs"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step 3: Save */}
      {editedTees.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Step 3: Save to Course</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Course</label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-full max-w-xs"
            >
              <option value="">-- Select a course --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {saveError && (
            <div className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded p-3">{saveError}</div>
          )}
          {saveSuccess && (
            <div className="text-green-700 font-semibold mb-4 bg-green-50 border border-green-200 rounded p-3">✓ {saveSuccess}</div>
          )}
          <button
            onClick={handleSave}
            disabled={!selectedCourseId || saving}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 font-semibold"
          >
            {saving ? 'Saving...' : '💾 Save Tee Data to Course'}
          </button>
        </div>
      )}
    </div>
  )
}
