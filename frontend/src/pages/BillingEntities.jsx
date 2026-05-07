import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import apiClient from '../api'
import { Building2, Plus, Edit2, Trash2, Users, Trophy, X, Shield } from 'lucide-react'

export const BillingEntities = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    entity_type: 'league_organization',
    description: '',
    logo_url: '',
    website: '',
    timezone: 'America/Los_Angeles',
    billing_email: '',
    billing_name: '',
    billing_address: '',
    active: 1
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // League management states
  const [showLeagueModal, setShowLeagueModal] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [leagueFormData, setLeagueFormData] = useState({
    name: '',
    slug: '',
    description: '',
    season_year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    active: 1
  })
  const [editingLeague, setEditingLeague] = useState(null)
  const [managingEntityId, setManagingEntityId] = useState(null)

  // Redirect non-admin users
  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/app/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchEntities()
    }
  }, [user])

  const fetchEntities = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/billing-entities')
      setEntities(response.data.entities || [])
      setError('')
    } catch (err) {
      console.error('Error fetching billing entities:', err)
      setError('Failed to load billing entities')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setModalMode('add')
    setFormData({
      name: '',
      slug: '',
      entity_type: 'league_organization',
      description: '',
      logo_url: '',
      website: '',
      timezone: 'America/Los_Angeles',
      billing_email: '',
      billing_name: '',
      billing_address: '',
      active: 1
    })
    setSelectedEntity(null)
    setShowModal(true)
  }

  const handleEdit = (entity) => {
    setModalMode('edit')
    setFormData({
      name: entity.name || '',
      slug: entity.slug || '',
      entity_type: entity.entity_type || 'league_organization',
      description: entity.description || '',
      logo_url: entity.logo_url || '',
      website: entity.website || '',
      timezone: entity.timezone || 'America/Los_Angeles',
      billing_email: entity.billing_email || '',
      billing_name: entity.billing_name || '',
      billing_address: entity.billing_address || '',
      active: entity.active ?? 1
    })
    setSelectedEntity(entity)
    setShowModal(true)
  }

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
    setSaving(true)

    try {
      if (modalMode === 'add') {
        await apiClient.post('/billing-entities', formData)
      } else {
        await apiClient.put(`/billing-entities/${selectedEntity.id}`, formData)
      }
      await fetchEntities()
      setShowModal(false)
    } catch (err) {
      console.error('Error saving billing entity:', err)
      setError(err.response?.data?.error || 'Failed to save billing entity')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/billing-entities/${id}`)
      await fetchEntities()
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Error deleting billing entity:', err)
      setError(err.response?.data?.error || 'Failed to delete billing entity')
    }
  }

  // League management functions
  const handleManageLeagues = async (entityId) => {
    setManagingEntityId(entityId)
    try {
      const response = await apiClient.get(`/billing-entities/${entityId}`)
      setLeagues(response.data.leagues || [])
      setShowLeagueModal(true)
    } catch (err) {
      console.error('Error fetching leagues:', err)
      setError('Failed to load leagues')
    }
  }

  const handleAddLeague = () => {
    setEditingLeague(null)
    setLeagueFormData({
      name: '',
      slug: '',
      description: '',
      season_year: new Date().getFullYear(),
      start_date: '',
      end_date: '',
      active: 1
    })
  }

  const handleEditLeague = (league) => {
    setEditingLeague(league)
    setLeagueFormData({
      name: league.name || '',
      slug: league.slug || '',
      description: league.description || '',
      season_year: league.season_year || new Date().getFullYear(),
      start_date: league.start_date || '',
      end_date: league.end_date || '',
      active: league.active ?? 1
    })
  }

  const handleLeagueChange = (e) => {
    const { name, value, type, checked } = e.target
    setLeagueFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }))
  }

  const handleSaveLeague = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingLeague) {
        await apiClient.put(`/leagues/${editingLeague.id}`, leagueFormData)
      } else {
        await apiClient.post('/leagues', {
          ...leagueFormData,
          billing_entity_id: managingEntityId
        })
      }
      const response = await apiClient.get(`/billing-entities/${managingEntityId}`)
      setLeagues(response.data.leagues || [])
      setEditingLeague(null)
      setLeagueFormData({
        name: '',
        slug: '',
        description: '',
        season_year: new Date().getFullYear(),
        start_date: '',
        end_date: '',
        active: 1
      })
      await fetchEntities()
    } catch (err) {
      console.error('Error saving league:', err)
      setError(err.response?.data?.error || 'Failed to save league')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLeague = async (leagueId) => {
    if (!confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
      return
    }

    try {
      await apiClient.delete(`/leagues/${leagueId}`)
      const response = await apiClient.get(`/billing-entities/${managingEntityId}`)
      setLeagues(response.data.leagues || [])
      await fetchEntities()
    } catch (err) {
      console.error('Error deleting league:', err)
      setError(err.response?.data?.error || 'Failed to delete league')
    }
  }

  if (user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading billing entities...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-8 h-8" />
            Billing Entities
          </h1>
          <p className="text-gray-600 mt-2">Manage organizations and billing entities</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-fairway-600 text-white px-4 py-2 rounded-lg hover:bg-fairway-700 transition"
        >
          <Plus className="w-5 h-5" />
          Add Entity
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Leagues
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entities.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  No billing entities found. Click "Add Entity" to create one.
                </td>
              </tr>
            ) : (
              entities.map((entity) => (
                <tr key={entity.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{entity.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {entity.slug}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {entity.entity_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Users className="w-4 h-4" />
                      {entity.member_count || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Trophy className="w-4 h-4" />
                      {entity.league_count || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        entity.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {entity.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleManageLeagues(entity.id)}
                      className="text-green-600 hover:text-green-900 mr-3"
                      title="Manage Leagues"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(entity)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(entity.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {modalMode === 'add' ? 'Add Billing Entity' : 'Edit Billing Entity'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    pattern="[a-z0-9-]+"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Entity Type
                  </label>
                  <select
                    name="entity_type"
                    value={formData.entity_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="golf_course">Golf Course</option>
                    <option value="league_organization">League Organization</option>
                    <option value="event_company">Event Company</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    name="logo_url"
                    value={formData.logo_url}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    name="timezone"
                    value={formData.timezone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    name="billing_email"
                    value={formData.billing_email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Billing Name
                  </label>
                  <input
                    type="text"
                    name="billing_name"
                    value={formData.billing_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Billing Address
                  </label>
                  <textarea
                    name="billing_address"
                    value={formData.billing_address}
                    onChange={handleChange}
                    rows="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="active"
                      checked={formData.active === 1}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-fairway-600 text-white rounded-lg hover:bg-fairway-700 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : modalMode === 'add' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this billing entity? This action cannot be undone.
              The entity must have no associated leagues or players.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* League Management Modal */}
      {showLeagueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Manage Leagues
              </h2>
              <button
                onClick={() => {
                  setShowLeagueModal(false)
                  setEditingLeague(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* League Form */}
              <form onSubmit={handleSaveLeague} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                  {editingLeague ? 'Edit League' : 'Add New League'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      League Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={leagueFormData.name}
                      onChange={handleLeagueChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      name="slug"
                      value={leagueFormData.slug}
                      onChange={handleLeagueChange}
                      pattern="[a-z0-9-]+"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Lowercase, numbers, hyphens only</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Season Year
                    </label>
                    <input
                      type="number"
                      name="season_year"
                      value={leagueFormData.season_year}
                      onChange={handleLeagueChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        name="active"
                        checked={leagueFormData.active === 1}
                        onChange={handleLeagueChange}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">Active</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={leagueFormData.start_date}
                      onChange={handleLeagueChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={leagueFormData.end_date}
                      onChange={handleLeagueChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={leagueFormData.description}
                      onChange={handleLeagueChange}
                      rows="2"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  {editingLeague && (
                    <button
                      type="button"
                      onClick={handleAddLeague}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-fairway-600 text-white rounded-lg hover:bg-fairway-700 disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : editingLeague ? 'Update League' : 'Add League'}
                  </button>
                </div>
              </form>

              {/* Leagues List */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Existing Leagues</h3>
                {leagues.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No leagues yet. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {leagues.map((league) => (
                      <div
                        key={league.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{league.name}</div>
                          <div className="text-sm text-gray-500">
                            Slug: {league.slug} | Season: {league.season_year || 'N/A'}
                            {league.alias && ` | Alias: ${league.alias}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              league.active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {league.active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleEditLeague(league)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLeague(league.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
