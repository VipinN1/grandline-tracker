import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchLeaders, getCardImageUrl } from '../lib/optcgapi'
import { useWindowSize } from '../hooks/useWindowSize'
import ProfilePopover from '../components/ProfilePopover'
import MatchChat from '../components/MatchChat'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }
const INPUT = { width: '100%', background: 'rgba(15,8,30,0.92)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const LABEL = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#7c6fa0', marginBottom: 5, display: 'block' }

// ─── Swiss pairing algorithm ─────────────────────────────────────────────────
function generatePairings(standings, usedMatchups, byeCounts = {}) {
  const pool = [...standings].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : Math.random() - 0.5)
  const paired = new Set()
  const pairings = []

  for (let i = 0; i < pool.length; i++) {
    if (paired.has(pool[i].user_id)) continue
    let partner = null
    // Prefer no rematch
    for (let j = i + 1; j < pool.length; j++) {
      if (paired.has(pool[j].user_id)) continue
      const key = [pool[i].user_id, pool[j].user_id].sort().join('|')
      if (!usedMatchups.has(key)) { partner = pool[j]; break }
    }
    // Fall back to any available
    if (!partner) {
      for (let j = i + 1; j < pool.length; j++) {
        if (!paired.has(pool[j].user_id)) { partner = pool[j]; break }
      }
    }
    pairings.push([pool[i], partner ?? null])
    paired.add(pool[i].user_id)
    if (partner) paired.add(partner.user_id)
  }

  // Redistribute bye to player with fewest previous byes (fairness)
  const byeIdx = pairings.findIndex(([, p2]) => p2 === null)
  if (byeIdx !== -1) {
    const currentByePlayer = pairings[byeIdx][0]
    let bestIdx = -1, bestPos = -1, bestCount = byeCounts[currentByePlayer.user_id] ?? 0
    pairings.forEach(([p1, p2], i) => {
      if (i === byeIdx || !p2) return
      if ((byeCounts[p1.user_id] ?? 0) < bestCount) { bestCount = byeCounts[p1.user_id] ?? 0; bestIdx = i; bestPos = 1 }
      if ((byeCounts[p2.user_id] ?? 0) < bestCount) { bestCount = byeCounts[p2.user_id] ?? 0; bestIdx = i; bestPos = 2 }
    })
    if (bestIdx !== -1) {
      const [p1, p2] = pairings[bestIdx]
      if (bestPos === 1) { pairings[byeIdx] = [p1, null]; pairings[bestIdx] = [currentByePlayer, p2] }
      else { pairings[byeIdx] = [p2, null]; pairings[bestIdx] = [p1, currentByePlayer] }
    }
  }

  return pairings
}

// ─── Standings computation ───────────────────────────────────────────────────
function computeStandings(players, matches) {
  const s = {}
  for (const p of players) s[p.user_id] = { ...p, wins: 0, losses: 0, opponents: [] }

  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (m.result === 'player1_win') {
      if (s[m.player1_id]) { s[m.player1_id].wins++; s[m.player1_id].opponents.push(m.player2_id) }
      if (s[m.player2_id]) { s[m.player2_id].losses++; s[m.player2_id].opponents.push(m.player1_id) }
    } else if (m.result === 'player2_win') {
      if (s[m.player2_id]) { s[m.player2_id].wins++; s[m.player2_id].opponents.push(m.player1_id) }
      if (s[m.player1_id]) { s[m.player1_id].losses++; s[m.player1_id].opponents.push(m.player2_id) }
    } else if (m.result === 'bye') {
      if (s[m.player1_id]) s[m.player1_id].wins++
    }
  }

  const arr = Object.values(s)
  for (const p of arr) {
    if (!p.opponents.length) { p.owr = 0; continue }
    const rates = p.opponents.map(id => {
      const o = s[id]; if (!o) return 0
      const t = o.wins + o.losses; return t > 0 ? o.wins / t : 0
    })
    p.owr = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  }
  return arr.sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.owr - a.owr)
}

// ─── Avatar helper ───────────────────────────────────────────────────────────
function Avatar({ profile, size = 32, radius = 8 }) {
  const ini = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 700, color: '#8b5cf6', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt={ini} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
    </div>
  )
}

// ─── Winner overlay ──────────────────────────────────────────────────────────
function WinnerOverlay({ winner, tournament, onClose }) {
  const profile = winner?.profiles
  const ini = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 64, marginBottom: 16, animation: 'orbPulse 2s ease-in-out infinite' }}>🏆</div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', color: '#fbbf24', marginBottom: 12 }}>Tournament Champion</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.5px', marginBottom: 24 }}>{tournament?.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#0f1117', overflow: 'hidden', border: '3px solid #fbbf24', boxShadow: '0 0 40px rgba(251,191,36,0.4)' }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt={ini} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>{profile?.username ?? 'Champion'}</div>
          {profile?.location && <div style={{ fontSize: 13, color: '#7c6fa0' }}>{profile.location}</div>}
        </div>
        <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          View Standings
        </button>
      </div>
    </div>
  )
}

// ─── Inline leader search for decklist modal ─────────────────────────────────
function LeaderPicker({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function handleChange(e) {
    const val = e.target.value; setQuery(val); setOpen(true)
    clearTimeout(debounce.current)
    if (val.length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try { setResults((await searchLeaders(val)).slice(0, 10)) } catch { setResults([]) }
      setSearching(false)
    }, 350)
  }

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,8,30,0.95)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '8px 12px' }}>
        <img src={getCardImageUrl(value)} alt={value.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 3 }} onError={e => { e.target.style.display = 'none' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{value.card_name}</div>
          <div style={{ fontSize: 11, color: COLORS[value.card_color] ?? '#7c6fa0' }}>{value.card_color}</div>
        </div>
        <button onClick={() => onChange(null)} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input style={INPUT} placeholder="Search leader..." value={query} onChange={handleChange} onFocus={() => query.length >= 2 && setOpen(true)} />
      {open && query.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(10,5,22,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '10px 14px', fontSize: 12, color: '#7c6fa0' }}>Searching...</div>
            : results.length === 0 ? <div style={{ padding: '10px 14px', fontSize: 12, color: '#3d2d6e' }}>No leaders found</div>
            : results.map(card => (
              <div key={card.card_image_id ?? card.card_set_id} onClick={() => { onChange(card); setQuery(''); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 3 }} onError={e => { e.target.style.display = 'none' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</div>
                  <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#7c6fa0' }}>{card.card_color} · {card.card_set_id}</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function TournamentDetailPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [matches, setMatches] = useState([])
  const [matchMessages, setMatchMessages] = useState([])
  const matchesRef = useRef([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('pairings')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [joining, setJoining] = useState(false)
  const [startingRound, setStartingRound] = useState(false)
  const [roundError, setRoundError] = useState(null)
  const [showWinner, setShowWinner] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showForceEndModal, setShowForceEndModal] = useState(false)
  const [submittingMatches, setSubmittingMatches] = useState(new Set())
  const [showDropConfirm, setShowDropConfirm] = useState(false)
  const [droppingUserId, setDroppingUserId] = useState(null)
  const [droppingPlayer, setDroppingPlayer] = useState(false)
  const [dropError, setDropError] = useState(null)
  const [decklistModal, setDecklistModal] = useState(false)
  const [decklistLeader, setDecklistLeader] = useState(null)
  const [decklistText, setDecklistText] = useState('')
  const [savingDecklist, setSavingDecklist] = useState(false)

  // ── Derived ────────────────────────────────────────────────────────────────
  const myEntry = players.find(p => p.user_id === session?.user?.id)
  const isParticipant = !!myEntry
  const hasDropped = !!myEntry?.dropped
  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null
  const currentMatches = currentRound ? matches.filter(m => m.round_id === currentRound.id) : []
  const standings = computeStandings(players, matches)
  const undefeated = standings.filter(s => s.losses === 0)
  const regOpen = tournament?.status === 'registration' &&
    tournament?.registration_deadline &&
    new Date() < new Date(tournament.registration_deadline)
  const allMatchesDone = currentMatches.length > 0 &&
    currentMatches.every(m => m.status === 'completed')
  const disputedMatches = currentMatches.filter(m => m.status === 'disputed')
  const winnerEntry = tournament?.winner_id ? players.find(p => p.user_id === tournament.winner_id) : null

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll()
    const channel = supabase.channel(`sim_tournament_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_matches' }, payload => {
        if (payload.new?.tournament_id === id || payload.old?.tournament_id === id) loadMatches()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_tournament_players' }, payload => {
        if (payload.new?.tournament_id === id || payload.old?.tournament_id === id) loadPlayers()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_rounds' }, payload => {
        if (payload.new?.tournament_id === id || payload.old?.tournament_id === id) loadRounds()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_tournaments' }, payload => {
        if (payload.new?.id === id || payload.old?.id === id) loadTournament()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sim_match_messages' }, payload => {
        const msg = payload.new
        if (!matchesRef.current.some(m => m.id === msg.match_id)) return
        setMatchMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      })
      .subscribe()
    return () => channel.unsubscribe()
  }, [id])

  useEffect(() => {
    if (!tournament || !session) return
    if (tournament.created_by === session.user.id) { setIsAdmin(true); return }
    supabase.from('sim_tournament_admins')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))
  }, [tournament, session])

  useEffect(() => {
    if (tournament?.status === 'completed' && winnerEntry) setShowWinner(true)
  }, [tournament?.status, winnerEntry])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadTournament(), loadPlayers(), loadRounds(), loadMatches()])
    await loadMatchMessages(matchesRef.current.map(m => m.id))
    setLoading(false)
  }

  async function loadTournament() {
    const { data } = await supabase.from('sim_tournaments').select('*').eq('id', id).single()
    setTournament(data)
  }

  async function loadPlayers() {
    const { data: playerRows } = await supabase
      .from('sim_tournament_players')
      .select('*')
      .eq('tournament_id', id)
      .order('created_at')
    if (!playerRows?.length) { setPlayers([]); return }

    const userIds = playerRows.map(p => p.user_id)
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, location, bio')
      .in('id', userIds)
    const profileMap = Object.fromEntries((profileRows ?? []).map(p => [p.id, p]))
    setPlayers(playerRows.map(p => ({ ...p, profiles: profileMap[p.user_id] ?? null })))
  }

  async function loadRounds() {
    const { data } = await supabase.from('sim_rounds').select('*').eq('tournament_id', id).order('round_number')
    setRounds(data ?? [])
  }

  async function loadMatches() {
    const { data } = await supabase.from('sim_matches').select('*').eq('tournament_id', id)
    const result = data ?? []
    matchesRef.current = result
    setMatches(result)
  }

  async function loadMatchMessages(matchIds) {
    if (!matchIds?.length) return
    const { data } = await supabase
      .from('sim_match_messages')
      .select('*')
      .in('match_id', matchIds)
      .order('created_at', { ascending: true })
    setMatchMessages(data ?? [])
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function join() {
    if (!session || isParticipant) return
    setJoining(true)
    const { data: existing } = await supabase
      .from('sim_tournament_players').select('id')
      .eq('tournament_id', id).eq('user_id', session.user.id).maybeSingle()
    if (!existing) {
      await supabase.from('sim_tournament_players').insert({ tournament_id: id, user_id: session.user.id })
    }
    await loadPlayers()
    setJoining(false)
  }

  async function dropPlayer(userId) {
    setDroppingPlayer(true)
    setDropError(null)

    const { error: dropErr } = await supabase
      .from('sim_tournament_players')
      .update({ dropped: true })
      .eq('tournament_id', id)
      .eq('user_id', userId)

    if (dropErr) {
      setDropError('Failed to drop player. Check Supabase RLS policies.')
      setDroppingPlayer(false)
      return
    }

    // Auto-forfeit any pending match this round for the dropped player
    if (currentRound) {
      const pendingMatch = currentMatches.find(m =>
        (m.player1_id === userId || m.player2_id === userId) && m.status === 'pending'
      )
      if (pendingMatch) {
        const result = pendingMatch.player1_id === userId ? 'player2_win' : 'player1_win'
        await supabase.from('sim_matches').update({ result, status: 'completed' }).eq('id', pendingMatch.id)
      }
    }

    await loadPlayers()
    setDroppingPlayer(false)
    setDroppingUserId(null)
    setShowDropConfirm(false)
  }

  async function submitResult(match, report) {
    if (submittingMatches.has(match.id)) return
    setSubmittingMatches(prev => new Set([...prev, match.id]))

    const isP1 = session.user.id === match.player1_id
    const field = isP1 ? 'player1_reported' : 'player2_reported'
    const other = isP1 ? match.player2_reported : match.player1_reported
    const update = { [field]: report }

    if (other) {
      const p1r = isP1 ? report : other
      const p2r = isP1 ? other : report
      if (p1r === 'win' && p2r === 'loss') { update.result = 'player1_win'; update.status = 'completed' }
      else if (p1r === 'loss' && p2r === 'win') { update.result = 'player2_win'; update.status = 'completed' }
      else update.status = 'disputed'
    }

    await supabase.from('sim_matches').update(update).eq('id', match.id)
    setSubmittingMatches(prev => { const n = new Set(prev); n.delete(match.id); return n })
  }

  async function resolveDispute(matchId, result) {
    await supabase.from('sim_matches').update({ result, status: 'completed' }).eq('id', matchId)
  }

  async function startRound() {
    setStartingRound(true)
    setRoundError(null)

    if (currentRound) {
      await supabase.from('sim_rounds').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', currentRound.id)
    }

    const nextNum = (currentRound?.round_number ?? 0) + 1
    const used = new Set(matches.map(m => [m.player1_id, m.player2_id].filter(Boolean).sort().join('|')))
    const byeCounts = matches.filter(m => m.result === 'bye').reduce((acc, m) => {
      acc[m.player1_id] = (acc[m.player1_id] ?? 0) + 1; return acc
    }, {})
    const droppedIds = new Set(players.filter(p => p.dropped).map(p => p.user_id))
    const activeStandings = standings.filter(s => !droppedIds.has(s.user_id))
    const pairings = generatePairings(activeStandings, used, byeCounts)

    const { data: newRound, error: roundErr } = await supabase
      .from('sim_rounds').insert({ tournament_id: id, round_number: nextNum }).select().single()
    if (!newRound || roundErr) {
      setRoundError('Failed to create round. Please try again.')
      setStartingRound(false)
      return
    }

    const { error: matchErr } = await supabase.from('sim_matches').insert(
      pairings.map(([p1, p2]) => ({
        round_id: newRound.id,
        tournament_id: id,
        player1_id: p1.user_id,
        player2_id: p2?.user_id ?? null,
        result: p2 ? null : 'bye',
        status: p2 ? 'pending' : 'completed',
      }))
    )
    if (matchErr) {
      await supabase.from('sim_rounds').delete().eq('id', newRound.id)
      setRoundError('Failed to create pairings. Please try again.')
      setStartingRound(false)
      return
    }

    await supabase.from('sim_tournaments').update({ current_round: nextNum, status: 'active' }).eq('id', id)
    setStartingRound(false)
    setActiveTab('pairings')
  }

  async function declareWinner(userId) {
    await supabase.from('sim_tournaments').update({ status: 'completed', winner_id: userId }).eq('id', id)
    if (currentRound) {
      await supabase.from('sim_rounds').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', currentRound.id)
    }
  }

  async function deleteTournament() {
    setDeleting(true)
    const r1 = await supabase.from('sim_matches').delete().eq('tournament_id', id)
    const r2 = await supabase.from('sim_rounds').delete().eq('tournament_id', id)
    const r3 = await supabase.from('sim_tournament_players').delete().eq('tournament_id', id)
    const r4 = await supabase.from('sim_tournament_admins').delete().eq('tournament_id', id)
    const r5 = await supabase.from('sim_tournaments').delete().eq('id', id)
    const errors = [r1, r2, r3, r4, r5].map(r => r.error).filter(Boolean)
    if (errors.length > 0) {
      console.error('Delete errors:', errors)
      setDeleting(false)
      return
    }
    navigate('/tournaments')
  }

  async function saveDecklist() {
    if (!decklistLeader) return
    setSavingDecklist(true)
    await supabase.from('sim_tournament_players')
      .update({
        decklist: { leader_id: decklistLeader.card_image_id ?? decklistLeader.card_set_id, leader_name: decklistLeader.card_name, leader_color: decklistLeader.card_color, card_image: decklistLeader.card_image, raw: decklistText.trim() },
        decklist_submitted: true,
      })
      .eq('tournament_id', id).eq('user_id', session.user.id)
    setSavingDecklist(false)
    setDecklistModal(false)
    await loadPlayers()
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function playerProfile(userId) {
    return players.find(p => p.user_id === userId)?.profiles ?? null
  }

  function myMatchInRound(roundId) {
    if (!session) return null
    return matches.find(m => m.round_id === roundId && (m.player1_id === session.user.id || m.player2_id === session.user.id))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ fontSize: 13, color: '#7c6fa0' }}>Loading tournament...</div>
    </div>
  )

  if (!tournament) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 8 }}>Tournament not found</div>
      <button onClick={() => navigate('/tournaments')} style={{ color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Back to Tournaments</button>
    </div>
  )

  const statusColors = { registration: '#8b5cf6', active: '#34d399', completed: '#94a3b8' }
  const statusLabels = { registration: 'Registration Open', active: 'In Progress', completed: 'Completed' }

  // Tab list
  const tabs = ['pairings', 'standings', 'history']
  if (tournament.status === 'completed') tabs.push('decklists')

  return (
    <div>
      {showWinner && winnerEntry && (
        <WinnerOverlay winner={winnerEntry} tournament={tournament} onClose={() => { setShowWinner(false); setActiveTab('standings') }} />
      )}

      {/* Back + header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/tournaments')} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0, marginBottom: 12 }}>← Tournaments</button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px' }}>{tournament.name}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${statusColors[tournament.status]}22`, color: statusColors[tournament.status], border: `1px solid ${statusColors[tournament.status]}44` }}>
                {statusLabels[tournament.status]}{tournament.status === 'active' ? ` · Round ${tournament.current_round}` : ''}
              </span>
            </div>
            {tournament.description && <div style={{ fontSize: 13, color: '#8a9bb0', marginBottom: 6, lineHeight: 1.5 }}>{tournament.description}</div>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#7c6fa0' }}>👥 {players.length} players</span>
              {tournament.registration_deadline && (
                <span style={{ fontSize: 12, color: '#7c6fa0' }}>
                  ⏰ {new Date() < new Date(tournament.registration_deadline) ? 'Deadline:' : 'Closed:'} {new Date(tournament.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {tournament.discord_link && (
                <a href={tournament.discord_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none' }}>💬 Join Discord</a>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {isParticipant && tournament.status !== 'completed' && (
              <button onClick={() => { setDecklistModal(true); const me = myEntry; if (me?.decklist?.raw) setDecklistText(me.decklist.raw) }} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: myEntry?.decklist_submitted ? 'rgba(52,211,153,0.08)' : 'rgba(139,92,246,0.08)', color: myEntry?.decklist_submitted ? '#34d399' : '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>
                {myEntry?.decklist_submitted ? 'Decklist ✓' : 'Submit Decklist'}
              </button>
            )}
            {session && regOpen && !isParticipant && (
              <button onClick={join} disabled={joining} style={{ fontSize: 12, fontWeight: 700, padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {joining ? 'Joining...' : 'Join Tournament'}
              </button>
            )}
            {session && isParticipant && !hasDropped && tournament.status !== 'completed' && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>Registered ✓</span>
            )}
            {session && isParticipant && !hasDropped && tournament.status === 'active' && (
              <button onClick={() => { setDroppingUserId(session.user.id); setShowDropConfirm(true) }} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>
                Drop
              </button>
            )}
            {session && isParticipant && hasDropped && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>Dropped</span>
            )}
            {!session && regOpen && (
              <button onClick={() => navigate('/login')} style={{ fontSize: 12, fontWeight: 700, padding: '7px 18px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'transparent', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>Sign in to Join</button>
            )}
          </div>
        </div>
      </div>

      {/* Admin panel */}
      {isAdmin && (
        <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', marginBottom: 10 }}>Admin Controls</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Start / Next round button */}
            {(tournament.status === 'registration' || (tournament.status === 'active' && allMatchesDone && disputedMatches.length === 0)) && (
              <button onClick={startRound} disabled={startingRound || players.length < 2} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: players.length < 2 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: players.length < 2 ? '#3d2d6e' : '#fff', cursor: players.length < 2 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {startingRound ? 'Starting...' : tournament.status === 'registration' ? `Start Round 1 (${players.length} players)` : `Start Round ${(currentRound?.round_number ?? 0) + 1}`}
              </button>
            )}
            {/* Declare winner — auto when exactly 1 undefeated */}
            {tournament.status === 'active' && allMatchesDone && undefeated.length === 1 && (
              <button onClick={() => declareWinner(undefeated[0].user_id)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #d97706, #fbbf24)', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit' }}>
                🏆 Declare Winner: {undefeated[0].profiles?.username}
              </button>
            )}
            {/* Force end — when round is done but winner can't be auto-determined */}
            {tournament.status === 'active' && allMatchesDone && undefeated.length !== 1 && (
              <button onClick={() => setShowForceEndModal(true)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', color: '#fbbf24', cursor: 'pointer', fontFamily: 'inherit' }}>
                🏆 End Tournament
              </button>
            )}
            {/* Status info */}
            {tournament.status === 'active' && !allMatchesDone && (
              <span style={{ fontSize: 12, color: '#7c6fa0' }}>
                {currentMatches.filter(m => m.status === 'pending').length} match{currentMatches.filter(m => m.status === 'pending').length !== 1 ? 'es' : ''} pending · {currentMatches.filter(m => m.status === 'disputed').length > 0 ? `${currentMatches.filter(m => m.status === 'disputed').length} disputed` : ''}
              </span>
            )}
            {roundError && (
              <span style={{ fontSize: 12, color: '#f05252', flexBasis: '100%', marginTop: 4 }}>{roundError}</span>
            )}
            <button onClick={() => setShowDeleteConfirm(true)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
              Delete Tournament
            </button>
          </div>
          {/* Disputed matches */}
          {disputedMatches.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(251,191,36,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f97316', marginBottom: 8 }}>⚠️ Disputes to resolve</div>
              {disputedMatches.map(m => {
                const p1 = playerProfile(m.player1_id)
                const p2 = playerProfile(m.player2_id)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(249,115,22,0.06)', borderRadius: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: '#f0f2f5', flex: 1 }}>{p1?.username} vs {p2?.username}</span>
                    <span style={{ fontSize: 11, color: '#7c6fa0' }}>
                      {p1?.username}: {m.player1_reported ?? '—'} · {p2?.username}: {m.player2_reported ?? '—'}
                    </span>
                    <button onClick={() => resolveDispute(m.id, 'player1_win')} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(52,211,153,0.15)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }}>{p1?.username} wins</button>
                    <button onClick={() => resolveDispute(m.id, 'player2_win')} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(52,211,153,0.15)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }}>{p2?.username} wins</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === t ? 'rgba(139,92,246,0.05)' : 'transparent', color: activeTab === t ? '#f0f2f5' : '#7c6fa0', borderBottom: activeTab === t ? '2px solid #8b5cf6' : '2px solid transparent', transition: 'all 0.1s', textTransform: 'capitalize' }}>
            {t === 'pairings' ? `Round ${tournament.current_round || '—'}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Pairings tab ─────────────────────────────────────────────────── */}
      {activeTab === 'pairings' && (
        <div>
          {rounds.length === 0 ? (
            <div>
              <div style={{ textAlign: 'center', padding: '40px 20px 24px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚔️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>
                  {tournament.status === 'registration' ? 'Waiting for tournament to start' : 'No pairings yet'}
                </div>
                <div style={{ fontSize: 13, color: '#3d2d6e' }}>{players.length} player{players.length !== 1 ? 's' : ''} registered</div>
              </div>
              {players.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3d2d6e', marginBottom: 4, paddingLeft: 4 }}>Registered Players</div>
                  {players.map((p, i) => (
                    <div
                      key={p.user_id}
                      onClick={() => p.profiles && setSelectedProfile(p.profiles)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: p.user_id === session?.user?.id ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.04)', border: `1px solid ${p.user_id === session?.user?.id ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: p.profiles ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#3d2d6e', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                      <Avatar profile={p.profiles} size={32} radius={8} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.profiles?.username ?? 'Unknown'}
                          {p.user_id === session?.user?.id && <span style={{ fontSize: 10, marginLeft: 6, color: '#8b5cf6', fontWeight: 700 }}>you</span>}
                        </div>
                        {p.profiles?.location && <div style={{ fontSize: 11, color: '#7c6fa0' }}>{p.profiles.location}</div>}
                      </div>
                      {p.decklist_submitted && <span style={{ fontSize: 10, fontWeight: 600, color: '#34d399', flexShrink: 0 }}>Decklist ✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            currentMatches.map(m => {
              const p1 = playerProfile(m.player1_id)
              const p2 = m.player2_id ? playerProfile(m.player2_id) : null
              const isP1 = session?.user?.id === m.player1_id
              const isP2 = session?.user?.id === m.player2_id
              const inMatch = isP1 || isP2
              const myReport = isP1 ? m.player1_reported : isP2 ? m.player2_reported : null
              const winner = m.result === 'player1_win' ? p1 : m.result === 'player2_win' ? p2 : null

              return (
                <div key={m.id} style={{ background: 'rgba(139,92,246,0.05)', border: `1px solid ${m.status === 'disputed' ? 'rgba(249,115,22,0.3)' : m.status === 'completed' ? 'rgba(255,255,255,0.07)' : inMatch ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 20px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {/* Player 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: isMobile ? '40%' : 0, cursor: p1 ? 'pointer' : 'default' }} onClick={() => p1 && setSelectedProfile(players.find(p => p.user_id === m.player1_id)?.profiles)}>
                      <Avatar profile={p1} size={36} radius={9} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.result === 'player1_win' ? '#34d399' : m.result === 'player2_win' ? '#3d2d6e' : '#f0f2f5' }}>{p1?.username ?? 'Unknown'}</div>
                        {m.player1_reported && m.status !== 'completed' && <div style={{ fontSize: 10, color: '#7c6fa0' }}>Reported {m.player1_reported}</div>}
                      </div>
                    </div>

                    {/* VS / result */}
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      {m.result === 'bye' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>BYE</span>
                      ) : m.status === 'completed' ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>✓</span>
                      ) : m.status === 'disputed' ? (
                        <span style={{ fontSize: 16 }}>⚠️</span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#3d2d6e', fontWeight: 700 }}>vs</span>
                      )}
                    </div>

                    {/* Player 2 */}
                    {p2 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: isMobile ? '40%' : 0, justifyContent: isMobile ? 'flex-start' : 'flex-end', cursor: 'pointer' }} onClick={() => setSelectedProfile(players.find(p => p.user_id === m.player2_id)?.profiles)}>
                        {isMobile ? null : <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: m.result === 'player2_win' ? '#34d399' : m.result === 'player1_win' ? '#3d2d6e' : '#f0f2f5' }}>{p2?.username ?? 'Unknown'}</div>
                          {m.player2_reported && m.status !== 'completed' && <div style={{ fontSize: 10, color: '#7c6fa0' }}>Reported {m.player2_reported}</div>}
                        </div>}
                        <Avatar profile={p2} size={36} radius={9} />
                        {isMobile && <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: m.result === 'player2_win' ? '#34d399' : m.result === 'player1_win' ? '#3d2d6e' : '#f0f2f5' }}>{p2?.username ?? 'Unknown'}</div>
                          {m.player2_reported && m.status !== 'completed' && <div style={{ fontSize: 10, color: '#7c6fa0' }}>Reported {m.player2_reported}</div>}
                        </div>}
                      </div>
                    ) : <div style={{ flex: 1 }} />}

                    {/* Result submission */}
                    {inMatch && m.status === 'pending' && !myReport && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => submitResult(m, 'win')} disabled={submittingMatches.has(m.id)} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', cursor: submittingMatches.has(m.id) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: submittingMatches.has(m.id) ? 0.5 : 1 }}>I Won</button>
                        <button onClick={() => submitResult(m, 'loss')} disabled={submittingMatches.has(m.id)} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252', cursor: submittingMatches.has(m.id) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: submittingMatches.has(m.id) ? 0.5 : 1 }}>I Lost</button>
                      </div>
                    )}
                    {inMatch && m.status === 'pending' && myReport && (
                      <span style={{ fontSize: 11, color: '#7c6fa0', flexShrink: 0 }}>Waiting for opponent...</span>
                    )}
                    {m.status === 'completed' && winner && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>🏆 {winner.username}</span>
                    )}
                    {m.status === 'disputed' && !isAdmin && (
                      <span style={{ fontSize: 11, color: '#f97316', flexShrink: 0 }}>Awaiting admin</span>
                    )}
                  </div>
                  <MatchChat
                    matchId={m.id}
                    currentUserId={session?.user?.id}
                    player1Id={m.player1_id}
                    player2Id={m.player2_id}
                    isAdmin={isAdmin}
                    messages={matchMessages.filter(msg => msg.match_id === m.id)}
                    getProfile={uid => players.find(p => p.user_id === uid)?.profiles}
                    onMessageSent={msg => setMatchMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])}
                  />
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Standings tab ─────────────────────────────────────────────────── */}
      {activeTab === 'standings' && (
        <div>
          {standings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e', fontSize: 13 }}>No players yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `36px 1fr 60px 60px 80px${isAdmin && tournament.status === 'active' ? ' 60px' : ''}`, gap: 12, padding: '6px 14px', marginBottom: 4 }}>
                {['#', 'Player', 'W', 'L', 'OWR', ...(isAdmin && tournament.status === 'active' ? [''] : [])].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3d2d6e' }}>{h}</div>
                ))}
              </div>
              {standings.map((s, i) => {
                const isWinner = tournament.winner_id === s.user_id
                const playerEntry = players.find(p => p.user_id === s.user_id)
                const isDropped = !!playerEntry?.dropped
                return (
                  <div
                    key={s.user_id}
                    onClick={() => s.profiles && setSelectedProfile(s.profiles)}
                    style={{ display: 'grid', gridTemplateColumns: `36px 1fr 60px 60px 80px${isAdmin && tournament.status === 'active' ? ' 60px' : ''}`, gap: 12, alignItems: 'center', padding: '10px 14px', background: isDropped ? 'rgba(255,255,255,0.02)' : isWinner ? 'rgba(251,191,36,0.06)' : 'rgba(139,92,246,0.05)', border: `1px solid ${isDropped ? 'rgba(255,255,255,0.04)' : isWinner ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: 'pointer', opacity: isDropped ? 0.5 : 1, transition: 'all 0.1s' }}
                    onMouseEnter={e => { if (!isDropped) e.currentTarget.style.borderColor = isWinner ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.14)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDropped ? 'rgba(255,255,255,0.04)' : isWinner ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: i === 0 && !isDropped ? '#fbbf24' : '#3d2d6e' }}>{i + 1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Avatar profile={s.profiles} size={28} radius={7} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDropped ? '#7c6fa0' : '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.profiles?.username ?? 'Unknown'}</span>
                      {isWinner && <span style={{ fontSize: 10, color: '#fbbf24' }}>🏆</span>}
                      {isDropped && <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', flexShrink: 0 }}>dropped</span>}
                      {!isDropped && s.losses === 0 && !isWinner && tournament.status === 'active' && <span style={{ fontSize: 10, color: '#34d399', flexShrink: 0 }}>undefeated</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>{s.wins}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.losses > 0 ? '#f05252' : '#3d2d6e' }}>{s.losses}</div>
                    <div style={{ fontSize: 12, color: '#7c6fa0', fontFamily: 'monospace' }}>{s.wins + s.losses > 0 ? `${Math.round(s.owr * 100)}%` : '—'}</div>
                    {isAdmin && tournament.status === 'active' && (
                      <div onClick={e => e.stopPropagation()}>
                        {!isDropped && (
                          <button onClick={() => { setDroppingUserId(s.user_id); setShowDropConfirm(true) }} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>Drop</button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ───────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rounds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e', fontSize: 13 }}>No rounds played yet</div>
          ) : rounds.map(round => {
            const rMatches = matches.filter(m => m.round_id === round.id)
            return (
              <div key={round.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>Round {round.round_number}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: round.status === 'completed' ? 'rgba(52,211,153,0.1)' : 'rgba(139,92,246,0.1)', color: round.status === 'completed' ? '#34d399' : '#8b5cf6' }}>
                    {round.status === 'completed' ? 'Complete' : 'In Progress'}
                  </span>
                </div>
                {rMatches.map(m => {
                  const p1 = playerProfile(m.player1_id)
                  const p2 = m.player2_id ? playerProfile(m.player2_id) : null
                  const winner = m.result === 'player1_win' ? p1 : m.result === 'player2_win' ? p2 : null
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: m.result === 'player1_win' ? '#34d399' : '#7c6fa0', fontWeight: m.result === 'player1_win' ? 700 : 400, flex: 1, cursor: 'pointer' }} onClick={() => p1 && setSelectedProfile(p1)}>{p1?.username ?? '?'}</span>
                      {m.result === 'bye' ? <span style={{ fontSize: 11, color: '#a78bfa' }}>BYE</span> : <span style={{ fontSize: 11, color: '#3d2d6e' }}>vs</span>}
                      {p2 && <span style={{ fontSize: 13, color: m.result === 'player2_win' ? '#34d399' : '#7c6fa0', fontWeight: m.result === 'player2_win' ? 700 : 400, flex: 1, textAlign: 'right', cursor: 'pointer' }} onClick={() => setSelectedProfile(p2)}>{p2.username}</span>}
                      {winner && <span style={{ fontSize: 11, color: '#34d399', flexShrink: 0 }}>🏆 {winner.username}</span>}
                      {m.status === 'pending' && <span style={{ fontSize: 11, color: '#3d2d6e', flexShrink: 0 }}>Pending</span>}
                      {m.status === 'disputed' && <span style={{ fontSize: 11, color: '#f97316', flexShrink: 0 }}>Disputed</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Decklists tab (only after completion) ────────────────────────── */}
      {activeTab === 'decklists' && tournament.status === 'completed' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
          {players.filter(p => p.decklist_submitted).map(p => {
            const dl = p.decklist
            const leaderImg = dl?.card_image ?? (dl?.leader_id ? getCardImageUrl(dl.leader_id) : null)
            return (
              <div key={p.id} style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <Avatar profile={p.profiles} size={36} radius={9} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5', cursor: 'pointer' }} onClick={() => setSelectedProfile(p.profiles)}>{p.profiles?.username}</div>
                    {dl?.leader_name && <div style={{ fontSize: 11, color: COLORS[dl.leader_color] ?? '#7c6fa0' }}>{dl.leader_name}</div>}
                  </div>
                  {leaderImg && <img src={leaderImg} alt={dl?.leader_name} style={{ height: 52, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.display = 'none' }} />}
                </div>
                {dl?.raw && (
                  <pre style={{ margin: 0, padding: '12px 16px', fontSize: 12, color: '#8a9bb0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.7, overflowX: 'auto' }}>
                    {dl.raw}
                  </pre>
                )}
              </div>
            )
          })}
          {players.filter(p => !p.decklist_submitted).length > 0 && (
            <div style={{ fontSize: 12, color: '#3d2d6e', padding: 10 }}>
              {players.filter(p => !p.decklist_submitted).length} player{players.filter(p => !p.decklist_submitted).length !== 1 ? 's' : ''} did not submit a decklist.
            </div>
          )}
        </div>
      )}

      {/* ── Drop confirmation modal ──────────────────────────────────────── */}
      {showDropConfirm && (
        <div onClick={() => { if (droppingPlayer) return; setShowDropConfirm(false); setDroppingUserId(null); setDropError(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0b1e', border: '1px solid rgba(240,82,82,0.25)', borderRadius: 16, width: 360, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>
              {droppingUserId === session?.user?.id ? 'Drop from Tournament?' : `Drop ${players.find(p => p.user_id === droppingUserId)?.profiles?.username ?? 'Player'}?`}
            </div>
            <div style={{ fontSize: 13, color: '#8a9bb0', lineHeight: 1.6 }}>
              {droppingUserId === session?.user?.id
                ? 'You will be removed from future pairings. Your current record will remain in the standings. This cannot be undone.'
                : 'This player will be removed from future pairings. Their current record stays in standings. Any pending match this round will be forfeited.'}
            </div>
            {dropError && <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 6, padding: '8px 10px' }}>{dropError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowDropConfirm(false); setDroppingUserId(null); setDropError(null) }} disabled={droppingPlayer} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: droppingPlayer ? 'default' : 'pointer', fontFamily: 'inherit', opacity: droppingPlayer ? 0.5 : 1 }}>Cancel</button>
              <button onClick={() => dropPlayer(droppingUserId)} disabled={droppingPlayer} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#f05252', color: '#fff', fontSize: 13, fontWeight: 700, cursor: droppingPlayer ? 'default' : 'pointer', fontFamily: 'inherit', opacity: droppingPlayer ? 0.7 : 1 }}>
                {droppingPlayer ? 'Dropping...' : droppingUserId === session?.user?.id ? 'Drop Me' : 'Drop Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Force end tournament modal ───────────────────────────────────── */}
      {showForceEndModal && (
        <div onClick={() => setShowForceEndModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0b1e', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16, width: 400, maxHeight: '80vh', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 4 }}>End Tournament</div>
              <div style={{ fontSize: 12, color: '#7c6fa0' }}>Select the winner from the current standings.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {standings.map((s, i) => (
                <div
                  key={s.user_id}
                  onClick={() => { declareWinner(s.user_id); setShowForceEndModal(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.3)'; e.currentTarget.style.background = 'rgba(251,191,36,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#3d2d6e', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                  <Avatar profile={s.profiles} size={28} radius={7} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{s.profiles?.username ?? 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: '#7c6fa0', fontFamily: 'monospace' }}>{s.wins}W · {s.losses}L</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#fbbf24' }}>Declare 🏆</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowForceEndModal(false)} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0b1e', border: '1px solid rgba(240,82,82,0.3)', borderRadius: 16, width: 360, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>Delete Tournament</div>
            <div style={{ fontSize: 13, color: '#8a9bb0', lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: '#f0f2f5' }}>{tournament.name}</strong>? This will permanently remove all rounds, matches, and player registrations. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={deleteTournament} disabled={deleting} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#f05252', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decklist submission modal ─────────────────────────────────────── */}
      {decklistModal && (
        <div onClick={() => setDecklistModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0b1e', border: '1px solid rgba(139,92,246,0.25)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 520, maxHeight: '85vh', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>Submit Decklist</div>
            <div style={{ fontSize: 12, color: '#7c6fa0', lineHeight: 1.5 }}>Your decklist is hidden from other players until the tournament ends.</div>
            <div>
              <label style={LABEL}>Leader Card</label>
              <LeaderPicker value={decklistLeader ?? myEntry?.decklist?.leader_id} onChange={setDecklistLeader} />
            </div>
            <div>
              <label style={LABEL}>Decklist (paste your deck)</label>
              <textarea
                value={decklistText}
                onChange={e => setDecklistText(e.target.value)}
                placeholder={'4x OP01-005 Monkey D. Luffy\n4x OP01-006 ...\n...'}
                style={{ ...INPUT, minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDecklistModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveDecklist} disabled={savingDecklist || !decklistLeader} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: savingDecklist || !decklistLeader ? 0.5 : 1 }}>
                {savingDecklist ? 'Saving...' : 'Submit Decklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile popover */}
      {selectedProfile && (
        <ProfilePopover profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  )
}
