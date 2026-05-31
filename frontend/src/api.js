import axios from 'axios'

// Detect league alias from URL path (e.g., /paradise/app/dashboard)
// Extract the first path segment if it's not a common route
function detectLeaguePrefix() {
  const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
  const commonRoutes = ['api', 'login', 'register', 'forgot-password', 'reset-password', 
                        'sms-consent', 'dashboard', 'about', 'app', 'assets', 'billing-entities'];
  
  // If first segment is not a common route, it's likely a league alias
  if (pathParts.length > 0 && !commonRoutes.includes(pathParts[0])) {
    return '/' + pathParts[0];
  }
  return '';
}

// Use relative URL so it works whether accessed via localhost or IP address
const apiClient = axios.create({
  baseURL: '/api'
})

// Dedicated client for global endpoints (no league prefix)
const globalApiClient = axios.create({
  baseURL: '/api'
})

const refreshClient = axios.create({
  baseURL: '/api'
})

// Add league prefix and JWT token to requests
apiClient.interceptors.request.use((config) => {
  // Detect league prefix at request time
  const leaguePrefix = detectLeaguePrefix();
  if (leaguePrefix) {
    // Update baseURL to include league prefix
    config.baseURL = `${leaguePrefix}/api`;
  }
  
  // Add JWT token if available
  const token = localStorage.getItem('token')
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`)
    } else {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const leaguePrefix = detectLeaguePrefix()
      refreshClient.defaults.baseURL = leaguePrefix ? `${leaguePrefix}/api` : '/api'

      const response = await refreshClient.post('/auth/refresh', { refreshToken })
      const { token: newToken, refreshToken: newRefreshToken, user } = response.data || {}

      if (newToken) {
        localStorage.setItem('token', newToken)
        if (user) {
          localStorage.setItem('user', JSON.stringify(user))
        }
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken)
        }

        if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
          originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        } else {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient.request(originalRequest)
      }
    } catch (refreshError) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('refreshToken')
    }

    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  register: (name, email, password, phone, sex, smsAllowed, leagueId) => apiClient.post('/auth/register', { name, email, password, phone, sex, sms_allowed: smsAllowed, league_id: leagueId }),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => apiClient.post('/auth/reset-password', { token, password }),
  refresh: (refreshToken) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken })
}

export const playersAPI = {
  list: () => apiClient.get('/players'),
  get: (id) => apiClient.get(`/players/${id}`),
  create: (data) => apiClient.post('/players', data),
  update: (id, data) => apiClient.put(`/players/${id}`, data),
  getQuotaRow: (id) => apiClient.get(`/players/${id}/quota`),
  updateQuotaRow: (id, data) => apiClient.put(`/players/${id}/quota`, data),
  refreshQuotas: () => apiClient.post('/players/refresh-quotas'),
  delete: (id) => apiClient.delete(`/players/${id}`),
  sendSMS: (id, message) => apiClient.post(`/players/${id}/send-sms`, { message }),
  getQuotaHistory: (id) => apiClient.get(`/players/${id}/quota-history`)
}

// Backward compatibility alias
export const usersAPI = playersAPI

export const coursesAPI = {
  // Always use globalApiClient to avoid league prefix
  list: () => globalApiClient.get('/courses'),
  get: (id) => globalApiClient.get(`/courses/${id}`),
  create: (name, address, phone) => globalApiClient.post('/courses', { name, address, phone }),
  update: (id, name, address, phone) => globalApiClient.put(`/courses/${id}`, { name, address, phone }),
  delete: (id) => globalApiClient.delete(`/courses/${id}`),
  // Tee management (these may need to be global as well)
  getTees: (courseId) => globalApiClient.get(`/courses/${courseId}/tees`),
  addTee: (courseId, data) => globalApiClient.post(`/courses/${courseId}/tees`, data),
  updateTee: (courseId, teeId, data) => globalApiClient.put(`/courses/${courseId}/tees/${teeId}`, data),
  deleteTee: (courseId, teeId) => globalApiClient.delete(`/courses/${courseId}/tees/${teeId}`),
  setTeeHoles: (courseId, teeId, holes) => globalApiClient.put(`/courses/${courseId}/tees/${teeId}/holes`, { holes }),
  // Scorecard parsing
  parseScorecard: (formData) => globalApiClient.post('/courses/parse-scorecard', formData)
}

export const tournamentsAPI = {
  list: () => apiClient.get('/tournaments'),
  upcoming: () => apiClient.get('/tournaments/upcoming'),
  next: () => apiClient.get('/tournaments/next'),
  get: (id) => apiClient.get(`/tournaments/${id}`),
  create: (date, course_id, number_of_holes, nine_hole_side = 'front') => apiClient.post('/tournaments', { date, course_id, number_of_holes, nine_hole_side }),
  update: (id, date, course_id, number_of_holes, nine_hole_side = 'front') => apiClient.put(`/tournaments/${id}`, { date, course_id, number_of_holes, nine_hole_side }),
  delete: (id) => apiClient.delete(`/tournaments/${id}`),
  complete: (id) => apiClient.post(`/tournaments/${id}/complete`),
  getPlayers: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/players`),
  getFoursome: (tournamentId, foursome) => apiClient.get(`/tournaments/${tournamentId}/foursomes/${encodeURIComponent(foursome)}`),
  addPlayer: (tournamentId, playerId, teeId) => apiClient.post(`/tournaments/${tournamentId}/players`, { playerId, teeId }),
  removePlayer: (tournamentId, playerId) => apiClient.delete(`/tournaments/${tournamentId}/players/${playerId}`),
  updatePlayerTee: (tournamentId, playerId, teeId) => apiClient.put(`/tournaments/${tournamentId}/players/${playerId}/tee`, { teeId }),
  getAvailablePlayers: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/available-players`),
  updatePaidStatus: (tournamentId, playerId, paid) => apiClient.put(`/tournaments/${tournamentId}/players/${playerId}/paid`, { paid }),
  updateSkinsCtpPaidStatus: (tournamentId, playerId, skins_ctp_paid) => apiClient.put(`/tournaments/${tournamentId}/players/${playerId}/skins-ctp-paid`, { skins_ctp_paid }),
  updateCollected: (tournamentId, quota_collected, skins_collected) => apiClient.put(`/tournaments/${tournamentId}/collected`, { quota_collected, skins_collected }),
  sendInviteSMS: (tournamentId) => apiClient.post(`/tournaments/${tournamentId}/invite-sms`),
  sendSMS: (tournamentId) => apiClient.post(`/tournaments/${tournamentId}/send-sms`),
  sendInvitations: (tournamentId, method, playerId, customMessage) => apiClient.post(`/tournaments/${tournamentId}/send-invitations`, {
    method,
    ...(playerId !== undefined && playerId !== null ? { playerId } : {}),
    ...(customMessage ? { customMessage } : {})
  }),
  getAttendance: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/attendance`),
  // pairs is optional: either an object { playerId: pairNumber } or array [{ playerId, pair }]
  assignFoursomeGroup: (tournamentId, group, playerIds, pairs) => apiClient.post(`/tournaments/${tournamentId}/foursome-group`, { group, playerIds, pairs }),
  getResultsEmail: (id) => apiClient.get(`/tournaments/${id}/results-email`),
    generateResultsEmail: (id, customMessage) => apiClient.post(`/tournaments/${id}/results-email/generate`, customMessage ? { customMessage } : {}),
  sendResultsEmail: (id, email) => apiClient.post(`/tournaments/${id}/results-email/send`, email ? { email } : {}),
}

export const scoresAPI = {
  list: (params) => apiClient.get('/scores', { params }),
  getFoursomeScores: (tournamentId, group) => apiClient.get(`/scores/tournament/${tournamentId}/foursome/${group}`),
  getFoursomeGroups: (tournamentId) => apiClient.get(`/scores/tournament/${tournamentId}/groups`),
  saveScores: (scores) => apiClient.post('/scores', { scores }),
  update: (id, score, quota, foursome_group) => apiClient.put(`/scores/${id}`, { score, quota, foursome_group }),
  delete: (id) => apiClient.delete(`/scores/${id}`),
  getCtpWinners: (tournamentId) => apiClient.get(`/scores/tournament/${tournamentId}/ctp-winners`),
  getCtpLeader: (tournamentId, holeId) => apiClient.get(`/scores/tournament/${tournamentId}/hole/${holeId}/ctp-leader`),
  getFoursomePostStatus: (tournamentId, group) => apiClient.get(`/scores/tournament/${tournamentId}/foursome/${encodeURIComponent(group)}/post-status`),
  postFoursomeScores: (tournamentId, group) => apiClient.post(`/scores/tournament/${tournamentId}/foursome/${encodeURIComponent(group)}/post`)
}

export const leaderboardAPI = {
  get: (tournamentId) => apiClient.get(`/leaderboard/${tournamentId}`)
}

export const settingsAPI = {
  get: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data)
}

export const leaguesAPI = {
  list: () => apiClient.get('/leagues'),
  get: (id) => apiClient.get(`/leagues/${id}`),
  getSettings: (id) => apiClient.get(`/leagues/${id}/settings`),
  updateSettings: (id, data) => apiClient.put(`/leagues/${id}/settings`, data),
  getPlayers: (id) => apiClient.get(`/leagues/${id}/players`),
  getTournaments: (id) => apiClient.get(`/leagues/${id}/tournaments`),
  current: () => apiClient.get('/leagues/current'),
}

export const emailsAPI = {
  list: () => apiClient.get('/emails'),
  get: (id) => apiClient.get(`/emails/${id}`),
  markRead: (id, isRead) => apiClient.put(`/emails/${id}/read`, { is_read: isRead }),
  delete: (id) => apiClient.delete(`/emails/${id}`),
  send: (formData) => apiClient.post('/emails/send', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const cartTagsAPI = {
  generate: (tournamentId) => apiClient.get(`/cart-tags/tournament/${tournamentId}`),
  send: (tournamentId) => apiClient.post(`/cart-tags/tournament/${tournamentId}/send`)
}

export const rulesAPI = {
  getCurrent: () => apiClient.get('/rules'),
  listDrafts: () => apiClient.get('/rules/drafts'),
  createDraft: (data) => apiClient.post('/rules/drafts', data),
  updateDraft: (id, data) => apiClient.put(`/rules/${id}`, data),
  publishDraft: (id) => apiClient.post(`/rules/${id}/publish`)
}

export default apiClient
