import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MainLayout } from './components/MainLayout'
import { Login } from './pages/Login'
import { LeagueSelect } from './pages/LeagueSelect'
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
import { League } from './pages/League'
import { Tournaments } from './pages/Tournaments'
import { AddTournament } from './pages/AddTournament'
import { EditTournament } from './pages/EditTournament'
import { TournamentHoleScores } from './pages/TournamentHoleScores'
import { Rules } from './pages/Rules'
import { RulesManager } from './pages/RulesManager'
import { Quota } from './pages/Quota'
import { SMSConsent } from './pages/SMSConsent'
import { Inbox } from './pages/Inbox'
import { BillingEntities } from './pages/BillingEntities'
import { ScorecardUpload } from './pages/ScorecardUpload'
import { About } from './pages/About'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'

// Wrapper to show LeagueSelect or Login based on league context
const LoginEntry = () => {
  // Check if we have a league context (basename is set)
  const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
  const commonRoutes = ['api', 'login', 'register', 'forgot-password', 'reset-password', 
                        'sms-consent', 'dashboard', 'about', 'app', 'assets', 'billing-entities'];
  const hasLeagueContext = (pathParts.length > 0 && !commonRoutes.includes(pathParts[0]));
  
  // If no league context, show league selection
  if (!hasLeagueContext) {
    return <LeagueSelect />
  }
  
  // Otherwise show normal login
  return <Login />
}

try {
  // Detect league prefix for React Router basename
  const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
  const commonRoutes = ['api', 'login', 'register', 'forgot-password', 'reset-password', 
                        'sms-consent', 'dashboard', 'about', 'app', 'assets', 'billing-entities'];
  const basename = (pathParts.length > 0 && !commonRoutes.includes(pathParts[0])) 
    ? '/' + pathParts[0] : undefined;

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <ToastProvider>
          <Router basename={basename}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<LoginEntry />} />
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
              <Route path="/league" element={<League />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/rules/manage" element={<RulesManager />} />
              <Route path="/rules/edit" element={<Navigate to="/rules/manage" replace />} />
              <Route path="/rules-manager" element={<Navigate to="/rules/manage" replace />} />
              <Route path="/quota" element={<Quota />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/billing-entities" element={<BillingEntities />} />
              <Route path="/courses/parse-scorecard" element={<ScorecardUpload />} />
              <Route path="/app/about" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>        </ToastProvider>      </AuthProvider>
    </React.StrictMode>
  )
} catch (err) {
  console.error('Frontend error:', err)
  document.getElementById('root').innerHTML = `<h1>Error: ${err.message}</h1><pre>${err.stack}</pre>`
}

