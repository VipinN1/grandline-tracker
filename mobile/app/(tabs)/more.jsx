import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { deleteAccount } from '../../lib/api'
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
  const [deleting, setDeleting] = useState(false)

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

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and everything tied to it — profile, tournament history, decklists, posts, messages, listings, and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.prompt('Confirm deletion', 'Type DELETE to permanently delete your account.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Forever',
                style: 'destructive',
                onPress: async (text) => {
                  if ((text ?? '').trim().toUpperCase() !== 'DELETE') {
                    Alert.alert('Not deleted', 'You must type DELETE to confirm.')
                    return
                  }
                  setDeleting(true)
                  try {
                    await deleteAccount(session.access_token)
                    await supabase.auth.signOut()
                    router.replace('/')
                  } catch (err) {
                    Alert.alert('Deletion failed', err.message ?? 'Something went wrong. Please try again.')
                  } finally {
                    setDeleting(false)
                  }
                },
              },
            ])
          },
        },
      ]
    )
  }

  const features = [
    { icon: 'stats-chart-outline', label: 'Stats', href: '/stats' },
    { icon: 'people-outline', label: 'Friends', href: '/friends' },
    { icon: 'chatbubbles-outline', label: 'Community', href: '/community', badge: unreadDMs },
    { icon: 'skull-outline', label: 'Bounty Board', href: '/bounty' },
    { icon: 'storefront-outline', label: 'Marketplace', href: '/marketplace', badge: unreadMarket },
    { icon: 'construct-outline', label: 'Deck Builder', href: '/deck-builder' },
    { icon: 'trophy-outline', label: 'Online Tournaments', href: '/tournaments' },
    { icon: 'information-circle-outline', label: 'About', href: '/about' },
    { icon: 'document-text-outline', label: 'Terms of Service', href: '/terms' },
    { icon: 'lock-closed-outline', label: 'Privacy Policy', href: '/privacy' },
    ...(isAdmin ? [
      { icon: 'shield-outline', label: 'Bug Reports', href: '/bug-reports' },
      { icon: 'flag-outline', label: 'Content Reports', href: '/reports' },
    ] : []),
  ]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 }}>
      <View style={{ ...card, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.text }}>{username}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, marginTop: 2 }}>{session?.user?.email}</Text>
      </View>

      <View style={{ gap: 10, marginBottom: 16 }}>
        {features.map(item => (
          <GlassButton
            key={item.label}
            onPress={() => router.push(item.href)}
            borderRadius={radius.lg}
            pad={{ paddingVertical: 18, paddingHorizontal: 18 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' }}>
              <Ionicons name={item.icon} size={22} color={colors.gold} />
              <Text style={{ flex: 1, fontSize: 16, color: colors.text, fontFamily: font.semi }}>{item.label}</Text>
              <UnreadPill count={item.badge} />
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </View>
          </GlassButton>
        ))}
      </View>

      <GlassButton onPress={() => setShowBugReport(true)} borderRadius={radius.lg} pad={{ paddingVertical: 18, paddingHorizontal: 18 }} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' }}>
          <Text style={{ fontSize: 18 }}>🐞</Text>
          <Text style={{ flex: 1, fontSize: 16, fontFamily: font.semi, color: colors.oceanBright }}>Report a Bug</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </View>
      </GlassButton>

      <GlassButton onPress={handleSignOut} borderRadius={radius.lg} pad={{ paddingVertical: 18, paddingHorizontal: 18 }} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' }}>
          <Ionicons name="log-out-outline" size={22} color={colors.crimson} />
          <Text style={{ flex: 1, fontSize: 16, fontFamily: font.semi, color: colors.crimson }}>Sign Out</Text>
        </View>
      </GlassButton>

      <GlassButton onPress={handleDeleteAccount} disabled={deleting} borderRadius={radius.lg} pad={{ paddingVertical: 18, paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' }}>
          <Ionicons name="trash-outline" size={22} color={colors.crimson} />
          <Text style={{ flex: 1, fontSize: 16, fontFamily: font.semi, color: colors.crimson }}>{deleting ? 'Deleting account…' : 'Delete Account'}</Text>
        </View>
      </GlassButton>

      {showBugReport && <BugReportModal page="more" onClose={() => setShowBugReport(false)} />}
    </ScrollView>
  )
}
