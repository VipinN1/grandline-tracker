// RN port of src/components/MatchChat.jsx — collapsible per-match chat,
// visible to the two players and tournament admins.
import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors, font, radius } from '../theme'

export default function MatchChat({ matchId, currentUserId, player1Id, player2Id, isAdmin, messages, getProfile, onMessageSent }) {
  const [open, setOpen] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      if (!open) setHasNew(true)
      prevLenRef.current = messages.length
    }
  }, [messages.length, open])

  useEffect(() => {
    if (open) {
      setHasNew(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)
    }
  }, [open, messages.length])

  const canChat = currentUserId && (currentUserId === player1Id || currentUserId === player2Id || isAdmin)
  if (!player2Id || !canChat) return null

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    const { data } = await supabase
      .from('sim_match_messages')
      .insert({ match_id: matchId, user_id: currentUserId, message: trimmed })
      .select()
      .single()
    if (data) onMessageSent?.(data)
    setText('')
    setSending(false)
  }

  return (
    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.06)', paddingTop: 8 }}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View>
          <Text style={{ fontSize: 13 }}>💬</Text>
          {hasNew && !open ? (
            <View style={{ position: 'absolute', top: -2, right: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ocean }} />
          ) : null}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, fontFamily: font.semi }}>Match Chat</Text>
        <Text style={{ fontSize: 10, color: colors.faint }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 8 }}>
          <ScrollView ref={scrollRef} style={{ maxHeight: 180, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(140,176,208,0.05)' }} contentContainerStyle={{ padding: 10, gap: 6 }} nestedScrollEnabled>
            {messages.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.faint, textAlign: 'center', paddingVertical: 12, fontFamily: font.body }}>
                No messages yet — share your match code here!
              </Text>
            ) : messages.map(msg => {
              const profile = getProfile(msg.user_id)
              const isMe = msg.user_id === currentUserId
              return (
                <View key={msg.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: isMe ? 'rgba(200,162,74,0.25)' : 'rgba(140,176,208,0.07)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 8, fontFamily: font.bold, color: isMe ? colors.oceanBright : colors.muted }}>
                        {profile?.username?.slice(0, 2).toUpperCase() ?? '?'}
                      </Text>
                    )}
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, color: '#e2e8f0', lineHeight: 17, fontFamily: font.body }}>
                    <Text style={{ fontSize: 11, fontFamily: font.bold, color: isMe ? colors.oceanBright : '#94a3b8' }}>
                      {profile?.username ?? 'Unknown'}{'  '}
                    </Text>
                    {msg.message}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder="Paste match code or message..."
              placeholderTextColor={colors.faint}
              style={{ flex: 1, backgroundColor: 'rgba(26,50,81,0.9)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.25)', borderRadius: 7, paddingVertical: 7, paddingHorizontal: 10, color: colors.text, fontSize: 12, fontFamily: font.body }}
            />
            <TouchableOpacity onPress={send} disabled={sending || !text.trim()} style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 7, backgroundColor: text.trim() ? colors.ocean : 'rgba(140,176,208,0.15)', justifyContent: 'center' }}>
              <Text style={{ color: text.trim() ? '#fff' : colors.faint, fontSize: 12, fontFamily: font.bold }}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
