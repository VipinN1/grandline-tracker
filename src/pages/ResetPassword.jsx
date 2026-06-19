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
    <div style={{ minHeight: '100vh', background: '#0c0814', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f0f2f5', marginBottom: 6 }}>
            Pirate<span style={{ color: '#8b5cf6' }}>Tracker</span>
          </div>
          <div style={{ fontSize: 13, color: '#7c6fa0' }}>Choose a new password</div>
        </div>

        <div style={{ background: 'rgba(20,12,36,0.9)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 14, padding: 28 }}>
          {success ? (
            <div style={{ textAlign: 'center', fontSize: 14, color: '#a78bfa' }}>
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
                <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleReset}
                disabled={loading}
                style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: loading ? '#5b21b6' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}
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
