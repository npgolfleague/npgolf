import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { coursesAPI } from '../api'

export const AddCourse = () => {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [holes, setHoles] = useState(
    Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      mens_distance: '',
      mens_par: '',
      mens_handicap: '',
      ladies_distance: '',
      ladies_par: '',
      ladies_handicap: ''
    }))
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleHoleChange = (index, field, value) => {
    const newHoles = [...holes]
    newHoles[index][field] = value
    setHoles(newHoles)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create course first
      const courseResponse = await coursesAPI.create(name, address, phone)
      const courseId = courseResponse.data.id

      // Convert holes data to numbers
      const formattedHoles = holes.map(hole => ({
        hole_number: parseInt(hole.hole_number),
        mens_distance: parseInt(hole.mens_distance) || 0,
        mens_par: parseInt(hole.mens_par) || 0,
        mens_handicap: parseInt(hole.mens_handicap) || 0,
        ladies_distance: parseInt(hole.ladies_distance) || 0,
        ladies_par: parseInt(hole.ladies_par) || 0,
        ladies_handicap: parseInt(hole.ladies_handicap) || 0
      }))

      // Add holes to the course
      await coursesAPI.addHoles(courseId, formattedHoles)

      navigate('/courses')
    } catch (err) {
      console.error('Error creating course:', err)
      setError(err.response?.data?.error || 'Failed to create course')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => navigate('/courses')}
            className="text-blue-500 hover:underline"
          >
            ← Back to Courses
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">Add New Course</h1>

          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Course Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Course Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Course Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Holes */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Holes (1-18)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-2 py-2 text-gray-700">Hole</th>
                      <th className="px-2 py-2 text-gray-700">Mens Dist</th>
                      <th className="px-2 py-2 text-gray-700">Mens Par</th>
                      <th className="px-2 py-2 text-gray-700">Mens HCP</th>
                      <th className="px-2 py-2 text-gray-700">Ladies Dist</th>
                      <th className="px-2 py-2 text-gray-700">Ladies Par</th>
                      <th className="px-2 py-2 text-gray-700">Ladies HCP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holes.map((hole, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-2 text-center font-semibold">{hole.hole_number}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={hole.mens_distance}
                            onChange={(e) => handleHoleChange(index, 'mens_distance', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={hole.mens_par}
                            onChange={(e) => handleHoleChange(index, 'mens_par', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={hole.mens_handicap}
                            onChange={(e) => handleHoleChange(index, 'mens_handicap', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={hole.ladies_distance}
                            onChange={(e) => handleHoleChange(index, 'ladies_distance', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={hole.ladies_par}
                            onChange={(e) => handleHoleChange(index, 'ladies_par', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={hole.ladies_handicap}
                            onChange={(e) => handleHoleChange(index, 'ladies_handicap', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Course'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition"
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
