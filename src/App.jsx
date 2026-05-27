import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Community from './pages/Community'
import Marketplace from './pages/Marketplace'
import DeckBuilder from './pages/DeckBuilder'
import Login from './pages/Login'
import LiveTournament from './pages/LiveTournament'
import Signup from './pages/Signup'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSignup, setShowSignup] = useState(false)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>Loading...</div>
      </div>
    )
  }

  if (!session) {
    return showSignup
      ? <Signup onSwitch={() => setShowSignup(false)} />
      : <Login onSwitch={() => setShowSignup(true)} />
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#0c0814', color: '#f0f2f5', fontFamily: "'Space Grotesk', system-ui, sans-serif", position: 'relative' }}>
        <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: '#7c3aed', top: -100, left: -100, opacity: 0.12, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, animation: 'orbPulse 8s ease-in-out infinite' }} />
        <div style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: '#ec4899', bottom: -80, right: -80, opacity: 0.1, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, animation: 'orbPulse 10s ease-in-out 2s infinite' }} />
        <div style={{ position: 'fixed', width: 250, height: 250, borderRadius: '50%', background: '#0ea5e9', top: '40%', left: '60%', opacity: 0.08, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, animation: 'orbPulse 12s ease-in-out 4s infinite' }} />
        <FloatingCards />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <Navbar session={session} />
          <main style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? '1rem' : 'clamp(1rem, 4vw, 1.5rem)' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<Dashboard session={session} />} />
              <Route path="/log" element={<LogResult session={session} />} />
              <Route path="/decklists" element={<Decklists session={session} />} />
              <Route path="/friends" element={<Friends session={session} />} />
              <Route path="/profile" element={<Profile session={session} />} />
              <Route path="/live" element={<LiveTournament session={session} />} />
              <Route path="/community" element={<Community session={session} />} />
              <Route path="/marketplace" element={<Marketplace session={session} />} />
              <Route path="/deck-builder" element={<DeckBuilder session={session} />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
