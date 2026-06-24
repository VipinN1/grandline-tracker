import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function BugReportModal({ session, onClose }) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const text = message.trim()
    if (!text) return setError('Please describe the bug first')
    setSubmitting(true)
    setError('')
    const { error: insErr } = await supabase.from('bug_reports').insert({
      message: text,
      user_id: session?.user?.id ?? null,
      username: session?.user?.user_metadata?.username ?? null,
      page: typeof window !== 'undefined' ? window.location.pathname : null,
    })
    setSubmitting(false)
    if (insErr) { setError('Could not submit: ' + insErr.message); return }
    setDone(true)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f0b1e', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, width: 440, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {done ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f2f5', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span> Thanks for the report!
            </div>
            <div style={{ fontSize: 13, color: '#7c6fa0', lineHeight: 1.5 }}>
              It's been sent to the team. We appreciate you helping make PirateTracker better.
            </div>
            <button onClick={onClose} style={{ marginTop: 4, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Close
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f2f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🐞</span> Report a Bug
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#7c6fa0', lineHeight: 1.5 }}>
              Found something broken or off? Describe what happened and we'll take a look.
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. The share card cuts off long leader names on mobile…"
              autoFocus
              style={{ width: '100%', minHeight: 120, resize: 'vertical', background: 'rgba(15,8,30,0.92)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '10px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
            {error && (
              <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 6, padding: '8px 10px' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !message.trim()}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: submitting || !message.trim() ? 'default' : 'pointer', fontFamily: 'inherit', opacity: submitting || !message.trim() ? 0.5 : 1 }}
              >
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
