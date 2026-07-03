// Shared marketplace primitives: condition badge, generic chat modal (works
// for listing / want / storefront message tables), and a card search picker.
import { useState, useEffect, useRef } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../../lib/supabase'
import { searchCards, getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius } from '../../theme'
import { fieldInput } from '../forms'

export const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']

export const CONDITION_COLORS = {
  'Near Mint': '#3bb27e',
  'Lightly Played': '#22d3ee',
  'Moderately Played': '#dcb35e',
  'Heavily Played': '#e08a3c',
  'Damaged': '#d24a3a',
}

export function ConditionBadge({ condition }) {
  const color = CONDITION_COLORS[condition] ?? colors.muted
  return (
    <View style={{ alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 7, borderRadius: 20, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '44' }}>
      <Text style={{ fontSize: 10, fontFamily: font.bold, color }}>{condition}</Text>
    </View>
  )
}

// Listing/want photo falls back to official card art.
export function cardArtUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`
}

export function ItemImage({ item, style, resizeMode = 'cover' }) {
  const [failed, setFailed] = useState(false)
  const uri = item.photo_url && !failed ? item.photo_url : cardArtUrl(item.card_id)
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} onError={() => setFailed(true)} />
}

// ── Generic realtime chat modal ─────────────────────────────────────────────
// Works for marketplace_messages (listing_id), want_messages (want_id) and
// storefront_messages (storefront_id / content column).
export function ChatModal({ visible, onClose, table, contextField, contextId, bodyField = 'body', currentUserId, receiverId, headerTitle, headerSubtitle, headerImageUri }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq(contextField, contextId)
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true })
      if (cancelled) return
      setMessages(data ?? [])
      setLoading(false)
      const unreadIds = (data ?? []).filter(m => m.receiver_id === currentUserId && !m.read).map(m => m.id)
      if (unreadIds.length > 0) await supabase.from(table).update({ read: true }).in('id', unreadIds)
    }
    load()
    const channel = supabase
      .channel(`${table}-${contextId}-${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `${contextField}=eq.${contextId}` },
        payload => setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [visible, table, contextField, contextId, currentUserId, receiverId])

  useEffect(() => {
    if (messages.length) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
  }, [messages.length])

  async function sendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    const { data } = await supabase
      .from(table)
      .insert({ [contextField]: contextId, sender_id: currentUserId, receiver_id: receiverId, [bodyField]: text.trim() })
      .select().single()
    if (data) setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
    setText('')
    setSending(false)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.abyss, borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '80%', borderWidth: 1, borderColor: colors.lineStrong }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            {headerImageUri ? <Image source={{ uri: headerImageUri }} style={{ width: 30, height: 42, borderRadius: 4 }} resizeMode="cover" /> : null}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{headerTitle}</Text>
              {headerSubtitle ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{headerSubtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8 }} keyboardDismissMode="interactive">
            {loading ? (
              <ActivityIndicator color={colors.gold} style={{ padding: 20 }} />
            ) : messages.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>💬</Text>
                <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>Start the conversation</Text>
              </View>
            ) : messages.map(msg => {
              const isMe = msg.sender_id === currentUserId
              return (
                <View key={msg.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <View style={{ maxWidth: '75%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: isMe ? colors.ocean : 'rgba(140,176,208,0.06)' }}>
                    <Text style={{ color: isMe ? '#fff' : colors.text, fontSize: 13, lineHeight: 19, fontFamily: font.body }}>{msg[bodyField]}</Text>
                    <Text style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.55)' : colors.faint, marginTop: 3, textAlign: 'right', fontFamily: font.body }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )
            })}
          </ScrollView>

          {/* Composer */}
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            <TextInput
              placeholder="Type a message..."
              placeholderTextColor={colors.faint}
              value={text}
              onChangeText={setText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              style={{ ...fieldInput, flex: 1, width: undefined }}
            />
            <TouchableOpacity onPress={sendMessage} disabled={sending || !text.trim()} style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: text.trim() ? colors.ocean : 'rgba(140,176,208,0.05)', justifyContent: 'center' }}>
              <Text style={{ color: text.trim() ? '#fff' : colors.muted, fontSize: 13, fontFamily: font.semi }}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Card search picker (for create listing / want) ──────────────────────────
export function CardPicker({ selected, onSelect, onClear, placeholder = 'e.g. Monkey D. Luffy or OP01-001' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  function handleQuery(val) {
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await searchCards(val)) } catch { setResults([]) }
      setSearching(false)
    }, 350)
  }

  if (selected) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(200,162,74,0.08)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.25)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12 }}>
        <Image source={{ uri: getCardImageUrl(selected) }} style={{ width: 32, height: 44, borderRadius: 4 }} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{selected.card_name}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.mono }}>
            {selected.card_set_id}{selected.set_name ? `  ·  ${selected.set_name}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onClear} hitSlop={8}>
          <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        value={query}
        onChangeText={handleQuery}
        autoCapitalize="none"
        autoCorrect={false}
        style={fieldInput}
      />
      {query.length >= 2 && (
        <View style={{ maxHeight: 300, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, marginTop: 6, backgroundColor: 'rgba(8,16,27,0.98)', overflow: 'hidden' }}>
          {searching ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 }}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>Searching...</Text>
            </View>
          ) : results.length === 0 ? (
            <Text style={{ padding: 14, fontSize: 13, color: colors.faint, fontFamily: font.body }}>No cards found</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.slice(0, 60).map(card => (
                <TouchableOpacity
                  key={card.card_image_id ?? card.card_set_id}
                  onPress={() => { onSelect(card); setQuery(''); setResults([]) }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.04)' }}
                >
                  <Image source={{ uri: getCardImageUrl(card) }} style={{ width: 40, height: 56, borderRadius: 4 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: font.semi, color: colors.text }}>{card.card_name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: font.mono }}>
                      {card.card_set_id}{card.set_name ? `  ·  ${card.set_name}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  )
}
