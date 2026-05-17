import { useState, useEffect, useContext } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { coursesAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { isAdminCapable } from '../utils/roles'

export const EditCourse = () => {
  const { id } = useParams()
  const { user } = useContext(AuthContext)
  const isAdmin = isAdminCapable(user)
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [tees, setTees] = useState([])
  const [selectedTeeId, setSelectedTeeId] = useState(null)
  const [editedHoles, setEditedHoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Course details editing
  const [editingCourse, setEditingCourse] = useState(false)
  const [editedCourse, setEditedCourse] = useState({ name: '', address: '', phone: '' })
  const [savingCourse, setSavingCourse] = useState(false)

  // Tee editor state
  const [showAddTee, setShowAddTee] = useState(false)
  const [newTee, setNewTee] = useState({ tee_name: '', tee_color: '#FFFFFF', gender: 'M', course_rating: '', slope_rating: '' })
  const [addTeeError, setAddTeeError] = useState('')
  const [editingTeeId, setEditingTeeId] = useState(null)
  const [editingTeeData, setEditingTeeData] = useState({})
  const [editTeeError, setEditTeeError] = useState('')

  useEffect(() => { fetchCourse() }, [id])

  useEffect(() => {
    if (!selectedTeeId) { setEditedHoles([]); return }
    const tee = tees.find(t => t.id === selectedTeeId)
    if (!tee) return
    const holes = tee.holes.length > 0
      ? tee.holes.map(h => ({ hole_number: h.hole_number, distance: h.distance ?? '', par: h.par ?? '', handicap: h.handicap ?? '' }))
      : Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, distance: '', par: '', handicap: '' }))
    setEditedHoles(holes)
  }, [selectedTeeId, tees])

  const fetchCourse = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await coursesAPI.get(id)
      setCourse(res.data.course)
      setTees(res.data.tees || [])
      if (res.data.tees?.length > 0) setSelectedTeeId(prev => prev ?? res.data.tees[0].id)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch course')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCourse = async () => {
    setSavingCourse(true)
    setError('')
    try {
      await coursesAPI.update(id, editedCourse.name, editedCourse.address, editedCourse.phone)
      setEditingCourse(false)
      await fetchCourse()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save course details')
    } finally {
      setSavingCourse(false)
    }
  }

  const startEditTee = (tee) => {
    setEditingTeeId(tee.id)
    setEditingTeeData({ tee_name: tee.tee_name, tee_color: tee.tee_color || '#FFFFFF', gender: tee.gender, course_rating: tee.course_rating ?? '', slope_rating: tee.slope_rating ?? '' })
    setEditTeeError('')
  }

  const handleSaveTee = async () => {
    setEditTeeError('')
    if (!editingTeeData.tee_name) { setEditTeeError('Tee name is required'); return }
    try {
      await coursesAPI.updateTee(id, editingTeeId, {
        tee_name: editingTeeData.tee_name,
        tee_color: editingTeeData.tee_color,
        gender: editingTeeData.gender,
        course_rating: editingTeeData.course_rating || null,
        slope_rating: editingTeeData.slope_rating || null
      })
      setEditingTeeId(null)
      await fetchCourse()
    } catch (err) {
      setEditTeeError(err.response?.data?.error || 'Failed to save tee')
    }
  }

  const handleHoleChange = (index, field, value) => {
    setEditedHoles(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSaveHoles = async () => {
    if (!selectedTeeId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const holesData = editedHoles.map(h => ({
        hole_number: h.hole_number,
        distance: h.distance !== '' ? Number(h.distance) : null,
        par: h.par !== '' ? Number(h.par) : null,
        handicap: h.handicap !== '' ? Number(h.handicap) : null
      }))
      await coursesAPI.setTeeHoles(id, selectedTeeId, holesData)
      setSuccess('Holes saved!')
      await fetchCourse()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save holes')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTee = async () => {
    setAddTeeError('')
    if (!newTee.tee_name) { setAddTeeError('Tee name is required'); return }
    try {
      await coursesAPI.addTee(id, {
        tee_name: newTee.tee_name,
        tee_color: newTee.tee_color,
        gender: newTee.gender,
        course_rating: newTee.course_rating || null,
        slope_rating: newTee.slope_rating || null
      })
      setShowAddTee(false)
      setNewTee({ tee_name: '', tee_color: '#FFFFFF', gender: 'M', course_rating: '', slope_rating: '' })
      await fetchCourse()
    } catch (err) {
      setAddTeeError(err.response?.data?.error || 'Failed to add tee')
    }
  }

  const handleDeleteTee = async (teeId) => {
    if (!confirm('Delete this tee and all its hole data?')) return
    try {
      await coursesAPI.deleteTee(id, teeId)
      if (selectedTeeId === teeId) setSelectedTeeId(null)
      await fetchCourse()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete tee')
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="text-xl text-gray-600">Loading course...</div></div>
  if (!course) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="text-xl text-red-600">Course not found</div></div>

  const selectedTee = tees.find(t => t.id === selectedTeeId)

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <button onClick={() => navigate('/courses')} className="text-blue-500 hover:underline mb-4 block">
          ← Back to Courses
        </button>

        {/* Course details */}
        {editingCourse ? (
          <div className="bg-white rounded-lg shadow p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-700 mb-3">Edit Course Details</h2>
            <div className="flex flex-wrap gap-3 mb-3">
              <div className="flex-1 min-w-48">
                <label className="block text-xs text-gray-600 mb-1">Course Name *</label>
                <input value={editedCourse.name} onChange={e => setEditedCourse(p => ({ ...p, name: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs text-gray-600 mb-1">Address</label>
                <input value={editedCourse.address} onChange={e => setEditedCourse(p => ({ ...p, address: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="w-40">
                <label className="block text-xs text-gray-600 mb-1">Phone</label>
                <input value={editedCourse.phone} onChange={e => setEditedCourse(p => ({ ...p, phone: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveCourse} disabled={savingCourse} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400">{savingCourse ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditingCourse(false)} className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-start gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1">{course.name}</h1>
              <p className="text-gray-500 text-sm">{course.address && `${course.address}  `}{course.phone && course.phone}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setEditedCourse({ name: course.name, address: course.address || '', phone: course.phone || '' }); setEditingCourse(true) }}
                className="mt-1 text-xs text-blue-500 hover:underline whitespace-nowrap"
              >Edit details</button>
            )}
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{success}</div>}

        {/* Tees */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tees</h2>
            {isAdmin && (
              <button
                onClick={() => setShowAddTee(v => !v)}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-sm"
              >
                + Add Tee
              </button>
            )}
          </div>

          {showAddTee && (
            <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex flex-wrap gap-3 items-end mb-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tee Name *</label>
                  <input value={newTee.tee_name} onChange={e => setNewTee(p => ({ ...p, tee_name: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-28" placeholder="White" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Color</label>
                  <input type="color" value={newTee.tee_color} onChange={e => setNewTee(p => ({ ...p, tee_color: e.target.value }))} className="border rounded h-8 w-14 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Gender</label>
                  <select value={newTee.gender} onChange={e => setNewTee(p => ({ ...p, gender: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm">
                    <option value="M">Men</option>
                    <option value="F">Ladies</option>
                    <option value="A">All</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Course Rating</label>
                  <input type="number" step="0.1" value={newTee.course_rating} onChange={e => setNewTee(p => ({ ...p, course_rating: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-24" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Slope Rating</label>
                  <input type="number" value={newTee.slope_rating} onChange={e => setNewTee(p => ({ ...p, slope_rating: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-24" />
                </div>
              </div>
              {addTeeError && <div className="text-red-600 text-sm mb-2">{addTeeError}</div>}
              <div className="flex gap-2">
                <button onClick={handleAddTee} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Save Tee</button>
                <button onClick={() => setShowAddTee(false)} className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-100">Cancel</button>
              </div>
            </div>
          )}

          {tees.length === 0 ? (
            <p className="text-gray-500 text-sm">No tees yet. Add a tee above.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tees.map(tee => (
                <div key={tee.id} className="flex flex-col gap-1">
                  <button
                    onClick={() => setSelectedTeeId(tee.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition ${selectedTeeId === tee.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span className="inline-block w-3 h-3 rounded-full border border-gray-400 flex-shrink-0" style={{ backgroundColor: tee.tee_color || '#ccc' }} />
                    {tee.tee_name}
                    <span className="text-xs text-gray-500">({tee.gender === 'F' ? 'Ladies' : tee.gender === 'M' ? 'Men' : 'All'})</span>
                    {isAdmin && (<>
                      <span onClick={e => { e.stopPropagation(); startEditTee(tee) }} className="ml-1 text-blue-400 hover:text-blue-600 cursor-pointer text-xs" title="Edit tee">✎</span>
                      <span onClick={e => { e.stopPropagation(); handleDeleteTee(tee.id) }} className="text-red-400 hover:text-red-600 cursor-pointer text-xs" title="Delete tee">✕</span>
                    </>)}
                  </button>
                  {/* Inline tee edit form */}
                  {editingTeeId === tee.id && (
                    <div className="p-3 border border-blue-200 rounded-lg bg-blue-50 text-sm">
                      <div className="flex flex-wrap gap-2 items-end mb-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Name *</label>
                          <input value={editingTeeData.tee_name} onChange={e => setEditingTeeData(p => ({ ...p, tee_name: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-28" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Color</label>
                          <input type="color" value={editingTeeData.tee_color} onChange={e => setEditingTeeData(p => ({ ...p, tee_color: e.target.value }))} className="border rounded h-8 w-14 cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Gender</label>
                          <select value={editingTeeData.gender} onChange={e => setEditingTeeData(p => ({ ...p, gender: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm">
                            <option value="M">Men</option>
                            <option value="F">Ladies</option>
                            <option value="A">All</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Rating</label>
                          <input type="number" step="0.1" value={editingTeeData.course_rating} onChange={e => setEditingTeeData(p => ({ ...p, course_rating: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-20" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Slope</label>
                          <input type="number" value={editingTeeData.slope_rating} onChange={e => setEditingTeeData(p => ({ ...p, slope_rating: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-20" />
                        </div>
                      </div>
                      {editTeeError && <div className="text-red-600 text-xs mb-1">{editTeeError}</div>}
                      <div className="flex gap-2">
                        <button onClick={handleSaveTee} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Save</button>
                        <button onClick={() => setEditingTeeId(null)} className="border border-gray-300 px-3 py-1 rounded text-xs hover:bg-gray-100">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hole editor for selected tee */}
        {selectedTee && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-4 h-4 rounded-full border border-gray-400" style={{ backgroundColor: selectedTee.tee_color || '#ccc' }} />
              <h2 className="text-lg font-semibold">{selectedTee.tee_name} Tee — Holes</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {selectedTee.course_rating && `Rating: ${selectedTee.course_rating}`}
              {selectedTee.slope_rating && ` / Slope: ${selectedTee.slope_rating}`}
            </p>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse min-w-max">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left text-gray-700">Hole</th>
                    <th className="px-3 py-2 text-center text-gray-700">Yardage</th>
                    <th className="px-3 py-2 text-center text-gray-700">Par</th>
                    <th className="px-3 py-2 text-center text-gray-700">Handicap</th>
                  </tr>
                </thead>
                <tbody>
                  {editedHoles.map((hole, index) => (
                    <tr key={hole.hole_number} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{hole.hole_number}</td>
                      <td className="px-3 py-2">
                        <input type="number" value={hole.distance} onChange={e => handleHoleChange(index, 'distance', e.target.value)} className="w-20 px-2 py-1 border border-gray-300 rounded text-center" placeholder="—" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={hole.par} onChange={e => handleHoleChange(index, 'par', e.target.value)} className="w-16 px-2 py-1 border border-gray-300 rounded text-center" placeholder="—" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={hole.handicap} onChange={e => handleHoleChange(index, 'handicap', e.target.value)} className="w-16 px-2 py-1 border border-gray-300 rounded text-center" placeholder="—" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => navigate('/courses')} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              {isAdmin && (
                <button onClick={handleSaveHoles} disabled={saving} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:bg-gray-400">
                  {saving ? 'Saving...' : 'Save Holes'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

