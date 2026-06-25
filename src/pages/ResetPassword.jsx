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

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    }
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
          <div style={{ fontSize: 13, color: '#9db2c6' }}>Choose a new password</div>
        </div>

        <div style={{ background: 'linear-gradient(180deg, #0f1f33, #0a1626)', border: '1px solid rgba(140,176,208,0.16)', borderRadius: 16, padding: 28, boxShadow: '0 20px 48px rgba(0,0,0,0.5)' }}>
          {success ? (
            <div style={{ textAlign: 'center', fontSize: 14, color: '#52a9cd' }}>
              Password updated! Redirecting...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#d24a3a', background: 'rgba(210,74,58,0.08)', border: '1px solid rgba(210,74,58,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleReset}
                disabled={loading}
                style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: loading ? '#3a526a' : 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
