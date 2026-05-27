import { useState, useEffect, useRef } from 'react'
import { searchCards, searchLeaders, getCard, getCardImageUrl, enrichCards } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import { useNavigate } from 'react-router-dom'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }
const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']
const MAX_COPIES = 4
const MAX_DECK = 50

const INPUT = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(139,92,246,0.15)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#f0f2f5',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

function pillStyle(isActive, accentColor) {
  return {
    padding: '3px 9px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: isActive && accentColor ? `1px solid ${accentColor}66` : isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.15)',
    background: isActive && accentColor ? `${accentColor}26` : isActive ? 'rgba(139,92,246,0.2)' : 'transparent',
    color: isActive && accentColor ? accentColor : isActive ? '#a78bfa' : '#7c6fa0',
  }
}

function getAltArtType(card) {
  const name = (card.card_name ?? '').toLowerCase()
  const rarity = (card.card_rarity ?? '').toLowerCase()
  if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
  if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
  if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
  if (/parallel|alt[\s_]art|alternate[\s_]art/.test(name) || rarity === 'parallel' || rarity === 'p') return 'parallel'
  return null
}

export default function DeckBuilder({ session }) {
  const { isMobile } = useWindowSize()
  const navigate = useNavigate()

  // Deck state
  const [deckName, setDeckName] = useState('')
  const [leader, setLeader] = useState(null)
  const [deckCards, setDeckCards] = useState({}) // { [card_set_id]: { card, count } }

  // Card search
  const [cardQuery, setCardQuery] = useState('')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)

  // Leader search
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderResults, setLeaderResults] = useState([])
  const [leaderSearching, setLeaderSearching] = useState(false)
  const [showLeaderDrop, setShowLeaderDrop] = useState(false)

  // Filters
  const [filterColor, setFilterColor] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAltArt, setFilterAltArt] = useState('')
  const [filterCost, setFilterCost] = useState(null)

  // UI state
  const [mobileTab, setMobileTab] = useState('search')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const cardDebounce = useRef(null)
  const leaderDebounce = useRef(null)
  const leaderRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (leaderRef.current && !leaderRef.current.contains(e.target)) setShowLeaderDrop(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleCardQuery(val) {
    setCardQuery(val)
    clearTimeout(cardDebounce.current)
    if (val.length < 2) { setCardResults([]); return }
    cardDebounce.current = setTimeout(async () => {
      setCardSearching(true)
      try { setCardResults(await searchCards(val)) }
      catch { setCardResults([]) }
      setCardSearching(false)
    }, 350)
  }

  function handleLeaderQuery(val) {
    setLeaderQuery(val)
    setShowLeaderDrop(true)
    clearTimeout(leaderDebounce.current)
    if (val.length < 2) { setLeaderResults([]); return }
    leaderDebounce.current = setTimeout(async () => {
      setLeaderSearching(true)
      try { setLeaderResults(await searchLeaders(val)) }
      catch { setLeaderResults([]) }
      setLeaderSearching(false)
    }, 350)
  }

  const totalCards = Object.values(deckCards).reduce((s, e) => s + e.count, 0)

  function addCard(card) {
    const key = card.card_set_id
    if (!key) return
    setDeckCards(prev => {
      const existing = prev[key]
      const currTotal = Object.values(prev).reduce((s, e) => s + e.count, 0)
      if (existing && existing.count >= MAX_COPIES) return prev
      if (currTotal >= MAX_DECK) return prev
      return { ...prev, [key]: { card, count: (existing?.count ?? 0) + 1 } }
    })
    if (isMobile) setMobileTab('deck')
  }

  function adjustCount(key, delta) {
    setDeckCards(prev => {
      const existing = prev[key]
      if (!existing) return prev
      const currTotal = Object.values(prev).reduce((s, e) => s + e.count, 0)
      const newCount = existing.count + delta
      if (newCount <= 0) { const next = { ...prev }; delete next[key]; return next }
      if (newCount > MAX_COPIES) return prev
      if (delta > 0 && currTotal >= MAX_DECK) return prev
      return { ...prev, [key]: { ...existing, count: newCount } }
    })
  }

  function exportDeck() {
    const lines = []
    if (leader) lines.push(`Leader: ${leader.card_set_id}`)
    Object.values(deckCards).forEach(({ card, count }) => lines.push(`${count}x${card.card_set_id}`))
    const text = lines.join('\n')
    navigator.clipboard?.writeText(text).catch(() => {})
    setSaveMsg('Copied!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true); setError('')
    try {
      let leaderIdRaw = null
      const cardLines = []
      for (const line of importText.trim().split('\n')) {
        const t = line.trim()
        const lm = t.match(/^[Ll]eader:\s*([A-Z0-9-]+)/i)
        const cm = t.match(/^(\d+)[xX]([A-Z0-9-]+)$/i)
        if (lm) leaderIdRaw = lm[1].toUpperCase()
        else if (cm) cardLines.push({ id: cm[2].toUpperCase(), count: parseInt(cm[1]), name: cm[2].toUpperCase() })
      }
      if (leaderIdRaw) {
        try { const c = await getCard(leaderIdRaw); if (c) setLeader(c) } catch {}
      }
      if (cardLines.length > 0) {
        const enriched = await enrichCards(cardLines)
        const deck = {}
        for (const c of enriched) {
          deck[c.id] = {
            card: { card_set_id: c.id, card_name: c.name, card_color: c.color, card_type: c.type, card_image: c.image },
            count: Math.min(c.count, MAX_COPIES),
          }
        }
        setDeckCards(deck)
      }
      setShowImport(false); setImportText('')
    } catch { setError('Failed to import. Check the format and try again.') }
    setImporting(false)
  }

  async function handleSave() {
    if (!deckName.trim()) { setError('Enter a deck name.'); return }
    if (!leader) { setError('Select a leader first.'); return }
    setSaving(true); setError('')
    const cards = Object.values(deckCards).map(({ card, count }) => ({
      id: card.card_set_id,
      name: card.card_name ?? card.card_set_id,
      count,
      type: card.card_type ?? null,
      color: card.card_color ?? null,
      image: card.card_image ?? null,
    }))
    const { error: err } = await supabase.from('decklists').insert({
      user_id: session.user.id,
      name: deckName.trim(),
      leader_id: leader.card_set_id,
      leader_name: leader.card_name,
      leader_color: leader.card_color,
      cards,
    })
    setSaving(false)
    if (err) { setError('Failed to save. ' + err.message); return }
    navigate('/decklists')
  }

  // Client-side filter (same logic as Marketplace)
  const filteredResults = cardResults.filter(card => {
    if (filterColor.length > 0) {
      const cc = (card.card_color ?? '').split(/[\s/]+/).map(c => c.trim()).filter(Boolean)
      if (!filterColor.every(fc => cc.some(c => c.toLowerCase() === fc.toLowerCase()))) return false
    }
    if (filterType && card.card_type !== filterType) return false
    const id = card.card_set_id ?? ''
    if (filterSource === 'ST' && !/^ST/i.test(id)) return false
    if (filterSource === 'Promos' && !/^P-/i.test(id)) return false
    if (filterSource && filterSource !== 'ST' && filterSource !== 'Promos' && !id.toUpperCase().startsWith(filterSource)) return false
    if (filterAltArt && getAltArtType(card) !== filterAltArt) return false
    if (filterCost !== null && String(card.card_cost ?? '') !== String(filterCost)) return false
    return true
  })

  const deckEntries = Object.entries(deckCards)
  const grouped = [
    ['Character', deckEntries.filter(([, { card }]) => card.card_type === 'Character')],
    ['Event', deckEntries.filter(([, { card }]) => card.card_type === 'Event')],
    ['Stage', deckEntries.filter(([, { card }]) => card.card_type === 'Stage')],
    ['Other', deckEntries.filter(([, { card }]) => !['Character', 'Event', 'Stage'].includes(card.card_type))],
  ]

  // ─── Search panel ─────────────────────────────────────────────────────────────
  const searchPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter pills */}
      <div style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Color */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {[['', 'All'], ...CARD_COLORS.map(c => [c, c])].map(([val, label]) => {
            const isActive = val === '' ? filterColor.length === 0 : filterColor.includes(val)
            const atMax = filterColor.length >= 2 && !isActive && val !== ''
            return (
              <button key={val || 'c-all'} onClick={() => {
                if (val === '') { setFilterColor([]); return }
                setFilterColor(prev => prev.includes(val) ? prev.filter(x => x !== val) : prev.length < 2 ? [...prev, val] : prev)
              }} style={{ ...pillStyle(isActive, COLORS[val]), opacity: atMax ? 0.3 : 1, cursor: atMax ? 'default' : 'pointer' }}>{label}</button>
            )
          })}
          {filterColor.length > 0 && <span style={{ fontSize: 10, color: '#3d2d6e' }}>up to 2</span>}
        </div>
        {/* Type */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[['', 'All Types'], ['Leader', 'Leader'], ['Character', 'Character'], ['Event', 'Event'], ['Stage', 'Stage']].map(([val, label]) => (
            <button key={val || 't-all'} onClick={() => setFilterType(val)} style={pillStyle(filterType === val, null)}>{label}</button>
          ))}
        </div>
        {/* Source */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setFilterSource('')} style={pillStyle(filterSource === '', null)}>All</button>
          <select
            value={['', 'ST', 'Promos'].includes(filterSource) ? '' : filterSource}
            onChange={e => setFilterSource(e.target.value)}
            style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', background: !['', 'ST', 'Promos'].includes(filterSource) ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)', border: !['', 'ST', 'Promos'].includes(filterSource) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.15)', color: !['', 'ST', 'Promos'].includes(filterSource) ? '#a78bfa' : '#7c6fa0' }}
          >
            <option value="">Booster Sets</option>
            {['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP09','OP10','OP11','OP12','OP13','OP14','OP15','EB01','EB02','EB03','EB04','PRB01','PRB02'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setFilterSource('ST')} style={pillStyle(filterSource === 'ST', null)}>Starter Decks</button>
          <button onClick={() => setFilterSource('Promos')} style={pillStyle(filterSource === 'Promos', null)}>Promos</button>
        </div>
        {/* Alt Art */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[['', 'All'], ['parallel', 'Parallel'], ['sp', 'SP'], ['manga', 'Manga'], ['tr', 'TR']].map(([val, label]) => {
            const ac = { parallel: '#e879f9', sp: '#34d399', manga: '#38bdf8', tr: '#f97316' }[val]
            return <button key={val || 'a-all'} onClick={() => setFilterAltArt(val)} style={pillStyle(filterAltArt === val, ac)}>{label}</button>
          })}
        </div>
        {/* Cost */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setFilterCost(null)} style={pillStyle(filterCost === null, null)}>All Costs</button>
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => setFilterCost(filterCost === n ? null : n)} style={pillStyle(filterCost === n, null)}>{n}</button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <input
        type="text"
        placeholder="Search cards by name or ID..."
        value={cardQuery}
        onChange={e => handleCardQuery(e.target.value)}
        style={{ ...INPUT, padding: '10px 14px', fontSize: 14 }}
      />

      {/* Status */}
      {cardSearching && <div style={{ fontSize: 12, color: '#7c6fa0' }}>Searching...</div>}
      {!cardSearching && cardQuery.length >= 2 && filteredResults.length === 0 && (
        <div style={{ fontSize: 12, color: '#3d2d6e' }}>No cards found. Try adjusting filters or your query.</div>
      )}
      {cardQuery.length < 2 && (
        <div style={{ fontSize: 12, color: '#3d2d6e' }}>Type at least 2 characters to search</div>
      )}

      {/* Results grid */}
      {filteredResults.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {filteredResults.map(card => {
            const key = card.card_set_id
            const inDeck = deckCards[key]
            const atMax = inDeck && inDeck.count >= MAX_COPIES
            const atLimit = totalCards >= MAX_DECK
            const disabled = atMax || atLimit
            return (
              <div
                key={card.card_image_id ?? card.card_set_id}
                onClick={() => !disabled && addCard(card)}
                title={`${card.card_name} — ${card.card_set_id}${card.card_cost ? ` · Cost ${card.card_cost}` : ''}${inDeck ? ` · ${inDeck.count}/${MAX_COPIES} in deck` : ''}`}
                style={{ position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: atMax ? 0.4 : 1, transition: 'transform 0.1s, opacity 0.1s', flexShrink: 0 }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'scale(1.07)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <img
                  src={getCardImageUrl(card)}
                  alt={card.card_name}
                  style={{ width: 68, borderRadius: 6, border: inDeck ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)', display: 'block' }}
                  onError={e => { e.target.style.opacity = '0.12' }}
                />
                {inDeck && (
                  <div style={{ position: 'absolute', bottom: 3, right: 3, background: '#8b5cf6', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 4px', lineHeight: 1.4 }}>
                    {inDeck.count}
                  </div>
                )}
                {atMax && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(0,0,0,0.7)', padding: '2px 4px', borderRadius: 3 }}>MAX</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Deck panel ───────────────────────────────────────────────────────────────
  const deckPanel = (
    <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Leader section */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 8 }}>Leader</div>
        {leader ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={getCardImageUrl(leader)} alt={leader.card_name} style={{ width: 44, borderRadius: 6, border: `2px solid ${COLORS[leader.card_color] ?? '#8b5cf6'}44`, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader.card_name}</div>
              <div style={{ fontSize: 11, marginTop: 1 }}>
                <span style={{ color: COLORS[leader.card_color] ?? '#7c6fa0' }}>{leader.card_color}</span>
                <span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span>
                <span style={{ color: '#7c6fa0', fontFamily: 'monospace' }}>{leader.card_set_id}</span>
              </div>
            </div>
            <button onClick={() => setLeader(null)} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
          </div>
        ) : (
          <div ref={leaderRef} style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search for a leader..."
              value={leaderQuery}
              onChange={e => handleLeaderQuery(e.target.value)}
              onFocus={() => leaderQuery.length >= 2 && setShowLeaderDrop(true)}
              style={{ ...INPUT, padding: '8px 11px', fontSize: 12 }}
            />
            {showLeaderDrop && leaderQuery.length >= 2 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, background: 'rgba(12,8,20,0.98)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {leaderSearching ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#7c6fa0' }}>Searching...</div>
                ) : leaderResults.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#3d2d6e' }}>No leaders found</div>
                ) : leaderResults.map(card => (
                  <div
                    key={card.card_image_id ?? card.card_set_id}
                    onClick={() => { setLeader(card); setLeaderQuery(''); setLeaderResults([]); setShowLeaderDrop(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 32, borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.card_name}</div>
                      <div style={{ fontSize: 10, color: '#7c6fa0' }}>
                        <span style={{ color: COLORS[card.card_color] ?? '#7c6fa0' }}>{card.card_color}</span>
                        <span style={{ color: '#3d2d6e', margin: '0 3px' }}>·</span>
                        <span style={{ fontFamily: 'monospace' }}>{card.card_set_id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12, color: '#7c6fa0', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: totalCards === MAX_DECK ? '#34d399' : '#f0f2f5' }}>{totalCards}</span>
          <span style={{ color: '#3d2d6e' }}> / {MAX_DECK}</span>
        </div>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: totalCards === MAX_DECK ? '#34d399' : 'linear-gradient(90deg, #7c3aed, #a855f7)', width: `${Math.min((totalCards / MAX_DECK) * 100, 100)}%`, transition: 'width 0.2s' }} />
        </div>
        {deckEntries.length > 0 && (
          <button onClick={() => setDeckCards({})} style={{ fontSize: 10, color: '#f05252', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600, flexShrink: 0 }}>Clear</button>
        )}
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: isMobile ? 280 : 380 }}>
        {deckEntries.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: '#3d2d6e', fontSize: 12 }}>
            Click cards in the search panel to add them here
          </div>
        ) : grouped.map(([type, entries]) => entries.length === 0 ? null : (
          <div key={type}>
            <div style={{ padding: '5px 14px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              {type} ({entries.reduce((s, [, e]) => s + e.count, 0)})
            </div>
            {entries.map(([key, { card, count }]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 28, borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.12' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.card_name}</div>
                  <div style={{ fontSize: 10, color: '#3d2d6e', fontFamily: 'monospace' }}>{card.card_set_id}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <button
                    onClick={() => adjustCount(key, -1)}
                    style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f0f2f5', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}
                  >−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', minWidth: 16, textAlign: 'center' }}>{count}</span>
                  <button
                    onClick={() => adjustCount(key, 1)}
                    disabled={count >= MAX_COPIES || totalCards >= MAX_DECK}
                    style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: count >= MAX_COPIES || totalCards >= MAX_DECK ? 'transparent' : 'rgba(255,255,255,0.05)', color: count >= MAX_COPIES || totalCards >= MAX_DECK ? '#3d2d6e' : '#f0f2f5', fontSize: 14, cursor: count >= MAX_COPIES || totalCards >= MAX_DECK ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(139,92,246,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="Deck name..."
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          style={{ ...INPUT, padding: '8px 11px', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={exportDeck}
            style={{ flex: 1, padding: '7px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f0f2f5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >Export</button>
          <button
            onClick={() => setShowImport(true)}
            style={{ flex: 1, padding: '7px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f0f2f5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >Import</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: '7px 6px', borderRadius: 8, border: 'none', background: saving ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: saving ? '#7c6fa0' : '#fff', fontSize: 11, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >{saving ? 'Saving...' : saveMsg || 'Save Deck'}</button>
        </div>
        {error && <div style={{ fontSize: 11, color: '#f05252' }}>{error}</div>}
      </div>
    </div>
  )

  // ─── Import modal ─────────────────────────────────────────────────────────────
  const importModal = showImport && (
    <div onClick={() => setShowImport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, width: Math.min(460, window.innerWidth - 32), padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Import Decklist</div>
        <div style={{ fontSize: 12, color: '#7c6fa0', lineHeight: 1.6 }}>
          One card per line in the format <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>4xOP01-001</span>. Optionally include a leader line: <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>Leader: OP01-001</span>
        </div>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder={'Leader: OP01-001\n4xOP01-002\n3xOP01-003\n...'}
          style={{ ...INPUT, minHeight: 180, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          autoFocus
        />
        {error && <div style={{ fontSize: 11, color: '#f05252' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowImport(false); setImportText(''); setError('') }} style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button
            onClick={handleImport}
            disabled={!importText.trim() || importing}
            style={{ flex: 2, padding: 9, borderRadius: 8, border: 'none', background: importText.trim() && !importing ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)', color: importText.trim() && !importing ? '#fff' : '#7c6fa0', fontSize: 13, fontWeight: 700, cursor: importText.trim() && !importing ? 'pointer' : 'default', fontFamily: 'inherit' }}
          >{importing ? 'Importing...' : 'Import'}</button>
        </div>
      </div>
    </div>
  )

  // ─── Page layout ──────────────────────────────────────────────────────────────
  return (
    <div>
      {importModal}

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Builder</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px' }}>Deck Builder</div>
        <div style={{ fontSize: 13, color: '#7c6fa0', marginTop: 2 }}>Build and save your competitive decklists</div>
      </div>

      {isMobile ? (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
            {[['search', 'Card Search'], ['deck', `Deck (${totalCards}/${MAX_DECK})`]].map(([tab, label]) => (
              <button key={tab} onClick={() => setMobileTab(tab)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: mobileTab === tab ? 'rgba(139,92,246,0.2)' : 'transparent', color: mobileTab === tab ? '#a78bfa' : '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>
          {mobileTab === 'search' ? searchPanel : deckPanel}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{searchPanel}</div>
          <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 68 }}>{deckPanel}</div>
        </div>
      )}
    </div>
  )
}
