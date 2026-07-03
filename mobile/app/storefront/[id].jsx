// Buyer-facing storefront page: store info, searchable inventory, message the
// store. Inventory management (add/edit/CSV import) stays on the website.
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Linking } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card } from '../../theme'
import { fieldInput } from '../../components/forms'
import { ConditionBadge, ChatModal, cardArtUrl } from '../../components/market/shared'

export default function StorefrontPage() {
  const { id } = useLocalSearchParams()
  const { session } = useSession()
  const [store, setStore] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: storeData }, { data: inv }] = await Promise.all([
        supabase.from('storefronts').select('*').eq('id', id).single(),
        supabase.from('store_inventory').select('*').eq('storefront_id', id).eq('status', 'active').order('created_at', { ascending: false }),
      ])
      setStore(storeData)
      setInventory(inv ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Storefront', headerStyle: { backgroundColor: '#08101b' }, headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment }, headerTintColor: colors.parchment }} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (!store) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Storefront', headerStyle: { backgroundColor: '#08101b' }, headerTintColor: colors.parchment }} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.muted, fontFamily: font.body }}>Store not found.</Text>
        </View>
      </>
    )
  }

  const isOwner = session?.user?.id === store.user_id
  const filtered = inventory.filter(i =>
    !search ||
    i.card_name.toLowerCase().includes(search.toLowerCase()) ||
    i.card_id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: store.store_name,
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            {/* Store header */}
            <View style={{ ...card, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(140,176,208,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.goldLine }}>
                  {store.logo_url ? <Image source={{ uri: store.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 28 }}>🏪</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{store.store_name}</Text>
                  {store.address ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.body }}>📍 {store.address}</Text> : null}
                  {store.contact_info ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: font.body }}>☎ {store.contact_info}</Text> : null}
                  {store.website_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(store.website_url).catch(() => {})}>
                      <Text style={{ fontSize: 12, color: colors.oceanBright, marginTop: 2, fontFamily: font.semi }}>{store.website_url}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {!isOwner && session ? (
                <TouchableOpacity onPress={() => setShowChat(true)} style={{ marginTop: 14, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.ocean, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>Message Store</Text>
                </TouchableOpacity>
              ) : null}
              {isOwner ? (
                <Text style={{ marginTop: 12, fontSize: 11, color: colors.faint, fontFamily: font.body }}>
                  This is your store. Manage inventory (add cards, CSV import) on the website.
                </Text>
              ) : null}
            </View>

            <TextInput
              placeholder={`Search ${inventory.length} cards...`}
              placeholderTextColor={colors.faint}
              value={search}
              onChangeText={setSearch}
              style={fieldInput}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🃏</Text>
            <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted }}>
              {search ? 'No cards match your search' : 'No inventory listed yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, padding: 10 }}>
            <Image source={{ uri: cardArtUrl(item.card_id) }} style={{ width: 40, height: 56, borderRadius: 6 }} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>
                {item.card_name}{item.quantity > 1 ? ` x${item.quantity}` : ''}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono, marginTop: 2 }}>
                {item.card_id}{item.set_name ? `  ·  ${item.set_name}` : ''}
              </Text>
              <View style={{ marginTop: 4 }}><ConditionBadge condition={item.condition} /></View>
            </View>
            <Text style={{ fontSize: 15, fontFamily: font.mono, color: colors.text }}>${Number(item.price).toFixed(2)}</Text>
          </View>
        )}
      />
      {showChat && (
        <ChatModal
          visible
          onClose={() => setShowChat(false)}
          table="storefront_messages"
          contextField="storefront_id"
          contextId={store.id}
          bodyField="content"
          currentUserId={session.user.id}
          receiverId={store.user_id}
          headerTitle={store.store_name}
          headerSubtitle="Storefront chat"
          headerImageUri={store.logo_url}
        />
      )}
    </>
  )
}
