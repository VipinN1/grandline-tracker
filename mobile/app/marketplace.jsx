// RN port of src/pages/Marketplace.jsx — Browse / Looking For / Stores / Mine.
// Store inventory management (CSV import etc.) stays web-only; the mobile
// Stores tab is buyer-facing plus the storefront application flow.
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Image, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { getCardImageUrl } from '../lib/optcgapi'
import { pickAndUploadImage } from '../lib/upload'
import { colors, font, radius } from '../theme'
import { fieldInput, FieldLabel, LEADER_COLORS } from '../components/forms'
import { CONDITIONS, ConditionBadge, ItemImage, ChatModal, CardPicker, cardArtUrl } from '../components/market/shared'
import ProfileCard, { Avatar } from '../components/ProfileCard'

const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']

function SectionLabel({ children }) {
  return <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 12 }}>{children}</Text>
}

function sheetStyle() {
  return { backgroundColor: colors.abyss, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%', borderWidth: 1, borderColor: colors.lineStrong }
}

// ─── Listing detail ───────────────────────────────────────────────────────────
function ListingDetailModal({ listing, session, onClose, onMarkSold, onMessage }) {
  const [sellerProfile, setSellerProfile] = useState(null)
  const isOwner = listing?.user_id === session?.user?.id
  const seller = listing?.profiles
  if (!listing) return null

  async function handleMarkSold() {
    await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', listing.id)
    onMarkSold?.(listing.id)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: font.bold, color: colors.text }}>{listing.card_name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <ItemImage item={listing} style={{ width: 140, height: 196, borderRadius: 10, backgroundColor: '#1a1025' }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 26, fontFamily: font.mono, color: colors.text, marginBottom: 8 }}>${Number(listing.price).toFixed(2)}</Text>
                <ConditionBadge condition={listing.condition} />
                {(listing.quantity ?? 1) > 1 ? <Text style={{ fontSize: 12, color: colors.oceanBright, marginTop: 8, fontFamily: font.semi }}>Quantity: {listing.quantity}</Text> : null}
                <Text style={{ fontSize: 12, color: LEADER_COLORS[listing.card_color] ?? colors.muted, marginTop: 8, fontFamily: font.body }}>
                  {[listing.card_color, listing.card_type].filter(Boolean).join(' · ')}
                </Text>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono, marginTop: 3 }}>{listing.card_id}</Text>
                {listing.set_name ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.body }}>{listing.set_name}</Text> : null}
                {listing.city ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6, fontFamily: font.body }}>📍 {listing.city}</Text> : null}
              </View>
            </View>

            {listing.description ? (
              <View style={{ backgroundColor: 'rgba(140,176,208,0.03)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.line }}>
                <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint, marginBottom: 6 }}>Description</Text>
                <Text style={{ fontSize: 13, color: '#b0bac8', lineHeight: 20, fontFamily: font.body }}>{listing.description}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => seller && setSellerProfile(seller)} style={{ backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar profile={seller} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{seller?.username ?? 'Unknown'}</Text>
                {seller?.location ? <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>📍 {seller.location}</Text> : null}
              </View>
              <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>
                {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>

            {isOwner ? (
              <TouchableOpacity onPress={handleMarkSold} disabled={listing.status === 'sold'} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: listing.status === 'sold' ? 'rgba(140,176,208,0.05)' : colors.emerald, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: listing.status === 'sold' ? colors.muted : '#0f1117' }}>
                  {listing.status === 'sold' ? 'Sold ✓' : 'Mark as Sold'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => { onClose(); onMessage(listing) }} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.ocean, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>Message Seller</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
      {sellerProfile && <ProfileCard profile={sellerProfile} session={session} onClose={() => setSellerProfile(null)} />}
    </Modal>
  )
}

// ─── Create / edit listing ────────────────────────────────────────────────────
function ListingFormModal({ session, profile, listing, onClose, onSuccess }) {
  const isEdit = !!listing
  const [selectedCard, setSelectedCard] = useState(null)
  const [price, setPrice] = useState(isEdit ? String(listing.price) : '')
  const [quantity, setQuantity] = useState(isEdit ? String(listing.quantity ?? 1) : '1')
  const [condition, setCondition] = useState(isEdit ? listing.condition : '')
  const [description, setDescription] = useState(isEdit ? (listing.description ?? '') : '')
  const [city, setCity] = useState(isEdit ? (listing.city ?? '') : (profile?.location?.split(',')[0]?.trim() ?? ''))
  const [photoUrl, setPhotoUrl] = useState(isEdit ? listing.photo_url : null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handlePhoto() {
    try {
      setUploading(true)
      const url = await pickAndUploadImage({ bucket: 'card-photos', path: `${session.user.id}/${Date.now()}` })
      if (url) setPhotoUrl(url)
    } catch (e) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload the photo.')
    } finally { setUploading(false) }
  }

  async function handleSubmit() {
    if (!isEdit && !selectedCard) { setError('Please select a card.'); return }
    if (!price || !condition) { setError('Price and condition are required.'); return }
    if (parseFloat(price) <= 0) { setError('Price must be greater than 0.'); return }
    setSaving(true); setError('')

    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('marketplace_listings').update({
        price: parseFloat(price), quantity: parseInt(quantity) || 1, condition,
        description: description.trim() || null, city: city.trim() || null,
        photo_url: photoUrl, updated_at: new Date().toISOString(),
      }).eq('id', listing.id))
    } else {
      ;({ error: err } = await supabase.from('marketplace_listings').insert({
        user_id: session.user.id,
        card_id: selectedCard.card_image_id ?? selectedCard.card_set_id,
        card_name: selectedCard.card_name,
        card_color: selectedCard.card_color ?? null,
        card_type: selectedCard.card_type ?? null,
        set_name: selectedCard.set_name ?? null,
        price: parseFloat(price),
        quantity: parseInt(quantity) || 1,
        condition,
        description: description.trim() || null,
        city: city.trim() || null,
        photo_url: photoUrl,
        status: 'active',
      }))
    }
    setSaving(false)
    if (err) { setError('Failed to save listing: ' + err.message); return }
    onSuccess()
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>{isEdit ? 'Edit Listing' : 'New Listing'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            {isEdit ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.03)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 10, opacity: 0.7 }}>
                <Image source={{ uri: cardArtUrl(listing.card_id) }} style={{ width: 32, height: 44, borderRadius: 4 }} resizeMode="cover" />
                <View>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{listing.card_name}</Text>
                  <Text style={{ fontSize: 11, color: colors.faint, marginTop: 1, fontFamily: font.body }}>Card selection locked</Text>
                </View>
              </View>
            ) : (
              <View>
                <FieldLabel>Card *</FieldLabel>
                <CardPicker selected={selectedCard} onSelect={setSelectedCard} onClear={() => setSelectedCard(null)} />
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Price (USD) *</FieldLabel>
                <TextInput placeholder="0.00" placeholderTextColor={colors.faint} value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={fieldInput} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Quantity</FieldLabel>
                <TextInput placeholderTextColor={colors.faint} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={fieldInput} />
              </View>
            </View>

            <View>
              <FieldLabel>Condition *</FieldLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CONDITIONS.map(c => {
                  const active = condition === c
                  return (
                    <TouchableOpacity key={c} onPress={() => setCondition(c)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong, backgroundColor: active ? colors.goldSoft : 'transparent' }}>
                      <Text style={{ fontSize: 11, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{c}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <View>
              <FieldLabel>Description</FieldLabel>
              <TextInput placeholder="Optional: condition details, shipping info, etc." placeholderTextColor={colors.faint} value={description} onChangeText={v => setDescription(v.slice(0, 500))} multiline style={{ ...fieldInput, minHeight: 80, textAlignVertical: 'top' }} />
            </View>

            <View>
              <FieldLabel>City</FieldLabel>
              <TextInput placeholder="e.g. Los Angeles" placeholderTextColor={colors.faint} value={city} onChangeText={setCity} style={fieldInput} />
            </View>

            <View>
              <FieldLabel>Photo (optional)</FieldLabel>
              {photoUrl ? (
                <View style={{ gap: 6 }}>
                  <Image source={{ uri: photoUrl }} style={{ width: 120, height: 160, borderRadius: 8 }} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setPhotoUrl(null)}>
                    <Text style={{ fontSize: 11, color: colors.crimson, fontFamily: font.semi }}>Remove photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handlePhoto} disabled={uploading} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(140,176,208,0.05)' }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{uploading ? 'Uploading...' : '📷 Add Photo'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <TouchableOpacity onPress={handleSubmit} disabled={saving} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: saving ? '#3a526a' : colors.ocean, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Listing'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Create want ──────────────────────────────────────────────────────────────
function CreateWantModal({ session, onClose, onSuccess }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [quantity, setQuantity] = useState('1')
  const [maxPrice, setMaxPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!selectedCard) { setError('Please select a card.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('marketplace_wants').insert({
      user_id: session.user.id,
      card_id: selectedCard.card_image_id ?? selectedCard.card_set_id,
      card_name: selectedCard.card_name,
      card_color: selectedCard.card_color ?? null,
      card_type: selectedCard.card_type ?? null,
      set_name: selectedCard.set_name ?? null,
      quantity: parseInt(quantity) || 1,
      max_price: maxPrice ? parseFloat(maxPrice) : null,
      notes: notes.trim() || null,
      status: 'active',
    })
    setSaving(false)
    if (err) { setError('Failed to post want.'); return }
    onSuccess()
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>Looking For</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View>
              <FieldLabel>Card *</FieldLabel>
              <CardPicker selected={selectedCard} onSelect={setSelectedCard} onClear={() => setSelectedCard(null)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Quantity *</FieldLabel>
                <TextInput placeholderTextColor={colors.faint} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={fieldInput} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Max Price (optional)</FieldLabel>
                <TextInput placeholder="$0.00" placeholderTextColor={colors.faint} value={maxPrice} onChangeText={setMaxPrice} keyboardType="decimal-pad" style={fieldInput} />
              </View>
            </View>
            <View>
              <FieldLabel>Notes (optional)</FieldLabel>
              <TextInput placeholder="Condition preferences, specific art, etc." placeholderTextColor={colors.faint} value={notes} onChangeText={v => setNotes(v.slice(0, 300))} multiline style={{ ...fieldInput, minHeight: 70, textAlignVertical: 'top' }} />
            </View>
            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <TouchableOpacity onPress={handleSubmit} disabled={!selectedCard || saving} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: selectedCard && !saving ? colors.gold : 'rgba(140,176,208,0.05)', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: selectedCard && !saving ? '#0f1117' : colors.muted }}>{saving ? 'Posting...' : 'Post Want'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Apply as storefront ──────────────────────────────────────────────────────
function ApplyStorefrontModal({ session, onClose, onSuccess }) {
  const [storeName, setStoreName] = useState('')
  const [address, setAddress] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleLogo() {
    try {
      setUploading(true)
      const url = await pickAndUploadImage({ bucket: 'card-photos', path: `store-logos/apply-${session.user.id}-${Date.now()}` })
      if (url) setLogoUrl(url)
    } catch (e) { Alert.alert('Upload failed', e.message) } finally { setUploading(false) }
  }

  async function submit() {
    if (!storeName.trim()) { setError('Store name is required.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('storefronts').insert({
      user_id: session.user.id, store_name: storeName.trim(),
      address: address.trim(), contact_info: contactInfo.trim(),
      website_url: websiteUrl.trim(), logo_url: logoUrl, status: 'pending',
    })
    setSaving(false)
    if (err) { setError('Submission failed: ' + err.message); return }
    onSuccess()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>Apply as Storefront</Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1, fontFamily: font.body }}>Reviewed before going live</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: 'rgba(140,176,208,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 24 }}>🏪</Text>}
              </View>
              <TouchableOpacity onPress={handleLogo} disabled={uploading} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: 'rgba(140,176,208,0.08)' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{uploading ? 'Uploading...' : 'Upload Logo'}</Text>
              </TouchableOpacity>
            </View>
            <View><FieldLabel>Store Name *</FieldLabel><TextInput placeholder="e.g. Pirate's Cove Cards" placeholderTextColor={colors.faint} value={storeName} onChangeText={setStoreName} style={fieldInput} /></View>
            <View><FieldLabel>Address</FieldLabel><TextInput placeholder="123 Main St, City, State" placeholderTextColor={colors.faint} value={address} onChangeText={setAddress} style={fieldInput} /></View>
            <View><FieldLabel>Contact Info</FieldLabel><TextInput placeholder="Phone or email" placeholderTextColor={colors.faint} value={contactInfo} onChangeText={setContactInfo} style={fieldInput} /></View>
            <View><FieldLabel>Website / Social Link</FieldLabel><TextInput placeholder="https://..." placeholderTextColor={colors.faint} value={websiteUrl} onChangeText={setWebsiteUrl} autoCapitalize="none" style={fieldInput} /></View>
            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <TouchableOpacity onPress={submit} disabled={saving} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: saving ? '#3a526a' : colors.ocean, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Submitting...' : 'Submit Application'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Inbox (listing message threads) ─────────────────────────────────────────
function InboxSection({ session }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeConvo, setActiveConvo] = useState(null)

  const loadConversations = useCallback(async () => {
    const { data: msgs } = await supabase
      .from('marketplace_messages')
      .select('*')
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })

    if (!msgs || msgs.length === 0) { setConversations([]); setLoading(false); return }

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
  }, [session.user.id])

  useEffect(() => { loadConversations() }, [loadConversations])

  if (loading) return <ActivityIndicator color={colors.gold} style={{ padding: 20 }} />
  if (conversations.length === 0) return (
    <Text style={{ textAlign: 'center', padding: 24, fontSize: 12, color: colors.faint, fontFamily: font.body }}>
      Messages from buyers and sellers will appear here
    </Text>
  )

  return (
    <View style={{ gap: 6 }}>
      {conversations.map(c => (
        <TouchableOpacity key={c.key} onPress={() => setActiveConvo(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: c.unreadCount > 0 ? colors.goldLine : colors.line, borderRadius: 10, padding: 10 }}>
          <Image source={{ uri: c.listing ? (c.listing.photo_url ?? cardArtUrl(c.listing.card_id)) : undefined }} style={{ width: 30, height: 42, borderRadius: 4 }} resizeMode="cover" />
          <Avatar profile={c.otherProfile} size={30} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.bold, color: colors.text }}>{c.listing?.card_name ?? 'Unknown listing'}</Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 1, fontFamily: font.body }}>
              {c.otherProfile?.username ?? 'Unknown'} · {c.lastMsg.body}
            </Text>
          </View>
          {c.unreadCount > 0 && (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ocean, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontFamily: font.bold }}>{c.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
      {activeConvo?.listing && (
        <ChatModal
          visible
          onClose={() => { setActiveConvo(null); loadConversations() }}
          table="marketplace_messages"
          contextField="listing_id"
          contextId={activeConvo.listing.id}
          currentUserId={session.user.id}
          receiverId={activeConvo.otherId}
          headerTitle={activeConvo.listing.card_name}
          headerSubtitle={`$${Number(activeConvo.listing.price).toFixed(2)} · ${activeConvo.otherProfile?.username ?? 'User'}`}
          headerImageUri={activeConvo.listing.photo_url ?? cardArtUrl(activeConvo.listing.card_id)}
        />
      )}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function Marketplace() {
  const { session } = useSession()
  const { width: screenW } = useWindowDimensions()
  const cardW = Math.floor((screenW - 32 - 10) / 2)

  const [activeTab, setActiveTab] = useState('browse')
  const [profile, setProfile] = useState(null)

  // Browse
  const [allListings, setAllListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [detailListing, setDetailListing] = useState(null)
  const [messageListing, setMessageListing] = useState(null)

  // Wants
  const [allWants, setAllWants] = useState([])
  const [wantsLoading, setWantsLoading] = useState(true)
  const [wantSearch, setWantSearch] = useState('')
  const [contactWant, setContactWant] = useState(null)
  const [showCreateWant, setShowCreateWant] = useState(false)

  // Stores
  const [storefronts, setStorefronts] = useState([])
  const [storesLoading, setStoresLoading] = useState(true)
  const [myStorefront, setMyStorefront] = useState(null)
  const [showApply, setShowApply] = useState(false)

  // Mine
  const [myListings, setMyListings] = useState([])
  const [myWants, setMyWants] = useState([])
  const [mineLoading, setMineLoading] = useState(true)
  const [showCreateListing, setShowCreateListing] = useState(false)
  const [editListing, setEditListing] = useState(false)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data ?? null)
    }
    if (session) init()
    loadListings()
  }, [session])

  async function loadListings() {
    setLoading(true)
    const { data } = await supabase
      .from('marketplace_listings')
      .select('*, profiles!marketplace_listings_user_id_fkey(id, username, avatar_url, location, bio)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200)
    setAllListings(data ?? [])
    setLoading(false)
  }

  async function loadWants() {
    setWantsLoading(true)
    const { data } = await supabase
      .from('marketplace_wants')
      .select('*, profiles!marketplace_wants_user_id_fkey(id, username, avatar_url, location, bio)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200)
    setAllWants(data ?? [])
    setWantsLoading(false)
  }

  async function loadStores() {
    setStoresLoading(true)
    const [{ data: approved }, mineRes] = await Promise.all([
      supabase.from('storefronts').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
      session ? supabase.from('storefronts').select('*').eq('user_id', session.user.id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    setStorefronts(approved ?? [])
    setMyStorefront(mineRes?.data ?? null)
    setStoresLoading(false)
  }

  async function loadMine() {
    setMineLoading(true)
    const [{ data: listings }, { data: wants }] = await Promise.all([
      supabase.from('marketplace_listings').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('marketplace_wants').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
    ])
    setMyListings(listings ?? [])
    setMyWants(wants ?? [])
    setMineLoading(false)
  }

  useEffect(() => { if (activeTab === 'wants') loadWants() }, [activeTab])
  useEffect(() => { if (activeTab === 'stores') loadStores() }, [activeTab])
  useEffect(() => { if (activeTab === 'mine' && session) loadMine() }, [activeTab, session])

  const filteredListings = allListings.filter(l => {
    if (search && !l.card_name.toLowerCase().includes(search.toLowerCase())) return false
    if (colorFilter && l.card_color !== colorFilter) return false
    if (conditionFilter && l.condition !== conditionFilter) return false
    return true
  })
  const filteredWants = allWants.filter(w => !wantSearch || w.card_name.toLowerCase().includes(wantSearch.toLowerCase()))

  const STATUS_COLOR = { active: colors.emerald, sold: colors.muted, removed: colors.crimson, found: colors.emerald, pending: colors.gold, approved: colors.emerald, rejected: colors.crimson }

  const TABS = [['browse', 'Browse'], ['wants', 'Looking For'], ['stores', 'Stores'], ['mine', 'Mine']]

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Marketplace',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <View style={{ flex: 1, backgroundColor: colors.abyss }}>
        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 6, padding: 12, paddingHorizontal: 16 }}>
          {TABS.map(([key, label]) => {
            const active = activeTab === key
            return (
              <TouchableOpacity key={key} onPress={() => setActiveTab(key)} style={{ flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center', borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong, backgroundColor: active ? colors.goldSoft : 'transparent' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Browse ── */}
        {activeTab === 'browse' && (
          <FlatList
            data={filteredListings}
            keyExtractor={l => l.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 48, gap: 10 }}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
                <TextInput placeholder="Search cards by name..." placeholderTextColor={colors.faint} value={search} onChangeText={setSearch} style={fieldInput} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  <TouchableOpacity onPress={() => setColorFilter('')} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: !colorFilter ? colors.goldLine : colors.lineStrong, backgroundColor: !colorFilter ? colors.goldSoft : 'transparent' }}>
                    <Text style={{ fontSize: 11, fontFamily: font.semi, color: !colorFilter ? colors.gold : colors.muted }}>All Colors</Text>
                  </TouchableOpacity>
                  {CARD_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setColorFilter(colorFilter === c ? '' : c)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: colorFilter === c ? (LEADER_COLORS[c] + '66') : colors.lineStrong, backgroundColor: colorFilter === c ? (LEADER_COLORS[c] + '26') : 'transparent' }}>
                      <Text style={{ fontSize: 11, fontFamily: font.semi, color: colorFilter === c ? LEADER_COLORS[c] : colors.muted }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  <TouchableOpacity onPress={() => setConditionFilter('')} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: !conditionFilter ? colors.goldLine : colors.lineStrong, backgroundColor: !conditionFilter ? colors.goldSoft : 'transparent' }}>
                    <Text style={{ fontSize: 11, fontFamily: font.semi, color: !conditionFilter ? colors.gold : colors.muted }}>All Conditions</Text>
                  </TouchableOpacity>
                  {CONDITIONS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setConditionFilter(conditionFilter === c ? '' : c)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: conditionFilter === c ? colors.goldLine : colors.lineStrong, backgroundColor: conditionFilter === c ? colors.goldSoft : 'transparent' }}>
                      <Text style={{ fontSize: 11, fontFamily: font.semi, color: conditionFilter === c ? colors.gold : colors.muted }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>
                  {loading ? 'Loading...' : `${filteredListings.length} listing${filteredListings.length !== 1 ? 's' : ''} found`}
                </Text>
              </View>
            }
            ListEmptyComponent={
              loading ? <ActivityIndicator color={colors.gold} style={{ padding: 60 }} /> : (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 14 }}>🏪</Text>
                  <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted }}>No listings found</Text>
                </View>
              )
            }
            renderItem={({ item: listing }) => (
              <TouchableOpacity onPress={() => setDetailListing(listing)} style={{ width: cardW, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, overflow: 'hidden' }}>
                <ItemImage item={listing} style={{ width: '100%', height: 150, backgroundColor: '#1a1025' }} />
                <View style={{ padding: 10, gap: 3 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{listing.card_name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{listing.card_id}</Text>
                  <ConditionBadge condition={listing.condition} />
                  <Text style={{ fontSize: 16, fontFamily: font.mono, color: colors.text, marginTop: 2 }}>${Number(listing.price).toFixed(2)}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>
                    {listing.profiles?.username ?? 'Unknown'}{listing.city ? ` · ${listing.city}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* ── Looking For ── */}
        {activeTab === 'wants' && (
          <FlatList
            data={filteredWants}
            keyExtractor={w => w.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 48, gap: 10 }}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput placeholder="Search wanted cards..." placeholderTextColor={colors.faint} value={wantSearch} onChangeText={setWantSearch} style={{ ...fieldInput, flex: 1, width: undefined }} />
                  <TouchableOpacity onPress={() => setShowCreateWant(true)} style={{ paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.gold, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>+ Want</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>
                  {wantsLoading ? 'Loading...' : `${filteredWants.length} want${filteredWants.length !== 1 ? 's' : ''} posted`}
                </Text>
              </View>
            }
            ListEmptyComponent={
              wantsLoading ? <ActivityIndicator color={colors.gold} style={{ padding: 60 }} /> : (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 14 }}>🔎</Text>
                  <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted }}>No wants posted yet</Text>
                </View>
              )
            }
            renderItem={({ item: want }) => {
              const isOwner = want.user_id === session?.user?.id
              return (
                <View style={{ width: cardW, backgroundColor: 'rgba(200,162,74,0.03)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.15)', borderRadius: 12, overflow: 'hidden' }}>
                  <View>
                    <ItemImage item={want} style={{ width: '100%', height: 150, backgroundColor: '#1a1025' }} />
                    <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(200,162,74,0.9)', borderRadius: 5, paddingVertical: 2, paddingHorizontal: 7 }}>
                      <Text style={{ fontSize: 10, fontFamily: font.bold, color: '#0f1117' }}>WTB</Text>
                    </View>
                  </View>
                  <View style={{ padding: 10, gap: 3 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{want.custom_title ?? want.card_name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{want.card_id} · x{want.quantity}</Text>
                    {want.max_price ? (
                      <Text style={{ fontSize: 13, fontFamily: font.mono, color: colors.gold }}>Up to ${Number(want.max_price).toFixed(2)}</Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>Price negotiable</Text>
                    )}
                    <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{want.profiles?.username ?? 'Unknown'}</Text>
                    {isOwner ? (
                      <View style={{ marginTop: 4, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(200,162,74,0.1)', borderWidth: 1, borderColor: colors.goldLine, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: font.bold, color: colors.gold }}>YOUR WANT</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => setContactWant(want)} style={{ marginTop: 4, paddingVertical: 6, borderRadius: 7, backgroundColor: colors.gold, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontFamily: font.bold, color: '#0f1117' }}>I Have This!</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            }}
          />
        )}

        {/* ── Stores ── */}
        {activeTab === 'stores' && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}>
            {storesLoading ? <ActivityIndicator color={colors.gold} style={{ padding: 60 }} /> : (
              <>
                {storefronts.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 50 }}>
                    <Text style={{ fontSize: 40, marginBottom: 14 }}>🏪</Text>
                    <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted }}>No storefronts yet</Text>
                  </View>
                ) : storefronts.map(store => (
                  <TouchableOpacity key={store.id} onPress={() => router.push(`/storefront/${store.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 14, padding: 12 }}>
                    <View style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: 'rgba(140,176,208,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {store.logo_url ? <Image source={{ uri: store.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 26 }}>🏪</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>{store.store_name}</Text>
                      {store.address ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>📍 {store.address}</Text> : null}
                    </View>
                    <Text style={{ fontSize: 16, color: colors.faint }}>›</Text>
                  </TouchableOpacity>
                ))}

                {/* My storefront / apply */}
                <View style={{ marginTop: 12 }}>
                  <SectionLabel>My Storefront</SectionLabel>
                  {myStorefront ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, padding: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(140,176,208,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {myStorefront.logo_url ? <Image source={{ uri: myStorefront.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 20 }}>🏪</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{myStorefront.store_name}</Text>
                        <Text style={{ fontSize: 11, marginTop: 2, fontFamily: font.semi, color: STATUS_COLOR[myStorefront.status] ?? colors.muted }}>
                          {myStorefront.status === 'pending' ? 'Pending review' : myStorefront.status === 'approved' ? 'Live' : 'Rejected'}
                        </Text>
                      </View>
                      {myStorefront.status === 'approved' && (
                        <TouchableOpacity onPress={() => router.push(`/storefront/${myStorefront.id}`)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.ocean }}>
                          <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>View</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, padding: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>Become a Storefront</Text>
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.body }}>List your store's inventory and reach buyers</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowApply(true)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.ocean }}>
                        <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#fff' }}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* ── Mine ── */}
        {activeTab === 'mine' && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            {mineLoading ? <ActivityIndicator color={colors.gold} style={{ padding: 60 }} /> : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text }}>My Listings ({myListings.length})</Text>
                  <TouchableOpacity onPress={() => setShowCreateListing(true)} style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.ocean }}>
                    <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#fff' }}>+ New Listing</Text>
                  </TouchableOpacity>
                </View>

                {myListings.length === 0 ? (
                  <Text style={{ textAlign: 'center', padding: 30, fontSize: 13, color: colors.faint, fontFamily: font.body }}>No listings yet</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {myListings.map(listing => (
                      <View key={listing.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, padding: 10 }}>
                        <ItemImage item={listing} style={{ width: 40, height: 56, borderRadius: 6 }} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>
                            {listing.card_name}{(listing.quantity ?? 1) > 1 ? ` x${listing.quantity}` : ''}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>
                            <Text style={{ fontFamily: font.mono, color: colors.text }}>${Number(listing.price).toFixed(2)}</Text>
                            {'  ·  '}
                            <Text style={{ color: STATUS_COLOR[listing.status] ?? colors.muted, textTransform: 'capitalize' }}>{listing.status}</Text>
                          </Text>
                        </View>
                        {listing.status === 'active' && (
                          <>
                            <TouchableOpacity onPress={() => setEditListing(listing)} hitSlop={4} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.goldLine }}>
                              <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.oceanBright }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={async () => {
                                await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', listing.id)
                                setMyListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: 'sold' } : l))
                              }}
                              hitSlop={4}
                              style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(59,178,126,0.25)' }}
                            >
                              <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.emerald }}>Sold</Text>
                            </TouchableOpacity>
                          </>
                        )}
                        <TouchableOpacity
                          onPress={() => Alert.alert('Delete listing', `Delete "${listing.card_name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: async () => {
                              await supabase.from('marketplace_listings').delete().eq('id', listing.id)
                              setMyListings(prev => prev.filter(l => l.id !== listing.id))
                            } },
                          ])}
                          hitSlop={4}
                          style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(210,74,58,0.25)' }}
                        >
                          <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.crimson }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ marginTop: 28 }}>
                  <SectionLabel>My Wants ({myWants.filter(w => w.status === 'active').length} active)</SectionLabel>
                  {myWants.length === 0 ? (
                    <Text style={{ textAlign: 'center', padding: 20, fontSize: 12, color: colors.faint, fontFamily: font.body }}>Post cards you're looking for in the Looking For tab</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {myWants.map(want => (
                        <View key={want.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(200,162,74,0.04)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.15)', borderRadius: 10, padding: 10, opacity: want.status === 'found' ? 0.65 : 1 }}>
                          <Image source={{ uri: cardArtUrl(want.card_id) }} style={{ width: 40, height: 56, borderRadius: 6 }} resizeMode="cover" />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{want.card_name} <Text style={{ color: colors.gold, fontFamily: font.body }}>x{want.quantity}</Text></Text>
                            <Text style={{ fontSize: 11, color: want.status === 'found' ? colors.emerald : colors.gold, marginTop: 2, fontFamily: font.semi }}>
                              {want.status === 'found' ? 'Found' : 'Seeking'}{want.max_price ? `  ·  up to $${Number(want.max_price).toFixed(2)}` : ''}
                            </Text>
                          </View>
                          {want.status === 'active' && (
                            <TouchableOpacity
                              onPress={async () => {
                                await supabase.from('marketplace_wants').update({ status: 'found' }).eq('id', want.id)
                                setMyWants(prev => prev.map(w => w.id === want.id ? { ...w, status: 'found' } : w))
                              }}
                              hitSlop={4}
                              style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(59,178,126,0.25)' }}
                            >
                              <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.emerald }}>Found</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => Alert.alert('Delete want', `Delete want for "${want.card_name}"?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: async () => {
                                await supabase.from('marketplace_wants').delete().eq('id', want.id)
                                setMyWants(prev => prev.filter(w => w.id !== want.id))
                              } },
                            ])}
                            hitSlop={4}
                            style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(210,74,58,0.25)' }}
                          >
                            <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.crimson }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={{ marginTop: 28 }}>
                  <SectionLabel>Messages</SectionLabel>
                  <InboxSection session={session} />
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* Modals */}
        {detailListing && (
          <ListingDetailModal
            listing={detailListing}
            session={session}
            onClose={() => setDetailListing(null)}
            onMarkSold={id => setAllListings(prev => prev.filter(l => l.id !== id))}
            onMessage={l => setMessageListing(l)}
          />
        )}
        {messageListing && (
          <ChatModal
            visible
            onClose={() => setMessageListing(null)}
            table="marketplace_messages"
            contextField="listing_id"
            contextId={messageListing.id}
            currentUserId={session.user.id}
            receiverId={messageListing.user_id}
            headerTitle={messageListing.card_name}
            headerSubtitle={`$${Number(messageListing.price).toFixed(2)} · ${messageListing.profiles?.username ?? 'Seller'}`}
            headerImageUri={messageListing.photo_url ?? cardArtUrl(messageListing.card_id)}
          />
        )}
        {contactWant && (
          <ChatModal
            visible
            onClose={() => setContactWant(null)}
            table="want_messages"
            contextField="want_id"
            contextId={contactWant.id}
            currentUserId={session.user.id}
            receiverId={contactWant.user_id}
            headerTitle={`${contactWant.card_name} x${contactWant.quantity}`}
            headerSubtitle={`Wanted by ${contactWant.profiles?.username ?? 'Buyer'}`}
            headerImageUri={cardArtUrl(contactWant.card_id)}
          />
        )}
        {showCreateWant && <CreateWantModal session={session} onClose={() => setShowCreateWant(false)} onSuccess={loadWants} />}
        {showCreateListing && <ListingFormModal session={session} profile={profile} onClose={() => setShowCreateListing(false)} onSuccess={() => { loadMine(); loadListings() }} />}
        {editListing && <ListingFormModal session={session} profile={profile} listing={editListing} onClose={() => setEditListing(false)} onSuccess={() => { loadMine(); loadListings() }} />}
        {showApply && (
          <ApplyStorefrontModal
            session={session}
            onClose={() => setShowApply(false)}
            onSuccess={() => { setShowApply(false); loadStores() }}
          />
        )}
      </View>
    </>
  )
}
