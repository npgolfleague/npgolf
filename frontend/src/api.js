import axios from 'axios'

// Use import.meta.env instead of process.env for Vite
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

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
  register: (name, email, password) => apiClient.post('/players', { name, email, password })
}

export const playersAPI = {
  list: () => apiClient.get('/players'),
  get: (id) => apiClient.get(`/players/${id}`),
  update: (id, data) => apiClient.put(`/players/${id}`, data)
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
  get: (id) => apiClient.get(`/tournaments/${id}`),
  create: (date, course_id, number_of_holes) => apiClient.post('/tournaments', { date, course_id, number_of_holes }),
  update: (id, date, course_id, number_of_holes) => apiClient.put(`/tournaments/${id}`, { date, course_id, number_of_holes }),
  delete: (id) => apiClient.delete(`/tournaments/${id}`),
  getPlayers: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/players`),
  addPlayer: (tournamentId, playerId) => apiClient.post(`/tournaments/${tournamentId}/players`, { playerId }),
  removePlayer: (tournamentId, playerId) => apiClient.delete(`/tournaments/${tournamentId}/players/${playerId}`),
  getAvailablePlayers: (tournamentId) => apiClient.get(`/tournaments/${tournamentId}/available-players`)
}

export const scoresAPI = {
  list: (params) => apiClient.get('/scores', { params }),
  getFoursomeScores: (tournamentId, group) => apiClient.get(`/scores/tournament/${tournamentId}/foursome/${group}`),
  saveScores: (scores) => apiClient.post('/scores', { scores }),
  update: (id, score, quota, foursome_group) => apiClient.put(`/scores/${id}`, { score, quota, foursome_group }),
  delete: (id) => apiClient.delete(`/scores/${id}`)
}

export const leaderboardAPI = {
  get: (tournamentId) => apiClient.get(`/leaderboard/${tournamentId}`)
}

export default apiClient
