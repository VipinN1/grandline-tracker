import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card } from '../../theme'
import { GlassButton } from '../../components/glass'

const FEATURES = [
  { icon: 'person-circle-outline', label: 'Profile', href: '/profile' },
  { icon: 'people-outline', label: 'Friends', href: '/friends' },
  { icon: 'chatbubbles-outline', label: 'Community', href: '/community' },
  { icon: 'skull-outline', label: 'Bounty Board', href: '/bounty' },
  { icon: 'storefront-outline', label: 'Marketplace', href: '/marketplace' },
  { icon: 'construct-outline', label: 'Deck Builder', href: '/deck-builder' },
  { icon: 'trophy-outline', label: 'Online Tournaments', href: '/tournaments' },
]

export default function More() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const username = session?.user?.user_metadata?.username ?? 'Captain'

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 }}>
      <View style={{ ...card, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.text }}>{username}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, marginTop: 2 }}>{session?.user?.email}</Text>
      </View>

      <View style={{ ...card, marginBottom: 16 }}>
        {FEATURES.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.href)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
              borderBottomWidth: i < FEATURES.length - 1 ? 1 : 0, borderBottomColor: colors.line,
            }}
          >
            <Ionicons name={item.icon} size={18} color={colors.gold} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text, fontFamily: font.semi }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </TouchableOpacity>
        ))}
      </View>

      <GlassButton onPress={handleSignOut} pad={{ paddingVertical: 13, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.crimson }}>Sign Out</Text>
      </GlassButton>
    </ScrollView>
  )
}
