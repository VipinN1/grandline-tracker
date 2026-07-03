import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { router, Stack } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { searchCards, searchLeaders, getCard, getCardImageUrl, enrichCards } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, radius } from '../theme'
import { LEADER_COLORS, fieldInput } from '../components/forms'

const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']
const MAX_COPIES = 4
const MAX_DECK = 50
const SETS = ['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP09','OP10','OP11','OP12','OP13','OP14','OP15','OP16','EB01','EB02','EB03','EB04','PRB01','PRB02']

function getAltArtType(card) {
  const name = (card.card_name ?? '').toLowerCase()
  const rarity = (card.card_rarity ?? '').toLowerCase()
  if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
  if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
  if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
  if (/parallel|alt[\s_]art|alternate[\s_]art/.test(name) || rarity === 'parallel' || rarity === 'p') return 'parallel'
  return null
}

function Pill({ active, accent, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20,
        borderWidth: 1,
        borderColor: active && accent ? accent + '66' : active ? 'rgba(200,162,74,0.5)' : 'rgba(140,176,208,0.15)',
        backgroundColor: active && accent ? accent + '26' : active ? 'rgba(140,176,208,0.2)' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: font.semi, color: active && accent ? accent : active ? colors.oceanBright : colors.muted }}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function DeckBuilder() {
  const { session } = useSession()
  const { width: screenW } = useWindowDimensions()

  // Search grid: 4 per row. Visual deck view: 3 per row (bigger cards).
  const searchThumbW = Math.floor((screenW - 32 - 3 * 6) / 4)
  const visualThumbW = Math.floor((screenW - 32 - 2 * 8) / 3)

  const [deckName, setDeckName] = useState('')
  const [deckView, setDeckView] = useState('list')
  const [leader, setLeader] = useState(null)
  const [deckCards, setDeckCards] = useState({})

  const [cardQuery, setCardQuery] = useState('')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)

  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderResults, setLeaderResults] = useState([])
  const [leaderSearching, setLeaderSearching] = useState(false)

  const [filterColor, setFilterColor] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAltArt, setFilterAltArt] = useState('')
  const [filterCost, setFilterCost] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const [tab, setTab] = useState('search')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const cardDebounce = useRef(null)
  const leaderDebounce = useRef(null)

  function handleCardQuery(val) {
    setCardQuery(val)
    clearTimeout(cardDebounce.current)
    if (val.length < 2) { setCardResults([]); return }
    cardDebounce.current = setTimeout(async () => {
      setCardSearching(true)
      try { setCardResults(await searchCards(val)) }
      catch { setCardResults([]) }
      setCardSearching(false)
    }, 350)
  }

  function handleLeaderQuery(val) {
    setLeaderQuery(val)
    clearTimeout(leaderDebounce.current)
    if (val.length < 2) { setLeaderResults([]); return }
    leaderDebounce.current = setTimeout(async () => {
      setLeaderSearching(true)
      try { setLeaderResults(await searchLeaders(val)) }
      catch { setLeaderResults([]) }
      setLeaderSearching(false)
    }, 350)
  }

  const totalCards = Object.values(deckCards).reduce((s, e) => s + e.count, 0)

  function addCard(card) {
    const key = card.card_set_id
    if (!key) return
    setDeckCards(prev => {
      const existing = prev[key]
      const currTotal = Object.values(prev).reduce((s, e) => s + e.count, 0)
      if (existing && existing.count >= MAX_COPIES) return prev
      if (currTotal >= MAX_DECK) return prev
      return { ...prev, [key]: { card, count: (existing?.count ?? 0) + 1 } }
    })
  }

  function adjustCount(key, delta) {
    setDeckCards(prev => {
      const existing = prev[key]
      if (!existing) return prev
      const currTotal = Object.values(prev).reduce((s, e) => s + e.count, 0)
      const newCount = existing.count + delta
      if (newCount <= 0) { const next = { ...prev }; delete next[key]; return next }
      if (newCount > MAX_COPIES) return prev
      if (delta > 0 && currTotal >= MAX_DECK) return prev
      return { ...prev, [key]: { ...existing, count: newCount } }
    })
  }

  async function exportDeck() {
    const lines = []
    if (leader) lines.push(`Leader: ${leader.card_set_id}`)
    Object.values(deckCards).forEach(({ card, count }) => lines.push(`${count}x${card.card_set_id}`))
    await Clipboard.setStringAsync(lines.join('\n'))
    setSaveMsg('Copied!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true); setError('')
    try {
      let leaderIdRaw = null
      const cardLines = []
      for (const line of importText.trim().split('\n')) {
        const t = line.trim()
        const lm = t.match(/^[Ll]eader:\s*([A-Z0-9-]+)/i)
        const cm = t.match(/^(\d+)[xX]([A-Z0-9-]+)$/i)
        if (lm) leaderIdRaw = lm[1].toUpperCase()
        else if (cm) cardLines.push({ id: cm[2].toUpperCase(), count: parseInt(cm[1]), name: cm[2].toUpperCase() })
      }
      if (leaderIdRaw) {
        try { const c = await getCard(leaderIdRaw); if (c) setLeader(c) } catch {}
      }
      if (cardLines.length > 0) {
        const enriched = await enrichCards(cardLines)
        const deck = {}
        for (const c of enriched) {
          deck[c.id] = {
            card: { card_set_id: c.id, card_name: c.name, card_color: c.color, card_type: c.type, card_image: c.image },
            count: Math.min(c.count, MAX_COPIES),
          }
        }
        setDeckCards(deck)
      }
      setShowImport(false); setImportText(''); setTab('deck')
    } catch { setError('Failed to import. Check the format and try again.') }
    setImporting(false)
  }

  async function handleSave() {
    if (!deckName.trim()) { setError('Enter a deck name.'); return }
    if (!leader) { setError('Select a leader first.'); return }
    setSaving(true); setError('')
    const cards = Object.values(deckCards).map(({ card, count }) => ({
      id: card.card_set_id,
      name: card.card_name ?? card.card_set_id,
      count,
      type: card.card_type ?? null,
      color: card.card_color ?? null,
      image: card.card_image ?? null,
    }))
    const { error: err } = await supabase.from('decklists').insert({
      user_id: session.user.id,
      name: deckName.trim(),
      leader_id: leader.card_set_id,
      leader_name: leader.card_name,
      leader_color: leader.card_color,
      cards,
    })
    setSaving(false)
    if (err) { setError('Failed to save. ' + err.message); return }
    router.back()
  }

  const filteredResults = cardResults.filter(card => {
    if (filterColor.length > 0) {
      const cc = (card.card_color ?? '').split(/[\s/]+/).map(c => c.trim()).filter(Boolean)
      if (!filterColor.some(fc => cc.some(c => c.toLowerCase() === fc.toLowerCase()))) return false
    }
    if (filterType && card.card_type !== filterType) return false
    const id = card.card_set_id ?? ''
    if (filterSource === 'ST' && !/^ST/i.test(id)) return false
    if (filterSource === 'Promos' && !/^P-/i.test(id)) return false
    if (filterSource && filterSource !== 'ST' && filterSource !== 'Promos' && !id.toUpperCase().startsWith(filterSource)) return false
    if (filterAltArt && getAltArtType(card) !== filterAltArt) return false
    if (filterCost !== null && String(card.card_cost ?? '') !== String(filterCost)) return false
    return true
  })

  const deckEntries = Object.entries(deckCards)
  const grouped = [
    ['Character', deckEntries.filter(([, { card }]) => card.card_type === 'Character')],
    ['Event', deckEntries.filter(([, { card }]) => card.card_type === 'Event')],
    ['Stage', deckEntries.filter(([, { card }]) => card.card_type === 'Stage')],
    ['Other', deckEntries.filter(([, { card }]) => !['Character', 'Event', 'Stage'].includes(card.card_type))],
  ]

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Deck Builder',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.abyss }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>

        {/* Search / Deck tab toggle */}
        <View style={{ flexDirection: 'row', gap: 6, margin: 16, marginBottom: 8, backgroundColor: 'rgba(140,176,208,0.03)', borderRadius: 10, padding: 4 }}>
          {[['search', 'Card Search'], ['deck', `Deck (${totalCards}/${MAX_DECK})`]].map(([t, label]) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tab === t ? 'rgba(140,176,208,0.2)' : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: tab === t ? colors.oceanBright : colors.muted }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'search' ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
            <TextInput
              placeholder="Search cards by name or ID..."
              placeholderTextColor={colors.faint}
              value={cardQuery}
              onChangeText={handleCardQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ ...fieldInput, paddingVertical: 10, fontSize: 14, marginBottom: 8 }}
            />

            <TouchableOpacity onPress={() => setShowFilters(f => !f)} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>
                {showFilters ? '▾ Hide filters' : '▸ Filters'}
                {(filterColor.length || filterType || filterSource || filterAltArt || filterCost !== null) ? ' (active)' : ''}
              </Text>
            </TouchableOpacity>

            {showFilters && (
              <View style={{ backgroundColor: 'rgba(140,176,208,0.03)', borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, gap: 8, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  <Pill active={filterColor.length === 0} label="All" onPress={() => setFilterColor([])} />
                  {CARD_COLORS.map(c => (
                    <Pill key={c} active={filterColor.includes(c)} accent={LEADER_COLORS[c]} label={c}
                      onPress={() => setFilterColor(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {[['', 'All Types'], ['Leader', 'Leader'], ['Character', 'Character'], ['Event', 'Event'], ['Stage', 'Stage']].map(([val, label]) => (
                    <Pill key={val || 't-all'} active={filterType === val} label={label} onPress={() => setFilterType(val)} />
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  <Pill active={filterSource === ''} label="All Sets" onPress={() => setFilterSource('')} />
                  <Pill active={filterSource === 'ST'} label="Starter Decks" onPress={() => setFilterSource('ST')} />
                  <Pill active={filterSource === 'Promos'} label="Promos" onPress={() => setFilterSource('Promos')} />
                  {SETS.map(s => (
                    <Pill key={s} active={filterSource === s} label={s} onPress={() => setFilterSource(filterSource === s ? '' : s)} />
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {[['', 'All Arts'], ['parallel', 'Parallel'], ['sp', 'SP'], ['manga', 'Manga'], ['tr', 'TR']].map(([val, label]) => {
                    const ac = { parallel: '#d56a9c', sp: '#3bb27e', manga: '#38bdf8', tr: '#e08a3c' }[val]
                    return <Pill key={val || 'a-all'} active={filterAltArt === val} accent={ac} label={label} onPress={() => setFilterAltArt(val)} />
                  })}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  <Pill active={filterCost === null} label="All Costs" onPress={() => setFilterCost(null)} />
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <Pill key={n} active={filterCost === n} label={String(n)} onPress={() => setFilterCost(filterCost === n ? null : n)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {cardSearching && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>Searching...</Text>
              </View>
            )}
            {!cardSearching && cardQuery.length >= 2 && filteredResults.length === 0 && (
              <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>No cards found. Try adjusting filters or your query.</Text>
            )}
            {cardQuery.length < 2 && (
              <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>Type at least 2 characters to search</Text>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {filteredResults.map(card => {
                const key = card.card_set_id
                const inDeck = deckCards[key]
                const atMax = inDeck && inDeck.count >= MAX_COPIES
                const disabled = atMax || totalCards >= MAX_DECK
                return (
                  <TouchableOpacity
                    key={card.card_image_id ?? card.card_set_id}
                    onPress={() => !disabled && addCard(card)}
                    style={{ opacity: atMax ? 0.4 : 1 }}
                  >
                    <Image
                      source={{ uri: getCardImageUrl(card) }}
                      style={{ width: searchThumbW, height: Math.floor(searchThumbW * 1.4), borderRadius: 7, borderWidth: inDeck ? 2 : 1, borderColor: inDeck ? colors.ocean : colors.line }}
                      resizeMode="cover"
                    />
                    {inDeck && (
                      <View style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: colors.ocean, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontFamily: font.bold }}>{inDeck.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
            {/* Leader */}
            <View style={{ backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 8 }}>Leader</Text>
              {leader ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Image source={{ uri: getCardImageUrl(leader) }} style={{ width: 56, height: 78, borderRadius: 7, borderWidth: 2, borderColor: (LEADER_COLORS[leader.card_color] ?? colors.ocean) + '44' }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{leader.card_name}</Text>
                    <Text style={{ fontSize: 11, marginTop: 2, fontFamily: font.body }}>
                      <Text style={{ color: LEADER_COLORS[leader.card_color] ?? colors.muted }}>{leader.card_color}</Text>
                      <Text style={{ color: colors.faint }}> · </Text>
                      <Text style={{ color: colors.muted, fontFamily: font.mono }}>{leader.card_set_id}</Text>
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setLeader(null)} hitSlop={8}>
                    <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TextInput
                    placeholder="Search for a leader..."
                    placeholderTextColor={colors.faint}
                    value={leaderQuery}
                    onChangeText={handleLeaderQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ ...fieldInput, paddingVertical: 8, fontSize: 12 }}
                  />
                  {leaderQuery.length >= 2 && (
                    <View style={{ backgroundColor: 'rgba(10,22,38,0.98)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.sm, marginTop: 4, maxHeight: 200, overflow: 'hidden' }}>
                      {leaderSearching ? (
                        <Text style={{ padding: 12, fontSize: 12, color: colors.muted, fontFamily: font.body }}>Searching...</Text>
                      ) : leaderResults.length === 0 ? (
                        <Text style={{ padding: 12, fontSize: 12, color: colors.faint, fontFamily: font.body }}>No leaders found</Text>
                      ) : (
                        <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                          {leaderResults.map(card => (
                            <TouchableOpacity
                              key={card.card_image_id ?? card.card_set_id}
                              onPress={() => { setLeader(card); setLeaderQuery(''); setLeaderResults([]) }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.04)' }}
                            >
                              <Image source={{ uri: getCardImageUrl(card) }} style={{ width: 32, height: 45, borderRadius: 4 }} resizeMode="cover" />
                              <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.semi, color: colors.text }}>{card.card_name}</Text>
                                <Text style={{ fontSize: 10, fontFamily: font.mono, color: colors.muted }}>{card.card_set_id}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Progress */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: font.body }}>
                <Text style={{ fontFamily: font.bold, color: totalCards === MAX_DECK ? colors.emerald : colors.text }}>{totalCards}</Text>
                <Text style={{ color: colors.faint }}> / {MAX_DECK}</Text>
              </Text>
              <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(140,176,208,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ height: '100%', borderRadius: 2, backgroundColor: totalCards === MAX_DECK ? colors.emerald : colors.ocean, width: `${Math.min((totalCards / MAX_DECK) * 100, 100)}%` }} />
              </View>
              {deckEntries.length > 0 && (
                <TouchableOpacity onPress={() => setDeckCards({})}>
                  <Text style={{ fontSize: 10, color: colors.crimson, fontFamily: font.semi }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* View toggle */}
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
              <Pill active={deckView === 'list'} label="List" onPress={() => setDeckView('list')} />
              <Pill active={deckView === 'visual'} label="Visual" onPress={() => setDeckView('visual')} />
            </View>

            {/* Card display */}
            {deckEntries.length === 0 ? (
              <Text style={{ paddingVertical: 32, textAlign: 'center', color: colors.faint, fontSize: 12, fontFamily: font.body }}>
                Tap cards in the search tab to add them here
              </Text>
            ) : deckView === 'visual' ? (
              <View>
                {grouped.map(([type, entries]) => entries.length === 0 ? null : (
                  <View key={type} style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 7 }}>
                      {type} ({entries.reduce((s, [, e]) => s + e.count, 0)})
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {entries.map(([key, { card, count }]) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => adjustCount(key, 1)}
                          onLongPress={() => adjustCount(key, -1)}
                          delayLongPress={250}
                        >
                          <Image
                            source={{ uri: getCardImageUrl(card) }}
                            style={{ width: visualThumbW, height: Math.floor(visualThumbW * 1.4), borderRadius: 8, borderWidth: 1, borderColor: (LEADER_COLORS[card.card_color] ?? 'rgba(140,176,208,0.3)') + '88' }}
                            resizeMode="cover"
                          />
                          <View style={{ position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 5, paddingVertical: 2, paddingHorizontal: 6 }}>
                            <Text style={{ color: colors.oceanBright, fontSize: 13, fontFamily: font.bold }}>{count}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
                <Text style={{ fontSize: 10, color: colors.faint, marginTop: 4, fontFamily: font.body }}>Tap +1 · Long-press −1</Text>
              </View>
            ) : grouped.map(([type, entries]) => entries.length === 0 ? null : (
              <View key={type} style={{ marginBottom: 10 }}>
                <Text style={{ paddingVertical: 5, fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint }}>
                  {type} ({entries.reduce((s, [, e]) => s + e.count, 0)})
                </Text>
                {entries.map(([key, { card, count }]) => (
                  <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.03)' }}>
                    <Image source={{ uri: getCardImageUrl(card) }} style={{ width: 32, height: 45, borderRadius: 4 }} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.semi, color: colors.text }}>{card.card_name}</Text>
                      <Text style={{ fontSize: 10, color: colors.faint, fontFamily: font.mono }}>{card.card_set_id}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity onPress={() => adjustCount(key, -1)} style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: colors.text, fontSize: 16, lineHeight: 18 }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.oceanBright, minWidth: 18, textAlign: 'center' }}>{count}</Text>
                      <TouchableOpacity
                        onPress={() => adjustCount(key, 1)}
                        disabled={count >= MAX_COPIES || totalCards >= MAX_DECK}
                        style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: count >= MAX_COPIES || totalCards >= MAX_DECK ? 'transparent' : 'rgba(140,176,208,0.05)', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: count >= MAX_COPIES || totalCards >= MAX_DECK ? colors.faint : colors.text, fontSize: 16, lineHeight: 18 }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {/* Actions */}
            <View style={{ marginTop: 12, gap: 8 }}>
              <TextInput
                placeholder="Deck name..."
                placeholderTextColor={colors.faint}
                value={deckName}
                onChangeText={setDeckName}
                style={fieldInput}
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity onPress={exportDeck} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.04)', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontFamily: font.semi }}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowImport(true)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.04)', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontFamily: font.semi }}>Import</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 2, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: saving ? 'rgba(140,176,208,0.05)' : colors.ocean, alignItems: 'center' }}>
                  <Text style={{ color: saving ? colors.muted : '#fff', fontSize: 12, fontFamily: font.bold }}>
                    {saving ? 'Saving...' : saveMsg || 'Save Deck'}
                  </Text>
                </TouchableOpacity>
              </View>
              {error ? <Text style={{ fontSize: 11, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
            </View>
          </ScrollView>
        )}

        {/* Import modal */}
        <Modal visible={showImport} transparent animationType="fade" onRequestClose={() => setShowImport(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: colors.abyss, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, gap: 14 }}>
              <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>Import Decklist</Text>
              <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 19, fontFamily: font.body }}>
                One card per line: <Text style={{ fontFamily: font.mono, color: colors.oceanBright }}>4xOP01-001</Text>. Leader line: <Text style={{ fontFamily: font.mono, color: colors.oceanBright }}>Leader: OP01-001</Text>
              </Text>
              <TextInput
                value={importText}
                onChangeText={setImportText}
                placeholder={'Leader: OP01-001\n4xOP01-002\n3xOP01-003\n...'}
                placeholderTextColor={colors.faint}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ ...fieldInput, minHeight: 180, textAlignVertical: 'top', fontFamily: font.mono, fontSize: 12 }}
              />
              {error ? <Text style={{ fontSize: 11, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => { setShowImport(false); setImportText(''); setError('') }} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontFamily: font.semi }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleImport} disabled={!importText.trim() || importing} style={{ flex: 2, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: importText.trim() && !importing ? colors.ocean : 'rgba(140,176,208,0.05)', alignItems: 'center' }}>
                  <Text style={{ color: importText.trim() && !importing ? '#fff' : colors.muted, fontSize: 13, fontFamily: font.bold }}>
                    {importing ? 'Importing...' : 'Import'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  )
}
