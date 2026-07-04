// Own profile tab — Liquid Glass redesign: hero header with leader-art
// backdrop, single glass stat strip (no duplicated badge chips), glass
// history/leader rows. Compare src/pages/Profile.jsx (web).
import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Modal, Alert, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { pickAndUploadImage } from '../../lib/upload'
import { colors, font, radius, pageHeader } from '../../theme'
import { fieldInput, FieldLabel, LEADER_COLORS } from '../../components/forms'
import { Glass, GlassButton, GlassPills } from '../../components/glass'

function cleanLeaderName(name) {
  if (!name) return ''
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

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

function EditProfileModal({ profile, session, onClose, onSave }) {
  const [usernameInput, setUsernameInput] = useState(profile?.username ?? '')
  const [bioInput, setBioInput] = useState(profile?.bio ?? '')
  const [pronounsInput, setPronounsInput] = useState(profile?.pronouns ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!usernameInput.trim()) return setError('Username cannot be empty')
    setSaving(true)
    const { error: err } = await supabase.from('profiles').update({ username: usernameInput.trim(), bio: bioInput.trim(), pronouns: pronounsInput.trim() }).eq('id', session.user.id)
    if (!err) await supabase.auth.updateUser({ data: { username: usernameInput.trim() } })
    setSaving(false)
    if (err) return setError('Failed to save. Please try again.')
    onSave({ username: usernameInput.trim(), bio: bioInput.trim(), pronouns: pronounsInput.trim() })
    onClose()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#161b27', borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}>
          <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text, marginBottom: 4 }}>Edit Profile</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 20, fontFamily: font.body }}>Update your public profile information</Text>
          <View style={{ gap: 14 }}>
            <View>
              <FieldLabel>Username</FieldLabel>
              <TextInput value={usernameInput} onChangeText={v => { setUsernameInput(v); setError('') }} autoCapitalize="none" style={fieldInput} />
            </View>
            <View>
              <FieldLabel>Pronouns</FieldLabel>
              <TextInput placeholder="e.g. they/them" placeholderTextColor={colors.faint} value={pronounsInput} onChangeText={setPronounsInput} autoCapitalize="none" style={fieldInput} />
            </View>
            <View>
              <FieldLabel>Bio</FieldLabel>
              <TextInput
                value={bioInput}
                onChangeText={setBioInput}
                placeholder="Tell people a bit about yourself..."
                placeholderTextColor={colors.faint}
                multiline
                style={{ ...fieldInput, minHeight: 100, textAlignVertical: 'top' }}
              />
            </View>
          </View>
          {error ? <Text style={{ fontSize: 12, color: colors.crimson, marginTop: 10, fontFamily: font.body }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: saving ? '#3a526a' : colors.ocean, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function Profile() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const { width: screenW } = useWindowDimensions()
  const [profile, setProfile] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState('history')

  const load = useCallback(async () => {
    if (!session) return
    const [{ data: profileData }, { data: tournamentData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('tournaments').select('*').eq('user_id', session.user.id).order('date', { ascending: false }),
    ])
    setProfile(profileData)
    setTournaments(tournamentData ?? [])
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function handleAvatarUpload() {
    try {
      setUploading(true)
      const url = await pickAndUploadImage({ bucket: 'avatars', path: `${session.user.id}/avatar` })
      if (url) {
        const bustUrl = `${url}?t=${Date.now()}`
        await supabase.from('profiles').update({ avatar_url: bustUrl }).eq('id', session.user.id)
        setProfile(prev => ({ ...prev, avatar_url: bustUrl }))
      }
    } catch (e) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload the image.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  const ranked = tournaments.filter(t => !t.is_practice)
  const totalWins = ranked.reduce((s, t) => s + t.wins, 0)
  const totalLosses = ranked.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = ranked.filter(t => t.placement <= 8).length
  const bestFinish = ranked.length > 0 ? Math.min(...ranked.map(t => t.placement)) : null
  const username = profile?.username ?? session?.user?.user_metadata?.username ?? 'Player'
  const initials = username.slice(0, 2).toUpperCase()

  // Leaders played (ranked only) with their tournaments grouped underneath —
  // powers both the hero backdrop / fav leader and the Leaders Played tab.
  const leaderGroups = Object.values(ranked.reduce((acc, t) => {
    if (!t.leader_id) return acc
    if (!acc[t.leader_id]) acc[t.leader_id] = { id: t.leader_id, name: t.leader_name, color: t.leader_color, tournaments: [] }
    acc[t.leader_id].tournaments.push(t)
    return acc
  }, {})).sort((a, b) => b.tournaments.length - a.tournaments.length)
  const favLeader = leaderGroups[0] ?? null

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  const stats = [
    { label: 'Events', value: String(ranked.length), color: colors.text },
    { label: 'Win Rate', value: `${winRate}%`, color: colors.gold },
    { label: 'Top 8s', value: String(topEights), color: colors.emerald },
    { label: 'Best', value: bestFinish ? placementLabel(bestFinish) : '—', color: bestFinish === 1 ? colors.gold : colors.oceanBright },
  ]

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={tab === 'history' ? tournaments : leaderGroups}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 90, gap: 9 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            {/* Page header */}
            <Text style={{ ...pageHeader, fontSize: 30, lineHeight: 34 }}>Profile</Text>

            {/* Hero — fav leader art backdrop behind glass identity card */}
            <Glass style={{ overflow: 'hidden' }}>
              {favLeader ? (
                <>
                  <Image
                    source={{ uri: getCardImageUrl(favLeader.id) }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240 }}
                    resizeMode="cover"
                    blurRadius={6}
                  />
                  <LinearGradient
                    colors={['rgba(6,16,27,0.55)', 'rgba(6,16,27,0.82)', 'rgba(6,16,27,0.97)']}
                    locations={[0, 0.5, 1]}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 241 }}
                  />
                </>
              ) : null}

              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <TouchableOpacity onPress={handleAvatarUpload} disabled={uploading} style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: profile?.avatar_url ? 'transparent' : colors.ocean, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(233,241,248,0.18)' }}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 24, fontFamily: font.bold, color: '#fff' }}>{uploading ? '...' : initials}</Text>
                    )}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: font.display, fontSize: 24, color: colors.text }}>{username}</Text>
                      {bestFinish === 1 ? <Text style={{ fontSize: 16 }}>🏆</Text> : null}
                    </View>
                    {profile?.pronouns ? <Text style={{ fontSize: 12, color: colors.oceanBright, marginTop: 1, fontFamily: font.body }}>{profile.pronouns}</Text> : null}
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
                      {profile?.location ? `${profile.location} · ` : ''}{memberSince ? `Since ${memberSince}` : ''}
                    </Text>
                  </View>

                  {favLeader ? (
                    <Image
                      source={{ uri: getCardImageUrl(favLeader.id) }}
                      style={{ width: 46, height: 64, borderRadius: 6, borderWidth: 1.5, borderColor: (LEADER_COLORS[favLeader.color] ?? '#94a3b8') + '88' }}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>

                {profile?.bio ? (
                  <Text style={{ fontSize: 13, color: colors.textSoft, lineHeight: 20, fontFamily: font.body, marginTop: 14 }}>
                    {profile.bio}
                  </Text>
                ) : null}

                <GlassButton onPress={() => setEditing(true)} effect="clear" pad={{ paddingVertical: 9, paddingHorizontal: 18 }} style={{ alignSelf: 'flex-start', marginTop: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.text }}>Edit Profile</Text>
                </GlassButton>
              </View>
            </Glass>

            {/* Stat strip */}
            <Glass style={{ flexDirection: 'row' }}>
              {stats.map((s, i) => (
                <View key={s.label} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: 'rgba(140,176,208,0.08)' }}>
                  <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.faint, marginBottom: 5 }}>{s.label}</Text>
                  <Text style={{ fontSize: 19, fontFamily: font.mono, color: s.color }}>{s.value}</Text>
                </View>
              ))}
            </Glass>

            <GlassPills
              style={{ marginTop: 2, justifyContent: 'center', gap: 10 }}
              pad={{ paddingVertical: 14, paddingHorizontal: 22 }}
              textSize={14}
              items={[
                { key: 'history', label: `History (${tournaments.length})` },
                { key: 'leaders', label: `Leaders Played (${leaderGroups.length})` },
              ]}
              activeKey={tab}
              onSelect={setTab}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🏆</Text>
            <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted, marginBottom: 6 }}>No tournaments logged yet</Text>
            <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>Head to Log Result to record your first event</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (tab === 'leaders') {
            const leaderColor = LEADER_COLORS[item.color] ?? colors.ocean
            const lWins = item.tournaments.reduce((s, t) => s + t.wins, 0)
            const lLosses = item.tournaments.reduce((s, t) => s + t.losses, 0)
            const lWr = lWins + lLosses > 0 ? Math.round((lWins / (lWins + lLosses)) * 100) : null
            // Head-crop art banner, same construction as the decklist cards.
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
                      <Text numberOfLines={1} style={{ fontFamily: font.display, fontSize: 19, color: colors.text }}>{cleanLeaderName(item.name)}</Text>
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
          }
          const t = item
          const pc = placementColors(t.placement)
          return (
            <TouchableOpacity onPress={() => router.push(`/tournament/${t.id}`)}>
              <Glass style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View style={{ width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: pc.bg }}>
                  <Text style={{ fontSize: 11, fontFamily: font.bold, color: pc.color }}>{placementLabel(t.placement)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontFamily: font.semi, color: colors.text, flexShrink: 1 }}>{t.name}</Text>
                    {t.is_practice ? (
                      <View style={{ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 5, backgroundColor: 'rgba(82,169,205,0.14)', borderWidth: 1, borderColor: 'rgba(82,169,205,0.3)' }}>
                        <Text style={{ fontSize: 8, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.oceanBright }}>Practice</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: font.body }}>
                    {t.date} · {cleanLeaderName(t.leader_name)}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: font.mono }}>
                  <Text style={{ color: colors.emerald }}>{t.wins}W</Text>
                  <Text style={{ color: colors.faint }}> · </Text>
                  <Text style={{ color: colors.crimson }}>{t.losses}L</Text>
                </Text>
              </Glass>
            </TouchableOpacity>
          )
        }}
      />
      {editing && (
        <EditProfileModal
          profile={profile}
          session={session}
          onClose={() => setEditing(false)}
          onSave={({ username: u, bio, pronouns }) => setProfile(prev => ({ ...prev, username: u, bio, pronouns }))}
        />
      )}
    </>
  )
}
