import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { getCardImageUrl } from '../../lib/optcgapi'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius } from '../../theme'
import { LEADER_COLORS } from '../../components/forms'
import DeckModal from '../../components/DeckModal'
import { Glass, GlassButton } from '../../components/glass'

export default function Decklists() {
  const { session } = useSession()
  const { width: screenW } = useWindowDimensions()
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
              <GlassButton onPress={() => router.push('/deck-builder')} tint={colors.ocean} pad={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>+ New</Text>
              </GlassButton>
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
          // Crop the leader art toward the head: card art is 2.5:3.5, so scale
          // to full width and shift up past the top frame (same trick as the
          // LeaderHero on the tournament detail screen).
          const bannerW = screenW - 32
          const imgH = bannerW * 1.4
          const offsetY = imgH * 0.13
          return (
            <TouchableOpacity
              onPress={() => setSelectedDeck(deck)}
              onLongPress={() => confirmDelete(deck)}
            >
              <Glass style={{ borderWidth: 1, borderColor: color + '40' }}>
                <View style={{ height: 168, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: getCardImageUrl(deck.leader_id) }}
                    style={{ position: 'absolute', top: -offsetY, width: bannerW, height: imgH }}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['rgba(6,16,27,0)', 'rgba(6,16,27,0.45)', 'rgba(6,16,27,0.92)']}
                    locations={[0, 0.55, 1]}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                  />
                  {/* Clear glass delete chip refracting the art beneath it */}
                  <GlassButton
                    onPress={() => confirmDelete(deck)}
                    effect="clear"
                    pad={{ paddingVertical: 6, paddingHorizontal: 12 }}
                    style={{ position: 'absolute', top: 10, right: 10 }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.text }}>✕</Text>
                  </GlassButton>

                  {/* Deck info overlaid on the art */}
                  <View style={{ flex: 1, justifyContent: 'flex-end', padding: 14 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.display, fontSize: 19, color: colors.text }}>{deck.name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color, fontFamily: font.semi, marginTop: 3 }}>
                      {deck.leader_name} · {deck.leader_id}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginTop: 3 }}>
                      {(deck.cards ?? []).reduce((s, c) => s + c.count, 0)} cards · Updated {new Date(deck.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              </Glass>
            </TouchableOpacity>
          )
        }}
      />
      {selectedDeck && <DeckModal deck={selectedDeck} onClose={() => setSelectedDeck(null)} />}
    </View>
  )
}
