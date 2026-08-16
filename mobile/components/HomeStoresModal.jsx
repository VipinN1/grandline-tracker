// Lets a player set which stores show as "Home Locals" on their profile —
// either automatically (top 3 stores they log locals-tier events at, see
// lib/homeStores.js) or a manually curated list of up to 3, searched from
// the same stores table used when logging a tournament. Mirrors the style
// of the Edit Profile modal in app/(tabs)/profile.jsx.
import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors, font, radius } from '../theme'
import { fieldInput, FieldLabel } from './forms'

const MAX_STORES = 3

export default function HomeStoresModal({ session, currentStores, computedStores, onClose, onSave }) {
  const [mode, setMode] = useState(currentStores?.length > 0 ? 'manual' : 'auto')
  const [picked, setPicked] = useState(currentStores ?? [])
  const [query, setQuery] = useState('')
  const [allStores, setAllStores] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('stores').select('*').order('name').then(({ data }) => setAllStores(data ?? []))
  }, [])

  const storeName = s => [s.name, s.city, s.state].filter(Boolean).join(', ')
  const filtered = query.trim()
    ? allStores
        .filter(s => storeName(s).toLowerCase().includes(query.trim().toLowerCase()))
        .filter(s => !picked.some(p => p.id === s.id))
        .slice(0, 20)
    : []

  function addStore(s) {
    if (picked.length >= MAX_STORES) return
    setPicked(prev => [...prev, { id: s.id, name: storeName(s) }])
    setQuery('')
  }

  function removeStore(id) {
    setPicked(prev => prev.filter(p => p.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const value = mode === 'auto' ? [] : picked
    const { error: err } = await supabase.from('profiles').update({ home_stores: value }).eq('id', session.user.id)
    setSaving(false)
    if (err) return setError('Failed to save. Please try again.')
    onSave(value)
    onClose()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#161b27', borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, maxHeight: '85%' }}>
          <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text, marginBottom: 4 }}>Home Locals</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 18, fontFamily: font.body }}>
            Shown on your profile — the stores you play locals at most.
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[['auto', 'Automatic'], ['manual', 'Pick my own']].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setMode(key)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', borderWidth: 1, borderColor: mode === key ? colors.goldLine : colors.line, backgroundColor: mode === key ? 'rgba(200,162,74,0.12)' : 'transparent' }}
              >
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: mode === key ? colors.gold : colors.muted }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'auto' ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>Based on your locals history:</Text>
              {computedStores.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>No locals logged yet — nothing to show until you do.</Text>
              ) : (
                computedStores.map(s => (
                  <View key={s.id ?? s.name} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line }}>
                    <Text style={{ fontSize: 13, color: colors.text, fontFamily: font.semi }}>{s.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, marginTop: 1 }}>{s.count} event{s.count !== 1 ? 's' : ''}</Text>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {picked.length > 0 ? (
                <View style={{ gap: 6 }}>
                  {picked.map(s => (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: 'rgba(200,162,74,0.08)', borderWidth: 1, borderColor: colors.goldLine }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, color: colors.text, fontFamily: font.semi, flex: 1 }}>{s.name}</Text>
                      <TouchableOpacity onPress={() => removeStore(s.id)} hitSlop={8}>
                        <Text style={{ color: colors.muted, fontSize: 15 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
              {picked.length < MAX_STORES ? (
                <View>
                  <FieldLabel>{`Add a store (${picked.length}/${MAX_STORES})`}</FieldLabel>
                  <TextInput
                    placeholder="Search stores..."
                    placeholderTextColor={colors.faint}
                    value={query}
                    onChangeText={setQuery}
                    style={fieldInput}
                  />
                  {filtered.length > 0 ? (
                    <ScrollView style={{ maxHeight: 160, marginTop: 6 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filtered.map(s => (
                        <TouchableOpacity key={s.id} onPress={() => addStore(s)} style={{ paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)' }}>
                          <Text style={{ fontSize: 13, color: colors.text, fontFamily: font.body }}>{storeName(s)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : (
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>Max {MAX_STORES} stores.</Text>
              )}
            </View>
          )}

          {error ? <Text style={{ fontSize: 12, color: colors.crimson, marginTop: 10, fontFamily: font.body }}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: saving ? '#3a526a' : colors.ocean, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
