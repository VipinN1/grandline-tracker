import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card, eyebrow, pageHeader } from '../../theme'

const LEADER_COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }
const hasGlass = isLiquidGlassAvailable()

function StatBox({ label, value, accent }) {
  const inner = (
    <>
      <Text style={{ fontFamily: font.mono, fontSize: 22, color: accent ?? colors.text }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: font.semi, color: hasGlass ? colors.muted : colors.faint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 }}>{label}</Text>
    </>
  )
  if (hasGlass) {
    return (
      <GlassView glassEffectStyle="regular" style={{ flex: 1, padding: 14, alignItems: 'center', borderRadius: radius.lg, overflow: 'hidden' }}>
        {inner}
      </GlassView>
    )
  }
  return <View style={{ ...card, flex: 1, padding: 14, alignItems: 'center' }}>{inner}</View>
}

export default function Dashboard() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, date, placement, player_count, wins, losses, leader_name, leader_color, is_practice')
      .eq('user_id', session.user.id)
      .eq('is_practice', false)
      .order('date', { ascending: false })
      .limit(25)
    setTournaments(data ?? [])
    setLoading(false)
  }, [session])

  useEffect(() => { load() }, [load])

  // Refresh when returning to this tab (e.g. after logging or deleting a result).
  useFocusEffect(useCallback(() => { load() }, [load]))

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const totalWins = tournaments.reduce((s, t) => s + (t.wins ?? 0), 0)
  const totalLosses = tournaments.reduce((s, t) => s + (t.losses ?? 0), 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.abyss }}
      data={tournaments}
      keyExtractor={t => t.id}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          <Text style={{ ...eyebrow, marginBottom: 4 }}>⚓ Captain's Log</Text>
          <Text style={{ ...pageHeader, marginBottom: 14 }}>Dashboard</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatBox label="Tournaments" value={tournaments.length} />
            <StatBox label="Record" value={`${totalWins}-${totalLosses}`} />
            <StatBox label="Win Rate" value={`${winRate}%`} accent={winRate >= 50 ? colors.emerald : colors.crimson} />
          </View>
          <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.text, marginTop: 20, marginBottom: 2 }}>Recent Tournaments</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🗺️</Text>
          <Text style={{ fontFamily: font.semi, fontSize: 15, color: colors.textSoft }}>No tournaments logged yet</Text>
          <Text style={{ fontSize: 13, color: colors.faint, marginTop: 6, fontFamily: font.body }}>Use the Log Result tab to record your first event.</Text>
        </View>
      }
      renderItem={({ item: t }) => (
        <TouchableOpacity onPress={() => router.push(`/tournament/${t.id}`)} style={{ ...card, padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.semi, fontSize: 14, color: colors.text }}>{t.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEADER_COLORS[t.leader_color] ?? colors.muted }} />
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, flexShrink: 1 }}>{t.leader_name}</Text>
                <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>· {t.date}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: font.mono, fontSize: 14, color: colors.text }}>{t.wins}-{t.losses}</Text>
              <Text style={{ fontSize: 11, color: colors.gold, fontFamily: font.semi, marginTop: 2 }}>
                #{t.placement}{t.player_count ? ` / ${t.player_count}` : ''}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  )
}
