import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

export default function BugReports({ session }) {
  const navigate = useNavigate()
  const [authorized, setAuthorized] = useState(null) // null = checking
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!session) { setAuthorized(false); setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single()
      const isAdmin = profile?.username === 'Cipin'
      if (cancelled) return
      setAuthorized(isAdmin)
      if (!isAdmin) { setLoading(false); return }
      const { data } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false })
      if (cancelled) return
      setReports(data ?? [])
      setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [session])

  async function setStatus(id, status) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    await supabase.from('bug_reports').update({ status }).eq('id', id)
  }

  async function remove(id) {
    setReports(prev => prev.filter(r => r.id !== id))
    await supabase.from('bug_reports').delete().eq('id', id)
  }

  if (authorized === null) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#9db2c6', fontSize: 13 }}>Loading…</div>
  }

  if (!authorized) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#9db2c6' }}>Not authorized</div>
        <div style={{ fontSize: 13, color: '#67809a', marginTop: 6 }}>This page is restricted.</div>
      </div>
    )
  }

  const shown = reports.filter(r => filter === 'all' ? true : (r.status ?? 'open') === filter)
  const openCount = reports.filter(r => (r.status ?? 'open') === 'open').length

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#dcb35e', marginBottom: 4 }}>Admin</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, color: '#e9f1f8', letterSpacing: '-0.3px', marginBottom: 2 }}>🐞 Bug Reports</div>
        <div style={{ fontSize: 13, color: '#9db2c6' }}>{openCount} open · {reports.length} total</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['open', 'resolved', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', border: `1px solid ${filter === f ? 'rgba(200,162,74,0.4)' : 'rgba(140,176,208,0.08)'}`, background: filter === f ? 'rgba(140,176,208,0.12)' : 'transparent', color: filter === f ? '#52a9cd' : '#9db2c6' }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9db2c6', fontSize: 13 }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#9db2c6' }}>No {filter === 'all' ? '' : filter} reports</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(r => {
            const resolved = (r.status ?? 'open') === 'resolved'
            return (
              <div key={r.id} style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.4px', background: resolved ? 'rgba(59,178,126,0.12)' : 'rgba(224,138,60,0.12)', color: resolved ? '#3bb27e' : '#e08a3c', border: `1px solid ${resolved ? 'rgba(59,178,126,0.3)' : 'rgba(224,138,60,0.3)'}` }}>
                    {resolved ? 'Resolved' : 'Open'}
                  </span>
                  {r.user_id ? (
                    <button onClick={() => navigate(`/profile/${r.user_id}`)} title="View profile" style={{ fontSize: 12, fontWeight: 600, color: '#52a9cd', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(82,169,205,0.4)', textUnderlineOffset: 2 }}>
                      {r.username ?? 'View profile'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#9db2c6' }}>{r.username ?? 'Anonymous'}</span>
                  )}
                  {r.page && <span style={{ fontSize: 11, color: '#67809a', fontFamily: 'monospace' }}>{r.page}</span>}
                  <span style={{ fontSize: 11, color: '#9db2c6', marginLeft: 'auto' }}>{fmtDate(r.created_at)}</span>
                </div>
                <div style={{ fontSize: 14, color: '#e9f1f8', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.message}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setStatus(r.id, resolved ? 'open' : 'resolved')}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(59,178,126,0.3)', background: 'rgba(59,178,126,0.08)', color: '#3bb27e' }}
                  >
                    {resolved ? 'Reopen' : 'Mark Resolved'}
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(210,74,58,0.3)', background: 'rgba(210,74,58,0.08)', color: '#d24a3a' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
