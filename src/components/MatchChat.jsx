import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function MatchChat({ matchId, currentUserId, player1Id, player2Id, isAdmin, getProfile }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [hasNew, setHasNew] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)

  const canChat = currentUserId && (currentUserId === player1Id || currentUserId === player2Id || isAdmin)

  // Don't render for bye matches or non-participants
  if (!player2Id || !canChat) return null

  useEffect(() => {
    loadMessages()

    channelRef.current = supabase.channel(`match_chat_${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sim_match_messages',
        filter: `match_id=eq.${matchId}`
      }, payload => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        if (!open) setHasNew(true)
      })
      .subscribe()

    return () => { channelRef.current?.unsubscribe() }
  }, [matchId])

  useEffect(() => {
    if (open) {
      setHasNew(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open, messages.length])

  async function loadMessages() {
    const { data } = await supabase
      .from('sim_match_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || !currentUserId || sending) return
    setSending(true)
    await supabase.from('sim_match_messages').insert({
      match_id: matchId,
      user_id: currentUserId,
      message: trimmed
    })
    setText('')
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', color: '#7c6fa0',
          fontSize: 12, fontWeight: 600
        }}
      >
        <span style={{ position: 'relative' }}>
          💬
          {hasNew && !open && (
            <span style={{
              position: 'absolute', top: -2, right: -3,
              width: 7, height: 7, borderRadius: '50%',
              background: '#8b5cf6', border: '1px solid #0f1117'
            }} />
          )}
        </span>
        Match Chat
        <span style={{ fontSize: 10, color: '#3d2d6e' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {/* Message list */}
          <div style={{
            maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
            padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {messages.length === 0 ? (
              <div style={{ fontSize: 12, color: '#3d2d6e', textAlign: 'center', padding: '12px 0' }}>
                No messages yet — share your match code here!
              </div>
            ) : messages.map(msg => {
              const profile = getProfile(msg.user_id)
              const isMe = msg.user_id === currentUserId
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, background: isMe ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${isMe ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: isMe ? '#a78bfa' : '#7c6fa0',
                    flexShrink: 0, overflow: 'hidden'
                  }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (profile?.username?.slice(0, 2).toUpperCase() ?? '?')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? '#a78bfa' : '#94a3b8' }}>
                      {profile?.username ?? 'Unknown'}
                    </span>
                    <span style={{ fontSize: 12, color: '#e2e8f0', marginLeft: 6, wordBreak: 'break-all' }}>
                      {msg.message}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Paste match code or message..."
              style={{
                flex: 1, background: 'rgba(15,8,30,0.9)', border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: 7, padding: '7px 10px', color: '#f0f2f5', fontSize: 12,
                outline: 'none', fontFamily: 'inherit'
              }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              style={{
                padding: '7px 14px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
                background: text.trim() ? '#8b5cf6' : 'rgba(139,92,246,0.15)',
                color: text.trim() ? '#fff' : '#3d2d6e',
                fontSize: 12, fontWeight: 700, cursor: text.trim() && !sending ? 'pointer' : 'default',
                transition: 'all 0.15s'
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
