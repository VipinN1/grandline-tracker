import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useWindowSize } from './hooks/useWindowSize'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import LogResult from './pages/LogResult'
import Decklists from './pages/Decklists'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import Community from './pages/Community'
import Login from './pages/Login'
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
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Loading...</div>
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
      <div style={{ minHeight: '100vh', background: '#0f1117', color: '#f0f2f5', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
        <Navbar session={session} />
        <main style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard session={session} />} />
            <Route path="/log" element={<LogResult session={session} />} />
            <Route path="/decklists" element={<Decklists session={session} />} />
            <Route path="/friends" element={<Friends session={session} />} />
            <Route path="/profile" element={<Profile session={session} />} />
            <Route path="/community" element={<Community session={session} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}