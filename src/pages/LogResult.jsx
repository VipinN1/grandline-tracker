import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl, enrichCards, searchLeaders } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useWindowSize } from '../hooks/useWindowSize'

const inputStyle = {
  width: '100%',
  background: '#1c2333',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#f0f2f5',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: '#6b7a99',
  marginBottom: 6,
  display: 'block',
}

const sectionTitle = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#3a4560',
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

function parseDecklistText(raw) {
  const lines = raw.trim().split('\n')
  const cards = []
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)[xX]([A-Z0-9\-]+)$/)
    if (match) {
      cards.push({ count: parseInt(match[1]), id: match[2].toUpperCase(), name: match[2].toUpperCase() })
    }
  }
  return cards
}

function SearchableSelect({ label, placeholder, items, selected, onSelect, onCreateNew, createLabel, displayKey = 'name', sublabel = null }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = items.filter(item =>
    item[displayKey].toLowerCase().includes(query.toLowerCase())
  )

  function handleSelect(item) {
    onSelect(item)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onSelect(null)
    setQuery('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c2333', border: '1px solid #3d7fff44', borderRadius: 8, padding: '9px 12px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{selected[displayKey]}</div>
            {sublabel && selected[sublabel] && <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>{selected[sublabel]}</div>}
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#6b7a99', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            style={inputStyle}
          />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c2333', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {filtered.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filtered.map(item => (
                    <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{item[displayKey]}</div>
                      {sublabel && item[sublabel] && <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>{item[sublabel]}</div>}
                    </div>
                  ))}
                </div>
              )}
              {query.trim() && onCreateNew && (
                <div onClick={() => { onCreateNew(query.trim()); setQuery(''); setOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', color: '#3d7fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderTop: filtered.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,127,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 16 }}>+</span> {createLabel} "{query.trim()}"
                </div>
              )}
              {filtered.length === 0 && !query.trim() && (
                <div style={{ padding: '10px 14px', fontSize: 13, color: '#3a4560' }}>Type to search or create new</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LeaderSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchLeaders(val)
        setResults(data.slice(0, 8))
      } catch {
        setResults([])
      }
      setLoading(false)
    }, 400)
  }

  function handleSelect(card) {
    onSelect(card)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={labelStyle}>Search by name or card ID</label>
      <input
        type="text"
        placeholder="e.g. Luffy, Nami, OP01-060..."
        value={query}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        style={inputStyle}
      />
      {open && (query.length >= 2) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c2333', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 320, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#6b7a99' }}>Searching...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#3a4560' }}>No leaders found</div>
          ) : results.map(card => (
            <div key={card.card_set_id} onClick={() => handleSelect(card)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <img src={getCardImageUrl(card.card_set_id)} alt={card.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</div>
                <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#6b7a99', marginTop: 2 }}>{card.card_color} · {card.card_set_id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LogResult({ session }) {
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  const [tournamentName, setTournamentName] = useState('')
  const [date, setDate] = useState('')
  const [playerCount, setPlayerCount] = useState('')
  const [placement, setPlacement] = useState('')
  const [wins, setWins] = useState('')
  const [losses, setLosses] = useState('')
  const [notes, setNotes] = useState('')
  const [deckName, setDeckName] = useState('')

  const [stores, setStores] = useState([])
  const [series, setSeries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)

  const [leaderResult, setLeaderResult] = useState(null)

  const [decklistRaw, setDecklistRaw] = useState('')
  const [parsedCards, setParsedCards] = useState([])
  const [deckParsed, setDeckParsed] = useState(false)
  const [enriching, setEnriching] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

  useEffect(() => {
    loadStoresAndSeries()
  }, [])

  async function loadStoresAndSeries() {
    const [{ data: storeData }, { data: seriesData }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('tournament_series').select('*, stores(*)').order('name'),
    ])
    setStores(storeData ?? [])
    setSeries(seriesData ?? [])
  }

  async function createStore(name) {
    const parts = name.split(',').map(s => s.trim())
    const { data } = await supabase.from('stores').insert({ name: parts[0], city: parts[1] ?? '', state: parts[2] ?? '', created_by: session.user.id }).select().single()
    if (data) { setStores(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); setSelectedStore(data) }
  }

  async function createSeries(name) {
    const { data } = await supabase.from('tournament_series').insert({ name, store_id: selectedStore?.id ?? null, created_by: session.user.id }).select('*, stores(*)').single()
    if (data) { setSeries(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); setSelectedSeries(data) }
  }

  async function handleParseDeck() {
    const raw = parseDecklistText(decklistRaw)
    if (raw.length === 0) { setParsedCards([]); setDeckParsed(true); return }
    setEnriching(true)
    const enriched = await enrichCards(raw)
    setParsedCards(enriched)
    setDeckParsed(true)
    setEnriching(false)
  }

  async function handleSubmit() {
    setError('')
    if (!tournamentName.trim() && !selectedSeries) return setError('Tournament name or series is required')
    if (!date) return setError('Date is required')
    if (!placement) return setError('Placement is required')
    if (wins === '') return setError('Wins is required')
    if (losses === '') return setError('Losses is required')
    if (!leaderResult) return setError('Please select a leader card')

    setSaving(true)

    let decklistId = null
    if (parsedCards.length > 0) {
      const { data: dl, error: dlError } = await supabase.from('decklists').insert({
        user_id: session.user.id,
        name: deckName || `${leaderResult.card_name} Deck`,
        leader_id: leaderResult.card_set_id,
        leader_name: leaderResult.card_name,
        leader_color: leaderResult.card_color,
        cards: parsedCards,
      }).select().single()
      if (dlError) { setError('Failed to save decklist: ' + dlError.message); setSaving(false); return }
      decklistId = dl.id
    }

    const finalName = selectedSeries?.name ?? tournamentName.trim()
    const storeLocation = selectedStore ? [selectedStore.name, selectedStore.city, selectedStore.state].filter(Boolean).join(', ') : ''

    const { error: tError } = await supabase.from('tournaments').insert({
      user_id: session.user.id,
      name: finalName,
      date,
      location: storeLocation,
      player_count: playerCount ? parseInt(playerCount) : null,
      placement: parseInt(placement),
      wins: parseInt(wins),
      losses: parseInt(losses),
      leader_id: leaderResult.card_set_id,
      leader_name: leaderResult.card_name,
      leader_color: leaderResult.card_color,
      deck_name: deckName || `${leaderResult.card_name} Deck`,
      notes: notes.trim(),
      decklist_id: decklistId,
      store_id: selectedStore?.id ?? null,
      series_id: selectedSeries?.id ?? null,
    })

    if (tError) { setError('Failed to save: ' + tError.message); setSaving(false); return }
    setSaving(false)
    navigate('/dashboard')
  }

  const storesForDisplay = stores.map(s => ({ ...s, sublabel: [s.city, s.state].filter(Boolean).join(', ') }))

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Record</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Log Tournament Result</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Add a locals or major event to your history</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Tournament Info */}
          <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
            <div style={sectionTitle}>Tournament Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SearchableSelect label="Store / Venue" placeholder="Search or create a store..." items={storesForDisplay} selected={selectedStore} onSelect={setSelectedStore} onCreateNew={createStore} createLabel="Create store" sublabel="sublabel" />
              <SearchableSelect label="Tournament Series" placeholder="Search or create a series..." items={series} selected={selectedSeries} onSelect={setSelectedSeries} onCreateNew={createSeries} createLabel="Create series" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tournament Name <span style={{ color: '#3a4560', fontWeight: 400 }}>(if no series)</span></label>
                  <input type="text" placeholder="e.g. One-off event" value={selectedSeries ? selectedSeries.name : tournamentName} onChange={e => setTournamentName(e.target.value)} disabled={!!selectedSeries} style={{ ...inputStyle, opacity: selectedSeries ? 0.5 : 1 }} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Player Count</label>
                <input type="number" placeholder="e.g. 32" value={playerCount} onChange={e => setPlayerCount(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} />
              </div>
            </div>
          </div>

          {/* Result */}
          <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
            <div style={sectionTitle}>Result</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Placement</label><input type="number" placeholder="1" value={placement} onChange={e => setPlacement(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Wins</label><input type="number" placeholder="0" value={wins} onChange={e => setWins(e.target.value)} style={{ ...inputStyle, color: wins ? '#34d399' : '#f0f2f5' }} /></div>
              <div><label style={labelStyle}>Losses</label><input type="number" placeholder="0" value={losses} onChange={e => setLosses(e.target.value)} style={{ ...inputStyle, color: losses ? '#f05252' : '#f0f2f5' }} /></div>
            </div>
          </div>

          {/* Decklist */}
          <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
            <div style={sectionTitle}>Decklist</div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Deck Name</label>
              <input type="text" placeholder="e.g. Red Luffy Aggro v3" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} />
            </div>
            <label style={labelStyle}>Paste your decklist</label>
            <textarea value={decklistRaw} onChange={e => { setDecklistRaw(e.target.value); setDeckParsed(false); setParsedCards([]) }} placeholder={'1xOP15-002\n4xOP15-053\n4xOP15-040\n...'} style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
            <button onClick={handleParseDeck} disabled={!decklistRaw.trim() || enriching} style={{ marginTop: 10, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: decklistRaw.trim() ? 'rgba(255,255,255,0.05)' : 'transparent', color: decklistRaw.trim() ? '#f0f2f5' : '#3a4560', fontSize: 13, fontWeight: 600, cursor: decklistRaw.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {enriching ? 'Fetching card data...' : 'Preview Decklist'}
            </button>

            {deckParsed && parsedCards.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
                  {parsedCards.reduce((s, c) => s + c.count, 0)} cards
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {parsedCards.flatMap(card =>
                    Array.from({ length: card.count }, (_, i) => (
                      <div key={`${card.id}-${i}`} style={{ position: 'relative' }}>
                        <img src={getCardImageUrl(card.id)} alt={card.name} title={`${card.name} (${card.id})`} style={{ width: 62, borderRadius: 5, border: `2px solid ${COLORS[card.color] ?? 'rgba(255,255,255,0.08)'}` }} onError={e => { e.target.style.opacity = '0.2' }} />
                      </div>
                    ))
                  )}
                </div>
                {/* Card list with names */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {parsedCards.map(card => (
                    <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[card.color] ?? '#3a4560', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: '#3d7fff', fontFamily: 'monospace' }}>{card.count}×</span>
                        <span style={{ color: '#f0f2f5' }}>{card.name !== card.id ? card.name : card.id}</span>
                      </div>
                      <span style={{ color: '#3a4560', fontFamily: 'monospace', fontSize: 11 }}>{card.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deckParsed && parsedCards.length === 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#f05252' }}>Could not parse any cards. Use format: 4xOP01-024</div>
            )}
          </div>

          {/* Notes */}
          <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
            <div style={sectionTitle}>Notes</div>
            <textarea placeholder="Match notes, meta observations, deck thoughts..." value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: saving ? '#2a4a8a' : '#3d7fff', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving...' : 'Save Result'}
          </button>
        </div>

        {/* RIGHT — leader search */}
        <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, position: isMobile ? 'static' : 'sticky', top: 70 }}>
          <div style={sectionTitle}>Leader Card</div>

          {leaderResult ? (
            <div>
              <img src={leaderResult.card_image ?? getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: '100%', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{leaderResult.card_name}</div>
              <div style={{ fontSize: 12, color: COLORS[leaderResult.card_color] ?? '#6b7a99', marginTop: 3 }}>{leaderResult.card_color} · {leaderResult.card_set_id}</div>
              <div style={{ fontSize: 11, color: '#3a4560', marginTop: 6 }}>Power: {leaderResult.card_power} · Life: {leaderResult.life}</div>
              <button onClick={() => setLeaderResult(null)} style={{ marginTop: 10, fontSize: 11, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Change leader</button>
            </div>
          ) : (
            <LeaderSearch onSelect={setLeaderResult} />
          )}
        </div>
      </div>
    </div>
  )
}