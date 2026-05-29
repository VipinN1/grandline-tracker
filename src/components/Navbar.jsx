import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

const LOGO_STYLE = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '-0.3px',
  background: 'linear-gradient(90deg, #a78bfa, #ec4899, #f59e0b, #a78bfa)',
  backgroundSize: '300% 300%',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  animation: 'holoShimmer 4s ease infinite',
  cursor: 'default',
  userSelect: 'none',
}

function tabStyle(isActive) {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
    background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
    color: isActive ? '#a78bfa' : '#7c6fa0',
    fontFamily: 'inherit',
    textDecoration: 'none',
    transition: 'all 0.15s',
  }
}

function liveTabStyle(isActive) {
  return {
    fontSize: 13,
    fontWeight: 600,
    padding: '5px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    border: isActive ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(52,211,153,0.2)',
    background: isActive ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.06)',
    color: '#34d399',
    fontFamily: 'inherit',
    textDecoration: 'none',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
}

const AUTH_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/log', label: 'Log Result' },
  { to: '/decklists', label: 'Decklists' },
  { to: '/friends', label: 'Friends' },
  { to: '/profile', label: 'Profile' },
  { to: '/community', label: 'Community' },
  { to: '/marketplace', label: 'Market' },
  { to: '/deck-builder', label: 'Deck Builder' },
]

const LIVE_DOT = (
  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
)

export default function Navbar({ session }) {
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadMktCount, setUnreadMktCount] = useState(0)
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

  useEffect(() => {
    if (!session) return
    async function loadUnread() {
      const { count } = await supabase
        .from('marketplace_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', session.user.id)
        .eq('read', false)
      setUnreadMktCount(count ?? 0)
    }
    loadUnread()
    const channel = supabase
      .channel(`navbar_mkt_${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'marketplace_messages', filter: `receiver_id=eq.${session.user.id}` }, () => {
        setUnreadMktCount(c => c + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'marketplace_messages', filter: `receiver_id=eq.${session.user.id}` }, () => {
        loadUnread()
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [session])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const avatarEl = (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', border: '1.5px solid rgba(139,92,246,0.4)' }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  )

  return (
    <>
      <nav style={{ background: 'rgba(12,8,20,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(139,92,246,0.12)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', gap: 4, position: 'sticky', top: 0, zIndex: 50 }}>
        <NavLink to="/" style={{ ...LOGO_STYLE, textDecoration: 'none' }}>PirateTracker</NavLink>

        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {session && avatarEl}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: '#f0f2f5', fontSize: 22, cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : session ? (
          <>
            <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {AUTH_LINKS.map(link => (
                <NavLink key={link.to} to={link.to} style={({ isActive }) => tabStyle(isActive)}>
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {link.label}
                    {link.to === '/marketplace' && unreadMktCount > 0 && (
                      <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#f05252', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                        {unreadMktCount > 9 ? '9+' : unreadMktCount}
                      </span>
                    )}
                  </span>
                </NavLink>
              ))}
              <NavLink to="/live" style={({ isActive }) => liveTabStyle(isActive)}>
                {LIVE_DOT}
                Live
              </NavLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              {avatarEl}
              <button onClick={handleSignOut} style={{ fontSize: 12, fontWeight: 600, color: '#4a5068', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <NavLink to="/deck-builder" style={({ isActive }) => tabStyle(isActive)}>Deck Builder</NavLink>
              <NavLink to="/live" style={({ isActive }) => liveTabStyle(isActive)}>
                {LIVE_DOT}
                Live
              </NavLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <button onClick={() => navigate('/login')} style={{ fontSize: 13, fontWeight: 600, color: '#7c6fa0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px' }}>
                Log In
              </button>
              <button onClick={() => navigate('/signup')} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '6px 14px', borderRadius: 8 }}>
                Sign Up
              </button>
            </div>
          </>
        )}
      </nav>

      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 52, left: 0, right: 0, bottom: 0, background: '#0c0814', zIndex: 49, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {session ? (
            <>
              {AUTH_LINKS.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  style={({ isActive }) => ({
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '16px 24px',
                    color: isActive ? '#a78bfa' : '#f0f2f5',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(139,92,246,0.08)',
                    background: isActive ? 'rgba(139,92,246,0.08)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  {link.label}
                  {link.to === '/marketplace' && unreadMktCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#f05252', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {unreadMktCount > 9 ? '9+' : unreadMktCount}
                    </span>
                  )}
                </NavLink>
              ))}
              <NavLink
                to="/live"
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  fontSize: 16,
                  fontWeight: 600,
                  padding: '16px 24px',
                  color: '#34d399',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(139,92,246,0.08)',
                  background: isActive ? 'rgba(52,211,153,0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                })}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite' }} />
                Live
              </NavLink>
              <div style={{ padding: '16px 24px', marginTop: 'auto', borderTop: '1px solid rgba(139,92,246,0.08)' }}>
                <button onClick={handleSignOut} style={{ fontSize: 15, fontWeight: 600, color: '#f05252', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <NavLink
                to="/deck-builder"
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  fontSize: 16, fontWeight: 600, padding: '16px 24px', color: isActive ? '#a78bfa' : '#f0f2f5',
                  textDecoration: 'none', borderBottom: '1px solid rgba(139,92,246,0.08)',
                  background: isActive ? 'rgba(139,92,246,0.08)' : 'transparent',
                })}
              >
                Deck Builder
              </NavLink>
              <NavLink
                to="/live"
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  fontSize: 16, fontWeight: 600, padding: '16px 24px', color: '#34d399',
                  textDecoration: 'none', borderBottom: '1px solid rgba(139,92,246,0.08)',
                  background: isActive ? 'rgba(52,211,153,0.08)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 8,
                })}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite' }} />
                Live
              </NavLink>
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(139,92,246,0.08)', marginTop: 'auto' }}>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/signup') }}
                  style={{ padding: '11px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Sign Up Free
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/login') }}
                  style={{ padding: '11px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'transparent', color: '#a78bfa', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Log In
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
