import axios from 'axios'

// Use relative URL so it works whether accessed via localhost or IP address
const API_BASE = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE
})

// Add JWT token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authAPI = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  register: (name, email, password, phone, sex, smsAllowed) => apiClient.post('/auth/register', { name, email, password, phone, sex, sms_allowed: smsAllowed }),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => apiClient.post('/auth/reset-password', { token, password })
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
  list: () => apiClient.get('/courses'),
  get: (id) => apiClient.get(`/courses/${id}`),
  create: (name, address, phone) => apiClient.post('/courses', { name, address, phone }),
  addHoles: (courseId, holes) => apiClient.post(`/courses/${courseId}/holes`, { holes }),
  update: (id, name, address, phone) => apiClient.put(`/courses/${id}`, { name, address, phone }),
  delete: (id) => apiClient.delete(`/courses/${id}`)
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
  addPlayer: (tournamentId, playerId) => apiClient.post(`/tournaments/${tournamentId}/players`, { playerId }),
  removePlayer: (tournamentId, playerId) => apiClient.delete(`/tournaments/${tournamentId}/players/${playerId}`),
  getAvailablePlayers: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/available-players`),
  updatePaidStatus: (tournamentId, playerId, paid) => apiClient.put(`/tournaments/${tournamentId}/players/${playerId}/paid`, { paid }),
  updateSkinsCtpPaidStatus: (tournamentId, playerId, skins_ctp_paid) => apiClient.put(`/tournaments/${tournamentId}/players/${playerId}/skins-ctp-paid`, { skins_ctp_paid }),
  sendInviteSMS: (tournamentId) => apiClient.post(`/tournaments/${tournamentId}/invite-sms`),
  sendSMS: (tournamentId) => apiClient.post(`/tournaments/${tournamentId}/send-sms`),
  sendInvitations: (tournamentId, method, playerId) => apiClient.post(`/tournaments/${tournamentId}/send-invitations`, {
    method,
    ...(playerId !== undefined && playerId !== null ? { playerId } : {})
  }),
  getAttendance: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/attendance`),
  getResultsEmail: (id) => apiClient.get(`/tournaments/${id}/results-email`),
    generateResultsEmail: (id) => apiClient.post(`/tournaments/${id}/results-email/generate`),
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
  getCtpLeader: (tournamentId, holeId) => apiClient.get(`/scores/tournament/${tournamentId}/hole/${holeId}/ctp-leader`)
}

export const leaderboardAPI = {
  get: (tournamentId) => apiClient.get(`/leaderboard/${tournamentId}`)
}

export const settingsAPI = {
  get: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data)
}

export const emailsAPI = {
  list: () => apiClient.get('/emails'),
  get: (id) => apiClient.get(`/emails/${id}`),
  markRead: (id, isRead) => apiClient.put(`/emails/${id}/read`, { is_read: isRead }),
  delete: (id) => apiClient.delete(`/emails/${id}`)
}

export const cartTagsAPI = {
  generate: (tournamentId) => apiClient.get(`/cart-tags/tournament/${tournamentId}`),
  send: (tournamentId) => apiClient.post(`/cart-tags/tournament/${tournamentId}/send`)
}

export default apiClient
