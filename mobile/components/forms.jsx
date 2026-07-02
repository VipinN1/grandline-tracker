// Shared form primitives for tournament logging — RN ports of the inline
// components in src/pages/LogResult.jsx (web).
import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native'
import { getCardImageUrl, searchLeaders } from '../lib/optcgapi'
import { colors, font, radius } from '../theme'

export const LEADER_COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

// Returns the clean base card ID for display (strips variant suffixes like "_p1").
export function baseCardId(id) {
  return id?.match(/^[A-Z]{1,3}[0-9]{0,3}-[0-9]+/i)?.[0] ?? id ?? ''
}

// Extracts the variant-specific image ID from a card object.
export function getLeaderStorageId(card) {
  if (card?.card_image_id) return card.card_image_id
  if (card?.card_image) {
    const m = card.card_image.match(/Card_Images\/(.+?)\.jpg/i)
    if (m?.[1]) return m[1]
  }
  return card?.card_set_id ?? ''
}

export const fieldInput = {
  width: '100%',
  backgroundColor: 'rgba(26,50,81,0.92)',
  borderWidth: 1,
  borderColor: 'rgba(200,162,74,0.35)',
  borderRadius: radius.sm,
  paddingVertical: 9,
  paddingHorizontal: 12,
  color: colors.text,
  fontSize: 13,
  fontFamily: font.body,
}

export function FieldLabel({ children }) {
  return (
    <Text style={{ fontSize: 11, fontFamily: font.semi, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted, marginBottom: 6 }}>
      {children}
    </Text>
  )
}

export function SectionTitle({ children }) {
  return (
    <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint, marginBottom: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)' }}>
      {children}
    </Text>
  )
}

// ── Leader search with debounced API autocomplete ────────────────────────────
export function LeaderSearchInput({ label, placeholder, onSelect, selected, onClear }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  function handleChange(val) {
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { const data = await searchLeaders(val); setResults(data.slice(0, 50)) }
      catch { setResults([]) }
      setSearching(false)
    }, 400)
  }

  if (selected) {
    return (
      <View>
        {label ? <FieldLabel>{label}</FieldLabel> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(26,50,81,0.95)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Image source={{ uri: getCardImageUrl(selected) }} style={{ width: 28, height: 38, borderRadius: 4 }} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>{selected.card_name}</Text>
            <Text style={{ fontSize: 11, color: LEADER_COLORS[selected.card_color] ?? colors.muted, fontFamily: font.body }}>
              {selected.card_color} · {baseCardId(selected.card_set_id)}
            </Text>
          </View>
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        placeholder={placeholder ?? 'Search leader...'}
        placeholderTextColor={colors.faint}
        value={query}
        onChangeText={handleChange}
        autoCapitalize="none"
        autoCorrect={false}
        style={fieldInput}
      />
      {query.length >= 2 ? (
        <View style={{ backgroundColor: 'rgba(10,22,38,0.97)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.sm, marginTop: 4, maxHeight: 280, overflow: 'hidden' }}>
          {searching ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>Searching...</Text>
            </View>
          ) : results.length === 0 ? (
            <Text style={{ padding: 12, fontSize: 13, color: colors.faint, fontFamily: font.body }}>No leaders found</Text>
          ) : (
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map(card => (
                <TouchableOpacity
                  key={card.card_image_id ?? card.card_set_id}
                  onPress={() => { onSelect(card); setQuery(''); setResults([]) }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)' }}
                >
                  <Image source={{ uri: getCardImageUrl(card) }} style={{ width: 32, height: 44, borderRadius: 4 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>{card.card_name}</Text>
                    <Text style={{ fontSize: 11, color: LEADER_COLORS[card.card_color] ?? colors.muted, marginTop: 2, fontFamily: font.mono }}>
                      {baseCardId(card.card_set_id)}
                      {card.set_name ? <Text style={{ color: colors.faint, fontFamily: font.body }}> · {card.set_name}</Text> : null}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  )
}

// ── Pill toggle group (dice / going / result) ────────────────────────────────
export function ToggleGroup({ label, value, onChange, options }) {
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map(opt => {
          const active = value === opt.value
          return (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => onChange(active ? null : opt.value)}
              style={{
                flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm,
                borderWidth: 1, borderColor: active ? opt.color : 'rgba(140,176,208,0.07)',
                backgroundColor: active ? opt.color + '22' : 'rgba(140,176,208,0.03)',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: active ? opt.color : colors.muted }}>{opt.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ── Searchable select with create-new (stores / series) ─────────────────────
export function SearchableSelect({ label, placeholder, items, selected, onSelect, onCreateNew, createLabel, displayKey = 'name', sublabel = null }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = items.filter(item => item[displayKey]?.toLowerCase().includes(query.toLowerCase()))

  if (selected) {
    return (
      <View>
        <FieldLabel>{label}</FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(26,50,81,0.95)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>{selected[displayKey]}</Text>
            {sublabel && selected[sublabel] ? (
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>{selected[sublabel]}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => { onSelect(null); setQuery('') }} hitSlop={8}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        value={query}
        onChangeText={val => { setQuery(val); setOpen(true) }}
        onFocus={() => setOpen(true)}
        style={fieldInput}
      />
      {open ? (
        <View style={{ backgroundColor: 'rgba(10,22,38,0.97)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.sm, marginTop: 4, overflow: 'hidden' }}>
          {filtered.length > 0 ? (
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {filtered.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => { onSelect(item); setQuery(''); setOpen(false) }}
                  style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.text }}>{item[displayKey]}</Text>
                  {sublabel && item[sublabel] ? (
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>{item[sublabel]}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {query.trim() && onCreateNew ? (
            <TouchableOpacity
              onPress={() => { onCreateNew(query.trim()); setQuery(''); setOpen(false) }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
            >
              <Text style={{ fontSize: 16, color: colors.ocean }}>+</Text>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.ocean }}>{createLabel} "{query.trim()}"</Text>
            </TouchableOpacity>
          ) : null}
          {filtered.length === 0 && !query.trim() ? (
            <Text style={{ paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, color: colors.faint, fontFamily: font.body }}>
              Type to search or create new
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
