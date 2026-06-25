import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%',
  background: 'rgba(140,176,208,0.03)',
  border: '1px solid rgba(140,176,208,0.07)',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#e9f1f8',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#9db2c6',
  marginBottom: 6,
  display: 'block',
}

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignup() {
    setLoading(true)
    setError('')

    if (!username.trim()) {
      setError('Username is required')
      setLoading(false)
      return
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim(), location: location.trim() }
      }
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#06101b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e9f1f8', marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 13, color: '#9db2c6', marginBottom: 24 }}>We sent a confirmation link to <span style={{ color: '#e9f1f8' }}>{email}</span>. Click it to activate your account.</div>
          <button onClick={() => navigate('/login')} style={{ color: '#2f7da3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(900px 600px at 50% -10%, rgba(47,125,163,0.16), transparent 60%), linear-gradient(180deg, #07121f, #06101b)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#c8a24a" strokeWidth="1.4" />
              <circle cx="12" cy="12" r="6.2" stroke="rgba(200,162,74,0.4)" strokeWidth="1" />
              <path d="M12 4.5 L13.7 10.3 L12 12 L10.3 10.3 Z" fill="#f0cd82" />
              <path d="M12 19.5 L10.3 13.7 L12 12 L13.7 13.7 Z" fill="#9a7a30" />
            </svg>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 600, color: '#e9ddc4', letterSpacing: '0.2px' }}>PirateTracker</div>
          </div>
          <div style={{ fontSize: 13, color: '#9db2c6' }}>Create your account and set sail</div>
        </div>

        <div style={{ background: 'linear-gradient(180deg, #0f1f33, #0a1626)', border: '1px solid rgba(140,176,208,0.16)', borderRadius: 16, padding: 28, boxShadow: '0 20px 48px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="e.g. OPTCG_Gamer"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Location <span style={{ color: '#67809a', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Houston, TX"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: '#d24a3a', background: 'rgba(210,74,58,0.08)', border: '1px solid rgba(210,74,58,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              className="gl-btn"
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid rgba(200,162,74,0.5)', background: 'linear-gradient(135deg, #dcb35e, #c8a24a)', color: '#0a1626', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#9db2c6' }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} style={{ color: '#2f7da3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}