import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl, getCard } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

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
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{item[displayKey]}</div>
                      {sublabel && item[sublabel] && <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>{item[sublabel]}</div>}
                    </div>
                  ))}
                </div>
              )}
              {query.trim() && (
                <div
                  onClick={() => { onCreateNew(query.trim()); setQuery(''); setOpen(false) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', color: '#3d7fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderTop: filtered.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,127,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
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

export default function LogResult({ session }) {
  const navigate = useNavigate()

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

  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderResult, setLeaderResult] = useState(null)
  const [leaderError, setLeaderError] = useState('')
  const [leaderLoading, setLeaderLoading] = useState(false)

  const [decklistRaw, setDecklistRaw] = useState('')
  const [parsedCards, setParsedCards] = useState([])
  const [deckParsed, setDeckParsed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    const storeName = parts[0]
    const city = parts[1] ?? ''
    const state = parts[2] ?? ''
    const { data } = await supabase
      .from('stores')
      .insert({ name: storeName, city, state, created_by: session.user.id })
      .select()
      .single()
    if (data) {
      setStores(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedStore(data)
    }
  }

  async function createSeries(name) {
    const { data } = await supabase
      .from('tournament_series')
      .insert({ name, store_id: selectedStore?.id ?? null, created_by: session.user.id })
      .select('*, stores(*)')
      .single()
    if (data) {
      setSeries(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedSeries(data)
    }
  }

  async function searchLeader() {
    if (!leaderQuery.trim()) return
    setLeaderLoading(true)
    setLeaderError('')
    setLeaderResult(null)
    try {
      const card = await getCard(leaderQuery.trim().toUpperCase())
      if (card.card_type !== 'Leader') {
        setLeaderError(`${card.card_name} is not a Leader card.`)
      } else {
        setLeaderResult(card)
      }
    } catch {
      setLeaderError('Card not found. Check the ID and try again.')
    } finally {
      setLeaderLoading(false)
    }
  }

  function handleParseDeck() {
    const cards = parseDecklistText(decklistRaw)
    setParsedCards(cards)
    setDeckParsed(true)
  }

  async function handleSubmit() {
    setError('')
    if (!tournamentName.trim() && !selectedSeries) return setError('Tournament name or series is required')
    if (!date) return setError('Date is required')
    if (!placement) return setError('Placement is required')
    if (wins === '' && wins !== 0) return setError('Wins is required')
    if (losses === '' && losses !== 0) return setError('Losses is required')
    if (!leaderResult) return setError('Please search and select a leader card')

    setSaving(true)

    let decklistId = null
    if (parsedCards.length > 0) {
      const { data: dl, error: dlError } = await supabase
        .from('decklists')
        .insert({
          user_id: session.user.id,
          name: deckName || `${leaderResult.card_name} Deck`,
          leader_id: leaderResult.card_set_id,
          leader_name: leaderResult.card_name,
          leader_color: leaderResult.card_color,
          cards: parsedCards,
        })
        .select()
        .single()
      if (dlError) { setError('Failed to save decklist: ' + dlError.message); setSaving(false); return }
      decklistId = dl.id
    }

    const finalName = selectedSeries?.name ?? tournamentName.trim()
    const storeLocation = selectedStore
      ? [selectedStore.name, selectedStore.city, selectedStore.state].filter(Boolean).join(', ')
      : ''

    const { error: tError } = await supabase
      .from('tournaments')
      .insert({
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

  // Format store display
  const storesForDisplay = stores.map(s => ({
    ...s,
    name: s.name,
    sublabel: [s.city, s.state].filter(Boolean).join(', '),
  }))

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Record</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Log Tournament Result</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Add a locals or major event to your history</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Tournament Info */}
          <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
            <div style={sectionTitle}>Tournament Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <SearchableSelect
                label="Store / Venue"
                placeholder="Search or create a store..."
                items={storesForDisplay}
                selected={selectedStore}
                onSelect={setSelectedStore}
                onCreateNew={createStore}
                createLabel="Create store"
                sublabel="sublabel"
              />

              <SearchableSelect
                label="Tournament Series"
                placeholder="Search or create a series..."
                items={series}
                selected={selectedSeries}
                onSelect={setSelectedSeries}
                onCreateNew={createSeries}
                createLabel="Create series"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>
                    Tournament Name
                    <span style={{ color: '#3a4560', fontWeight: 400, marginLeft: 4 }}>(if no series)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. One-off event name"
                    value={selectedSeries ? selectedSeries.name : tournamentName}
                    onChange={e => setTournamentName(e.target.value)}
                    disabled={!!selectedSeries}
                    style={{ ...inputStyle, opacity: selectedSeries ? 0.5 : 1 }}
                  />
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
              <div>
                <label style={labelStyle}>Placement</label>
                <input type="number" placeholder="1" value={placement} onChange={e => setPlacement(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Wins</label>
                <input type="number" placeholder="0" value={wins} onChange={e => setWins(e.target.value)} style={{ ...inputStyle, color: wins ? '#34d399' : '#f0f2f5' }} />
              </div>
              <div>
                <label style={labelStyle}>Losses</label>
                <input type="number" placeholder="0" value={losses} onChange={e => setLosses(e.target.value)} style={{ ...inputStyle, color: losses ? '#f05252' : '#f0f2f5' }} />
              </div>
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
            <textarea
              value={decklistRaw}
              onChange={e => { setDecklistRaw(e.target.value); setDeckParsed(false); setParsedCards([]) }}
              placeholder={'1xOP15-002\n4xOP15-053\n4xOP15-040\n...'}
              style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
            <button
              onClick={handleParseDeck}
              disabled={!decklistRaw.trim()}
              style={{ marginTop: 10, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: decklistRaw.trim() ? 'rgba(255,255,255,0.05)' : 'transparent', color: decklistRaw.trim() ? '#f0f2f5' : '#3a4560', fontSize: 13, fontWeight: 600, cursor: decklistRaw.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
            >
              Preview Decklist
            </button>

            {deckParsed && parsedCards.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
                  {parsedCards.reduce((s, c) => s + c.count, 0)} cards parsed
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {parsedCards.flatMap(card =>
                    Array.from({ length: card.count }, (_, i) => (
                      <img key={`${card.id}-${i}`} src={getCardImageUrl(card.id)} alt={card.id} title={card.id} style={{ width: 62, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.opacity = '0.2' }} />
                    ))
                  )}
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
            <div style={{ fontSize: 13, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: saving ? '#2a4a8a' : '#3d7fff', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Saving...' : 'Save Result'}
          </button>
        </div>

        {/* RIGHT — leader lookup */}
        <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, position: 'sticky', top: 70 }}>
          <div style={sectionTitle}>Leader Card</div>
          <label style={labelStyle}>Search by card ID</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="e.g. OP01-060"
              value={leaderQuery}
              onChange={e => setLeaderQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchLeader()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={searchLeader}
              style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#3d7fff', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              {leaderLoading ? '...' : 'Find'}
            </button>
          </div>

          {leaderError && <div style={{ fontSize: 12, color: '#f05252', marginBottom: 10 }}>{leaderError}</div>}

          {leaderResult ? (
            <div>
              <img src={leaderResult.card_image} alt={leaderResult.card_name} style={{ width: '100%', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{leaderResult.card_name}</div>
              <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 3 }}>{leaderResult.card_color} · {leaderResult.card_set_id}</div>
              <div style={{ fontSize: 11, color: '#3a4560', marginTop: 6 }}>Power: {leaderResult.card_power} · Life: {leaderResult.life}</div>
              <button onClick={() => { setLeaderResult(null); setLeaderQuery('') }} style={{ marginTop: 10, fontSize: 11, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Clear</button>
            </div>
          ) : (
            !leaderError && (
              <div style={{ marginTop: 8, background: '#1c2333', borderRadius: 8, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 12, color: '#3a4560', textAlign: 'center' }}>Enter a leader card ID<br />to preview it here</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}