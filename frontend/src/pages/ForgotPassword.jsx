import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api'

export const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await authAPI.forgotPassword(email)
      setSuccess(response.data?.message || 'If an account exists for that email, a reset link has been sent.')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Forgot Password</h1>

        <p className="text-gray-600 mb-4 text-sm">
          Enter your email and we’ll send you a password reset link.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          <Link to="/login" className="text-blue-500 hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  )
}
