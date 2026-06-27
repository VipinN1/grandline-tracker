import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

function formatBounty(n) {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(2)}B`
  return `฿${n.toLocaleString()}`
}

function placementBonus(p) {
  if (p === 1) return 1_000_000
  if (p === 2) return 500_000
  if (p === 3) return 300_000
  if (p === 4) return 200_000
  if (p <= 8) return 100_000
  if (p <= 16) return 50_000
  return 0
}

function calcTournamentBounty(wins, losses, placement) {
  return Math.max(0, wins * 100_000 - losses * 50_000 + placementBonus(placement))
}

function rankDisplay(rank) {
  if (rank === 1) return { label: '🥇', color: '#dcb35e', bg: 'rgba(200,162,74,0.08)', border: '1px solid rgba(200,162,74,0.25)' }
  if (rank === 2) return { label: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.2)' }
  if (rank === 3) return { label: '🥉', color: '#fb923c', bg: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)' }
  return { label: `#${rank}`, color: '#67809a', bg: 'transparent', border: '1px solid transparent' }
}

function cleanName(name) {
  if (!name) return 'Unknown'
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

export default function BountyBoard({ session }) {
  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState([])
  const { isMobile } = useWindowSize()
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('id, user_id, name, date, placement, wins, losses, leader_id, leader_name, leader_color, profiles(username, avatar_url)')
        .eq('is_practice', false)
        .order('date', { ascending: false })
      setTournaments(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: '#9db2c6' }}>Loading bounty board...</div>
      </div>
    )
  }

  // ── Weekly meta ──────────────────────────────────────────────────────────────
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthAgoStr = monthAgo.toISOString().split('T')[0]
  const weeklyTournaments = tournaments.filter(t => t.date >= monthAgoStr)

  const playMap = {}
  weeklyTournaments.forEach(t => {
    if (!t.leader_id) return
    if (!playMap[t.leader_id]) playMap[t.leader_id] = { id: t.leader_id, name: t.leader_name, color: t.leader_color, count: 0 }
    playMap[t.leader_id].count++
  })
  const topWeekly = Object.values(playMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxWeeklyCount = topWeekly[0]?.count ?? 1

  // ── Leader win rates (min 3 appearances) ─────────────────────────────────────
  const winMap = {}
  tournaments.forEach(t => {
    if (!t.leader_id) return
    if (!winMap[t.leader_id]) winMap[t.leader_id] = { id: t.leader_id, name: t.leader_name, color: t.leader_color, wins: 0, total: 0, count: 0 }
    winMap[t.leader_id].wins += t.wins
    winMap[t.leader_id].total += t.wins + t.losses
    winMap[t.leader_id].count++
  })
  const topWinRate = Object.values(winMap)
    .filter(l => l.count >= 3 && l.total > 0)
    .map(l => ({ ...l, winRate: l.wins / l.total }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5)

  // ── Recent results ────────────────────────────────────────────────────────────
  const recentResults = tournaments.slice(0, 8)

  // ── Leaderboard ───────────────────────────────────────────────────────────────
  const playerMap = {}
  tournaments.forEach(t => {
    if (!t.user_id) return
    if (!playerMap[t.user_id]) {
      playerMap[t.user_id] = {
        user_id: t.user_id,
        username: t.profiles?.username ?? 'Unknown',
        avatar_url: t.profiles?.avatar_url ?? null,
        bounty: 0,
        wins: 0,
        losses: 0,
        tournaments: 0,
        leaders: {},
      }
    }
    const p = playerMap[t.user_id]
    p.bounty += calcTournamentBounty(t.wins, t.losses, t.placement)
    p.wins += t.wins
    p.losses += t.losses
    p.tournaments++
    if (t.leader_id) p.leaders[t.leader_id] = (p.leaders[t.leader_id] || 0) + 1
  })

  const leaderboard = Object.values(playerMap)
    .sort((a, b) => b.bounty - a.bounty)
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      topLeader: Object.entries(p.leaders).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))

  const myEntry = session ? leaderboard.find(p => p.user_id === session.user.id) : null

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#dcb35e', marginBottom: 4 }}>
          ☠ Bounty Board
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: isMobile ? 28 : 36, fontWeight: 600, color: '#e9f1f8', letterSpacing: '-0.5px', marginBottom: 8 }}>
          Wanted Dead or Alive
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9db2c6' }}>
            <span style={{ color: '#52a9cd', fontWeight: 700 }}>{leaderboard.length}</span> pirates tracked
          </span>
          <span style={{ fontSize: 12, color: '#9db2c6' }}>
            <span style={{ color: '#52a9cd', fontWeight: 700 }}>{tournaments.length}</span> tournaments logged
          </span>
          {myEntry && (
            <span style={{ fontSize: 12, color: '#9db2c6' }}>
              Your rank: <span style={{ color: '#dcb35e', fontWeight: 700 }}>#{myEntry.rank}</span>
              <span style={{ color: '#67809a', margin: '0 4px' }}>·</span>
              <span style={{ color: '#dcb35e', fontWeight: 700 }}>{formatBounty(myEntry.bounty)}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Bounty Formula Card ──────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(200,162,74,0.04)', border: '1px solid rgba(200,162,74,0.15)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 20, alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#dcb35e' }}>Bounty Formula</div>
        {[
          { label: 'Win', value: '+฿100,000' },
          { label: 'Loss', value: '−฿50,000', dim: true },
          { label: '1st Place', value: '+฿1,000,000', gold: true },
          { label: '2nd Place', value: '+฿500,000' },
          { label: 'Top 4', value: '+฿200–300K' },
          { label: 'Top 8', value: '+฿100,000' },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: '#67809a' }}>{f.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: f.gold ? '#dcb35e' : f.dim ? '#d24a3a' : '#3bb27e', fontFamily: 'monospace' }}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* ── Community Stats ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>

        {/* This Week's Meta */}
        <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#9db2c6', marginBottom: 14 }}>
            Meta — Last 30 Days
          </div>
          {topWeekly.length === 0 ? (
            <div style={{ fontSize: 12, color: '#67809a', textAlign: 'center', padding: '20px 0' }}>No activity in the last 30 days</div>
          ) : topWeekly.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <img
                src={getCardImageUrl(l.id)} alt={l.name}
                style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: `1px solid ${COLORS[l.color] ?? '#9db2c6'}44`, flexShrink: 0 }}
                onError={e => { e.target.style.opacity = '0.2' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cleanName(l.name)}
                </div>
                <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(140,176,208,0.05)' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${(l.count / maxWeeklyCount) * 100}%`, background: COLORS[l.color] ?? '#2f7da3' }} />
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS[l.color] ?? '#2f7da3', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>
                {l.count}
              </div>
            </div>
          ))}
        </div>

        {/* Leader Win Rates */}
        <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#9db2c6', marginBottom: 14 }}>
            Top Leaders by Win Rate
          </div>
          {topWinRate.length === 0 ? (
            <div style={{ fontSize: 12, color: '#67809a', textAlign: 'center', padding: '20px 0' }}>Not enough data yet<br /><span style={{ fontSize: 10 }}>Need 3+ tournaments per leader</span></div>
          ) : topWinRate.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#67809a', width: 14, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
              <img
                src={getCardImageUrl(l.id)} alt={l.name}
                style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: `1px solid ${COLORS[l.color] ?? '#9db2c6'}44`, flexShrink: 0 }}
                onError={e => { e.target.style.opacity = '0.2' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cleanName(l.name)}
                </div>
                <div style={{ fontSize: 10, color: '#9db2c6', marginTop: 1 }}>{l.count} events · {l.wins}W {l.total - l.wins}L</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#3bb27e', flexShrink: 0 }}>
                {Math.round(l.winRate * 100)}%
              </div>
            </div>
          ))}
        </div>

        {/* Recent Results */}
        <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#9db2c6', marginBottom: 14 }}>
            Recent Results
          </div>
          {recentResults.length === 0 ? (
            <div style={{ fontSize: 12, color: '#67809a', textAlign: 'center', padding: '20px 0' }}>No results yet</div>
          ) : recentResults.map(t => (
            <div
              key={t.id}
              onClick={() => navigate(`/profile/${t.user_id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', borderRadius: 7, padding: '4px 6px', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <img
                src={getCardImageUrl(t.leader_id)} alt={t.leader_name}
                style={{ width: 24, height: 33, objectFit: 'cover', objectPosition: 'top', borderRadius: 3, flexShrink: 0, border: `1px solid ${COLORS[t.leader_color] ?? '#9db2c6'}44` }}
                onError={e => { e.target.style.opacity = '0.2' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.profiles?.username ?? 'Unknown'}
                </div>
                <div style={{ fontSize: 10, color: '#9db2c6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                  <span style={{ color: '#3bb27e' }}>{t.wins}W</span>
                  <span style={{ color: '#67809a', margin: '0 1px' }}>·</span>
                  <span style={{ color: '#d24a3a' }}>{t.losses}L</span>
                </div>
                <div style={{ fontSize: 9, color: '#67809a', marginTop: 1 }}>
                  {t.placement === 1 ? '🥇 1st' : t.placement === 2 ? '🥈 2nd' : t.placement === 3 ? '🥉 3rd' : `${t.placement}th`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Leaderboard ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(140,176,208,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e9f1f8' }}>Bounty Rankings</div>
          <div style={{ fontSize: 11, color: '#67809a', fontFamily: 'monospace' }}>All-time</div>
        </div>

        {/* Column headers — desktop only */}
        {!isMobile && leaderboard.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px 100px 80px', gap: 16, padding: '8px 20px', borderBottom: '1px solid rgba(140,176,208,0.04)' }}>
            {['Rank', 'Player', 'Leader', 'Record', 'Bounty'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#67809a' }}>{h}</div>
            ))}
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#67809a' }}>No pirates found — log some tournaments!</div>
        ) : leaderboard.map(p => {
          const rd = rankDisplay(p.rank)
          const isMe = session?.user?.id === p.user_id
          const initials = p.username.slice(0, 2).toUpperCase()
          return (
            <div
              key={p.user_id}
              onClick={() => navigate(`/profile/${p.user_id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '36px 1fr auto' : '40px 1fr 40px 100px 80px',
                alignItems: 'center',
                gap: isMobile ? 10 : 16,
                padding: isMobile ? '12px 16px' : '13px 20px',
                borderBottom: '1px solid rgba(140,176,208,0.03)',
                cursor: 'pointer',
                background: isMe ? 'rgba(200,162,74,0.04)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isMe ? 'rgba(200,162,74,0.07)' : 'rgba(140,176,208,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = isMe ? 'rgba(200,162,74,0.04)' : 'transparent'}
            >
              {/* Rank */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: 8, background: rd.bg, border: rd.border, fontSize: p.rank <= 3 ? 16 : 12, fontWeight: 700, color: rd.color, fontFamily: p.rank > 3 ? 'monospace' : 'inherit', flexShrink: 0 }}>
                {rd.label}
              </div>

              {/* Player */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', border: isMe ? '2px solid #dcb35e' : '1.5px solid rgba(200,162,74,0.3)' }}>
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt={p.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: isMe ? '#dcb35e' : '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.username}
                    {isMe && <span style={{ fontSize: 9, background: 'rgba(200,162,74,0.15)', color: '#dcb35e', border: '1px solid rgba(200,162,74,0.3)', borderRadius: 4, padding: '1px 5px', fontWeight: 700, letterSpacing: '0.5px' }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#67809a', marginTop: 1 }}>
                    {p.tournaments} event{p.tournaments !== 1 ? 's' : ''}
                    {isMobile && <span style={{ marginLeft: 6, fontFamily: 'monospace' }}><span style={{ color: '#3bb27e' }}>{p.wins}W</span>·<span style={{ color: '#d24a3a' }}>{p.losses}L</span></span>}
                  </div>
                </div>
              </div>

              {/* Top leader — desktop */}
              {!isMobile && (
                <div>
                  {p.topLeader
                    ? <img src={getCardImageUrl(p.topLeader)} alt="" style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(140,176,208,0.07)' }} onError={e => { e.target.style.opacity = '0' }} />
                    : <div style={{ width: 28, height: 38 }} />}
                </div>
              )}

              {/* W/L — desktop */}
              {!isMobile && (
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#3bb27e' }}>{p.wins}W</span>
                  <span style={{ color: '#67809a', margin: '0 2px' }}>·</span>
                  <span style={{ color: '#d24a3a' }}>{p.losses}L</span>
                </div>
              )}

              {/* Bounty */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: '#dcb35e', fontFamily: 'monospace', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                  {formatBounty(p.bounty)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
