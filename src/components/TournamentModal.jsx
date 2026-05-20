import { useState } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'

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

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function fillRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fill()
}

export default function TournamentModal({ tournament, onClose, zIndex = 200, isMobile = false, onDelete }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
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
    setExporting(true)
    const W = 820, H = 460
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const FONT = '"Space Grotesk", system-ui, sans-serif'
    const MONO = '"Space Mono", "Courier New", monospace'

    // Background
    ctx.fillStyle = '#0c0814'
    ctx.fillRect(0, 0, W, H)
    const orb = ctx.createRadialGradient(W, 0, 0, W, 0, 320)
    orb.addColorStop(0, 'rgba(124,58,237,0.2)')
    orb.addColorStop(1, 'rgba(124,58,237,0)')
    ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H)

    // Leader image (left column, full height)
    const imgW = 210
    try {
      const img = await loadImg(getCardImageUrl(tournament.leader_id))
      ctx.save()
      ctx.beginPath(); ctx.rect(0, 0, imgW, H); ctx.clip()
      ctx.drawImage(img, 0, 0, imgW, H)
      ctx.restore()
    } catch {
      ctx.fillStyle = color + '22'
      ctx.fillRect(0, 0, imgW, H)
      ctx.fillStyle = color; ctx.font = `bold 12px ${FONT}`
      ctx.textAlign = 'center'; ctx.fillText(tournament.leader_name, imgW / 2, H / 2)
      ctx.textAlign = 'left'
    }
    // Right-fade the image into the background
    const fade = ctx.createLinearGradient(imgW - 80, 0, imgW, 0)
    fade.addColorStop(0, 'rgba(12,8,20,0)'); fade.addColorStop(1, 'rgba(12,8,20,1)')
    ctx.fillStyle = fade; ctx.fillRect(imgW - 80, 0, 80, H)
    // Color accent strip
    ctx.fillStyle = color; ctx.fillRect(0, H - 4, imgW, 4)

    // Content area
    const cx = imgW + 20, pad = 20
    let y = 30

    function t(str, x, yy, font, fill) { ctx.font = font; ctx.fillStyle = fill; ctx.fillText(str, x, yy) }

    t('TOURNAMENT RESULT', cx, y, `600 10px ${FONT}`, '#8b5cf6'); y += 22

    // Tournament name (truncate if needed)
    ctx.font = `bold 22px ${FONT}`; ctx.fillStyle = '#f0f2f5'
    let name = tournament.name
    while (ctx.measureText(name).width > W - cx - pad - 4 && name.length > 3) name = name.slice(0, -1)
    if (name !== tournament.name) name += '…'
    ctx.fillText(name, cx, y); y += 24

    t(`${tournament.date}  ·  ${tournament.player_count} players`, cx, y, `13px ${FONT}`, '#7c6fa0'); y += 18

    // Divider
    ctx.strokeStyle = 'rgba(139,92,246,0.25)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(W - pad, y); ctx.stroke(); y += 18

    // Placement badge
    const pc = { 1: '#fbbf24', 2: '#94a3b8', 3: '#fb923c' }[tournament.placement] ?? '#7c6fa0'
    ctx.fillStyle = pc + '22'; fillRoundRect(ctx, cx, y, 44, 34, 8)
    ctx.fillStyle = pc; ctx.font = `bold 14px ${FONT}`
    ctx.textAlign = 'center'; ctx.fillText(pLabel(tournament.placement), cx + 22, y + 22); ctx.textAlign = 'left'

    // W/L Record
    const wr = tournament.wins + tournament.losses > 0
      ? Math.round(tournament.wins / (tournament.wins + tournament.losses) * 100) : 0
    ctx.font = `bold 21px ${MONO}`
    ctx.fillStyle = '#34d399'; const wTxt = `${tournament.wins}W`
    ctx.fillText(wTxt, cx + 54, y + 21)
    const wW = ctx.measureText(wTxt).width
    ctx.fillStyle = '#3d2d6e'; ctx.fillText(' – ', cx + 54 + wW, y + 21)
    const sepW = ctx.measureText(' – ').width
    ctx.fillStyle = '#f05252'; ctx.fillText(`${tournament.losses}L`, cx + 54 + wW + sepW, y + 21)
    t(`${wr}% win rate`, cx + 54, y + 35, `12px ${FONT}`, '#7c6fa0'); y += 52

    // Divider
    ctx.strokeStyle = 'rgba(139,92,246,0.25)'
    ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(W - pad, y); ctx.stroke(); y += 16

    if (rounds.length > 0) {
      // Mini stat row
      const stats = [
        { label: '1ST WIN RATE', val: wentFirstTotal > 0 ? `${Math.round(wentFirstWins/wentFirstTotal*100)}%` : '—', sub: `${wentFirstWins}/${wentFirstTotal}` },
        { label: '2ND WIN RATE', val: wentSecondTotal > 0 ? `${Math.round(wentSecondWins/wentSecondTotal*100)}%` : '—', sub: `${wentSecondWins}/${wentSecondTotal}` },
        { label: 'DICE WIN RATE', val: diceWon > 0 ? `${Math.round(diceWins/diceWon*100)}%` : '—', sub: `${diceWins}/${diceWon}` },
      ]
      const sw = (W - cx - pad) / 3
      stats.forEach((s, i) => {
        const sx = cx + i * sw
        t(s.label, sx, y, `600 9px ${FONT}`, '#3d2d6e')
        t(s.val, sx, y + 18, `bold 17px ${FONT}`, '#f0f2f5')
        t(s.sub, sx, y + 31, `11px ${FONT}`, '#7c6fa0')
      }); y += 44

      ctx.strokeStyle = 'rgba(139,92,246,0.25)'
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(W - pad, y); ctx.stroke(); y += 12

      t('ROUND BY ROUND', cx, y, `600 9px ${FONT}`, '#3d2d6e'); y += 14

      // Rounds in 2 columns
      const colW = Math.floor((W - cx - pad - 10) / 2)
      const rowH = 24
      rounds.forEach((r, i) => {
        const col = i % 2, row = Math.floor(i / 2)
        const rx = cx + col * (colW + 10), ry = y + row * rowH
        if (ry + rowH > H - 28) return

        ctx.fillStyle = 'rgba(255,255,255,0.025)'; fillRoundRect(ctx, rx, ry, colW, rowH - 2, 4)

        // Round label
        t(`R${r.round_number}`, rx + 7, ry + 15, `600 10px ${FONT}`, '#7c6fa0')

        // Opponent name (truncate to fit)
        const oppRaw = r.opponent_leader_name ? r.opponent_leader_name.replace(/\s*\([^)]*\)$/, '').trim() : 'Unknown'
        ctx.font = `12px ${FONT}`; ctx.fillStyle = COLORS[r.opponent_leader_color] ?? '#7c6fa0'
        let opp = oppRaw
        while (ctx.measureText(opp).width > colW - 52 && opp.length > 2) opp = opp.slice(0, -1)
        if (opp !== oppRaw) opp += '…'
        ctx.fillText(opp, rx + 28, ry + 15)

        // Result
        ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = r.result === 'win' ? '#34d399' : '#f05252'
        ctx.textAlign = 'right'; ctx.fillText(r.result === 'win' ? 'W' : 'L', rx + colW - 7, ry + 15)
        ctx.textAlign = 'left'
      })
    }

    // Watermark
    ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(139,92,246,0.45)'
    ctx.textAlign = 'right'; ctx.fillText('☠ PirateTracker', W - pad, H - 12); ctx.textAlign = 'left'

    // Download
    const link = document.createElement('a')
    link.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
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
              {exporting ? 'Saving…' : '↓ Export'}
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
