import { NodeViewWrapper } from '@tiptap/react'
import { useState } from 'react'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, radius, transition } from '../../theme'

const SIZES = { sm: 130, md: 210, lg: 300 }

function ControlBtn({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      style={{
        background: active ? colors.goldSoft : 'transparent',
        border: 'none',
        borderRadius: 5,
        color: active ? colors.gold : colors.muted,
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 7px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  )
}

export default function CardEmbedView({ node, selected, editor, updateAttributes, deleteNode }) {
  const { cardId, cardName, size, align } = node.attrs
  const [errored, setErrored] = useState(false)
  const editable = editor.isEditable
  const width = SIZES[size] ?? SIZES.md

  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'

  return (
    <NodeViewWrapper style={{ display: 'flex', justifyContent: justify, margin: '10px 0' }}>
      <div
        data-drag-handle
        style={{
          position: 'relative',
          width,
          maxWidth: '100%',
          borderRadius: radius.md,
          outline: editable && selected ? `2px solid ${colors.gold}` : '2px solid transparent',
          outlineOffset: 3,
          transition: transition.fast,
          cursor: editable ? 'grab' : 'default',
        }}
      >
        {!errored ? (
          <img
            src={getCardImageUrl(cardId)}
            alt={cardName ?? cardId}
            draggable={false}
            style={{ width: '100%', display: 'block', borderRadius: radius.md, border: `1px solid ${colors.line}`, boxShadow: '0 8px 24px rgba(0,0,0,0.38)' }}
            onError={() => setErrored(true)}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '0.716', borderRadius: radius.md, border: `1px solid ${colors.line}`, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.faint, fontSize: 12, fontWeight: 600 }}>
            {cardId}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: colors.faint, marginTop: 6, fontFamily: "'Space Mono', ui-monospace, monospace" }}>
          {cardName ? `${cardName} · ${cardId}` : cardId}
        </div>

        {editable && selected && (
          <div
            contentEditable={false}
            style={{
              position: 'absolute',
              top: -38,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: colors.deep,
              border: `1px solid ${colors.lineStrong}`,
              borderRadius: 8,
              padding: 3,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              zIndex: 5,
            }}
          >
            {['sm', 'md', 'lg'].map(s => (
              <ControlBtn key={s} active={size === s} title={`Size ${s.toUpperCase()}`} onClick={() => updateAttributes({ size: s })}>
                {s.toUpperCase()}
              </ControlBtn>
            ))}
            <span style={{ width: 1, height: 14, background: colors.line, margin: '0 3px' }} />
            {[['left', '⇤'], ['center', '↔'], ['right', '⇥']].map(([a, icon]) => (
              <ControlBtn key={a} active={align === a} title={`Align ${a}`} onClick={() => updateAttributes({ align: a })}>
                {icon}
              </ControlBtn>
            ))}
            <span style={{ width: 1, height: 14, background: colors.line, margin: '0 3px' }} />
            <ControlBtn title="Remove card" onClick={deleteNode}>✕</ControlBtn>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
