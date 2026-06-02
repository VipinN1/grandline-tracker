import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl, enrichCards, searchLeaders } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import SelectDecklistModal from '../components/SelectDecklistModal'
import { useWindowSize } from '../hooks/useWindowSize'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

const inputStyle = {
  width: '100%', background: 'rgba(15,8,30,0.92)', border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px',
  color: '#7c6fa0', marginBottom: 6, display: 'block',
}

const sectionTitle = {
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
  color: '#3d2d6e', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)',
}

function parseDecklistText(raw) {
  const lines = raw.trim().split('\n')
  const cards = []
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)[xX]([A-Z0-9\-]+)$/)
    if (match) cards.push({ count: parseInt(match[1]), id: match[2].toUpperCase(), name: match[2].toUpperCase() })
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

  const filtered = items.filter(item => item[displayKey].toLowerCase().includes(query.toLowerCase()))

  function handleSelect(item) { onSelect(item); setQuery(''); setOpen(false) }
  function handleClear() { onSelect(null); setQuery('') }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15,8,30,0.95)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '9px 12px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{selected[displayKey]}</div>
            {sublabel && selected[sublabel] && <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 2 }}>{selected[sublabel]}</div>}
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
        </div>
      ) : (
        <>
          <input type="text" placeholder={placeholder} value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} style={inputStyle} />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(10,5,22,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
              {filtered.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filtered.map(item => (
                    <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{item[displayKey]}</div>
                      {sublabel && item[sublabel] && <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 2 }}>{item[sublabel]}</div>}
                    </div>
                  ))}
                </div>
              )}
              {query.trim() && onCreateNew && (
                <div onClick={() => { onCreateNew(query.trim()); setQuery(''); setOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', color: '#8b5cf6', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 16 }}>+</span> {createLabel} "{query.trim()}"
                </div>
              )}
              {filtered.length === 0 && !query.trim() && <div style={{ padding: '10px 14px', fontSize: 13, color: '#3d2d6e' }}>Type to search or create new</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LeaderSearchInput({ label, placeholder, onSelect, selected, onClear }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
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
    setQuery(val); setOpen(true)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { const data = await searchLeaders(val); setResults(data.slice(0, 12)) }
      catch { setResults([]) }
      setSearching(false)
    }, 400)
  }

  if (selected) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,8,30,0.95)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '8px 12px' }}>
          <img src={getCardImageUrl(selected.card_set_id)} alt={selected.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{selected.card_name}</div>
            <div style={{ fontSize: 11, color: COLORS[selected.card_color] ?? '#7c6fa0' }}>{selected.card_color} · {selected.card_set_id}</div>
          </div>
          <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <input type="text" placeholder={placeholder ?? 'Search leader...'} value={query} onChange={handleChange} onFocus={() => query.length >= 2 && setOpen(true)} style={inputStyle} />
      {open && query.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(10,5,22,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 280, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#7c6fa0' }}>Searching...</div>
            : results.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#3d2d6e' }}>No leaders found</div>
            : results.map(card => (
              <div key={card.card_image_id ?? card.card_set_id} onClick={() => { onSelect(card); setQuery(''); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</div>
                  <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#7c6fa0', marginTop: 2 }}>
                    <span style={{ fontFamily: 'monospace' }}>{card.card_set_id}</span>
                    {card.set_name && <span style={{ color: '#3d2d6e' }}> · {card.set_name}</span>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function ToggleGroup({ label, value, onChange, options }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(value === opt.value ? null : opt.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${value === opt.value ? opt.color : 'rgba(255,255,255,0.07)'}`, background: value === opt.value ? opt.color + '22' : 'rgba(255,255,255,0.03)', color: value === opt.value ? opt.color : '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RoundRow({ round, index, onChange, onRemove }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 14, border: '1px solid rgba(139,92,246,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.2px' }}>Round {index + 1}</div>
        <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', color: '#3d2d6e', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LeaderSearchInput
          label="Opponent's Leader"
          placeholder="Search opponent's leader..."
          onSelect={card => onChange(index, 'oppLeader', card)}
          selected={round.oppLeader}
          onClear={() => onChange(index, 'oppLeader', null)}
        />

        <ToggleGroup
          label="Dice Roll"
          value={round.wonDice}
          onChange={val => onChange(index, 'wonDice', val)}
          options={[
            { value: true, label: '🎲 Won', color: '#34d399' },
            { value: false, label: '🎲 Lost', color: '#f05252' },
          ]}
        />

        <ToggleGroup
          label="Going"
          value={round.wentFirst}
          onChange={val => onChange(index, 'wentFirst', val)}
          options={[
            { value: true, label: '1st', color: '#fbbf24' },
            { value: false, label: '2nd', color: '#a78bfa' },
          ]}
        />

        <ToggleGroup
          label="Result"
          value={round.result}
          onChange={val => onChange(index, 'result', val)}
          options={[
            { value: 'win', label: '✓ Win', color: '#34d399' },
            { value: 'loss', label: '✗ Loss', color: '#f05252' },
          ]}
        />
      </div>
    </div>
  )
}

export default function LogResult({ session }) {
  const navigate = useNavigate()

  const [tournamentName, setTournamentName] = useState('')
  const [date, setDate] = useState('')
  const [playerCount, setPlayerCount] = useState('')
  const [placement, setPlacement] = useState('')
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

  const [rounds, setRounds] = useState([{ oppLeader: null, wonDice: null, wentFirst: null, result: null }])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [attachedDecklist, setAttachedDecklist] = useState(null)
  const [selectingDecklist, setSelectingDecklist] = useState(false)

  const { isMobile } = useWindowSize()

  useEffect(() => { loadStoresAndSeries() }, [])

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
    setParsedCards(enriched); setDeckParsed(true); setEnriching(false)
  }

  function updateRound(index, field, value) {
    setRounds(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function removeRound(index) {
    setRounds(prev => prev.filter((_, i) => i !== index))
  }

  function addRound() {
    setRounds(prev => [...prev, { oppLeader: null, wonDice: null, wentFirst: null, result: null }])
  }

  const wins = rounds.filter(r => r.result === 'win').length
  const losses = rounds.filter(r => r.result === 'loss').length

  async function handleSubmit() {
    setError('')
    if (!tournamentName.trim() && !selectedSeries) return setError('Tournament name or series is required')
    if (!date) return setError('Date is required')
    if (!placement) return setError('Placement is required')
    if (!leaderResult) return setError('Please select a leader card')
    if (rounds.some(r => !r.result)) return setError('Please set a result for all rounds')

    setSaving(true)

    let decklistId = attachedDecklist?.id ?? null
    if (!attachedDecklist && parsedCards.length > 0) {
      const { data: dl, error: dlError } = await supabase.from('decklists').insert({
        user_id: session.user.id,
        name: deckName || `${leaderResult.card_name} Deck`,
        leader_id: leaderResult.card_image_id ?? leaderResult.card_set_id,
        leader_name: leaderResult.card_name,
        leader_color: leaderResult.card_color,
        cards: parsedCards,
      }).select().single()
      if (dlError) { setError('Failed to save decklist: ' + dlError.message); setSaving(false); return }
      decklistId = dl.id
    }

    const finalName = selectedSeries?.name ?? tournamentName.trim()
    const storeLocation = selectedStore ? [selectedStore.name, selectedStore.city, selectedStore.state].filter(Boolean).join(', ') : ''

    const { data: tournament, error: tError } = await supabase.from('tournaments').insert({
      user_id: session.user.id,
      name: finalName,
      date,
      location: storeLocation,
      player_count: playerCount ? parseInt(playerCount) : null,
      placement: parseInt(placement),
      wins,
      losses,
      leader_id: leaderResult.card_image_id ?? leaderResult.card_set_id,
      leader_name: leaderResult.card_name,
      leader_color: leaderResult.card_color,
      deck_name: deckName || `${leaderResult.card_name} Deck`,
      notes: notes.trim(),
      decklist_id: decklistId,
      store_id: selectedStore?.id ?? null,
      series_id: selectedSeries?.id ?? null,
    }).select().single()

    if (tError) { setError('Failed to save: ' + tError.message); setSaving(false); return }

    // Save rounds
    if (rounds.length > 0) {
      await supabase.from('tournament_rounds').insert(
        rounds.map((r, i) => ({
          tournament_id: tournament.id,
          round_number: i + 1,
          opponent_leader_id: r.oppLeader?.card_image_id ?? r.oppLeader?.card_set_id ?? null,
          opponent_leader_name: r.oppLeader?.card_name ?? null,
          opponent_leader_color: r.oppLeader?.card_color ?? null,
          won_dice_roll: r.wonDice,
          went_first: r.wentFirst,
          result: r.result,
        }))
      )
    }

    setSaving(false)
    navigate('/dashboard')
  }

  const storesForDisplay = stores.map(s => ({ ...s, sublabel: [s.city, s.state].filter(Boolean).join(', ') }))
  const pad = isMobile ? 16 : 24

  const leaderCardPanel = (
    <div style={isMobile
      ? { background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 14, padding: 14, marginBottom: 14 }
      : { background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, position: 'sticky', top: 70 }
    }>
      <div style={sectionTitle}>Your Leader Card</div>
      {leaderResult ? (
        isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={leaderResult.card_image ?? getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: 52, borderRadius: 6, border: `1px solid ${COLORS[leaderResult.card_color] ?? 'rgba(255,255,255,0.08)'}`, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.3' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaderResult.card_name}</div>
              <div style={{ fontSize: 11, color: COLORS[leaderResult.card_color] ?? '#7c6fa0', marginTop: 2 }}>{leaderResult.card_color} · {leaderResult.card_set_id}</div>
            </div>
            <button onClick={() => setLeaderResult(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#7c6fa0', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', padding: '4px 10px', flexShrink: 0 }}>Change</button>
          </div>
        ) : (
          <div>
            <img src={leaderResult.card_image ?? getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: '100%', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(255,255,255,0.08)' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{leaderResult.card_name}</div>
            <div style={{ fontSize: 12, color: COLORS[leaderResult.card_color] ?? '#7c6fa0', marginTop: 3 }}>{leaderResult.card_color} · {leaderResult.card_set_id}</div>
            <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 6 }}>Power: {leaderResult.card_power} · Life: {leaderResult.life}</div>
            <button onClick={() => setLeaderResult(null)} style={{ marginTop: 10, fontSize: 11, color: '#7c6fa0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Change leader</button>
          </div>
        )
      ) : (
        <LeaderSearchInput
          placeholder="Search your leader..."
          onSelect={setLeaderResult}
          selected={null}
          onClear={() => setLeaderResult(null)}
        />
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: isMobile ? '1rem' : '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Record</div>
        <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Log Tournament Result</div>
        {!isMobile && <div style={{ fontSize: 13, color: '#7c6fa0' }}>Add a locals or major event to your history</div>}
      </div>

      {isMobile && leaderCardPanel}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Tournament Info */}
          <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: pad }}>
            <div style={sectionTitle}>Tournament Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SearchableSelect label="Store / Venue" placeholder="Search or create a store..." items={storesForDisplay} selected={selectedStore} onSelect={setSelectedStore} onCreateNew={createStore} createLabel="Create store" sublabel="sublabel" />
              <SearchableSelect label="Tournament Series" placeholder="Search or create a series..." items={series} selected={selectedSeries} onSelect={setSelectedSeries} onCreateNew={createSeries} createLabel="Create series" />
              <div>
                <label style={labelStyle}>Tournament Name <span style={{ color: '#3d2d6e', fontWeight: 400 }}>(if no series)</span></label>
                <input type="text" placeholder="e.g. One-off event" value={selectedSeries ? selectedSeries.name : tournamentName} onChange={e => setTournamentName(e.target.value)} disabled={!!selectedSeries} style={{ ...inputStyle, opacity: selectedSeries ? 0.5 : 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, WebkitAppearance: 'none', maxWidth: '100%' }} />
                </div>
                <div style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
                  <label style={labelStyle}>Players</label>
                  <input type="number" placeholder="e.g. 32" value={playerCount} onChange={e => setPlayerCount(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Final Placement</label>
                <input type="number" placeholder="e.g. 1" value={placement} onChange={e => setPlacement(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Rounds */}
          <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: pad }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ ...sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Rounds</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace' }}>
                <span style={{ color: '#34d399', fontWeight: 700 }}>{wins}W</span>
                <span style={{ color: '#7c6fa0' }}> · </span>
                <span style={{ color: '#f05252', fontWeight: 700 }}>{losses}L</span>
              </div>
            </div>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 14 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rounds.map((round, i) => (
                <RoundRow key={i} round={round} index={i} onChange={updateRound} onRemove={removeRound} />
              ))}
            </div>

            <button
              onClick={addRound}
              style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.12)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#8b5cf6' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#7c6fa0' }}
            >
              + Add Round
            </button>
          </div>

          {/* Decklist */}
          <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: pad }}>
            <div style={sectionTitle}>Decklist</div>

            {attachedDecklist ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '12px 14px' }}>
                <img src={getCardImageUrl(attachedDecklist.leader_id)} alt={attachedDecklist.leader_name} style={{ width: 36, height: 50, objectFit: 'cover', objectPosition: 'top', borderRadius: 5, border: `1px solid ${COLORS[attachedDecklist.leader_color] ?? 'rgba(255,255,255,0.08)'}`, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{attachedDecklist.name}</div>
                  <div style={{ fontSize: 11, color: COLORS[attachedDecklist.leader_color] ?? '#7c6fa0', marginTop: 2 }}>{attachedDecklist.leader_name} · {attachedDecklist.leader_id}</div>
                  <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 2 }}>{attachedDecklist.cards?.reduce((s, c) => s + c.count, 0) ?? 0} cards</div>
                </div>
                <button onClick={() => setAttachedDecklist(null)} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <button onClick={() => setSelectingDecklist(true)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
                  Attach Decklist From Account
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#3d2d6e' }}>or</div>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Deck Name</label>
                  <input type="text" placeholder="e.g. Red Luffy Aggro v3" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} />
                </div>
                <label style={labelStyle}>Paste your decklist</label>
                <textarea value={decklistRaw} onChange={e => { setDecklistRaw(e.target.value); setDeckParsed(false); setParsedCards([]) }} placeholder={'1xOP15-002\n4xOP15-053\n...'} style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
                <button onClick={handleParseDeck} disabled={!decklistRaw.trim() || enriching} style={{ marginTop: 10, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: decklistRaw.trim() ? 'rgba(255,255,255,0.05)' : 'transparent', color: decklistRaw.trim() ? '#f0f2f5' : '#3d2d6e', fontSize: 13, fontWeight: 600, cursor: decklistRaw.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {enriching ? 'Fetching card data...' : 'Preview Decklist'}
                </button>

                {deckParsed && parsedCards.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 10 }}>
                      {parsedCards.reduce((s, c) => s + c.count, 0)} cards parsed
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {parsedCards.flatMap(card =>
                        Array.from({ length: card.count }, (_, i) => (
                          <img key={`${card.id}-${i}`} src={getCardImageUrl(card.id)} alt={card.name} title={`${card.name} (${card.id})`} style={{ width: 62, borderRadius: 5, border: `2px solid ${COLORS[card.color] ?? 'rgba(255,255,255,0.08)'}` }} onError={e => { e.target.style.opacity = '0.2' }} />
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {parsedCards.map(card => (
                        <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[card.color] ?? '#3d2d6e', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: '#8b5cf6', fontFamily: 'monospace' }}>{card.count}×</span>
                            <span style={{ color: '#f0f2f5' }}>{card.name !== card.id ? card.name : card.id}</span>
                          </div>
                          <span style={{ color: '#3d2d6e', fontFamily: 'monospace', fontSize: 11 }}>{card.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {deckParsed && parsedCards.length === 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#f05252' }}>Could not parse any cards. Use format: 4xOP01-024</div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: pad }}>
            <div style={sectionTitle}>Notes</div>
            <textarea placeholder="Tournament notes, meta observations..." value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: isMobile ? 14 : 12, borderRadius: 10, border: 'none', background: saving ? '#5b21b6' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving...' : 'Save Result'}
          </button>
        </div>

        {!isMobile && leaderCardPanel}
      </div>
      {selectingDecklist && (
        <SelectDecklistModal
          session={session}
          isMobile={isMobile}
          onClose={() => setSelectingDecklist(false)}
          onSelect={deck => { setAttachedDecklist(deck); setDecklistRaw(''); setParsedCards([]) }}
        />
      )}
    </div>
  )
}