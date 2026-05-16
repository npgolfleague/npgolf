import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { coursesAPI } from '../api'
import { AuthContext } from '../context/AuthContext'
import { isAdminCapable } from '../utils/roles'

export const Courses = () => {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const isAdmin = isAdminCapable(user)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await coursesAPI.list()
      setCourses(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch courses')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this course?')) return
    
    try {
      await coursesAPI.delete(id)
      fetchCourses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete course')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
          <p className="text-slate-500 text-sm mt-1">Registered golf courses</p>
        </div>
        <div className="flex justify-between items-center mb-6">
          {isAdmin && (
            <button
              onClick={() => navigate('/courses/add')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition"
            >
              + Add Course
            </button>
          )}
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-600">Loading courses...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th scope="col" aria-label="Course ID" className="px-6 py-3 text-left text-gray-700 font-semibold">ID</th>
                  <th scope="col" aria-label="Course Name" className="px-6 py-3 text-left text-gray-700 font-semibold">Name</th>
                  <th scope="col" aria-label="Street Address" className="px-6 py-3 text-left text-gray-700 font-semibold">Address</th>
                  <th scope="col" aria-label="Phone Number" className="px-6 py-3 text-left text-gray-700 font-semibold">Phone</th>
                  {isAdmin && <th scope="col" aria-label="Actions" className="px-6 py-3 text-left text-gray-700 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-600">
                      No courses found
                    </td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <tr key={course.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900">{course.id}</td>
                      <td className="px-6 py-4 text-gray-900">{course.name}</td>
                      <td className="px-6 py-4 text-gray-900">{course.address || '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{course.phone || '-'}</td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <button
                            onClick={() => navigate(`/courses/${course.id}`)}
                            className="text-blue-500 hover:underline mr-4"
                          >
                            View/Edit Holes
                          </button>
                          <button
                            onClick={() => handleDelete(course.id)}
                            className="text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
