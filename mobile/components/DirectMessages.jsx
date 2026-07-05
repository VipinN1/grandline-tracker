// RN port of src/components/DirectMessages.jsx — single-pane on phone:
// conversation list, or the active thread with a back button.
import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Image, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useBlocks } from '../lib/blocks'
import { getCardImageUrl } from '../lib/optcgapi'
import { pickAndUploadImage } from '../lib/upload'
import { colors, font, radius } from '../theme'
import SelectDecklistModal from './SelectDecklistModal'
import { Avatar } from './ProfileCard'

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// Compact decklist card rendered inside a message bubble.
function DeckMessage({ deck, onEnlarge }) {
  const [open, setOpen] = useState(false)
  if (!deck) return null
  const cards = deck.cards ?? []
  const count = cards.reduce((s, c) => s + (c.count ?? 0), 0)
  return (
    <View style={{ borderWidth: 1, borderColor: 'rgba(200,162,74,0.25)', borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(140,176,208,0.06)', minWidth: 220 }}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 }}>
        <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: 30, height: 41, borderRadius: 4 }} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.bold, color: colors.text }}>{deck.name}</Text>
          <Text style={{ fontSize: 10, color: colors.muted, fontFamily: font.body }}>{count} cards · {deck.leader_name}</Text>
        </View>
        <Text style={{ fontSize: 10, color: colors.oceanBright }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.06)', flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {cards.flatMap(card =>
            Array.from({ length: card.count }, (_, i) => (
              <TouchableOpacity key={`${card.id}-${i}`} onPress={() => onEnlarge(getCardImageUrl(card.id))}>
                <Image source={{ uri: getCardImageUrl(card.id) }} style={{ width: 40, height: 56, borderRadius: 3 }} resizeMode="cover" />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  )
}

export default function DirectMessages({ session, initialUserId }) {
  const me = session?.user?.id
  const { blockedIds } = useBlocks()
  const [conversations, setConversations] = useState([])
  const [profiles, setProfiles] = useState({})
  const [activeId, setActiveId] = useState(initialUserId ?? null)
  const [messages, setMessages] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pickDeck, setPickDeck] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const listRef = useRef(null)
  const activeIdRef = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const loadConversations = useCallback(async () => {
    if (!me) return
    const { data } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, body, image_url, decklist_id, read, created_at')
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
      .order('created_at', { ascending: false })

    const byUser = new Map()
    for (const m of (data ?? [])) {
      const other = m.sender_id === me ? m.receiver_id : m.sender_id
      if (!byUser.has(other)) byUser.set(other, { otherId: other, last: m, unread: 0 })
      if (m.receiver_id === me && !m.read) byUser.get(other).unread++
    }
    const list = [...byUser.values()]
    setConversations(list)

    const ids = list.map(c => c.otherId)
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      setProfiles(prev => {
        const next = { ...prev }
        for (const p of (profs ?? [])) next[p.id] = p
        return next
      })
    }
    setLoadingConvos(false)
  }, [me])

  const openThread = useCallback(async (otherId) => {
    setActiveId(otherId)
    setLoadingThread(true)
    const { data: p } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', otherId).single()
    if (p) setProfiles(prev => ({ ...prev, [p.id]: p }))
    const { data } = await supabase
      .from('direct_messages')
      .select('*, decklists(*)')
      .or(`and(sender_id.eq.${me},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${me})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoadingThread(false)

    const unreadIds = (data ?? []).filter(m => m.receiver_id === me && !m.read).map(m => m.id)
    if (unreadIds.length) {
      await supabase.from('direct_messages').update({ read: true }).in('id', unreadIds)
      setConversations(prev => prev.map(c => c.otherId === otherId ? { ...c, unread: 0 } : c))
    }
  }, [me])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { if (initialUserId) openThread(initialUserId) }, [initialUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: new incoming messages
  useEffect(() => {
    if (!me) return
    const channel = supabase
      .channel(`dm_inbox_${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${me}` }, async (payload) => {
        const msg = payload.new
        if (blockedIds.has(msg.sender_id)) return
        if (activeIdRef.current && msg.sender_id === activeIdRef.current) {
          const { data } = await supabase.from('direct_messages').select('*, decklists(*)').eq('id', msg.id).single()
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, data ?? msg])
          await supabase.from('direct_messages').update({ read: true }).eq('id', msg.id)
        }
        loadConversations()
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [me, loadConversations, blockedIds])

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [messages.length])

  async function insertMessage(fields) {
    const { data } = await supabase
      .from('direct_messages')
      .insert({ sender_id: me, receiver_id: activeId, ...fields })
      .select('*, decklists(*)')
      .single()
    if (data) {
      setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
      loadConversations()
    }
  }

  async function sendText() {
    const t = text.trim()
    if (!t || !activeId || sending || blockedIds.has(activeId)) return
    setSending(true)
    setText('')
    await insertMessage({ body: t })
    setSending(false)
  }

  async function sendImage() {
    if (!activeId || sending) return
    setSending(true)
    try {
      const url = await pickAndUploadImage({ bucket: 'card-photos', path: `dm/${me}/${Date.now()}` })
      if (url) await insertMessage({ image_url: url })
    } catch (e) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload the image.')
    }
    setSending(false)
  }

  async function sendDeck(deck) {
    setPickDeck(false)
    if (!deck || !activeId) return
    await insertMessage({ decklist_id: deck.id, body: null })
  }

  const otherProfile = activeId ? profiles[activeId] : null

  // ── Conversation list ────────────────────────────────────────────────────────
  const visibleConversations = conversations.filter(c => !blockedIds.has(c.otherId))

  if (!activeId) {
    return (
      <View style={{ flex: 1 }}>
        {loadingConvos ? (
          <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={colors.gold} /></View>
        ) : visibleConversations.length === 0 ? (
          <Text style={{ padding: 24, fontSize: 13, color: colors.faint, textAlign: 'center', lineHeight: 20, fontFamily: font.body }}>
            No messages yet. Open someone's profile and tap Message to start a chat.
          </Text>
        ) : (
          <FlatList
            data={visibleConversations}
            keyExtractor={c => c.otherId}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item: c }) => {
              const p = profiles[c.otherId]
              const m = c.last
              const preview = m.body || (m.image_url ? '📷 Photo' : m.decklist_id ? '🃏 Decklist' : '')
              return (
                <TouchableOpacity onPress={() => openThread(c.otherId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)' }}>
                  <Avatar profile={p} size={38} rounded />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: font.bold, color: colors.text }}>{p?.username ?? 'User'}</Text>
                      <Text style={{ fontSize: 10, color: colors.faint, fontFamily: font.body }}>{timeAgo(m.created_at)}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: c.unread ? '#9fd0e6' : colors.muted, fontFamily: c.unread ? font.bold : font.body }}>
                      {m.sender_id === me ? 'You: ' : ''}{preview}
                    </Text>
                  </View>
                  {c.unread > 0 && (
                    <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.crimson, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontFamily: font.bold }}>{c.unread > 9 ? '9+' : c.unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )}
      </View>
    )
  }

  // ── Active thread ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      {/* Thread header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)' }}>
        <TouchableOpacity onPress={() => setActiveId(null)} hitSlop={8}>
          <Text style={{ color: colors.oceanBright, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Avatar profile={otherProfile} size={32} rounded />
        <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{otherProfile?.username ?? 'User'}</Text>
      </View>

      <ScrollView ref={listRef} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 14, gap: 10 }} keyboardDismissMode="interactive">
        {loadingThread ? (
          <ActivityIndicator color={colors.gold} style={{ padding: 20 }} />
        ) : messages.length === 0 ? (
          <Text style={{ color: colors.faint, fontSize: 13, textAlign: 'center', padding: 20, fontFamily: font.body }}>No messages yet — say hi 👋</Text>
        ) : messages.map(m => {
          const mine = m.sender_id === me
          return (
            <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <View style={{ maxWidth: '78%', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {m.body ? (
                  <View style={{ backgroundColor: mine ? 'rgba(200,162,74,0.22)' : 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: mine ? 'rgba(200,162,74,0.35)' : 'rgba(140,176,208,0.08)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
                    <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19, fontFamily: font.body }}>{m.body}</Text>
                  </View>
                ) : null}
                {m.image_url ? (
                  <TouchableOpacity onPress={() => setLightbox(m.image_url)}>
                    <Image source={{ uri: m.image_url }} style={{ width: 200, height: 200, borderRadius: 10 }} resizeMode="cover" />
                  </TouchableOpacity>
                ) : null}
                {m.decklist_id ? <DeckMessage deck={m.decklists} onEnlarge={setLightbox} /> : null}
                <Text style={{ fontSize: 9, color: colors.faint, fontFamily: font.body }}>{timeAgo(m.created_at)}</Text>
              </View>
            </View>
          )
        })}
      </ScrollView>

      {/* Composer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.07)' }}>
        <TouchableOpacity onPress={sendImage} disabled={sending} style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15 }}>🖼</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPickDeck(true)} disabled={sending} style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14 }}>🃏</Text>
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.faint}
          onSubmitEditing={sendText}
          returnKeyType="send"
          style={{ flex: 1, backgroundColor: 'rgba(26,50,81,0.9)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.25)', borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
        />
        <TouchableOpacity onPress={sendText} disabled={sending || !text.trim()} style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: text.trim() ? colors.ocean : 'rgba(140,176,208,0.15)' }}>
          <Text style={{ fontSize: 13, fontFamily: font.bold, color: text.trim() ? '#fff' : colors.faint }}>Send</Text>
        </TouchableOpacity>
      </View>

      <SelectDecklistModal session={session} visible={pickDeck} onClose={() => setPickDeck(false)} onSelect={sendDeck} />
      {lightbox && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setLightbox(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Image source={{ uri: lightbox }} style={{ width: '95%', height: '80%' }} resizeMode="contain" />
          </TouchableOpacity>
        </Modal>
      )}
    </KeyboardAvoidingView>
  )
}
