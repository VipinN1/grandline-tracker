// RN port of src/pages/BountyBoard.jsx — same bounty formula and rankings.
import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, ScrollView } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { getCardImageUrl } from '../lib/optcgapi'
import { colors, font, radius, card } from '../theme'
import { LEADER_COLORS } from '../components/forms'
import ProfileCard, { Avatar } from '../components/ProfileCard'

function formatBounty(n) {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(2)}B`
  return `฿${n.toLocaleString()}`
}

function placementBonus(p) {
  if (p === 1) return 1_000_000
  if (p === 2) return 500_000
  if (p === 3) return 300_000
  if (p === 4) return 200_000
  if (p <= 8) return 100_000
  if (p <= 16) return 50_000
  return 0
}

function calcTournamentBounty(wins, losses, placement) {
  return Math.max(0, wins * 100_000 - losses * 50_000 + placementBonus(placement))
}

function rankDisplay(rank) {
  if (rank === 1) return { label: '🥇', color: colors.gold }
  if (rank === 2) return { label: '🥈', color: '#94a3b8' }
  if (rank === 3) return { label: '🥉', color: '#fb923c' }
  return { label: `#${rank}`, color: colors.faint }
}

function cleanName(name) {
  if (!name) return 'Unknown'
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

export default function BountyBoard() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournaments')
        .select('id, user_id, name, date, placement, wins, losses, leader_id, leader_name, leader_color, profiles(id, username, avatar_url, location, bio)')
        .eq('is_practice', false)
        .order('date', { ascending: false })
      setTournaments(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Bounty Board', headerStyle: { backgroundColor: '#08101b' }, headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment }, headerTintColor: colors.parchment }} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  // Meta — last 30 days
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthAgoStr = monthAgo.toISOString().split('T')[0]
  const playMap = {}
  tournaments.filter(t => t.date >= monthAgoStr).forEach(t => {
    if (!t.leader_id) return
    if (!playMap[t.leader_id]) playMap[t.leader_id] = { id: t.leader_id, name: t.leader_name, color: t.leader_color, count: 0 }
    playMap[t.leader_id].count++
  })
  const topWeekly = Object.values(playMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxWeeklyCount = topWeekly[0]?.count ?? 1

  // Top leaders by win rate — minimum 3 tournament appearances to qualify,
  // so tiny samples don't distort the list (same rule as web).
  const leaderAgg = {}
  tournaments.forEach(t => {
    if (!t.leader_id) return
    if (!leaderAgg[t.leader_id]) leaderAgg[t.leader_id] = { id: t.leader_id, name: t.leader_name, color: t.leader_color, appearances: 0, wins: 0, losses: 0 }
    const l = leaderAgg[t.leader_id]
    l.appearances++
    l.wins += t.wins
    l.losses += t.losses
  })
  const topByWinRate = Object.values(leaderAgg)
    .filter(l => l.appearances >= 3 && l.wins + l.losses > 0)
    .map(l => ({ ...l, wr: Math.round((l.wins / (l.wins + l.losses)) * 100) }))
    .sort((a, b) => b.wr - a.wr)
    .slice(0, 5)

  const recentResults = tournaments.slice(0, 8)

  // Leaderboard
  const playerMap = {}
  tournaments.forEach(t => {
    if (!t.user_id) return
    if (!playerMap[t.user_id]) {
      playerMap[t.user_id] = {
        user_id: t.user_id,
        profile: t.profiles,
        bounty: 0, wins: 0, losses: 0, tournaments: 0, leaders: {},
      }
    }
    const p = playerMap[t.user_id]
    p.bounty += calcTournamentBounty(t.wins, t.losses, t.placement)
    p.wins += t.wins
    p.losses += t.losses
    p.tournaments++
    if (t.leader_id) p.leaders[t.leader_id] = (p.leaders[t.leader_id] || 0) + 1
  })
  const leaderboard = Object.values(playerMap)
    .sort((a, b) => b.bounty - a.bounty)
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      topLeader: Object.entries(p.leaders).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
  const myEntry = session ? leaderboard.find(p => p.user_id === session.user.id) : null

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '☠ Bounty Board', headerStyle: { backgroundColor: '#08101b' }, headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment }, headerTintColor: colors.parchment }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={leaderboard}
        keyExtractor={p => p.user_id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View>
              <Text style={{ fontFamily: font.display, fontSize: 24, color: colors.text, marginBottom: 6 }}>Wanted Dead or Alive</Text>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>
                <Text style={{ color: colors.oceanBright, fontFamily: font.bold }}>{leaderboard.length}</Text> pirates tracked ·{' '}
                <Text style={{ color: colors.oceanBright, fontFamily: font.bold }}>{tournaments.length}</Text> tournaments logged
                {myEntry ? (
                  <Text>  ·  Your rank: <Text style={{ color: colors.gold, fontFamily: font.bold }}>#{myEntry.rank}</Text> <Text style={{ color: colors.gold, fontFamily: font.bold }}>{formatBounty(myEntry.bounty)}</Text></Text>
                ) : null}
              </Text>
            </View>

            {/* Bounty formula */}
            <View style={{ backgroundColor: 'rgba(200,162,74,0.04)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.15)', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold, marginBottom: 8 }}>Bounty Formula</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {[
                  ['Win', '+฿100,000', colors.emerald],
                  ['Loss', '−฿50,000', colors.crimson],
                  ['1st', '+฿1,000,000', colors.gold],
                  ['2nd', '+฿500,000', colors.emerald],
                  ['Top 4', '+฿200–300K', colors.emerald],
                  ['Top 8', '+฿100,000', colors.emerald],
                ].map(([label, value, color]) => (
                  <Text key={label} style={{ fontSize: 10, color: colors.faint, fontFamily: font.body }}>
                    {label} <Text style={{ fontSize: 11, fontFamily: font.mono, color }}>{value}</Text>
                  </Text>
                ))}
              </View>
            </View>

            {/* Meta — last 30 days */}
            <View style={{ ...card, padding: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.muted, marginBottom: 14 }}>
                Meta — Last 30 Days
              </Text>
              {topWeekly.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.faint, textAlign: 'center', paddingVertical: 16, fontFamily: font.body }}>No activity in the last 30 days</Text>
              ) : topWeekly.map(l => (
                <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Image source={{ uri: getCardImageUrl(l.id) }} style={{ width: 28, height: 38, borderRadius: 4 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: font.semi, color: colors.text }}>{cleanName(l.name)}</Text>
                    <View style={{ marginTop: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(140,176,208,0.05)' }}>
                      <View style={{ height: '100%', borderRadius: 2, width: `${(l.count / maxWeeklyCount) * 100}%`, backgroundColor: LEADER_COLORS[l.color] ?? colors.ocean }} />
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: font.bold, color: LEADER_COLORS[l.color] ?? colors.ocean, minWidth: 20, textAlign: 'right' }}>{l.count}</Text>
                </View>
              ))}
            </View>

            {/* Top leaders by win rate */}
            <View style={{ ...card, padding: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.muted, marginBottom: 14 }}>
                Top Leaders by Win Rate
              </Text>
              {topByWinRate.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.faint, textAlign: 'center', paddingVertical: 16, fontFamily: font.body }}>
                  Not enough data yet (min 3 events per leader)
                </Text>
              ) : topByWinRate.map(l => (
                <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Image source={{ uri: getCardImageUrl(l.id) }} style={{ width: 28, height: 38, borderRadius: 4 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: font.semi, color: colors.text }}>{cleanName(l.name)}</Text>
                    <Text style={{ fontSize: 10, color: colors.faint, marginTop: 2, fontFamily: font.body }}>
                      {l.appearances} events · {l.wins}W-{l.losses}L
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: font.mono, color: colors.emerald }}>{l.wr}%</Text>
                </View>
              ))}
            </View>

            {/* Recent results */}
            <View style={{ ...card, padding: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.muted, marginBottom: 14 }}>
                Recent Results
              </Text>
              {recentResults.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.faint, textAlign: 'center', paddingVertical: 16, fontFamily: font.body }}>No results yet</Text>
              ) : recentResults.map(t => (
                <TouchableOpacity key={t.id} onPress={() => t.user_id && router.push(`/user/${t.user_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Image source={{ uri: getCardImageUrl(t.leader_id) }} style={{ width: 28, height: 38, borderRadius: 4 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: font.semi, color: colors.text }}>
                      {t.profiles?.username ?? 'Unknown'} · #{t.placement}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 10, color: colors.faint, marginTop: 2, fontFamily: font.body }}>
                      {t.name} · {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: font.mono }}>
                    <Text style={{ color: colors.emerald }}>{t.wins}W</Text>
                    <Text style={{ color: colors.faint }}>·</Text>
                    <Text style={{ color: colors.crimson }}>{t.losses}L</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.text }}>Bounty Rankings</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ padding: 40, textAlign: 'center', fontSize: 13, color: colors.faint, fontFamily: font.body }}>
            No pirates found — log some tournaments!
          </Text>
        }
        renderItem={({ item: p }) => {
          const rd = rankDisplay(p.rank)
          const isMe = session?.user?.id === p.user_id
          return (
            <TouchableOpacity
              onPress={() => p.profile && setSelectedProfile(p.profile)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 12, paddingHorizontal: 12,
                borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)',
                backgroundColor: isMe ? 'rgba(200,162,74,0.05)' : 'transparent',
                borderRadius: isMe ? radius.sm : 0,
              }}
            >
              <View style={{ width: 34, alignItems: 'center' }}>
                <Text style={{ fontSize: p.rank <= 3 ? 18 : 12, fontFamily: font.mono, color: rd.color }}>{rd.label}</Text>
              </View>
              <Avatar profile={p.profile} size={30} rounded />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: isMe ? colors.gold : colors.text, flexShrink: 1 }}>
                    {p.profile?.username ?? 'Unknown'}
                  </Text>
                  {isMe ? (
                    <View style={{ paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4, backgroundColor: 'rgba(200,162,74,0.15)', borderWidth: 1, borderColor: colors.goldLine }}>
                      <Text style={{ fontSize: 8, fontFamily: font.bold, color: colors.gold, letterSpacing: 0.5 }}>YOU</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, color: colors.faint, marginTop: 1, fontFamily: font.body }}>
                  {p.tournaments} event{p.tournaments !== 1 ? 's' : ''} ·{' '}
                  <Text style={{ fontFamily: font.mono }}>
                    <Text style={{ color: colors.emerald }}>{p.wins}W</Text>·<Text style={{ color: colors.crimson }}>{p.losses}L</Text>
                  </Text>
                </Text>
              </View>
              {p.topLeader ? (
                <Image source={{ uri: getCardImageUrl(p.topLeader) }} style={{ width: 26, height: 36, borderRadius: 4 }} resizeMode="cover" />
              ) : null}
              <Text style={{ fontSize: 13, fontFamily: font.mono, color: colors.gold }}>{formatBounty(p.bounty)}</Text>
            </TouchableOpacity>
          )
        }}
      />
      {selectedProfile && <ProfileCard profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} />}
    </>
  )
}
