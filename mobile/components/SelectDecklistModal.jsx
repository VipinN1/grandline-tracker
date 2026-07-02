import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { colors, font, radius } from '../theme'
import { LEADER_COLORS } from './forms'

export default function SelectDecklistModal({ session, visible, onClose, onSelect }) {
  const [decklists, setDecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!visible) return
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('decklists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
      setDecklists(data ?? [])
      setLoading(false)
    }
    load()
  }, [session, visible])

  const filtered = decklists.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.leader_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#161b27', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', borderWidth: 1, borderColor: colors.line }}>
          {/* Header */}
          <View style={{ paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 1.6, color: colors.gold, marginBottom: 2 }}>Builds</Text>
              <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>Select a Decklist</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)' }}>
            <TextInput
              placeholder="Search by leader or name..."
              placeholderTextColor={colors.faint}
              value={search}
              onChangeText={setSearch}
              style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
            />
          </View>

          {loading ? (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={d => d.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Text style={{ fontSize: 32, marginBottom: 12 }}>🃏</Text>
                  <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted, marginBottom: 4 }}>
                    {search ? 'No decklists match your search.' : 'No saved decklists found.'}
                  </Text>
                  {!search && (
                    <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>Save a decklist when logging a tournament result</Text>
                  )}
                </View>
              }
              renderItem={({ item: deck }) => {
                const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
                return (
                  <TouchableOpacity
                    onPress={() => { onSelect(deck); onClose() }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: 14, padding: 12 }}
                  >
                    <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: 44, height: 60, borderRadius: 6, borderWidth: 1, borderColor: color + '66' }} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text, marginBottom: 2 }}>{deck.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{deck.leader_name} · {deck.leader_id}</Text>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}
