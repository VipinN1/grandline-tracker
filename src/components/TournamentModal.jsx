import { useState, useRef } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import TournamentShareCard from './TournamentShareCard'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

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
  if (n===1) return { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }
  if (n===2) return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
  if (n===3) return { background: 'rgba(251,146,60,0.1)', color: '#fb923c' }
  return { background: 'rgba(255,255,255,0.04)', color: '#3d2d6e' }
}


export default function TournamentModal({ tournament, onClose, zIndex = 200, isMobile = false, onDelete }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)
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

  const modalBox = {
    background: '#110a1e',
    border: '1px solid rgba(139,92,246,0.18)',
    borderRadius: isMobile ? '16px 16px 0 0' : 16,
    width: isMobile ? '100%' : 620,
    maxHeight: isMobile ? '95vh' : '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }

  function handleDelete() {
    setShowConfirm(true)
  }

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

  async function handleExport() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')

      // Preload all images so html2canvas finds them cached
      const imageUrls = [
        getCardImageUrl(tournament.leader_id),
        ...rounds.filter(r => r.opponent_leader_id).map(r => getCardImageUrl(r.opponent_leader_id)),
      ].filter(Boolean)
      await Promise.allSettled(imageUrls.map(url => new Promise(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = resolve
        img.onerror = resolve
        img.src = url
      })))

      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
        logging: false,
      })

      const link = document.createElement('a')
      link.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}_result.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
    }
    setExporting(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
        <div onClick={e => e.stopPropagation()} style={modalBox}>

          {/* Header with leader art */}
          <div style={{ position: 'relative', height: 120, background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
            <img src={getCardImageUrl(tournament.leader_id)} alt={tournament.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, rgba(139,92,246,0.05) 100%)' }} />
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <button onClick={() => { handleExport() }} disabled={exporting} style={{ position: 'absolute', top: 12, right: 50, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 6, color: exporting ? '#7c6fa0' : '#a78bfa', fontSize: 11, fontWeight: 700, padding: '0 10px', height: 30, cursor: exporting ? 'default' : 'pointer', letterSpacing: '0.3px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              {exporting ? 'Saving…' : '↗ Share'}
            </button>
            {onDelete !== false && (
              <button onClick={handleDelete} disabled={deleting} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(240,82,82,0.5)', border: '1px solid rgba(240,82,82,0.4)', borderRadius: 6, color: deleting ? '#7c6fa0' : '#f05252', fontSize: 11, fontWeight: 700, padding: '0 10px', height: 30, cursor: deleting ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
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
              <div style={{ fontSize: 11, color: '#7c6fa0' }}>{tournament.date} · {tournament.player_count} players</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              <span style={{ color: '#34d399' }}>{tournament.wins}W</span>
              <span style={{ color: '#3d2d6e', margin: '0 3px' }}>·</span>
              <span style={{ color: '#f05252' }}>{tournament.losses}L</span>
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: 20 }}>

            {/* Round stats */}
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
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
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
                  ))}
                </div>
              </div>
            )}

            {/* Decklist */}
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
      <TournamentShareCard ref={cardRef} tournament={tournament} />

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: zIndex + 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#110a1e', border: '1px solid rgba(240,82,82,0.25)', borderRadius: 14, padding: '28px 24px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(240,82,82,0.12)', border: '1px solid rgba(240,82,82,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 16px' }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 8 }}>Delete Tournament?</div>
            <div style={{ fontSize: 13, color: '#7c6fa0', lineHeight: 1.6, marginBottom: 24 }}>
              This will permanently remove <span style={{ color: '#f0f2f5', fontWeight: 600 }}>{tournament.name}</span> and all associated round data. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#f05252', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
