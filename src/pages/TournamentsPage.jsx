import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

function statusInfo(status, deadline) {
  if (status === 'completed') return { label: 'Completed', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
  if (status === 'active') return { label: 'In Progress', color: '#34d399', bg: 'rgba(52,211,153,0.1)' }
  if (deadline && new Date() > new Date(deadline)) return { label: 'Reg. Closed', color: '#f97316', bg: 'rgba(249,115,22,0.1)' }
  return { label: 'Registration Open', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' }
}

const INPUT = { width: '100%', background: 'rgba(15,8,30,0.92)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark' }
const LABEL = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#7c6fa0', marginBottom: 5, display: 'block' }

export default function TournamentsPage({ session }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', discord_link: '', registration_deadline: '' })
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  useEffect(() => {
    load()
    if (session) checkAdmin()
  }, [session])

  async function checkAdmin() {
    const { data } = await supabase.from('profiles').select('username').eq('id', session.user.id).single()
    if (data?.username === 'Cipin') setIsAdmin(true)
  }

  async function load() {
    const { data } = await supabase
      .from('sim_tournaments')
      .select('*, sim_tournament_players(id)')
      .order('created_at', { ascending: false })
    setTournaments(data ?? [])
    setLoading(false)
  }

  async function create() {
    if (!form.name.trim() || !form.registration_deadline) return
    setCreating(true)
    const { error } = await supabase.from('sim_tournaments').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      discord_link: form.discord_link.trim() || null,
      registration_deadline: form.registration_deadline,
      created_by: session.user.id,
    })
    if (!error) {
      setForm({ name: '', description: '', discord_link: '', registration_deadline: '' })
      setShowCreate(false)
      load()
    }
    setCreating(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Community</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Tournaments</div>
          <div style={{ fontSize: 13, color: '#7c6fa0' }}>Online sim tournaments run on Discord</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            + Create Tournament
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading...</div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>No tournaments yet</div>
          <div style={{ fontSize: 13, color: '#3d2d6e' }}>Check back soon for upcoming events</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tournaments.map(t => {
            const { label, color, bg } = statusInfo(t.status, t.registration_deadline)
            const count = t.sim_tournament_players?.length ?? 0
            const deadlinePast = t.registration_deadline && new Date() > new Date(t.registration_deadline)
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/tournaments/${t.id}`)}
                style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: isMobile ? '14px 16px' : '20px 24px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#f0f2f5' }}>{t.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, border: `1px solid ${color}44` }}>{label}</span>
                    </div>
                    {t.description && <div style={{ fontSize: 13, color: '#8a9bb0', marginBottom: 8, lineHeight: 1.5 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#7c6fa0' }}>👥 {count} player{count !== 1 ? 's' : ''}</span>
                      {t.registration_deadline && (
                        <span style={{ fontSize: 12, color: deadlinePast ? '#f97316' : '#7c6fa0' }}>
                          ⏰ {deadlinePast ? 'Closed' : 'Deadline:'} {new Date(t.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {t.discord_link && <span style={{ fontSize: 12, color: '#7c6fa0' }}>💬 Discord linked</span>}
                      {t.status === 'active' && <span style={{ fontSize: 12, color: '#34d399' }}>Round {t.current_round}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#7c6fa0', whiteSpace: 'nowrap', alignSelf: 'center', flexShrink: 0 }}>View →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0b1e', border: '1px solid rgba(139,92,246,0.25)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f2f5' }}>Create Tournament</div>
            <div>
              <label style={LABEL}>Tournament Name *</label>
              <input style={INPUT} placeholder="e.g. GrandLine Open #1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={LABEL}>Description</label>
              <input style={INPUT} placeholder="Brief description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label style={LABEL}>Discord Link</label>
              <input style={INPUT} placeholder="https://discord.gg/..." value={form.discord_link} onChange={e => setForm(p => ({ ...p, discord_link: e.target.value }))} />
            </div>
            <div>
              <label style={LABEL}>Registration Deadline *</label>
              <input type="datetime-local" style={INPUT} value={form.registration_deadline} onChange={e => setForm(p => ({ ...p, registration_deadline: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button
                onClick={create}
                disabled={creating || !form.name.trim() || !form.registration_deadline}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: creating || !form.name.trim() || !form.registration_deadline ? 0.5 : 1 }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
