import { useState, useRef, useLayoutEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

function cleanName(name) {
  if (!name) return ''
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

// Lighten a hex color toward white by `amt` (0–1)
function hexLighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const mix = c => Math.round(c + (255 - c) * amt)
  return '#' + [mix(n >> 16 & 255), mix(n >> 8 & 255), mix(n & 255)].map(x => x.toString(16).padStart(2, '0')).join('')
}

// leader_color can hold one or more colors ("Red", "Red Blue", "Red/Green").
// Returns the gradient stops: dual+ colors fade between each; a single color
// fades from a lighter shade into itself.
function leaderColorStops(leaderColor) {
  const list = (leaderColor ?? '').split(/[\s/]+/).map(c => COLORS[c.trim()]).filter(Boolean)
  if (list.length >= 2) return list
  if (list.length === 1) return [hexLighten(list[0], 0.45), list[0]]
  return ['#c4b5fd', '#8b5cf6']
}

function CardPreview({ card, onClose }) {
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 300, maxWidth: '85vw', borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 3, fontFamily: 'monospace' }}>{card.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f2f5', fontSize: 13, fontWeight: 600, padding: '7px 24px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  )
}

function pLabel(n) { if (n===1) return '1st'; if (n===2) return '2nd'; if (n===3) return '3rd'; return `${n}th` }
function pStyle(n) {
  if (n===1) return { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }
  if (n===2) return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' }
  if (n===3) return { background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }
  return { background: 'rgba(255,255,255,0.04)', color: '#3d2d6e', border: '1px solid rgba(255,255,255,0.08)' }
}

// ─── Screenshot share overlay ─────────────────────────────────────────────────
function ShareOverlay({ tournament, onClose, isMobile }) {
  const colorStops = leaderColorStops(tournament.leader_color)
  const color = (tournament.leader_color ?? '').split(/[\s/]+/).map(c => COLORS[c.trim()]).find(Boolean) ?? '#8b5cf6'
  const nameGradient = `linear-gradient(110deg, ${colorStops.join(', ')})`
  const leaderName = cleanName(tournament.leader_name)

  // Fit the leader name to its allotted box on a single line, scaling the font
  // down only as far as needed so it uses the horizontal space without overflow.
  const NAME_MAX = 40, NAME_MIN = 14
  const nameBoxRef = useRef(null)
  const nameTextRef = useRef(null)
  const [nameFontSize, setNameFontSize] = useState(NAME_MAX)
  useLayoutEffect(() => {
    const box = nameBoxRef.current, txt = nameTextRef.current
    if (!box || !txt) return
    let size = NAME_MAX
    txt.style.fontSize = size + 'px'
    while (size > NAME_MIN && txt.scrollWidth > box.clientWidth) {
      size -= 1
      txt.style.fontSize = size + 'px'
    }
    setNameFontSize(size)
  }, [leaderName, isMobile])

  const rounds = (tournament.tournament_rounds ?? []).sort((a, b) => a.round_number - b.round_number)
  const wentFirstWins = rounds.filter(r => r.went_first === true && r.result === 'win').length
  const wentFirstTotal = rounds.filter(r => r.went_first === true).length
  const wentSecondWins = rounds.filter(r => r.went_first === false && r.result === 'win').length
  const wentSecondTotal = rounds.filter(r => r.went_first === false).length
  const diceWins = rounds.filter(r => r.won_dice_roll === true && r.result === 'win').length
  const diceWon = rounds.filter(r => r.won_dice_roll === true).length
  const winRate = tournament.wins + tournament.losses > 0
    ? Math.round(tournament.wins / (tournament.wins + tournament.losses) * 100) : 0

  const hasRounds = rounds.length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#06030f', zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: isMobile ? '18px 0 28px' : '24px 20px 36px' }}>

      {/* Screenshot hint — above card, not part of it */}
      <div style={{ textAlign: 'center', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>📸 Screenshot to share</div>
        <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 3 }}>Crop below the card — the close button won't be captured</div>
      </div>

      {/* The card */}
      <div style={{
        width: isMobile ? '100%' : 440,
        maxWidth: '100%',
        background: 'radial-gradient(ellipse 280px 220px at 0% 0%, rgba(124,58,237,0.28) 0%, transparent 62%), radial-gradient(ellipse 200px 160px at 100% 100%, rgba(168,85,247,0.14) 0%, transparent 66%), #0c0814',
        border: `1.5px solid rgba(139,92,246,0.45)`,
        borderRadius: isMobile ? 0 : 18,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(139,92,246,0.12), 0 0 50px rgba(139,92,246,0.16), 0 18px 50px rgba(0,0,0,0.6)',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}>

        {/* Compact header — leader thumbnail + title + result */}
        <div style={{ position: 'relative', padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, ${color}, ${color}66, transparent)` }} />
          <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            {/* Leader portrait thumbnail */}
            <div style={{ position: 'relative', width: 58, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: `2px solid ${color}88`, boxShadow: `0 0 16px ${color}33, 0 4px 12px rgba(0,0,0,0.5)` }}>
              <img
                src={getCardImageUrl(tournament.leader_id)}
                alt={tournament.leader_name}
                style={{ width: '100%', aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
              />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 4px 3px', textAlign: 'center', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: '#fff', letterSpacing: '-0.5px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                {tournament.wins}-{tournament.losses}
              </div>
            </div>

            {/* Title + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.3px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tournament.name}
              </div>
              <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tournament.date}{tournament.player_count ? ` · ${tournament.player_count} players` : ''}{tournament.location ? ` · ${tournament.location}` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, ...pStyle(tournament.placement) }}>
                  {pLabel(tournament.placement)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                  <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
                  <span style={{ color: '#3d2d6e', margin: '0 3px' }}>·</span>
                  <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
                </span>
                <span style={{ fontSize: 11, color: '#7c6fa0' }}>{winRate}%</span>
              </div>
            </div>
          </div>

          {/* Big gradient leader name — fills the lower-right empty space */}
          {leaderName && (
            <div ref={nameBoxRef} style={{ position: 'absolute', right: 18, bottom: 11, width: isMobile ? '54%' : 212, textAlign: 'right', filter: `drop-shadow(0 0 14px ${color}55)`, pointerEvents: 'none' }}>
              <div ref={nameTextRef} style={{
                display: 'inline-block', whiteSpace: 'nowrap',
                fontSize: nameFontSize, fontWeight: 800, lineHeight: 1.0, letterSpacing: '-1px',
                backgroundImage: nameGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent', color: 'transparent',
              }}>
                {leaderName}
              </div>
            </div>
          )}
        </div>

        {/* Brand bar — kept high so screenshots can't crop it out */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px', background: 'rgba(139,92,246,0.06)', borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', letterSpacing: '-0.2px' }}>☠ PirateTracker</div>
          <div style={{ fontSize: 9.5, color: '#4a3a6e' }}>piratetracker.vercel.app</div>
        </div>

        {/* Round-by-round table */}
        {hasRounds && (
          <div style={{ padding: '12px 14px 14px' }}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 8px', fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3d2d6e', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 22, flexShrink: 0 }}>Rd</div>
              <div style={{ flex: 1 }}>Opponent</div>
              <div style={{ width: 38, flexShrink: 0, textAlign: 'center' }}>Dice</div>
              <div style={{ width: 38, flexShrink: 0, textAlign: 'center' }}>Order</div>
              <div style={{ width: 30, flexShrink: 0, textAlign: 'center' }}>Res</div>
            </div>

            {rounds.map(r => {
              const oppColor = COLORS[r.opponent_leader_color] ?? '#94a3b8'
              const isWin = r.result === 'win'
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 7, marginTop: 5, background: isWin ? 'rgba(52,211,153,0.06)' : 'rgba(240,82,82,0.06)' }}>
                  {/* Round */}
                  <div style={{ width: 22, flexShrink: 0, textAlign: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: isWin ? '#34d399' : '#f05252' }}>
                    {r.round_number}
                  </div>
                  {/* Opponent */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.opponent_leader_id ? (
                      <img src={getCardImageUrl(r.opponent_leader_id)} alt="" style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 5, flexShrink: 0, border: `1.5px solid ${oppColor}66`, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{ width: 40, height: 56, borderRadius: 5, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                    )}
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: oppColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cleanName(r.opponent_leader_name) || 'Unknown'}
                    </div>
                  </div>
                  {/* Dice */}
                  <div style={{ width: 38, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    {r.won_dice_roll === null ? (
                      <span style={{ color: '#2a1f4a', fontSize: 13 }}>—</span>
                    ) : (
                      <span
                        title={r.won_dice_roll ? 'Won dice' : 'Lost dice'}
                        style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px', borderRadius: 5, fontSize: 9, fontWeight: 800, fontFamily: 'monospace', background: r.won_dice_roll ? 'rgba(52,211,153,0.16)' : 'rgba(240,82,82,0.16)', color: r.won_dice_roll ? '#34d399' : '#f05252' }}
                      >
                        🎲{r.won_dice_roll ? 'W' : 'L'}
                      </span>
                    )}
                  </div>
                  {/* Order */}
                  <div style={{ width: 38, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    {r.went_first === null ? (
                      <span style={{ color: '#2a1f4a', fontSize: 13 }}>—</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.went_first ? 'rgba(251,191,36,0.16)' : 'rgba(167,139,250,0.16)', color: r.went_first ? '#fbbf24' : '#a78bfa' }}>
                        {r.went_first ? '1' : '2'}
                      </span>
                    )}
                  </div>
                  {/* Result */}
                  <div style={{ width: 30, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: isWin ? 'rgba(52,211,153,0.18)' : 'rgba(240,82,82,0.18)', color: isWin ? '#34d399' : '#f05252' }}>
                      {isWin ? '✓' : '✕'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Stats strip — at the bottom */}
        {hasRounds && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Going 1st', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal}` },
              { label: 'Going 2nd', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal}` },
              { label: 'Dice Won', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon}` },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '7px 6px', textAlign: 'center', borderLeft: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ fontSize: 7.5, color: '#3d2d6e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3, fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 8.5, color: '#3d2d6e', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close button — below card, clearly outside the screenshot area */}
      <button
        onClick={onClose}
        style={{ marginTop: 22, padding: '10px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
      >
        ✕ Close
      </button>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function TournamentModal({ tournament, onClose, zIndex = 200, isMobile = false, onDelete }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showShare, setShowShare] = useState(false)
  if (!tournament) return null

  const color = COLORS[tournament.leader_color] ?? '#8b5cf6'
  const cards = tournament.decklists?.cards ?? []
  const rounds = (tournament.tournament_rounds ?? []).sort((a, b) => a.round_number - b.round_number)

  const wentFirstWins = rounds.filter(r => r.went_first === true && r.result === 'win').length
  const wentFirstTotal = rounds.filter(r => r.went_first === true).length
  const wentSecondWins = rounds.filter(r => r.went_first === false && r.result === 'win').length
  const wentSecondTotal = rounds.filter(r => r.went_first === false).length
  const diceWins = rounds.filter(r => r.won_dice_roll === true && r.result === 'win').length
  const diceWon = rounds.filter(r => r.won_dice_roll === true).length

  async function confirmDelete() {
    setShowConfirm(false)
    setDeleting(true)
    const { supabase } = await import('../lib/supabase')
    await supabase.from('tournament_rounds').delete().eq('tournament_id', tournament.id)
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    setDeleting(false)
    onDelete?.()
    onClose()
  }

  if (showShare) return <ShareOverlay tournament={tournament} onClose={() => setShowShare(false)} isMobile={isMobile} />

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#110a1e', border: '1px solid rgba(139,92,246,0.18)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 620, maxHeight: isMobile ? '95vh' : '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Header with leader art */}
          <div style={{ position: 'relative', height: 120, background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
            <img src={getCardImageUrl(tournament.leader_id)} alt={tournament.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, rgba(139,92,246,0.05) 100%)' }} />
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <button onClick={() => setShowShare(true)} style={{ position: 'absolute', top: 12, right: 50, background: 'rgba(18,10,34,0.82)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', border: '1px solid rgba(139,92,246,0.7)', borderRadius: 6, color: '#c4b5fd', fontSize: 11, fontWeight: 700, padding: '0 10px', height: 30, cursor: 'pointer', letterSpacing: '0.3px', whiteSpace: 'nowrap', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              ↗ Share
            </button>
            {onDelete !== false && (
              <button onClick={() => setShowConfirm(true)} disabled={deleting} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(26,8,12,0.82)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', border: '1px solid rgba(240,82,82,0.7)', borderRadius: 6, color: deleting ? '#7c6fa0' : '#ff7676', fontSize: 11, fontWeight: 700, padding: '0 10px', height: 30, cursor: deleting ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', textTransform: 'uppercase', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {deleting ? 'Deleting…' : 'Delete Log'}
              </button>
            )}
            <div style={{ position: 'absolute', bottom: 14, left: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{tournament.deck_name ?? tournament.name}</div>
              <div style={{ fontSize: 12, color: '#7c6fa0' }}>{tournament.leader_name} · {tournament.leader_id}</div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
          </div>

          {/* Result row */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, ...pStyle(tournament.placement) }}>
              {pLabel(tournament.placement)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{tournament.name}</div>
              <div style={{ fontSize: 11, color: '#7c6fa0' }}>{tournament.date} · {tournament.player_count} players{tournament.location ? ` · ${tournament.location}` : ''}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
              <span style={{ color: '#3d2d6e', margin: '0 3px' }}>·</span>
              <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: 20 }}>
            {rounds.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 10 }}>Round Stats</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: '1st WR', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal}` },
                    { label: '2nd WR', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal}` },
                    { label: 'Dice Win WR', value: diceWon > 0 ? `${Math.round(diceWins / diceWon * 100)}%` : '—', sub: `${diceWins}/${diceWon}` },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#7c6fa0', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f2f5' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 2 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 8 }}>Round by Round</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rounds.map(r => (
                    <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#7c6fa0', minWidth: 52 }}>Round {r.round_number}</div>
                        {r.opponent_leader_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <img src={getCardImageUrl(r.opponent_leader_id)} alt={r.opponent_leader_name} style={{ width: 22, height: 30, objectFit: 'cover', objectPosition: 'top', borderRadius: 3 }} onError={e => { e.target.style.display = 'none' }} />
                            <div style={{ fontSize: 12, color: COLORS[r.opponent_leader_color] ?? '#7c6fa0' }}>vs {r.opponent_leader_name}</div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, fontSize: 12, color: '#3d2d6e' }}>vs Unknown</div>
                        )}
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {r.won_dice_roll !== null && (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: r.won_dice_roll ? 'rgba(52,211,153,0.1)' : 'rgba(240,82,82,0.1)', color: r.won_dice_roll ? '#34d399' : '#f05252' }}>
                              🎲 {r.won_dice_roll ? 'Won' : 'Lost'}
                            </span>
                          )}
                          {r.went_first !== null && (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: r.went_first ? '#fbbf24' : '#a78bfa' }}>
                              {r.went_first ? '1st' : '2nd'}
                            </span>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 700, color: r.result === 'win' ? '#34d399' : '#f05252', minWidth: 16, textAlign: 'right' }}>
                            {r.result === 'win' ? 'W' : 'L'}
                          </span>
                        </div>
                      </div>
                      {r.notes && (
                        <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 5, paddingLeft: 62, fontStyle: 'italic' }}>{r.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cards.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 10 }}>
                  Decklist — {cards.reduce((s, c) => s + c.count, 0)} cards · click to enlarge
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
                  {cards.flatMap(card =>
                    Array.from({ length: card.count }, (_, i) => (
                      <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 6, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: isMobile ? 56 : 72, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
                      </div>
                    ))
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Card List</div>
                {cards.map(card => (
                  <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', fontFamily: 'monospace', minWidth: 20 }}>{card.count}×</span>
                      <span style={{ fontSize: 13, color: '#f0f2f5' }}>{card.name ?? card.id}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#3d2d6e', fontFamily: 'monospace' }}>{card.id}</span>
                  </div>
                ))}
              </>
            )}

            {cards.length === 0 && rounds.length === 0 && (
              <div style={{ fontSize: 13, color: '#3d2d6e', textAlign: 'center', padding: '20px 0' }}>No additional data for this tournament.</div>
            )}
          </div>
        </div>
      </div>

      {selectedCard && <CardPreview card={selectedCard} onClose={() => setSelectedCard(null)} />}

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: zIndex + 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#110a1e', border: '1px solid rgba(240,82,82,0.25)', borderRadius: 14, padding: '28px 24px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(240,82,82,0.12)', border: '1px solid rgba(240,82,82,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 16px' }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 8 }}>Delete Tournament?</div>
            <div style={{ fontSize: 13, color: '#7c6fa0', lineHeight: 1.6, marginBottom: 24 }}>
              This will permanently remove <span style={{ color: '#f0f2f5', fontWeight: 600 }}>{tournament.name}</span> and all associated round data.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#f05252', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
