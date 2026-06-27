import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl, enrichCards, searchLeaders } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import SelectDecklistModal from '../components/SelectDecklistModal'
import { useWindowSize } from '../hooks/useWindowSize'
import LiveTournament from './LiveTournament'

const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

// Extracts the variant-specific image ID from a card object.
// card_image URL is the most reliable source (e.g. ".../Card_Images/OP01-001_p1.jpg" → "OP01-001_p1").
function getLeaderStorageId(card) {
  if (card?.card_image_id) return card.card_image_id
  if (card?.card_image) {
    const m = card.card_image.match(/Card_Images\/(.+?)\.jpg/i)
    if (m?.[1]) return m[1]
  }
  return card?.card_set_id ?? ''
}

// Returns the clean base card ID for display (strips variant suffixes like "_p1_9XMhMTI").
function baseCardId(id) {
  return id?.match(/^[A-Z]{1,3}[0-9]{0,3}-[0-9]+/i)?.[0] ?? id ?? ''
}

const inputStyle = {
  width: '100%', background: 'rgba(26,50,81,0.92)', border: '1px solid rgba(200,162,74,0.35)',
  borderRadius: 8, padding: '9px 12px', color: '#e9f1f8', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px',
  color: '#9db2c6', marginBottom: 6, display: 'block',
}

const sectionTitle = {
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
  color: '#67809a', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid rgba(140,176,208,0.05)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(26,50,81,0.95)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, padding: '9px 12px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e9f1f8' }}>{selected[displayKey]}</div>
            {sublabel && selected[sublabel] && <div style={{ fontSize: 11, color: '#9db2c6', marginTop: 2 }}>{selected[sublabel]}</div>}
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
        </div>
      ) : (
        <>
          <input type="text" placeholder={placeholder} value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} style={inputStyle} />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(10,22,38,0.97)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
              {filtered.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filtered.map(item => (
                    <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(140,176,208,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e9f1f8' }}>{item[displayKey]}</div>
                      {sublabel && item[sublabel] && <div style={{ fontSize: 11, color: '#9db2c6', marginTop: 2 }}>{item[sublabel]}</div>}
                    </div>
                  ))}
                </div>
              )}
              {query.trim() && onCreateNew && (
                <div onClick={() => { onCreateNew(query.trim()); setQuery(''); setOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', color: '#2f7da3', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 16 }}>+</span> {createLabel} "{query.trim()}"
                </div>
              )}
              {filtered.length === 0 && !query.trim() && <div style={{ padding: '10px 14px', fontSize: 13, color: '#67809a' }}>Type to search or create new</div>}
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
      try { const data = await searchLeaders(val); setResults(data.slice(0, 50)) }
      catch { setResults([]) }
      setSearching(false)
    }, 400)
  }

  if (selected) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(26,50,81,0.95)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, padding: '8px 12px' }}>
          <img src={getCardImageUrl(selected)} alt={selected.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e9f1f8' }}>{selected.card_name}</div>
            <div style={{ fontSize: 11, color: COLORS[selected.card_color] ?? '#9db2c6' }}>{selected.card_color} · {baseCardId(selected.card_set_id)}</div>
          </div>
          <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <input type="text" placeholder={placeholder ?? 'Search leader...'} value={query} onChange={handleChange} onFocus={() => query.length >= 2 && setOpen(true)} style={inputStyle} />
      {open && query.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(10,22,38,0.97)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 280, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#9db2c6' }}>Searching...</div>
            : results.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#67809a' }}>No leaders found</div>
            : results.map(card => (
              <div key={card.card_image_id ?? card.card_set_id} onClick={() => { onSelect(card); setQuery(''); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(140,176,208,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e9f1f8' }}>{card.card_name}</div>
                  <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#9db2c6', marginTop: 2 }}>
                    <span style={{ fontFamily: 'monospace' }}>{baseCardId(card.card_set_id)}</span>
                    {card.set_name && <span style={{ color: '#67809a' }}> · {card.set_name}</span>}
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
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${value === opt.value ? opt.color : 'rgba(140,176,208,0.07)'}`, background: value === opt.value ? opt.color + '22' : 'rgba(140,176,208,0.03)', color: value === opt.value ? opt.color : '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}
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
    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 14, border: '1px solid rgba(140,176,208,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#52a9cd', letterSpacing: '0.2px' }}>Round {index + 1}</div>
        <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', color: '#67809a', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
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
            { value: true, label: '🎲 Won', color: '#3bb27e' },
            { value: false, label: '🎲 Lost', color: '#d24a3a' },
          ]}
        />

        <ToggleGroup
          label="Going"
          value={round.wentFirst}
          onChange={val => onChange(index, 'wentFirst', val)}
          options={[
            { value: true, label: '1st', color: '#dcb35e' },
            { value: false, label: '2nd', color: '#52a9cd' },
          ]}
        />

        <ToggleGroup
          label="Result"
          value={round.result}
          onChange={val => onChange(index, 'result', val)}
          options={[
            { value: 'win', label: '✓ Win', color: '#3bb27e' },
            { value: 'loss', label: '✗ Loss', color: '#d24a3a' },
          ]}
        />

        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea placeholder="Round notes..." value={round.notes ?? ''} onChange={e => onChange(index, 'notes', e.target.value)} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
        </div>
      </div>
    </div>
  )
}

function PastTournamentForm({ session, editTournament = null }) {
  const navigate = useNavigate()
  const isEditing = !!editTournament

  const [tournamentName, setTournamentName] = useState(editTournament && !editTournament.series_id ? (editTournament.name ?? '') : '')
  const [date, setDate] = useState(editTournament?.date ?? '')
  const [playerCount, setPlayerCount] = useState(editTournament?.player_count != null ? String(editTournament.player_count) : '')
  const [placement, setPlacement] = useState(editTournament?.placement != null ? String(editTournament.placement) : '')
  const [notes, setNotes] = useState(editTournament?.notes ?? '')
  const [deckName, setDeckName] = useState(editTournament?.deck_name ?? '')
  const [isPractice, setIsPractice] = useState(editTournament?.is_practice ?? false)

  const [stores, setStores] = useState([])
  const [series, setSeries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)

  const [leaderResult, setLeaderResult] = useState(
    editTournament
      ? { card_image_id: editTournament.leader_id, card_set_id: editTournament.leader_id, card_name: editTournament.leader_name, card_color: editTournament.leader_color }
      : null
  )

  const [decklistRaw, setDecklistRaw] = useState('')
  const [parsedCards, setParsedCards] = useState([])
  const [deckParsed, setDeckParsed] = useState(false)
  const [enriching, setEnriching] = useState(false)

  const [rounds, setRounds] = useState(
    editTournament
      ? (editTournament.tournament_rounds ?? [])
          .slice()
          .sort((a, b) => a.round_number - b.round_number)
          .map(r => ({
            oppLeader: (r.opponent_leader_id || r.opponent_leader_name)
              ? { card_image_id: r.opponent_leader_id, card_set_id: r.opponent_leader_id, card_name: r.opponent_leader_name, card_color: r.opponent_leader_color }
              : null,
            wonDice: r.won_dice_roll,
            wentFirst: r.went_first,
            result: r.result,
            notes: r.notes ?? '',
          }))
      : [{ oppLeader: null, wonDice: null, wentFirst: null, result: null, notes: '' }]
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [attachedDecklist, setAttachedDecklist] = useState(editTournament?.decklists ?? null)
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
    if (editTournament) {
      if (editTournament.store_id) {
        const st = (storeData ?? []).find(s => s.id === editTournament.store_id)
        if (st) setSelectedStore(st)
      }
      if (editTournament.series_id) {
        const sr = (seriesData ?? []).find(s => s.id === editTournament.series_id)
        if (sr) setSelectedSeries(sr)
      }
    }
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
    setRounds(prev => [...prev, { oppLeader: null, wonDice: null, wentFirst: null, result: null, notes: '' }])
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
        leader_id: getLeaderStorageId(leaderResult),
        leader_name: leaderResult.card_name,
        leader_color: leaderResult.card_color,
        cards: parsedCards,
      }).select().single()
      if (dlError) { setError('Failed to save decklist: ' + dlError.message); setSaving(false); return }
      decklistId = dl.id
    }

    const finalName = selectedSeries?.name ?? tournamentName.trim()
    const storeLocation = selectedStore ? [selectedStore.name, selectedStore.city, selectedStore.state].filter(Boolean).join(', ') : ''

    const payload = {
      user_id: session.user.id,
      name: finalName,
      date,
      location: storeLocation,
      player_count: playerCount ? parseInt(playerCount) : null,
      placement: parseInt(placement),
      wins,
      losses,
      leader_id: getLeaderStorageId(leaderResult),
      leader_name: leaderResult.card_name,
      leader_color: leaderResult.card_color,
      deck_name: deckName || `${leaderResult.card_name} Deck`,
      notes: notes.trim(),
      decklist_id: decklistId,
      store_id: selectedStore?.id ?? null,
      series_id: selectedSeries?.id ?? null,
      is_practice: isPractice,
    }

    let tournamentId
    if (isEditing) {
      const { error: uError } = await supabase.from('tournaments').update(payload).eq('id', editTournament.id)
      if (uError) { setError('Failed to save: ' + uError.message); setSaving(false); return }
      tournamentId = editTournament.id
      // Replace the rounds wholesale so removed/reordered rounds stay consistent
      const { error: delError } = await supabase.from('tournament_rounds').delete().eq('tournament_id', tournamentId)
      if (delError) { setError('Failed to update rounds: ' + delError.message); setSaving(false); return }
    } else {
      const { data: tournament, error: tError } = await supabase.from('tournaments').insert(payload).select().single()
      if (tError) { setError('Failed to save: ' + tError.message); setSaving(false); return }
      tournamentId = tournament.id
    }

    // Save rounds
    if (rounds.length > 0) {
      const { error: rError } = await supabase.from('tournament_rounds').insert(
        rounds.map((r, i) => ({
          tournament_id: tournamentId,
          round_number: i + 1,
          opponent_leader_id: r.oppLeader?.card_image_id ?? r.oppLeader?.card_set_id ?? null,
          opponent_leader_name: r.oppLeader?.card_name ?? null,
          opponent_leader_color: r.oppLeader?.card_color ?? null,
          won_dice_roll: r.wonDice,
          went_first: r.wentFirst,
          result: r.result,
          notes: r.notes?.trim() || null,
        }))
      )
      if (rError) { setError('Failed to save rounds: ' + rError.message); setSaving(false); return }
    }

    setSaving(false)
    navigate(isEditing ? '/profile' : '/dashboard')
  }

  const storesForDisplay = stores.map(s => ({ ...s, sublabel: [s.city, s.state].filter(Boolean).join(', ') }))
  const pad = isMobile ? 16 : 24

  const leaderCardPanel = (
    <div style={isMobile
      ? { background: 'rgba(140,176,208,0.07)', border: '1px solid rgba(140,176,208,0.2)', borderRadius: 14, padding: 14, marginBottom: 14 }
      : { background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: 20, position: 'sticky', top: 70 }
    }>
      <div style={sectionTitle}>Your Leader Card</div>
      {leaderResult ? (
        isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={leaderResult.card_image ?? getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: 52, borderRadius: 6, border: `1px solid ${COLORS[leaderResult.card_color] ?? 'rgba(140,176,208,0.08)'}`, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.3' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaderResult.card_name}</div>
              <div style={{ fontSize: 11, color: COLORS[leaderResult.card_color] ?? '#9db2c6', marginTop: 2 }}>{leaderResult.card_color} · {baseCardId(leaderResult.card_set_id)}</div>
            </div>
            <button onClick={() => setLeaderResult(null)} style={{ background: 'none', border: '1px solid rgba(140,176,208,0.12)', borderRadius: 6, color: '#9db2c6', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', padding: '4px 10px', flexShrink: 0 }}>Change</button>
          </div>
        ) : (
          <div>
            <img src={leaderResult.card_image ?? getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: '100%', borderRadius: 10, marginBottom: 12, border: '1px solid rgba(140,176,208,0.08)' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e9f1f8' }}>{leaderResult.card_name}</div>
            <div style={{ fontSize: 12, color: COLORS[leaderResult.card_color] ?? '#9db2c6', marginTop: 3 }}>{leaderResult.card_color} · {baseCardId(leaderResult.card_set_id)}</div>
            <div style={{ fontSize: 11, color: '#67809a', marginTop: 6 }}>Power: {leaderResult.card_power} · Life: {leaderResult.life}</div>
            <button onClick={() => setLeaderResult(null)} style={{ marginTop: 10, fontSize: 11, color: '#9db2c6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Change leader</button>
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
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#dcb35e', marginBottom: 4 }}>{isEditing ? 'Edit' : 'Record'}</div>
        <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.4px', marginBottom: 2 }}>{isEditing ? 'Edit Tournament Result' : 'Log Tournament Result'}</div>
        {!isMobile && <div style={{ fontSize: 13, color: '#9db2c6' }}>{isEditing ? 'Update the details of this logged event' : 'Add a locals or major event to your history'}</div>}
      </div>

      {isMobile && leaderCardPanel}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Tournament Info */}
          <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: pad }}>
            <div style={sectionTitle}>Tournament Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SearchableSelect label="Store / Venue" placeholder="Search or create a store..." items={storesForDisplay} selected={selectedStore} onSelect={setSelectedStore} onCreateNew={createStore} createLabel="Create store" sublabel="sublabel" />
              <SearchableSelect label="Tournament Series" placeholder="Search or create a series..." items={series} selected={selectedSeries} onSelect={setSelectedSeries} onCreateNew={createSeries} createLabel="Create series" />
              <div>
                <label style={labelStyle}>Tournament Name <span style={{ color: '#67809a', fontWeight: 400 }}>(if no series)</span></label>
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
              <div>
                <label style={labelStyle}>Match Type</label>
                <button
                  type="button"
                  onClick={() => setIsPractice(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${isPractice ? 'rgba(82,169,205,0.5)' : 'rgba(140,176,208,0.12)'}`, background: isPractice ? 'rgba(82,169,205,0.12)' : 'rgba(140,176,208,0.03)', color: isPractice ? '#52a9cd' : '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <span style={{ width: 36, height: 20, borderRadius: 10, background: isPractice ? '#52a9cd' : 'rgba(140,176,208,0.2)', position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
                    <span style={{ position: 'absolute', top: 2, left: isPractice ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                  </span>
                  <span style={{ flex: 1 }}>Mark as Practice</span>
                </button>
                <div style={{ fontSize: 11, color: '#67809a', marginTop: 6 }}>Practice games are saved to your history but excluded from win rate, bounty and all global stats.</div>
              </div>
            </div>
          </div>

          {/* Rounds */}
          <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: pad }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ ...sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Rounds</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace' }}>
                <span style={{ color: '#3bb27e', fontWeight: 700 }}>{wins}W</span>
                <span style={{ color: '#9db2c6' }}> · </span>
                <span style={{ color: '#d24a3a', fontWeight: 700 }}>{losses}L</span>
              </div>
            </div>
            <div style={{ borderBottom: '1px solid rgba(140,176,208,0.05)', marginBottom: 14 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rounds.map((round, i) => (
                <RoundRow key={i} round={round} index={i} onChange={updateRound} onRemove={removeRound} />
              ))}
            </div>

            <button
              onClick={addRound}
              style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed rgba(140,176,208,0.12)', background: 'transparent', color: '#9db2c6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,162,74,0.4)'; e.currentTarget.style.color = '#2f7da3' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,176,208,0.12)'; e.currentTarget.style.color = '#9db2c6' }}
            >
              + Add Round
            </button>
          </div>

          {/* Decklist */}
          <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: pad }}>
            <div style={sectionTitle}>Decklist</div>

            {attachedDecklist ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(140,176,208,0.08)', border: '1px solid rgba(200,162,74,0.25)', borderRadius: 10, padding: '12px 14px' }}>
                <img src={getCardImageUrl(attachedDecklist.leader_id)} alt={attachedDecklist.leader_name} style={{ width: 36, height: 50, objectFit: 'cover', objectPosition: 'top', borderRadius: 5, border: `1px solid ${COLORS[attachedDecklist.leader_color] ?? 'rgba(140,176,208,0.08)'}`, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8' }}>{attachedDecklist.name}</div>
                  <div style={{ fontSize: 11, color: COLORS[attachedDecklist.leader_color] ?? '#9db2c6', marginTop: 2 }}>{attachedDecklist.leader_name} · {attachedDecklist.leader_id}</div>
                  <div style={{ fontSize: 11, color: '#67809a', marginTop: 2 }}>{attachedDecklist.cards?.reduce((s, c) => s + c.count, 0) ?? 0} cards</div>
                </div>
                <button onClick={() => setAttachedDecklist(null)} style={{ background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <button onClick={() => setSelectingDecklist(true)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(200,162,74,0.3)', background: 'rgba(140,176,208,0.08)', color: '#52a9cd', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
                  Attach Decklist From Account
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(140,176,208,0.05)' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#67809a' }}>or</div>
                  <div style={{ flex: 1, height: 1, background: 'rgba(140,176,208,0.05)' }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Deck Name</label>
                  <input type="text" placeholder="e.g. Red Luffy Aggro v3" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} />
                </div>
                <label style={labelStyle}>Paste your decklist</label>
                <textarea value={decklistRaw} onChange={e => { setDecklistRaw(e.target.value); setDeckParsed(false); setParsedCards([]) }} placeholder={'1xOP15-002\n4xOP15-053\n...'} style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
                <button onClick={handleParseDeck} disabled={!decklistRaw.trim() || enriching} style={{ marginTop: 10, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: decklistRaw.trim() ? 'rgba(140,176,208,0.05)' : 'transparent', color: decklistRaw.trim() ? '#e9f1f8' : '#67809a', fontSize: 13, fontWeight: 600, cursor: decklistRaw.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {enriching ? 'Fetching card data...' : 'Preview Decklist'}
                </button>

                {deckParsed && parsedCards.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#67809a', marginBottom: 10 }}>
                      {parsedCards.reduce((s, c) => s + c.count, 0)} cards parsed
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {parsedCards.flatMap(card =>
                        Array.from({ length: card.count }, (_, i) => (
                          <img key={`${card.id}-${i}`} src={getCardImageUrl(card.id)} alt={card.name} title={`${card.name} (${card.id})`} style={{ width: 62, borderRadius: 5, border: `2px solid ${COLORS[card.color] ?? 'rgba(140,176,208,0.08)'}` }} onError={e => { e.target.style.opacity = '0.2' }} />
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {parsedCards.map(card => (
                        <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[card.color] ?? '#67809a', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: '#2f7da3', fontFamily: 'monospace' }}>{card.count}×</span>
                            <span style={{ color: '#e9f1f8' }}>{card.name !== card.id ? card.name : card.id}</span>
                          </div>
                          <span style={{ color: '#67809a', fontFamily: 'monospace', fontSize: 11 }}>{card.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {deckParsed && parsedCards.length === 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#d24a3a' }}>Could not parse any cards. Use format: 4xOP01-024</div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: pad }}>
            <div style={sectionTitle}>Notes</div>
            <textarea placeholder="Tournament notes, meta observations..." value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#d24a3a', background: 'rgba(210,74,58,0.08)', border: '1px solid rgba(210,74,58,0.2)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: isMobile ? 14 : 12, borderRadius: 10, border: 'none', background: saving ? '#3a526a' : 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Result'}
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

const MODES = [
  { value: 'live', label: 'Live Tournament', icon: '🟢', desc: 'Track rounds in real time during an event', color: '#3bb27e' },
  { value: 'past', label: 'Past Tournament', icon: '📋', desc: 'Record a finished event to your history', color: '#52a9cd' },
]

function ModeToggle({ mode, setMode, isMobile }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: isMobile ? 16 : 20 }}>
      {MODES.map(m => {
        const active = mode === m.value
        return (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            style={{
              flex: 1, textAlign: 'left', padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 12,
              border: `1px solid ${active ? m.color + '66' : 'rgba(140,176,208,0.08)'}`,
              background: active ? m.color + '1a' : 'rgba(140,176,208,0.03)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: active ? '#e9f1f8' : '#9db2c6' }}>{m.label}</span>
            </div>
            {!isMobile && (
              <div style={{ fontSize: 12, color: active ? '#c2d2e0' : '#67809a', marginTop: 4 }}>{m.desc}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function LogResult({ session }) {
  const location = useLocation()
  const editTournament = location.state?.editTournament ?? null
  const [mode, setMode] = useState('past')
  const { isMobile } = useWindowSize()

  // Editing an existing log is past-only — skip the live/past toggle.
  if (editTournament) {
    return (
      <div>
        <PastTournamentForm session={session} editTournament={editTournament} />
      </div>
    )
  }

  return (
    <div>
      <ModeToggle mode={mode} setMode={setMode} isMobile={isMobile} />
      {mode === 'live'
        ? <LiveTournament session={session} />
        : <PastTournamentForm session={session} />}
    </div>
  )
}