// Dashboard — RN port of src/pages/Dashboard.jsx: stat tiles, placement
// trend, leader usage donut, win rate by leader, recent results. Cards use
// iOS 26 Liquid Glass when available.
import { useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, eyebrow, pageHeader } from '../../theme'
import { Glass, GlassButton } from '../../components/glass'
import { PlacementTrendChart, LeaderDonut, LeaderDot, WinRateBar, leaderColorList } from '../../components/charts'

const TOP_LEADERS_LIMIT = 3

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementStyle(n) {
  if (n === 1) return { backgroundColor: 'rgba(220,179,94,0.14)', color: colors.gold, borderColor: 'rgba(200,162,74,0.34)' }
  if (n === 2) return { backgroundColor: 'rgba(157,178,198,0.12)', color: '#b9c7d6', borderColor: 'rgba(157,178,198,0.26)' }
  if (n === 3) return { backgroundColor: 'rgba(224,138,60,0.12)', color: colors.orange, borderColor: 'rgba(224,138,60,0.3)' }
  return { backgroundColor: 'rgba(140,176,208,0.06)', color: colors.faint, borderColor: colors.line }
}

function stripAltArt(name) {
  return (name ?? '').replace(/\s*\([^)]*\)$/, '').trim()
}

function StatTile({ label, value, sub, gold }) {
  return (
    <Glass style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.9, color: colors.muted, marginBottom: 10 }}>{label}</Text>
      <Text style={gold
        ? { fontFamily: font.mono, fontSize: 28, letterSpacing: -1, color: colors.gold }
        : { fontFamily: font.display, fontSize: 26, letterSpacing: -0.5, color: colors.text }}>
        {value}
      </Text>
      {sub ? <Text style={{ fontSize: 11, color: colors.faint, marginTop: 6, fontFamily: font.body }}>{sub}</Text> : null}
    </Glass>
  )
}

function ChartCard({ title, action, children }) {
  return (
    <Glass style={{ padding: 18, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold }}>{title}</Text>
        {action}
      </View>
      {children}
    </Glass>
  )
}

function EmptyChart({ message }) {
  return (
    <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>{message}</Text>
    </View>
  )
}

export default function Dashboard() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAllLeaders, setShowAllLeaders] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, date, placement, player_count, wins, losses, leader_id, leader_name, leader_color, is_practice')
      .eq('user_id', session.user.id)
      .eq('is_practice', false)
      .order('date', { ascending: false })
    setTournaments(data ?? [])
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // ── Aggregates (mirrors web Dashboard) ──────────────────────────────────────
  const totalWins = tournaments.reduce((s, t) => s + (t.wins ?? 0), 0)
  const totalLosses = tournaments.reduce((s, t) => s + (t.losses ?? 0), 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = tournaments.filter(t => t.placement <= 8).length
  const bestFinish = tournaments.length > 0 ? Math.min(...tournaments.map(t => t.placement)) : null
  const totalEvents = tournaments.length

  const placementOverTime = [...tournaments].reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    placement: t.placement,
  }))

  const leaderUsage = Object.values(
    tournaments.reduce((acc, t) => {
      if (!acc[t.leader_id]) {
        const primary = leaderColorList(t.leader_color)[0] ?? colors.ocean
        acc[t.leader_id] = { id: t.leader_id, fullName: t.leader_name, leaderColor: t.leader_color, color: primary, count: 0, wins: 0, losses: 0 }
      }
      acc[t.leader_id].count++
      acc[t.leader_id].wins += t.wins
      acc[t.leader_id].losses += t.losses
      return acc
    }, {})
  ).map(l => ({ ...l, wr: l.wins + l.losses > 0 ? Math.round((l.wins / (l.wins + l.losses)) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  const donutLeaders = leaderUsage.slice(0, 6)
  const donutTotal = donutLeaders.reduce((s, l) => s + l.count, 0)
  const displayedLeaders = showAllLeaders ? leaderUsage : leaderUsage.slice(0, TOP_LEADERS_LIMIT)
  const recentResults = tournaments.slice(0, 5)

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.abyss }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* Header */}
      <View style={{ marginBottom: 18 }}>
        <Text style={{ ...eyebrow, marginBottom: 4 }}>⚓ Captain's Log</Text>
        <Text style={{ ...pageHeader, fontSize: 30, lineHeight: 34, marginBottom: 4 }}>Dashboard</Text>
        <Text style={{ fontSize: 14, color: colors.muted, fontFamily: font.body }}>Your competitive performance at a glance</Text>
      </View>

      {/* Stat tiles — 2×2 */}
      <View style={{ gap: 10, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile label="Win Rate" value={totalEvents > 0 ? `${winRate}%` : '—'} gold />
          <StatTile label="Tournaments" value={totalEvents} sub={totalEvents > 0 ? `${topEights} top 8` : null} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile label="Best Finish" value={bestFinish ? placementLabel(bestFinish) : '—'} />
          <StatTile label="Record" value={totalEvents > 0 ? `${totalWins}–${totalLosses}` : '—'} />
        </View>
      </View>

      {totalEvents === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 70 }}>
          <Text style={{ fontSize: 40, marginBottom: 14 }}>🧭</Text>
          <Text style={{ fontSize: 16, fontFamily: font.display, color: colors.textSoft, marginBottom: 6 }}>No data yet</Text>
          <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body, marginBottom: 16 }}>Log your first tournament to start seeing stats</Text>
          <TouchableOpacity onPress={() => router.push('/log')}>
            <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.gold }}>→ Log a result</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Placement trend */}
          <ChartCard title="Placement Trend">
            {placementOverTime.length < 2
              ? <EmptyChart message="Need at least 2 events" />
              : <PlacementTrendChart data={placementOverTime} />}
          </ChartCard>

          {/* Leader usage donut */}
          <ChartCard title="Leader Usage">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <LeaderDonut leaders={donutLeaders} />
              <View style={{ flex: 1, gap: 8 }}>
                {donutLeaders.map(l => (
                  <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <LeaderDot leaderColor={l.leaderColor} />
                    <Text numberOfLines={2} style={{ flex: 1, fontSize: 12, fontFamily: font.semi, color: colors.text }}>{stripAltArt(l.fullName)}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>{l.count}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, minWidth: 32, textAlign: 'right' }}>{Math.round(l.count / donutTotal * 100)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </ChartCard>

          {/* Win rate by leader */}
          <ChartCard
            title="Win Rate by Leader"
            action={leaderUsage.length > TOP_LEADERS_LIMIT ? (
              <TouchableOpacity onPress={() => setShowAllLeaders(v => !v)} hitSlop={8}>
                <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.gold }}>
                  {showAllLeaders ? '▲ Show less' : `▼ Show all (${leaderUsage.length})`}
                </Text>
              </TouchableOpacity>
            ) : null}
          >
            <View style={{ gap: 14 }}>
              {displayedLeaders.map(l => (
                <View key={l.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 6 }}>
                    <Text style={{ flex: 1, fontSize: 12.5, fontFamily: font.semi, color: colors.text }}>{l.fullName}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>{l.count} event{l.count !== 1 ? 's' : ''}</Text>
                    <Text style={{ fontSize: 12, fontFamily: font.mono, color: l.color, minWidth: 38, textAlign: 'right' }}>{l.wr}%</Text>
                  </View>
                  <WinRateBar pct={l.wr} />
                </View>
              ))}
            </View>
          </ChartCard>

          {/* Recent results */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, color: colors.gold, textTransform: 'uppercase', letterSpacing: 1 }}>Recent Results</Text>
            <GlassButton onPress={() => router.push('/log')} tint={colors.gold} pad={{ paddingVertical: 9, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.onAccent }}>+ Log Result</Text>
            </GlassButton>
          </View>

          <View style={{ gap: 9 }}>
            {recentResults.map(t => {
              const ps = placementStyle(t.placement)
              return (
                <TouchableOpacity key={t.id} onPress={() => router.push(`/tournament/${t.id}`)}>
                  <Glass style={{ padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: ps.backgroundColor, borderColor: ps.borderColor }}>
                      <Text style={{ fontSize: 11, fontFamily: font.bold, color: ps.color }}>{placementLabel(t.placement)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontFamily: font.semi, color: colors.text }}>{t.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: leaderColorList(t.leader_color)[0] ?? colors.muted }} />
                        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, fontFamily: font.body, flexShrink: 1 }}>
                          {t.date}{t.player_count ? ` · ${t.player_count} players` : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: font.mono }}>
                      <Text style={{ color: colors.emerald }}>{t.wins}W</Text>
                      <Text style={{ color: colors.faint }}> · </Text>
                      <Text style={{ color: colors.crimson }}>{t.losses}L</Text>
                    </Text>
                  </Glass>
                </TouchableOpacity>
              )
            })}
          </View>
        </>
      )}
    </ScrollView>
  )
}
