// RN port of src/pages/CreatorsDirectory.jsx — directory of opted-in
// content-creator pages.
import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { router, Stack } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors, font, radius, card } from '../../theme'
import { Avatar } from '../../components/ProfileCard'

export default function CreatorsDirectory() {
  const insets = useSafeAreaInsets()
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('creators')
      .select('user_id, tagline, created_at, profiles(username, avatar_url, pronouns)')
      .order('created_at', { ascending: false })
    setCreators(data ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const filtered = creators.filter(c =>
    c.profiles?.username?.toLowerCase().includes(search.toLowerCase()) ||
    c.tagline?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Creators',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      {loading ? (
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: colors.abyss }}
          data={filtered}
          keyExtractor={c => c.user_id}
          contentContainerStyle={{ padding: 16, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 48, gap: 10 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 }}>Community</Text>
              <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.text, marginBottom: 4 }}>Creators</Text>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, marginBottom: 14 }}>OPTCG content creators on PirateTracker</Text>
              <TextInput
                placeholder="Search creators..."
                placeholderTextColor={colors.faint}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 32, marginBottom: 12 }}>🎬</Text>
              <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted }}>
                {search ? 'No creators match your search.' : 'No creator pages yet.'}
              </Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity onPress={() => router.push(`/creators/${c.profiles?.username}`)} style={{ ...card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar profile={c.profiles} size={46} rounded />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{c.profiles?.username}</Text>
                {c.tagline ? <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: font.body }}>{c.tagline}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </>
  )
}
