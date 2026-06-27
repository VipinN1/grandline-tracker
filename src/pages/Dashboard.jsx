import { useState, useEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import TournamentModal from '../components/TournamentModal'
import { colors, radius, shadow, font, eyebrow, pageHeader, btnPrimary } from '../theme'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// OPTCG card colors — semantic, harmonized with the nautical palette.
const COLORS = {
  Red: '#e05545',
  Blue: '#3f8fd6',
  Green: '#3bb27e',
  Purple: '#8d7ae6',
  Yellow: '#e6b84f',
  Black: '#94a3b8',
}
const FALLBACK = colors.ocean

const TOP_LEADERS_LIMIT = 3

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementStyle(n) {
  if (n === 1) return { background: 'rgba(220,179,94,0.14)', color: colors.gold, border: '1px solid rgba(200,162,74,0.34)' }
  if (n === 2) return { background: 'rgba(157,178,198,0.12)', color: '#b9c7d6', border: '1px solid rgba(157,178,198,0.26)' }
  if (n === 3) return { background: 'rgba(224,138,60,0.12)', color: colors.orange, border: '1px solid rgba(224,138,60,0.3)' }
  return { background: 'rgba(140,176,208,0.06)', color: colors.faint, border: `1px solid ${colors.line}` }
}

const tooltipStyle = {
  contentStyle: { background: colors.surface2, border: `1px solid ${colors.lineStrong}`, borderRadius: 8, fontSize: 12, color: colors.text },
  labelStyle: { color: colors.muted },
  cursor: { fill: 'rgba(140,176,208,0.06)' },
}

function ChartCard({ title, children, action }) {
  return (
    <div style={{ background: `linear-gradient(180deg, ${colors.surface}, ${colors.deep})`, border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: '18px 22px', boxShadow: shadow.md }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: colors.gold }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function CustomPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.08) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${Math.round(percent * 100)}%`}
    </text>
  )
}

function EmptyChart({ message }) {
  return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.faint, fontSize: 13 }}>
      {message}
    </div>
  )
}


function LeaderMini({ leaderId, color }) {
  const [errored, setErrored] = useState(false)
  return (
    <div style={{ width: 36, height: 50, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'rgba(140,176,208,0.05)', border: `1px solid ${colors.line}` }}>
      {!errored ? (
        <img src={getCardImageUrl(leaderId)} alt={leaderId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErrored(true)} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: (COLORS[color] ?? FALLBACK) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[color] ?? FALLBACK }} />
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ session }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [showAllLeaders, setShowAllLeaders] = useState(false)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    if (!session) return
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('*, decklists(*), tournament_rounds(*)')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
      setTournaments(data ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  // Practice (voided) games are excluded from every stat and chart on the dashboard.
  const ranked = tournaments.filter(t => !t.is_practice)
  const totalWins = ranked.reduce((s, t) => s + t.wins, 0)
  const totalLosses = ranked.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = ranked.filter(t => t.placement <= 8).length
  const bestFinish = ranked.length > 0 ? Math.min(...ranked.map(t => t.placement)) : null
  const totalEvents = ranked.length

  const placementOverTime = [...ranked].reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    placement: t.placement,
    name: t.name,
    players: t.player_count,
  }))

  const leaderUsage = Object.values(
    ranked.reduce((acc, t) => {
      if (!acc[t.leader_id]) {
        const primaryColor = (t.leader_color ?? '').split(/[\s/]+/).map(c => COLORS[c.trim()]).find(Boolean) ?? FALLBACK
        acc[t.leader_id] = { name: t.leader_name, fullName: t.leader_name, leaderColor: t.leader_color, color: primaryColor, count: 0, wins: 0, losses: 0 }
      }
      acc[t.leader_id].count++
      acc[t.leader_id].wins += t.wins
      acc[t.leader_id].losses += t.losses
      return acc
    }, {})
  ).map(l => ({ ...l, wr: l.wins + l.losses > 0 ? Math.round((l.wins / (l.wins + l.losses)) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  const colorUsage = Object.values(
    ranked.reduce((acc, t) => {
      if (!acc[t.leader_color]) acc[t.leader_color] = { name: t.leader_color, value: 0, color: COLORS[t.leader_color] ?? FALLBACK }
      acc[t.leader_color].value++
      return acc
    }, {})
  )

  const displayedLeaders = showAllLeaders ? leaderUsage : leaderUsage.slice(0, TOP_LEADERS_LIMIT)
  const recentResults = ranked.slice(0, 5)

  if (loading) {
    return (
      <div className="gl-page-enter">
        <div className="skeleton" style={{ height: 64, width: 240, borderRadius: radius.md, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: radius.md }} />)}
        </div>
        <div className="skeleton" style={{ height: 220, borderRadius: radius.md }} />
      </div>
    )
  }

  return (
    <div className="gl-page-enter">
      <div style={{ marginBottom: 28 }}>
        <div style={{ ...pageHeader(), fontSize: 30, marginBottom: 6 }}>Dashboard</div>
        <div style={{ fontSize: 14, color: colors.muted }}>Your competitive performance at a glance</div>
      </div>

      {/* Stat cards — 2×2 on mobile, 4×1 on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Win Rate', value: totalEvents > 0 ? `${winRate}%` : '—', sub: null },
          { label: 'Tournaments', value: totalEvents, sub: `${topEights} top 8` },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—', sub: null },
          { label: 'Record', value: totalEvents > 0 ? `${totalWins}–${totalLosses}` : '—', sub: null },
        ].map(s => (
          <div key={s.label} style={{ background: `linear-gradient(180deg, ${colors.surface}, ${colors.deep})`, border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: isMobile ? '14px 16px' : 18, boxShadow: shadow.md }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: colors.muted, marginBottom: 10 }}>{s.label}</div>
            <div style={s.label === 'Win Rate'
              ? { fontSize: isMobile ? 24 : 38, fontWeight: 700, fontFamily: font.mono, letterSpacing: '-1px', lineHeight: 1, color: colors.gold }
              : { fontSize: isMobile ? 22 : 30, fontWeight: 600, fontFamily: font.display, color: colors.text, letterSpacing: '-0.5px', lineHeight: 1 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: colors.faint, marginTop: 6 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {totalEvents === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.faint }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.7 }}>🧭</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: font.display, color: colors.textSoft, marginBottom: 6 }}>No data yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Log your first tournament to start seeing stats and charts</div>
          <a href="/log" style={{ fontSize: 13, fontWeight: 700, color: colors.gold, textDecoration: 'none' }}>→ Log a result</a>
        </div>
      ) : (
        <>
          {/* Charts row — 1 column on mobile, 2 on desktop */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <ChartCard title="Placement Trend">
              {placementOverTime.length < 2 ? <EmptyChart message="Need at least 2 events" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={placementOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(140,176,208,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} axisLine={false} tickLine={false} />
                    <YAxis reversed domain={[1, 'auto']} tick={{ fontSize: 11, fill: colors.muted }} axisLine={false} tickLine={false} tickFormatter={v => `#${v}`} />
                    <Tooltip
                      {...tooltipStyle}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ background: colors.surface2, border: `1px solid ${colors.lineStrong}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                            <div style={{ color: colors.muted, marginBottom: 4 }}>{d.date}</div>
                            <div style={{ color: colors.text, fontWeight: 600 }}>{placementLabel(d.placement)} of {d.players}</div>
                            <div style={{ color: colors.muted, marginTop: 2, fontSize: 11 }}>{d.name}</div>
                          </div>
                        )
                      }}
                    />
                    <Line type="monotone" dataKey="placement" stroke={colors.oceanBright} strokeWidth={2}
                      dot={({ cx, cy, payload }) => {
                        const c = payload.placement === 1 ? colors.gold : payload.placement <= 3 ? colors.orange : payload.placement <= 8 ? colors.ocean : colors.faint
                        return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={c} stroke="none" />
                      }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Leader Usage">
              {leaderUsage.length === 0 ? <EmptyChart message="No data yet" /> : (() => {
                const pl = leaderUsage.slice(0, 6)
                const pieTotal = pl.reduce((s, l) => s + l.count, 0)
                const CX = 70, CY = 70, R = 68, INNER = 40
                const R_MID = (INNER + R) / 2  // midpoint of donut ring
                // Recharts Pie: startAngle=0 → 3 o'clock, sweeps counter-clockwise
                let cumPct = 0
                const gradDefs = pl.map((l, i) => {
                  const pct = l.count / pieTotal
                  const f = cumPct + pct / 2
                  cumPct += pct
                  const cols = (l.leaderColor ?? '').split(/[\s/]+/).map(c => COLORS[c.trim()]).filter(Boolean)
                  if (cols.length < 2) return null
                  // Mid-angle in SVG coords (counter-clockwise from 3 o'clock)
                  const midRad = f * 2 * Math.PI
                  const cosA = Math.cos(midRad)
                  const sinA = Math.sin(midRad)
                  // Center gradient on the donut ring midpoint, sweep perpendicular to radial
                  const mx = CX + R_MID * cosA
                  const my = CY - R_MID * sinA   // SVG y is flipped
                  const x1 = +(mx - R * sinA).toFixed(2)
                  const y1 = +(my - R * cosA).toFixed(2)
                  const x2 = +(mx + R * sinA).toFixed(2)
                  const y2 = +(my + R * cosA).toFixed(2)
                  return (
                    <linearGradient key={i} id={`plg-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor={cols[0]} />
                      <stop offset="100%" stopColor={cols[1]} />
                    </linearGradient>
                  )
                })
                const getFill = (l, i) => {
                  const cols = (l.leaderColor ?? '').split(/[\s/]+/).map(c => COLORS[c.trim()]).filter(Boolean)
                  if (cols.length === 0) return FALLBACK
                  return cols.length > 1 ? `url(#plg-${i})` : cols[0]
                }
                const getDotBg = l => {
                  const cols = (l.leaderColor ?? '').split(/[\s/]+/).map(c => COLORS[c.trim()]).filter(Boolean)
                  if (cols.length === 0) return FALLBACK
                  return cols.length > 1 ? `linear-gradient(135deg, ${cols[0]}, ${cols[1]})` : cols[0]
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <PieChart width={150} height={150}>
                      <defs>{gradDefs}</defs>
                      <Pie data={pl} cx={CX} cy={CY} innerRadius={40} outerRadius={R} paddingAngle={3} dataKey="count" labelLine={false} label={<CustomPieLabel />}>
                        {pl.map((entry, i) => <Cell key={i} fill={getFill(entry, i)} />)}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v} events (${Math.round(v / pieTotal * 100)}%)`, p.payload.fullName.replace(/\s*\([^)]*\)$/, '').trim()]} />
                    </PieChart>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {pl.map((l, i) => (
                        <div key={l.fullName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: getDotBg(l), flexShrink: 0 }} />
                          <div style={{ fontSize: 12, color: colors.text, fontWeight: 600, flex: 1 }}>{l.fullName.replace(/\s*\([^)]*\)$/, '').trim()}</div>
                          <div style={{ fontSize: 12, color: colors.muted }}>{l.count}</div>
                          <div style={{ fontSize: 11, color: colors.faint, minWidth: 34, textAlign: 'right' }}>{Math.round(l.count / pieTotal * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </ChartCard>
          </div>

          {/* Win rate by leader */}
          <div style={{ marginBottom: 20 }}>
            <ChartCard
              title="Win Rate by Leader"
              action={leaderUsage.length > TOP_LEADERS_LIMIT ? (
                <button onClick={() => setShowAllLeaders(!showAllLeaders)} style={{ fontSize: 11, fontWeight: 600, color: colors.gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  {showAllLeaders ? '▲ Show less' : `▼ Show all (${leaderUsage.length})`}
                </button>
              ) : null}
            >
              {leaderUsage.length === 0 ? <EmptyChart message="No data yet" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayedLeaders.map(l => (
                    <div key={l.fullName}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.text }}>{l.fullName}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ fontSize: 11, color: colors.faint }}>{l.count} events</div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: font.mono, color: l.color, minWidth: 36, textAlign: 'right' }}>{l.wr}%</div>
                        </div>
                      </div>
                      <div style={{ height: 7, background: 'rgba(140,176,208,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${l.wr}%`, background: `linear-gradient(90deg, ${colors.teal}, ${colors.oceanBright})`, borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Recent results */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.gold, textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Results</div>
            <a href="/log" className="gl-btn" style={{ ...btnPrimary, fontSize: 12, padding: '8px 16px', textDecoration: 'none', display: 'inline-block' }}>
              + Log Result
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {recentResults.map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedTournament(r)}
                style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: isMobile ? '11px 13px' : '13px 18px', display: 'grid', gridTemplateColumns: isMobile ? '36px 1fr auto' : '46px 1fr auto auto', alignItems: 'center', gap: isMobile ? 10 : 16, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.goldLine; e.currentTarget.style.background = colors.surface2 }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.line; e.currentTarget.style.background = colors.surface }}
              >
                <div style={{ width: isMobile ? 32 : 38, height: isMobile ? 32 : 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 11 : 13, fontWeight: 700, flexShrink: 0, ...placementStyle(r.placement) }}>
                  {placementLabel(r.placement)}
                </div>
                <div>
                  <div style={{ fontSize: isMobile ? 13 : 14.5, fontWeight: 600, color: colors.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{r.date} · {r.player_count} players{!isMobile && r.location ? ` · ${r.location}` : ''}</div>
                </div>
                {!isMobile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(140,176,208,0.05)', border: `1px solid ${colors.line}`, borderRadius: 8, padding: '6px 12px 6px 8px' }}>
                    <LeaderMini leaderId={r.leader_id} color={r.leader_color} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{r.leader_name}</div>
                      <div style={{ fontSize: 11, color: COLORS[r.leader_color] ?? colors.muted }}>{r.leader_color} · {r.leader_id}</div>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: font.mono }}>
                  <span style={{ color: colors.emerald }}>{r.wins}W</span>
                  <span style={{ color: colors.faint, margin: '0 3px' }}>·</span>
                  <span style={{ color: colors.crimson }}>{r.losses}L</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedTournament && (
        <TournamentModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} isMobile={isMobile} onDelete={false} />
      )}
    </div>
  )
}
