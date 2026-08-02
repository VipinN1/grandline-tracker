import { useRef, useLayoutEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { colors, radius, font } from '../theme'

const LEADER_COLORS = {
  Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e',
  Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8',
}

function cleanName(name) {
  if (!name) return ''
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

// Screenshot-style share card for a decklist — mirrors the tournament
// ShareOverlay (src/components/TournamentModal.jsx) so both share cards in
// the app share the same visual signature (ghosted watermark, brand bar).
export default function DeckShareOverlay({ deck, stats, onClose, isMobile }) {
  const color = (deck.leader_color ?? '').split(/[\s/]+/).map(c => LEADER_COLORS[c.trim()]).find(Boolean) ?? colors.ocean
  const leaderName = cleanName(deck.leader_name)
  const nameWords = leaderName ? leaderName.split(/\s+/).filter(Boolean) : []

  const nameBoxRef = useRef(null)
  const nameTextRef = useRef(null)
  useLayoutEffect(() => {
    const box = nameBoxRef.current, txt = nameTextRef.current
    if (!box || !txt) return
    const multi = (leaderName || '').trim().split(/\s+/).length > 1
    const NAME_MIN = 30
    let size = isMobile ? (multi ? 38 : 56) : (multi ? 50 : 76)
    txt.style.fontSize = size + 'px'
    while (size > NAME_MIN && txt.scrollWidth > box.clientWidth) {
      size -= 1
      txt.style.fontSize = size + 'px'
    }
  }, [leaderName, isMobile])

  const cards = deck.cards ?? []
  const totalCards = cards.reduce((s, c) => s + c.count, 0)
  const maxCostCount = Math.max(1, ...Object.values(stats.costBuckets))

  return (
    <div style={{ position: 'fixed', inset: 0, background: colors.abyss, zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: isMobile ? '18px 0 28px' : '24px 20px 36px' }}>

      <div style={{ textAlign: 'center', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>📸 Screenshot to share</div>
        <div style={{ fontSize: 11, color: colors.faint, marginTop: 3 }}>Crop below the card — the close button won't be captured</div>
      </div>

      <div style={{
        width: isMobile ? '100%' : 460,
        maxWidth: '100%',
        background: `radial-gradient(ellipse 280px 220px at 0% 0%, ${color}26 0%, transparent 62%), ${colors.abyss}`,
        border: `1.5px solid ${colors.goldLine}`,
        borderRadius: isMobile ? 0 : radius.lg,
        overflow: 'hidden',
        boxShadow: `0 0 0 1px ${colors.line}, 0 0 50px ${colors.line}, 0 18px 50px rgba(0,0,0,0.6)`,
        fontFamily: 'inherit',
        flexShrink: 0,
      }}>

        {/* Header */}
        <div style={{ position: 'relative', padding: '16px 18px 14px', borderBottom: `1px solid ${colors.line}` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, ${color}, ${color}66, transparent)`, zIndex: 2 }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 13, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 58, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: `2px solid ${color}88`, boxShadow: `0 0 16px ${color}33, 0 4px 12px rgba(0,0,0,0.5)` }}>
              <img
                src={getCardImageUrl(deck.leader_id)}
                alt={deck.leader_name}
                style={{ width: '100%', aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.text, letterSpacing: '-0.3px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deck.name}
              </div>
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
                {deck.leader_name} · {deck.leader_id}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font.mono, color: colors.gold, marginTop: 9 }}>
                {totalCards} cards
              </div>
            </div>
          </div>

          {leaderName && (
            <div ref={nameBoxRef} style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', width: isMobile ? '62%' : 300, textAlign: 'right', overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
              <div ref={nameTextRef} style={{ display: 'inline-block', fontWeight: 800, lineHeight: 0.9, letterSpacing: '-3px', color: `${color}1f` }}>
                {nameWords.map((w, i) => (
                  <div key={i} style={{ whiteSpace: 'nowrap', transform: i ? `translateX(${i * 0.3}em)` : undefined }}>{w}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Brand bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px', background: 'rgba(140,176,208,0.06)', borderBottom: `1px solid ${colors.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.ocean, letterSpacing: '-0.2px' }}>PirateTracker</div>
          <div style={{ fontSize: 9.5, color: colors.faint }}>piratetracker.vercel.app</div>
        </div>

        {/* Compact card grid */}
        <div style={{ padding: '12px 14px 2px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {cards.flatMap(card =>
            Array.from({ length: card.count }, (_, i) => (
              <img
                key={`${card.id}-${i}`}
                src={getCardImageUrl(card.id)}
                alt=""
                style={{ width: 34, borderRadius: 3, border: `1px solid ${colors.line}`, display: 'block' }}
              />
            ))
          )}
        </div>

        {/* Stats footer */}
        <div style={{ padding: '14px 18px 16px', borderTop: `1px solid ${colors.line}`, marginTop: 10 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: colors.faint, marginBottom: 6 }}>Cost Curve</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40, marginBottom: 12 }}>
            {Array.from({ length: 11 }, (_, cost) => {
              const n = stats.costBuckets[cost] ?? 0
              return (
                <div key={cost} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ width: '100%', height: `${Math.max(n > 0 ? 6 : 0, (n / maxCostCount) * 32)}px`, background: n > 0 ? `linear-gradient(180deg, ${colors.oceanBright}, ${colors.ocean})` : 'transparent', borderRadius: '2px 2px 0 0' }} />
                  <div style={{ fontSize: 7.5, color: colors.faint, marginTop: 3, fontFamily: font.mono }}>{cost}</div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Character', value: stats.charCount },
              { label: 'Event', value: stats.eventCount },
              { label: 'Stage', value: stats.stageCount },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(140,176,208,0.04)', borderRadius: 8, padding: '7px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, fontFamily: font.mono }}>{s.value}</div>
                <div style={{ fontSize: 8.5, color: colors.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {Object.keys(stats.colorCounts).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([col, n]) => (
                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(140,176,208,0.04)', borderRadius: 6, padding: '3px 8px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: LEADER_COLORS[col] ?? colors.faint }} />
                  <span style={{ fontSize: 10, color: colors.muted, fontFamily: font.mono }}>{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        style={{ marginTop: 22, padding: '10px 32px', borderRadius: 10, border: `1px solid ${colors.line}`, background: 'rgba(140,176,208,0.05)', color: colors.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
      >
        ✕ Close
      </button>
    </div>
  )
}
