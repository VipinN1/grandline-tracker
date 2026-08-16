// RN port of src/pages/UserProfilePage.jsx — someone else's full profile:
// read-only header/stats, friend actions, message hand-off to Community DMs,
// Tournament History and Leaders Played tabs. Viewing yourself redirects to
// the own-profile screen (same contract as web).
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, useWindowDimensions } from 'react-native'
import { Stack, router, useLocalSearchParams, Redirect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius, card } from '../../theme'
import { LEADER_COLORS, baseCardId } from '../../components/forms'
import { Avatar } from '../../components/ProfileCard'
import { Glass, GlassButton, GlassPills } from '../../components/glass'
import { computeTopStores } from '../../lib/homeStores'

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementColors(n) {
  if (n === 1) return { bg: 'rgba(200,162,74,0.16)', color: colors.gold }
  if (n === 2) return { bg: 'rgba(148,163,184,0.14)', color: '#94a3b8' }
  if (n === 3) return { bg: 'rgba(251,146,60,0.14)', color: '#fb923c' }
  return { bg: 'rgba(140,176,208,0.08)', color: colors.faint }
}

function cleanName(name) {
  if (!name) return ''
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

const screenOpts = {
  headerShown: true,
  title: 'Profile',
  headerStyle: { backgroundColor: '#08101b' },
  headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
  headerTintColor: colors.parchment,
}

export default function UserProfilePage() {
  const { id } = useLocalSearchParams()
  const { session } = useSession()
  const { width: screenW } = useWindowDimensions()
  const [profile, setProfile] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [friendStatus, setFriendStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('history')

  const load = useCallback(async () => {
    const queries = [
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('tournaments').select('*, tournament_rounds(leader_id, leader_name, leader_color)').eq('user_id', id).order('date', { ascending: false }),
    ]
    if (session) {
      queries.push(
        supabase.from('friends').select('*').or(
          `and(user_id.eq.${session.user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${session.user.id})`
        )
      )
    }
    const [{ data: p }, { data: ts }, fRes] = await Promise.all(queries)
    setProfile(p ?? null)
    setTournaments(ts ?? [])
    const rel = fRes?.data?.[0]
    if (rel) {
      if (rel.status === 'accepted') setFriendStatus('accepted')
      else if (rel.user_id === session.user.id) setFriendStatus('pending_sent')
      else setFriendStatus('pending_received')
    } else {
      setFriendStatus(null)
    }
    setLoading(false)
  }, [id, session])

  useEffect(() => { load() }, [load])

  // Viewing your own profile through this route bounces to the real one.
  if (session?.user?.id === id) return <Redirect href="/profile" />

  async function sendFriendRequest() {
    const { error } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: id, status: 'pending' })
    if (!error) setFriendStatus('pending_sent')
  }

  async function acceptRequest() {
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', id).eq('friend_id', session.user.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: id, status: 'accepted' })
    setFriendStatus('accepted')
  }

  async function removeFriend() {
    await supabase.from('friends').delete().or(
      `and(user_id.eq.${session.user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${session.user.id})`
    )
    setFriendStatus(null)
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 14 }}>🏴‍☠️</Text>
          <Text style={{ fontSize: 15, color: colors.muted, fontFamily: font.body }}>This pirate could not be found.</Text>
        </View>
      </>
    )
  }

  const ranked = tournaments.filter(t => !t.is_practice)
  const totalWins = ranked.reduce((s, t) => s + t.wins, 0)
  const totalLosses = ranked.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = ranked.filter(t => t.placement <= 8).length
  const bestFinish = ranked.length > 0 ? Math.min(...ranked.map(t => t.placement)) : null
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  // Leaders played (ranked only), with their tournaments grouped underneath.
  // A tournament counts toward every leader that appeared in it — its main
  // leader plus any leader swapped in for individual rounds.
  // Grouped by base card id, so an alt-art print of a leader is folded into
  // the same group as its base-art print rather than counted separately.
  const leaderGroups = Object.values(ranked.reduce((acc, t) => {
    const leadersHere = new Map([[t.leader_id, { name: t.leader_name, color: t.leader_color }]])
    for (const r of (t.tournament_rounds ?? [])) {
      if (r.leader_id && !leadersHere.has(r.leader_id)) leadersHere.set(r.leader_id, { name: r.leader_name, color: r.leader_color })
    }
    const keysHere = new Set()
    for (const [leaderId, info] of leadersHere) {
      if (!leaderId) continue
      const key = baseCardId(leaderId)
      if (!acc[key]) acc[key] = { id: leaderId, name: info.name, color: info.color, tournaments: [] }
      // A tournament may surface the same base leader twice (e.g. base art
      // as the main leader, alt art swapped in for one round) — only count
      // it once per leader group.
      if (!keysHere.has(key)) { acc[key].tournaments.push(t); keysHere.add(key) }
    }
    return acc
  }, {})).sort((a, b) => b.tournaments.length - a.tournaments.length)

  const favLeader = leaderGroups[0] ?? null
  // Manually picked list wins if set, otherwise the top 3 stores this
  // player logs locals-tier events at.
  const homeStores = profile.home_stores?.length > 0 ? profile.home_stores : computeTopStores(ranked)
  // Web shows fav leader as text on other users' profiles (last word of the
  // cleaned name) — intentional inconsistency with the own-profile image tile.
  const favLeaderText = favLeader ? (cleanName(favLeader.name).split(' ').pop() ?? '—') : '—'

  const FriendButton = () => {
    if (!session) return null
    if (friendStatus === 'accepted') return (
      <GlassButton onPress={removeFriend} pad={{ paddingVertical: 8, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Remove Friend</Text>
      </GlassButton>
    )
    if (friendStatus === 'pending_sent') return (
      <View style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.muted }}>Request Sent</Text>
      </View>
    )
    if (friendStatus === 'pending_received') return (
      <GlassButton onPress={acceptRequest} tint={colors.emerald} pad={{ paddingVertical: 8, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>Accept Request</Text>
      </GlassButton>
    )
    return (
      <GlassButton onPress={sendFriendRequest} tint={colors.ocean} pad={{ paddingVertical: 8, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>+ Add Friend</Text>
      </GlassButton>
    )
  }

  const listData = tab === 'history' ? tournaments : leaderGroups

  return (
    <>
      <Stack.Screen options={{ ...screenOpts, title: profile.username ?? 'Profile' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={listData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            {/* Header card */}
            <View style={{ ...card, padding: 16 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Avatar profile={profile} size={64} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{profile.username}</Text>
                    {profile.pronouns ? <Text style={{ fontSize: 11, color: colors.oceanBright, fontFamily: font.body }}>{profile.pronouns}</Text> : null}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.body }}>
                    {profile.location ? `${profile.location} · ` : ''}{memberSince ? `Since ${memberSince}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {bestFinish === 1 ? (
                      <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(200,162,74,0.14)', borderWidth: 1, borderColor: colors.goldLine }}>
                        <Text style={{ fontSize: 11, fontFamily: font.bold, color: colors.gold }}>🏆 1st Place</Text>
                      </View>
                    ) : null}
                    <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.1)', borderWidth: 1, borderColor: colors.lineStrong }}>
                      <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.oceanBright }}>{ranked.length} Events</Text>
                    </View>
                    <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.06)', borderWidth: 1, borderColor: colors.line }}>
                      <Text style={{ fontSize: 11, fontFamily: font.bold, color: colors.text }}>{winRate}% WR</Text>
                    </View>
                    {topEights > 0 ? (
                      <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(59,178,126,0.1)', borderWidth: 1, borderColor: 'rgba(59,178,126,0.2)' }}>
                        <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.emerald }}>Top 8 ×{topEights}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {profile.bio ? (
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.05)' }}>
                  <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20, fontFamily: font.body }}>{profile.bio}</Text>
                </View>
              ) : null}

              {homeStores.length > 0 ? (
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.05)' }}>
                  <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint, marginBottom: 8 }}>Home Locals</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {homeStores.map(s => (
                      <View key={s.id ?? s.name} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(140,176,208,0.08)', borderWidth: 1, borderColor: colors.lineStrong }}>
                        <Text style={{ fontSize: 11.5, fontFamily: font.semi, color: colors.oceanBright }}>📍 {s.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' }}>
                <FriendButton />
                {session ? (
                  <GlassButton
                    onPress={() => router.push({ pathname: '/community', params: { dm: profile.id } })}
                    pad={{ paddingVertical: 8, paddingHorizontal: 14 }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>💬 Message</Text>
                  </GlassButton>
                ) : null}
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Tournaments', value: String(ranked.length) },
                { label: 'Top 8s', value: String(topEights) },
                { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
                { label: 'Fav. Leader', value: favLeaderText },
              ].map(s => (
                <View key={s.label} style={{ ...card, flexBasis: '45%', flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.muted, marginBottom: 6 }}>{s.label}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 20, fontFamily: font.bold, color: colors.text }}>{s.value}</Text>
                </View>
              ))}
            </View>

            <GlassPills
              items={[
                { key: 'history', label: `History (${tournaments.length})` },
                { key: 'leaders', label: `Leaders (${leaderGroups.length})` },
              ]}
              activeKey={tab}
              onSelect={setTab}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🏆</Text>
            <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted }}>No tournaments logged yet</Text>
          </View>
        }
        renderItem={({ item }) => tab === 'history' ? (
          <TouchableOpacity onPress={() => router.push(`/tournament/${item.id}`)} style={{ ...card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: item.placement === 1 ? 'rgba(200,162,74,0.12)' : 'rgba(140,176,208,0.04)' }}>
              <Text style={{ fontSize: 11, fontFamily: font.bold, color: item.placement === 1 ? colors.gold : colors.faint }}>{placementLabel(item.placement)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: colors.text, flexShrink: 1 }}>{item.name}</Text>
                {item.is_practice ? (
                  <View style={{ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 5, backgroundColor: 'rgba(82,169,205,0.12)', borderWidth: 1, borderColor: 'rgba(82,169,205,0.3)' }}>
                    <Text style={{ fontSize: 8, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.oceanBright }}>Practice</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
                {item.date} · {item.leader_name}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: font.mono }}>
              <Text style={{ color: colors.emerald }}>{item.wins}W</Text>
              <Text style={{ color: colors.faint }}> · </Text>
              <Text style={{ color: colors.crimson }}>{item.losses}L</Text>
            </Text>
          </TouchableOpacity>
        ) : (() => {
          const leaderColor = LEADER_COLORS[item.color] ?? colors.ocean
          const lWins = item.tournaments.reduce((s, t) => s + t.wins, 0)
          const lLosses = item.tournaments.reduce((s, t) => s + t.losses, 0)
          const lWr = lWins + lLosses > 0 ? Math.round((lWins / (lWins + lLosses)) * 100) : null
          // Head-crop art banner, same construction as the own-profile Leaders Played tab.
          const bannerW = screenW - 32
          const imgH = bannerW * 1.4
          return (
            <Glass style={{ borderWidth: 1, borderColor: leaderColor + '40', overflow: 'hidden' }}>
              <View style={{ height: 120, overflow: 'hidden' }}>
                <Image
                  source={{ uri: getCardImageUrl(item.id) }}
                  style={{ position: 'absolute', top: -imgH * 0.11, width: bannerW, height: imgH }}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(6,16,27,0.05)', 'rgba(6,16,27,0.6)', 'rgba(6,16,27,1)']}
                  locations={[0, 0.6, 1]}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: -1 }}
                />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 14 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.display, fontSize: 19, color: colors.text }}>{cleanName(item.name)}</Text>
                    <Text style={{ fontSize: 11.5, color: leaderColor, fontFamily: font.semi, marginTop: 2 }}>
                      {item.tournaments.length} event{item.tournaments.length !== 1 ? 's' : ''}
                      {lWr !== null ? `  ·  ${lWins}W-${lLosses}L  ·  ${lWr}%` : ''}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
                {item.tournaments.map((t, ti) => {
                  const pc = placementColors(t.placement)
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => router.push(`/tournament/${t.id}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 4, borderTopWidth: ti > 0 ? 1 : 0, borderTopColor: 'rgba(140,176,208,0.06)' }}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: pc.bg }}>
                        <Text style={{ fontSize: 10, fontFamily: font.bold, color: pc.color }}>{placementLabel(t.placement)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12.5, fontFamily: font.semi, color: colors.text }}>{t.name}</Text>
                        <Text style={{ fontSize: 10.5, color: colors.faint, marginTop: 1, fontFamily: font.body }}>{t.date}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: font.mono }}>
                        <Text style={{ color: colors.emerald }}>{t.wins}W</Text>
                        <Text style={{ color: colors.faint }}> · </Text>
                        <Text style={{ color: colors.crimson }}>{t.losses}L</Text>
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.faint }}>›</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Glass>
          )
        })()}
      />
    </>
  )
}
