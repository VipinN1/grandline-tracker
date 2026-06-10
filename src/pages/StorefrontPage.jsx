import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchCards } from '../lib/optcgapi'
import { useWindowSize } from '../hooks/useWindowSize'

const CONDITION_COLORS = {
  'Near Mint': '#34d399', 'Lightly Played': '#22d3ee',
  'Moderately Played': '#fbbf24', 'Heavily Played': '#f97316', 'Damaged': '#f05252',
}
const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']
const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']
const CARD_TYPES = ['Leader', 'Character', 'Event', 'Stage']
const COLOR_HEX = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }
const BOOSTER_SETS = ['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP09','OP10','OP11','OP12','OP13','OP14','OP15','EB01','EB02','EB03','EB04','PRB01','PRB02']

function pillStyle(isActive, accentColor) {
  return {
    padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${isActive ? (accentColor ?? 'rgba(139,92,246,0.5)') : 'rgba(139,92,246,0.3)'}`,
    background: isActive ? (accentColor ? `${accentColor}33` : 'rgba(139,92,246,0.3)') : 'rgba(15,8,30,0.85)',
    color: isActive ? (accentColor ?? '#a78bfa') : '#7c6fa0', transition: 'all 0.15s',
  }
}

function getAltArtType(card) {
  const name = (card.card_name ?? '').toLowerCase()
  const rarity = (card.card_rarity ?? '').toLowerCase()
  if (/\bsp\b/.test(name) || rarity === 'sp') return 'sp'
  if (/\bmanga\b/.test(name) || rarity === 'manga') return 'manga'
  if (/\btr\b/.test(name) || rarity === 'tr') return 'tr'
  if (/parallel/.test(name) || rarity === 'parallel') return 'parallel'
  return ''
}

const INPUT = {
  background: 'rgba(15,8,30,0.92)', border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const LABEL = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.6px', color: '#7c6fa0', marginBottom: 5, display: 'block',
}

function ConditionBadge({ condition }) {
  const color = CONDITION_COLORS[condition] ?? '#7c6fa0'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>
      {condition}
    </span>
  )
}

// ─── StoreMessageModal ────────────────────────────────────────────────────────
function StoreMessageModal({ storefront, currentUser, onClose, isMobile }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  const buyerId = currentUser.id
  const storeOwnerId = storefront.user_id

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`store-msg-${storefront.id}-${buyerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'storefront_messages', filter: `storefront_id=eq.${storefront.id}` }, payload => {
        const m = payload.new
        if (m.sender_id === currentUser.id || m.receiver_id === currentUser.id) {
          setMessages(prev => [...prev, m])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function load() {
    const { data } = await supabase
      .from('storefront_messages')
      .select('*')
      .eq('storefront_id', storefront.id)
      .or(`and(sender_id.eq.${buyerId},receiver_id.eq.${storeOwnerId}),and(sender_id.eq.${storeOwnerId},receiver_id.eq.${buyerId})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    await supabase.from('storefront_messages').update({ read: true })
      .eq('storefront_id', storefront.id).eq('receiver_id', currentUser.id).eq('read', false)
  }

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const receiverId = currentUser.id === storeOwnerId ? buyerId : storeOwnerId
    await supabase.from('storefront_messages').insert({
      storefront_id: storefront.id, sender_id: currentUser.id,
      receiver_id: receiverId, content: text.trim(), read: false,
    })
    setText('')
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: isMobile ? '100%' : 480, maxHeight: isMobile ? '90vh' : '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>Message {storefront.store_name}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#7c6fa0', fontSize: 13 }}>Loading...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#7c6fa0', fontSize: 13 }}>No messages yet. Say hello!</div>
          ) : messages.map(m => {
            const mine = m.sender_id === currentUser.id
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: mine ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)', border: `1px solid ${mine ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`, fontSize: 13, color: '#f0f2f5', lineHeight: 1.5 }}>
                  {m.content}
                  <div style={{ fontSize: 10, color: '#7c6fa0', marginTop: 4, textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(139,92,246,0.1)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} placeholder="Type a message..." style={{ ...INPUT, flex: 1 }} />
          <button onClick={send} disabled={sending || !text.trim()} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: text.trim() ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)', color: text.trim() ? '#fff' : '#7c6fa0', fontSize: 13, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s' }}>Send</button>
        </div>
      </div>
    </div>
  )
}

// ─── EditStoreModal ────────────────────────────────────────────────────────────
function EditStoreModal({ storefront, onClose, onSuccess, isMobile }) {
  const [storeName, setStoreName] = useState(storefront.store_name ?? '')
  const [address, setAddress] = useState(storefront.address ?? '')
  const [contactInfo, setContactInfo] = useState(storefront.contact_info ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(storefront.website_url ?? '')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(storefront.logo_url ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!storeName.trim()) { setError('Store name is required.'); return }
    setSaving(true); setError('')
    let logo_url = storefront.logo_url
    if (logoFile) {
      const ext = logoFile.name.split('.').pop() || 'jpg'
      const path = `store-logos/${storefront.id}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('card-photos').upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (uploadErr) { setSaving(false); setError('Logo upload failed.'); return }
      const { data: urlData } = supabase.storage.from('card-photos').getPublicUrl(path)
      logo_url = urlData?.publicUrl ?? logo_url
    }
    const { error: updateErr } = await supabase.from('storefronts').update({
      store_name: storeName.trim(), address: address.trim(),
      contact_info: contactInfo.trim(), website_url: websiteUrl.trim(), logo_url,
    }).eq('id', storefront.id)
    setSaving(false)
    if (updateErr) { setError('Save failed: ' + updateErr.message); return }
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: '100%', maxWidth: 480, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Edit Store Profile</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>Store Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 72, height: 72, borderRadius: 12, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>🏪</span>}
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>
                {logoPreview ? 'Change Logo' : 'Upload Logo'}
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
          {error && <div style={{ fontSize: 12, color: '#f05252', marginBottom: 10 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.1)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AddInventoryModal ─────────────────────────────────────────────────────────
function AddInventoryModal({ storefront, editItem, onClose, onSuccess, isMobile }) {
  const [step, setStep] = useState(editItem ? 2 : 1)
  const [cardQuery, setCardQuery] = useState(editItem ? editItem.card_name : '')
  const [cardResults, setCardResults] = useState([])
  const [cardSearching, setCardSearching] = useState(false)
  const [selectedCard, setSelectedCard] = useState(editItem ? { card_set_id: editItem.card_id, card_image_id: editItem.card_id, card_name: editItem.card_name, card_color: editItem.card_color, card_type: editItem.card_type, set_name: editItem.set_name } : null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [price, setPrice] = useState(editItem ? String(editItem.price) : '')
  const [quantity, setQuantity] = useState(editItem ? String(editItem.quantity) : '1')
  const [condition, setCondition] = useState(editItem ? editItem.condition : '')
  const [description, setDescription] = useState(editItem?.description ?? '')
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
      try {
        let results = await searchCards(val)
        if (filterColor.length > 0) results = results.filter(c => filterColor.includes(c.card_color))
        if (filterType) results = results.filter(c => c.card_type === filterType)
        const id = (c) => c.card_set_id ?? ''
        if (filterSource === 'ST') results = results.filter(c => /^ST/i.test(id(c)))
        else if (filterSource === 'Promos') results = results.filter(c => /^P-/i.test(id(c)))
        else if (filterSource) results = results.filter(c => id(c).toUpperCase().startsWith(filterSource))
        if (filterAltArt) results = results.filter(c => getAltArtType(c) === filterAltArt)
        if (filterCost !== null) results = results.filter(c => String(c.card_cost ?? '') === String(filterCost))
        setCardResults(results)
      } catch { setCardResults([]) }
      setCardSearching(false)
    }, 350)
  }

  async function save() {
    if (!selectedCard && !editItem) { setError('Please select a card.'); return }
    if (!price || !condition) { setError('Price and condition are required.'); return }
    if (parseFloat(price) <= 0) { setError('Price must be greater than 0.'); return }
    setSaving(true); setError('')
    if (editItem) {
      const { error: updateErr } = await supabase.from('store_inventory').update({
        price: parseFloat(price), quantity: parseInt(quantity) || 1,
        condition, description: description.trim() || null,
      }).eq('id', editItem.id)
      setSaving(false)
      if (updateErr) { setError('Update failed: ' + updateErr.message); return }
    } else {
      const { error: insertErr } = await supabase.from('store_inventory').insert({
        storefront_id: storefront.id,
        card_id: selectedCard.card_image_id ?? selectedCard.card_set_id,
        card_name: selectedCard.card_name,
        card_color: selectedCard.card_color ?? null,
        card_type: selectedCard.card_type ?? null,
        set_name: selectedCard.set_name ?? null,
        price: parseFloat(price),
        quantity: parseInt(quantity) || 1,
        condition, description: description.trim() || null, status: 'active',
      })
      setSaving(false)
      if (insertErr) { setError('Failed: ' + insertErr.message); return }
    }
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: '100%', maxWidth: 520, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{editItem ? 'Edit Card' : 'Add Card to Inventory'}</div>
            {!editItem && <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 1 }}>Step {step} of 2</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {step === 1 ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {/* Color */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                {[['', 'All'], ...CARD_COLORS.map(c => [c, c])].map(([val, label]) => {
                  const isActive = val === '' ? filterColor.length === 0 : filterColor.includes(val)
                  return (
                    <button key={val || 'c-all'} onClick={() => {
                      if (val === '') { setFilterColor([]); return }
                      setFilterColor(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
                    }} style={pillStyle(isActive, COLOR_HEX[val])}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {/* Type */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[['', 'All Types'], ['Leader', 'Leader'], ['Character', 'Character'], ['Event', 'Event'], ['Stage', 'Stage']].map(([val, label]) => (
                  <button key={val || 't-all'} onClick={() => setFilterType(val)} style={pillStyle(filterType === val, null)}>{label}</button>
                ))}
              </div>
              {/* Source */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setFilterSource('')} style={pillStyle(filterSource === '', null)}>All</button>
                <select
                  value={['', 'ST', 'Promos'].includes(filterSource) ? '' : filterSource}
                  onChange={e => setFilterSource(e.target.value)}
                  style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', background: !['', 'ST', 'Promos'].includes(filterSource) ? 'rgba(139,92,246,0.3)' : 'rgba(15,8,30,0.85)', border: !['', 'ST', 'Promos'].includes(filterSource) ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.3)', color: !['', 'ST', 'Promos'].includes(filterSource) ? '#a78bfa' : '#7c6fa0' }}
                >
                  <option value="">Booster Sets</option>
                  {BOOSTER_SETS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setFilterSource('ST')} style={pillStyle(filterSource === 'ST', null)}>Starter Decks</button>
                <button onClick={() => setFilterSource('Promos')} style={pillStyle(filterSource === 'Promos', null)}>Promos</button>
              </div>
              {/* Alt Art */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[['', 'All'], ['parallel', 'Parallel'], ['sp', 'SP'], ['manga', 'Manga'], ['tr', 'TR']].map(([val, label]) => {
                  const ac = { parallel: '#e879f9', sp: '#34d399', manga: '#38bdf8', tr: '#f97316' }[val]
                  return <button key={val || 'a-all'} onClick={() => setFilterAltArt(val)} style={pillStyle(filterAltArt === val, ac)}>{label}</button>
                })}
              </div>
              {/* Cost */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setFilterCost(null)} style={pillStyle(filterCost === null, null)}>All Costs</button>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setFilterCost(filterCost === n ? null : n)} style={pillStyle(filterCost === n, null)}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <input type="text" placeholder="Search card by name or ID..." value={cardQuery} onChange={handleCardQuery} onFocus={() => cardResults.length > 0 && setDropdownOpen(true)} style={{ ...INPUT, width: '100%' }} />
              {dropdownOpen && (cardSearching || cardResults.length > 0) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#13091f', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, marginTop: 4, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {cardSearching ? (
                    <div style={{ padding: 14, fontSize: 12, color: '#7c6fa0', textAlign: 'center' }}>Searching...</div>
                  ) : cardResults.map(card => (
                    <div key={card.card_image_id ?? card.card_set_id}
                      onClick={() => { setSelectedCard(card); setCardQuery(card.card_name); setDropdownOpen(false); setStep(2) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <img src={`https://optcgapi.com/media/static/Card_Images/${card.card_image_id ?? card.card_set_id}.jpg`} alt={card.card_name}
                        style={{ width: 28, height: 40, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</div>
                        <div style={{ fontSize: 10, color: '#7c6fa0' }}>{card.card_set_id} · {card.card_color} · {card.card_type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {selectedCard && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 14px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
                <img src={`https://optcgapi.com/media/static/Card_Images/${selectedCard.card_image_id ?? selectedCard.card_set_id}.jpg`} alt={selectedCard.card_name}
                  style={{ width: 36, height: 50, objectFit: 'cover', objectPosition: 'top', borderRadius: 5, flexShrink: 0 }}
                  onError={e => { e.target.style.display = 'none' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{selectedCard.card_name}</div>
                  <div style={{ fontSize: 11, color: '#7c6fa0' }}>{selectedCard.card_set_id} · {selectedCard.card_color} · {selectedCard.card_type}</div>
                </div>
                {!editItem && <button onClick={() => { setStep(1); setSelectedCard(null) }} style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={LABEL}>Price (USD) *</label>
                <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} style={{ ...INPUT, width: '100%' }} placeholder="0.00" />
              </div>
              <div>
                <label style={LABEL}>Quantity</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ ...INPUT, width: '100%' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>Condition *</label>
              <select value={condition} onChange={e => setCondition(e.target.value)} style={{ ...INPUT, width: '100%', cursor: 'pointer' }}>
                <option value="">Select condition...</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...INPUT, width: '100%', minHeight: 70, resize: 'vertical' }} placeholder="Any extra details..." />
            </div>
            {error && <div style={{ fontSize: 12, color: '#f05252', marginTop: 10 }}>{error}</div>}
          </div>
        )}

        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.1)', flexShrink: 0, display: 'flex', gap: 10 }}>
          {step === 2 && !editItem && (
            <button onClick={() => setStep(1)} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          {(step === 2 || editItem) && (
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : editItem ? 'Update Card' : 'Add to Inventory'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CsvImportModal ────────────────────────────────────────────────────────────
function CsvImportModal({ storefront, onClose, onSuccess, isMobile }) {
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [resultCounts, setResultCounts] = useState({ success: 0, failed: 0 })

  function parseCsv() {
    setParseError(''); setParsed([])
    const lines = csvText.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) { setParseError('Need a header row and at least one data row.'); return }
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const missing = ['card_id', 'quantity', 'price', 'condition'].filter(f => !header.includes(f))
    if (missing.length > 0) { setParseError(`Missing columns: ${missing.join(', ')}`); return }
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      const row = {}
      header.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
      if (!row.card_id || !row.price) continue
      if (!CONDITIONS.includes(row.condition)) { setParseError(`Invalid condition "${row.condition}" on row ${i + 1}`); return }
      rows.push(row)
    }
    if (rows.length === 0) { setParseError('No valid rows found.'); return }
    setParsed(rows)
  }

  async function runImport() {
    setImporting(true); setProgress(0)
    let success = 0, failed = 0
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]
      try {
        const cards = await searchCards(row.card_id)
        const match = cards.find(c =>
          (c.card_set_id ?? '').toLowerCase() === row.card_id.toLowerCase() ||
          (c.card_image_id ?? '').toLowerCase() === row.card_id.toLowerCase()
        ) ?? cards[0]
        const { error } = await supabase.from('store_inventory').insert({
          storefront_id: storefront.id,
          card_id: row.card_id,
          card_name: match?.card_name ?? row.card_id,
          card_color: match?.card_color ?? null,
          card_type: match?.card_type ?? null,
          set_name: match?.set_name ?? null,
          price: parseFloat(row.price),
          quantity: parseInt(row.quantity) || 1,
          condition: row.condition,
          status: 'active',
        })
        if (error) failed++; else success++
      } catch { failed++ }
      setProgress(Math.round(((i + 1) / parsed.length) * 100))
    }
    setImporting(false); setDone(true); setResultCounts({ success, failed })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0814', border: '1px solid rgba(139,92,246,0.2)', borderRadius: isMobile ? '16px 16px 0 0' : 16, width: '100%', maxWidth: 540, maxHeight: isMobile ? '95vh' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Bulk Import</div>
            <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 1 }}>Columns: card_id, quantity, price, condition</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#7c6fa0', fontSize: 15, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', marginBottom: 8 }}>Import Complete</div>
              <div style={{ fontSize: 13, color: '#34d399' }}>{resultCounts.success} card{resultCounts.success !== 1 ? 's' : ''} added</div>
              {resultCounts.failed > 0 && <div style={{ fontSize: 13, color: '#f05252', marginTop: 4 }}>{resultCounts.failed} failed</div>}
            </div>
          ) : importing ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f2f5', marginBottom: 16 }}>Importing... {progress}%</div>
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', transition: 'width 0.3s', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 10 }}>Looking up card data from API...</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={LABEL}>Example format</label>
                <pre style={{ fontSize: 11, color: '#7c6fa0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', overflowX: 'auto', margin: 0 }}>
{`card_id,quantity,price,condition
OP01-001,2,15.00,Near Mint
OP14-120,1,45.00,Lightly Played`}
                </pre>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={LABEL}>Paste CSV</label>
                <textarea value={csvText} onChange={e => { setCsvText(e.target.value); setParsed([]); setParseError('') }}
                  style={{ ...INPUT, width: '100%', minHeight: 150, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  placeholder="Paste your CSV here..." />
              </div>
              {parseError && <div style={{ fontSize: 12, color: '#f05252', marginBottom: 10 }}>{parseError}</div>}
              {parsed.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>{parsed.length} row{parsed.length !== 1 ? 's' : ''} ready to import</div>
                </div>
              )}
              <label style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.06)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-block' }}>
                Or upload a .csv file
                <input type="file" accept=".csv,text/csv" onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => { setCsvText(ev.target.result); setParsed([]); setParseError('') }
                  reader.readAsText(file)
                }} style={{ display: 'none' }} />
              </label>
            </>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.1)', flexShrink: 0, display: 'flex', gap: 10 }}>
          {done ? (
            <button onClick={onSuccess} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
          ) : importing ? null : (
            <>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              {parsed.length === 0 ? (
                <button onClick={parseCsv} disabled={!csvText.trim()} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: csvText.trim() ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)', color: csvText.trim() ? '#a78bfa' : '#7c6fa0', fontSize: 13, fontWeight: 700, cursor: csvText.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  Validate CSV
                </button>
              ) : (
                <button onClick={runImport} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Import {parsed.length} Cards
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── InventoryCard ─────────────────────────────────────────────────────────────
function InventoryCard({ item }) {
  return (
    <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', paddingTop: '140%', background: 'rgba(0,0,0,0.3)' }}>
        <img src={`https://optcgapi.com/media/static/Card_Images/${item.card_id}.jpg`} alt={item.card_name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          onError={e => { e.target.style.display = 'none' }} />
        {(item.quantity ?? 1) > 1 && (
          <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', borderRadius: 12, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#f0f2f5' }}>
            x{item.quantity}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f2f5', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>${Number(item.price).toFixed(2)}</span>
          <ConditionBadge condition={item.condition} />
        </div>
      </div>
    </div>
  )
}

// ─── StorefrontPage ────────────────────────────────────────────────────────────
export default function StorefrontPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isMobile, isTablet } = useWindowSize()
  const [storefront, setStorefront] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showMessage, setShowMessage] = useState(false)
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [managerView, setManagerView] = useState(false)
  const [approving, setApproving] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: sf } = await supabase.from('storefronts').select('*').eq('id', id).single()
    if (!sf) { setLoading(false); return }
    setStorefront(sf)
    setLoading(false)
    if (session) {
      setIsOwner(session.user.id === sf.user_id)
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', session.user.id).single()
      setIsAdmin(prof?.username === 'Cipin')
    }
    loadInventory()
  }

  async function loadInventory() {
    setInventoryLoading(true)
    const { data } = await supabase.from('store_inventory').select('*').eq('storefront_id', id).eq('status', 'active').order('created_at', { ascending: false })
    setInventory(data ?? [])
    setInventoryLoading(false)
  }

  async function removeItem(itemId) {
    await supabase.from('store_inventory').update({ status: 'sold' }).eq('id', itemId)
    setInventory(prev => prev.filter(i => i.id !== itemId))
    setConfirmDeleteItem(null)
  }

  async function setApprovalStatus(status) {
    setApproving(true)
    await supabase.from('storefronts').update({ status }).eq('id', id)
    setStorefront(prev => ({ ...prev, status }))
    setApproving(false)
  }

  const filteredInventory = inventory.filter(item => {
    if (search && !item.card_name.toLowerCase().includes(search.toLowerCase())) return false
    if (colorFilter && item.card_color !== colorFilter) return false
    if (typeFilter && item.card_type !== typeFilter) return false
    if (conditionFilter && item.condition !== conditionFilter) return false
    if (priceMin && Number(item.price) < parseFloat(priceMin)) return false
    if (priceMax && Number(item.price) > parseFloat(priceMax)) return false
    return true
  })
  const filtersActive = search || colorFilter || typeFilter || conditionFilter || priceMin || priceMax

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#7c6fa0', fontSize: 13 }}>Loading...</div>

  if (!storefront) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 16 }}>Storefront not found</div>
      <button onClick={() => navigate('/marketplace')} style={{ fontSize: 12, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>← Marketplace</button>
    </div>
  )

  const STATUS_COLORS = { pending: '#fbbf24', approved: '#34d399', rejected: '#f05252' }

  return (
    <div>
      <button onClick={() => navigate('/marketplace')} style={{ fontSize: 12, color: '#7c6fa0', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 20 }}>
        ← Back to Marketplace
      </button>

      {/* Admin approval bar */}
      {isAdmin && storefront.status !== 'approved' && (
        <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Admin · {storefront.status === 'pending' ? 'Pending Application' : 'Rejected'}</div>
            <div style={{ fontSize: 12, color: '#7c6fa0', marginTop: 2 }}>Applied {new Date(storefront.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {storefront.status !== 'rejected' && (
              <button onClick={() => setApprovalStatus('rejected')} disabled={approving}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: '#f05252', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Reject
              </button>
            )}
            <button onClick={() => setApprovalStatus('approved')} disabled={approving}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #059669, #34d399)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Store header */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 28, padding: '20px 22px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.14)', borderRadius: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={{ width: isMobile ? 72 : 88, height: isMobile ? 72 : 88, borderRadius: 14, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {storefront.logo_url
            ? <img src={storefront.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 36 }}>🏪</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: '#f0f2f5', letterSpacing: '-0.3px' }}>{storefront.store_name}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${STATUS_COLORS[storefront.status]}22`, color: STATUS_COLORS[storefront.status], border: `1px solid ${STATUS_COLORS[storefront.status]}44`, textTransform: 'capitalize' }}>
              {storefront.status}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {storefront.address && <div style={{ fontSize: 12, color: '#7c6fa0' }}>📍 {storefront.address}</div>}
            {storefront.contact_info && <div style={{ fontSize: 12, color: '#7c6fa0' }}>📞 {storefront.contact_info}</div>}
            {storefront.website_url && (
              <a href={storefront.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#8b5cf6', textDecoration: 'none' }}>
                🔗 {storefront.website_url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignSelf: 'center' }}>
          {isOwner ? (
            <>
              <button onClick={() => setShowEdit(true)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Edit Profile</button>
              <button onClick={() => setManagerView(v => !v)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: managerView ? 'rgba(139,92,246,0.2)' : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {managerView ? 'View Store' : 'Manage Inventory'}
              </button>
            </>
          ) : session ? (
            <button onClick={() => setShowMessage(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Message Store
            </button>
          ) : (
            <button onClick={() => navigate('/login')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'transparent', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign in to message
            </button>
          )}
        </div>
      </div>

      {/* Manager view */}
      {isOwner && managerView ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>
              Inventory <span style={{ fontSize: 12, fontWeight: 400, color: '#7c6fa0' }}>({inventory.length} cards)</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCsvImport(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Bulk Import</button>
              <button onClick={() => setShowAddCard(true)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Card</button>
            </div>
          </div>
          {inventory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#3d2d6e' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>No cards yet</div>
              <div style={{ fontSize: 12 }}>Add cards one by one or use Bulk Import</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inventory.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10, padding: '10px 14px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <img src={`https://optcgapi.com/media/static/Card_Images/${item.card_id}.jpg`} alt={item.card_name}
                    style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, flexShrink: 0, border: '1px solid rgba(255,255,255,0.06)' }}
                    onError={e => { e.target.style.display = 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.card_name} {(item.quantity ?? 1) > 1 && <span style={{ fontSize: 11, fontWeight: 400, color: '#7c6fa0' }}>x{item.quantity}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#7c6fa0', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <ConditionBadge condition={item.condition} />
                      <span style={{ color: '#3d2d6e' }}>·</span>
                      <span style={{ fontFamily: 'monospace', color: '#f0f2f5', fontWeight: 700 }}>${Number(item.price).toFixed(2)}</span>
                      <span style={{ color: '#3d2d6e' }}>· {item.card_id}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditItem(item)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    {confirmDeleteItem === item.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => removeItem(item.id)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#f05252', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                        <button onClick={() => setConfirmDeleteItem(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteItem(item.id)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', color: '#f05252', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Public browse view */
        <>
          <div style={{ position: 'sticky', top: 52, zIndex: 30, background: 'rgba(12,8,20,0.93)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(139,92,246,0.1)', marginBottom: 20, marginLeft: isMobile ? '-1rem' : '-1.5rem', marginRight: isMobile ? '-1rem' : '-1.5rem', paddingTop: 12, paddingBottom: 14, paddingLeft: isMobile ? '1rem' : '1.5rem', paddingRight: isMobile ? '1rem' : '1.5rem' }}>
            <input type="text" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...INPUT, width: '100%', padding: '10px 14px', marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select value={colorFilter} onChange={e => setColorFilter(e.target.value)} style={{ ...INPUT, minWidth: 130, cursor: 'pointer' }}>
                <option value="">All Colors</option>
                {CARD_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...INPUT, minWidth: 130, cursor: 'pointer' }}>
                <option value="">All Types</option>
                {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)} style={{ ...INPUT, minWidth: 160, cursor: 'pointer' }}>
                <option value="">All Conditions</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" min="0" placeholder="Min $" value={priceMin} onChange={e => setPriceMin(e.target.value)} style={{ ...INPUT, width: 90 }} />
              <input type="number" min="0" placeholder="Max $" value={priceMax} onChange={e => setPriceMax(e.target.value)} style={{ ...INPUT, width: 90 }} />
              {filtersActive && <button onClick={() => { setSearch(''); setColorFilter(''); setTypeFilter(''); setConditionFilter(''); setPriceMin(''); setPriceMax('') }} style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7c6fa0', cursor: 'pointer', fontFamily: 'inherit' }}>Clear ✕</button>}
            </div>
            <div style={{ fontSize: 11, color: '#3d2d6e', marginTop: 8 }}>
              {inventoryLoading ? 'Loading...' : `${filteredInventory.length} card${filteredInventory.length !== 1 ? 's' : ''} in stock`}
            </div>
          </div>

          {inventoryLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#7c6fa0', fontSize: 13 }}>Loading inventory...</div>
          ) : filteredInventory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d2d6e' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>{filtersActive ? '🔍' : '📦'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0', marginBottom: 6 }}>{filtersActive ? 'No cards match your filters' : 'No inventory yet'}</div>
              <div style={{ fontSize: 13 }}>{filtersActive ? 'Try adjusting your search' : "This store hasn't added any cards yet"}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : isTablet ? 3 : 4}, 1fr)`, gap: isMobile ? 10 : 14 }}>
              {filteredInventory.map(item => <InventoryCard key={item.id} item={item} />)}
            </div>
          )}
        </>
      )}

      {showEdit && <EditStoreModal storefront={storefront} onClose={() => setShowEdit(false)} onSuccess={() => { setShowEdit(false); load() }} isMobile={isMobile} />}
      {(showAddCard || editItem) && (
        <AddInventoryModal storefront={storefront} editItem={editItem ?? null}
          onClose={() => { setShowAddCard(false); setEditItem(null) }}
          onSuccess={() => { setShowAddCard(false); setEditItem(null); loadInventory() }}
          isMobile={isMobile} />
      )}
      {showCsvImport && <CsvImportModal storefront={storefront} onClose={() => setShowCsvImport(false)} onSuccess={() => { setShowCsvImport(false); loadInventory() }} isMobile={isMobile} />}
      {showMessage && session && <StoreMessageModal storefront={storefront} currentUser={session.user} onClose={() => setShowMessage(false)} isMobile={isMobile} />}
    </div>
  )
}
