import { forwardRef } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

function cleanName(name) {
  if (!name) return ''
  return name
    .replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '')
    .replace(/\s*\([^)]*\)$/, '')
    .trim()
}

function pLabel(n) { if (n===1) return '1st'; if (n===2) return '2nd'; if (n===3) return '3rd'; return `${n}th` }

function pBadge(n) {
  if (n===1) return { background: 'rgba(251,191,36,0.22)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.5)' }
  if (n===2) return { background: 'rgba(148,163,184,0.18)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.4)' }
  if (n===3) return { background: 'rgba(251,146,60,0.18)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }
  return { background: 'rgba(255,255,255,0.08)', color: '#7c6fa0', border: '1px solid rgba(255,255,255,0.12)' }
}

const TournamentShareCard = forwardRef(function TournamentShareCard({ tournament }, ref) {
  if (!tournament) return null

  const color = COLORS[tournament.leader_color] ?? '#8b5cf6'
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
        width: '800px',
        minHeight: '480px',
        background: '#0c0814',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '20px',
        overflow: 'hidden',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        color: '#f0f2f5',
        boxSizing: 'border-box',
        display: 'flex',
      }}
    >
      {/* ── Left panel: leader card full-height ── */}
      <div style={{ width: 230, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <img
          crossOrigin="anonymous"
          src={getCardImageUrl(tournament.leader_id)}
          alt={tournament.leader_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block', minHeight: 480 }}
        />
        {/* right-edge fade into background */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 50%, #0c0814 100%)' }} />
        {/* bottom fade for name overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,8,20,0.95) 0%, transparent 45%)' }} />
        {/* leader name + color at bottom */}
        <div style={{ position: 'absolute', bottom: 18, left: 14, right: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', lineHeight: 1.3, marginBottom: 6 }}>
            {cleanName(tournament.leader_name)}
          </div>
          {tournament.leader_color && (
            <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 8, background: color + '28', color, border: `1px solid ${color}55`, fontWeight: 600 }}>
              {tournament.leader_color}
            </span>
          )}
        </div>
        {/* accent line on right edge */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 3, height: '100%', background: `linear-gradient(to bottom, ${color}, ${color}44)` }} />
      </div>

      {/* ── Right panel: content ── */}
      <div style={{
        flex: 1,
        minWidth: 0,
        padding: '22px 24px 18px 20px',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse 280px 180px at 100% 0%, rgba(124,58,237,0.22) 0%, transparent 60%)',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>
            Tournament Result
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', lineHeight: 1.2, marginBottom: 3 }}>
            {tournament.name}
          </div>
          <div style={{ fontSize: 11, color: '#7c6fa0' }}>
            {tournament.date} · {tournament.player_count} players
          </div>
        </div>

        {/* Result row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 13, padding: '11px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 7, fontSize: 13, fontWeight: 700, flexShrink: 0, ...pBadge(tournament.placement) }}>
            {pLabel(tournament.placement)} Place
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: '"Space Mono", "Courier New", monospace', lineHeight: 1 }}>
            <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
            <span style={{ color: '#3a3560', margin: '0 6px', fontSize: 28 }}>—</span>
            <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
          </div>
          <div style={{ fontSize: 12, color: '#7c6fa0' }}>{winRate}% win rate</div>
        </div>

        {/* Stats */}
        {rounds.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 14 }}>
            {[
              { label: '1st Win Rate', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal} games` },
              { label: '2nd Win Rate', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal} games` },
              { label: 'Dice Win Rate', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon} won` },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 9, color: '#4a5068', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa', fontFamily: '"Space Mono", "Courier New", monospace' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#4a5068', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Rounds */}
        {rounds.length > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: '#4a5068', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
              Round by Round
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: rounds.length > 2 ? '1fr 1fr' : '1fr', gap: 7 }}>
              {rounds.map(r => {
                const oppColor = COLORS[r.opponent_leader_color] ?? '#94a3b8'
                const oppName = cleanName(r.opponent_leader_name) || 'Unknown'
                const isWin = r.result === 'win'
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      background: isWin ? 'rgba(52,211,153,0.04)' : 'rgba(240,82,82,0.04)',
                      borderRadius: 8, padding: '8px 10px',
                      border: `1px solid ${isWin ? 'rgba(52,211,153,0.15)' : 'rgba(240,82,82,0.12)'}`,
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#7c6fa0', fontWeight: 700, width: 20, flexShrink: 0, fontFamily: 'monospace', alignSelf: 'flex-start', paddingTop: 2 }}>
                      R{r.round_number}
                    </div>

                    {r.opponent_leader_id ? (
                      <img
                        crossOrigin="anonymous"
                        src={getCardImageUrl(r.opponent_leader_id)}
                        alt={r.opponent_leader_name ?? ''}
                        style={{ width: 64, height: 90, objectFit: 'cover', objectPosition: 'top center', borderRadius: 6, flexShrink: 0, display: 'block', border: `2px solid ${oppColor}66`, boxShadow: '0 3px 10px rgba(0,0,0,0.4)' }}
                      />
                    ) : (
                      <div style={{ width: 64, height: 90, borderRadius: 6, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#4a5068', flexShrink: 0 }}>?</div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: oppColor, fontWeight: 700, marginBottom: 5, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {oppName}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.won_dice_roll !== null && (
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: r.won_dice_roll ? 'rgba(52,211,153,0.18)' : 'rgba(240,82,82,0.18)', color: r.won_dice_roll ? '#34d399' : '#f05252', fontWeight: 700 }}>
                            {r.won_dice_roll ? 'Dice W' : 'Dice L'}
                          </span>
                        )}
                        {r.went_first !== null && (
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.07)', color: r.went_first ? '#fbbf24' : '#a78bfa', fontWeight: 700 }}>
                            {r.went_first ? '1st' : '2nd'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{
                      flexShrink: 0, padding: '4px 10px', borderRadius: 6,
                      fontSize: 13, fontWeight: 700, alignSelf: 'flex-start',
                      background: isWin ? 'rgba(52,211,153,0.18)' : 'rgba(240,82,82,0.18)',
                      color: isWin ? '#34d399' : '#f05252',
                      border: `1px solid ${isWin ? 'rgba(52,211,153,0.4)' : 'rgba(240,82,82,0.4)'}`,
                    }}>
                      {isWin ? 'W' : 'L'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 14, borderTop: '1px solid rgba(139,92,246,0.15)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>☠ PirateTracker</div>
          <div style={{ fontSize: 10, color: '#4a5068' }}>piratetracker.vercel.app</div>
        </div>
      </div>
    </div>
  )
})

export default TournamentShareCard
