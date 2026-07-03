// RN port of src/pages/BugReports.jsx — admin-only (username === 'Cipin').
// Open/Resolved/All filters, resolve/reopen toggle, immediate delete.
import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native'
import { Stack, router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, radius, card } from '../theme'
import { GlassButton, GlassPills } from '../components/glass'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

const screenOpts = {
  headerShown: true,
  title: 'Bug Reports',
  headerStyle: { backgroundColor: '#08101b' },
  headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
  headerTintColor: colors.parchment,
}

export default function BugReports() {
  const { session } = useSession()
  const [isAdmin, setIsAdmin] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  const load = useCallback(async () => {
    if (!session) { setIsAdmin(false); setLoading(false); return }
    const [{ data: profile }, { data: reportRows }] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', session.user.id).single(),
      supabase.from('bug_reports').select('*').order('created_at', { ascending: false }),
    ])
    setIsAdmin(profile?.username === 'Cipin')
    setReports(reportRows ?? [])
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function toggleResolved(report) {
    const status = (report.status ?? 'open') === 'open' ? 'resolved' : 'open'
    await supabase.from('bug_reports').update({ status }).eq('id', report.id)
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status } : r))
  }

  function confirmDelete(report) {
    Alert.alert('Delete report', 'Delete this bug report? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('bug_reports').delete().eq('id', report.id)
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
            <Text style={{ fontSize: 40, marginBottom: 14 }}>🐞</Text>
            <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted }}>
              {filter === 'open' ? 'No open reports — smooth sailing' : 'No reports here'}
            </Text>
          </View>
        }
        renderItem={({ item: r }) => {
          const status = r.status ?? 'open'
          const open = status === 'open'
          return (
            <View style={{ ...card, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: open ? 'rgba(224,138,60,0.14)' : 'rgba(59,178,126,0.12)', borderWidth: 1, borderColor: open ? 'rgba(224,138,60,0.35)' : 'rgba(59,178,126,0.3)' }}>
                  <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.5, color: open ? colors.orange : colors.emerald }}>{status}</Text>
                </View>
                {r.user_id ? (
                  <TouchableOpacity onPress={() => router.push(`/user/${r.user_id}`)}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{r.username ?? 'User'}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>Anonymous</Text>
                )}
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{r.page}</Text>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginLeft: 'auto' }}>
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textSoft, lineHeight: 20, fontFamily: font.body }}>{r.message}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                <GlassButton onPress={() => toggleResolved(r)} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: open ? colors.emerald : colors.orange }}>
                    {open ? 'Mark Resolved' : 'Reopen'}
                  </Text>
                </GlassButton>
                <GlassButton onPress={() => confirmDelete(r)} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Delete</Text>
                </GlassButton>
              </View>
            </View>
          )
        }}
      />
    </>
  )
}
