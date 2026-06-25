import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useWindowSize } from './hooks/useWindowSize'
import Navbar from './components/Navbar'
import FloatingCards from './components/FloatingCards'
import Dashboard from './pages/Dashboard'
import LogResult from './pages/LogResult'
import Decklists from './pages/Decklists'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import UserProfilePage from './pages/UserProfilePage'
import TournamentsPage from './pages/TournamentsPage'
import TournamentDetailPage from './pages/TournamentDetailPage'
import Community from './pages/Community'
import Marketplace from './pages/Marketplace'
import DeckBuilder from './pages/DeckBuilder'
import Login from './pages/Login'
import LiveTournament from './pages/LiveTournament'
import Signup from './pages/Signup'
import Home from './pages/Home'
import StorefrontPage from './pages/StorefrontPage'
import BountyBoard from './pages/BountyBoard'
import Stats from './pages/Stats'
import BugReports from './pages/BugReports'
import About from './pages/About'
import ResetPassword from './pages/ResetPassword'

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

function AppLayout({ session, isMobile }) {
  return (
    <div style={{ minHeight: '100vh', color: '#e9f1f8', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative' }}>
      <FloatingCards />
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Navbar session={session} />
        <main style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '20px 16px 48px' : 'clamp(24px, 4vw, 40px) clamp(16px, 4vw, 28px) 64px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSession(session)
        window.location.replace('/reset-password')
        return
      }
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative', zIndex: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(220,179,94,0.2)', borderTopColor: '#dcb35e', animation: 'compassSpin 0.9s linear infinite' }} />
        <div style={{ fontSize: 12, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#9db2c6', fontWeight: 600 }}>Charting course…</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages — full screen, no app shell */}
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* App shell routes */}
        <Route element={<AppLayout session={session} isMobile={isMobile} />}>
          <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Home />} />
          <Route path="/deck-builder" element={<DeckBuilder session={session} />} />
          <Route path="/live" element={<LiveTournament session={session} />} />
          <Route path="/community" element={<Community session={session} />} />
          <Route path="/marketplace" element={<Marketplace session={session} />} />
          <Route path="/dashboard" element={<ProtectedRoute session={session}><Dashboard session={session} /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute session={session}><Stats session={session} /></ProtectedRoute>} />
          <Route path="/log" element={<ProtectedRoute session={session}><LogResult session={session} /></ProtectedRoute>} />
          <Route path="/decklists" element={<ProtectedRoute session={session}><Decklists session={session} /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute session={session}><Friends session={session} /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute session={session}><Profile session={session} /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<UserProfilePage session={session} />} />
          <Route path="/tournaments" element={<TournamentsPage session={session} />} />
          <Route path="/tournaments/:id" element={<TournamentDetailPage session={session} />} />
          <Route path="/storefront/:id" element={<StorefrontPage session={session} />} />
          <Route path="/bounty" element={<BountyBoard session={session} />} />
          <Route path="/bug-reports" element={<ProtectedRoute session={session}><BugReports session={session} /></ProtectedRoute>} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
