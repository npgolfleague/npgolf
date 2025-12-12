import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { coursesAPI } from '../api'

export const EditCourse = () => {
  const { id } = useParams()
  const [course, setCourse] = useState(null)
  const [holes, setHoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchCourse()
  }, [id])

  const fetchCourse = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await coursesAPI.get(id)
      setCourse(response.data.course)
      setHoles(response.data.holes.length > 0 ? response.data.holes : createEmptyHoles())
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch course')
    } finally {
      setLoading(false)
    }
  }

  const createEmptyHoles = () => {
    return Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      mens_distance: '',
      mens_par: '',
      mens_handicap: '',
      ladies_distance: '',
      ladies_par: '',
      ladies_handicap: ''
    }))
  }

  const handleHoleChange = (index, field, value) => {
    const updated = [...holes]
    updated[index] = { ...updated[index], [field]: value }
    setHoles(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      // Validate holes data
      const holesData = holes.map(hole => ({
        hole_number: hole.hole_number,
        mens_distance: parseInt(hole.mens_distance) || 0,
        mens_par: parseInt(hole.mens_par) || 0,
        mens_handicap: parseInt(hole.mens_handicap) || 0,
        ladies_distance: parseInt(hole.ladies_distance) || 0,
        ladies_par: parseInt(hole.ladies_par) || 0,
        ladies_handicap: parseInt(hole.ladies_handicap) || 0
      }))

      await coursesAPI.addHoles(id, holesData)
      setSuccess('Course holes updated successfully!')
      setTimeout(() => navigate('/courses'), 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update holes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading course...</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Course not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => navigate('/courses')}
            className="text-blue-500 hover:underline mb-2"
          >
            ← Back to Courses
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            Edit Course: {course.name}
          </h1>
          <p className="text-gray-600 mt-2">
            {course.address && `${course.address} • `}
            {course.phone && course.phone}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700">Hole</th>
                  <th className="px-3 py-2 text-center text-gray-700">Men's Dist</th>
                  <th className="px-3 py-2 text-center text-gray-700">Men's Par</th>
                  <th className="px-3 py-2 text-center text-gray-700">Men's HCP</th>
                  <th className="px-3 py-2 text-center text-gray-700">Ladies Dist</th>
                  <th className="px-3 py-2 text-center text-gray-700">Ladies Par</th>
                  <th className="px-3 py-2 text-center text-gray-700">Ladies HCP</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((hole, index) => (
                  <tr key={hole.hole_number} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      {hole.hole_number}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={hole.mens_distance}
                        onChange={(e) => handleHoleChange(index, 'mens_distance', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={hole.mens_par}
                        onChange={(e) => handleHoleChange(index, 'mens_par', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={hole.mens_handicap}
                        onChange={(e) => handleHoleChange(index, 'mens_handicap', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={hole.ladies_distance}
                        onChange={(e) => handleHoleChange(index, 'ladies_distance', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={hole.ladies_par}
                        onChange={(e) => handleHoleChange(index, 'ladies_par', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={hole.ladies_handicap}
                        onChange={(e) => handleHoleChange(index, 'ladies_handicap', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Holes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
