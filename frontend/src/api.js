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
  register: (name, email, password) => apiClient.post('/users', { name, email, password })
}

export const usersAPI = {
  list: () => apiClient.get('/users'),
  get: (id) => apiClient.get(`/users/${id}`)
}

export default apiClient
