// RN port of src/pages/TournamentsPage.jsx — online sim tournament hub.
import { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Stack, router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { colors, font, radius, card } from '../../theme'
import { fieldInput, FieldLabel } from '../../components/forms'
import { GlassButton } from '../../components/glass'

function statusInfo(status, deadline) {
  if (status === 'completed') return { label: 'Completed', color: colors.muted }
  if (status === 'active') return { label: 'In Progress', color: colors.emerald }
  if (deadline && new Date() > new Date(deadline)) return { label: 'Reg. Closed', color: colors.orange }
  return { label: 'Registration Open', color: colors.oceanBright }
}

function CreateTournamentModal({ session, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', description: '', discord_link: '', registration_deadline: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    const deadline = new Date(form.registration_deadline)
    if (isNaN(deadline.getTime())) { setError('Deadline must be like 2026-07-15 18:00'); return }
    setCreating(true)
    const { error: err } = await supabase.from('sim_tournaments').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      discord_link: form.discord_link.trim() || null,
      registration_deadline: deadline.toISOString(),
      created_by: session.user.id,
    })
    setCreating(false)
    if (err) { setError(err.message); return }
    onSuccess()
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.lineStrong, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontFamily: font.display, fontSize: 20, color: colors.text }}>Create Tournament</Text>
            <View>
              <FieldLabel>Tournament Name *</FieldLabel>
              <TextInput style={fieldInput} placeholder="e.g. GrandLine Open #1" placeholderTextColor={colors.faint} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} />
            </View>
            <View>
              <FieldLabel>Description</FieldLabel>
              <TextInput style={fieldInput} placeholder="Brief description..." placeholderTextColor={colors.faint} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} />
            </View>
            <View>
              <FieldLabel>Discord Link</FieldLabel>
              <TextInput style={fieldInput} placeholder="https://discord.gg/..." placeholderTextColor={colors.faint} autoCapitalize="none" value={form.discord_link} onChangeText={v => setForm(p => ({ ...p, discord_link: v }))} />
            </View>
            <View>
              <FieldLabel>Registration Deadline * (local time)</FieldLabel>
              <TextInput style={fieldInput} placeholder="YYYY-MM-DD HH:MM" placeholderTextColor={colors.faint} value={form.registration_deadline} onChangeText={v => setForm(p => ({ ...p, registration_deadline: v }))} />
            </View>
            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassButton onPress={onClose} pad={{ paddingVertical: 11, paddingHorizontal: 16 }} style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.textSoft }}>Cancel</Text>
              </GlassButton>
              <GlassButton onPress={create} disabled={creating} tint={colors.gold} pad={{ paddingVertical: 11, paddingHorizontal: 16 }} style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.onAccent }}>{creating ? 'Creating...' : 'Create'}</Text>
              </GlassButton>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function TournamentsPage() {
  const { session } = useSession()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    const [{ data }, adminRes] = await Promise.all([
      supabase.from('sim_tournaments').select('*, sim_tournament_players(id)').order('created_at', { ascending: false }),
      session ? supabase.from('profiles').select('username').eq('id', session.user.id).single() : Promise.resolve({ data: null }),
    ])
    setTournaments(data ?? [])
    if (adminRes?.data?.username === 'Cipin') setIsAdmin(true)
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Tournaments',
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
            data={tournaments}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>Online sim tournaments run on Discord</Text>
                {isAdmin && (
                  <GlassButton onPress={() => setShowCreate(true)} tint={colors.gold} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.onAccent }}>+ Create</Text>
                  </GlassButton>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 70 }}>
                <Text style={{ fontSize: 40, marginBottom: 14 }}>🏝️</Text>
                <Text style={{ fontSize: 16, fontFamily: font.display, color: colors.textSoft, marginBottom: 6 }}>No islands charted yet</Text>
                <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>Check back soon for upcoming events</Text>
              </View>
            }
            renderItem={({ item: t }) => {
              const { label, color } = statusInfo(t.status, t.registration_deadline)
              const count = t.sim_tournament_players?.length ?? 0
              const deadlinePast = t.registration_deadline && new Date() > new Date(t.registration_deadline)
              const major = t.status === 'active' || t.status === 'completed'
              return (
                <TouchableOpacity onPress={() => router.push(`/tournaments/${t.id}`)} style={{ ...card, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ width: 3, backgroundColor: major ? colors.gold : colors.oceanDeep }} />
                    <View style={{ flex: 1, padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontFamily: font.display, fontSize: 17, color: colors.text, flexShrink: 1 }}>{t.name}</Text>
                        <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: color + '1f', borderWidth: 1, borderColor: color + '52' }}>
                          <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.4, color }}>{label}</Text>
                        </View>
                      </View>
                      {t.description ? <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 10, lineHeight: 19, fontFamily: font.body }}>{t.description}</Text> : null}
                      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>👥 {count} player{count !== 1 ? 's' : ''}</Text>
                        {t.registration_deadline ? (
                          <Text style={{ fontSize: 12, color: deadlinePast ? colors.orange : colors.muted, fontFamily: font.body }}>
                            ⏰ {deadlinePast ? 'Closed' : 'Deadline:'} {new Date(t.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        ) : null}
                        {t.status === 'active' ? <Text style={{ fontSize: 12, color: colors.emerald, fontFamily: font.semi }}>Round {t.current_round}</Text> : null}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            }}
          />
        )}
        {showCreate && <CreateTournamentModal session={session} onClose={() => setShowCreate(false)} onSuccess={load} />}
      </View>
    </>
  )
}
