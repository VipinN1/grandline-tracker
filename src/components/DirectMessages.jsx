import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCardImageUrl } from '../lib/optcgapi'
import SelectDecklistModal from './SelectDecklistModal'
import ProfilePopover from './ProfilePopover'

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function Avatar({ profile, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', border: '1px solid rgba(200,162,74,0.4)' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (profile?.username?.slice(0, 2).toUpperCase() ?? '??')}
    </div>
  )
}

// Compact decklist card rendered inside a message bubble.
function DeckMessage({ deck, onEnlarge }) {
  const [open, setOpen] = useState(false)
  if (!deck) return null
  const cards = deck.cards ?? []
  const count = cards.reduce((s, c) => s + (c.count ?? 0), 0)
  return (
    <div style={{ border: '1px solid rgba(200,162,74,0.25)', borderRadius: 10, overflow: 'hidden', background: 'rgba(140,176,208,0.06)', minWidth: 220 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}>
        <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: 30, height: 41, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0, border: '1px solid rgba(140,176,208,0.1)' }} onError={e => { e.target.style.opacity = '0.2' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
          <div style={{ fontSize: 10, color: '#9db2c6' }}>{count} cards · {deck.leader_name}</div>
        </div>
        <div style={{ fontSize: 10, color: '#52a9cd' }}>{open ? '▲' : '▼'}</div>
      </div>
      {open && (
        <div style={{ padding: 10, borderTop: '1px solid rgba(140,176,208,0.06)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {cards.flatMap(card =>
            Array.from({ length: card.count }, (_, i) => (
              <img key={`${card.id}-${i}`} src={getCardImageUrl(card.id)} alt={card.name} onClick={() => onEnlarge(getCardImageUrl(card.id))} title={`${card.name ?? card.id} (${card.id})`} style={{ width: 40, borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(140,176,208,0.08)' }} onError={e => { e.target.style.opacity = '0.15' }} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function DirectMessages({ session, isMobile, initialUserId }) {
  const me = session?.user?.id
  const [conversations, setConversations] = useState([])
  const [profiles, setProfiles] = useState({}) // id -> profile
  const [activeId, setActiveId] = useState(initialUserId ?? null)
  const [messages, setMessages] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pickDeck, setPickDeck] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [popoverProfile, setPopoverProfile] = useState(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
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
    // Make sure we have this user's profile (e.g. opened from their profile page).
    if (!profiles[otherId]) {
      const { data: p } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', otherId).single()
      if (p) setProfiles(prev => ({ ...prev, [p.id]: p }))
    }
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
  }, [me, profiles])

  // Initial load
  useEffect(() => { loadConversations() }, [loadConversations])

  // Open an initial conversation (deep link from a profile)
  useEffect(() => { if (initialUserId) openThread(initialUserId) }, [initialUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: new incoming messages
  useEffect(() => {
    if (!me) return
    const channel = supabase
      .channel(`dm_inbox_${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${me}` }, async (payload) => {
        const msg = payload.new
        if (activeIdRef.current && msg.sender_id === activeIdRef.current) {
          const { data } = await supabase.from('direct_messages').select('*, decklists(*)').eq('id', msg.id).single()
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, data ?? msg])
          await supabase.from('direct_messages').update({ read: true }).eq('id', msg.id)
        }
        loadConversations()
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [me, loadConversations])

  // Scroll thread to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, activeId])

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
    if (!t || !activeId || sending) return
    setSending(true)
    setText('')
    await insertMessage({ body: t })
    setSending(false)
  }

  async function handleImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activeId) return
    setSending(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `dm/${me}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('card-photos').upload(path, file, { contentType: file.type, upsert: false })
      if (!error) {
        const { data } = supabase.storage.from('card-photos').getPublicUrl(path)
        await insertMessage({ image_url: data.publicUrl })
      }
    } catch { /* ignore upload errors */ }
    setSending(false)
  }

  async function sendDeck(deck) {
    setPickDeck(false)
    if (!deck || !activeId) return
    await insertMessage({ decklist_id: deck.id, body: null })
  }

  const showThread = !isMobile || activeId
  const showList = !isMobile || !activeId
  const otherProfile = activeId ? profiles[activeId] : null

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', height: isMobile ? 'calc(100vh - 200px)' : 'min(70vh, 620px)' }}>
      {/* Conversation list */}
      {showList && (
        <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0, background: 'rgba(140,176,208,0.04)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#67809a', padding: '14px 16px 8px' }}>Conversations</div>
          {loadingConvos ? (
            <div style={{ padding: 20, fontSize: 13, color: '#9db2c6', textAlign: 'center' }}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '24px 16px', fontSize: 13, color: '#67809a', textAlign: 'center', lineHeight: 1.6 }}>No messages yet. Visit a user's profile and tap <span style={{ color: '#52a9cd' }}>Message</span> to start a chat.</div>
          ) : conversations.map(c => {
            const p = profiles[c.otherId]
            const m = c.last
            const preview = m.body || (m.image_url ? '📷 Photo' : m.decklist_id ? '🃏 Decklist' : '')
            return (
              <div key={c.otherId} onClick={() => openThread(c.otherId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: activeId === c.otherId ? 'rgba(140,176,208,0.12)' : 'transparent', borderLeft: activeId === c.otherId ? '2px solid #2f7da3' : '2px solid transparent' }} onMouseEnter={e => { if (activeId !== c.otherId) e.currentTarget.style.background = 'rgba(140,176,208,0.03)' }} onMouseLeave={e => { if (activeId !== c.otherId) e.currentTarget.style.background = 'transparent' }}>
                <Avatar profile={p} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.username ?? 'User'}</span>
                    <span style={{ fontSize: 10, color: '#67809a', marginLeft: 'auto', flexShrink: 0 }}>{timeAgo(m.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: c.unread ? '#9fd0e6' : '#9db2c6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.unread ? 700 : 400 }}>
                    {m.sender_id === me ? 'You: ' : ''}{preview}
                  </div>
                </div>
                {c.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#d24a3a', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{c.unread > 9 ? '9+' : c.unread}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Thread */}
      {showThread && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'rgba(140,176,208,0.04)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          {!activeId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#67809a', fontSize: 13, textAlign: 'center', padding: 20 }}>Select a conversation</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(140,176,208,0.07)', flexShrink: 0 }}>
                {isMobile && <button onClick={() => setActiveId(null)} style={{ background: 'none', border: 'none', color: '#52a9cd', fontSize: 18, cursor: 'pointer', padding: 0 }}>←</button>}
                <div onClick={() => otherProfile && setPopoverProfile(otherProfile)} title="View profile" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: otherProfile ? 'pointer' : 'default' }}>
                  <Avatar profile={otherProfile} size={32} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e9f1f8' }}>{otherProfile?.username ?? 'User'}</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingThread ? (
                  <div style={{ color: '#9db2c6', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</div>
                ) : messages.length === 0 ? (
                  <div style={{ color: '#67809a', fontSize: 13, textAlign: 'center', padding: 20 }}>No messages yet — say hi 👋</div>
                ) : messages.map(m => {
                  const mine = m.sender_id === me
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        {m.body && (
                          <div style={{ background: mine ? 'rgba(200,162,74,0.22)' : 'rgba(140,176,208,0.05)', border: `1px solid ${mine ? 'rgba(200,162,74,0.35)' : 'rgba(140,176,208,0.08)'}`, borderRadius: 12, padding: '8px 12px', fontSize: 13, color: '#e9f1f8', lineHeight: 1.45, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                        )}
                        {m.image_url && (
                          <img src={m.image_url} alt="" onClick={() => setLightbox(m.image_url)} style={{ maxWidth: 220, borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(140,176,208,0.1)' }} />
                        )}
                        {m.decklist_id && <DeckMessage deck={m.decklists} onEnlarge={setLightbox} />}
                        <span style={{ fontSize: 9, color: '#67809a' }}>{timeAgo(m.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(140,176,208,0.07)', flexShrink: 0 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} disabled={sending} title="Send image" style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 8, color: '#52a9cd', fontSize: 16, width: 36, height: 36, cursor: 'pointer', flexShrink: 0 }}>🖼</button>
                <button onClick={() => setPickDeck(true)} disabled={sending} title="Send decklist" style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 8, color: '#52a9cd', fontSize: 15, width: 36, height: 36, cursor: 'pointer', flexShrink: 0 }}>🃏</button>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
                  placeholder="Message…"
                  style={{ flex: 1, background: 'rgba(26,50,81,0.9)', border: '1px solid rgba(200,162,74,0.25)', borderRadius: 8, padding: '9px 12px', color: '#e9f1f8', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={sendText} disabled={sending || !text.trim()} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: text.trim() ? '#2f7da3' : 'rgba(140,176,208,0.15)', color: text.trim() ? '#fff' : '#67809a', fontSize: 13, fontWeight: 700, cursor: text.trim() && !sending ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0 }}>Send</button>
              </div>
            </>
          )}
        </div>
      )}

      {popoverProfile && <ProfilePopover profile={popoverProfile} session={session} onClose={() => setPopoverProfile(null)} />}
      {pickDeck && <SelectDecklistModal session={session} isMobile={isMobile} onClose={() => setPickDeck(false)} onSelect={sendDeck} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 12, border: '2px solid rgba(140,176,208,0.15)' }} />
        </div>
      )}
    </div>
  )
}
