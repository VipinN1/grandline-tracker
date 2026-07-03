import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl, enrichCards } from '../../lib/optcgapi'
import { colors, font, radius } from '../../theme'
import {
  LeaderSearchInput, ToggleGroup, SearchableSelect, SectionTitle, FieldLabel,
  fieldInput, LEADER_COLORS, baseCardId, getLeaderStorageId,
} from '../../components/forms'
import SelectDecklistModal from '../../components/SelectDecklistModal'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

const panel = {
  backgroundColor: 'rgba(140,176,208,0.05)',
  borderWidth: 1,
  borderColor: 'rgba(140,176,208,0.07)',
  borderRadius: 14,
  padding: 16,
}

function RoundRow({ round, index, onChange, onRemove }) {
  return (
    <View style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.oceanBright }}>Round {index + 1}</Text>
        <TouchableOpacity onPress={() => onRemove(index)} hitSlop={8}>
          <Text style={{ color: colors.faint, fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 12 }}>
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
            { value: true, label: '🎲 Won', color: colors.emerald },
            { value: false, label: '🎲 Lost', color: colors.crimson },
          ]}
        />

        <ToggleGroup
          label="Going"
          value={round.wentFirst}
          onChange={val => onChange(index, 'wentFirst', val)}
          options={[
            { value: true, label: '1st', color: colors.gold },
            { value: false, label: '2nd', color: colors.oceanBright },
          ]}
        />

        <ToggleGroup
          label="Result"
          value={round.result}
          onChange={val => onChange(index, 'result', val)}
          options={[
            { value: 'win', label: '✓ Win', color: colors.emerald },
            { value: 'loss', label: '✗ Loss', color: colors.crimson },
          ]}
        />

        <View>
          <FieldLabel>Notes (optional)</FieldLabel>
          <TextInput
            placeholder="Round notes..."
            placeholderTextColor={colors.faint}
            value={round.notes ?? ''}
            onChangeText={val => onChange(index, 'notes', val)}
            multiline
            style={{ ...fieldInput, minHeight: 56, textAlignVertical: 'top' }}
          />
        </View>
      </View>
    </View>
  )
}

export default function LogResult() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()

  const [tournamentName, setTournamentName] = useState('')
  const [date, setDate] = useState(todayStr())
  const [playerCount, setPlayerCount] = useState('')
  const [placement, setPlacement] = useState('')
  const [notes, setNotes] = useState('')
  const [deckName, setDeckName] = useState('')
  const [isPractice, setIsPractice] = useState(false)

  const [stores, setStores] = useState([])
  const [series, setSeries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)

  const [leaderResult, setLeaderResult] = useState(null)

  const [decklistRaw, setDecklistRaw] = useState('')
  const [parsedCards, setParsedCards] = useState([])
  const [deckParsed, setDeckParsed] = useState(false)
  const [enriching, setEnriching] = useState(false)

  const [rounds, setRounds] = useState([{ oppLeader: null, wonDice: null, wentFirst: null, result: null, notes: '' }])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [attachedDecklist, setAttachedDecklist] = useState(null)
  const [selectingDecklist, setSelectingDecklist] = useState(false)

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
    setRounds(prev => [...prev, { oppLeader: null, wonDice: null, wentFirst: null, result: null, notes: '' }])
  }

  function resetForm() {
    setTournamentName(''); setDate(todayStr()); setPlayerCount(''); setPlacement('')
    setNotes(''); setDeckName(''); setIsPractice(false)
    setSelectedStore(null); setSelectedSeries(null); setLeaderResult(null)
    setDecklistRaw(''); setParsedCards([]); setDeckParsed(false)
    setRounds([{ oppLeader: null, wonDice: null, wentFirst: null, result: null, notes: '' }])
    setAttachedDecklist(null)
  }

  const wins = rounds.filter(r => r.result === 'win').length
  const losses = rounds.filter(r => r.result === 'loss').length

  async function handleSubmit() {
    setError('')
    if (!tournamentName.trim() && !selectedSeries) return setError('Tournament name or series is required')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date must be YYYY-MM-DD')
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

    const { data: tournament, error: tError } = await supabase.from('tournaments').insert(payload).select().single()
    if (tError) { setError('Failed to save: ' + tError.message); setSaving(false); return }

    if (rounds.length > 0) {
      const { error: rError } = await supabase.from('tournament_rounds').insert(
        rounds.map((r, i) => ({
          tournament_id: tournament.id,
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
    resetForm()
    router.replace('/(tabs)/dashboard')
  }

  const storesForDisplay = stores.map(s => ({ ...s, sublabel: [s.city, s.state].filter(Boolean).join(', ') }))

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.abyss }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90, gap: 12 }} keyboardShouldPersistTaps="handled">

        <View>
          <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 }}>⚓ Logbook</Text>
          <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.text }}>Log Result</Text>
        </View>

        {/* Your Leader */}
        <View style={{ ...panel, backgroundColor: 'rgba(140,176,208,0.07)', borderColor: colors.lineStrong }}>
          <SectionTitle>Your Leader Card</SectionTitle>
          {leaderResult ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={{ uri: leaderResult.card_image ?? getCardImageUrl(leaderResult.card_set_id) }}
                style={{ width: 52, height: 72, borderRadius: 6, borderWidth: 1, borderColor: LEADER_COLORS[leaderResult.card_color] ?? colors.line }}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{leaderResult.card_name}</Text>
                <Text style={{ fontSize: 11, color: LEADER_COLORS[leaderResult.card_color] ?? colors.muted, marginTop: 2, fontFamily: font.body }}>
                  {leaderResult.card_color} · {baseCardId(leaderResult.card_set_id)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setLeaderResult(null)}
                style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 }}
              >
                <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <LeaderSearchInput placeholder="Search your leader..." onSelect={setLeaderResult} selected={null} onClear={() => setLeaderResult(null)} />
          )}
        </View>

        {/* Tournament Info */}
        <View style={panel}>
          <SectionTitle>Tournament Info</SectionTitle>
          <View style={{ gap: 12 }}>
            <SearchableSelect label="Store / Venue" placeholder="Search or create a store..." items={storesForDisplay} selected={selectedStore} onSelect={setSelectedStore} onCreateNew={createStore} createLabel="Create store" sublabel="sublabel" />
            <SearchableSelect label="Tournament Series" placeholder="Search or create a series..." items={series} selected={selectedSeries} onSelect={setSelectedSeries} onCreateNew={createSeries} createLabel="Create series" />
            <View>
              <FieldLabel>Tournament Name (if no series)</FieldLabel>
              <TextInput
                placeholder="e.g. One-off event"
                placeholderTextColor={colors.faint}
                value={selectedSeries ? selectedSeries.name : tournamentName}
                onChangeText={setTournamentName}
                editable={!selectedSeries}
                style={{ ...fieldInput, opacity: selectedSeries ? 0.5 : 1 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Date</FieldLabel>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.faint}
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numbers-and-punctuation"
                  style={fieldInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Players</FieldLabel>
                <TextInput placeholder="e.g. 32" placeholderTextColor={colors.faint} value={playerCount} onChangeText={setPlayerCount} keyboardType="number-pad" style={fieldInput} />
              </View>
            </View>
            <View>
              <FieldLabel>Final Placement</FieldLabel>
              <TextInput placeholder="e.g. 1" placeholderTextColor={colors.faint} value={placement} onChangeText={setPlacement} keyboardType="number-pad" style={fieldInput} />
            </View>
            <View>
              <FieldLabel>Match Type</FieldLabel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                <Switch
                  value={isPractice}
                  onValueChange={setIsPractice}
                  trackColor={{ false: 'rgba(140,176,208,0.2)', true: colors.oceanBright }}
                  thumbColor="#fff"
                />
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: isPractice ? colors.oceanBright : colors.muted }}>Mark as Practice</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>
                Practice games are saved to your history but excluded from win rate, bounty and all global stats.
              </Text>
            </View>
          </View>
        </View>

        {/* Rounds */}
        <View style={panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint }}>Rounds</Text>
            <Text style={{ fontSize: 13, fontFamily: font.mono }}>
              <Text style={{ color: colors.emerald }}>{wins}W</Text>
              <Text style={{ color: colors.muted }}> · </Text>
              <Text style={{ color: colors.crimson }}>{losses}L</Text>
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {rounds.map((round, i) => (
              <RoundRow key={i} round={round} index={i} onChange={updateRound} onRemove={removeRound} />
            ))}
          </View>

          <TouchableOpacity
            onPress={addRound}
            style={{ marginTop: 10, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>+ Add Round</Text>
          </TouchableOpacity>
        </View>

        {/* Decklist */}
        <View style={panel}>
          <SectionTitle>Decklist</SectionTitle>

          {attachedDecklist ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.08)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.25)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Image source={{ uri: getCardImageUrl(attachedDecklist.leader_id) }} style={{ width: 36, height: 50, borderRadius: 5 }} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{attachedDecklist.name}</Text>
                <Text style={{ fontSize: 11, color: LEADER_COLORS[attachedDecklist.leader_color] ?? colors.muted, marginTop: 2, fontFamily: font.body }}>
                  {attachedDecklist.leader_name} · {attachedDecklist.leader_id}
                </Text>
                <Text style={{ fontSize: 11, color: colors.faint, marginTop: 2, fontFamily: font.body }}>
                  {attachedDecklist.cards?.reduce((s, c) => s + c.count, 0) ?? 0} cards
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAttachedDecklist(null)} hitSlop={8}>
                <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                onPress={() => setSelectingDecklist(true)}
                style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(200,162,74,0.3)', backgroundColor: 'rgba(140,176,208,0.08)', alignItems: 'center', marginBottom: 14 }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.oceanBright }}>Attach Decklist From Account</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(140,176,208,0.05)' }} />
                <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.faint }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(140,176,208,0.05)' }} />
              </View>

              <View style={{ marginBottom: 12 }}>
                <FieldLabel>Deck Name</FieldLabel>
                <TextInput placeholder="e.g. Red Luffy Aggro v3" placeholderTextColor={colors.faint} value={deckName} onChangeText={setDeckName} style={fieldInput} />
              </View>
              <FieldLabel>Paste your decklist</FieldLabel>
              <TextInput
                value={decklistRaw}
                onChangeText={val => { setDecklistRaw(val); setDeckParsed(false); setParsedCards([]) }}
                placeholder={'1xOP15-002\n4xOP15-053\n...'}
                placeholderTextColor={colors.faint}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ ...fieldInput, minHeight: 140, textAlignVertical: 'top', fontFamily: font.mono, fontSize: 12 }}
              />
              <TouchableOpacity
                onPress={handleParseDeck}
                disabled={!decklistRaw.trim() || enriching}
                style={{ marginTop: 10, paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: decklistRaw.trim() ? 'rgba(140,176,208,0.05)' : 'transparent', alignSelf: 'flex-start' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: decklistRaw.trim() ? colors.text : colors.faint }}>
                  {enriching ? 'Fetching card data...' : 'Preview Decklist'}
                </Text>
              </TouchableOpacity>

              {deckParsed && parsedCards.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 10 }}>
                    {parsedCards.reduce((s, c) => s + c.count, 0)} cards parsed
                  </Text>
                  <View style={{ gap: 2 }}>
                    {parsedCards.map(card => (
                      <View key={card.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEADER_COLORS[card.color] ?? colors.faint }} />
                          <Text style={{ fontFamily: font.mono, fontSize: 12, color: colors.ocean }}>{card.count}×</Text>
                          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.text, fontFamily: font.body, flexShrink: 1 }}>
                            {card.name !== card.id ? card.name : card.id}
                          </Text>
                        </View>
                        <Text style={{ color: colors.faint, fontFamily: font.mono, fontSize: 11 }}>{card.id}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {deckParsed && parsedCards.length === 0 && (
                <Text style={{ marginTop: 12, fontSize: 13, color: colors.crimson, fontFamily: font.body }}>
                  Could not parse any cards. Use format: 4xOP01-024
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={panel}>
          <SectionTitle>Notes</SectionTitle>
          <TextInput
            placeholder="Tournament notes, meta observations..."
            placeholderTextColor={colors.faint}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ ...fieldInput, minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {error ? (
          <View style={{ backgroundColor: 'rgba(210,74,58,0.08)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.2)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 13, color: colors.crimson, fontFamily: font.body }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={saving}
          style={{ paddingVertical: 14, borderRadius: 10, backgroundColor: saving ? '#3a526a' : colors.ocean, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 14, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : 'Save Result'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <SelectDecklistModal
        session={session}
        visible={selectingDecklist}
        onClose={() => setSelectingDecklist(false)}
        onSelect={deck => { setAttachedDecklist(deck); setDecklistRaw(''); setParsedCards([]) }}
      />
    </KeyboardAvoidingView>
  )
}
