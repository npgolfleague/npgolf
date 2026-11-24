import './index.css'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MainLayout } from './components/MainLayout'
import { Login } from './pages/Login'
import { LeagueSelect } from './pages/LeagueSelect'

// Pages load on demand, so a phone only downloads the page it opens.
// If a deploy replaced the files a page needs, reload once to pick up the new build.
const lazyPage = (load, name) => lazy(() =>
  load()
    .then((mod) => {
      try { sessionStorage.removeItem('npgolf_chunk_reload') } catch { /* ignore */ }
      return { default: mod[name] }
    })
    .catch((err) => {
      let reloaded = false
      try { reloaded = sessionStorage.getItem('npgolf_chunk_reload') === '1' } catch { /* ignore */ }
      if (!reloaded) {
        try { sessionStorage.setItem('npgolf_chunk_reload', '1') } catch { /* ignore */ }
        window.location.reload()
        return new Promise(() => {})
      }
      throw err
    })
)

const Register = lazyPage(() => import('./pages/Register'), 'Register')
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard')
const Users = lazyPage(() => import('./pages/Users'), 'Users')
const Courses = lazyPage(() => import('./pages/Courses'), 'Courses')
const AddCourse = lazyPage(() => import('./pages/AddCourse'), 'AddCourse')
const EditCourse = lazyPage(() => import('./pages/EditCourse'), 'EditCourse')
const ScoreEntry = lazyPage(() => import('./pages/ScoreEntry'), 'ScoreEntry')
const TournamentPlayers = lazyPage(() => import('./pages/TournamentPlayers'), 'TournamentPlayers')
const Leaderboard = lazyPage(() => import('./pages/Leaderboard'), 'Leaderboard')
const Settings = lazyPage(() => import('./pages/Settings'), 'Settings')
const League = lazyPage(() => import('./pages/League'), 'League')
const Seasons = lazyPage(() => import('./pages/Seasons'), 'Seasons')
const Tournaments = lazyPage(() => import('./pages/Tournaments'), 'Tournaments')
const AddTournament = lazyPage(() => import('./pages/AddTournament'), 'AddTournament')
const EditTournament = lazyPage(() => import('./pages/EditTournament'), 'EditTournament')
const TournamentHoleScores = lazyPage(() => import('./pages/TournamentHoleScores'), 'TournamentHoleScores')
const Rules = lazyPage(() => import('./pages/Rules'), 'Rules')
const RulesManager = lazyPage(() => import('./pages/RulesManager'), 'RulesManager')
const Quota = lazyPage(() => import('./pages/Quota'), 'Quota')
const SMSConsent = lazyPage(() => import('./pages/SMSConsent'), 'SMSConsent')
const Inbox = lazyPage(() => import('./pages/Inbox'), 'Inbox')
const BillingEntities = lazyPage(() => import('./pages/BillingEntities'), 'BillingEntities')
const ScorecardUpload = lazyPage(() => import('./pages/ScorecardUpload'), 'ScorecardUpload')
const About = lazyPage(() => import('./pages/About'), 'About')
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'), 'ForgotPassword')
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'), 'ResetPassword')

const PageLoading = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-fairway-600" />
    <span className="sr-only">Loading…</span>
  </div>
)

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
          <Suspense fallback={<PageLoading />}>
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
              <Route path="/seasons" element={<Seasons />} />
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
          </Suspense>
        </Router>        </ToastProvider>      </AuthProvider>
    </React.StrictMode>
  )
} catch (err) {
  console.error('Frontend error:', err)
  document.getElementById('root').textContent = `Error: ${err.message}`
}

