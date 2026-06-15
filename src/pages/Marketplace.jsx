import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchCards, getCardImageUrl } from '../lib/optcgapi'
import { useWindowSize } from '../hooks/useWindowSize'
import ProfilePopover from '../components/ProfilePopover'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

const CONDITION_COLORS = {
  'Near Mint': '#34d399',
  'Lightly Played': '#22d3ee',
  'Moderately Played': '#fbbf24',
  'Heavily Played': '#f97316',
  'Damaged': '#f05252',
}

const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']
const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']

const INPUT = {
  background: 'rgba(15,8,30,0.92)',
  border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#f0f2f5',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const LABEL = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: '#7c6fa0',
  marginBottom: 5,
  display: 'block',
}

function Avatar({ profile, size = 28, radius = 7 }) {
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#8b5cf622', border: '1px solid #8b5cf644', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(9, Math.floor(size * 0.32)), fontWeight: 700, color: '#8b5cf6', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  )
}

function ConditionBadge({ condition }) {
  const color = CONDITION_COLORS[condition] ?? '#7c6fa0'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${color}22`, color, border: `1px solid ${color}44`, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      {condition}
    </span>
  )
}

// ─── MessageModal ────────────────────────────────────────────────────────────

function MessageModal({ listing, currentUser, otherUser, onClose, isMobile }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const receiverId = otherUser?.id ?? listing?.user_id

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel(`listing-messages-${listing.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'marketplace_messages', filter: `listing_id=eq.${listing.id}` },
        payload => {
          setMessages(prev => {
            const exists = prev.find(m => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [listing.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('marketplace_messages')
      .select('*')
      .eq('listing_id', listing.id)
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    const unreadIds = (data ?? []).filter(m => m.receiver_id === currentUser.id && !m.read).map(m => m.id)
    if (unreadIds.length > 0) await supabase.from('marketplace_messages').update({ read: true }).in('id', unreadIds)
  }

  async function sendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    const { data } = await supabase
      .from('marketplace_messages')
      .insert({ listing_id: listing.id, sender_id: currentUser.id, receiver_id: receiverId, body: text.trim() })
      .select().single()
    if (data) {
      setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
    }
    setText('')
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 480, maxHeight: isMobile ? '90vh' : '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={listing.photo_url ? listing.photo_url : `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`}
            alt={listing.card_name}
            style={{ width: 30, height: 42, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}
            onError={e => {
              if (listing.photo_url && e.target.src === listing.photo_url) {
                e.target.src = `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`
              } else {
                e.target.style.display = 'none'
              }
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.card_name}</div>
            <div style={{ fontSize: 11, color: '#7c6fa0' }}>${Number(listing.price).toFixed(2)} · {otherUser?.username ?? 'Seller'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ color: '#7c6fa0', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: '#7c6fa0' }}>Start a conversation about this listing</div>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.sender_id === currentUser.id
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.06)', color: isMe ? '#fff' : '#f0f2f5', fontSize: 13, lineHeight: 1.5 }}>
                    {msg.body}
                    <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.5)' : '#3d2d6e', marginTop: 3, textAlign: 'right' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            style={{ ...INPUT, flex: 1 }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !text.trim()}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: text.trim() ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)', color: text.trim() ? '#fff' : '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ListingDetailModal ───────────────────────────────────────────────────────

function ListingDetailModal({ listing, currentUser, session, onClose, isMobile, onMarkSold, onMessageGuest }) {
  const [showMsg, setShowMsg] = useState(false)
  const [marking, setMarking] = useState(false)
  const [sellerProfile, setSellerProfile] = useState(null)
  const isOwner = listing?.user_id === currentUser?.id
  const seller = listing?.profiles

  async function handleMarkSold() {
    if (marking) return
    setMarking(true)
    await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', listing.id)
    onMarkSold?.(listing.id)
    onClose()
  }

  if (!listing) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 640, maxHeight: isMobile ? '95vh' : '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{listing.card_name}</div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <img
                  src={listing.photo_url ? listing.photo_url : `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`}
                  alt={listing.card_name}
                  style={{ width: isMobile ? '100%' : 180, maxWidth: 200, maxHeight: 260, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', objectFit: 'contain', background: '#1a1025' }}
                  onError={e => {
                    if (listing.photo_url && e.target.src === listing.photo_url) {
                      e.target.src = `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`
                    } else {
                      e.target.style.display = 'none'
                    }
                  }}
                />
                {listing.photo_url && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3d2d6e', marginBottom: 4 }}>Official Art</div>
                    <img
                      src={`https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`}
                      alt={`${listing.card_name} official art`}
                      style={{ width: 60, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f2f5', marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>${Number(listing.price).toFixed(2)}</div>
                <div style={{ marginBottom: 10 }}><ConditionBadge condition={listing.condition} /></div>
                <div style={{ fontSize: 12, color: '#7c6fa0', marginBottom: 3 }}>
                  {listing.card_color && <span style={{ color: COLORS[listing.card_color] ?? '#7c6fa0' }}>{listing.card_color}</span>}
                  {listing.card_color && listing.card_type && <span style={{ margin: '0 6px', color: '#3d2d6e' }}>·</span>}
                  {listing.card_type && <span>{listing.card_type}</span>}
                </div>
                {listing.card_id && <div style={{ fontSize: 11, color: '#3d2d6e', fontFamily: 'monospace', marginBottom: 3 }}>{listing.card_id}</div>}
                {listing.set_name && <div style={{ fontSize: 12, color: '#7c6fa0', marginBottom: 3 }}>{listing.set_name}</div>}
                {listing.city && <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 6 }}>📍 {listing.city}</div>}
              </div>
            </div>

            {listing.description && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#3d2d6e', marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 13, color: '#b0bac8', lineHeight: 1.6 }}>{listing.description}</div>
              </div>
            )}

            <div
              onClick={() => seller && setSellerProfile(seller)}
              style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: seller ? 'pointer' : 'default', transition: 'border-color 0.1s' }}
              onMouseEnter={e => { if (seller) e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)' }}
            >
              <Avatar profile={seller} size={40} radius={10} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{seller?.username ?? 'Unknown'}</div>
                {seller?.location && <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 2 }}>📍 {seller.location}</div>}
                {seller && <div style={{ fontSize: 10, color: '#3d2d6e', marginTop: 3 }}>Click to view profile</div>}
              </div>
              <div style={{ fontSize: 11, color: '#3d2d6e' }}>
                {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {isOwner ? (
              <button
                onClick={handleMarkSold}
                disabled={marking || listing.status === 'sold'}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: listing.status === 'sold' ? 'rgba(255,255,255,0.05)' : '#34d399', color: listing.status === 'sold' ? '#7c6fa0' : '#0f1117', fontSize: 13, fontWeight: 700, cursor: listing.status === 'sold' ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >
                {listing.status === 'sold' ? 'Sold ✓' : marking ? 'Marking...' : 'Mark as Sold'}
              </button>
            ) : (
              <button
                onClick={() => currentUser ? setShowMsg(true) : onMessageGuest?.()}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {currentUser ? 'Message Seller' : 'Sign in to Message'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showMsg && (
        <MessageModal
          listing={listing}
          currentUser={currentUser}
          otherUser={seller}
          onClose={() => setShowMsg(false)}
          isMobile={isMobile}
        />
      )}
      {sellerProfile && (
        <ProfilePopover
          profile={sellerProfile}
          session={session}
          onClose={() => setSellerProfile(null)}
        />
      )}
    </>
  )
}

// ─── ListingCard ──────────────────────────────────────────────────────────────

function ListingCard({ listing, currentUser, onDetail, onMessage }) {
  const [hovered, setHovered] = useState(false)
  const isOwner = listing.user_id === currentUser?.id
  const seller = listing.profiles
  const imgSrc = listing.photo_url ? listing.photo_url : `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`
  const cardColor = COLORS[listing.card_color]

  return (
    <div
      onClick={() => onDetail(listing)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'rgba(139,92,246,0.05)', border: `1px solid ${hovered ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.1)'}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transform: hovered ? 'translateY(-2px)' : 'none', transition: 'all 0.15s', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ position: 'relative', background: '#1a1025', height: 180, overflow: 'hidden' }}>
        <img
          src={imgSrc}
          alt={listing.card_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
          onError={e => {
            if (listing.photo_url && e.target.src === listing.photo_url) {
              e.target.src = `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`
            } else {
              e.target.style.display = 'none'
            }
          }}
        />
        {cardColor && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: cardColor }} />}
        {(listing.quantity ?? 1) > 1 && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>
            x{listing.quantity}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.card_name}</div>
        <div style={{ fontSize: 11, color: '#3d2d6e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.set_name && <span>{listing.set_name} · </span>}
          <span style={{ fontFamily: 'monospace' }}>{listing.card_id}</span>
        </div>
        <div style={{ marginTop: 2 }}><ConditionBadge condition={listing.condition} /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', fontFamily: "'Space Mono', monospace", marginTop: 3 }}>
          ${Number(listing.price).toFixed(2)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Avatar profile={seller} size={18} radius={5} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#7c6fa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seller?.username ?? 'Unknown'}
            {listing.city && <span style={{ color: '#3d2d6e' }}> · {listing.city}</span>}
          </div>
        </div>
        {isOwner ? (
          <div style={{ marginTop: 5, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your listing
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onMessage(listing) }}
            style={{ marginTop: 5, padding: '5px 10px', borderRadius: 7, border: currentUser ? 'none' : '1px solid rgba(139,92,246,0.25)', background: currentUser ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'transparent', color: currentUser ? '#fff' : '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
          >
            {currentUser ? 'Message Seller' : 'Sign in to Message'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── CreateListingModal ───────────────────────────────────────────────────────

function CreateListingModal({ session, profile, onClose, onSuccess, isMobile }) {
  const [step, setStep] = useState(1)
  const [cardQuery, setCardQuery] = useState('')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [condition, setCondition] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualCardId, setManualCardId] = useState('')
  const [manualColor, setManualColor] = useState('')
  const [manualType, setManualType] = useState('')
  const [manualSetName, setManualSetName] = useState('')
  const [filterColor, setFilterColor] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAltArt, setFilterAltArt] = useState('')
  const [filterCost, setFilterCost] = useState(null)
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (profile?.location) setCity(profile.location.split(',')[0].trim())
  }, [profile])

  useEffect(() => {
    function handleClick(e) { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleCardQuery(e) {
    const val = e.target.value
    setCardQuery(val)
    setDropdownOpen(true)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setCardResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setCardSearching(true)
      try { setCardResults(await searchCards(val)) }
      catch { setCardResults([]) }
      setCardSearching(false)
    }, 350)
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (manualMode ? !manualName.trim() : !selectedCard) { setError('Please select or enter a card.'); return }
    if (!price || !condition) { setError('Please fill in all required fields.'); return }
    if (parseFloat(price) <= 0) { setError('Price must be greater than 0.'); return }
    setSaving(true)
    setError('')
    let photo_url = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg'
      const uploadPath = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('card-photos')
        .upload(uploadPath, photoFile, { cacheControl: '3600', upsert: false, contentType: photoFile.type })
      if (uploadError) {
        setSaving(false)
        setError('Photo upload failed: ' + uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage.from('card-photos').getPublicUrl(uploadPath)
      photo_url = urlData?.publicUrl ?? null
    }
    const cardId = manualMode ? (manualCardId.trim() || `CUSTOM-${Date.now()}`) : (selectedCard.card_image_id ?? selectedCard.card_set_id)
    const cardName = manualMode ? manualName.trim() : selectedCard.card_name
    const cardColor = manualMode ? (manualColor || null) : (selectedCard.card_color ?? null)
    const cardType = manualMode ? (manualType || null) : (selectedCard.card_type ?? null)
    const cardSetName = manualMode ? (manualSetName.trim() || null) : (selectedCard.set_name ?? null)
    const { error: insertErr } = await supabase.from('marketplace_listings').insert({
      user_id: session.user.id,
      card_id: cardId,
      card_name: cardName,
      card_color: cardColor,
      card_type: cardType,
      set_name: cardSetName,
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      condition,
      description: description.trim() || null,
      city: city.trim() || null,
      photo_url,
      status: 'active',
    })
    setSaving(false)
    if (insertErr) { setError('Failed to create listing. Please try again.'); return }
    onSuccess()
    onClose()
  }

  const canAdvance = !!selectedCard || (manualMode && manualName.trim() !== '')
  const canSubmit = !saving

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 560, maxHeight: isMobile ? '95vh' : '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>New Listing</div>
            <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 1 }}>Step {step} of 2</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 140px)', padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {step === 1 ? (
            <>
              {manualMode ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, color: '#7c6fa0' }}>Enter card details manually.</div>
                    <button type="button" onClick={() => setManualMode(false)} style={{ fontSize: 12, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      ← Search instead
                    </button>
                  </div>
                  <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={LABEL}>Card Name *</label>
                      <input type="text" placeholder="e.g. Monkey D. Luffy" value={manualName} onChange={e => setManualName(e.target.value)} style={{ ...INPUT, width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ ...LABEL, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>Card ID <span style={{ fontWeight: 400, color: '#3d2d6e' }}>(optional — used for art preview)</span></label>
                      <input type="text" placeholder="e.g. OP01-001" value={manualCardId} onChange={e => setManualCardId(e.target.value)} style={{ ...INPUT, width: '100%' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={LABEL}>Color</label>
                        <select value={manualColor} onChange={e => setManualColor(e.target.value)} style={{ ...INPUT, width: '100%', cursor: 'pointer' }}>
                          <option value="">Select...</option>
                          {CARD_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="Other/Multi">Other/Multi</option>
                        </select>
                      </div>
                      <div>
                        <label style={LABEL}>Type</label>
                        <select value={manualType} onChange={e => setManualType(e.target.value)} style={{ ...INPUT, width: '100%', cursor: 'pointer' }}>
                          <option value="">Select...</option>
                          <option value="Leader">Leader</option>
                          <option value="Character">Character</option>
                          <option value="Event">Event</option>
                          <option value="Stage">Stage</option>
                          <option value="Don!!">Don!!</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ ...LABEL, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>Set Name <span style={{ fontWeight: 400, color: '#3d2d6e' }}>(optional)</span></label>
                      <input type="text" placeholder="e.g. Romance Dawn" value={manualSetName} onChange={e => setManualSetName(e.target.value)} style={{ ...INPUT, width: '100%' }} />
                    </div>
                  </div>
                  {manualCardId.trim() && (
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                      <img src={getCardImageUrl(manualCardId.trim())} alt="Card preview" style={{ width: 110, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} onError={e => { e.target.style.display = 'none' }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#7c6fa0' }}>Search for the card you want to sell.</div>
                  <div ref={dropdownRef}>
                    <label style={LABEL}>Card Name or ID *</label>
                    {selectedCard ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                        <img src={getCardImageUrl(selectedCard)} alt={selectedCard.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{selectedCard.card_name}</div>
                          <div style={{ fontSize: 11, color: COLORS[selectedCard.card_color] ?? '#7c6fa0', marginTop: 2 }}>
                            {selectedCard.card_color}{selectedCard.card_color && selectedCard.card_type ? ' · ' : ''}{selectedCard.card_type}{selectedCard.card_type ? ' · ' : ''}<span style={{ fontFamily: 'monospace' }}>{selectedCard.card_set_id}</span>
                          </div>
                        </div>
                        <button onClick={() => { setSelectedCard(null); setCardQuery('') }} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
                      </div>
                    ) : (
                      <>
                        {/* Filter pills */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                          {/* Color — toggle up to 2 for dual-color cards */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {[['', 'All'], ['Red', 'Red'], ['Blue', 'Blue'], ['Green', 'Green'], ['Purple', 'Purple'], ['Yellow', 'Yellow'], ['Black', 'Black']].map(([val, label]) => {
                              const isActive = val === '' ? filterColor.length === 0 : filterColor.includes(val)
                              const c = COLORS[val]
                              const atMax = filterColor.length >= 2 && !isActive && val !== ''
                              return (
                                <button key={val || 'fc-all'} onClick={() => {
                                  if (val === '') { setFilterColor([]); return }
                                  setFilterColor(prev => prev.includes(val) ? prev.filter(x => x !== val) : prev.length < 2 ? [...prev, val] : prev)
                                }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: atMax ? 'default' : 'pointer', fontFamily: 'inherit', opacity: atMax ? 0.35 : 1, border: isActive && c ? `1px solid ${c}66` : isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive && c ? `${c}26` : isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive && c ? c : isActive ? '#a78bfa' : '#7c6fa0' }}>{label}</button>
                              )
                            })}
                            {filterColor.length > 0 && <span style={{ fontSize: 10, color: '#3d2d6e', alignSelf: 'center', marginLeft: 2 }}>up to 2</span>}
                          </div>
                          {/* Type */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[['', 'All Types'], ['Leader', 'Leader'], ['Character', 'Character'], ['Event', 'Event'], ['Stage', 'Stage']].map(([val, label]) => {
                              const isActive = filterType === val
                              return (
                                <button key={val || 'ft-all'} onClick={() => setFilterType(val)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive ? '#a78bfa' : '#7c6fa0' }}>{label}</button>
                              )
                            })}
                          </div>
                          {/* Source */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <button onClick={() => setFilterSource('')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterSource === '' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterSource === '' ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterSource === '' ? '#a78bfa' : '#7c6fa0' }}>All</button>
                            <select
                              value={['', 'ST', 'Promos'].includes(filterSource) ? '' : filterSource}
                              onChange={e => setFilterSource(e.target.value)}
                              style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', background: !['', 'ST', 'Promos'].includes(filterSource) ? 'rgba(139,92,246,0.3)' : 'rgba(15,8,30,0.85)', border: !['', 'ST', 'Promos'].includes(filterSource) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.35)', color: !['', 'ST', 'Promos'].includes(filterSource) ? '#a78bfa' : '#7c6fa0' }}
                            >
                              <option value="">Booster Sets</option>
                              {['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP09','OP10','OP11','OP12','OP13','OP14','OP15','OP16','EB01','EB02','EB03','EB04','PRB01','PRB02'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <button onClick={() => setFilterSource('ST')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterSource === 'ST' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterSource === 'ST' ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterSource === 'ST' ? '#a78bfa' : '#7c6fa0' }}>Starter Decks</button>
                            <button onClick={() => setFilterSource('Promos')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterSource === 'Promos' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterSource === 'Promos' ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterSource === 'Promos' ? '#a78bfa' : '#7c6fa0' }}>Promos</button>
                          </div>
                          {/* Alt Art */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[['', 'All'], ['parallel', 'Parallel'], ['sp', 'SP'], ['manga', 'Manga'], ['tr', 'TR']].map(([val, label]) => {
                              const isActive = filterAltArt === val
                              const altColors = { parallel: '#e879f9', sp: '#34d399', manga: '#38bdf8', tr: '#f97316' }
                              const ac = altColors[val]
                              return (
                                <button key={val || 'fa-all'} onClick={() => setFilterAltArt(val)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: isActive && ac ? `1px solid ${ac}66` : isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive && ac ? `${ac}22` : isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive && ac ? ac : isActive ? '#a78bfa' : '#7c6fa0' }}>{label}</button>
                              )
                            })}
                          </div>
                          {/* Cost */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <button onClick={() => setFilterCost(null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterCost === null ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterCost === null ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterCost === null ? '#a78bfa' : '#7c6fa0' }}>All Costs</button>
                            {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                              const isActive = filterCost === n
                              return (
                                <button key={n} onClick={() => setFilterCost(isActive ? null : n)} style={{ padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive ? '#a78bfa' : '#7c6fa0' }}>{n}</button>
                              )
                            })}
                          </div>
                        </div>
                        <input type="text" placeholder="e.g. Monkey D. Luffy or OP14-120" value={cardQuery} onChange={handleCardQuery} onFocus={() => cardQuery.length >= 2 && setDropdownOpen(true)} style={{ ...INPUT, width: '100%', padding: '11px 14px', fontSize: 14 }} />
                        {dropdownOpen && cardQuery.length >= 2 && (
                          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, marginTop: 6, background: 'rgba(12,8,20,0.98)' }}>
                            {cardSearching ? (
                              <div style={{ padding: 14, fontSize: 13, color: '#7c6fa0' }}>Searching...</div>
                            ) : (() => {
                              function getAltArtType(card) {
                                const name = (card.card_name ?? '').toLowerCase()
                                const rarity = (card.card_rarity ?? '').toLowerCase()
                                if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
                                if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
                                if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
                                if (/parallel|alt[\s_]art|alternate[\s_]art/.test(name) || rarity === 'parallel' || rarity === 'p') return 'parallel'
                                return null
                              }
                              const filtered = cardResults.filter(card => {
                                if (filterColor.length > 0) {
                                  const cardColors = (card.card_color ?? '').split(/[\s/]+/).map(c => c.trim()).filter(Boolean)
                                  if (!filterColor.every(fc => cardColors.some(cc => cc.toLowerCase() === fc.toLowerCase()))) return false
                                }
                                if (filterType && card.card_type !== filterType) return false
                                const id = card.card_set_id ?? ''
                                if (filterSource === 'ST' && !/^ST/i.test(id)) return false
                                if (filterSource === 'Promos' && !/^P-/i.test(id)) return false
                                if (filterSource && filterSource !== 'ST' && filterSource !== 'Promos') {
                                  if (!id.toUpperCase().startsWith(filterSource)) return false
                                }
                                if (filterAltArt && getAltArtType(card) !== filterAltArt) return false
                                if (filterCost !== null && String(card.card_cost ?? '') !== String(filterCost)) return false
                                return true
                              })
                              if (filtered.length === 0) return <div style={{ padding: 14, fontSize: 13, color: '#3d2d6e' }}>No cards found</div>
                              const ALT_BADGES = {
                                sp:       { label: 'SP',       color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
                                tr:       { label: 'TR',       color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
                                manga:    { label: 'MANGA',    color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' },
                                parallel: { label: 'PARALLEL', color: '#e879f9', bg: 'rgba(232,121,249,0.12)',border: 'rgba(232,121,249,0.3)' },
                              }
                              return filtered.map(card => {
                                const cid = card.card_set_id ?? ''
                                const isPromo = /^P-/i.test(cid)
                                const isST = /^ST/i.test(cid)
                                const altType = getAltArtType(card)
                                const badge = isPromo
                                  ? { label: 'PROMO', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' }
                                  : isST
                                  ? { label: 'ST', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' }
                                  : altType ? ALT_BADGES[altType]
                                  : null
                                return (
                                  <div key={card.card_image_id ?? card.card_set_id} onClick={() => { setSelectedCard(card); setCardQuery(''); setDropdownOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</span>
                                        {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, letterSpacing: '0.5px', flexShrink: 0 }}>{badge.label}</span>}
                                      </div>
                                      <div style={{ fontSize: 12, color: '#7c6fa0' }}>
                                        {card.card_color && <span style={{ color: COLORS[card.card_color] ?? '#7c6fa0' }}>{card.card_color}</span>}
                                        {card.card_color && card.card_type && <span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span>}
                                        {card.card_type && <span>{card.card_type}</span>}
                                        {card.card_type && <span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span>}
                                        <span style={{ fontFamily: 'monospace' }}>{card.card_set_id}</span>
                                        {card.set_name && <><span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span><span>{card.set_name}</span></>}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {selectedCard && (
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                      <img src={getCardImageUrl(selectedCard)} alt={selectedCard.card_name} style={{ width: 110, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} onError={e => { e.target.style.opacity = '0.2' }} />
                    </div>
                  )}
                  {!selectedCard && (
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <button type="button" onClick={() => setManualMode(true)} style={{ fontSize: 12, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                        Can't find your card? Enter manually →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 8, padding: '10px 12px' }}>
                <img
                  src={getCardImageUrl(manualMode ? manualCardId.trim() : (selectedCard ?? ''))}
                  alt={manualMode ? manualName : selectedCard?.card_name}
                  style={{ width: 36, height: 50, objectFit: 'cover', objectPosition: 'top', borderRadius: 5, flexShrink: 0 }}
                  onError={e => { e.target.style.opacity = '0.2' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>
                    {manualMode ? manualName : selectedCard?.card_name}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS[manualMode ? manualColor : selectedCard?.card_color] ?? '#7c6fa0', marginTop: 1 }}>
                    {manualMode ? (
                      <>
                        {manualColor && <span>{manualColor}</span>}
                        {manualColor && (manualCardId || manualType) && <span> · </span>}
                        {manualType && <span>{manualType}</span>}
                        {manualType && manualCardId && <span> · </span>}
                        {manualCardId && <span style={{ fontFamily: 'monospace' }}>{manualCardId}</span>}
                        {!manualColor && !manualType && !manualCardId && <span style={{ color: '#3d2d6e' }}>Manual entry</span>}
                      </>
                    ) : (
                      <>{selectedCard?.card_color} · <span style={{ fontFamily: 'monospace' }}>{selectedCard?.card_set_id}</span></>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LABEL}>Price (USD) *</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} style={{ ...INPUT, width: '100%' }} />
                </div>
                <div>
                  <label style={LABEL}>Quantity</label>
                  <input type="number" min="1" max="99" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...INPUT, width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={LABEL}>Condition *</label>
                <select value={condition} onChange={e => setCondition(e.target.value)} style={{ ...INPUT, width: '100%', cursor: 'pointer' }}>
                  <option value="">Select condition...</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Description</label>
                <textarea placeholder="Optional: describe condition, shipping info, etc." value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} style={{ ...INPUT, width: '100%', minHeight: 80, resize: 'vertical' }} />
                <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 3, textAlign: 'right' }}>{description.length}/500</div>
              </div>
              <div>
                <label style={LABEL}>City</label>
                <input type="text" placeholder="e.g. Los Angeles" value={city} onChange={e => setCity(e.target.value)} style={{ ...INPUT, width: '100%' }} />
              </div>
              <div>
                <label style={LABEL}>Photo (optional)</label>
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: 12, color: '#7c6fa0', cursor: 'pointer' }} />
                {photoPreview && (
                  <div style={{ marginTop: 10 }}>
                    <img src={photoPreview} alt="preview" style={{ maxWidth: 150, maxHeight: 200, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', objectFit: 'contain', display: 'block' }} />
                    <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} style={{ marginTop: 5, fontSize: 11, color: '#f05252', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'block' }}>Remove photo</button>
                  </div>
                )}
              </div>
              {error && <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', borderRadius: 7, padding: '8px 12px', border: '1px solid rgba(240,82,82,0.2)' }}>{error}</div>}
            </>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', gap: 8 }}>
          {step === 2 && (
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Back
            </button>
          )}
          <button
            onClick={step === 1 ? () => canAdvance && setStep(2) : handleSubmit}
            disabled={step === 1 ? !canAdvance : !canSubmit}
            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: (step === 1 ? canAdvance : canSubmit) ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)', color: (step === 1 ? canAdvance : canSubmit) ? '#fff' : '#7c6fa0', fontSize: 13, fontWeight: 700, cursor: (step === 1 ? canAdvance : canSubmit) ? 'pointer' : 'default', fontFamily: 'inherit' }}
          >
            {step === 1 ? 'Continue →' : saving ? 'Creating...' : 'Create Listing'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EditListingModal ─────────────────────────────────────────────────────────

function EditListingModal({ listing, session, onClose, onSuccess, isMobile }) {
  const [price, setPrice] = useState(String(listing.price))
  const [quantity, setQuantity] = useState(String(listing.quantity ?? 1))
  const [condition, setCondition] = useState(listing.condition)
  const [description, setDescription] = useState(listing.description ?? '')
  const [city, setCity] = useState(listing.city ?? '')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(listing.photo_url ?? null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setRemovePhoto(false)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!price || !condition) { setError('Price and condition are required.'); return }
    if (parseFloat(price) <= 0) { setError('Price must be greater than 0.'); return }
    setSaving(true)
    setError('')
    let photo_url = removePhoto ? null : listing.photo_url
    if (photoFile) {
      try {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const { data: up, error: upErr } = await supabase.storage.from('card-photos').upload(`${session.user.id}/${uid}.${ext}`, photoFile, { contentType: photoFile.type })
        if (!upErr && up) {
          const { data: urlData } = supabase.storage.from('card-photos').getPublicUrl(up.path)
          photo_url = urlData?.publicUrl ?? null
        }
      } catch {}
    }
    const { error: updateErr } = await supabase.from('marketplace_listings').update({ price: parseFloat(price), quantity: parseInt(quantity) || 1, condition, description: description.trim() || null, city: city.trim() || null, photo_url, updated_at: new Date().toISOString() }).eq('id', listing.id)
    setSaving(false)
    if (updateErr) { setError('Failed to update listing.'); return }
    onSuccess()
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 520, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Edit Listing</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', opacity: 0.7 }}>
            <img src={getCardImageUrl(listing.card_id)} alt={listing.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{listing.card_name}</div>
              <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 1 }}>Card selection locked</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Price (USD) *</label>
              <input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} style={{ ...INPUT, width: '100%' }} />
            </div>
            <div>
              <label style={LABEL}>Quantity</label>
              <input type="number" min="1" max="99" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...INPUT, width: '100%' }} />
            </div>
          </div>
          <div>
            <label style={LABEL}>Condition *</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} style={{ ...INPUT, width: '100%', cursor: 'pointer' }}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} style={{ ...INPUT, width: '100%', minHeight: 80, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 3, textAlign: 'right' }}>{description.length}/500</div>
          </div>
          <div>
            <label style={LABEL}>City</label>
            <input type="text" placeholder="e.g. Los Angeles" value={city} onChange={e => setCity(e.target.value)} style={{ ...INPUT, width: '100%' }} />
          </div>
          <div>
            <label style={LABEL}>Photo</label>
            {photoPreview && !removePhoto && (
              <div style={{ marginBottom: 10 }}>
                <img src={photoPreview} alt="preview" style={{ maxWidth: 150, maxHeight: 200, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', objectFit: 'contain', display: 'block' }} />
                <button onClick={() => { setRemovePhoto(true); setPhotoPreview(null); setPhotoFile(null) }} style={{ marginTop: 5, fontSize: 11, color: '#f05252', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'block' }}>Remove photo</button>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: 12, color: '#7c6fa0', cursor: 'pointer' }} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', borderRadius: 7, padding: '8px 12px', border: '1px solid rgba(240,82,82,0.2)' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.12)', flexShrink: 0 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: saving ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: saving ? '#7c6fa0' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── InboxSection ─────────────────────────────────────────────────────────────

function InboxSection({ session, isMobile }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeConvo, setActiveConvo] = useState(null)

  useEffect(() => { loadConversations() }, [session.user.id])

  async function loadConversations() {
    setLoading(true)
    const { data: msgs } = await supabase
      .from('marketplace_messages')
      .select('*')
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })

    if (!msgs || msgs.length === 0) { setLoading(false); return }

    // Group by (listing_id, other_user)
    const seen = new Map()
    const grouped = []
    for (const msg of msgs) {
      const otherId = msg.sender_id === session.user.id ? msg.receiver_id : msg.sender_id
      const key = `${msg.listing_id}::${otherId}`
      if (!seen.has(key)) { seen.set(key, true); grouped.push({ key, listingId: msg.listing_id, otherId, lastMsg: msg }) }
    }

    const listingIds = [...new Set(grouped.map(g => g.listingId))]
    const otherIds = [...new Set(grouped.map(g => g.otherId))]
    const [{ data: listings }, { data: profiles }, { data: unreadMsgs }] = await Promise.all([
      supabase.from('marketplace_listings').select('id, card_id, card_name, price, photo_url, user_id').in('id', listingIds),
      supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds),
      supabase.from('marketplace_messages').select('listing_id, sender_id').eq('receiver_id', session.user.id).eq('read', false),
    ])

    const listingMap = Object.fromEntries((listings ?? []).map(l => [l.id, l]))
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const unreadMap = {}
    ;(unreadMsgs ?? []).forEach(m => {
      const k = `${m.listing_id}::${m.sender_id}`
      unreadMap[k] = (unreadMap[k] ?? 0) + 1
    })

    setConversations(grouped.map(g => ({
      ...g,
      listing: listingMap[g.listingId] ?? null,
      otherProfile: profileMap[g.otherId] ?? null,
      unreadCount: unreadMap[`${g.listingId}::${g.otherId}`] ?? 0,
    })))
    setLoading(false)
  }

  if (loading) return <div style={{ fontSize: 13, color: '#7c6fa0', textAlign: 'center', padding: 20 }}>Loading messages...</div>
  if (conversations.length === 0) return (
    <div style={{ textAlign: 'center', padding: '36px 20px', color: '#3d2d6e' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>✉️</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#7c6fa0', marginBottom: 4 }}>No messages yet</div>
      <div style={{ fontSize: 12 }}>Messages from buyers and sellers will appear here</div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {conversations.map(c => (
          <div
            key={c.key}
            onClick={() => setActiveConvo(c)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.unreadCount > 0 ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.1)' }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,0.05)', border: `1px solid ${c.unreadCount > 0 ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.1)'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
          >
            <img src={getCardImageUrl(c.listing?.card_id ?? '')} alt={c.listing?.card_name ?? ''} style={{ width: 30, height: 42, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0, border: '1px solid rgba(255,255,255,0.06)' }} onError={e => { e.target.style.opacity = '0.2' }} />
            <Avatar profile={c.otherProfile} size={30} radius={7} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.listing?.card_name ?? 'Unknown listing'}</div>
              <div style={{ fontSize: 11, color: '#7c6fa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                {c.otherProfile?.username ?? 'Unknown'} · {c.lastMsg.body.slice(0, 60)}{c.lastMsg.body.length > 60 ? '...' : ''}
              </div>
            </div>
            {c.unreadCount > 0 && (
              <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#8b5cf6', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                {c.unreadCount}
              </div>
            )}
          </div>
        ))}
      </div>

      {activeConvo && activeConvo.listing && (
        <MessageModal
          listing={activeConvo.listing}
          currentUser={session.user}
          otherUser={activeConvo.otherProfile}
          onClose={() => { setActiveConvo(null); loadConversations() }}
          isMobile={isMobile}
        />
      )}
    </>
  )
}

// ─── WantMessageModal ─────────────────────────────────────────────────────────

function WantMessageModal({ want, currentUser, otherUser, onClose, isMobile }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const receiverId = otherUser?.id ?? want?.user_id

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel(`want-messages-${want.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'want_messages', filter: `want_id=eq.${want.id}` },
        payload => setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [want.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('want_messages')
      .select('*')
      .eq('want_id', want.id)
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    const unreadIds = (data ?? []).filter(m => m.receiver_id === currentUser.id && !m.read).map(m => m.id)
    if (unreadIds.length > 0) await supabase.from('want_messages').update({ read: true }).in('id', unreadIds)
  }

  async function sendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    const { data } = await supabase
      .from('want_messages')
      .insert({ want_id: want.id, sender_id: currentUser.id, receiver_id: receiverId, body: text.trim() })
      .select().single()
    if (data) setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
    setText('')
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 480, maxHeight: isMobile ? '90vh' : '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={`https://optcgapi.com/media/static/Card_Images/${want.card_id}.jpg`}
            alt={want.card_name}
            style={{ width: 30, height: 42, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {want.card_name} <span style={{ color: '#7c6fa0', fontWeight: 400 }}>x{want.quantity}</span>
            </div>
            <div style={{ fontSize: 11, color: '#7c6fa0' }}>Wanted by {otherUser?.username ?? 'Buyer'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ color: '#7c6fa0', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: '#7c6fa0' }}>Let them know you have this card!</div>
            </div>
          ) : messages.map(msg => {
            const isMe = msg.sender_id === currentUser.id
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.06)', color: isMe ? '#fff' : '#f0f2f5', fontSize: 13, lineHeight: 1.5 }}>
                  {msg.body}
                  <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.5)' : '#3d2d6e', marginTop: 3, textAlign: 'right' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} style={{ ...INPUT, flex: 1 }} />
          <button onClick={sendMessage} disabled={sending || !text.trim()} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: text.trim() ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)', color: text.trim() ? '#fff' : '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CreateWantModal ──────────────────────────────────────────────────────────

function CreateWantModal({ session, profile, onClose, onSuccess, isMobile }) {
  const [cardQuery, setCardQuery] = useState('')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [maxPrice, setMaxPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterColor, setFilterColor] = useState([])
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterAltArt, setFilterAltArt] = useState('')
  const [filterCost, setFilterCost] = useState(null)
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleCardQuery(e) {
    const val = e.target.value
    setCardQuery(val)
    setDropdownOpen(true)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setCardResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setCardSearching(true)
      try { setCardResults(await searchCards(val)) } catch { setCardResults([]) }
      setCardSearching(false)
    }, 350)
  }

  function getAltArtType(card) {
    const name = (card.card_name ?? '').toLowerCase()
    const rarity = (card.card_rarity ?? '').toLowerCase()
    if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
    if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
    if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
    if (/parallel|alt[\s_]art|alternate[\s_]art/.test(name) || rarity === 'parallel' || rarity === 'p') return 'parallel'
    return null
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!selectedCard) { setError('Please select a card.'); return }
    setSaving(true)
    setError('')
    let photo_url = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg'
      const uploadPath = `${session.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('card-photos')
        .upload(uploadPath, photoFile, { cacheControl: '3600', upsert: false, contentType: photoFile.type })
      if (uploadError) {
        setSaving(false)
        setError('Photo upload failed: ' + uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage.from('card-photos').getPublicUrl(uploadPath)
      photo_url = urlData?.publicUrl ?? null
    }
    const cardId = selectedCard.card_image_id ?? selectedCard.card_set_id
    const { error: insertErr } = await supabase.from('marketplace_wants').insert({
      user_id: session.user.id,
      card_id: cardId,
      card_name: selectedCard.card_name,
      card_color: selectedCard.card_color ?? null,
      card_type: selectedCard.card_type ?? null,
      set_name: selectedCard.set_name ?? null,
      quantity: parseInt(quantity) || 1,
      max_price: maxPrice ? parseFloat(maxPrice) : null,
      notes: notes.trim() || null,
      custom_title: customTitle.trim() || null,
      photo_url,
      status: 'active',
    })
    setSaving(false)
    if (insertErr) { setError('Failed to post want. Please try again.'); return }
    onSuccess()
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 520, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Looking For</div>
            <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 1 }}>Post a card you want to find</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div ref={dropdownRef}>
            <label style={LABEL}>Card *</label>
            {selectedCard ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                <img src={getCardImageUrl(selectedCard)} alt={selectedCard.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{selectedCard.card_name}</div>
                  <div style={{ fontSize: 11, color: COLORS[selectedCard.card_color] ?? '#7c6fa0', marginTop: 2 }}>
                    {selectedCard.card_color}{selectedCard.card_color && selectedCard.card_type ? ' · ' : ''}{selectedCard.card_type}{selectedCard.card_type ? ' · ' : ''}<span style={{ fontFamily: 'monospace' }}>{selectedCard.card_set_id}</span>
                  </div>
                </div>
                <button onClick={() => { setSelectedCard(null); setCardQuery('') }} style={{ background: 'none', border: 'none', color: '#7c6fa0', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                {/* Filter pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                  {/* Color */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {[['', 'All'], ['Red', 'Red'], ['Blue', 'Blue'], ['Green', 'Green'], ['Purple', 'Purple'], ['Yellow', 'Yellow'], ['Black', 'Black']].map(([val, label]) => {
                      const isActive = val === '' ? filterColor.length === 0 : filterColor.includes(val)
                      const c = COLORS[val]
                      const atMax = filterColor.length >= 2 && !isActive && val !== ''
                      return (
                        <button key={val || 'fc-all'} onClick={() => {
                          if (val === '') { setFilterColor([]); return }
                          setFilterColor(prev => prev.includes(val) ? prev.filter(x => x !== val) : prev.length < 2 ? [...prev, val] : prev)
                        }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: atMax ? 'default' : 'pointer', fontFamily: 'inherit', opacity: atMax ? 0.35 : 1, border: isActive && c ? `1px solid ${c}66` : isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive && c ? `${c}26` : isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive && c ? c : isActive ? '#a78bfa' : '#7c6fa0' }}>{label}</button>
                      )
                    })}
                    {filterColor.length > 0 && <span style={{ fontSize: 10, color: '#3d2d6e', alignSelf: 'center', marginLeft: 2 }}>up to 2</span>}
                  </div>
                  {/* Type */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[['', 'All Types'], ['Leader', 'Leader'], ['Character', 'Character'], ['Event', 'Event'], ['Stage', 'Stage']].map(([val, label]) => {
                      const isActive = filterType === val
                      return (
                        <button key={val || 'ft-all'} onClick={() => setFilterType(val)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive ? '#a78bfa' : '#7c6fa0' }}>{label}</button>
                      )
                    })}
                  </div>
                  {/* Source */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => setFilterSource('')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterSource === '' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterSource === '' ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterSource === '' ? '#a78bfa' : '#7c6fa0' }}>All</button>
                    <select
                      value={['', 'ST', 'Promos'].includes(filterSource) ? '' : filterSource}
                      onChange={e => setFilterSource(e.target.value)}
                      style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', background: !['', 'ST', 'Promos'].includes(filterSource) ? 'rgba(139,92,246,0.3)' : 'rgba(15,8,30,0.85)', border: !['', 'ST', 'Promos'].includes(filterSource) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.35)', color: !['', 'ST', 'Promos'].includes(filterSource) ? '#a78bfa' : '#7c6fa0' }}
                    >
                      <option value="">Booster Sets</option>
                      {['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP09','OP10','OP11','OP12','OP13','OP14','OP15','OP16','EB01','EB02','EB03','EB04','PRB01','PRB02'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button onClick={() => setFilterSource('ST')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterSource === 'ST' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterSource === 'ST' ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterSource === 'ST' ? '#a78bfa' : '#7c6fa0' }}>Starter Decks</button>
                    <button onClick={() => setFilterSource('Promos')} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterSource === 'Promos' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterSource === 'Promos' ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterSource === 'Promos' ? '#a78bfa' : '#7c6fa0' }}>Promos</button>
                  </div>
                  {/* Alt Art */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[['', 'All'], ['parallel', 'Parallel'], ['sp', 'SP'], ['manga', 'Manga'], ['tr', 'TR']].map(([val, label]) => {
                      const isActive = filterAltArt === val
                      const altColors = { parallel: '#e879f9', sp: '#34d399', manga: '#38bdf8', tr: '#f97316' }
                      const ac = altColors[val]
                      return (
                        <button key={val || 'fa-all'} onClick={() => setFilterAltArt(val)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: isActive && ac ? `1px solid ${ac}66` : isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive && ac ? `${ac}22` : isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive && ac ? ac : isActive ? '#a78bfa' : '#7c6fa0' }}>{label}</button>
                      )
                    })}
                  </div>
                  {/* Cost */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => setFilterCost(null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: filterCost === null ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: filterCost === null ? 'rgba(139,92,246,0.2)' : 'transparent', color: filterCost === null ? '#a78bfa' : '#7c6fa0' }}>All Costs</button>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                      const isActive = filterCost === n
                      return (
                        <button key={n} onClick={() => setFilterCost(isActive ? null : n)} style={{ padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)', background: isActive ? 'rgba(139,92,246,0.2)' : 'transparent', color: isActive ? '#a78bfa' : '#7c6fa0' }}>{n}</button>
                      )
                    })}
                  </div>
                </div>
                <input type="text" placeholder="e.g. Monkey D. Luffy or OP01-001" value={cardQuery} onChange={handleCardQuery} onFocus={() => cardQuery.length >= 2 && setDropdownOpen(true)} style={{ ...INPUT, width: '100%', padding: '11px 14px', fontSize: 14 }} />
                {dropdownOpen && cardQuery.length >= 2 && (
                  <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, marginTop: 6, background: 'rgba(12,8,20,0.98)' }}>
                    {cardSearching ? (
                      <div style={{ padding: 14, fontSize: 13, color: '#7c6fa0' }}>Searching...</div>
                    ) : (() => {
                      const ALT_BADGES = {
                        sp:       { label: 'SP',       color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)' },
                        tr:       { label: 'TR',       color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
                        manga:    { label: 'MANGA',    color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' },
                        parallel: { label: 'PARALLEL', color: '#e879f9', bg: 'rgba(232,121,249,0.12)',border: 'rgba(232,121,249,0.3)' },
                      }
                      const filtered = cardResults.filter(card => {
                        if (filterColor.length > 0) {
                          const cardColors = (card.card_color ?? '').split(/[\s/]+/).map(c => c.trim()).filter(Boolean)
                          if (!filterColor.every(fc => cardColors.some(cc => cc.toLowerCase() === fc.toLowerCase()))) return false
                        }
                        if (filterType && card.card_type !== filterType) return false
                        const id = card.card_set_id ?? ''
                        if (filterSource === 'ST' && !/^ST/i.test(id)) return false
                        if (filterSource === 'Promos' && !/^P-/i.test(id)) return false
                        if (filterSource && filterSource !== 'ST' && filterSource !== 'Promos') {
                          if (!id.toUpperCase().startsWith(filterSource)) return false
                        }
                        if (filterAltArt && getAltArtType(card) !== filterAltArt) return false
                        if (filterCost !== null && String(card.card_cost ?? '') !== String(filterCost)) return false
                        return true
                      })
                      if (filtered.length === 0) return <div style={{ padding: 14, fontSize: 13, color: '#3d2d6e' }}>No cards found</div>
                      return filtered.map(card => {
                        const cid = card.card_set_id ?? ''
                        const isPromo = /^P-/i.test(cid)
                        const isST = /^ST/i.test(cid)
                        const altType = getAltArtType(card)
                        const badge = isPromo
                          ? { label: 'PROMO', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' }
                          : isST
                          ? { label: 'ST', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' }
                          : altType ? ALT_BADGES[altType]
                          : null
                        return (
                          <div key={card.card_image_id ?? card.card_set_id} onClick={() => { setSelectedCard(card); setCardQuery(''); setDropdownOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <img src={getCardImageUrl(card)} alt={card.card_name} style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</span>
                                {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, letterSpacing: '0.5px', flexShrink: 0 }}>{badge.label}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: '#7c6fa0' }}>
                                {card.card_color && <span style={{ color: COLORS[card.card_color] ?? '#7c6fa0' }}>{card.card_color}</span>}
                                {card.card_color && card.card_type && <span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span>}
                                {card.card_type && <span>{card.card_type}</span>}
                                {card.card_type && <span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span>}
                                <span style={{ fontFamily: 'monospace' }}>{card.card_set_id}</span>
                                {card.set_name && <><span style={{ color: '#3d2d6e', margin: '0 4px' }}>·</span><span>{card.set_name}</span></>}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
          {selectedCard && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0 }}>
                <img
                  src={photoPreview ?? getCardImageUrl(selectedCard)}
                  alt={selectedCard.card_name}
                  style={{ width: 80, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }}
                  onError={e => { if (!photoPreview) e.target.style.opacity = '0.2' }}
                />
                {photoPreview && (
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} style={{ marginTop: 4, fontSize: 10, color: '#f05252', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'block', width: '100%', textAlign: 'center' }}>Remove</button>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={LABEL}>Post Title <span style={{ fontWeight: 400, color: '#3d2d6e', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</span></label>
                  <input
                    type="text"
                    placeholder={selectedCard.card_name}
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value.slice(0, 80))}
                    style={{ ...INPUT, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={LABEL}>Photo <span style={{ fontWeight: 400, color: '#3d2d6e', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</span></label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: 12, color: '#7c6fa0', cursor: 'pointer' }} />
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Quantity *</label>
              <input type="number" min="1" max="99" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...INPUT, width: '100%' }} />
            </div>
            <div>
              <label style={LABEL}>Max Price <span style={{ fontWeight: 400, color: '#3d2d6e', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</span></label>
              <input type="number" min="0" step="0.01" placeholder="$0.00" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ ...INPUT, width: '100%' }} />
            </div>
          </div>
          <div>
            <label style={LABEL}>Notes <span style={{ fontWeight: 400, color: '#3d2d6e', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</span></label>
            <textarea placeholder="Any condition preferences, specific art, etc." value={notes} onChange={e => setNotes(e.target.value.slice(0, 300))} style={{ ...INPUT, width: '100%', minHeight: 70, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 3, textAlign: 'right' }}>{notes.length}/300</div>
          </div>
          {error && <div style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', borderRadius: 7, padding: '8px 12px', border: '1px solid rgba(240,82,82,0.2)' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.12)', flexShrink: 0 }}>
          <button onClick={handleSubmit} disabled={!selectedCard || saving} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: selectedCard && !saving ? 'linear-gradient(135deg, #d97706, #fbbf24)' : 'rgba(255,255,255,0.05)', color: selectedCard && !saving ? '#0f1117' : '#7c6fa0', fontSize: 13, fontWeight: 700, cursor: selectedCard && !saving ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {saving ? 'Posting...' : 'Post Want'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WantDetailModal ──────────────────────────────────────────────────────────

function WantDetailModal({ want, currentUser, session, onClose, onContact, isMobile }) {
  const [posterProfile, setPosterProfile] = useState(null)
  const isOwner = want?.user_id === currentUser?.id
  const poster = want?.profiles

  if (!want) return null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(251,191,36,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 560, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(251,191,36,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(251,191,36,0.9)', color: '#0f1117', letterSpacing: '0.4px' }}>WTB</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{want.card_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <img
              src={want.photo_url ?? `https://optcgapi.com/media/static/Card_Images/${want.card_id}.jpg`}
              alt={want.card_name}
              style={{ width: isMobile ? '100%' : 160, maxWidth: 180, maxHeight: 230, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', objectFit: 'contain', background: '#1a1025', flexShrink: 0 }}
              onError={e => {
                if (want.photo_url && e.target.src === want.photo_url) {
                  e.target.src = `https://optcgapi.com/media/static/Card_Images/${want.card_id}.jpg`
                } else {
                  e.target.style.display = 'none'
                }
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {want.max_price ? (
                <div style={{ fontSize: 26, fontWeight: 700, color: '#fbbf24', marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>Up to ${Number(want.max_price).toFixed(2)}</div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>Price negotiable</div>
              )}
              {want.quantity > 1 && (
                <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 6 }}>Quantity: {want.quantity}</div>
              )}
              <div style={{ fontSize: 12, color: '#7c6fa0', marginBottom: 3 }}>
                {want.card_color && <span style={{ color: COLORS[want.card_color] ?? '#7c6fa0' }}>{want.card_color}</span>}
              </div>
              {want.card_id && <div style={{ fontSize: 11, color: '#3d2d6e', fontFamily: 'monospace', marginBottom: 3 }}>{want.card_id}</div>}
              {want.set_name && <div style={{ fontSize: 12, color: '#7c6fa0', marginBottom: 3 }}>{want.set_name}</div>}
            </div>
          </div>

          {want.notes && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#3d2d6e', marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 13, color: '#b0bac8', lineHeight: 1.6 }}>{want.notes}</div>
            </div>
          )}

          <div
            style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <Avatar profile={poster} size={40} radius={10} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{poster?.username ?? 'Unknown'}</div>
              {poster?.location && <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 2 }}>📍 {poster.location}</div>}
            </div>
            <div style={{ fontSize: 11, color: '#3d2d6e' }}>
              {new Date(want.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {!isOwner && (
            <button
              onClick={() => { onClose(); onContact(want) }}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: currentUser ? 'linear-gradient(135deg, #d97706, #fbbf24)' : 'rgba(255,255,255,0.05)', color: currentUser ? '#0f1117' : '#7c6fa0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {currentUser ? 'I Have This!' : 'Sign in to Offer'}
            </button>
          )}
          {isOwner && (
            <div style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: '0.5px' }}>
              Your want
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── WantCard ─────────────────────────────────────────────────────────────────

function WantCard({ want, currentUser, onDetail, onContact }) {
  const [hovered, setHovered] = useState(false)
  const isOwner = want.user_id === currentUser?.id
  const poster = want.profiles
  const cardColor = COLORS[want.card_color]

  return (
    <div
      onClick={() => onDetail(want)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'rgba(251,191,36,0.03)', border: `1px solid ${hovered ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.12)'}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.15s', transform: hovered ? 'translateY(-2px)' : 'none', cursor: 'pointer' }}
    >
      <div style={{ position: 'relative', background: '#1a1025', height: 180, overflow: 'hidden' }}>
        <img
          src={want.photo_url ?? `https://optcgapi.com/media/static/Card_Images/${want.card_id}.jpg`}
          alt={want.custom_title ?? want.card_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
          onError={e => {
            if (want.photo_url && e.target.src === want.photo_url) {
              e.target.src = `https://optcgapi.com/media/static/Card_Images/${want.card_id}.jpg`
            } else {
              e.target.style.display = 'none'
            }
          }}
        />
        {cardColor && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: cardColor }} />}
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(251,191,36,0.9)', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#0f1117', letterSpacing: '0.4px' }}>
          WTB
        </div>
        {want.quantity > 1 && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
            x{want.quantity}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{want.custom_title ?? want.card_name}</div>
        <div style={{ fontSize: 11, color: '#3d2d6e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {want.set_name && <span>{want.set_name} · </span>}
          <span style={{ fontFamily: 'monospace' }}>{want.card_id}</span>
        </div>
        {want.max_price ? (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
            Up to ${Number(want.max_price).toFixed(2)}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#3d2d6e', marginTop: 2 }}>Price negotiable</div>
        )}
        {want.notes && (
          <div style={{ fontSize: 11, color: '#7c6fa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{want.notes}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Avatar profile={poster} size={18} radius={5} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#7c6fa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {poster?.username ?? 'Unknown'}
          </div>
        </div>
        {isOwner ? (
          <div style={{ marginTop: 5, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your want
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onContact(want) }}
            style={{ marginTop: 5, padding: '5px 10px', borderRadius: 7, border: currentUser ? 'none' : '1px solid rgba(251,191,36,0.25)', background: currentUser ? 'linear-gradient(135deg, #d97706, #fbbf24)' : 'transparent', color: currentUser ? '#0f1117' : '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
          >
            {currentUser ? 'I Have This!' : 'Sign in to Offer'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MyWantsSection ───────────────────────────────────────────────────────────

function MyWantsSection({ session, profile, isMobile }) {
  const [wants, setWants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadWants() }, [session.user.id])

  async function loadWants() {
    setLoading(true)
    const { data } = await supabase.from('marketplace_wants').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    setWants(data ?? [])
    setLoading(false)
  }

  async function deleteWant(id) {
    await supabase.from('marketplace_wants').delete().eq('id', id)
    setWants(prev => prev.filter(w => w.id !== id))
    setConfirmDelete(null)
  }

  async function markFound(id) {
    await supabase.from('marketplace_wants').update({ status: 'found' }).eq('id', id)
    setWants(prev => prev.map(w => w.id === id ? { ...w, status: 'found' } : w))
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>
          My Wants <span style={{ fontSize: 12, fontWeight: 400, color: '#7c6fa0' }}>({wants.filter(w => w.status === 'active').length} active)</span>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #d97706, #fbbf24)', color: '#0f1117', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Want</button>
      </div>
      {loading ? (
        <div style={{ fontSize: 13, color: '#7c6fa0', textAlign: 'center', padding: 20 }}>Loading...</div>
      ) : wants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#3d2d6e' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 13, color: '#7c6fa0', marginBottom: 4 }}>No active wants</div>
          <div style={{ fontSize: 12 }}>Post cards you're looking for</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wants.map(want => (
            <div key={want.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(251,191,36,0.04)', border: `1px solid ${want.status === 'found' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.12)'}`, borderRadius: 10, padding: '10px 14px', flexWrap: isMobile ? 'wrap' : 'nowrap', opacity: want.status === 'found' ? 0.65 : 1 }}>
              <img
                src={`https://optcgapi.com/media/static/Card_Images/${want.card_id}.jpg`}
                alt={want.card_name}
                style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, flexShrink: 0, border: '1px solid rgba(255,255,255,0.06)' }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {want.card_name}
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#fbbf24', marginLeft: 6 }}>x{want.quantity}</span>
                </div>
                <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {want.max_price && <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>Up to ${Number(want.max_price).toFixed(2)}</span>}
                  {want.max_price && want.notes && <span style={{ color: '#3d2d6e' }}>·</span>}
                  {want.notes && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{want.notes}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: want.status === 'found' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: want.status === 'found' ? '#34d399' : '#fbbf24', border: `1px solid ${want.status === 'found' ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}`, textTransform: 'capitalize' }}>
                  {want.status === 'found' ? 'Found' : 'Seeking'}
                </span>
                {want.status === 'active' && (
                  <button onClick={() => markFound(want.id)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.06)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }}>Mark Found</button>
                )}
                {confirmDelete === want.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => deleteWant(want.id)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#f05252', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(want.id)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreate && <CreateWantModal session={session} profile={profile} onClose={() => setShowCreate(false)} onSuccess={loadWants} isMobile={isMobile} />}
    </>
  )
}

// ─── MyListingsTab ────────────────────────────────────────────────────────────

function MyListingsTab({ session, profile, isMobile }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})

  useEffect(() => { loadMyListings() }, [session.user.id])

  async function loadMyListings() {
    setLoading(true)
    const { data } = await supabase.from('marketplace_listings').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    const items = data ?? []
    setListings(items)
    setLoading(false)
    if (items.length > 0) {
      const { data: unread } = await supabase.from('marketplace_messages').select('listing_id').eq('receiver_id', session.user.id).eq('read', false)
      const counts = {}
      ;(unread ?? []).forEach(m => { counts[m.listing_id] = (counts[m.listing_id] ?? 0) + 1 })
      setUnreadCounts(counts)
    }
  }

  async function markSold(id) {
    await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', id)
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'sold' } : l))
  }

  async function deleteListing(id) {
    await supabase.from('marketplace_listings').delete().eq('id', id)
    setListings(prev => prev.filter(l => l.id !== id))
    setConfirmDelete(null)
  }

  const STATUS_COLOR = { active: '#34d399', sold: '#7c6fa0', removed: '#f05252' }
  const STATUS_BG = { active: 'rgba(52,211,153,0.1)', sold: 'rgba(255,255,255,0.04)', removed: 'rgba(240,82,82,0.08)' }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>My Listings <span style={{ fontSize: 12, fontWeight: 400, color: '#7c6fa0' }}>({listings.length})</span></div>
        <button onClick={() => setShowCreate(true)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Listing</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#7c6fa0', fontSize: 13 }}>Loading your listings...</div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#3d2d6e' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🏴‍☠️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>No listings yet</div>
          <div style={{ fontSize: 13 }}>Click "+ New Listing" to start selling</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listings.map(listing => (
            <div key={listing.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: '10px 14px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <img
                src={listing.photo_url ? listing.photo_url : `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`}
                alt={listing.card_name}
                style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, flexShrink: 0, border: '1px solid rgba(255,255,255,0.06)' }}
                onError={e => {
                  if (listing.photo_url && e.target.src === listing.photo_url) {
                    e.target.src = `https://optcgapi.com/media/static/Card_Images/${listing.card_id}.jpg`
                  } else {
                    e.target.style.display = 'none'
                  }
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {listing.card_name}
                  {(listing.quantity ?? 1) > 1 && <span style={{ fontSize: 11, fontWeight: 400, color: '#7c6fa0', marginLeft: 6 }}>x{listing.quantity}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <ConditionBadge condition={listing.condition} />
                  <span style={{ color: '#3d2d6e' }}>·</span>
                  <span style={{ fontFamily: 'monospace', color: '#f0f2f5', fontWeight: 700 }}>${Number(listing.price).toFixed(2)}</span>
                  <span style={{ color: '#3d2d6e' }}>·</span>
                  <span style={{ color: '#3d2d6e' }}>{new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: STATUS_BG[listing.status] ?? 'rgba(255,255,255,0.04)', color: STATUS_COLOR[listing.status] ?? '#7c6fa0', border: `1px solid ${STATUS_COLOR[listing.status] ?? '#7c6fa0'}33`, textTransform: 'capitalize', letterSpacing: '0.3px' }}>
                  {listing.status}
                </span>
                {(unreadCounts[listing.id] ?? 0) > 0 && (
                  <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#8b5cf6', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {unreadCounts[listing.id]}
                  </span>
                )}
                {listing.status === 'active' && (
                  <>
                    <button onClick={() => setEditTarget(listing)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    <button onClick={() => markSold(listing.id)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.06)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }}>Mark Sold</button>
                  </>
                )}
                {confirmDelete === listing.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => deleteListing(listing.id)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#f05252', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(listing.id)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 14 }}>Looking For</div>
        <MyWantsSection session={session} profile={profile} isMobile={isMobile} />
      </div>

      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 14 }}>Messages</div>
        <InboxSection session={session} isMobile={isMobile} />
      </div>

      {showCreate && <CreateListingModal session={session} profile={profile} onClose={() => setShowCreate(false)} onSuccess={loadMyListings} isMobile={isMobile} />}
      {editTarget && <EditListingModal listing={editTarget} session={session} onClose={() => setEditTarget(null)} onSuccess={loadMyListings} isMobile={isMobile} />}
    </>
  )
}

// ─── ApplyStorefrontModal ─────────────────────────────────────────────────────

function ApplyStorefrontModal({ session, onClose, onSuccess, isMobile }) {
  const [storeName, setStoreName] = useState('')
  const [address, setAddress] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleLogoChange(e) {
    const file = e.target.files?.[0]; if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!storeName.trim()) { setError('Store name is required.'); return }
    setSaving(true); setError('')
    let logo_url = null
    if (logoFile) {
      const ext = logoFile.name.split('.').pop() || 'jpg'
      const path = `store-logos/apply-${session.user.id}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('card-photos').upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('card-photos').getPublicUrl(path)
        logo_url = urlData?.publicUrl ?? null
      }
    }
    const { error: insertErr } = await supabase.from('storefronts').insert({
      user_id: session.user.id, store_name: storeName.trim(),
      address: address.trim(), contact_info: contactInfo.trim(),
      website_url: websiteUrl.trim(), logo_url, status: 'pending',
    })
    setSaving(false)
    if (insertErr) { setError('Submission failed: ' + insertErr.message); return }
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: '100%', maxWidth: 480, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Apply as Storefront</div>
            <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 1 }}>Your application will be reviewed before going live</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>Store Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🏪</span>}
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>
                Upload Logo
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Store Name *</label>
            <input value={storeName} onChange={e => setStoreName(e.target.value)} style={{ ...INPUT, width: '100%' }} placeholder="e.g. Pirate's Cove Cards" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} style={{ ...INPUT, width: '100%' }} placeholder="123 Main St, City, State" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Contact Info</label>
            <input value={contactInfo} onChange={e => setContactInfo(e.target.value)} style={{ ...INPUT, width: '100%' }} placeholder="Phone or email" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Website / Social Link</label>
            <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} style={{ ...INPUT, width: '100%' }} placeholder="https://..." />
          </div>
          {error && <div style={{ fontSize: 12, color: '#f05252' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.1)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MyStorefrontSection ──────────────────────────────────────────────────────

function MyStorefrontSection({ session, isMobile }) {
  const navigate = useNavigate()
  const [storefront, setStorefront] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => { load() }, [session])

  async function load() {
    if (!session) { setLoading(false); return }
    const { data } = await supabase.from('storefronts').select('*').eq('user_id', session.user.id).single()
    setStorefront(data ?? null)
    setLoading(false)
  }

  const STATUS_COLORS = { pending: '#fbbf24', approved: '#34d399', rejected: '#f05252' }
  const STATUS_LABELS = { pending: 'Pending review', approved: 'Live', rejected: 'Rejected' }

  if (loading) return <div style={{ fontSize: 12, color: '#7c6fa0', padding: '12px 0' }}>Loading...</div>

  if (applied && !storefront) return (
    <div style={{ padding: '14px 16px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>Application submitted!</div>
      <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 4 }}>You'll be notified once it's reviewed.</div>
    </div>
  )

  if (!storefront) return (
    <>
      <div style={{ padding: '14px 16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>Become a Storefront</div>
          <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 3 }}>List your store's inventory and reach buyers</div>
        </div>
        <button onClick={() => setShowApply(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          Apply Now
        </button>
      </div>
      {showApply && (
        <ApplyStorefrontModal session={session} onClose={() => setShowApply(false)} onSuccess={() => { setShowApply(false); setApplied(true); load() }} isMobile={isMobile} />
      )}
    </>
  )

  return (
    <div style={{ padding: '14px 16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {storefront.logo_url ? <img src={storefront.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>🏪</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{storefront.store_name}</div>
        <div style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: STATUS_COLORS[storefront.status] ?? '#7c6fa0', fontWeight: 600 }}>{STATUS_LABELS[storefront.status] ?? storefront.status}</span>
          {storefront.status === 'pending' && <span style={{ color: '#7c6fa0' }}>· Awaiting approval</span>}
        </div>
      </div>
      {storefront.status === 'approved' && (
        <button onClick={() => navigate(`/storefront/${storefront.id}`)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          Manage Store
        </button>
      )}
    </div>
  )
}

// ─── StoreCard ────────────────────────────────────────────────────────────────

function StoreCard({ store, onClick }) {
  return (
    <div onClick={onClick} style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)'; e.currentTarget.style.background = 'rgba(139,92,246,0.04)' }}>
      <div style={{ height: 80, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {store.logo_url
          ? <img src={store.logo_url} alt={store.store_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 40 }}>🏪</span>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.store_name}</div>
        {store.address && <div style={{ fontSize: 11, color: '#7c6fa0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {store.address}</div>}
        <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 4 }}>{store.inventory_count ?? 0} cards listed</div>
      </div>
    </div>
  )
}

// ─── Marketplace (main page) ──────────────────────────────────────────────────

export default function Marketplace({ session }) {
  const navigate = useNavigate()
  const { isMobile, isTablet } = useWindowSize()
  const [activeTab, setActiveTab] = useState('browse')
  const [allListings, setAllListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [displayCount, setDisplayCount] = useState(50)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [detailListing, setDetailListing] = useState(null)
  const [messageListing, setMessageListing] = useState(null)
  const [allWants, setAllWants] = useState([])
  const [wantsLoading, setWantsLoading] = useState(false)
  const [wantsLoadError, setWantsLoadError] = useState(null)
  const [wantSearch, setWantSearch] = useState('')
  const [wantDisplayCount, setWantDisplayCount] = useState(50)
  const [contactWant, setContactWant] = useState(null)
  const [detailWant, setDetailWant] = useState(null)
  const [showCreateWant, setShowCreateWant] = useState(false)
  const [storefronts, setStorefronts] = useState([])
  const [storefrontsLoading, setStorefrontsLoading] = useState(false)
  const [pendingStorefronts, setPendingStorefronts] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [approvingStore, setApprovingStore] = useState(null)

  useEffect(() => { loadListings(); loadProfile() }, [])
  useEffect(() => { if (activeTab === 'wants') loadWants() }, [activeTab])
  useEffect(() => { if (activeTab === 'stores') loadStorefronts() }, [activeTab, isAdmin])

  async function loadListings() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*, profiles!marketplace_listings_user_id_fkey(id, username, avatar_url, location)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) { setLoadError('Failed to load listings.'); setLoading(false); return }
    setAllListings(data ?? [])
    setDisplayCount(50)
    setLoading(false)
  }

  async function loadWants() {
    setWantsLoading(true)
    setWantsLoadError(null)
    const { data, error } = await supabase
      .from('marketplace_wants')
      .select('*, profiles!marketplace_wants_user_id_fkey(id, username, avatar_url)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) { setWantsLoadError('Failed to load wants.'); setWantsLoading(false); return }
    setAllWants(data ?? [])
    setWantDisplayCount(50)
    setWantsLoading(false)
  }

  async function loadProfile() {
    if (!session) return
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data ?? null)
    if (data?.username === 'Cipin') setIsAdmin(true)
  }

  async function loadStorefronts() {
    setStorefrontsLoading(true)
    const { data: approved } = await supabase
      .from('storefronts')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    // Fetch inventory counts
    const stores = await Promise.all((approved ?? []).map(async s => {
      const { count } = await supabase.from('store_inventory').select('*', { count: 'exact', head: true }).eq('storefront_id', s.id).eq('status', 'active')
      return { ...s, inventory_count: count ?? 0 }
    }))
    setStorefronts(stores)
    if (isAdmin) {
      const { data: pending } = await supabase.from('storefronts').select('*').eq('status', 'pending').order('created_at', { ascending: true })
      setPendingStorefronts(pending ?? [])
    }
    setStorefrontsLoading(false)
  }

  async function approveStore(id, status) {
    setApprovingStore(id)
    await supabase.from('storefronts').update({ status }).eq('id', id)
    setPendingStorefronts(prev => prev.filter(s => s.id !== id))
    if (status === 'approved') loadStorefronts()
    setApprovingStore(null)
  }

  function clearFilters() { setSearch(''); setColorFilter(''); setConditionFilter(''); setPriceMin(''); setPriceMax(''); setCityFilter('') }

  const filteredListings = allListings.filter(l => {
    if (search && !l.card_name.toLowerCase().includes(search.toLowerCase())) return false
    if (colorFilter && l.card_color !== colorFilter) return false
    if (conditionFilter && l.condition !== conditionFilter) return false
    if (priceMin && Number(l.price) < parseFloat(priceMin)) return false
    if (priceMax && Number(l.price) > parseFloat(priceMax)) return false
    if (cityFilter && !l.city?.toLowerCase().includes(cityFilter.toLowerCase())) return false
    return true
  })
  const visibleListings = filteredListings.slice(0, displayCount)
  const hasMore = filteredListings.length > displayCount
  const filtersActive = search || colorFilter || conditionFilter || priceMin || priceMax || cityFilter

  const tabBtn = isActive => ({
    fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: isActive ? '#8b5cf6' : 'transparent', color: isActive ? '#fff' : '#7c6fa0', transition: 'all 0.15s',
  })

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Trading</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Marketplace</div>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>Buy and sell One Piece TCG cards</div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        <button onClick={() => setActiveTab('browse')} style={tabBtn(activeTab === 'browse')}>Browse</button>
        <button onClick={() => setActiveTab('wants')} style={{ ...tabBtn(activeTab === 'wants'), color: activeTab === 'wants' ? '#fff' : '#fbbf24', background: activeTab === 'wants' ? '#d97706' : 'transparent' }}>Looking For</button>
        <button onClick={() => setActiveTab('stores')} style={{ ...tabBtn(activeTab === 'stores'), color: activeTab === 'stores' ? '#fff' : '#34d399', background: activeTab === 'stores' ? '#059669' : 'transparent' }}>Stores</button>
        {session ? (
          <button onClick={() => setActiveTab('mylistings')} style={tabBtn(activeTab === 'mylistings')}>My Listings</button>
        ) : (
          <button onClick={() => navigate('/login')} style={{ ...tabBtn(false), color: '#3d2d6e' }}>My Listings 🔒</button>
        )}
      </div>

      {activeTab === 'browse' ? (
        <>
          {/* Filter bar */}
          <div style={{ position: 'sticky', top: 52, zIndex: 30, background: 'rgba(12,8,20,0.93)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(139,92,246,0.1)', marginBottom: 20, marginLeft: isMobile ? '-1rem' : '-1.5rem', marginRight: isMobile ? '-1rem' : '-1.5rem', paddingTop: 12, paddingBottom: 14, paddingLeft: isMobile ? '1rem' : '1.5rem', paddingRight: isMobile ? '1rem' : '1.5rem' }}>
            {/* Row 1: Search */}
            <input
              type="text"
              placeholder="Search cards by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...INPUT, width: '100%', padding: '10px 14px', marginBottom: 12 }}
            />
            {/* Row 2: Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select value={colorFilter} onChange={e => setColorFilter(e.target.value)} style={{ ...INPUT, minWidth: 130, cursor: 'pointer' }}>
                <option value="">All Colors</option>
                {CARD_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)} style={{ ...INPUT, minWidth: 160, cursor: 'pointer' }}>
                <option value="">All Conditions</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" min="0" placeholder="Min $" value={priceMin} onChange={e => setPriceMin(e.target.value)} style={{ ...INPUT, width: 100 }} />
              <input type="number" min="0" placeholder="Max $" value={priceMax} onChange={e => setPriceMax(e.target.value)} style={{ ...INPUT, width: 100 }} />
              <input type="text" placeholder="City..." value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ ...INPUT, width: 130 }} />
              {filtersActive && (
                <button onClick={clearFilters} style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear ✕
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 10 }}>
              {loading ? 'Loading...' : `${filteredListings.length} listing${filteredListings.length !== 1 ? 's' : ''} found`}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading listings...</div>
          ) : loadError ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f05252', marginBottom: 10 }}>{loadError}</div>
              <button onClick={loadListings} style={{ fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
            </div>
          ) : filteredListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>{filtersActive ? '🔍' : '🏪'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>{filtersActive ? 'No listings match your filters' : 'No listings yet'}</div>
              <div style={{ fontSize: 13 }}>{filtersActive ? 'Try adjusting your search' : 'Be the first to list a card!'}</div>
              {filtersActive && <button onClick={clearFilters} style={{ marginTop: 14, fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>Clear filters</button>}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : isTablet ? 3 : 4}, 1fr)`, gap: isMobile ? 10 : 14 }}>
                {visibleListings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} currentUser={session?.user} onDetail={setDetailListing} onMessage={l => session ? setMessageListing(l) : navigate('/login')} />
                ))}
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button onClick={() => setDisplayCount(c => c + 50)} style={{ padding: '10px 28px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Load more ({filteredListings.length - displayCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : activeTab === 'wants' ? (
        <>
          {/* Wants header bar */}
          <div style={{ position: 'sticky', top: 52, zIndex: 30, background: 'rgba(12,8,20,0.93)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(251,191,36,0.1)', marginBottom: 20, marginLeft: isMobile ? '-1rem' : '-1.5rem', marginRight: isMobile ? '-1rem' : '-1.5rem', paddingTop: 12, paddingBottom: 14, paddingLeft: isMobile ? '1rem' : '1.5rem', paddingRight: isMobile ? '1rem' : '1.5rem' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Search wanted cards..."
                value={wantSearch}
                onChange={e => setWantSearch(e.target.value)}
                style={{ ...INPUT, flex: 1, padding: '10px 14px' }}
              />
              {session ? (
                <button onClick={() => setShowCreateWant(true)} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #d97706, #fbbf24)', color: '#0f1117', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  + I'm Looking For
                </button>
              ) : (
                <button onClick={() => navigate('/login')} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.2)', background: 'transparent', color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Sign in to post
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#3d2d6e' }}>
              {wantsLoading ? 'Loading...' : (() => {
                const count = allWants.filter(w => !wantSearch || w.card_name.toLowerCase().includes(wantSearch.toLowerCase())).length
                return `${count} want${count !== 1 ? 's' : ''} posted`
              })()}
            </div>
          </div>

          {/* Wants grid */}
          {wantsLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading wants...</div>
          ) : wantsLoadError ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f05252', marginBottom: 10 }}>{wantsLoadError}</div>
              <button onClick={loadWants} style={{ fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
            </div>
          ) : (() => {
            const filteredWants = allWants.filter(w => !wantSearch || w.card_name.toLowerCase().includes(wantSearch.toLowerCase()))
            const visibleWants = filteredWants.slice(0, wantDisplayCount)
            if (filteredWants.length === 0) return (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e' }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>{wantSearch ? '🔍' : '🔎'}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>{wantSearch ? 'No wants match your search' : 'No wants posted yet'}</div>
                <div style={{ fontSize: 13 }}>{wantSearch ? 'Try a different card name' : 'Be the first to post a card you\'re looking for!'}</div>
                {session && !wantSearch && (
                  <button onClick={() => setShowCreateWant(true)} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #d97706, #fbbf24)', color: '#0f1117', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Post a Want
                  </button>
                )}
              </div>
            )
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : isTablet ? 3 : 4}, 1fr)`, gap: isMobile ? 10 : 14 }}>
                  {visibleWants.map(want => (
                    <WantCard
                      key={want.id}
                      want={want}
                      currentUser={session?.user}
                      onDetail={w => setDetailWant(w)}
                      onContact={w => session ? setContactWant(w) : navigate('/login')}
                    />
                  ))}
                </div>
                {filteredWants.length > wantDisplayCount && (
                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <button onClick={() => setWantDisplayCount(c => c + 50)} style={{ padding: '10px 28px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)', color: '#fbbf24', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Load more ({filteredWants.length - wantDisplayCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </>
      ) : activeTab === 'stores' ? (
        <>
          {/* Admin: pending applications */}
          {isAdmin && pendingStorefronts.length > 0 && (
            <div style={{ marginBottom: 24, padding: '16px 18px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', marginBottom: 12 }}>Pending Applications ({pendingStorefronts.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingStorefronts.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{s.store_name}</div>
                      <div style={{ fontSize: 11, color: '#7c6fa0' }}>{s.address || 'No address'} · Applied {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => navigate(`/storefront/${s.id}`)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>View</button>
                      <button onClick={() => approveStore(s.id, 'rejected')} disabled={approvingStore === s.id} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(240,82,82,0.25)', background: 'rgba(240,82,82,0.08)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>Reject</button>
                      <button onClick={() => approveStore(s.id, 'approved')} disabled={approvingStore === s.id} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(52,211,153,0.15)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }}>Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {storefrontsLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading stores...</div>
          ) : storefronts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🏪</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>No storefronts yet</div>
              <div style={{ fontSize: 13 }}>Approved stores will appear here</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : isTablet ? 3 : 4}, 1fr)`, gap: isMobile ? 10 : 14 }}>
              {storefronts.map(store => (
                <StoreCard key={store.id} store={store} onClick={() => navigate(`/storefront/${store.id}`)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <MyListingsTab session={session} profile={profile} isMobile={isMobile} />
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d2d6e', marginBottom: 14 }}>My Storefront</div>
            <MyStorefrontSection session={session} isMobile={isMobile} />
          </div>
        </>
      )}

      {detailListing && (
        <ListingDetailModal
          listing={detailListing}
          currentUser={session?.user}
          session={session}
          onClose={() => setDetailListing(null)}
          isMobile={isMobile}
          onMarkSold={id => { setAllListings(prev => prev.filter(l => l.id !== id)); setDetailListing(null) }}
          onMessageGuest={() => { setDetailListing(null); navigate('/login') }}
        />
      )}

      {messageListing && (
        <MessageModal
          listing={messageListing}
          currentUser={session?.user}
          otherUser={messageListing.profiles}
          onClose={() => setMessageListing(null)}
          isMobile={isMobile}
        />
      )}

      {detailWant && (
        <WantDetailModal
          want={detailWant}
          currentUser={session?.user}
          session={session}
          onClose={() => setDetailWant(null)}
          onContact={w => session ? setContactWant(w) : navigate('/login')}
          isMobile={isMobile}
        />
      )}

      {contactWant && (
        <WantMessageModal
          want={contactWant}
          currentUser={session?.user}
          otherUser={contactWant.profiles}
          onClose={() => setContactWant(null)}
          isMobile={isMobile}
        />
      )}

      {showCreateWant && (
        <CreateWantModal
          session={session}
          profile={profile}
          onClose={() => setShowCreateWant(false)}
          onSuccess={() => { setShowCreateWant(false); loadWants() }}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}
