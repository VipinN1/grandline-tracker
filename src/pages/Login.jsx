import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#f0f2f5',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#7c6fa0',
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
    <div style={{ minHeight: '100vh', background: '#0c0814', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f0f2f5', marginBottom: 6 }}>
            Pirate<span style={{ color: '#8b5cf6' }}>Tracker</span>
          </div>
          <div style={{ fontSize: 13, color: '#7c6fa0' }}>Sign in to your account</div>
        </div>

        <div style={{ background: 'rgba(20,12,36,0.9)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 14, padding: 28 }}>
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
              <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: loading ? '#5b21b6' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {resetSent ? (
              <div style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center' }}>
                Password reset email sent — check your inbox.
              </div>
            ) : (
              <button
                onClick={handleForgotPassword}
                disabled={resetLoading}
                style={{ background: 'none', border: 'none', color: '#7c6fa0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', width: '100%' }}
              >
                {resetLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#7c6fa0' }}>
          Don't have an account?{' '}
          <button onClick={() => navigate('/signup')} style={{ color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}