import { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { playersAPI } from '../api'

export const EditPlayerModal = ({ player, onClose, onSave }) => {
  const { user } = useContext(AuthContext)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    sex: '',
    quota: '',
    fedex_points: '',
    tournaments_played: '',
    prize_money: '',
    active: 1,
    role: 'player'
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Determine if current user is admin and if they can edit this player
  const isAdmin = user?.role === 'admin'
  const canEdit = isAdmin || (user?.id === player?.id)

  // Debug logging
  useEffect(() => {
    console.log('EditPlayerModal - Current user:', user)
    console.log('EditPlayerModal - Player to edit:', player)
    console.log('EditPlayerModal - isAdmin:', isAdmin)
    console.log('EditPlayerModal - canEdit:', canEdit)
  }, [user, player, isAdmin, canEdit])

  useEffect(() => {
    if (player) {
      setFormData({
        name: player.name || '',
        email: player.email || '',
        phone: player.phone || '',
        sex: player.sex || '',
        quota: player.quota || '',
        fedex_points: player.fedex_points || '',
        tournaments_played: player.tournaments_played || '',
        prize_money: player.prize_money || '',
        active: player.active !== undefined ? player.active : 1,
        role: player.role || 'player'
      })
    }
  }, [player])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      // Prepare data based on user role
      let dataToUpdate = {}
      
      if (isAdmin) {
        // Admin can update all fields - convert empty strings to null for numeric fields
        dataToUpdate = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          sex: formData.sex || null,
          quota: formData.quota ? Number(formData.quota) : null,
          fedex_points: formData.fedex_points ? Number(formData.fedex_points) : null,
          tournaments_played: formData.tournaments_played ? Number(formData.tournaments_played) : null,
          prize_money: formData.prize_money ? Number(formData.prize_money) : null,
          active: formData.active,
          role: formData.role
        }
      } else {
        // Regular player can only update their own name, email, phone, sex
        dataToUpdate = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          sex: formData.sex || null
        }
      }

      console.log('Updating player:', player.id, 'with data:', dataToUpdate)
      const response = await playersAPI.update(player.id, dataToUpdate)
      console.log('Update response:', response.data)
      
      setSuccess(true)
      setTimeout(() => {
        onSave(response.data)
        onClose()
      }, 1000)
    } catch (err) {
      console.error('Update error:', err)
      setError(err.response?.data?.error || err.message || 'Failed to update player')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Access Denied</h3>
          <p className="text-gray-600 mb-4">You don't have permission to edit this player.</p>
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
            <p><strong>Your user ID:</strong> {user?.id || 'undefined'}</p>
            <p><strong>Your role:</strong> {user?.role || 'undefined'}</p>
            <p><strong>Player ID:</strong> {player?.id || 'undefined'}</p>
            <p className="mt-2 text-xs text-gray-500">If you just logged in, try logging out and back in to refresh your session.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-4 text-gray-800">
          {isAdmin ? 'Edit Player' : 'Edit My Profile'}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            Player updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Name - Always visible */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Email - Always visible */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Phone - Always visible */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sex - Always visible */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Sex
              </label>
              <select
                name="sex"
                value={formData.sex}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            {/* Admin-only fields */}
            {isAdmin && (
              <>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Quota
                  </label>
                  <input
                    type="number"
                    name="quota"
                    value={formData.quota}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    FedEx Points
                  </label>
                  <input
                    type="number"
                    name="fedex_points"
                    value={formData.fedex_points}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Tournaments Played
                  </label>
                  <input
                    type="number"
                    name="tournaments_played"
                    value={formData.tournaments_played}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Prize Money
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="prize_money"
                    value={formData.prize_money}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="player">Player</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="active"
                      checked={formData.active === 1}
                      onChange={handleChange}
                      className="mr-2 w-4 h-4"
                    />
                    <span className="text-gray-700 font-semibold">Active</span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
