import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import BugReportModal from './BugReportModal'

// Lazy-loaded so tesseract.js stays out of the main bundle until a scan starts.
const CardScanner = lazy(() => import('./CardScanner'))

// Brass compass rose — the brand mark.
function Compass({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#c8a24a" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="6.2" stroke="rgba(200,162,74,0.4)" strokeWidth="1" />
      <path d="M12 4.5 L13.7 10.3 L12 12 L10.3 10.3 Z" fill="#f0cd82" />
      <path d="M12 19.5 L10.3 13.7 L12 12 L13.7 13.7 Z" fill="#9a7a30" />
      <circle cx="12" cy="12" r="1.3" fill="#dcb35e" />
    </svg>
  )
}

const LOGO_STYLE = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '0.2px',
  color: '#e9ddc4',
  cursor: 'pointer',
  userSelect: 'none',
}

// Active state and hover are handled by the .gl-navlink CSS classes.
const navLinkClass = ({ isActive }) => (isActive ? 'gl-navlink gl-navlink--active' : 'gl-navlink')

const AUTH_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/stats', label: 'Stats' },
  { to: '/log', label: 'Log Result' },
  { to: '/decklists', label: 'Decklists' },
  { to: '/friends', label: 'Friends' },
  { to: '/profile', label: 'Profile' },
  { to: '/bounty', label: '☠ Bounty' },
  { to: '/community', label: 'Community' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/marketplace', label: 'Market' },
  { to: '/deck-builder', label: 'Deck Builder' },
  { to: '/articles', label: 'Articles' },
  { to: '/about', label: 'About' },
]

export default function Navbar({ session }) {
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [bugOpen, setBugOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadMktCount, setUnreadMktCount] = useState(0)
  const [unreadDmCount, setUnreadDmCount] = useState(0)
  const { isMobile } = useWindowSize()

  const links = isAdmin ? [...AUTH_LINKS, { to: '/bug-reports', label: 'Bug Reports' }] : AUTH_LINKS

  function openScanner() {
    setMenuOpen(false)
    setScanOpen(true)
  }

  const username = session?.user?.user_metadata?.username ?? 'Me'
  const initials = username.slice(0, 2).toUpperCase()

  useEffect(() => {
    async function loadAvatar() {
      if (!session) return
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, username')
        .eq('id', session.user.id)
        .single()
      if (data?.avatar_url) setAvatarUrl(data.avatar_url)
      if (data?.username === 'Cipin') setIsAdmin(true)
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

  useEffect(() => {
    if (!session) return
    async function loadUnreadDms() {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', session.user.id)
        .eq('read', false)
      setUnreadDmCount(count ?? 0)
    }
    loadUnreadDms()
    const channel = supabase
      .channel(`navbar_dm_${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${session.user.id}` }, () => {
        setUnreadDmCount(c => c + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${session.user.id}` }, () => {
        loadUnreadDms()
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [session])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const avatarEl = (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1b4a66, #2f7da3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#e9ddc4', flexShrink: 0, overflow: 'hidden', border: '1.5px solid rgba(200,162,74,0.45)', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  )

  const scanMenuButton = (
    <button
      onClick={openScanner}
      style={{
        fontSize: 16, fontWeight: 600, padding: '16px 24px', textAlign: 'left',
        color: '#dcb35e', background: 'rgba(200,162,74,0.07)', border: 'none',
        borderBottom: '1px solid rgba(140,176,208,0.10)', cursor: 'pointer',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      }}
    >
      <span style={{ fontSize: 18 }}>📷</span>
      Scan Card
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
        color: '#e08a3c', background: 'rgba(224,138,60,0.14)', border: '1px solid rgba(224,138,60,0.35)',
        borderRadius: 5, padding: '2px 5px', lineHeight: 1,
      }}>
        Beta
      </span>
    </button>
  )

  const bugButton = (
    <button
      onClick={() => setBugOpen(true)}
      title="Report a bug"
      className="gl-btn"
      style={{ fontSize: 12, fontWeight: 600, color: '#9db2c6', background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.18)', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
    >
      🐞 Bug
    </button>
  )

  return (
    <>
      <nav style={{ background: 'rgba(8,16,27,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(200,162,74,0.16)', boxShadow: '0 1px 0 rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25)', padding: '0 1.5rem', height: 58, display: 'flex', alignItems: 'center', gap: 4, position: 'sticky', top: 0, zIndex: 50 }}>
        <NavLink to="/" style={{ ...LOGO_STYLE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <Compass size={22} />
          <span>PirateTracker</span>
        </NavLink>

        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <button onClick={() => setBugOpen(true)} title="Report a bug" style={{ background: 'none', border: 'none', color: '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', lineHeight: 1 }}>Bug</button>
            {session && avatarEl}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: '#e9ddc4', fontSize: 22, cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : session ? (
          <>
            <div style={{ marginLeft: 14, paddingLeft: 14, borderLeft: '1px solid rgba(140,176,208,0.14)', display: 'flex', alignItems: 'center', gap: 2 }}>
              {links.map(link => (
                <NavLink key={link.to} to={link.to} className={navLinkClass}>
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {link.label}
                    {link.to === '/marketplace' && unreadMktCount > 0 && (
                      <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#d24a3a', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                        {unreadMktCount > 9 ? '9+' : unreadMktCount}
                      </span>
                    )}
                    {link.to === '/community' && unreadDmCount > 0 && (
                      <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#d24a3a', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                        {unreadDmCount > 9 ? '9+' : unreadDmCount}
                      </span>
                    )}
                  </span>
                </NavLink>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', paddingLeft: 14, borderLeft: '1px solid rgba(140,176,208,0.14)' }}>
              {bugButton}
              {avatarEl}
              <button onClick={handleSignOut} className="gl-btn" style={{ fontSize: 12, fontWeight: 600, color: '#67809a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginLeft: 14, paddingLeft: 14, borderLeft: '1px solid rgba(140,176,208,0.14)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <NavLink to="/deck-builder" className={navLinkClass}>Deck Builder</NavLink>
              <NavLink to="/bounty" className={navLinkClass}>☠ Bounty</NavLink>
              <NavLink to="/community" className={navLinkClass}>Community</NavLink>
              <NavLink to="/tournaments" className={navLinkClass}>Tournaments</NavLink>
              <NavLink to="/marketplace" className={navLinkClass}>Market</NavLink>
              <NavLink to="/articles" className={navLinkClass}>Articles</NavLink>
              <NavLink to="/about" className={navLinkClass}>About</NavLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              {bugButton}
              <button onClick={() => navigate('/login')} className="gl-btn" style={{ fontSize: 13, fontWeight: 600, color: '#9db2c6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '6px 10px' }}>
                Log In
              </button>
              <button onClick={() => navigate('/signup')} className="gl-btn" style={{ fontSize: 13, fontWeight: 700, color: '#0a1626', background: 'linear-gradient(135deg, #dcb35e, #c8a24a)', border: '1px solid rgba(200,162,74,0.5)', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 16px', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                Sign Up
              </button>
            </div>
          </>
        )}
      </nav>

      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 58, left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, #0a1626, #06101b)', zIndex: 49, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {session ? (
            <>
              {scanMenuButton}
              {links.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  style={({ isActive }) => ({
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '16px 24px',
                    color: isActive ? '#dcb35e' : '#e9f1f8',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(140,176,208,0.08)',
                    borderLeft: isActive ? '3px solid #c8a24a' : '3px solid transparent',
                    background: isActive ? 'rgba(200,162,74,0.08)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  {link.label}
                  {link.to === '/marketplace' && unreadMktCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#d24a3a', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {unreadMktCount > 9 ? '9+' : unreadMktCount}
                    </span>
                  )}
                  {link.to === '/community' && unreadDmCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#d24a3a', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {unreadDmCount > 9 ? '9+' : unreadDmCount}
                    </span>
                  )}
                </NavLink>
              ))}
              <div style={{ padding: '16px 24px', marginTop: 'auto', borderTop: '1px solid rgba(140,176,208,0.08)' }}>
                <button onClick={handleSignOut} style={{ fontSize: 15, fontWeight: 600, color: '#d24a3a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              {scanMenuButton}
              {[
                { to: '/deck-builder', label: 'Deck Builder' },
                { to: '/bounty', label: '☠ Bounty Board' },
                { to: '/community', label: 'Community' },
                { to: '/tournaments', label: 'Tournaments' },
                { to: '/marketplace', label: 'Market' },
                { to: '/articles', label: 'Articles' },
                { to: '/about', label: 'About' },
              ].map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  style={({ isActive }) => ({
                    fontSize: 16, fontWeight: 600, padding: '16px 24px', color: isActive ? '#dcb35e' : '#e9f1f8',
                    textDecoration: 'none', borderBottom: '1px solid rgba(140,176,208,0.08)',
                    borderLeft: isActive ? '3px solid #c8a24a' : '3px solid transparent',
                    background: isActive ? 'rgba(200,162,74,0.08)' : 'transparent',
                  })}
                >
                  {link.label}
                </NavLink>
              ))}
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(140,176,208,0.08)', marginTop: 'auto' }}>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/signup') }}
                  style={{ padding: '12px', borderRadius: 8, border: '1px solid rgba(200,162,74,0.5)', background: 'linear-gradient(135deg, #dcb35e, #c8a24a)', color: '#0a1626', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Sign Up Free
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/login') }}
                  style={{ padding: '12px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.22)', background: 'transparent', color: '#c2d2e0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Log In
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isMobile && scanOpen && (
        <Suspense fallback={null}>
          <CardScanner onClose={() => setScanOpen(false)} />
        </Suspense>
      )}

      {bugOpen && <BugReportModal session={session} onClose={() => setBugOpen(false)} />}
    </>
  )
}
