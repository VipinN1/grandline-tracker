import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import { colors, status as statusTokens, radius, shadow, font, eyebrow, pageHeader, input as INPUT, label as LABEL, btnPrimary, btnGhost, badge } from '../theme'

function statusInfo(status, deadline) {
  if (status === 'completed') return { label: 'Completed', ...statusTokens.completed }
  if (status === 'active') return { label: 'In Progress', ...statusTokens.active }
  if (deadline && new Date() > new Date(deadline)) return { label: 'Reg. Closed', ...statusTokens.closed }
  return { label: 'Registration Open', ...statusTokens.open }
}

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
      // datetime-local gives a naive local string; convert to a UTC instant so
      // it isn't misread as UTC by Postgres (which shifted the displayed time).
      registration_deadline: new Date(form.registration_deadline).toISOString(),
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
    <div className="gl-page-enter">
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 8 }}>⚓ The Grand Line</div>
          <div style={{ ...pageHeader(), fontSize: 30, marginBottom: 6 }}>Tournaments</div>
          <div style={{ fontSize: 14, color: colors.muted }}>Online sim tournaments run on Discord</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="gl-btn" style={btnPrimary}>
            + Create Tournament
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 104, borderRadius: radius.lg }} />)}
        </div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.7 }}>🏝️</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: font.display, color: colors.textSoft, marginBottom: 6 }}>No islands charted yet</div>
          <div style={{ fontSize: 13, color: colors.faint }}>Check back soon for upcoming events</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tournaments.map(t => {
            const { label, color, fill, line } = statusInfo(t.status, t.registration_deadline)
            const count = t.sim_tournament_players?.length ?? 0
            const deadlinePast = t.registration_deadline && new Date() > new Date(t.registration_deadline)
            const major = t.status === 'active' || t.status === 'completed'
            return (
              <div
                key={t.id}
                className="gl-lift"
                onClick={() => navigate(`/tournaments/${t.id}`)}
                style={{
                  position: 'relative',
                  background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
                  border: `1px solid ${colors.line}`,
                  borderRadius: radius.lg,
                  padding: isMobile ? '16px 18px 16px 20px' : '22px 26px 22px 28px',
                  cursor: 'pointer',
                  boxShadow: shadow.md,
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.goldLine; e.currentTarget.style.boxShadow = shadow.hover }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.line; e.currentTarget.style.boxShadow = shadow.md }}
              >
                {/* Left accent rail — gold for major events, ocean otherwise */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: major ? `linear-gradient(180deg, ${colors.gold}, ${colors.brass})` : colors.oceanDeep }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: font.display, fontSize: isMobile ? 17 : 20, fontWeight: 600, color: colors.text, letterSpacing: '-0.2px' }}>{t.name}</div>
                      <span style={badge({ color, fill, line })}>{label}</span>
                    </div>
                    {t.description && <div style={{ fontSize: 13.5, color: colors.muted, marginBottom: 12, lineHeight: 1.55 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: colors.muted, fontWeight: 500 }}>👥 {count} player{count !== 1 ? 's' : ''}</span>
                      {t.registration_deadline && (
                        <span style={{ fontSize: 12.5, color: deadlinePast ? colors.orange : colors.muted, fontWeight: 500 }}>
                          ⏰ {deadlinePast ? 'Closed' : 'Deadline:'} {new Date(t.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {t.discord_link && <span style={{ fontSize: 12.5, color: colors.muted, fontWeight: 500 }}>💬 Discord linked</span>}
                      {t.status === 'active' && <span style={{ fontSize: 12.5, color: colors.emerald, fontWeight: 600 }}>Round {t.current_round}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: colors.gold, fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center', flexShrink: 0 }}>View →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,14,0.78)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: `linear-gradient(180deg, ${colors.surface}, ${colors.deep})`, border: `1px solid ${colors.lineStrong}`, borderRadius: isMobile ? '18px 18px 0 0' : radius.lg, width: isMobile ? '100%' : 480, padding: 26, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: shadow.lg, animation: isMobile ? 'slideUp 0.25s ease-out' : 'fadeInUp 0.2s ease-out' }}>
            <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 600, color: colors.text }}>Create Tournament</div>
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
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowCreate(false)} className="gl-btn" style={{ ...btnGhost, flex: 1 }}>Cancel</button>
              <button
                onClick={create}
                disabled={creating || !form.name.trim() || !form.registration_deadline}
                className="gl-btn"
                style={{ ...btnPrimary, flex: 1, opacity: creating || !form.name.trim() || !form.registration_deadline ? 0.5 : 1 }}
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
