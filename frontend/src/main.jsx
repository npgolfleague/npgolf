import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthProvider } from './context/AuthContext'
import { AuthContext } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MainLayout } from './components/MainLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Users } from './pages/Users'
import { Courses } from './pages/Courses'
import { AddCourse } from './pages/AddCourse'
import { EditCourse } from './pages/EditCourse'
import { ScoreEntry } from './pages/ScoreEntry'
import { TournamentPlayers } from './pages/TournamentPlayers'
import { Leaderboard } from './pages/Leaderboard'
import { Settings } from './pages/Settings'
import { Tournaments } from './pages/Tournaments'
import { AddTournament } from './pages/AddTournament'
import { EditTournament } from './pages/EditTournament'
import { TournamentHoleScores } from './pages/TournamentHoleScores'
import { Rules } from './pages/Rules'
import { Quota } from './pages/Quota'
import { SMSConsent } from './pages/SMSConsent'
import { Inbox } from './pages/Inbox'
import { About } from './pages/About'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'

const HomeEntry = () => {
  const { token } = useContext(AuthContext)
  if (token) {
    return <Navigate to="/app/dashboard" replace />
  }
  return <Dashboard />
}

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomeEntry />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<Register />} />
            <Route path="/sms-consent" element={<SMSConsent />} />
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/app/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/add" element={<AddCourse />} />
              <Route path="/courses/:id" element={<EditCourse />} />
              <Route path="/scores" element={<ScoreEntry />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/add" element={<AddTournament />} />
              <Route path="/tournaments/:id/edit" element={<EditTournament />} />
              <Route path="/tournaments/:tournamentId/players" element={<TournamentPlayers />} />
              <Route path="/tournaments/:tournamentId/leaderboard" element={<Leaderboard />} />
              <Route path="/tournaments/:tournamentId/hole-scores" element={<TournamentHoleScores />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/quota" element={<Quota />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/app/about" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </React.StrictMode>
  )
} catch (err) {
  console.error('Frontend error:', err)
  document.getElementById('root').innerHTML = `<h1>Error: ${err.message}</h1><pre>${err.stack}</pre>`
}

