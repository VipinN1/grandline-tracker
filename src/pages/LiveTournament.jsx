import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl, searchLeaders } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px',
  color: '#7c6fa0', marginBottom: 6, display: 'block',
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
      try { const data = await searchLeaders(val); setResults(data.slice(0, 8)) }
      catch { setResults([]) }
      setSearching(false)
    }, 400)
  }

  if (selected) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid #8b5cf644', borderRadius: 8, padding: '8px 12px' }}>
          <img src={getCardImageUrl(selected.card_set_id)} alt={selected.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.display = 'none' }} />
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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 280, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#7c6fa0' }}>Searching...</div>
            : results.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#3d2d6e' }}>No leaders found</div>
            : results.map(card => (
              <div key={card.card_set_id} onClick={() => { onSelect(card); setQuery(''); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <img src={getCardImageUrl(card.card_set_id)} alt={card.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</div>
                  <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#7c6fa0', marginTop: 2 }}>{card.card_color} · {card.card_set_id}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function SetupScreen({ session, onStart }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [location, setLocation] = useState('')
  const [playerCount, setPlayerCount] = useState('')
  const [deckName, setDeckName] = useState('')
  const [leader, setLeader] = useState(null)
  const [stores, setStores] = useState([])
  const [series, setSeries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const storeRef = useRef(null)
  const seriesRef = useRef(null)
  const [storeQuery, setStoreQuery] = useState('')
  const [seriesQuery, setSeriesQuery] = useState('')
  const [storeOpen, setStoreOpen] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sr }] = await Promise.all([
        supabase.from('stores').select('*').order('name'),
        supabase.from('tournament_series').select('*').order('name'),
      ])
      setStores(s ?? [])
      setSeries(sr ?? [])
    }
    load()

    function handleClick(e) {
      if (storeRef.current && !storeRef.current.contains(e.target)) setStoreOpen(false)
      if (seriesRef.current && !seriesRef.current.contains(e.target)) setSeriesOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleStart() {
    setError('')
    if (!leader) return setError('Please select your leader')
    if (!name.trim() && !selectedSeries) return setError('Please enter a tournament name or select a series')
    setSaving(true)

    const finalName = selectedSeries?.name ?? name.trim()
    const storeLocation = selectedStore ? [selectedStore.name, selectedStore.city, selectedStore.state].filter(Boolean).join(', ') : location

    const { data, error: err } = await supabase.from('live_tournaments').insert({
      user_id: session.user.id,
      name: finalName,
      date,
      location: storeLocation,
      player_count: playerCount ? parseInt(playerCount) : null,
      leader_id: leader.card_set_id,
      leader_name: leader.card_name,
      leader_color: leader.card_color,
      deck_name: deckName || `${leader.card_name} Deck`,
      status: 'active',
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    onStart(data)
    setSaving(false)
  }

  const filteredStores = stores.filter(s => s.name.toLowerCase().includes(storeQuery.toLowerCase()))
  const filteredSeries = series.filter(s => s.name.toLowerCase().includes(seriesQuery.toLowerCase()))

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#34d399', marginBottom: 4 }}>● Live</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Start Live Tournament</div>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>Track your rounds in real time</div>
      </div>

      <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Store picker */}
        <div ref={storeRef} style={{ position: 'relative' }}>
          <label style={labelStyle}>Store / Venue</label>
          {selectedStore ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid #8b5cf644', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{selectedStore.name}</div>
              <button onClick={() => setSelectedStore(null)} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
            </div>
          ) : (
            <>
              <input type="text" placeholder="Search store..." value={storeQuery} onChange={e => { setStoreQuery(e.target.value); setStoreOpen(true) }} onFocus={() => setStoreOpen(true)} style={inputStyle} />
              {storeOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 200, overflowY: 'auto' }}>
                  {filteredStores.map(s => (
                    <div key={s.id} onClick={() => { setSelectedStore(s); setStoreQuery(''); setStoreOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#f0f2f5', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {s.name} {s.city && <span style={{ color: '#7c6fa0' }}>· {s.city}</span>}
                    </div>
                  ))}
                  {storeQuery && <div onClick={() => { setStoreOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#8b5cf6', fontWeight: 600 }}>+ Use "{storeQuery}" as location</div>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Series picker */}
        <div ref={seriesRef} style={{ position: 'relative' }}>
          <label style={labelStyle}>Tournament Series</label>
          {selectedSeries ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid #8b5cf644', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{selectedSeries.name}</div>
              <button onClick={() => setSelectedSeries(null)} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
            </div>
          ) : (
            <>
              <input type="text" placeholder="Search series..." value={seriesQuery} onChange={e => { setSeriesQuery(e.target.value); setSeriesOpen(true) }} onFocus={() => setSeriesOpen(true)} style={inputStyle} />
              {seriesOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 200, overflowY: 'auto' }}>
                  {filteredSeries.map(s => (
                    <div key={s.id} onClick={() => { setSelectedSeries(s); setSeriesQuery(''); setSeriesOpen(false) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#f0f2f5', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Name + date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Tournament Name {selectedSeries && <span style={{ color: '#3d2d6e', fontWeight: 400 }}>(auto)</span>}</label>
            <input type="text" placeholder="e.g. Weekly Locals" value={selectedSeries ? selectedSeries.name : name} onChange={e => setName(e.target.value)} disabled={!!selectedSeries} style={{ ...inputStyle, opacity: selectedSeries ? 0.5 : 1 }} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Player Count</label>
            <input type="number" placeholder="e.g. 32" value={playerCount} onChange={e => setPlayerCount(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Deck Name</label>
            <input type="text" placeholder="e.g. Red Luffy Aggro" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <LeaderSearchInput label="Your Leader" placeholder="Search your leader..." onSelect={setLeader} selected={leader} onClear={() => setLeader(null)} />

        {error && <div style={{ fontSize: 13, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

        <button onClick={handleStart} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: saving ? '#5b21b6' : '#34d399', color: '#0f1117', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Starting...' : '🏆 Start Tournament'}
        </button>
      </div>
    </div>
  )
}

function RoundLogger({ tournament, rounds, onRoundLogged }) {
  const [oppLeader, setOppLeader] = useState(null)
  const [wonDice, setWonDice] = useState(null)
  const [wentFirst, setWentFirst] = useState(null)
  const [result, setResult] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const roundNumber = rounds.length + 1

  async function logRound() {
    setError('')
    if (!result) return setError('Please select a result')
    setSaving(true)

    const { data, error: err } = await supabase.from('live_rounds').insert({
      tournament_id: tournament.id,
      round_number: roundNumber,
      opponent_leader_id: oppLeader?.card_set_id ?? null,
      opponent_leader_name: oppLeader?.card_name ?? null,
      opponent_leader_color: oppLeader?.card_color ?? null,
      won_dice_roll: wonDice,
      went_first: wentFirst,
      result,
      notes: notes.trim(),
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    onRoundLogged(data)
    setOppLeader(null)
    setWonDice(null)
    setWentFirst(null)
    setResult(null)
    setNotes('')
    setSaving(false)
  }

  function ToggleGroup({ label, value, onChange, options }) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {options.map(opt => (
            <button
              key={opt.value}
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

  return (
    <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5', marginBottom: 16 }}>
        Round {roundNumber}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <LeaderSearchInput
          label="Opponent's Leader"
          placeholder="Search opponent's leader..."
          onSelect={setOppLeader}
          selected={oppLeader}
          onClear={() => setOppLeader(null)}
        />

        <ToggleGroup
          label="Dice Roll"
          value={wonDice}
          onChange={setWonDice}
          options={[
            { value: true, label: '🎲 Won', color: '#34d399' },
            { value: false, label: '🎲 Lost', color: '#f05252' },
          ]}
        />

        <ToggleGroup
          label="Going"
          value={wentFirst}
          onChange={setWentFirst}
          options={[
            { value: true, label: '1st', color: '#fbbf24' },
            { value: false, label: '2nd', color: '#a78bfa' },
          ]}
        />

        <ToggleGroup
          label="Result"
          value={result}
          onChange={setResult}
          options={[
            { value: 'win', label: '✓ Win', color: '#34d399' },
            { value: 'loss', label: '✗ Loss', color: '#f05252' },
          ]}
        />

        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea placeholder="Round notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
        </div>

        {error && <div style={{ fontSize: 12, color: '#f05252' }}>{error}</div>}

        <button onClick={logRound} disabled={saving} style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: saving ? '#5b21b6' : '#8b5cf6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving...' : `Log Round ${roundNumber}`}
        </button>
      </div>
    </div>
  )
}

function RoundHistory({ rounds }) {
  if (rounds.length === 0) return null

  return (
    <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#7c6fa0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>Round History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rounds.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c6fa0', minWidth: 60 }}>R{r.round_number}</div>

            {r.opponent_leader_id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <img src={getCardImageUrl(r.opponent_leader_id)} alt={r.opponent_leader_name} style={{ width: 24, height: 33, objectFit: 'cover', objectPosition: 'top', borderRadius: 3 }} onError={e => { e.target.style.display = 'none' }} />
                <div style={{ fontSize: 12, color: COLORS[r.opponent_leader_color] ?? '#7c6fa0' }}>{r.opponent_leader_name}</div>
              </div>
            )}
            {!r.opponent_leader_id && <div style={{ flex: 1, fontSize: 12, color: '#3d2d6e' }}>Unknown leader</div>}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {r.won_dice_roll !== null && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: r.won_dice_roll ? 'rgba(52,211,153,0.1)' : 'rgba(240,82,82,0.1)', color: r.won_dice_roll ? '#34d399' : '#f05252' }}>
                  {r.won_dice_roll ? '🎲 Won' : '🎲 Lost'}
                </span>
              )}
              {r.went_first !== null && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: r.went_first ? '#fbbf24' : '#a78bfa' }}>
                  {r.went_first ? '1st' : '2nd'}
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: r.result === 'win' ? '#34d399' : '#f05252', minWidth: 24, textAlign: 'right' }}>
                {r.result === 'win' ? 'W' : 'L'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActiveTournament({ tournament, session, onFinish }) {
  const [rounds, setRounds] = useState([])
  const [finishing, setFinishing] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('live_rounds').select('*').eq('tournament_id', tournament.id).order('round_number')
      setRounds(data ?? [])
    }
    load()
  }, [tournament.id])

  const wins = rounds.filter(r => r.result === 'win').length
  const losses = rounds.filter(r => r.result === 'loss').length
  const winRate = rounds.length > 0 ? Math.round((wins / rounds.length) * 100) : 0
  const wentFirstWins = rounds.filter(r => r.went_first === true && r.result === 'win').length
  const wentFirstTotal = rounds.filter(r => r.went_first === true).length
  const wentSecondWins = rounds.filter(r => r.went_first === false && r.result === 'win').length
  const wentSecondTotal = rounds.filter(r => r.went_first === false).length
  const diceWins = rounds.filter(r => r.won_dice_roll === true && r.result === 'win').length
  const diceWon = rounds.filter(r => r.won_dice_roll === true).length

  async function handleFinish() {
    setFinishing(true)
    const placement = parseInt(prompt('Final placement? (e.g. 1 for 1st)') ?? '0')
    if (!placement || isNaN(placement)) { setFinishing(false); return }

    await supabase.from('tournaments').insert({
      user_id: session.user.id,
      name: tournament.name,
      date: tournament.date,
      location: tournament.location,
      player_count: tournament.player_count,
      placement,
      wins,
      losses,
      leader_id: tournament.leader_id,
      leader_name: tournament.leader_name,
      leader_color: tournament.leader_color,
      deck_name: tournament.deck_name,
    })

    await supabase.from('live_tournaments').update({ status: 'finished' }).eq('id', tournament.id)
    setFinishing(false)
    onFinish()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.06))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <img src={getCardImageUrl(tournament.leader_id)} alt={tournament.leader_name} style={{ width: 48, height: 66, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, border: `2px solid ${COLORS[tournament.leader_color] ?? '#8b5cf6'}` }} onError={e => { e.target.style.display = 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', animation: 'livePulse 1.5s ease-in-out infinite' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Live</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f2f5' }}>{tournament.name}</div>
            <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 2 }}>{tournament.leader_name} · {tournament.deck_name}</div>
          </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={async () => {
                    if (!confirm('Cancel this tournament? All round data will be deleted.')) return
                    await supabase.from('live_rounds').delete().eq('tournament_id', tournament.id)
                    await supabase.from('live_tournaments').delete().eq('id', tournament.id)
                    onFinish()
                    }}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    Cancel
                </button>
                <button
                    onClick={() => setShowFinishConfirm(true)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    Finish
                </button>
                </div>
        </div>

        {/* Live stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'Record', value: `${wins}W - ${losses}L` },
            { label: 'Win Rate', value: rounds.length > 0 ? `${winRate}%` : '—' },
            { label: '1st WR', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—' },
            { label: '2nd WR', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#7c6fa0', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <RoundLogger tournament={tournament} rounds={rounds} onRoundLogged={r => setRounds(prev => [...prev, r])} />
        <RoundHistory rounds={rounds} />
      </div>

      {showFinishConfirm && (
        <div onClick={() => setShowFinishConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 24, width: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 8 }}>Finish Tournament?</div>
            <div style={{ fontSize: 13, color: '#7c6fa0', marginBottom: 20 }}>
              This will save your result ({wins}W - {losses}L) to your tournament history. Enter your final placement.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Final Placement</label>
              <input
                id="placement-input"
                type="number"
                placeholder="e.g. 1 for 1st place"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFinishConfirm(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button
                onClick={async () => {
                  const val = parseInt(document.getElementById('placement-input').value)
                  if (!val || isNaN(val)) return
                  setShowFinishConfirm(false)
                  setFinishing(true)
                  await supabase.from('tournaments').insert({
                    user_id: session.user.id,
                    name: tournament.name,
                    date: tournament.date,
                    location: tournament.location,
                    player_count: tournament.player_count,
                    placement: val,
                    wins,
                    losses,
                    leader_id: tournament.leader_id,
                    leader_name: tournament.leader_name,
                    leader_color: tournament.leader_color,
                    deck_name: tournament.deck_name,
                  })
                  await supabase.from('live_tournaments').update({ status: 'finished' }).eq('id', tournament.id)
                  setFinishing(false)
                  onFinish()
                }}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {finishing ? 'Saving...' : 'Save & Finish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LiveTournament({ session }) {
  const [activeTournament, setActiveTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function checkActive() {
      const { data } = await supabase.from('live_tournaments').select('*').eq('user_id', session.user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).single()
      if (data) setActiveTournament(data)
      setLoading(false)
    }
    checkActive()
  }, [session])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>Loading...</div>
      </div>
    )
  }

  if (activeTournament) {
    return <ActiveTournament tournament={activeTournament} session={session} onFinish={() => { setActiveTournament(null); navigate('/dashboard') }} />
  }

  return <SetupScreen session={session} onStart={setActiveTournament} />
}