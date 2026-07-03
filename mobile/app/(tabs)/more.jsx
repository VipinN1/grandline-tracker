import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card } from '../../theme'

const UPCOMING = [
  { icon: 'radio-outline', label: 'Live Tournament' },
  { icon: 'people-outline', label: 'Friends' },
  { icon: 'chatbubbles-outline', label: 'Community' },
  { icon: 'trophy-outline', label: 'Tournaments' },
  { icon: 'storefront-outline', label: 'Marketplace' },
  { icon: 'construct-outline', label: 'Deck Builder' },
  { icon: 'skull-outline', label: 'Bounty Board' },
  { icon: 'person-circle-outline', label: 'Profile' },
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

      <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        Coming soon
      </Text>
      <View style={{ ...card, marginBottom: 16 }}>
        {UPCOMING.map((item, i) => (
          <View
            key={item.label}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
              borderBottomWidth: i < UPCOMING.length - 1 ? 1 : 0, borderBottomColor: colors.line, opacity: 0.55,
            }}
          >
            <Ionicons name={item.icon} size={18} color={colors.muted} />
            <Text style={{ fontSize: 14, color: colors.textSoft, fontFamily: font.body }}>{item.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleSignOut}
        style={{ borderWidth: 1, borderColor: 'rgba(210,74,58,0.34)', borderRadius: radius.sm, padding: 13, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.crimson }}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
