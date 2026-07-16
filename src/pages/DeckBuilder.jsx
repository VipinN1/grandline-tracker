import { useState, useEffect, useRef } from 'react'
import { searchCards, searchLeaders, getCard, getCardImageUrl, enrichCards } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import { useNavigate, useLocation } from 'react-router-dom'
import { COLORS, CARD_COLORS, BOOSTER_SETS, ALT_ART_OPTIONS, ALT_ART_ACCENTS, pillStyle, filterCards } from '../lib/cardFilters'

const MAX_COPIES = 4
const MAX_DECK = 50

const INPUT = {
  background: 'rgba(26,50,81,0.92)',
  border: '1px solid rgba(200,162,74,0.35)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#e9f1f8',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

export default function DeckBuilder({ session }) {
  const { isMobile } = useWindowSize()
  const navigate = useNavigate()

  const [deckName, setDeckName] = useState('')
  const [leader, setLeader] = useState(null)
  const [deckCards, setDeckCards] = useState({})

  const [cardQuery, setCardQuery] = useState('')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)

  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderResults, setLeaderResults] = useState([])
  const [leaderSearching, setLeaderSearching] = useState(false)
  const [showLeaderDrop, setShowLeaderDrop] = useState(false)

  const [filterColor, setFilterColor] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAltArt, setFilterAltArt] = useState('')
  const [filterCost, setFilterCost] = useState(null)

  const [mobileTab, setMobileTab] = useState('search')
  const [deckView, setDeckView] = useState('list')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [hoverPreview, setHoverPreview] = useState(null)
  const [editingDeckId, setEditingDeckId] = useState(null)

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

const location = useLocation()

  useEffect(() => {
    if (location.state?.deck) {
      const { deck } = location.state
      setEditingDeckId(deck.id ?? null)
      setDeckName(deck.name ?? '')
      if (deck.leader_id) {
        setLeader({ card_set_id: deck.leader_id, card_name: deck.leader_name, card_color: deck.leader_color })
      }
      if (deck.cards?.length > 0) {
        const built = {}
        for (const c of deck.cards) {
          built[c.id] = {
            card: { card_set_id: c.id, card_name: c.name, card_color: c.color, card_type: c.type, card_image: c.image },
            count: c.count,
          }
        }
        setDeckCards(built)
      }
    }
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

  function showPreview(card, e) {
    if (isMobile) return
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverPreview({ imageUrl: getCardImageUrl(card), name: card.card_name, rect })
  }
  function hidePreview() { setHoverPreview(null) }

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
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
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
    if (!session) { navigate('/login'); return }
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

    if (editingDeckId) {
      const { error: err } = await supabase.from('decklists').update({
        name: deckName.trim(),
        leader_id: leader.card_set_id,
        leader_name: leader.card_name,
        leader_color: leader.card_color,
        cards,
        updated_at: new Date().toISOString(),
      }).eq('id', editingDeckId)
      setSaving(false)
      if (err) { setError('Failed to save. ' + err.message); return }
    } else {
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
    }

    navigate('/decklists')
  }

  const filteredResults = filterCards(cardResults, {
    colors: filterColor,
    type: filterType,
    source: filterSource,
    altArt: filterAltArt,
    cost: filterCost,
  })

  const deckEntries = Object.entries(deckCards)
  const grouped = [
    ['Character', deckEntries.filter(([, { card }]) => card.card_type === 'Character')],
    ['Event', deckEntries.filter(([, { card }]) => card.card_type === 'Event')],
    ['Stage', deckEntries.filter(([, { card }]) => card.card_type === 'Stage')],
    ['Other', deckEntries.filter(([, { card }]) => !['Character', 'Event', 'Stage'].includes(card.card_type))],
  ]

  const cardThumb = isMobile ? 68 : 90
  const visualThumb = isMobile ? 56 : 82
  const listMaxH = isMobile ? 260 : 'calc(100vh - 390px)'

  // ─── Search panel ─────────────────────────────────────────────────────────────
  const searchPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter pills */}
      <div style={{ background: 'rgba(140,176,208,0.03)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => setFilterCost(filterCost === n ? null : n)} style={pillStyle(filterCost === n, null)}>{n}</button>
          ))}
        </div>
      </div>

      <input
        type="text"
        placeholder="Search cards by name or ID..."
        value={cardQuery}
        onChange={e => handleCardQuery(e.target.value)}
        style={{ ...INPUT, padding: '10px 14px', fontSize: 14 }}
      />

      {cardSearching && <div style={{ fontSize: 12, color: '#9db2c6' }}>Searching...</div>}
      {!cardSearching && cardQuery.length >= 2 && filteredResults.length === 0 && (
        <div style={{ fontSize: 12, color: '#67809a' }}>No cards found. Try adjusting filters or your query.</div>
      )}
      {cardQuery.length < 2 && (
        <div style={{ fontSize: 12, color: '#67809a' }}>Type at least 2 characters to search</div>
      )}

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
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'scale(1.06)'; showPreview(card, e) }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; hidePreview() }}
              >
                <img
                  src={getCardImageUrl(card)}
                  alt={card.card_name}
                  style={{ width: cardThumb, borderRadius: 7, border: inDeck ? '2px solid #2f7da3' : '1px solid rgba(140,176,208,0.08)', display: 'block' }}
                  onError={e => { e.target.style.opacity = '0.12' }}
                />
                {inDeck && (
                  <div style={{ position: 'absolute', bottom: 3, right: 3, background: '#2f7da3', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 4px', lineHeight: 1.4 }}>
                    {inDeck.count}
                  </div>
                )}
                {atMax && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 7, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#52a9cd', background: 'rgba(0,0,0,0.7)', padding: '2px 4px', borderRadius: 3 }}>MAX</span>
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
    <div style={{ background: 'rgba(140,176,208,0.04)', border: '1px solid rgba(140,176,208,0.12)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Leader */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(140,176,208,0.1)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#67809a', marginBottom: 8 }}>Leader</div>
        {leader ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={getCardImageUrl(leader)} alt={leader.card_name} style={{ width: 56, borderRadius: 7, border: `2px solid ${COLORS[leader.card_color] ?? '#2f7da3'}44`, flexShrink: 0, cursor: 'default' }} onError={e => { e.target.style.opacity = '0.2' }} onMouseEnter={e => showPreview(leader, e)} onMouseLeave={hidePreview} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader.card_name}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                <span style={{ color: COLORS[leader.card_color] ?? '#9db2c6' }}>{leader.card_color}</span>
                <span style={{ color: '#67809a', margin: '0 4px' }}>·</span>
                <span style={{ color: '#9db2c6', fontFamily: 'monospace' }}>{leader.card_set_id}</span>
              </div>
            </div>
            <button onClick={() => setLeader(null)} style={{ background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
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
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, background: 'rgba(10,22,38,0.98)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                {leaderSearching ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#9db2c6' }}>Searching...</div>
                ) : leaderResults.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#67809a' }}>No leaders found</div>
                ) : leaderResults.map(card => (
                  <div
                    key={card.card_image_id ?? card.card_set_id}
                    onClick={() => { setLeader(card); setLeaderQuery(''); setLeaderResults([]); setShowLeaderDrop(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(140,176,208,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 32, borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.card_name}</div>
                      <div style={{ fontSize: 10, color: '#9db2c6' }}>
                        <span style={{ color: COLORS[card.card_color] ?? '#9db2c6' }}>{card.card_color}</span>
                        <span style={{ color: '#67809a', margin: '0 3px' }}>·</span>
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

      {/* Progress */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(140,176,208,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12, color: '#9db2c6', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: totalCards === MAX_DECK ? '#3bb27e' : '#e9f1f8' }}>{totalCards}</span>
          <span style={{ color: '#67809a' }}> / {MAX_DECK}</span>
        </div>
        <div style={{ flex: 1, height: 4, background: 'rgba(140,176,208,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: totalCards === MAX_DECK ? '#3bb27e' : 'linear-gradient(90deg, #2f7da3, #1b4a66)', width: `${Math.min((totalCards / MAX_DECK) * 100, 100)}%`, transition: 'width 0.2s' }} />
        </div>
        {deckEntries.length > 0 && (
          <button onClick={() => setDeckCards({})} style={{ fontSize: 10, color: '#d24a3a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600, flexShrink: 0 }}>Clear</button>
        )}
      </div>

      {/* View toggle */}
      <div style={{ padding: '6px 12px 0', display: 'flex', gap: 4, borderBottom: '1px solid rgba(140,176,208,0.08)' }}>
        {[['list', 'List'], ['visual', 'Visual']].map(([v, label]) => (
          <button key={v} onClick={() => setDeckView(v)} style={{ ...pillStyle(deckView === v, null), fontSize: 10, marginBottom: 6 }}>{label}</button>
        ))}
      </div>

      {/* Card display */}
      {deckView === 'list' ? (
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: listMaxH }}>
          {deckEntries.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#67809a', fontSize: 12 }}>
              Click cards in the search panel to add them here
            </div>
          ) : grouped.map(([type, entries]) => entries.length === 0 ? null : (
            <div key={type}>
              <div style={{ padding: '5px 14px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#67809a', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(140,176,208,0.03)' }}>
                {type} ({entries.reduce((s, [, e]) => s + e.count, 0)})
              </div>
              {entries.map(([key, { card, count }]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid rgba(140,176,208,0.03)' }} onMouseEnter={e => showPreview(card, e)} onMouseLeave={hidePreview}>
                  <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 32, borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.12' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.card_name}</div>
                    <div style={{ fontSize: 10, color: '#67809a', fontFamily: 'monospace' }}>{card.card_set_id}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <button
                      onClick={() => adjustCount(key, -1)}
                      style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(140,176,208,0.1)', background: 'rgba(140,176,208,0.05)', color: '#e9f1f8', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}
                    >−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#52a9cd', minWidth: 18, textAlign: 'center' }}>{count}</span>
                    <button
                      onClick={() => adjustCount(key, 1)}
                      disabled={count >= MAX_COPIES || totalCards >= MAX_DECK}
                      style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(140,176,208,0.1)', background: count >= MAX_COPIES || totalCards >= MAX_DECK ? 'transparent' : 'rgba(140,176,208,0.05)', color: count >= MAX_COPIES || totalCards >= MAX_DECK ? '#67809a' : '#e9f1f8', fontSize: 15, cursor: count >= MAX_COPIES || totalCards >= MAX_DECK ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: listMaxH, padding: '12px 14px' }}>
          {deckEntries.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#67809a', fontSize: 12, paddingTop: 28 }}>
              Click cards in the search panel to add them here
            </div>
          ) : (
            <>
              {grouped.map(([type, entries]) => entries.length === 0 ? null : (
                <div key={type} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#67809a', marginBottom: 7 }}>
                    {type} ({entries.reduce((s, [, e]) => s + e.count, 0)})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {entries.map(([key, { card, count }]) => (
                      <div
                        key={key}
                        style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.1s' }}
                        onClick={() => adjustCount(key, 1)}
                        onContextMenu={e => { e.preventDefault(); adjustCount(key, -1) }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; showPreview(card, e) }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; hidePreview() }}
                        title={`${card.card_name} · ${count}/${MAX_COPIES} — click +1, right-click −1`}
                      >
                        <img
                          src={getCardImageUrl(card)}
                          alt={card.card_name}
                          style={{ width: visualThumb, borderRadius: 6, border: `1px solid ${COLORS[card.card_color] ?? 'rgba(140,176,208,0.08)'}55`, display: 'block' }}
                          onError={e => { e.target.style.opacity = '0.12' }}
                        />
                        <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.8)', color: '#52a9cd', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '1px 4px', lineHeight: 1.4 }}>{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 10, color: '#67809a', marginTop: 4 }}>Click +1 · Right-click −1</div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(140,176,208,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="Deck name..."
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          style={{ ...INPUT, padding: '9px 12px', fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportDeck} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: 'rgba(140,176,208,0.04)', color: '#e9f1f8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Export</button>
          <button onClick={() => setShowImport(true)} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: 'rgba(140,176,208,0.04)', color: '#e9f1f8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Import</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '8px 6px', borderRadius: 8, border: 'none', background: saving ? 'rgba(140,176,208,0.05)' : 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: saving ? '#9db2c6' : '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving...' : saveMsg || (editingDeckId ? 'Save Changes' : session ? 'Save Deck' : 'Sign in to Save')}
          </button>
        </div>
        {error && <div style={{ fontSize: 11, color: '#d24a3a' }}>{error}</div>}
      </div>
    </div>
  )

  // ─── Import modal ─────────────────────────────────────────────────────────────
  const importModal = showImport && (
    <div onClick={() => setShowImport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#06101b', border: '1px solid rgba(140,176,208,0.2)', borderRadius: 16, width: Math.min(460, window.innerWidth - 32), padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e9f1f8' }}>Import Decklist</div>
        <div style={{ fontSize: 12, color: '#9db2c6', lineHeight: 1.6 }}>
          One card per line: <span style={{ fontFamily: 'monospace', color: '#52a9cd' }}>4xOP01-001</span>. Leader line: <span style={{ fontFamily: 'monospace', color: '#52a9cd' }}>Leader: OP01-001</span>
        </div>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder={'Leader: OP01-001\n4xOP01-002\n3xOP01-003\n...'}
          style={{ ...INPUT, minHeight: 180, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          autoFocus
        />
        {error && <div style={{ fontSize: 11, color: '#d24a3a' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowImport(false); setImportText(''); setError('') }} style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: 'transparent', color: '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleImport} disabled={!importText.trim() || importing} style={{ flex: 2, padding: 9, borderRadius: 8, border: 'none', background: importText.trim() && !importing ? 'linear-gradient(135deg, #2f7da3, #1b4a66)' : 'rgba(140,176,208,0.05)', color: importText.trim() && !importing ? '#fff' : '#9db2c6', fontSize: 13, fontWeight: 700, cursor: importText.trim() && !importing ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Page layout ──────────────────────────────────────────────────────────────
  const header = (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#dcb35e', marginBottom: 4 }}>Builder</div>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, color: '#e9f1f8', letterSpacing: '-0.3px' }}>Deck Builder</div>
      <div style={{ fontSize: 13, color: '#9db2c6', marginTop: 2 }}>Build and save your competitive decklists</div>
    </div>
  )

  const previewEl = hoverPreview && (() => {
    const { imageUrl, name, rect } = hoverPreview
    const W = 210
    const MARGIN = 14
    const imgH = W * 1.4
    let left = rect.right + MARGIN
    if (left + W > window.innerWidth - 10) left = rect.left - W - MARGIN
    let top = rect.top + rect.height / 2 - imgH / 2
    top = Math.max(10, Math.min(top, window.innerHeight - imgH - 10))
    return (
      <div style={{ position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none', width: W, background: 'rgba(8,16,27,0.95)', border: '1px solid rgba(200,162,74,0.3)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', padding: 6 }}>
        <img src={imageUrl} alt={name} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
      </div>
    )
  })()

  return (
    <div>
      {previewEl}
      {importModal}

      {isMobile ? (
        <>
          {header}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'rgba(140,176,208,0.03)', borderRadius: 10, padding: 4 }}>
            {[['search', 'Card Search'], ['deck', `Deck (${totalCards}/${MAX_DECK})`]].map(([tab, label]) => (
              <button key={tab} onClick={() => setMobileTab(tab)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: mobileTab === tab ? 'rgba(140,176,208,0.2)' : 'transparent', color: mobileTab === tab ? '#52a9cd' : '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>
          {mobileTab === 'search' ? searchPanel : deckPanel}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {header}
            {searchPanel}
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: 68 }}>
            {deckPanel}
          </div>
        </div>
      )}
    </div>
  )
}
