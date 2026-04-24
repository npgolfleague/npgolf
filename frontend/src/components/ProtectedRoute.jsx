import { useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

export const ProtectedRoute = ({ children }) => {
  const { token, loading } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !token) {
      navigate('/login')
    }
  }, [token, loading, navigate])

  if (loading) return null

  if (!token) return null

  return children
}
