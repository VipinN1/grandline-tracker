// RN port of src/pages/StorefrontPage.jsx — public store browse + owner
// management console (edit profile, add/edit/remove inventory, CSV paste
// import) + admin approve/reject. Same route, client-side manage/view toggle.
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Image, Modal, ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCard, searchCards } from '../../lib/optcgapi'
import { pickAndUploadImage } from '../../lib/upload'
import { colors, font, radius, card } from '../../theme'
import { fieldInput, FieldLabel, LEADER_COLORS } from '../../components/forms'
import { CONDITIONS, ConditionBadge, ChatModal, CardPicker, cardArtUrl } from '../../components/market/shared'
import { GlassButton } from '../../components/glass'

const CARD_COLORS = ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Black']
const CARD_TYPES = ['Leader', 'Character', 'Event', 'Stage']

function sheetStyle() {
  return { backgroundColor: colors.abyss, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%', borderWidth: 1, borderColor: colors.lineStrong }
}

function SheetHeader({ title, onClose }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text></TouchableOpacity>
    </View>
  )
}

function ConditionPills({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {CONDITIONS.map(c => {
        const active = value === c
        return (
          <TouchableOpacity key={c} onPress={() => onChange(c)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong, backgroundColor: active ? colors.goldSoft : 'transparent' }}>
            <Text style={{ fontSize: 11, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{c}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Edit store profile ───────────────────────────────────────────────────────
function EditStoreModal({ store, onClose, onSaved }) {
  const [storeName, setStoreName] = useState(store.store_name ?? '')
  const [address, setAddress] = useState(store.address ?? '')
  const [contactInfo, setContactInfo] = useState(store.contact_info ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(store.website_url ?? '')
  const [logoUrl, setLogoUrl] = useState(store.logo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleLogo() {
    try {
      setUploading(true)
      const url = await pickAndUploadImage({ bucket: 'card-photos', path: `store-logos/${store.id}` })
      if (url) setLogoUrl(`${url}?t=${Date.now()}`)
    } catch (e) { Alert.alert('Upload failed', e.message) } finally { setUploading(false) }
  }

  async function save() {
    if (!storeName.trim()) { setError('Store name is required.'); return }
    setSaving(true); setError('')
    const patch = {
      store_name: storeName.trim(),
      address: address.trim(),
      contact_info: contactInfo.trim(),
      website_url: websiteUrl.trim(),
      logo_url: logoUrl,
    }
    const { error: err } = await supabase.from('storefronts').update(patch).eq('id', store.id)
    setSaving(false)
    if (err) { setError('Failed to save: ' + err.message); return }
    onSaved(patch)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <SheetHeader title="Edit Store Profile" onClose={onClose} />
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: 'rgba(140,176,208,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 24 }}>🏪</Text>}
              </View>
              <TouchableOpacity onPress={handleLogo} disabled={uploading} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: 'rgba(140,176,208,0.08)' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{uploading ? 'Uploading...' : 'Change Logo'}</Text>
              </TouchableOpacity>
            </View>
            <View><FieldLabel>Store Name *</FieldLabel><TextInput placeholderTextColor={colors.faint} value={storeName} onChangeText={setStoreName} style={fieldInput} /></View>
            <View><FieldLabel>Address</FieldLabel><TextInput placeholderTextColor={colors.faint} value={address} onChangeText={setAddress} style={fieldInput} /></View>
            <View><FieldLabel>Contact Info</FieldLabel><TextInput placeholderTextColor={colors.faint} value={contactInfo} onChangeText={setContactInfo} style={fieldInput} /></View>
            <View><FieldLabel>Website / Social Link</FieldLabel><TextInput placeholderTextColor={colors.faint} value={websiteUrl} onChangeText={setWebsiteUrl} autoCapitalize="none" style={fieldInput} /></View>
            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <GlassButton onPress={save} disabled={saving} tint={colors.ocean} pad={{ paddingVertical: 11, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </GlassButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Add / edit inventory item ────────────────────────────────────────────────
function InventoryFormModal({ storefrontId, item, onClose, onSuccess }) {
  const isEdit = !!item
  const [selectedCard, setSelectedCard] = useState(null)
  const [price, setPrice] = useState(isEdit ? String(item.price) : '')
  const [quantity, setQuantity] = useState(isEdit ? String(item.quantity ?? 1) : '1')
  const [condition, setCondition] = useState(isEdit ? item.condition : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!isEdit && !selectedCard) { setError('Please select a card.'); return }
    if (!price || !condition) { setError('Price and condition are required.'); return }
    if (parseFloat(price) <= 0) { setError('Price must be greater than 0.'); return }
    setSaving(true); setError('')
    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from('store_inventory').update({
        price: parseFloat(price), quantity: parseInt(quantity) || 1, condition,
      }).eq('id', item.id))
    } else {
      ;({ error: err } = await supabase.from('store_inventory').insert({
        storefront_id: storefrontId,
        card_id: selectedCard.card_image_id ?? selectedCard.card_set_id,
        card_name: selectedCard.card_name,
        card_color: selectedCard.card_color ?? null,
        card_type: selectedCard.card_type ?? null,
        set_name: selectedCard.set_name ?? null,
        price: parseFloat(price),
        quantity: parseInt(quantity) || 1,
        condition,
        status: 'active',
      }))
    }
    setSaving(false)
    if (err) { setError('Failed to save: ' + err.message); return }
    onSuccess()
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <SheetHeader title={isEdit ? 'Edit Card' : 'Add Card'} onClose={onClose} />
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            {isEdit ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.03)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 10, opacity: 0.7 }}>
                <Image source={{ uri: cardArtUrl(item.card_id) }} style={{ width: 32, height: 44, borderRadius: 4 }} resizeMode="cover" />
                <View>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{item.card_name}</Text>
                  <Text style={{ fontSize: 11, color: colors.faint, marginTop: 1, fontFamily: font.mono }}>{item.card_id}</Text>
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
              <ConditionPills value={condition} onChange={setCondition} />
            </View>
            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <GlassButton onPress={handleSubmit} disabled={saving} tint={colors.ocean} pad={{ paddingVertical: 11, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add to Inventory'}</Text>
            </GlassButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── CSV paste import ─────────────────────────────────────────────────────────
// Same format as web: header card_id,quantity,price,condition (case-insensitive
// header, naive comma split, condition validated against the exact 5 strings).
function CsvImportModal({ storefrontId, onClose, onSuccess }) {
  const [raw, setRaw] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  function parseCsv(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) throw new Error('Paste a header row plus at least one data row.')
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const idx = {
      card_id: header.indexOf('card_id'),
      quantity: header.indexOf('quantity'),
      price: header.indexOf('price'),
      condition: header.indexOf('condition'),
    }
    for (const [col, i] of Object.entries(idx)) {
      if (i === -1) throw new Error(`Missing column "${col}" in the header row.`)
    }
    return lines.slice(1).map((line, n) => {
      const cells = line.split(',').map(c => c.trim())
      const row = {
        card_id: (cells[idx.card_id] ?? '').toUpperCase(),
        quantity: parseInt(cells[idx.quantity]) || 1,
        price: parseFloat(cells[idx.price]),
        condition: cells[idx.condition] ?? '',
      }
      if (!row.card_id) throw new Error(`Row ${n + 2}: missing card_id.`)
      if (!row.price || row.price <= 0) throw new Error(`Row ${n + 2}: invalid price.`)
      if (!CONDITIONS.includes(row.condition)) {
        throw new Error(`Row ${n + 2}: condition must be exactly one of: ${CONDITIONS.join(', ')}.`)
      }
      return row
    })
  }

  async function runImport() {
    setError('')
    let rows
    try { rows = parseCsv(raw) } catch (e) { setError(e.message); return }
    setImporting(true)
    setProgress({ done: 0, total: rows.length })
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      // Look up card data; fall back to the first search hit, keeping the raw
      // id either way (known data-quality tradeoff carried over from web).
      let cardData = null
      try { cardData = await getCard(row.card_id) } catch {}
      if (!cardData) {
        try { cardData = (await searchCards(row.card_id))[0] ?? null } catch {}
      }
      const { error: err } = await supabase.from('store_inventory').insert({
        storefront_id: storefrontId,
        card_id: row.card_id,
        card_name: cardData?.card_name ?? row.card_id,
        card_color: cardData?.card_color ?? null,
        card_type: cardData?.card_type ?? null,
        set_name: cardData?.set_name ?? null,
        price: row.price,
        quantity: row.quantity,
        condition: row.condition,
        status: 'active',
      })
      if (err) {
        setError(`Row ${i + 2} failed to save: ${err.message}. ${i} row(s) were imported before the failure.`)
        setImporting(false)
        onSuccess()
        return
      }
      setProgress({ done: i + 1, total: rows.length })
    }
    setImporting(false)
    onSuccess()
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={sheetStyle()}>
          <SheetHeader title="Bulk Import (CSV)" onClose={onClose} />
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 19, fontFamily: font.body }}>
              Paste CSV rows with the header <Text style={{ fontFamily: font.mono, color: colors.oceanBright }}>card_id,quantity,price,condition</Text>.
              Condition must exactly match one of: {CONDITIONS.join(', ')}.
            </Text>
            <TextInput
              value={raw}
              onChangeText={setRaw}
              placeholder={'card_id,quantity,price,condition\nOP01-001,2,4.99,Near Mint\nOP02-013,1,12.50,Lightly Played'}
              placeholderTextColor={colors.faint}
              multiline
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ ...fieldInput, minHeight: 160, textAlignVertical: 'top', fontFamily: font.mono, fontSize: 12 }}
            />
            {importing && (
              <View style={{ gap: 6 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(140,176,208,0.1)', overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 3, backgroundColor: colors.emerald, width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
                </View>
                <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.mono }}>{progress.done} / {progress.total} imported</Text>
              </View>
            )}
            {error ? <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text> : null}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
            <GlassButton onPress={runImport} disabled={importing || !raw.trim()} tint={colors.gold} pad={{ paddingVertical: 11, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.onAccent }}>{importing ? 'Importing...' : 'Import'}</Text>
            </GlassButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const screenBase = {
  headerShown: true,
  headerStyle: { backgroundColor: '#08101b' },
  headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
  headerTintColor: colors.parchment,
}

export default function StorefrontPage() {
  const { id } = useLocalSearchParams()
  const { session } = useSession()
  const [store, setStore] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [managing, setManaging] = useState(false)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [showEditStore, setShowEditStore] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showCsv, setShowCsv] = useState(false)

  const loadInventory = useCallback(async () => {
    const { data: inv } = await supabase
      .from('store_inventory').select('*')
      .eq('storefront_id', id).eq('status', 'active')
      .order('created_at', { ascending: false })
    setInventory(inv ?? [])
  }, [id])

  useEffect(() => {
    async function load() {
      const queries = [
        supabase.from('storefronts').select('*').eq('id', id).single(),
        supabase.from('store_inventory').select('*').eq('storefront_id', id).eq('status', 'active').order('created_at', { ascending: false }),
      ]
      if (session) queries.push(supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle())
      const [{ data: storeData }, { data: inv }, profileRes] = await Promise.all(queries)
      setStore(storeData)
      setInventory(inv ?? [])
      setIsAdmin(profileRes?.data?.username === 'Cipin')
      setLoading(false)
    }
    load()
  }, [id, session])

  async function reviewStore(status) {
    await supabase.from('storefronts').update({ status }).eq('id', store.id)
    setStore(prev => ({ ...prev, status }))
  }

  function confirmRemoveItem(item) {
    Alert.alert('Remove card', `Remove "${item.card_name}" from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('store_inventory').update({ status: 'sold' }).eq('id', item.id)
          setInventory(prev => prev.filter(i => i.id !== item.id))
        },
      },
    ])
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ ...screenBase, title: 'Storefront' }} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (!store) {
    return (
      <>
        <Stack.Screen options={{ ...screenBase, title: 'Storefront' }} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.muted, fontFamily: font.body }}>Store not found.</Text>
        </View>
      </>
    )
  }

  const isOwner = session?.user?.id === store.user_id
  const filtered = inventory.filter(i => {
    if (search && !(
      i.card_name.toLowerCase().includes(search.toLowerCase()) ||
      i.card_id.toLowerCase().includes(search.toLowerCase())
    )) return false
    if (colorFilter && i.card_color !== colorFilter) return false
    if (typeFilter && i.card_type !== typeFilter) return false
    if (conditionFilter && i.condition !== conditionFilter) return false
    if (minPrice && Number(i.price) < parseFloat(minPrice)) return false
    if (maxPrice && Number(i.price) > parseFloat(maxPrice)) return false
    return true
  })

  return (
    <>
      <Stack.Screen options={{ ...screenBase, title: store.store_name }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.abyss }}
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            {/* Admin approval bar */}
            {isAdmin && store.status !== 'approved' && (
              <View style={{ backgroundColor: 'rgba(200,162,74,0.06)', borderWidth: 1, borderColor: colors.goldLine, borderRadius: 12, padding: 12, gap: 10 }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.gold }}>
                  This store is {store.status === 'pending' ? 'awaiting review' : store.status}.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <GlassButton onPress={() => reviewStore('approved')} tint={colors.emerald} pad={{ paddingVertical: 8, paddingHorizontal: 14 }} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>Approve</Text>
                  </GlassButton>
                  <GlassButton onPress={() => reviewStore('rejected')} pad={{ paddingVertical: 8, paddingHorizontal: 14 }} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.crimson }}>Reject</Text>
                  </GlassButton>
                </View>
              </View>
            )}

            {/* Store header */}
            <View style={{ ...card, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(140,176,208,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.goldLine }}>
                  {store.logo_url ? <Image source={{ uri: store.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 28 }}>🏪</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{store.store_name}</Text>
                  {store.address ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.body }}>📍 {store.address}</Text> : null}
                  {store.contact_info ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: font.body }}>☎ {store.contact_info}</Text> : null}
                  {store.website_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(store.website_url).catch(() => {})}>
                      <Text style={{ fontSize: 12, color: colors.oceanBright, marginTop: 2, fontFamily: font.semi }}>{store.website_url}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {!isOwner && session ? (
                <GlassButton onPress={() => setShowChat(true)} tint={colors.ocean} pad={{ paddingVertical: 10, paddingHorizontal: 16 }} style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: '#fff' }}>Message Store</Text>
                </GlassButton>
              ) : null}

              {isOwner ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <GlassButton onPress={() => setManaging(m => !m)} tint={managing ? undefined : colors.ocean} pad={{ paddingVertical: 9, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: managing ? colors.oceanBright : '#fff' }}>
                      {managing ? '👁 View Store' : '🛠 Manage Inventory'}
                    </Text>
                  </GlassButton>
                  <GlassButton onPress={() => setShowEditStore(true)} pad={{ paddingVertical: 9, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.textSoft }}>Edit Store Profile</Text>
                  </GlassButton>
                </View>
              ) : null}
            </View>

            {/* Owner manage actions */}
            {isOwner && managing ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <GlassButton onPress={() => setShowAddItem(true)} tint={colors.emerald} pad={{ paddingVertical: 10, paddingHorizontal: 14 }} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.bold, color: '#0f1117' }}>+ Add Card</Text>
                </GlassButton>
                <GlassButton onPress={() => setShowCsv(true)} pad={{ paddingVertical: 10, paddingHorizontal: 14 }} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.gold }}>📋 Import CSV</Text>
                </GlassButton>
              </View>
            ) : null}

            {/* Filters */}
            <TextInput
              placeholder={`Search ${inventory.length} cards...`}
              placeholderTextColor={colors.faint}
              value={search}
              onChangeText={setSearch}
              style={fieldInput}
            />
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
              <TouchableOpacity onPress={() => setTypeFilter('')} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: !typeFilter ? colors.goldLine : colors.lineStrong, backgroundColor: !typeFilter ? colors.goldSoft : 'transparent' }}>
                <Text style={{ fontSize: 11, fontFamily: font.semi, color: !typeFilter ? colors.gold : colors.muted }}>All Types</Text>
              </TouchableOpacity>
              {CARD_TYPES.map(tp => (
                <TouchableOpacity key={tp} onPress={() => setTypeFilter(typeFilter === tp ? '' : tp)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: typeFilter === tp ? colors.goldLine : colors.lineStrong, backgroundColor: typeFilter === tp ? colors.goldSoft : 'transparent' }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, color: typeFilter === tp ? colors.gold : colors.muted }}>{tp}</Text>
                </TouchableOpacity>
              ))}
              {CONDITIONS.map(c => (
                <TouchableOpacity key={c} onPress={() => setConditionFilter(conditionFilter === c ? '' : c)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: conditionFilter === c ? colors.goldLine : colors.lineStrong, backgroundColor: conditionFilter === c ? colors.goldSoft : 'transparent' }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, color: conditionFilter === c ? colors.gold : colors.muted }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput placeholder="Min $" placeholderTextColor={colors.faint} value={minPrice} onChangeText={setMinPrice} keyboardType="decimal-pad" style={{ ...fieldInput, flex: 1, width: undefined }} />
              <TextInput placeholder="Max $" placeholderTextColor={colors.faint} value={maxPrice} onChangeText={setMaxPrice} keyboardType="decimal-pad" style={{ ...fieldInput, flex: 1, width: undefined }} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🃏</Text>
            <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted }}>
              {search || colorFilter || typeFilter || conditionFilter || minPrice || maxPrice ? 'No cards match your filters' : 'No inventory listed yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, padding: 10 }}>
            <Image source={{ uri: cardArtUrl(item.card_id) }} style={{ width: 40, height: 56, borderRadius: 6 }} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>
                {item.card_name}{item.quantity > 1 ? ` x${item.quantity}` : ''}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono, marginTop: 2 }}>
                {item.card_id}{item.set_name ? `  ·  ${item.set_name}` : ''}
              </Text>
              <View style={{ marginTop: 4 }}><ConditionBadge condition={item.condition} /></View>
            </View>
            <Text style={{ fontSize: 15, fontFamily: font.mono, color: colors.text }}>${Number(item.price).toFixed(2)}</Text>
            {isOwner && managing ? (
              <View style={{ gap: 6 }}>
                <TouchableOpacity onPress={() => setEditItem(item)} hitSlop={4} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.goldLine }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.oceanBright }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmRemoveItem(item)} hitSlop={4} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(210,74,58,0.25)' }}>
                  <Text style={{ fontSize: 11, fontFamily: font.semi, color: colors.crimson }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      />

      {showChat && (
        <ChatModal
          visible
          onClose={() => setShowChat(false)}
          table="storefront_messages"
          contextField="storefront_id"
          contextId={store.id}
          bodyField="content"
          currentUserId={session.user.id}
          receiverId={store.user_id}
          headerTitle={store.store_name}
          headerSubtitle="Storefront chat"
          headerImageUri={store.logo_url}
        />
      )}
      {showEditStore && (
        <EditStoreModal store={store} onClose={() => setShowEditStore(false)} onSaved={patch => setStore(prev => ({ ...prev, ...patch }))} />
      )}
      {showAddItem && (
        <InventoryFormModal storefrontId={store.id} onClose={() => setShowAddItem(false)} onSuccess={loadInventory} />
      )}
      {editItem && (
        <InventoryFormModal storefrontId={store.id} item={editItem} onClose={() => setEditItem(null)} onSuccess={loadInventory} />
      )}
      {showCsv && (
        <CsvImportModal storefrontId={store.id} onClose={() => setShowCsv(false)} onSuccess={loadInventory} />
      )}
    </>
  )
}
