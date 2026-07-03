import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, Image, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassView, GlassContainer } from 'expo-glass-effect'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl, enrichCards } from '../../lib/optcgapi'
import { colors, font, radius } from '../../theme'
import {
  LeaderSearchInput, ToggleGroup, SearchableSelect, SectionTitle, FieldLabel,
  fieldInput, LEADER_COLORS, baseCardId, getLeaderStorageId,
} from '../../components/forms'
import SelectDecklistModal from '../../components/SelectDecklistModal'
import LiveTournament from '../../components/LiveTournament'
import { Glass, GlassButton, GlassPills, GlassInput, hasGlass } from '../../components/glass'

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

// Selected leader rendered as a hero strip — art cropped toward the head,
// with a clear-glass Change chip refracting the art beneath it.
function LeaderBanner({ leader, onChange }) {
  const [width, setWidth] = useState(0)
  const imgH = width * 1.4
  const color = LEADER_COLORS[leader.card_color] ?? colors.lineStrong
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: 140, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: color + '66', backgroundColor: colors.surface }}>
      {width > 0 && (
        <Image
          source={{ uri: leader.card_image ?? getCardImageUrl(leader.card_set_id) }}
          style={{ position: 'absolute', top: -imgH * 0.14, width, height: imgH }}
          resizeMode="cover"
        />
      )}
      <LinearGradient
        colors={['rgba(6,16,27,0)', 'rgba(6,16,27,0.5)', 'rgba(6,16,27,0.9)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 14 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>{leader.card_name}</Text>
          <Text style={{ fontSize: 11, color, marginTop: 2, fontFamily: font.semi }}>{leader.card_color} · {baseCardId(leader.card_set_id)}</Text>
        </View>
        <GlassButton onPress={onChange} effect="clear" pad={{ paddingVertical: 9, paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 13, color: colors.text, fontFamily: font.semi }}>Change</Text>
        </GlassButton>
      </View>
    </View>
  )
}

function RoundRow({ round, index, onChange, onRemove }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.oceanBright }}>Round {index + 1}</Text>
        <GlassButton onPress={() => onRemove(index)} pad={{ paddingVertical: 5, paddingHorizontal: 12 }}>
          <Text style={{ color: colors.textSoft, fontSize: 14 }}>✕</Text>
        </GlassButton>
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
          <GlassInput
            placeholder="Round notes..."
            value={round.notes ?? ''}
            onChangeText={val => onChange(index, 'notes', val)}
            multiline
            inputStyle={{ minHeight: 56, textAlignVertical: 'top' }}
          />
        </View>
      </View>
    </View>
  )
}

function PastTournamentForm() {
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.abyss }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 160, gap: 12 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

        {/* Your Leader */}
        {leaderResult ? (
          <LeaderBanner leader={leaderResult} onChange={() => setLeaderResult(null)} />
        ) : (
          <Glass style={{ padding: 16 }}>
            <SectionTitle>Your Leader Card</SectionTitle>
            <LeaderSearchInput placeholder="Search your leader..." onSelect={setLeaderResult} selected={null} onClear={() => setLeaderResult(null)} />
          </Glass>
        )}

        {/* Tournament Info */}
        <Glass style={{ padding: 16 }}>
          <SectionTitle>Tournament Info</SectionTitle>
          <View style={{ gap: 12 }}>
            <SearchableSelect label="Store / Venue" placeholder="Search or create a store..." items={storesForDisplay} selected={selectedStore} onSelect={setSelectedStore} onCreateNew={createStore} createLabel="Create store" sublabel="sublabel" />
            <SearchableSelect label="Tournament Series" placeholder="Search or create a series..." items={series} selected={selectedSeries} onSelect={setSelectedSeries} onCreateNew={createSeries} createLabel="Create series" />
            <View>
              <FieldLabel>Tournament Name (if no series)</FieldLabel>
              <GlassInput
                placeholder="e.g. One-off event"
                value={selectedSeries ? selectedSeries.name : tournamentName}
                onChangeText={setTournamentName}
                editable={!selectedSeries}
                style={{ opacity: selectedSeries ? 0.5 : 1 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Date</FieldLabel>
                <GlassInput
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Players</FieldLabel>
                <GlassInput placeholder="e.g. 32" value={playerCount} onChangeText={setPlayerCount} keyboardType="number-pad" />
              </View>
            </View>
            <View>
              <FieldLabel>Final Placement</FieldLabel>
              <GlassInput placeholder="e.g. 1" value={placement} onChangeText={setPlacement} keyboardType="number-pad" />
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
        </Glass>

        {/* Rounds — each round floats as its own glass card */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold }}>Rounds</Text>
            <Text style={{ fontSize: 13, fontFamily: font.mono }}>
              <Text style={{ color: colors.emerald }}>{wins}W</Text>
              <Text style={{ color: colors.muted }}> · </Text>
              <Text style={{ color: colors.crimson }}>{losses}L</Text>
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {rounds.map((round, i) => (
              <Glass key={i} style={{ padding: 14 }}>
                <RoundRow round={round} index={i} onChange={updateRound} onRemove={removeRound} />
              </Glass>
            ))}
          </View>

          <GlassButton onPress={addRound} pad={{ paddingVertical: 15, paddingHorizontal: 16 }} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.textSoft }}>+ Add Round</Text>
          </GlassButton>
        </View>

        {/* Decklist */}
        <Glass style={{ padding: 16 }}>
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
              <GlassButton onPress={() => setAttachedDecklist(null)} pad={{ paddingVertical: 5, paddingHorizontal: 12 }}>
                <Text style={{ color: colors.textSoft, fontSize: 14 }}>✕</Text>
              </GlassButton>
            </View>
          ) : (
            <View>
              <GlassButton onPress={() => setSelectingDecklist(true)} pad={{ paddingVertical: 14, paddingHorizontal: 16 }} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.oceanBright }}>Attach Decklist From Account</Text>
              </GlassButton>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(140,176,208,0.05)' }} />
                <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.faint }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(140,176,208,0.05)' }} />
              </View>

              <View style={{ marginBottom: 12 }}>
                <FieldLabel>Deck Name</FieldLabel>
                <GlassInput placeholder="e.g. Red Luffy Aggro v3" value={deckName} onChangeText={setDeckName} />
              </View>
              <FieldLabel>Paste your decklist</FieldLabel>
              <GlassInput
                value={decklistRaw}
                onChangeText={val => { setDecklistRaw(val); setDeckParsed(false); setParsedCards([]) }}
                placeholder={'1xOP15-002\n4xOP15-053\n...'}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                inputStyle={{ minHeight: 140, textAlignVertical: 'top', fontFamily: font.mono, fontSize: 12 }}
              />
              <GlassButton
                onPress={handleParseDeck}
                disabled={!decklistRaw.trim() || enriching}
                pad={{ paddingVertical: 12, paddingHorizontal: 22 }}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              >
                <Text style={{ fontSize: 14, fontFamily: font.semi, color: decklistRaw.trim() ? colors.text : colors.faint }}>
                  {enriching ? 'Fetching card data...' : 'Preview Decklist'}
                </Text>
              </GlassButton>

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
        </Glass>

        {/* Notes */}
        <Glass style={{ padding: 16 }}>
          <SectionTitle>Notes</SectionTitle>
          <GlassInput
            placeholder="Tournament notes, meta observations..."
            value={notes}
            onChangeText={setNotes}
            multiline
            inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </Glass>

        {error ? (
          <View style={{ backgroundColor: 'rgba(210,74,58,0.08)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.2)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 13, color: colors.crimson, fontFamily: font.body }}>{error}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* Floating glass dock — W–L tally + Save hovering over the scrolling
          form in one GlassContainer, so the pieces merge like the system bar. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 70, flexDirection: 'row', justifyContent: 'center' }}>
        {hasGlass ? (
          <GlassContainer spacing={24} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <GlassView glassEffectStyle="clear" style={{ borderRadius: 999, overflow: 'hidden', paddingVertical: 17, paddingHorizontal: 22 }}>
              <Text style={{ fontSize: 15, fontFamily: font.mono }}>
                <Text style={{ color: colors.emerald }}>{wins}W</Text>
                <Text style={{ color: colors.textSoft }}> · </Text>
                <Text style={{ color: colors.crimson }}>{losses}L</Text>
              </Text>
            </GlassView>
            <GlassView isInteractive glassEffectStyle="clear" tintColor={colors.gold} style={{ borderRadius: 999, overflow: 'hidden', opacity: saving ? 0.6 : 1 }}>
              <Pressable onPress={handleSubmit} disabled={saving} style={{ paddingVertical: 17, paddingHorizontal: 40 }}>
                <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.onAccent }}>{saving ? 'Saving...' : 'Save Result'}</Text>
              </Pressable>
            </GlassView>
          </GlassContainer>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface2, paddingVertical: 17, paddingHorizontal: 22 }}>
              <Text style={{ fontSize: 15, fontFamily: font.mono }}>
                <Text style={{ color: colors.emerald }}>{wins}W</Text>
                <Text style={{ color: colors.textSoft }}> · </Text>
                <Text style={{ color: colors.crimson }}>{losses}L</Text>
              </Text>
            </View>
            <GlassButton onPress={handleSubmit} disabled={saving} tint={colors.gold} pad={{ paddingVertical: 17, paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.onAccent }}>{saving ? 'Saving...' : 'Save Result'}</Text>
            </GlassButton>
          </View>
        )}
      </View>

      <SelectDecklistModal
        session={session}
        visible={selectingDecklist}
        onClose={() => setSelectingDecklist(false)}
        onSelect={deck => { setAttachedDecklist(deck); setDecklistRaw(''); setParsedCards([]) }}
      />
    </KeyboardAvoidingView>
  )
}

export default function LogResult() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState('past')

  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
        <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 }}>⚓ Logbook</Text>
        <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.text, marginBottom: 12 }}>Log Result</Text>
        <GlassPills
          style={{ marginBottom: 14, justifyContent: 'center', gap: 10 }}
          pad={{ paddingVertical: 15, paddingHorizontal: 24 }}
          textSize={15}
          items={[
            { key: 'live', label: '🟢 Live Tournament' },
            { key: 'past', label: '📋 Past Tournament' },
          ]}
          activeKey={mode}
          onSelect={setMode}
        />
      </View>

      {mode === 'live' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 90 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <LiveTournament session={session} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <PastTournamentForm />
      )}
    </View>
  )
}
