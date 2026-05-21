import { useContext, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

export const ProtectedRoute = ({ children }) => {
  const { token, loading } = useContext(AuthContext)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !token) {
      // Save the current path and search params to redirect after login
      const redirectTo = location.pathname + location.search
      navigate('/login', { state: { from: redirectTo } })
    }
  }, [token, loading, navigate, location])

  if (loading) return null

  if (!token) return null

  return children
}
