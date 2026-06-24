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
    return <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading…</div>
  }

  if (!authorized) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0' }}>Not authorized</div>
        <div style={{ fontSize: 13, color: '#3d2d6e', marginTop: 6 }}>This page is restricted.</div>
      </div>
    )
  }

  const shown = reports.filter(r => filter === 'all' ? true : (r.status ?? 'open') === filter)
  const openCount = reports.filter(r => (r.status ?? 'open') === 'open').length

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Admin</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>🐞 Bug Reports</div>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>{openCount} open · {reports.length} total</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['open', 'resolved', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', border: `1px solid ${filter === f ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`, background: filter === f ? 'rgba(139,92,246,0.12)' : 'transparent', color: filter === f ? '#a78bfa' : '#7c6fa0' }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0' }}>No {filter === 'all' ? '' : filter} reports</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(r => {
            const resolved = (r.status ?? 'open') === 'resolved'
            return (
              <div key={r.id} style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.4px', background: resolved ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)', color: resolved ? '#34d399' : '#f97316', border: `1px solid ${resolved ? 'rgba(52,211,153,0.3)' : 'rgba(249,115,22,0.3)'}` }}>
                    {resolved ? 'Resolved' : 'Open'}
                  </span>
                  {r.user_id ? (
                    <button onClick={() => navigate(`/profile/${r.user_id}`)} title="View profile" style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(167,139,250,0.4)', textUnderlineOffset: 2 }}>
                      {r.username ?? 'View profile'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#7c6fa0' }}>{r.username ?? 'Anonymous'}</span>
                  )}
                  {r.page && <span style={{ fontSize: 11, color: '#3d2d6e', fontFamily: 'monospace' }}>{r.page}</span>}
                  <span style={{ fontSize: 11, color: '#7c6fa0', marginLeft: 'auto' }}>{fmtDate(r.created_at)}</span>
                </div>
                <div style={{ fontSize: 14, color: '#f0f2f5', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.message}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setStatus(r.id, resolved ? 'open' : 'resolved')}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399' }}
                  >
                    {resolved ? 'Reopen' : 'Mark Resolved'}
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252' }}
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
