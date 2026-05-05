import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function tabStyle(isActive) {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    border: 'none',
    background: isActive ? 'rgba(61,127,255,0.12)' : 'transparent',
    color: isActive ? '#5b8fff' : '#6b7a99',
    fontFamily: 'inherit',
    textDecoration: 'none',
    transition: 'all 0.1s',
  }
}

export default function Navbar({ session }) {
  const [avatarUrl, setAvatarUrl] = useState(null)

  const username = session?.user?.user_metadata?.username ?? 'Me'
  const initials = username.slice(0, 2).toUpperCase()

  useEffect(() => {
    async function loadAvatar() {
      if (!session) return
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single()
      if (data?.avatar_url) setAvatarUrl(data.avatar_url)
    }
    loadAvatar()
  }, [session])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <nav style={{ background: 'rgba(15,17,23,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', gap: 4, position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', marginRight: 'auto', letterSpacing: '-0.3px' }}>
        grand<span style={{ color: '#3d7fff' }}>line</span>
      </div>
      <NavLink to="/dashboard" style={({ isActive }) => tabStyle(isActive)}>Dashboard</NavLink>
      <NavLink to="/log" style={({ isActive }) => tabStyle(isActive)}>Log Result</NavLink>
      <NavLink to="/decklists" style={({ isActive }) => tabStyle(isActive)}>Decklists</NavLink>
      <NavLink to="/friends" style={({ isActive }) => tabStyle(isActive)}>Friends</NavLink>
      <NavLink to="/profile" style={({ isActive }) => tabStyle(isActive)}>Profile</NavLink>
      <NavLink to="/community" style={({ isActive }) => tabStyle(isActive)}>Community</NavLink>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3d7fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials
          }
        </div>
        <button onClick={handleSignOut} style={{ fontSize: 12, fontWeight: 600, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          Sign out
        </button>
      </div>
    </nav>
  )
}