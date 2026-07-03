import { useState, useCallback, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, Switch } from 'react-native'
import { Stack } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, radius, card } from '../theme'
import ProfileCard, { Avatar } from '../components/ProfileCard'
import { GlassButton } from '../components/glass'

// Admin-only: grant/revoke a friend per-tournament admin access on your own
// sim tournaments (rows in sim_tournament_admins) — mirrors the web 🛡 modal.
function TournamentAdminModal({ session, friendProfile, onClose }) {
  const [tournaments, setTournaments] = useState([])
  const [grantedIds, setGrantedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: mine }, { data: grants }] = await Promise.all([
        supabase.from('sim_tournaments').select('id, name, status').eq('created_by', session.user.id).order('created_at', { ascending: false }),
        supabase.from('sim_tournament_admins').select('tournament_id').eq('user_id', friendProfile.id),
      ])
      setTournaments(mine ?? [])
      setGrantedIds(new Set((grants ?? []).map(g => g.tournament_id)))
      setLoading(false)
    }
    load()
  }, [friendProfile.id])

  async function toggle(tournamentId, on) {
    setGrantedIds(prev => {
      const next = new Set(prev)
      if (on) next.add(tournamentId); else next.delete(tournamentId)
      return next
    })
    if (on) {
      await supabase.from('sim_tournament_admins').insert({ tournament_id: tournamentId, user_id: friendProfile.id })
    } else {
      await supabase.from('sim_tournament_admins').delete().eq('tournament_id', tournamentId).eq('user_id', friendProfile.id)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.goldLine, padding: 20, paddingBottom: 36, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>🛡 Tournament Admin</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 14, fontFamily: font.body }}>
            Give {friendProfile.username} admin access on your tournaments (start rounds, resolve disputes).
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ padding: 20 }} />
          ) : tournaments.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.faint, textAlign: 'center', padding: 20, fontFamily: font.body }}>
              You haven't created any tournaments yet.
            </Text>
          ) : (
            <FlatList
              data={tournaments}
              keyExtractor={t => t.id}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item: t }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>{t.name}</Text>
                    <Text style={{ fontSize: 10, color: colors.faint, marginTop: 2, textTransform: 'capitalize', fontFamily: font.body }}>{t.status}</Text>
                  </View>
                  <Switch
                    value={grantedIds.has(t.id)}
                    onValueChange={on => toggle(t.id, on)}
                    trackColor={{ false: 'rgba(140,176,208,0.2)', true: colors.ocean }}
                    thumbColor="#fff"
                  />
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function Friends() {
  const { session } = useSession()
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('friends')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminTarget, setAdminTarget] = useState(null)

  const loadAll = useCallback(async () => {
    if (!session) return
    const [{ data: friendsData }, { data: requestsData }, { data: myProfile }] = await Promise.all([
      supabase.from('friends').select('*, profiles!friends_friend_id_fkey(*)').eq('user_id', session.user.id).eq('status', 'accepted'),
      supabase.from('friends').select('*, profiles!friends_user_id_fkey(*)').eq('friend_id', session.user.id).eq('status', 'pending'),
      supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle(),
    ])
    setFriends(friendsData ?? [])
    setPendingRequests(requestsData ?? [])
    setIsAdmin(myProfile?.username === 'Cipin')
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { loadAll() }, [loadAll]))

  async function handleAddFriend() {
    setAddError('')
    setAddSuccess('')
    if (!addUsername.trim()) return

    const { data: profile, error } = await supabase.from('profiles').select('*').eq('username', addUsername.trim()).single()
    if (error || !profile) { setAddError('User not found'); return }
    if (profile.id === session.user.id) { setAddError("You can't add yourself"); return }

    const { error: friendError } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' })
    if (friendError) setAddError('Request already sent or you are already friends')
    else { setAddSuccess(`Friend request sent to ${profile.username}!`); setAddUsername('') }
  }

  async function acceptRequest(request) {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', request.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: request.user_id, status: 'accepted' })
    loadAll()
  }

  async function declineRequest(request) {
    await supabase.from('friends').delete().eq('id', request.id)
    loadAll()
  }

  const filtered = friends.filter(f => f.profiles?.username?.toLowerCase().includes(search.toLowerCase()))
  const listData = activeTab === 'friends' ? filtered : pendingRequests

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Friends',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <View style={{ flex: 1, backgroundColor: colors.abyss }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
            ListHeaderComponent={
              <View style={{ marginBottom: 8, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    placeholder="Add by username..."
                    placeholderTextColor={colors.faint}
                    value={addUsername}
                    onChangeText={setAddUsername}
                    autoCapitalize="none"
                    onSubmitEditing={handleAddFriend}
                    style={{ flex: 1, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
                  />
                  <GlassButton onPress={handleAddFriend} tint={colors.ocean} pad={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>Send</Text>
                  </GlassButton>
                </View>
                {addError ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{addError}</Text> : null}
                {addSuccess ? <Text style={{ fontSize: 12, color: colors.emerald, fontFamily: font.body }}>{addSuccess}</Text> : null}

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[['friends', 'Friends'], ['requests', `Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`]].map(([tab, label]) => {
                    const active = activeTab === tab
                    return (
                      <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong, backgroundColor: active ? colors.goldSoft : 'transparent' }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {activeTab === 'friends' && friends.length > 0 ? (
                  <TextInput
                    placeholder="Search friends..."
                    placeholderTextColor={colors.faint}
                    value={search}
                    onChangeText={setSearch}
                    style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: 'rgba(140,176,208,0.07)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
                  />
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 70 }}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>{activeTab === 'friends' ? '👥' : '📬'}</Text>
                <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted, marginBottom: 6 }}>
                  {activeTab === 'friends' ? 'No friends yet' : 'No pending requests'}
                </Text>
                {activeTab === 'friends' && (
                  <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>Add friends by their username to see their stats</Text>
                )}
              </View>
            }
            renderItem={({ item }) => activeTab === 'friends' ? (
              <TouchableOpacity onPress={() => setSelectedProfile(item.profiles)} style={{ ...card, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar profile={item.profiles} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{item.profiles?.username}</Text>
                  {item.profiles?.location ? <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>{item.profiles.location}</Text> : null}
                </View>
                {isAdmin && item.profiles ? (
                  <TouchableOpacity
                    onPress={() => setAdminTarget(item.profiles)}
                    hitSlop={6}
                    style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: 'rgba(200,162,74,0.08)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 14 }}>🛡</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ) : (
              <View style={{ ...card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar profile={item.profiles} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{item.profiles?.username}</Text>
                  <Text style={{ fontSize: 11, color: colors.faint, marginTop: 2, fontFamily: font.body }}>Sent {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity onPress={() => acceptRequest(item)} style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.emerald }}>
                  <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => declineRequest(item)} style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.muted }}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
        {selectedProfile && (
          <ProfileCard profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} onFriendAction={loadAll} />
        )}
        {adminTarget && (
          <TournamentAdminModal session={session} friendProfile={adminTarget} onClose={() => setAdminTarget(null)} />
        )}
      </View>
    </>
  )
}
