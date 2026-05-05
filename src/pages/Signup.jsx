import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%',
  background: '#1c2333',
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
  color: '#6b7a99',
  marginBottom: 6,
  display: 'block',
}

export default function Signup({ onSwitch }) {
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
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f2f5', marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 13, color: '#6b7a99', marginBottom: 24 }}>We sent a confirmation link to <span style={{ color: '#f0f2f5' }}>{email}</span>. Click it to activate your account.</div>
          <button onClick={onSwitch} style={{ color: '#3d7fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f0f2f5', marginBottom: 6 }}>
            grand<span style={{ color: '#3d7fff' }}>line</span>
          </div>
          <div style={{ fontSize: 13, color: '#6b7a99' }}>Create your account</div>
        </div>

        <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="e.g. VipinPlays"
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
              <label style={labelStyle}>Location <span style={{ color: '#3a4560', fontWeight: 400 }}>(optional)</span></label>
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
              <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: loading ? '#2a4a8a' : '#3d7fff', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7a99' }}>
          Already have an account?{' '}
          <button onClick={onSwitch} style={{ color: '#3d7fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}