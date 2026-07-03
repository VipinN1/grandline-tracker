import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Modal, Alert } from 'react-native'
import { Stack, router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { getCardImageUrl } from '../lib/optcgapi'
import { pickAndUploadImage } from '../lib/upload'
import { colors, font, radius, card } from '../theme'
import { fieldInput, FieldLabel, LEADER_COLORS } from '../components/forms'
import { GlassButton, GlassPills } from '../components/glass'

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
  if (n === 1) return { bg: 'rgba(200,162,74,0.12)', color: colors.gold }
  if (n === 2) return { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
  if (n === 3) return { bg: 'rgba(251,146,60,0.1)', color: '#fb923c' }
  return { bg: 'rgba(140,176,208,0.04)', color: colors.faint }
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
  // powers both the Fav. Leader tile and the Leaders Played tab.
  const leaderGroups = Object.values(ranked.reduce((acc, t) => {
    if (!t.leader_id) return acc
    if (!acc[t.leader_id]) acc[t.leader_id] = { id: t.leader_id, name: t.leader_name, color: t.leader_color, tournaments: [] }
    acc[t.leader_id].tournaments.push(t)
    return acc
  }, {})).sort((a, b) => b.tournaments.length - a.tournaments.length)
  const favLeaderId = leaderGroups[0]?.id ?? null

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Profile',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={tab === 'history' ? tournaments : leaderGroups}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            {/* Header card */}
            <View style={{ ...card, padding: 16 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity onPress={handleAvatarUpload} disabled={uploading} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: profile?.avatar_url ? 'transparent' : colors.ocean, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(140,176,208,0.1)' }}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 22, fontFamily: font.bold, color: '#fff' }}>{uploading ? '...' : initials}</Text>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{username}</Text>
                    {profile?.pronouns ? <Text style={{ fontSize: 11, color: colors.oceanBright, fontFamily: font.body }}>{profile.pronouns}</Text> : null}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.body }}>
                    {profile?.location ? `${profile.location} · ` : ''}{memberSince ? `Since ${memberSince}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {bestFinish === 1 ? (
                      <View style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(200,162,74,0.14)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.34)' }}>
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
                  <GlassButton onPress={() => setEditing(true)} tint={colors.ocean} pad={{ paddingVertical: 5, paddingHorizontal: 12 }} style={{ alignSelf: 'flex-start', marginTop: 10 }}>
                    <Text style={{ fontSize: 11, fontFamily: font.semi, color: '#fff' }}>Edit Profile</Text>
                  </GlassButton>
                </View>
              </View>
              <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.05)' }}>
                <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted, marginBottom: 6 }}>Bio</Text>
                <Text style={{ fontSize: 13, color: profile?.bio ? colors.text : colors.faint, lineHeight: 20, fontFamily: font.body }}>
                  {profile?.bio ?? 'No bio yet. Tap Edit Profile to add one.'}
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Tournaments', value: String(ranked.length) },
                { label: 'Top 8s', value: String(topEights) },
                { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
              ].map(s => (
                <View key={s.label} style={{ ...card, flexBasis: '30%', flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.muted, marginBottom: 6 }}>{s.label}</Text>
                  <Text style={{ fontSize: 20, fontFamily: font.bold, color: colors.text }}>{s.value}</Text>
                </View>
              ))}
              {favLeaderId ? (
                <View style={{ ...card, flexBasis: '30%', flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.muted, marginBottom: 6 }}>Fav. Leader</Text>
                  <Image source={{ uri: getCardImageUrl(favLeaderId) }} style={{ width: 50, height: 70, borderRadius: 6 }} resizeMode="cover" />
                </View>
              ) : null}
            </View>

            <GlassPills
              style={{ marginTop: 6 }}
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
            return (
              <View style={{ ...card, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={{ uri: getCardImageUrl(item.id) }} style={{ width: 44, height: 62, borderRadius: 5, borderWidth: 1.5, borderColor: (LEADER_COLORS[item.color] ?? '#94a3b8') + '66' }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{cleanLeaderName(item.name)}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
                      {item.tournaments.length} event{item.tournaments.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 8, gap: 4 }}>
                  {item.tournaments.map(t => (
                    <TouchableOpacity key={t.id} onPress={() => router.push(`/tournament/${t.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: colors.muted, fontFamily: font.body }}>{t.name} · {t.date}</Text>
                      <Text style={{ fontSize: 11, fontFamily: font.mono, color: colors.faint }}>#{t.placement} · {t.wins}-{t.losses}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )
          }
          const t = item
          const pc = placementColors(t.placement)
          return (
            <TouchableOpacity onPress={() => router.push(`/tournament/${t.id}`)} style={{ ...card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: pc.bg }}>
                <Text style={{ fontSize: 11, fontFamily: font.bold, color: pc.color }}>{placementLabel(t.placement)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: colors.text, flexShrink: 1 }}>{t.name}</Text>
                  {t.is_practice ? (
                    <View style={{ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 5, backgroundColor: 'rgba(82,169,205,0.12)', borderWidth: 1, borderColor: 'rgba(82,169,205,0.3)' }}>
                      <Text style={{ fontSize: 8, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.oceanBright }}>Practice</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
                  {t.date} · {t.leader_name}
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: font.mono }}>
                <Text style={{ color: colors.emerald }}>{t.wins}W</Text>
                <Text style={{ color: colors.faint }}> · </Text>
                <Text style={{ color: colors.crimson }}>{t.losses}L</Text>
              </Text>
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
