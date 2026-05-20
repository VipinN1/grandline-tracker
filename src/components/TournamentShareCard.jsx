import { forwardRef } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

function pLabel(n) { if (n===1) return '1st'; if (n===2) return '2nd'; if (n===3) return '3rd'; return `${n}th` }

function pBadge(n) {
  if (n===1) return { background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }
  if (n===2) return { background: 'rgba(148,163,184,0.14)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.35)' }
  if (n===3) return { background: 'rgba(251,146,60,0.14)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.35)' }
  return { background: 'rgba(255,255,255,0.06)', color: '#7c6fa0', border: '1px solid rgba(255,255,255,0.1)' }
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
        width: '480px',
        background:
          'radial-gradient(ellipse 260px 260px at 0% 0%, rgba(124,58,237,0.28) 0%, transparent 70%),' +
          'radial-gradient(ellipse 180px 180px at 100% 100%, rgba(236,72,153,0.18) 0%, transparent 70%),' +
          '#0c0814',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '20px',
        padding: '28px',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        color: '#f0f2f5',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 7, fontWeight: 600 }}>
          Tournament Result
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 5 }}>
          {tournament.name}
        </div>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>
          {tournament.date} · {tournament.player_count} players
        </div>
      </div>

      {/* 2. Leader banner */}
      <div style={{ position: 'relative', height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <img
          crossOrigin="anonymous"
          src={getCardImageUrl(tournament.leader_id)}
          alt={tournament.leader_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #0c0814 100%)' }} />
        <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {tournament.leader_name}
          </span>
          {tournament.leader_color && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: color + '33', color, border: `1px solid ${color}55`, fontWeight: 600 }}>
              {tournament.leader_color}
            </span>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40%', height: 4, background: color, borderRadius: '2px 0 0 0' }} />
      </div>

      {/* 3. Result row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, fontSize: 15, fontWeight: 700, ...pBadge(tournament.placement) }}>
          {pLabel(tournament.placement)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: '"Space Mono", "Courier New", monospace', lineHeight: 1 }}>
            <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
            <span style={{ color: '#4a5068', margin: '0 6px' }}>—</span>
            <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
          </div>
          <div style={{ fontSize: 13, color: '#7c6fa0', marginTop: 5 }}>{winRate}% win rate</div>
        </div>
      </div>

      {/* 4. Stats row */}
      {rounds.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: '1st Win Rate', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal} games` },
            { label: '2nd Win Rate', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal} games` },
            { label: 'Dice Win Rate', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon} won` },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: '#4a5068', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa', fontFamily: '"Space Mono", "Courier New", monospace' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#4a5068', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Round by round */}
      {rounds.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#4a5068', textTransform: 'uppercase', marginBottom: 9, fontWeight: 600 }}>
            Round by Round
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {rounds.map(r => {
              const oppColor = COLORS[r.opponent_leader_color] ?? '#c8cad4'
              const oppName = r.opponent_leader_name
                ? r.opponent_leader_name.replace(/\s*\([^)]*\)$/, '').trim()
                : 'Unknown'
              const isWin = r.result === 'win'
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 9px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {/* Round label */}
                  <div style={{ fontSize: 11, color: '#7c6fa0', fontWeight: 600, minWidth: 20, flexShrink: 0 }}>
                    R{r.round_number}
                  </div>
                  {/* Opponent card image */}
                  {r.opponent_leader_id ? (
                    <img
                      crossOrigin="anonymous"
                      src={getCardImageUrl(r.opponent_leader_id)}
                      alt={r.opponent_leader_name ?? ''}
                      style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0, display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 44, borderRadius: 4, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#4a5068', flexShrink: 0 }}>
                      ?
                    </div>
                  )}
                  {/* Opponent name + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: oppColor, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {oppName}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'nowrap' }}>
                      {r.won_dice_roll !== null && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: r.won_dice_roll ? 'rgba(52,211,153,0.15)' : 'rgba(240,82,82,0.15)', color: r.won_dice_roll ? '#34d399' : '#f05252', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {r.won_dice_roll ? 'Dice W' : 'Dice L'}
                        </span>
                      )}
                      {r.went_first !== null && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: r.went_first ? '#fbbf24' : '#a78bfa', fontWeight: 600 }}>
                          {r.went_first ? '1st' : '2nd'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Result pill */}
                  <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isWin ? 'rgba(52,211,153,0.18)' : 'rgba(240,82,82,0.18)', color: isWin ? '#34d399' : '#f05252', border: `1px solid ${isWin ? 'rgba(52,211,153,0.4)' : 'rgba(240,82,82,0.4)'}` }}>
                    {isWin ? 'W' : 'L'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 6. Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(139,92,246,0.15)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>☠ PirateTracker</div>
        <div style={{ fontSize: 11, color: '#4a5068' }}>piratetracker.vercel.app</div>
      </div>
    </div>
  )
})

export default TournamentShareCard
