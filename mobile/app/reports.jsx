// Admin-only (username === 'Cipin') content-report queue for community posts/comments.
// Mirrors bug-reports.jsx. Reports come from components/ReportModal.jsx.
import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native'
import { Stack, router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, card } from '../theme'
import { GlassButton, GlassPills } from '../components/glass'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

const screenOpts = {
  headerShown: true,
  title: 'Content Reports',
  headerStyle: { backgroundColor: '#08101b' },
  headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
  headerTintColor: colors.parchment,
}

export default function ContentReports() {
  const { session } = useSession()
  const [isAdmin, setIsAdmin] = useState(null)
  const [reports, setReports] = useState([])
  const [content, setContent] = useState({})   // `${type}:${id}` -> post/comment row or null (deleted)
  const [usernames, setUsernames] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  const load = useCallback(async () => {
    if (!session) { setIsAdmin(false); setLoading(false); return }
    const [{ data: profile }, { data: reportRows }] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', session.user.id).single(),
      supabase.from('content_reports').select('*').order('created_at', { ascending: false }),
    ])
    setIsAdmin(profile?.username === 'Cipin')
    const rows = reportRows ?? []
    setReports(rows)

    const postIds = rows.filter(r => r.content_type === 'post').map(r => r.content_id)
    const commentIds = rows.filter(r => r.content_type === 'comment').map(r => r.content_id)
    const userIds = [...new Set(rows.flatMap(r => [r.reporter_id, r.content_owner_id]).filter(Boolean))]
    const [postsRes, commentsRes, profilesRes] = await Promise.all([
      postIds.length ? supabase.from('posts').select('id, title, body, user_id').in('id', postIds) : { data: [] },
      commentIds.length ? supabase.from('comments').select('id, body, user_id').in('id', commentIds) : { data: [] },
      userIds.length ? supabase.from('profiles').select('id, username').in('id', userIds) : { data: [] },
    ])
    const contentMap = {}
    for (const p of (postsRes.data ?? [])) contentMap[`post:${p.id}`] = p
    for (const c of (commentsRes.data ?? [])) contentMap[`comment:${c.id}`] = c
    setContent(contentMap)
    setUsernames(Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.username])))
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function toggleResolved(report) {
    const status = (report.status ?? 'open') === 'open' ? 'resolved' : 'open'
    await supabase.from('content_reports').update({ status }).eq('id', report.id)
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status } : r))
  }

  function confirmDeleteContent(report) {
    Alert.alert(
      `Delete reported ${report.content_type}`,
      `Permanently delete this ${report.content_type}? The report will be marked resolved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Content', style: 'destructive',
          onPress: async () => {
            const table = report.content_type === 'post' ? 'posts' : 'comments'
            await supabase.from(table).delete().eq('id', report.content_id)
            await supabase.from('content_reports').update({ status: 'resolved' }).eq('id', report.id)
            setContent(prev => ({ ...prev, [`${report.content_type}:${report.content_id}`]: null }))
            setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'resolved' } : r))
          },
        },
      ]
    )
  }

  function confirmDeleteReport(report) {
    Alert.alert('Delete report', 'Delete this report? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('content_reports').delete().eq('id', report.id)
          setReports(prev => prev.filter(r => r.id !== report.id))
        },
      },
    ])
  }

  if (loading || isAdmin === null) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 14 }}>🔒</Text>
          <Text style={{ fontSize: 16, fontFamily: font.display, color: colors.textSoft, marginBottom: 6 }}>Not authorized</Text>
          <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>This page is for the crew's admin only.</Text>
        </View>
      </>
    )
  }

  const filtered = reports.filter(r => {
    const status = r.status ?? 'open'
    if (filter === 'all') return true
    return status === filter
  })

  return (
    <>
      <Stack.Screen options={screenOpts} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={filtered}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 10 }}
        ListHeaderComponent={
          <GlassPills
            style={{ marginBottom: 8 }}
            items={FILTERS.map(f => ({
              key: f.key,
              label: f.key === 'open' ? `Open (${reports.filter(r => (r.status ?? 'open') === 'open').length})` : f.label,
            }))}
            activeKey={filter}
            onSelect={setFilter}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 70 }}>
            <Text style={{ fontSize: 40, marginBottom: 14 }}>🚩</Text>
            <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted }}>
              {filter === 'open' ? 'No open reports — smooth sailing' : 'No reports here'}
            </Text>
          </View>
        }
        renderItem={({ item: r }) => {
          const status = r.status ?? 'open'
          const open = status === 'open'
          const item = content[`${r.content_type}:${r.content_id}`]
          return (
            <View style={{ ...card, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: open ? 'rgba(224,138,60,0.14)' : 'rgba(59,178,126,0.12)', borderWidth: 1, borderColor: open ? 'rgba(224,138,60,0.35)' : 'rgba(59,178,126,0.3)' }}>
                  <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: open ? colors.orange : colors.emerald }}>{status}</Text>
                </View>
                <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(210,74,58,0.1)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.3)' }}>
                  <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.crimson }}>{r.reason}</Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginLeft: 'auto' }}>
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>
                <Text style={{ fontFamily: font.semi, color: colors.oceanBright }}>{usernames[r.reporter_id] ?? 'Unknown'}</Text>
                {' reported a '}{r.content_type}{' by '}
                <Text style={{ fontFamily: font.semi, color: colors.oceanBright }} onPress={() => r.content_owner_id && router.push(`/user/${r.content_owner_id}`)}>
                  {usernames[r.content_owner_id] ?? 'Unknown'}
                </Text>
              </Text>
              {r.details ? <Text style={{ fontSize: 12, color: colors.textSoft, fontFamily: font.body, fontStyle: 'italic' }}>“{r.details}”</Text> : null}

              <View style={{ padding: 10, backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: 8 }}>
                {item ? (
                  <>
                    {item.title ? <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text, marginBottom: 3 }}>{item.title}</Text> : null}
                    <Text numberOfLines={4} style={{ fontSize: 12, color: colors.textSoft, lineHeight: 18, fontFamily: font.body }}>{item.body}</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body, fontStyle: 'italic' }}>Content already deleted</Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                {item ? (
                  <GlassButton onPress={() => confirmDeleteContent(r)} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Delete Content</Text>
                  </GlassButton>
                ) : null}
                <GlassButton onPress={() => toggleResolved(r)} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: open ? colors.emerald : colors.orange }}>
                    {open ? 'Mark Resolved' : 'Reopen'}
                  </Text>
                </GlassButton>
                <GlassButton onPress={() => confirmDeleteReport(r)} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.muted }}>Dismiss</Text>
                </GlassButton>
              </View>
            </View>
          )
        }}
      />
    </>
  )
}
