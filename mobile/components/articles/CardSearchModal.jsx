// RN counterpart to src/components/articles/CardSearchModal.jsx — search any
// card (not leader-only) and pick one. Used for cardEmbed blocks and the
// cover-card picker.
import { useState, useRef } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native'
import { searchCards, getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius } from '../../theme'

export default function CardSearchModal({ title = 'Search Cards', onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)

  function handleQuery(val) {
    setQuery(val)
    clearTimeout(debounce.current)
    if (val.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await searchCards(val)) }
      catch { setResults([]) }
      setSearching(false)
    }, 350)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#161b27', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', borderWidth: 1, borderColor: colors.line }}>
          <View style={{ paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)' }}>
            <TextInput
              placeholder="Search by name or ID..."
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={handleQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
            />
          </View>

          {searching ? (
            <ActivityIndicator color={colors.gold} style={{ padding: 24 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={c => c.card_image_id ?? c.card_set_id}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', padding: 30, fontSize: 13, color: colors.faint, fontFamily: font.body }}>
                  {query.trim().length < 2 ? 'Type at least 2 characters to search' : 'No cards found'}
                </Text>
              }
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  onPress={() => { onSelect(c); onClose() }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: 12, padding: 10 }}
                >
                  <Image source={{ uri: getCardImageUrl(c) }} style={{ width: 40, height: 56, borderRadius: 5 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{c.card_name}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.mono }}>{c.card_set_id}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}
