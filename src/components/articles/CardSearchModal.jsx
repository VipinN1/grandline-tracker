import { useState, useEffect, useRef } from 'react'
import { searchCards, getCardImageUrl } from '../../lib/optcgapi'
import { useWindowSize } from '../../hooks/useWindowSize'
import { colors, radius, input as inputStyle } from '../../theme'

// Search the card database by name or ID and pick a card.
export default function CardSearchModal({ title = 'Insert a Card', onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const { isMobile } = useWindowSize()
  const debounceRef = useRef(null)
  const requestRef = useRef(0)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    requestRef.current += 1
    if (q.trim().length < 2) { setResults([]); setSearched(false); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestRef.current
      const cards = await searchCards(q)
      if (reqId !== requestRef.current) return // stale response
      setResults(cards)
      setSearching(false)
      setSearched(true)
    }, 350)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161b27',
          border: `1px solid ${colors.line}`,
          borderRadius: isMobile ? '16px 16px 0 0' : radius.lg,
          width: isMobile ? '100%' : 680,
          maxHeight: isMobile ? '85vh' : '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${colors.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: colors.gold, marginBottom: 2 }}>Card Database</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, letterSpacing: '-0.3px' }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${colors.lineStrong}`, borderRadius: 6, color: colors.text, fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${colors.line}`, flexShrink: 0 }}>
          <input
            autoFocus
            type="text"
            placeholder="Search by card name or ID (e.g. Luffy, OP01-001)..."
            value={query}
            onChange={handleChange}
            style={{ ...inputStyle, fontSize: 13 }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {searching ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', fontSize: 13, color: colors.muted }}>Searching the archives…</div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: colors.faint }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>🃏</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.muted }}>
                {searched ? 'No cards found.' : 'Type at least 2 characters to search.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 90 : 104}px, 1fr))`, gap: 10 }}>
              {results.map(card => {
                const id = card.card_image_id ?? card.card_set_id
                return (
                  <div
                    key={id}
                    onClick={() => { onSelect(card); onClose() }}
                    style={{ cursor: 'pointer', borderRadius: 8, transition: 'transform 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <img
                      src={getCardImageUrl(card)}
                      alt={card.card_name}
                      loading="lazy"
                      style={{ width: '100%', borderRadius: 8, border: `1px solid ${colors.line}`, display: 'block', aspectRatio: '0.716', objectFit: 'cover', background: colors.surface }}
                      onError={e => { e.target.style.opacity = '0.15' }}
                    />
                    <div style={{ fontSize: 10, color: colors.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {card.card_name}
                    </div>
                    <div style={{ fontSize: 9, color: colors.faint, textAlign: 'center', fontFamily: 'monospace' }}>{card.card_set_id}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
