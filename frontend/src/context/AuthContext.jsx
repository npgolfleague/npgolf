import { createContext, useState, useEffect, useRef } from 'react'
import { authAPI } from '../api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentUserId = useRef(null)
  useEffect(() => { currentUserId.current = user?.id ?? null }, [user])

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

  // Every tab shares one saved sign-in. When another tab signs in as someone
  // else, renews or signs out, follow it here too; otherwise this tab keeps
  // showing the old person while its requests go out as the new one.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.storageArea !== localStorage) return
      if (e.key !== null && e.key !== 'token' && e.key !== 'user') return
      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')
      if (savedToken && savedUser) {
        let next
        try { next = JSON.parse(savedUser) } catch { return }
        if (String(next?.id) !== String(currentUserId.current)) {
          // A different person: reload so no page keeps the old person's data.
          window.location.reload()
          return
        }
        setToken(savedToken)
      } else if (!savedToken && !savedUser) {
        setToken(null)
        setUser(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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
