import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%',
  background: '#1a3251',
  border: '1px solid rgba(140,176,208,0.20)',
  borderRadius: 8,
  padding: '11px 14px',
  color: '#e9f1f8',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  colorScheme: 'dark',
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#9db2c6',
  marginBottom: 6,
  display: 'block',
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first.')
      return
    }
    setResetLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    if (error) setError(error.message)
    else setResetSent(true)
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
          <div style={{ fontSize: 13, color: '#9db2c6' }}>Sign in to chart your course</div>
        </div>

        <div style={{ background: 'linear-gradient(180deg, #0f1f33, #0a1626)', border: '1px solid rgba(140,176,208,0.16)', borderRadius: 16, padding: 28, boxShadow: '0 20px 48px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: '#d24a3a', background: 'rgba(210,74,58,0.08)', border: '1px solid rgba(210,74,58,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="gl-btn"
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid rgba(200,162,74,0.5)', background: 'linear-gradient(135deg, #dcb35e, #c8a24a)', color: '#0a1626', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {resetSent ? (
              <div style={{ fontSize: 12, color: '#52a9cd', textAlign: 'center' }}>
                Password reset email sent — check your inbox.
              </div>
            ) : (
              <button
                onClick={handleForgotPassword}
                disabled={resetLoading}
                style={{ background: 'none', border: 'none', color: '#9db2c6', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', width: '100%' }}
              >
                {resetLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#9db2c6' }}>
          Don't have an account?{' '}
          <button onClick={() => navigate('/signup')} style={{ color: '#2f7da3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}