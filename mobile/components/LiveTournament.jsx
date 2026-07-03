// RN port of src/pages/LiveTournament.jsx (web). Guest mode is omitted —
// the mobile app requires login. Round drafts autosave to AsyncStorage.
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, Modal, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { colors, font, radius } from '../theme'
import { LeaderSearchInput, ToggleGroup, SearchableSelect, FieldLabel, fieldInput, LEADER_COLORS } from './forms'

const panel = {
  backgroundColor: 'rgba(140,176,208,0.05)',
  borderWidth: 1,
  borderColor: 'rgba(140,176,208,0.07)',
  borderRadius: 14,
  padding: 16,
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function SetupScreen({ session, onStart }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayStr())
  const [playerCount, setPlayerCount] = useState('')
  const [deckName, setDeckName] = useState('')
  const [leader, setLeader] = useState(null)
  const [stores, setStores] = useState([])
  const [series, setSeries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
  }, [])

  async function handleStart() {
    setError('')
    if (!leader) return setError('Please select your leader')
    if (!name.trim() && !selectedSeries) return setError('Please enter a tournament name or select a series')

    const finalName = selectedSeries?.name ?? name.trim()
    const storeLocation = selectedStore ? [selectedStore.name, selectedStore.city, selectedStore.state].filter(Boolean).join(', ') : ''

    setSaving(true)
    const { data, error: err } = await supabase.from('live_tournaments').insert({
      user_id: session.user.id,
      name: finalName,
      date,
      location: storeLocation,
      player_count: playerCount ? parseInt(playerCount) : null,
      leader_id: leader.card_image_id ?? leader.card_set_id,
      leader_name: leader.card_name,
      leader_color: leader.card_color,
      deck_name: deckName || `${leader.card_name} Deck`,
      status: 'active',
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    onStart(data)
    setSaving(false)
  }

  const storesForDisplay = stores.map(s => ({ ...s, sublabel: [s.city, s.state].filter(Boolean).join(', ') }))

  return (
    <View style={{ gap: 12 }}>
      <View style={panel}>
        <View style={{ gap: 14 }}>
          <SearchableSelect label="Store / Venue" placeholder="Search store..." items={storesForDisplay} selected={selectedStore} onSelect={setSelectedStore} sublabel="sublabel" />
          <SearchableSelect label="Tournament Series" placeholder="Search series..." items={series} selected={selectedSeries} onSelect={setSelectedSeries} />
          <View>
            <FieldLabel>Tournament Name {selectedSeries ? '(auto)' : ''}</FieldLabel>
            <TextInput
              placeholder="e.g. Weekly Locals"
              placeholderTextColor={colors.faint}
              value={selectedSeries ? selectedSeries.name : name}
              onChangeText={setName}
              editable={!selectedSeries}
              style={{ ...fieldInput, opacity: selectedSeries ? 0.5 : 1 }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Date</FieldLabel>
              <TextInput placeholder="YYYY-MM-DD" placeholderTextColor={colors.faint} value={date} onChangeText={setDate} style={fieldInput} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>Player Count</FieldLabel>
              <TextInput placeholder="e.g. 32" placeholderTextColor={colors.faint} value={playerCount} onChangeText={setPlayerCount} keyboardType="number-pad" style={fieldInput} />
            </View>
          </View>
          <View>
            <FieldLabel>Deck Name</FieldLabel>
            <TextInput placeholder="e.g. Red Luffy Aggro" placeholderTextColor={colors.faint} value={deckName} onChangeText={setDeckName} style={fieldInput} />
          </View>
          <LeaderSearchInput label="Your Leader" placeholder="Search your leader..." onSelect={setLeader} selected={leader} onClear={() => setLeader(null)} />

          {error ? (
            <View style={{ backgroundColor: 'rgba(210,74,58,0.08)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.2)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 13, color: colors.crimson, fontFamily: font.body }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={handleStart} disabled={saving} style={{ paddingVertical: 12, borderRadius: radius.sm, backgroundColor: saving ? '#3a526a' : colors.emerald, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontFamily: font.bold, color: '#0f1117' }}>{saving ? 'Starting...' : '🏆 Start Tournament'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

function RoundLogger({ tournament, rounds, onRoundLogged }) {
  const DRAFT_KEY = `live_round_draft_${tournament.id}`
  const [oppLeader, setOppLeader] = useState(null)
  const [wonDice, setWonDice] = useState(null)
  const [wentFirst, setWentFirst] = useState(null)
  const [result, setResult] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const roundNumber = rounds.length + 1

  // Restore an in-progress draft once per tournament.
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then(raw => {
      try {
        const d = JSON.parse(raw ?? 'null')
        if (d) {
          setOppLeader(d.oppLeader ?? null)
          setWonDice(d.wonDice ?? null)
          setWentFirst(d.wentFirst ?? null)
          setResult(d.result ?? null)
          setNotes(d.notes ?? '')
        }
      } catch {}
      setHydrated(true)
    })
  }, [DRAFT_KEY])

  // Autosave the in-progress round so closing the app mid-entry doesn't lose it.
  useEffect(() => {
    if (!hydrated) return
    const empty = !oppLeader && wonDice === null && wentFirst === null && !result && !notes.trim()
    if (empty) AsyncStorage.removeItem(DRAFT_KEY).catch(() => {})
    else AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ oppLeader, wonDice, wentFirst, result, notes })).catch(() => {})
  }, [DRAFT_KEY, hydrated, oppLeader, wonDice, wentFirst, result, notes])

  async function logRound() {
    setError('')
    if (!result) return setError('Please select a result')
    setSaving(true)

    const { data, error: err } = await supabase.from('live_rounds').insert({
      tournament_id: tournament.id,
      round_number: roundNumber,
      opponent_leader_id: oppLeader?.card_image_id ?? oppLeader?.card_set_id ?? null,
      opponent_leader_name: oppLeader?.card_name ?? null,
      opponent_leader_color: oppLeader?.card_color ?? null,
      won_dice_roll: wonDice,
      went_first: wentFirst,
      result,
      notes: notes.trim(),
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    onRoundLogged(data)
    setOppLeader(null); setWonDice(null); setWentFirst(null); setResult(null); setNotes('')
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {})
    setSaving(false)
  }

  return (
    <View style={panel}>
      <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text, marginBottom: 16 }}>Round {roundNumber}</Text>
      <View style={{ gap: 14 }}>
        <LeaderSearchInput
          label="Opponent's Leader"
          placeholder="Search opponent's leader..."
          onSelect={setOppLeader}
          selected={oppLeader}
          onClear={() => setOppLeader(null)}
        />
        <ToggleGroup label="Dice Roll" value={wonDice} onChange={setWonDice} options={[
          { value: true, label: '🎲 Won', color: colors.emerald },
          { value: false, label: '🎲 Lost', color: colors.crimson },
        ]} />
        <ToggleGroup label="Going" value={wentFirst} onChange={setWentFirst} options={[
          { value: true, label: '1st', color: colors.gold },
          { value: false, label: '2nd', color: colors.oceanBright },
        ]} />
        <ToggleGroup label="Result" value={result} onChange={setResult} options={[
          { value: 'win', label: '✓ Win', color: colors.emerald },
          { value: 'loss', label: '✗ Loss', color: colors.crimson },
        ]} />
        <View>
          <FieldLabel>Notes (optional)</FieldLabel>
          <TextInput
            placeholder="Round notes..."
            placeholderTextColor={colors.faint}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ ...fieldInput, minHeight: 60, textAlignVertical: 'top' }}
          />
        </View>
        {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
        <TouchableOpacity onPress={logRound} disabled={saving} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: saving ? '#3a526a' : colors.ocean, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : `Log Round ${roundNumber}`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function RoundHistory({ rounds }) {
  if (rounds.length === 0) return null
  return (
    <View style={panel}>
      <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Round History</Text>
      <View style={{ gap: 8 }}>
        {rounds.map(r => (
          <View key={r.id} style={{ backgroundColor: 'rgba(140,176,208,0.03)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.muted, minWidth: 28 }}>R{r.round_number}</Text>
              {r.opponent_leader_id ? (
                <Image source={{ uri: getCardImageUrl(r.opponent_leader_id) }} style={{ width: 24, height: 33, borderRadius: 3 }} resizeMode="cover" />
              ) : null}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: LEADER_COLORS[r.opponent_leader_color] ?? colors.muted, fontFamily: font.body }}>
                {r.opponent_leader_name ?? 'Unknown leader'}
              </Text>
              {r.won_dice_roll !== null ? (
                <Text style={{ fontSize: 11, color: r.won_dice_roll ? colors.emerald : colors.crimson, fontFamily: font.body }}>
                  {r.won_dice_roll ? '🎲W' : '🎲L'}
                </Text>
              ) : null}
              {r.went_first !== null ? (
                <Text style={{ fontSize: 11, color: r.went_first ? colors.gold : colors.oceanBright, fontFamily: font.body }}>
                  {r.went_first ? '1st' : '2nd'}
                </Text>
              ) : null}
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: r.result === 'win' ? colors.emerald : colors.crimson, minWidth: 18, textAlign: 'right' }}>
                {r.result === 'win' ? 'W' : 'L'}
              </Text>
            </View>
            {r.notes ? <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6, fontStyle: 'italic', fontFamily: font.body }}>{r.notes}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

function ActiveTournament({ tournament, session, onFinish }) {
  const [rounds, setRounds] = useState([])
  const [finishing, setFinishing] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [placementInput, setPlacementInput] = useState('')
  const [overallNotes, setOverallNotes] = useState('')
  const NOTES_KEY = `live_overall_notes_${tournament.id}`

  useEffect(() => {
    AsyncStorage.getItem(NOTES_KEY).then(v => { if (v) setOverallNotes(v) })
  }, [NOTES_KEY])

  useEffect(() => {
    AsyncStorage.setItem(NOTES_KEY, overallNotes).catch(() => {})
  }, [NOTES_KEY, overallNotes])

  function clearDrafts() {
    AsyncStorage.multiRemove([NOTES_KEY, `live_round_draft_${tournament.id}`]).catch(() => {})
  }

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

  function handleCancel() {
    Alert.alert('Cancel tournament', 'Cancel this tournament? All round data will be lost.', [
      { text: 'Keep Playing', style: 'cancel' },
      {
        text: 'Cancel Tournament', style: 'destructive',
        onPress: async () => {
          await supabase.from('live_rounds').delete().eq('tournament_id', tournament.id)
          await supabase.from('live_tournaments').delete().eq('id', tournament.id)
          clearDrafts()
          onFinish()
        },
      },
    ])
  }

  async function handleFinishConfirm() {
    const val = parseInt(placementInput)
    if (!val || isNaN(val)) return
    setShowFinishConfirm(false)
    setFinishing(true)
    const { data: savedTournament } = await supabase.from('tournaments').insert({
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
      notes: overallNotes.trim(),
    }).select().single()
    if (savedTournament && rounds.length > 0) {
      await supabase.from('tournament_rounds').insert(
        rounds.map(r => ({
          tournament_id: savedTournament.id,
          round_number: r.round_number,
          opponent_leader_id: r.opponent_leader_id ?? null,
          opponent_leader_name: r.opponent_leader_name ?? null,
          opponent_leader_color: r.opponent_leader_color ?? null,
          won_dice_roll: r.won_dice_roll,
          went_first: r.went_first,
          result: r.result,
          notes: r.notes || null,
        }))
      )
    }
    await supabase.from('live_tournaments').update({ status: 'finished' }).eq('id', tournament.id)
    clearDrafts()
    setFinishing(false)
    onFinish()
  }

  return (
    <View style={{ gap: 14 }}>
      {/* Header */}
      <View style={{ backgroundColor: 'rgba(47,125,163,0.1)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 14, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <Image
            source={{ uri: getCardImageUrl(tournament.leader_id) }}
            style={{ width: 48, height: 66, borderRadius: 6, borderWidth: 2, borderColor: LEADER_COLORS[tournament.leader_color] ?? colors.ocean }}
            resizeMode="cover"
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald }} />
              <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.emerald, textTransform: 'uppercase', letterSpacing: 0.8 }}>Live</Text>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{tournament.name}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
              {tournament.leader_name} · {tournament.deck_name}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Record', value: `${wins}W-${losses}L` },
            { label: 'Win Rate', value: rounds.length > 0 ? `${winRate}%` : '—' },
            { label: '1st WR', value: wentFirstTotal > 0 ? `${Math.round(wentFirstWins / wentFirstTotal * 100)}%` : '—' },
            { label: '2nd WR', value: wentSecondTotal > 0 ? `${Math.round(wentSecondWins / wentSecondTotal * 100)}%` : '—' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(140,176,208,0.03)', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, fontFamily: font.semi }}>{s.label}</Text>
              <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{s.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleCancel} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.muted }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFinishConfirm(true)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.emerald, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RoundLogger tournament={tournament} rounds={rounds} onRoundLogged={r => setRounds(prev => [...prev, r])} />
      <RoundHistory rounds={rounds} />

      <View style={panel}>
        <FieldLabel>Overall Tournament Notes (optional)</FieldLabel>
        <TextInput
          placeholder="Overall thoughts, meta reads, how the day went..."
          placeholderTextColor={colors.faint}
          value={overallNotes}
          onChangeText={setOverallNotes}
          multiline
          style={{ ...fieldInput, minHeight: 70, textAlignVertical: 'top' }}
        />
      </View>

      {/* Finish modal */}
      <Modal visible={showFinishConfirm} transparent animationType="fade" onRequestClose={() => setShowFinishConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 14, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text, marginBottom: 8 }}>Finish Tournament?</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 20, fontFamily: font.body }}>
              This will save your result ({wins}W - {losses}L) to your tournament history. Enter your final placement.
            </Text>
            <FieldLabel>Final Placement</FieldLabel>
            <TextInput
              placeholder="e.g. 1 for 1st place"
              placeholderTextColor={colors.faint}
              value={placementInput}
              onChangeText={setPlacementInput}
              keyboardType="number-pad"
              style={{ ...fieldInput, marginBottom: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowFinishConfirm(false)} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleFinishConfirm} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.emerald, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#0f1117' }}>{finishing ? 'Saving...' : 'Save & Finish'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default function LiveTournament({ session }) {
  const [activeTournament, setActiveTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    async function checkActive() {
      const { data } = await supabase
        .from('live_tournaments')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setActiveTournament(data)
      setLoading(false)
    }
    checkActive()
  }, [session])

  if (loading) {
    return (
      <View style={{ height: 300, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  if (activeTournament) {
    return (
      <ActiveTournament
        tournament={activeTournament}
        session={session}
        onFinish={() => { setActiveTournament(null); router.replace('/(tabs)/dashboard') }}
      />
    )
  }

  return <SetupScreen session={session} onStart={setActiveTournament} />
}
