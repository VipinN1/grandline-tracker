// RN port of src/pages/TournamentDetailPage.jsx — sim tournament detail:
// join/drop, decklist submission, Swiss pairings, match reporting with
// realtime sync, standings with OWR tiebreaker, history, admin controls.
import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius } from '../../theme'
import { fieldInput, FieldLabel, LeaderSearchInput, LEADER_COLORS } from '../../components/forms'
import { GlassButton, GlassPills } from '../../components/glass'
import MatchChat from '../../components/MatchChat'
import ProfileCard, { Avatar } from '../../components/ProfileCard'
import { useSession } from '../../lib/auth'

// ─── Swiss pairing (identical to web) ────────────────────────────────────────
function bestMatching(pool, usedMatchups) {
  let best = null
  let bestCost = Infinity
  let nodes = 0
  const NODE_LIMIT = 200000

  const recurse = (remaining, acc, cost) => {
    if (cost >= bestCost || nodes++ > NODE_LIMIT) return
    if (remaining.length < 2) { best = acc.slice(); bestCost = cost; return }
    const first = remaining[0]
    const rest = remaining.slice(1)
    for (let i = 0; i < rest.length; i++) {
      const cand = rest[i]
      const key = [first.user_id, cand.user_id].sort().join('|')
      const c = usedMatchups.has(key) ? 1 : 0
      acc.push([first, cand])
      recurse(rest.filter((_, idx) => idx !== i), acc, cost + c)
      acc.pop()
      if (bestCost === 0) return
    }
  }

  recurse(pool, [], 0)
  return best ?? []
}

function generatePairings(standings, usedMatchups, byeCounts = {}) {
  const pool = [...standings]
    .sort(() => Math.random() - 0.5)
    .sort((a, b) => b.wins - a.wins)

  if (pool.length === 0) return []
  if (pool.length % 2 === 0) return bestMatching(pool, usedMatchups)

  const byeCandidates = [...pool].sort((a, b) => {
    const ba = byeCounts[a.user_id] ?? 0, bb = byeCounts[b.user_id] ?? 0
    if (ba !== bb) return ba - bb
    return pool.indexOf(b) - pool.indexOf(a)
  })

  let chosen = null
  let chosenCost = Infinity
  for (const bye of byeCandidates) {
    const rest = pool.filter(p => p.user_id !== bye.user_id)
    const match = bestMatching(rest, usedMatchups)
    const cost = match.reduce((n, [p1, p2]) =>
      n + (usedMatchups.has([p1.user_id, p2.user_id].sort().join('|')) ? 1 : 0), 0)
    if (cost < chosenCost) {
      chosen = [...match, [bye, null]]
      chosenCost = cost
      if (cost === 0) break
    }
  }
  return chosen
}

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

const ghostBtn = { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.lineStrong }

export default function SimTournamentDetail() {
  const { id } = useLocalSearchParams()
  const { session } = useSession()

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
  const [showForceEndModal, setShowForceEndModal] = useState(false)
  const [submittingMatches, setSubmittingMatches] = useState(new Set())
  const [decklistModal, setDecklistModal] = useState(false)
  const [decklistLeader, setDecklistLeader] = useState(null)
  const [decklistText, setDecklistText] = useState('')
  const [savingDecklist, setSavingDecklist] = useState(false)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const myEntry = players.find(p => p.user_id === session?.user?.id)
  const isParticipant = !!myEntry
  const hasDropped = !!myEntry?.dropped
  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null
  const currentMatches = currentRound ? matches.filter(m => m.round_id === currentRound.id) : []
  const standings = computeStandings(players, matches)
  const droppedPlayerIds = new Set(players.filter(p => p.dropped).map(p => p.user_id))
  const undefeated = standings.filter(s => s.losses === 0 && !droppedPlayerIds.has(s.user_id))
  const regOpen = tournament?.status === 'registration' &&
    (!tournament?.registration_deadline || new Date() < new Date(tournament.registration_deadline))
  const allMatchesDone = currentMatches.length > 0 && currentMatches.every(m => m.status === 'completed')
  const disputedMatches = currentMatches.filter(m => m.status === 'disputed')
  const winnerEntry = tournament?.winner_id ? players.find(p => p.user_id === tournament.winner_id) : null

  // ── Load + realtime ─────────────────────────────────────────────────────────
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
    return () => { channel.unsubscribe() }
  }, [id])

  useEffect(() => {
    if (!tournament || !session) return
    if (tournament.created_by === session.user.id) { setIsAdmin(true); return }
    supabase.from('sim_tournament_admins')
      .select('id').eq('tournament_id', tournament.id).eq('user_id', session.user.id).maybeSingle()
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
      .from('sim_tournament_players').select('*').eq('tournament_id', id).order('created_at')
    if (!playerRows?.length) { setPlayers([]); return }
    const userIds = playerRows.map(p => p.user_id)
    const { data: profileRows } = await supabase
      .from('profiles').select('id, username, avatar_url, location, bio').in('id', userIds)
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
    // Safety net: finalize matches where both players reported (see web notes).
    for (const m of result) {
      if (m.status === 'pending' && m.result !== 'bye' && m.player1_reported && m.player2_reported) {
        resolveIfReady(m.id)
      }
    }
  }

  async function loadMatchMessages(matchIds) {
    if (!matchIds?.length) return
    const { data } = await supabase
      .from('sim_match_messages').select('*').in('match_id', matchIds).order('created_at', { ascending: true })
    setMatchMessages(data ?? [])
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
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

  function confirmDrop(userId) {
    const isSelf = userId === session?.user?.id
    const name = players.find(p => p.user_id === userId)?.profiles?.username ?? 'Player'
    Alert.alert(
      isSelf ? 'Drop from tournament?' : `Drop ${name}?`,
      'Removed from future pairings; the current record stays in standings. Any pending match this round is forfeited. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isSelf ? 'Drop Me' : 'Drop Player', style: 'destructive', onPress: () => dropPlayer(userId) },
      ]
    )
  }

  async function dropPlayer(userId) {
    const { error } = await supabase
      .from('sim_tournament_players').update({ dropped: true })
      .eq('tournament_id', id).eq('user_id', userId)
    if (error) { Alert.alert('Drop failed', error.message); return }

    if (currentRound) {
      const openMatch = currentMatches.find(m =>
        (m.player1_id === userId || m.player2_id === userId) &&
        (m.status === 'pending' || m.status === 'disputed')
      )
      if (openMatch) {
        const result = openMatch.player1_id === userId ? 'player2_win' : 'player1_win'
        await supabase.from('sim_matches').update({ result, status: 'completed' }).eq('id', openMatch.id)
      }
    }
    await loadPlayers()
  }

  async function resolveIfReady(matchId) {
    const { data: fresh, error } = await supabase
      .from('sim_matches').select('player1_reported,player2_reported,status').eq('id', matchId).single()
    if (error || !fresh || fresh.status !== 'pending') return
    if (!fresh.player1_reported || !fresh.player2_reported) return
    const { player1_reported: p1r, player2_reported: p2r } = fresh
    let finalUpdate
    if (p1r === 'win' && p2r === 'loss') finalUpdate = { result: 'player1_win', status: 'completed' }
    else if (p1r === 'loss' && p2r === 'win') finalUpdate = { result: 'player2_win', status: 'completed' }
    else finalUpdate = { status: 'disputed' }
    await supabase.from('sim_matches').update(finalUpdate).eq('id', matchId).eq('status', 'pending')
  }

  async function submitResult(match, report) {
    if (submittingMatches.has(match.id)) return
    setSubmittingMatches(prev => new Set([...prev, match.id]))
    const isP1 = session.user.id === match.player1_id
    const field = isP1 ? 'player1_reported' : 'player2_reported'
    try {
      const { error } = await supabase.from('sim_matches').update({ [field]: report }).eq('id', match.id)
      if (error) throw error
      await resolveIfReady(match.id)
    } catch {
      Alert.alert('Could not submit', 'Check your connection and try again.')
    } finally {
      setSubmittingMatches(prev => { const n = new Set(prev); n.delete(match.id); return n })
    }
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

  function confirmDelete() {
    Alert.alert('Delete tournament', `Delete "${tournament.name}"? This removes all rounds, matches and registrations. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('sim_matches').delete().eq('tournament_id', id)
          await supabase.from('sim_rounds').delete().eq('tournament_id', id)
          await supabase.from('sim_tournament_players').delete().eq('tournament_id', id)
          await supabase.from('sim_tournament_admins').delete().eq('tournament_id', id)
          const { error } = await supabase.from('sim_tournaments').delete().eq('id', id)
          if (error) Alert.alert('Delete failed', error.message)
          else router.back()
        },
      },
    ])
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

  function playerProfile(userId) {
    return players.find(p => p.user_id === userId)?.profiles ?? null
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const screenOpts = {
    headerShown: true,
    title: tournament?.name ?? 'Tournament',
    headerStyle: { backgroundColor: '#08101b' },
    headerTitleStyle: { fontFamily: font.display, fontSize: 16, color: colors.parchment },
    headerTintColor: colors.parchment,
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (!tournament) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.muted, fontFamily: font.body }}>Tournament not found</Text>
        </View>
      </>
    )
  }

  const statusColors = { registration: colors.ocean, active: colors.emerald, completed: '#94a3b8' }
  const statusLabels = { registration: 'Registration Open', active: 'In Progress', completed: 'Completed' }
  const tabs = ['pairings', 'standings', 'history']
  if (tournament.status === 'completed') tabs.push('decklists')
  const pendingCount = currentMatches.filter(m => m.status === 'pending').length

  return (
    <>
      <Stack.Screen options={screenOpts} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

        {/* Header */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: statusColors[tournament.status] + '22', borderWidth: 1, borderColor: statusColors[tournament.status] + '44' }}>
              <Text style={{ fontSize: 10, fontFamily: font.bold, color: statusColors[tournament.status] }}>
                {statusLabels[tournament.status]}{tournament.status === 'active' ? ` · Round ${tournament.current_round}` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>👥 {players.length} players</Text>
          </View>
          {tournament.description ? <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, lineHeight: 19, fontFamily: font.body }}>{tournament.description}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
            {tournament.registration_deadline ? (
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>
                ⏰ {new Date() < new Date(tournament.registration_deadline) ? 'Deadline:' : 'Closed:'} {new Date(tournament.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : null}
            {tournament.discord_link ? (
              <TouchableOpacity onPress={() => Linking.openURL(tournament.discord_link).catch(() => {})}>
                <Text style={{ fontSize: 12, color: colors.oceanBright, fontFamily: font.semi }}>💬 Join Discord</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {isParticipant && tournament.status !== 'completed' && (
              <GlassButton
                onPress={() => { setDecklistModal(true); if (myEntry?.decklist?.raw) setDecklistText(myEntry.decklist.raw) }}
                pad={{ paddingVertical: 7, paddingHorizontal: 14 }}
              >
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: myEntry?.decklist_submitted ? colors.emerald : colors.oceanBright }}>
                  {myEntry?.decklist_submitted ? 'Decklist ✓' : 'Submit Decklist'}
                </Text>
              </GlassButton>
            )}
            {session && regOpen && !isParticipant && (
              <GlassButton onPress={join} disabled={joining} tint={colors.ocean} pad={{ paddingVertical: 7, paddingHorizontal: 18 }}>
                <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#fff' }}>{joining ? 'Joining...' : 'Join Tournament'}</Text>
              </GlassButton>
            )}
            {session && isParticipant && !hasDropped && tournament.status !== 'completed' && (
              <View style={{ ...ghostBtn, borderColor: 'rgba(59,178,126,0.25)', backgroundColor: 'rgba(59,178,126,0.08)' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.emerald }}>Registered ✓</Text>
              </View>
            )}
            {session && isParticipant && !hasDropped && tournament.status === 'active' && (
              <GlassButton onPress={() => confirmDrop(session.user.id)} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Drop</Text>
              </GlassButton>
            )}
            {session && isParticipant && hasDropped && (
              <View style={{ ...ghostBtn, borderColor: 'rgba(148,163,184,0.2)' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#94a3b8' }}>Dropped</Text>
              </View>
            )}
          </View>
        </View>

        {/* Admin panel */}
        {isAdmin && (
          <View style={{ backgroundColor: 'rgba(200,162,74,0.05)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.15)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold, marginBottom: 10 }}>Admin Controls</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(tournament.status === 'registration' || (tournament.status === 'active' && allMatchesDone && disputedMatches.length === 0)) && (() => {
                const activePlayers = players.filter(p => !p.dropped)
                const notEnough = activePlayers.length < 2
                return (
                  <GlassButton onPress={startRound} disabled={startingRound || notEnough} tint={notEnough ? undefined : colors.ocean} pad={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: notEnough ? colors.faint : '#fff' }}>
                      {startingRound ? 'Starting...' : tournament.status === 'registration' ? `Start Round 1 (${activePlayers.length} players)` : `Start Round ${(currentRound?.round_number ?? 0) + 1}`}
                    </Text>
                  </GlassButton>
                )
              })()}
              {tournament.status === 'active' && allMatchesDone && undefeated.length === 1 && (
                <GlassButton onPress={() => declareWinner(undefeated[0].user_id)} tint={colors.gold} pad={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.onAccent }}>🏆 Declare Winner: {undefeated[0].profiles?.username}</Text>
                </GlassButton>
              )}
              {tournament.status === 'active' && allMatchesDone && undefeated.length !== 1 && (
                <GlassButton onPress={() => setShowForceEndModal(true)} pad={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.gold }}>🏆 End Tournament</Text>
                </GlassButton>
              )}
              {tournament.status === 'active' && !allMatchesDone && (
                <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>
                  {pendingCount} match{pendingCount !== 1 ? 'es' : ''} pending{disputedMatches.length > 0 ? ` · ${disputedMatches.length} disputed` : ''}
                </Text>
              )}
              <GlassButton onPress={confirmDelete} pad={{ paddingVertical: 7, paddingHorizontal: 14 }} style={{ marginLeft: 'auto' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Delete</Text>
              </GlassButton>
            </View>
            {roundError ? <Text style={{ fontSize: 12, color: colors.crimson, marginTop: 8, fontFamily: font.body }}>{roundError}</Text> : null}
            {disputedMatches.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(200,162,74,0.1)', gap: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.orange, marginBottom: 4 }}>⚠️ Disputes to resolve</Text>
                {disputedMatches.map(m => {
                  const p1 = playerProfile(m.player1_id)
                  const p2 = playerProfile(m.player2_id)
                  return (
                    <View key={m.id} style={{ backgroundColor: 'rgba(224,138,60,0.06)', borderRadius: radius.sm, padding: 10, gap: 8 }}>
                      <Text style={{ fontSize: 13, color: colors.text, fontFamily: font.body }}>{p1?.username} vs {p2?.username}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>
                        {p1?.username}: {m.player1_reported ?? '—'} · {p2?.username}: {m.player2_reported ?? '—'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <GlassButton onPress={() => resolveDispute(m.id, 'player1_win')} pad={{ paddingVertical: 6, paddingHorizontal: 10 }} style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.emerald }}>{p1?.username} wins</Text>
                        </GlassButton>
                        <GlassButton onPress={() => resolveDispute(m.id, 'player2_win')} pad={{ paddingVertical: 6, paddingHorizontal: 10 }} style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.emerald }}>{p2?.username} wins</Text>
                        </GlassButton>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* Tabs */}
        <GlassPills
          style={{ marginBottom: 16 }}
          items={tabs.map(tb => ({
            key: tb,
            label: tb === 'pairings'
              ? `Round ${currentRound?.round_number ?? tournament.current_round ?? '—'}`
              : tb.charAt(0).toUpperCase() + tb.slice(1),
          }))}
          activeKey={activeTab}
          onSelect={setActiveTab}
        />

        {/* ── Pairings ── */}
        {activeTab === 'pairings' && (
          rounds.length === 0 ? (
            <View>
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>⚔️</Text>
                <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted, marginBottom: 6 }}>
                  {tournament.status === 'registration' ? 'Waiting for tournament to start' : 'No pairings yet'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>{players.length} player{players.length !== 1 ? 's' : ''} registered</Text>
              </View>
              {players.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.faint, marginBottom: 4 }}>Registered Players</Text>
                  {players.map((p, i) => (
                    <TouchableOpacity key={p.user_id} onPress={() => p.profiles && setSelectedProfile(p.profiles)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: p.user_id === session?.user?.id ? 'rgba(47,125,163,0.12)' : 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: p.user_id === session?.user?.id ? colors.goldLine : colors.lineStrong, borderRadius: 10 }}>
                      <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.faint, width: 20, textAlign: 'right' }}>{i + 1}</Text>
                      <Avatar profile={p.profiles} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>
                          {p.profiles?.username ?? 'Unknown'}{p.user_id === session?.user?.id ? '  (you)' : ''}
                        </Text>
                        {p.profiles?.location ? <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{p.profiles.location}</Text> : null}
                      </View>
                      {p.decklist_submitted ? <Text style={{ fontSize: 10, fontFamily: font.semi, color: colors.emerald }}>Decklist ✓</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {currentMatches.map(m => {
                const p1 = playerProfile(m.player1_id)
                const p2 = m.player2_id ? playerProfile(m.player2_id) : null
                const isP1 = session?.user?.id === m.player1_id
                const isP2 = session?.user?.id === m.player2_id
                const inMatch = isP1 || isP2
                const myReport = isP1 ? m.player1_reported : isP2 ? m.player2_reported : null
                const winner = m.result === 'player1_win' ? p1 : m.result === 'player2_win' ? p2 : null

                return (
                  <View key={m.id} style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: m.status === 'disputed' ? 'rgba(224,138,60,0.3)' : inMatch && m.status === 'pending' ? colors.goldLine : colors.lineStrong, borderRadius: 12, padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => p1 && setSelectedProfile(p1)}>
                        <Avatar profile={p1} size={32} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: m.result === 'player1_win' ? colors.emerald : m.result === 'player2_win' ? colors.faint : colors.text }}>{p1?.username ?? 'Unknown'}</Text>
                          {m.player1_reported && m.status !== 'completed' ? <Text style={{ fontSize: 10, color: colors.muted, fontFamily: font.body }}>Reported {m.player1_reported}</Text> : null}
                        </View>
                      </TouchableOpacity>
                      <View>
                        {m.result === 'bye' ? (
                          <Text style={{ fontSize: 11, fontFamily: font.bold, color: colors.oceanBright }}>BYE</Text>
                        ) : m.status === 'completed' ? (
                          <Text style={{ fontSize: 12, color: colors.emerald }}>✓</Text>
                        ) : m.status === 'disputed' ? (
                          <Text style={{ fontSize: 14 }}>⚠️</Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.bold }}>vs</Text>
                        )}
                      </View>
                      {p2 ? (
                        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }} onPress={() => setSelectedProfile(p2)}>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: m.result === 'player2_win' ? colors.emerald : m.result === 'player1_win' ? colors.faint : colors.text }}>{p2?.username ?? 'Unknown'}</Text>
                            {m.player2_reported && m.status !== 'completed' ? <Text style={{ fontSize: 10, color: colors.muted, fontFamily: font.body }}>Reported {m.player2_reported}</Text> : null}
                          </View>
                          <Avatar profile={p2} size={32} />
                        </TouchableOpacity>
                      ) : <View style={{ flex: 1 }} />}
                    </View>

                    {/* Result row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {inMatch && m.status === 'pending' && !myReport && (
                        <>
                          <GlassButton onPress={() => submitResult(m, 'win')} disabled={submittingMatches.has(m.id)} tint={colors.emerald} pad={{ paddingVertical: 8, paddingHorizontal: 12 }} style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>I Won</Text>
                          </GlassButton>
                          <GlassButton onPress={() => submitResult(m, 'loss')} disabled={submittingMatches.has(m.id)} pad={{ paddingVertical: 8, paddingHorizontal: 12 }} style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.crimson }}>I Lost</Text>
                          </GlassButton>
                        </>
                      )}
                      {inMatch && m.status === 'pending' && myReport ? (
                        <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>Waiting for opponent...</Text>
                      ) : null}
                      {m.status === 'completed' && winner ? (
                        <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.emerald }}>🏆 {winner.username}</Text>
                      ) : null}
                      {m.status === 'disputed' && !isAdmin ? (
                        <Text style={{ fontSize: 11, color: colors.orange, fontFamily: font.body }}>Awaiting admin</Text>
                      ) : null}
                      {isAdmin && m.status !== 'completed' && m.result !== 'bye' && (
                        <View style={{ flexDirection: 'row', gap: 5, marginLeft: 'auto' }}>
                          <GlassButton onPress={() => resolveDispute(m.id, 'player1_win')} pad={{ paddingVertical: 4, paddingHorizontal: 9 }}>
                            <Text style={{ fontSize: 11, fontFamily: font.bold, color: colors.oceanBright }}>▲ {p1?.username ?? 'P1'}</Text>
                          </GlassButton>
                          <GlassButton onPress={() => resolveDispute(m.id, 'player2_win')} pad={{ paddingVertical: 4, paddingHorizontal: 9 }}>
                            <Text style={{ fontSize: 11, fontFamily: font.bold, color: colors.oceanBright }}>▲ {p2?.username ?? 'P2'}</Text>
                          </GlassButton>
                        </View>
                      )}
                    </View>

                    <MatchChat
                      matchId={m.id}
                      currentUserId={session?.user?.id}
                      player1Id={m.player1_id}
                      player2Id={m.player2_id}
                      isAdmin={isAdmin}
                      messages={matchMessages.filter(msg => msg.match_id === m.id)}
                      getProfile={uid => players.find(p => p.user_id === uid)?.profiles}
                      onMessageSent={msg => setMatchMessages(prev => prev.some(x => x.id === msg.id) ? prev : [...prev, msg])}
                    />
                  </View>
                )
              })}
            </View>
          )
        )}

        {/* ── Standings ── */}
        {activeTab === 'standings' && (
          standings.length === 0 ? (
            <Text style={{ textAlign: 'center', padding: 50, fontSize: 13, color: colors.faint, fontFamily: font.body }}>No players yet</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {standings.map((s, i) => {
                const isWinner = tournament.winner_id === s.user_id
                const playerEntry = players.find(p => p.user_id === s.user_id)
                const isDropped = !!playerEntry?.dropped
                return (
                  <TouchableOpacity
                    key={s.user_id}
                    onPress={() => s.profiles && setSelectedProfile(s.profiles)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: isWinner ? 'rgba(200,162,74,0.08)' : 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: isWinner ? 'rgba(200,162,74,0.2)' : colors.lineStrong, borderRadius: 10, opacity: isDropped ? 0.5 : 1 }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: font.bold, color: i === 0 && !isDropped ? colors.gold : colors.faint, width: 24, textAlign: 'right' }}>{i + 1}</Text>
                    <Avatar profile={s.profiles} size={28} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>
                        {s.profiles?.username ?? 'Unknown'}{isWinner ? ' 🏆' : ''}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.faint, fontFamily: font.body }}>
                        {isDropped ? 'dropped' : s.losses === 0 && !isWinner && tournament.status === 'active' ? 'undefeated' : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: font.mono }}>
                      <Text style={{ color: colors.emerald }}>{s.wins}W</Text>
                      <Text style={{ color: colors.faint }}> · </Text>
                      <Text style={{ color: s.losses > 0 ? colors.crimson : colors.faint }}>{s.losses}L</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.mono, width: 44, textAlign: 'right' }}>
                      {s.wins + s.losses > 0 ? `${Math.round(s.owr * 100)}%` : '—'}
                    </Text>
                    {isAdmin && tournament.status === 'active' && !isDropped && (
                      <TouchableOpacity onPress={() => confirmDrop(s.user_id)} hitSlop={4} style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(210,74,58,0.3)' }}>
                        <Text style={{ fontSize: 10, fontFamily: font.semi, color: colors.crimson }}>Drop</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                )
              })}
              <Text style={{ fontSize: 10, color: colors.faint, marginTop: 4, fontFamily: font.body }}>Right column = opponent win rate (tiebreaker)</Text>
            </View>
          )
        )}

        {/* ── History ── */}
        {activeTab === 'history' && (
          rounds.length === 0 ? (
            <Text style={{ textAlign: 'center', padding: 50, fontSize: 13, color: colors.faint, fontFamily: font.body }}>No rounds played yet</Text>
          ) : (
            <View style={{ gap: 16 }}>
              {rounds.map(round => {
                const rMatches = matches.filter(m => m.round_id === round.id)
                return (
                  <View key={round.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>Round {round.round_number}</Text>
                      <Text style={{ fontSize: 10, fontFamily: font.semi, color: round.status === 'completed' ? colors.emerald : colors.ocean }}>
                        {round.status === 'completed' ? 'Complete' : 'In Progress'}
                      </Text>
                    </View>
                    <View style={{ gap: 5 }}>
                      {rMatches.map(m => {
                        const p1 = playerProfile(m.player1_id)
                        const p2 = m.player2_id ? playerProfile(m.player2_id) : null
                        const winner = m.result === 'player1_win' ? p1 : m.result === 'player2_win' ? p2 : null
                        return (
                          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(140,176,208,0.04)', borderRadius: radius.sm }}>
                            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: m.result === 'player1_win' ? font.bold : font.body, color: m.result === 'player1_win' ? colors.emerald : colors.muted }}>{p1?.username ?? '?'}</Text>
                            <Text style={{ fontSize: 11, color: m.result === 'bye' ? colors.oceanBright : colors.faint, fontFamily: font.body }}>{m.result === 'bye' ? 'BYE' : 'vs'}</Text>
                            {p2 ? <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', fontSize: 13, fontFamily: m.result === 'player2_win' ? font.bold : font.body, color: m.result === 'player2_win' ? colors.emerald : colors.muted }}>{p2.username}</Text> : <View style={{ flex: 1 }} />}
                            {m.status === 'pending' ? <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>Pending</Text> : null}
                            {m.status === 'disputed' ? <Text style={{ fontSize: 11, color: colors.orange, fontFamily: font.body }}>Disputed</Text> : null}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )
              })}
            </View>
          )
        )}

        {/* ── Decklists (completed only) ── */}
        {activeTab === 'decklists' && tournament.status === 'completed' && (
          <View style={{ gap: 14 }}>
            {players.filter(p => p.decklist_submitted).map(p => {
              const dl = p.decklist
              const leaderImg = dl?.card_image ?? (dl?.leader_id ? getCardImageUrl(dl.leader_id) : null)
              return (
                <View key={p.id} style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.lineStrong }}>
                    <Avatar profile={p.profiles} size={36} />
                    <View style={{ flex: 1 }}>
                      <TouchableOpacity onPress={() => setSelectedProfile(p.profiles)}>
                        <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{p.profiles?.username}</Text>
                      </TouchableOpacity>
                      {dl?.leader_name ? <Text style={{ fontSize: 11, color: LEADER_COLORS[dl.leader_color] ?? colors.muted, fontFamily: font.body }}>{dl.leader_name}</Text> : null}
                    </View>
                    {leaderImg ? <Image source={{ uri: leaderImg }} style={{ width: 38, height: 52, borderRadius: 5 }} resizeMode="cover" /> : null}
                  </View>
                  {dl?.raw ? (
                    <Text style={{ padding: 14, fontSize: 12, color: colors.muted, fontFamily: font.mono, lineHeight: 20 }}>{dl.raw}</Text>
                  ) : null}
                </View>
              )
            })}
            {players.filter(p => !p.decklist_submitted).length > 0 && (
              <Text style={{ fontSize: 12, color: colors.faint, padding: 10, fontFamily: font.body }}>
                {players.filter(p => !p.decklist_submitted).length} player(s) did not submit a decklist.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Winner overlay */}
      <Modal visible={showWinner && !!winnerEntry} transparent animationType="fade" onRequestClose={() => setShowWinner(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🏆</Text>
          <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 3, color: colors.gold, marginBottom: 12 }}>Tournament Champion</Text>
          <Text style={{ fontSize: 24, fontFamily: font.display, color: colors.text, marginBottom: 24, textAlign: 'center' }}>{tournament?.name}</Text>
          <View style={{ alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <View style={{ borderWidth: 3, borderColor: colors.gold, borderRadius: 23, padding: 0, overflow: 'hidden' }}>
              <Avatar profile={winnerEntry?.profiles} size={80} />
            </View>
            <Text style={{ fontSize: 24, fontFamily: font.bold, color: colors.gold }}>{winnerEntry?.profiles?.username ?? 'Champion'}</Text>
            {winnerEntry?.profiles?.location ? <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>{winnerEntry.profiles.location}</Text> : null}
          </View>
          <GlassButton onPress={() => { setShowWinner(false); setActiveTab('standings') }} pad={{ paddingVertical: 10, paddingHorizontal: 28 }}>
            <Text style={{ color: colors.gold, fontSize: 13, fontFamily: font.semi }}>View Standings</Text>
          </GlassButton>
        </View>
      </Modal>

      {/* Force end modal */}
      <Modal visible={showForceEndModal} transparent animationType="fade" onRequestClose={() => setShowForceEndModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldLine, borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%', padding: 20 }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text, marginBottom: 4 }}>End Tournament</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 14, fontFamily: font.body }}>Select the winner from the current standings.</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 6 }}>
              {standings.map((s, i) => (
                <TouchableOpacity key={s.user_id} onPress={() => { declareWinner(s.user_id); setShowForceEndModal(false) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.faint, width: 20, textAlign: 'right' }}>{i + 1}</Text>
                  <Avatar profile={s.profiles} size={28} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>{s.profiles?.username ?? 'Unknown'}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.mono }}>{s.wins}W · {s.losses}L</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.gold, fontFamily: font.body }}>Declare 🏆</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <GlassButton onPress={() => setShowForceEndModal(false)} pad={{ paddingVertical: 10, paddingHorizontal: 16 }} style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>Cancel</Text>
            </GlassButton>
          </View>
        </View>
      </Modal>

      {/* Decklist submission modal */}
      <Modal visible={decklistModal} transparent animationType="slide" onRequestClose={() => setDecklistModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.goldLine, maxHeight: '88%' }}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>Submit Decklist</Text>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>Your decklist is hidden from other players until the tournament ends.</Text>
              <LeaderSearchInput label="Leader Card" placeholder="Search leader..." onSelect={setDecklistLeader} selected={decklistLeader} onClear={() => setDecklistLeader(null)} />
              <View>
                <FieldLabel>Decklist (paste your deck)</FieldLabel>
                <TextInput
                  value={decklistText}
                  onChangeText={setDecklistText}
                  placeholder={'4x OP01-005 Monkey D. Luffy\n4x OP01-006 ...\n...'}
                  placeholderTextColor={colors.faint}
                  multiline
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{ ...fieldInput, height: 180, textAlignVertical: 'top', fontFamily: font.mono, fontSize: 12 }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <GlassButton onPress={() => setDecklistModal(false)} pad={{ paddingVertical: 11, paddingHorizontal: 16 }} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>Cancel</Text>
                </GlassButton>
                <GlassButton onPress={saveDecklist} disabled={savingDecklist || !decklistLeader} tint={colors.ocean} pad={{ paddingVertical: 11, paddingHorizontal: 16 }} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{savingDecklist ? 'Saving...' : 'Submit Decklist'}</Text>
                </GlassButton>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {selectedProfile && <ProfileCard profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} />}
    </>
  )
}
