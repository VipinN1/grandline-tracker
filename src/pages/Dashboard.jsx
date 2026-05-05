import { useState, useEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

const COLORS = {
  Red: '#f05252',
  Blue: '#3d7fff',
  Green: '#34d399',
  Purple: '#a78bfa',
  Yellow: '#fbbf24',
  Black: '#94a3b8',
}

const TOP_LEADERS_LIMIT = 3

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementStyle(n) {
  if (n === 1) return { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }
  if (n === 2) return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
  if (n === 3) return { background: 'rgba(251,146,60,0.1)', color: '#fb923c' }
  return { background: 'rgba(255,255,255,0.04)', color: '#3a4560' }
}

const tooltipStyle = {
  contentStyle: { background: '#1c2333', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#f0f2f5' },
  labelStyle: { color: '#6b7a99' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

function ChartCard({ title, children, action }) {
  return (
    <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b7a99' }}>{title}</div>
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
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a4560', fontSize: 13 }}>
      {message}
    </div>
  )
}

function CardPreview({ card, onClose }) {
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 300, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 3, fontFamily: 'monospace' }}>{card.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f2f5', fontSize: 13, fontWeight: 600, padding: '7px 24px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  )
}

function TournamentDeckModal({ tournament, onClose }) {
  const [selectedCard, setSelectedCard] = useState(null)
  if (!tournament) return null
  const color = COLORS[tournament.leader_color] ?? '#3d7fff'
  const cards = tournament.decklists?.cards ?? []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', height: 120, background: '#1c2333', flexShrink: 0 }}>
            <img src={getCardImageUrl(tournament.leader_id)} alt={tournament.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, #161b27 100%)' }} />
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ position: 'absolute', bottom: 14, left: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{tournament.deck_name ?? 'Untitled Deck'}</div>
              <div style={{ fontSize: 12, color: '#6b7a99' }}>{tournament.leader_name} · {tournament.leader_id}</div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
          </div>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, ...placementStyle(tournament.placement) }}>
              {placementLabel(tournament.placement)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{tournament.name}</div>
              <div style={{ fontSize: 11, color: '#6b7a99' }}>{tournament.date} · {tournament.player_count} players</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
              <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
              <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: 20 }}>
            {cards.length > 0 ? (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
                  Decklist — {cards.reduce((s, c) => s + c.count, 0)} cards · click to enlarge
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
                  {cards.flatMap(card =>
                    Array.from({ length: card.count }, (_, i) => (
                      <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 6, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 72, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
                      </div>
                    ))
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Card List</div>
                {cards.map(card => (
                  <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#3d7fff', fontFamily: 'monospace', minWidth: 20 }}>{card.count}×</span>
                      <span style={{ fontSize: 13, color: '#f0f2f5' }}>{card.name ?? card.id}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#3a4560', fontFamily: 'monospace' }}>{card.id}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#3a4560', textAlign: 'center', padding: '20px 0' }}>No decklist attached.</div>
            )}
          </div>
        </div>
      </div>
      {selectedCard && <CardPreview card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </>
  )
}

function LeaderMini({ leaderId, color }) {
  const [errored, setErrored] = useState(false)
  return (
    <div style={{ width: 36, height: 50, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)' }}>
      {!errored ? (
        <img src={getCardImageUrl(leaderId)} alt={leaderId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErrored(true)} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: (COLORS[color] ?? '#3d7fff') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[color] ?? '#3d7fff' }} />
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

  useEffect(() => {
    if (!session) return
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('*, decklists(*)')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
      setTournaments(data ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
  const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = tournaments.filter(t => t.placement <= 8).length
  const bestFinish = tournaments.length > 0 ? Math.min(...tournaments.map(t => t.placement)) : null
  const totalEvents = tournaments.length

  const placementOverTime = [...tournaments].reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    placement: t.placement,
    name: t.name,
    players: t.player_count,
  }))

  const leaderUsage = Object.values(
    tournaments.reduce((acc, t) => {
      if (!acc[t.leader_id]) acc[t.leader_id] = { name: t.leader_name, fullName: t.leader_name, color: COLORS[t.leader_color] ?? '#3d7fff', count: 0, wins: 0, losses: 0 }
      acc[t.leader_id].count++
      acc[t.leader_id].wins += t.wins
      acc[t.leader_id].losses += t.losses
      return acc
    }, {})
  ).map(l => ({ ...l, wr: l.wins + l.losses > 0 ? Math.round((l.wins / (l.wins + l.losses)) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  const colorUsage = Object.values(
    tournaments.reduce((acc, t) => {
      if (!acc[t.leader_color]) acc[t.leader_color] = { name: t.leader_color, value: 0, color: COLORS[t.leader_color] ?? '#3d7fff' }
      acc[t.leader_color].value++
      return acc
    }, {})
  )

  const displayedLeaders = showAllLeaders ? leaderUsage : leaderUsage.slice(0, TOP_LEADERS_LIMIT)

  const recentResults = tournaments.slice(0, 5)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Overview</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Dashboard</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Your competitive performance at a glance</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Win Rate', value: totalEvents > 0 ? `${winRate}%` : '—', sub: null },
          { label: 'Tournaments', value: totalEvents, sub: `${topEights} top 8 finishes` },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—', sub: null },
          { label: 'Record', value: totalEvents > 0 ? `${totalWins}–${totalLosses}` : '—', sub: null },
        ].map(s => (
          <div key={s.label} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b7a99', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: '#3a4560', marginTop: 5 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {totalEvents === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4560' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No data yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Log your first tournament to start seeing stats and charts</div>
          <a href="/log" style={{ fontSize: 13, fontWeight: 600, color: '#3d7fff', textDecoration: 'none' }}>→ Log a result</a>
        </div>
      ) : (
        <>
          {/* Charts row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <ChartCard title="Placement Trend">
              {placementOverTime.length < 2 ? <EmptyChart message="Need at least 2 events" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={placementOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7a99' }} axisLine={false} tickLine={false} />
                    <YAxis reversed domain={[1, 'auto']} tick={{ fontSize: 11, fill: '#6b7a99' }} axisLine={false} tickLine={false} tickFormatter={v => `#${v}`} />
                    <Tooltip
                      {...tooltipStyle}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ background: '#1c2333', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                            <div style={{ color: '#6b7a99', marginBottom: 4 }}>{d.date}</div>
                            <div style={{ color: '#f0f2f5', fontWeight: 600 }}>{placementLabel(d.placement)} of {d.players}</div>
                            <div style={{ color: '#6b7a99', marginTop: 2, fontSize: 11 }}>{d.name}</div>
                          </div>
                        )
                      }}
                    />
                    <Line type="monotone" dataKey="placement" stroke="#34d399" strokeWidth={2}
                      dot={({ cx, cy, payload }) => {
                        const c = payload.placement === 1 ? '#fbbf24' : payload.placement <= 3 ? '#fb923c' : payload.placement <= 8 ? '#3d7fff' : '#3a4560'
                        return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={c} stroke="none" />
                      }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Color Usage">
              {colorUsage.length === 0 ? <EmptyChart message="No data yet" /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <PieChart width={150} height={150}>
                    <Pie data={colorUsage} cx={70} cy={70} innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value" labelLine={false} label={<CustomPieLabel />}>
                      {colorUsage.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v} events (${Math.round(v / totalEvents * 100)}%)`, p.payload.name]} />
                  </PieChart>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {colorUsage.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: '#f0f2f5', fontWeight: 600, flex: 1 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7a99' }}>{c.value}</div>
                        <div style={{ fontSize: 11, color: '#3a4560', minWidth: 34, textAlign: 'right' }}>{Math.round(c.value / totalEvents * 100)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Win rate by leader */}
          <div style={{ marginBottom: 20 }}>
            <ChartCard
              title="Win Rate by Leader"
              action={leaderUsage.length > TOP_LEADERS_LIMIT ? (
                <button onClick={() => setShowAllLeaders(!showAllLeaders)} style={{ fontSize: 11, fontWeight: 600, color: '#3d7fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  {showAllLeaders ? '▲ Show less' : `▼ Show all (${leaderUsage.length})`}
                </button>
              ) : null}
            >
              {leaderUsage.length === 0 ? <EmptyChart message="No data yet" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {displayedLeaders.map(l => (
                    <div key={l.fullName}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f2f5' }}>{l.fullName}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ fontSize: 11, color: '#3a4560' }}>{l.count} events</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: l.color, minWidth: 36, textAlign: 'right' }}>{l.wr}%</div>
                        </div>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${l.wr}%`, background: l.color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Recent results */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Recent Results</div>
            <a href="/log" style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#3d7fff', color: '#fff', fontFamily: 'inherit', textDecoration: 'none' }}>
              + Log Result
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentResults.map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedTournament(r)}
                style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', display: 'grid', gridTemplateColumns: '44px 1fr auto auto', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = '#1c2333' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = '#161b27' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, ...placementStyle(r.placement) }}>
                  {placementLabel(r.placement)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f2f5' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 1 }}>{r.date} · {r.player_count} players · {r.location}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px 6px 8px' }}>
                  <LeaderMini leaderId={r.leader_id} color={r.leader_color} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f2f5' }}>{r.leader_name}</div>
                    <div style={{ fontSize: 11, color: COLORS[r.leader_color] ?? '#6b7a99' }}>{r.leader_color} · {r.leader_id}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                  <span style={{ color: '#34d399' }}>{r.wins}W</span>
                  <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
                  <span style={{ color: '#f05252' }}>{r.losses}L</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedTournament && (
        <TournamentDeckModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} />
      )}
    </div>
  )
}