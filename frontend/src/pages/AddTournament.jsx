import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tournamentsAPI, coursesAPI } from '../api'

export const AddTournament = () => {
  const navigate = useNavigate()
  const [date, setDate] = useState('')
  const [courseId, setCourseId] = useState('')
  const [numberOfHoles, setNumberOfHoles] = useState(18)
  const [courses, setCourses] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCourses()
  }, [])

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

    if (!date || !courseId) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      await tournamentsAPI.create(date, courseId, numberOfHoles)
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
                  onChange={(e) => setNumberOfHoles(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value={9}>9 Holes</option>
                  <option value={18}>18 Holes</option>
                </select>
              </div>
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
