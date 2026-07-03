import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getCardImageUrl } from '../../lib/optcgapi'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card } from '../../theme'
import { LEADER_COLORS } from '../../components/forms'
import DeckModal from '../../components/DeckModal'

export default function Decklists() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [search, setSearch] = useState('')

  const loadDecks = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('decklists')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
    setDecks(data ?? [])
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { loadDecks() }, [loadDecks]))

  function confirmDelete(deck) {
    Alert.alert('Delete decklist', `Delete "${deck.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('decklists').delete().eq('id', deck.id)
          setDecks(prev => prev.filter(d => d.id !== deck.id))
        },
      },
    ])
  }

  const filtered = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.leader_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss }}>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90, gap: 10 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 }}>Builds</Text>
            <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.text, marginBottom: 12 }}>Decklists</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                placeholder="Search by leader or name..."
                placeholderTextColor={colors.faint}
                value={search}
                onChangeText={setSearch}
                style={{ flex: 1, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
              />
              <TouchableOpacity
                onPress={() => router.push('/deck-builder')}
                style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: colors.ocean, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>+ New</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 70 }}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>🃏</Text>
            <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted, marginBottom: 6 }}>
              {search ? 'No decklists match your search' : 'No decklists saved yet'}
            </Text>
            {!search && (
              <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>Build one with the Deck Builder or save one when logging a result</Text>
            )}
          </View>
        }
        renderItem={({ item: deck }) => {
          const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
          return (
            <TouchableOpacity
              onPress={() => setSelectedDeck(deck)}
              onLongPress={() => confirmDelete(deck)}
              style={{ ...card, overflow: 'hidden' }}
            >
              <View style={{ height: 110, overflow: 'hidden' }}>
                <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: '100%', height: 190 }} resizeMode="cover" />
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: color }} />
                <TouchableOpacity
                  onPress={() => confirmDelete(deck)}
                  hitSlop={6}
                  style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}
                >
                  <Text style={{ fontSize: 11, fontFamily: font.bold, color: '#fff' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text, marginBottom: 2 }}>{deck.name}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, marginBottom: 6 }}>{deck.leader_name} · {deck.leader_id}</Text>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>
                  Updated {new Date(deck.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />
      {selectedDeck && <DeckModal deck={selectedDeck} onClose={() => setSelectedDeck(null)} />}
    </View>
  )
}
