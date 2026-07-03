// RN port of src/components/ProfilePopover.jsx — profile summary sheet with
// stats and friend actions. "Message" deep-links into the Community DM tab.
import { useState, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, Image } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors, font, radius } from '../theme'

export function Avatar({ profile, size = 44, rounded = false }) {
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <View style={{ width: size, height: size, borderRadius: rounded ? size / 2 : 10, backgroundColor: 'rgba(47,125,163,0.13)', borderWidth: 1, borderColor: 'rgba(47,125,163,0.27)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: size * 0.3, fontFamily: font.bold, color: colors.ocean }}>{initials}</Text>
      )}
    </View>
  )
}

export default function ProfileCard({ profile, session, onClose, onFriendAction }) {
  const [stats, setStats] = useState(null)
  const [friendStatus, setFriendStatus] = useState(null)

  useEffect(() => {
    async function load() {
      const promises = [
        supabase.from('tournaments').select('placement, wins, losses').eq('user_id', profile.id).eq('is_practice', false),
      ]
      if (session) {
        promises.push(
          supabase.from('friends').select('*').or(
            `and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`
          )
        )
      }
      const [{ data: tData }, fResult] = await Promise.all(promises)
      const tournaments = tData ?? []
      const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
      const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
      setStats({
        winRate: totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0,
        events: tournaments.length,
        topEights: tournaments.filter(t => t.placement <= 8).length,
      })
      const fData = fResult?.data
      if (session && fData && fData.length > 0) {
        const rel = fData[0]
        if (rel.status === 'accepted') setFriendStatus('accepted')
        else if (rel.user_id === session.user.id) setFriendStatus('pending_sent')
        else setFriendStatus('pending_received')
      }
    }
    load()
  }, [profile.id])

  async function sendFriendRequest() {
    const { error } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' })
    if (!error) { setFriendStatus('pending_sent'); onFriendAction?.() }
  }

  async function acceptRequest() {
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', profile.id).eq('friend_id', session.user.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'accepted' })
    setFriendStatus('accepted')
    onFriendAction?.()
  }

  async function removeFriend() {
    await supabase.from('friends').delete().or(`and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`)
    setFriendStatus(null)
    onFriendAction?.()
  }

  const isSelf = session?.user?.id === profile.id

  function FriendButton() {
    if (!session || isSelf) return null
    if (friendStatus === 'accepted') return (
      <TouchableOpacity onPress={removeFriend} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(210,74,58,0.3)', backgroundColor: 'rgba(210,74,58,0.08)' }}>
        <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Remove</Text>
      </TouchableOpacity>
    )
    if (friendStatus === 'pending_sent') return (
      <View style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.muted }}>Sent</Text>
      </View>
    )
    if (friendStatus === 'pending_received') return (
      <TouchableOpacity onPress={acceptRequest} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.emerald }}>
        <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>Accept</Text>
      </TouchableOpacity>
    )
    return (
      <TouchableOpacity onPress={sendFriendRequest} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.ocean }}>
        <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>+ Add Friend</Text>
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.goldLine, padding: 20, paddingBottom: 36, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar profile={profile} size={54} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{profile.username}</Text>
              {profile.location ? <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>📍 {profile.location}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {profile.bio ? (
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 19, padding: 10, backgroundColor: 'rgba(140,176,208,0.03)', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, fontFamily: font.body }}>
              {profile.bio.length > 120 ? profile.bio.slice(0, 120) + '…' : profile.bio}
            </Text>
          ) : null}

          {stats ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['Win Rate', `${stats.winRate}%`], ['Events', String(stats.events)], ['Top 8s', String(stats.topEights)]].map(([label, val]) => (
                <View key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, fontFamily: font.semi }}>{label}</Text>
                  <Text style={{ fontSize: 18, fontFamily: font.bold, color: colors.text }}>{val}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ textAlign: 'center', paddingVertical: 12, color: colors.muted, fontSize: 12, fontFamily: font.body }}>Loading stats…</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FriendButton />
            {!isSelf && session ? (
              <TouchableOpacity
                onPress={() => { onClose(); router.push({ pathname: '/community', params: { dm: profile.id } }) }}
                style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(200,162,74,0.3)', backgroundColor: 'rgba(140,176,208,0.08)', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.oceanBright }}>Message</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
