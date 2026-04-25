import { createContext, useState, useEffect } from 'react'
import { authAPI } from '../api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    const savedRefresh = localStorage.getItem('refreshToken')
    console.debug('Auth restore: savedToken?', !!savedToken, 'savedUser?', !!savedUser, 'savedRefresh?', !!savedRefresh)
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setLoading(false)
      return
    }

    // Try to refresh using stored refresh token
    if (savedRefresh) {
      console.debug('Auth restore: attempting refresh')
      (async () => {
        try {
          const resp = await authAPI.refresh(savedRefresh)
          console.debug('Auth restore: refresh response', resp.data)
          const { token: newToken, user: newUser, refreshToken } = resp.data
          setToken(newToken)
          setUser(newUser)
          localStorage.setItem('token', newToken)
          localStorage.setItem('user', JSON.stringify(newUser))
          if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
        } catch (err) {
          console.debug('Auth restore: refresh failed', err?.response?.data || err.message || err)
          // failed to refresh - clear storage
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('refreshToken')
        } finally {
          setLoading(false)
        }
      })()
    } else {
      setLoading(false)
    }
  }, [])

  const login = (userData, authToken, refreshToken) => {
    setUser(userData)
    setToken(authToken)
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    setLoading(false)
  }

  const logout = () => {
    const savedRefresh = localStorage.getItem('refreshToken')
    if (savedRefresh) {
      try { authAPI.logout(savedRefresh) } catch (e) { /* ignore */ }
    }
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('refreshToken')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, setLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
