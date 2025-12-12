import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
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
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </React.StrictMode>
  )
} catch (err) {
  console.error('Frontend error:', err)
  document.getElementById('root').innerHTML = `<h1>Error: ${err.message}</h1><pre>${err.stack}</pre>`
}

