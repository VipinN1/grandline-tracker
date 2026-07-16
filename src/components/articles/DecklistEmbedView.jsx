import { NodeViewWrapper } from '@tiptap/react'
import { useState } from 'react'
import { getCardImageUrl } from '../../lib/optcgapi'
import { decklistToText } from '../../lib/articles'
import { colors, radius, font } from '../../theme'

const LEADER_COLORS = {
  Red: '#d24a3a', Blue: '#3f8fd6', Green: '#3bb27e',
  Purple: '#8d7ae6', Yellow: '#dcb35e', Black: '#94a3b8',
}

export default function DecklistEmbedView({ node, selected, editor, deleteNode }) {
  const { name, leaderId, leaderName, leaderColor, cards } = node.attrs
  const [copied, setCopied] = useState(false)
  const [enlarged, setEnlarged] = useState(null)
  const editable = editor.isEditable
  const accent = LEADER_COLORS[leaderColor] ?? colors.ocean
  const total = (cards ?? []).reduce((s, c) => s + (c.count ?? 0), 0)

  async function copyList() {
    try {
      await navigator.clipboard.writeText(decklistToText(cards))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <NodeViewWrapper style={{ margin: '14px 0' }}>
      <div
        data-drag-handle
        style={{
          background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
          border: `1px solid ${selected && editable ? colors.goldLine : colors.line}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.38)',
          cursor: editable ? 'grab' : 'default',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${colors.line}`, position: 'relative' }}>
          {leaderId && (
            <img
              src={getCardImageUrl(leaderId)}
              alt={leaderName ?? leaderId}
              draggable={false}
              style={{ width: 42, height: 42, objectFit: 'cover', objectPosition: 'center 18%', borderRadius: 8, border: `1px solid ${colors.line}`, flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: font.display, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'Decklist'}
            </div>
            <div style={{ fontSize: 11, color: colors.muted }}>
              {leaderName ? `${leaderName} · ${leaderId} · ` : ''}{total} cards
            </div>
          </div>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={copyList}
            style={{ fontSize: 11, fontWeight: 600, color: copied ? colors.emerald : colors.muted, background: 'rgba(140,176,208,0.06)', border: `1px solid ${colors.line}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {copied ? '✓ Copied' : 'Copy List'}
          </button>
          {editable && selected && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={deleteNode}
              title="Remove decklist"
              style={{ fontSize: 11, fontWeight: 700, color: colors.crimson, background: 'rgba(210,74,58,0.10)', border: '1px solid rgba(210,74,58,0.34)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ✕
            </button>
          )}
          <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: accent }} />
        </div>

        {/* Card grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 14 }}>
          {(cards ?? []).map(card => (
            <div
              key={card.id}
              style={{ position: 'relative', cursor: 'zoom-in' }}
              onClick={() => setEnlarged(card)}
            >
              <img
                src={getCardImageUrl(card.id)}
                alt={card.name ?? card.id}
                title={card.name ? `${card.name} (${card.id})` : card.id}
                draggable={false}
                style={{ width: 64, borderRadius: 6, border: `1px solid ${colors.line}`, display: 'block' }}
                onError={e => { e.target.style.opacity = '0.15' }}
              />
              <span style={{ position: 'absolute', bottom: 4, right: 4, minWidth: 18, height: 18, borderRadius: 5, background: 'rgba(6,16,27,0.88)', border: `1px solid ${colors.goldLine}`, color: colors.gold, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: font.mono }}>
                ×{card.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Enlarged card overlay */}
      {enlarged && (
        <div
          contentEditable={false}
          onClick={() => setEnlarged(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }}
        >
          <img
            src={getCardImageUrl(enlarged.id)}
            alt={enlarged.name ?? enlarged.id}
            style={{ maxWidth: 'min(92vw, 420px)', maxHeight: '86vh', borderRadius: 14, boxShadow: '0 20px 48px rgba(0,0,0,0.6)' }}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}
