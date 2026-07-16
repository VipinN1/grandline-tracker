import { useState, useEffect, useRef } from 'react'
import { searchCards, getCardImageUrl } from '../../lib/optcgapi'
import { COLORS, CARD_COLORS, BOOSTER_SETS, ALT_ART_OPTIONS, ALT_ART_ACCENTS, pillStyle, filterCards } from '../../lib/cardFilters'
import { useWindowSize } from '../../hooks/useWindowSize'
import { colors, radius, input as inputStyle } from '../../theme'

// Search the card database by name or ID and pick a card.
// Same filters as the Deck Builder search panel (color / type / set / alt art / cost).
export default function CardSearchModal({ title = 'Insert a Card', onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterColor, setFilterColor] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAltArt, setFilterAltArt] = useState('')
  const [filterCost, setFilterCost] = useState(null)
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

  const filtered = filterCards(results, {
    colors: filterColor,
    type: filterType,
    source: filterSource,
    altArt: filterAltArt,
    cost: filterCost,
  })

  const activeFilterCount =
    (filterColor.length > 0 ? 1 : 0) + (filterType ? 1 : 0) + (filterSource ? 1 : 0) +
    (filterAltArt ? 1 : 0) + (filterCost !== null ? 1 : 0)

  function clearFilters() {
    setFilterColor([])
    setFilterType('')
    setFilterSource('')
    setFilterAltArt('')
    setFilterCost(null)
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
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder="Search by card name or ID (e.g. Luffy, OP01-001)..."
              value={query}
              onChange={handleChange}
              style={{ ...inputStyle, fontSize: 13 }}
            />
            <button
              onClick={() => setShowFilters(f => !f)}
              style={{
                flexShrink: 0,
                padding: '0 14px',
                borderRadius: radius.sm,
                border: `1px solid ${showFilters || activeFilterCount ? colors.goldLine : colors.lineStrong}`,
                background: showFilters || activeFilterCount ? colors.goldSoft : 'transparent',
                color: showFilters || activeFilterCount ? colors.gold : colors.muted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          </div>

          {showFilters && (
            <div style={{ marginTop: 10, background: 'rgba(140,176,208,0.03)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                {[['', 'All'], ...CARD_COLORS.map(c => [c, c])].map(([val, label]) => {
                  const isActive = val === '' ? filterColor.length === 0 : filterColor.includes(val)
                  return (
                    <button key={val || 'c-all'} onClick={() => {
                      if (val === '') { setFilterColor([]); return }
                      setFilterColor(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
                    }} style={pillStyle(isActive, COLORS[val])}>{label}</button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[['', 'All Types'], ['Leader', 'Leader'], ['Character', 'Character'], ['Event', 'Event'], ['Stage', 'Stage']].map(([val, label]) => (
                  <button key={val || 't-all'} onClick={() => setFilterType(val)} style={pillStyle(filterType === val, null)}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setFilterSource('')} style={pillStyle(filterSource === '', null)}>All</button>
                <select
                  value={['', 'ST', 'Promos'].includes(filterSource) ? '' : filterSource}
                  onChange={e => setFilterSource(e.target.value)}
                  style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', background: !['', 'ST', 'Promos'].includes(filterSource) ? 'rgba(200,162,74,0.3)' : 'rgba(26,50,81,0.85)', border: !['', 'ST', 'Promos'].includes(filterSource) ? '1px solid rgba(200,162,74,0.5)' : '1px solid rgba(200,162,74,0.3)', color: !['', 'ST', 'Promos'].includes(filterSource) ? '#52a9cd' : '#9db2c6' }}
                >
                  <option value="">Booster Sets</option>
                  {BOOSTER_SETS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setFilterSource('ST')} style={pillStyle(filterSource === 'ST', null)}>Starter Decks</button>
                <button onClick={() => setFilterSource('Promos')} style={pillStyle(filterSource === 'Promos', null)}>Promos</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ALT_ART_OPTIONS.map(([val, label]) => (
                  <button key={val || 'a-all'} onClick={() => setFilterAltArt(val)} style={pillStyle(filterAltArt === val, ALT_ART_ACCENTS[val])}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setFilterCost(null)} style={pillStyle(filterCost === null, null)}>All Costs</button>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button key={n} onClick={() => setFilterCost(filterCost === n ? null : n)} style={pillStyle(filterCost === n, null)}>{n}</button>
                ))}
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} style={{ ...pillStyle(false, null), marginLeft: 'auto', color: colors.crimson, border: '1px solid rgba(210,74,58,0.3)' }}>
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {searching ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', fontSize: 13, color: colors.muted }}>Searching the archives…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: colors.faint }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>🃏</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.muted }}>
                {searched
                  ? results.length > 0
                    ? 'No cards match your filters.'
                    : 'No cards found.'
                  : 'Type at least 2 characters to search.'}
              </div>
              {searched && results.length > 0 && activeFilterCount > 0 && (
                <button onClick={clearFilters} style={{ ...pillStyle(false, null), marginTop: 10 }}>Clear filters</button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 90 : 104}px, 1fr))`, gap: 10 }}>
              {filtered.map(card => {
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
