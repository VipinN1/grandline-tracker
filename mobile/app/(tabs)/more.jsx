import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card } from '../../theme'
import { GlassButton } from '../../components/glass'
import BugReportModal from '../../components/BugReportModal'

function UnreadPill({ count }) {
  if (!count) return null
  return (
    <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.crimson, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
      <Text style={{ color: '#fff', fontSize: 10, fontFamily: font.bold }}>{count > 9 ? '9+' : count}</Text>
    </View>
  )
}

export default function More() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const username = session?.user?.user_metadata?.username ?? 'Captain'
  const [showBugReport, setShowBugReport] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadDMs, setUnreadDMs] = useState(0)
  const [unreadMarket, setUnreadMarket] = useState(0)

  const load = useCallback(async () => {
    if (!session) return
    const uid = session.user.id
    const [profileRes, dmRes, listingRes, wantRes] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', uid).maybeSingle(),
      supabase.from('direct_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', uid).eq('read', false),
      supabase.from('marketplace_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', uid).eq('read', false),
      supabase.from('want_messages').select('id', { count: 'exact', head: true }).eq('receiver_id', uid).eq('read', false),
    ])
    setIsAdmin(profileRes.data?.username === 'Cipin')
    setUnreadDMs(dmRes.count ?? 0)
    setUnreadMarket((listingRes.count ?? 0) + (wantRes.count ?? 0))
  }, [session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  const features = [
    { icon: 'person-circle-outline', label: 'Profile', href: '/profile' },
    { icon: 'people-outline', label: 'Friends', href: '/friends' },
    { icon: 'chatbubbles-outline', label: 'Community', href: '/community', badge: unreadDMs },
    { icon: 'skull-outline', label: 'Bounty Board', href: '/bounty' },
    { icon: 'storefront-outline', label: 'Marketplace', href: '/marketplace', badge: unreadMarket },
    { icon: 'construct-outline', label: 'Deck Builder', href: '/deck-builder' },
    { icon: 'trophy-outline', label: 'Online Tournaments', href: '/tournaments' },
    { icon: 'information-circle-outline', label: 'About', href: '/about' },
    ...(isAdmin ? [{ icon: 'shield-outline', label: 'Bug Reports', href: '/bug-reports' }] : []),
  ]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 }}>
      <View style={{ ...card, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.text }}>{username}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, marginTop: 2 }}>{session?.user?.email}</Text>
      </View>

      <View style={{ ...card, marginBottom: 16 }}>
        {features.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.href)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
              borderBottomWidth: i < features.length - 1 ? 1 : 0, borderBottomColor: colors.line,
            }}
          >
            <Ionicons name={item.icon} size={18} color={colors.gold} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text, fontFamily: font.semi }}>{item.label}</Text>
            <UnreadPill count={item.badge} />
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </TouchableOpacity>
        ))}
      </View>

      <GlassButton onPress={() => setShowBugReport(true)} pad={{ paddingVertical: 13, paddingHorizontal: 16 }} style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.oceanBright }}>🐞 Report a Bug</Text>
      </GlassButton>

      <GlassButton onPress={handleSignOut} pad={{ paddingVertical: 13, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.crimson }}>Sign Out</Text>
      </GlassButton>

      {showBugReport && <BugReportModal page="more" onClose={() => setShowBugReport(false)} />}
    </ScrollView>
  )
}
