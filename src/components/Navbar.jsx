import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

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

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/log', label: 'Log Result' },
  { to: '/decklists', label: 'Decklists' },
  { to: '/friends', label: 'Friends' },
  { to: '/profile', label: 'Profile' },
  { to: '/community', label: 'Community' },
]

export default function Navbar({ session }) {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { isMobile } = useWindowSize()

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

  const avatarEl = (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3d7fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)' }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  )

  return (
    <>
      <nav style={{ background: 'rgba(15,17,23,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', gap: 4, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.3px' }}>
          Pirate<span style={{ color: '#3d7fff' }}>Tracker</span>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {avatarEl}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: '#f0f2f5', fontSize: 22, cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {NAV_LINKS.map(link => (
                <NavLink key={link.to} to={link.to} style={({ isActive }) => tabStyle(isActive)}>{link.label}</NavLink>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              {avatarEl}
              <button onClick={handleSignOut} style={{ fontSize: 12, fontWeight: 600, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                Sign out
              </button>
            </div>
          </>
        )}
      </nav>

      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 52, left: 0, right: 0, bottom: 0, background: '#0f1117', zIndex: 49, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                fontSize: 16,
                fontWeight: 600,
                padding: '16px 24px',
                color: isActive ? '#5b8fff' : '#f0f2f5',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: isActive ? 'rgba(61,127,255,0.08)' : 'transparent',
                display: 'block',
              })}
            >
              {link.label}
            </NavLink>
          ))}
          <div style={{ padding: '16px 24px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={handleSignOut} style={{ fontSize: 15, fontWeight: 600, color: '#f05252', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  )
}
