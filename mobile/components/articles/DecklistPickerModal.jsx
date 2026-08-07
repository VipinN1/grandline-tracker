// RN counterpart to src/components/articles/DecklistPickerModal.jsx — pick
// one of the user's saved decklists, or paste a raw list, to embed in an
// article. onSelect receives { name, leaderId, leaderName, leaderColor,
// cards: [{ id, name, count }] }.
import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { getCardImageUrl } from '../../lib/optcgapi'
import { parseDecklistText } from '../../lib/articles'
import { colors, font, radius, btnPrimary, btnPrimaryText } from '../../theme'
import { LEADER_COLORS } from '../forms'

export default function DecklistPickerModal({ session, onClose, onSelect }) {
  const [tab, setTab] = useState(session ? 'saved' : 'paste')
  const [decklists, setDecklists] = useState([])
  const [loading, setLoading] = useState(!!session)
  const [search, setSearch] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('')

  useEffect(() => {
    if (!session) return
    async function load() {
      const { data } = await supabase.from('decklists').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false })
      setDecklists(data ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  const filtered = decklists.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.leader_name?.toLowerCase().includes(search.toLowerCase())
  )

  const parsed = parseDecklistText(pasteText)
  const parsedTotal = parsed.cards.reduce((s, c) => s + c.count, 0)

  function pickSaved(deck) {
    onSelect({
      name: deck.name,
      leaderId: deck.leader_id,
      leaderName: deck.leader_name,
      leaderColor: deck.leader_color,
      cards: (deck.cards ?? []).map(c => ({ id: c.id, name: c.name ?? null, count: c.count ?? 1 })),
    })
    onClose()
  }

  function pickPasted() {
    if (parsed.cards.length === 0) return
    onSelect({ name: pasteName.trim() || 'Decklist', leaderId: null, leaderName: null, leaderColor: null, cards: parsed.cards })
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#161b27', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88%', borderWidth: 1, borderColor: colors.line }}>
          <View style={{ paddingVertical: 18, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 1.6, color: colors.gold, marginBottom: 2 }}>Builds</Text>
              <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>Embed a Decklist</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {session ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 10 }}>
              {[['saved', 'Saved'], ['paste', 'Paste']].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setTab(val)}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', backgroundColor: tab === val ? 'rgba(200,162,74,0.15)' : 'transparent', borderWidth: 1, borderColor: tab === val ? colors.goldLine : colors.line }}
                >
                  <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.4, color: tab === val ? colors.gold : colors.faint }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {tab === 'saved' ? (
            <>
              <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                <TextInput
                  placeholder="Search by leader or name..."
                  placeholderTextColor={colors.faint}
                  value={search}
                  onChangeText={setSearch}
                  style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
                />
              </View>
              {loading ? (
                <ActivityIndicator color={colors.gold} style={{ padding: 24 }} />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={d => d.id}
                  contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 8 }}
                  ListEmptyComponent={
                    <Text style={{ textAlign: 'center', padding: 30, fontSize: 13, color: colors.faint, fontFamily: font.body }}>
                      {search ? 'No decklists match your search.' : 'No saved decklists found.'}
                    </Text>
                  }
                  renderItem={({ item: deck }) => {
                    const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
                    return (
                      <TouchableOpacity onPress={() => pickSaved(deck)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: 14, padding: 12 }}>
                        <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: 40, height: 56, borderRadius: 5, borderWidth: 1, borderColor: color + '66' }} resizeMode="cover" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text, marginBottom: 2 }}>{deck.name}</Text>
                          <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{deck.leader_name} · {deck.leader_id}</Text>
                        </View>
                      </TouchableOpacity>
                    )
                  }}
                />
              )}
            </>
          ) : (
            <View style={{ padding: 16, gap: 10 }}>
              <TextInput
                placeholder="Deck name (optional)"
                placeholderTextColor={colors.faint}
                value={pasteName}
                onChangeText={setPasteName}
                style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
              />
              <TextInput
                placeholder={'4xOP01-016\n1x Nami OP01-025\n...'}
                placeholderTextColor={colors.faint}
                value={pasteText}
                onChangeText={setPasteText}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, color: colors.text, fontSize: 12, fontFamily: font.mono, height: 140, textAlignVertical: 'top' }}
              />
              {pasteText.trim() ? (
                <Text style={{ fontSize: 12, color: parsed.cards.length ? colors.emerald : colors.crimson, fontFamily: font.body }}>
                  {parsed.cards.length > 0 ? `${parsedTotal} cards parsed` : 'No cards recognized — use format 4xOP01-016'}
                </Text>
              ) : null}
              <TouchableOpacity onPress={pickPasted} disabled={parsed.cards.length === 0} style={{ ...btnPrimary, opacity: parsed.cards.length === 0 ? 0.5 : 1 }}>
                <Text style={btnPrimaryText}>Embed Decklist</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}
