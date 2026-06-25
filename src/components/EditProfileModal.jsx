import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EditProfileModal({ profile, session, onClose, onSave }) {
  const [usernameInput, setUsernameInput] = useState(profile?.username ?? '')
  const [bioInput, setBioInput] = useState(profile?.bio ?? '')
  const [pronounsInput, setPronounsInput] = useState(profile?.pronouns ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!usernameInput.trim()) return setError('Username cannot be empty')
    setSaving(true)
    const { error: err } = await supabase.from('profiles').update({ username: usernameInput.trim(), bio: bioInput.trim(), pronouns: pronounsInput.trim() }).eq('id', session.user.id)
    if (!err) await supabase.auth.updateUser({ data: { username: usernameInput.trim() } })
    setSaving(false)
    if (err) return setError('Failed to save. Please try again.')
    onSave({ username: usernameInput.trim(), bio: bioInput.trim(), pronouns: pronounsInput.trim() })
    onClose()
  }

  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9db2c6', marginBottom: 6, display: 'block' }
  const inputStyle = { width: '100%', background: 'rgba(140,176,208,0.03)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 8, padding: '9px 12px', color: '#e9f1f8', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e9f1f8', marginBottom: 4 }}>Edit Profile</div>
        <div style={{ fontSize: 12, color: '#9db2c6', marginBottom: 20 }}>Update your public profile information</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input autoFocus type="text" value={usernameInput} onChange={e => { setUsernameInput(e.target.value); setError('') }} onKeyDown={e => e.key === 'Escape' && onClose()} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Pronouns</label>
            <input type="text" placeholder="e.g. they/them" value={pronounsInput} onChange={e => setPronounsInput(e.target.value)} onKeyDown={e => e.key === 'Escape' && onClose()} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea value={bioInput} onChange={e => setBioInput(e.target.value)} placeholder="Tell people a bit about yourself..." style={{ ...inputStyle, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#d24a3a', marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: 'transparent', color: '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none', background: saving ? '#3a526a' : '#2f7da3', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}