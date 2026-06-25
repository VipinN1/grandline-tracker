import { forwardRef } from 'react'

function proxyCardImageUrl(id) {
  if (!id) return ''
  return `/api/card-image?id=${encodeURIComponent(id)}`
}

const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

function cleanName(name) {
  if (!name) return ''
  return name
    .replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '')
    .replace(/\s*\([^)]*\)$/, '')
    .trim()
}

function pLabel(n) { if (n===1) return '1st'; if (n===2) return '2nd'; if (n===3) return '3rd'; return `${n}th` }

function pBadge(n) {
  if (n===1) return { background: 'rgba(200,162,74,0.22)', color: '#dcb35e', border: '1px solid rgba(200,162,74,0.5)' }
  if (n===2) return { background: 'rgba(148,163,184,0.18)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.4)' }
  if (n===3) return { background: 'rgba(251,146,60,0.18)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }
  return { background: 'rgba(140,176,208,0.08)', color: '#9db2c6', border: '1px solid rgba(140,176,208,0.12)' }
}

const TournamentShareCard = forwardRef(function TournamentShareCard({ tournament }, ref) {
  if (!tournament) return null

  const color = COLORS[tournament.leader_color] ?? '#2f7da3'
  const rounds = (tournament.tournament_rounds ?? []).sort((a, b) => a.round_number - b.round_number)

  const wentFirstWins = rounds.filter(r => r.went_first === true && r.result === 'win').length
  const wentFirstTotal = rounds.filter(r => r.went_first === true).length
  const wentSecondWins = rounds.filter(r => r.went_first === false && r.result === 'win').length
  const wentSecondTotal = rounds.filter(r => r.went_first === false).length
  const diceWins = rounds.filter(r => r.won_dice_roll === true && r.result === 'win').length
  const diceWon = rounds.filter(r => r.won_dice_roll === true).length
  const winRate = tournament.wins + tournament.losses > 0
    ? Math.round(tournament.wins / (tournament.wins + tournament.losses) * 100) : 0

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: '560px',
        background:
          'radial-gradient(ellipse 320px 280px at 0% 0%, rgba(47,125,163,0.35) 0%, transparent 60%),' +
          'radial-gradient(ellipse 220px 180px at 100% 100%, rgba(200,162,74,0.22) 0%, transparent 65%),' +
          '#06101b',
        border: '1px solid rgba(200,162,74,0.3)',
        borderRadius: '20px',
        padding: '28px',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        color: '#e9f1f8',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#52a9cd', textTransform: 'uppercase', marginBottom: 7, fontWeight: 600 }}>
          Tournament Result
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 5 }}>
          {tournament.name}
        </div>
        <div style={{ fontSize: 12, color: '#9db2c6' }}>
          {tournament.date} · {tournament.player_count} players
        </div>
      </div>

      {/* 2. Hero: Leader card portrait + result info side-by-side */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 20, alignItems: 'flex-start' }}>
        {/* Leader card — shown as a proper portrait card */}
        <div style={{
          flexShrink: 0,
          width: 152,
          borderRadius: 10,
          overflow: 'hidden',
          border: `2px solid ${color}88`,
          boxShadow: `0 0 24px ${color}44, 0 8px 24px rgba(0,0,0,0.5)`,
        }}>
          <img
            crossOrigin="anonymous"
            src={proxyCardImageUrl(tournament.leader_id)}
            alt={tournament.leader_name}
            style={{ width: '100%', aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
          />
        </div>

        {/* Result panel */}
        <div style={{ flex: 1, paddingTop: 2 }}>
          {/* Placement badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 14px', borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 14, ...pBadge(tournament.placement) }}>
            {pLabel(tournament.placement)} Place
          </div>

          {/* W/L record */}
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: '"Space Mono", "Courier New", monospace', lineHeight: 1, marginBottom: 6 }}>
            <span style={{ color: '#3bb27e' }}>{tournament.wins}W</span>
            <span style={{ color: '#3a3560', margin: '0 8px', fontSize: 36 }}>—</span>
            <span style={{ color: '#d24a3a' }}>{tournament.losses}L</span>
          </div>
          <div style={{ fontSize: 13, color: '#9db2c6', marginBottom: 18 }}>{winRate}% win rate</div>

          {/* Leader name + color pill */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8', marginBottom: 5, lineHeight: 1.3 }}>
            {cleanName(tournament.leader_name)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#5f7589', fontFamily: 'monospace' }}>{tournament.leader_id}</span>
            {tournament.leader_color && (
              <span style={{
                fontSize: 10, padding: '2px 9px', borderRadius: 10,
                background: color + '28', color, border: `1px solid ${color}55`, fontWeight: 600
              }}>
                {tournament.leader_color}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Stats row */}
      {rounds.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { label: '1st Win Rate', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal} games` },
            { label: '2nd Win Rate', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal} games` },
            { label: 'Dice Win Rate', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon} won` },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(140,176,208,0.04)', borderRadius: 10, padding: '11px 12px', textAlign: 'center', border: '1px solid rgba(140,176,208,0.06)' }}>
              <div style={{ fontSize: 9, color: '#5f7589', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#52a9cd', fontFamily: '"Space Mono", "Courier New", monospace' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#5f7589', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Round by round — single column, no cutoff risk */}
      {rounds.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#5f7589', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
            Round by Round
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rounds.map(r => {
              const oppColor = COLORS[r.opponent_leader_color] ?? '#94a3b8'
              const oppName = cleanName(r.opponent_leader_name) || 'Unknown'
              const isWin = r.result === 'win'
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isWin ? 'rgba(59,178,126,0.04)' : 'rgba(210,74,58,0.04)',
                    borderRadius: 10, padding: '10px 14px',
                    border: `1px solid ${isWin ? 'rgba(59,178,126,0.15)' : 'rgba(210,74,58,0.12)'}`,
                  }}
                >
                  {/* Round number */}
                  <div style={{ fontSize: 11, color: '#9db2c6', fontWeight: 700, width: 26, flexShrink: 0, fontFamily: 'monospace', alignSelf: 'flex-start', paddingTop: 4 }}>
                    R{r.round_number}
                  </div>

                  {/* Opponent leader card — large */}
                  {r.opponent_leader_id ? (
                    <img
                      crossOrigin="anonymous"
                      src={proxyCardImageUrl(r.opponent_leader_id)}
                      alt={r.opponent_leader_name ?? ''}
                      style={{ width: 90, height: 126, objectFit: 'cover', objectPosition: 'top center', borderRadius: 7, flexShrink: 0, display: 'block', border: `2px solid ${oppColor}66`, boxShadow: `0 4px 12px rgba(0,0,0,0.4)` }}
                    />
                  ) : (
                    <div style={{ width: 90, height: 126, borderRadius: 7, background: 'rgba(140,176,208,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#5f7589', flexShrink: 0 }}>?</div>
                  )}

                  {/* Opponent name + tags */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: oppColor, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
                      {oppName}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {r.won_dice_roll !== null && (
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: r.won_dice_roll ? 'rgba(59,178,126,0.18)' : 'rgba(210,74,58,0.18)', color: r.won_dice_roll ? '#3bb27e' : '#d24a3a', fontWeight: 700 }}>
                          {r.won_dice_roll ? 'Dice W' : 'Dice L'}
                        </span>
                      )}
                      {r.went_first !== null && (
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(140,176,208,0.07)', color: r.went_first ? '#dcb35e' : '#52a9cd', fontWeight: 700 }}>
                          {r.went_first ? '1st' : '2nd'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Win/Loss badge */}
                  <div style={{
                    flexShrink: 0, minWidth: 40, padding: '6px 14px', borderRadius: 8,
                    fontSize: 15, fontWeight: 700, textAlign: 'center',
                    background: isWin ? 'rgba(59,178,126,0.18)' : 'rgba(210,74,58,0.18)',
                    color: isWin ? '#3bb27e' : '#d24a3a',
                    border: `1px solid ${isWin ? 'rgba(59,178,126,0.4)' : 'rgba(210,74,58,0.4)'}`,
                    alignSelf: 'flex-start',
                  }}>
                    {isWin ? 'W' : 'L'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid rgba(140,176,208,0.2)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#52a9cd', letterSpacing: '-0.2px' }}>☠ PirateTracker</div>
        <div style={{ fontSize: 11, color: '#5f7589' }}>piratetracker.vercel.app</div>
      </div>
    </div>
  )
})

export default TournamentShareCard
