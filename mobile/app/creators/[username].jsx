// RN port of src/pages/CreatorPage.jsx — a public opt-in creator profile:
// tagline/links, featured decklists, published articles, curated content
// links, and recent community posts. Owner gets inline edit affordances.
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator, Linking } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius, card, btnPrimary, btnPrimaryText, btnGhost, btnGhostText, input as inputStyle } from '../../theme'
import { LEADER_COLORS, FieldLabel } from '../../components/forms'
import { Avatar } from '../../components/ProfileCard'
import DeckModal from '../../components/DeckModal'

const PLATFORMS = [
  { value: 'youtube', label: 'YouTube', icon: '📺' },
  { value: 'twitch', label: 'Twitch', icon: '🎮' },
  { value: 'twitter', label: 'Twitter / X', icon: '🐦' },
  { value: 'discord', label: 'Discord', icon: '💬' },
  { value: 'patreon', label: 'Patreon', icon: '🎁' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'website', label: 'Website', icon: '🔗' },
]
function platformMeta(p) {
  return PLATFORMS.find(x => x.value === p) ?? { value: p, label: p || 'Link', icon: '🔗' }
}

function PlatformPicker({ value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {PLATFORMS.map(p => {
        const active = value === p.value
        return (
          <TouchableOpacity
            key={p.value}
            onPress={() => onChange(p.value)}
            style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.goldLine : colors.line, backgroundColor: active ? 'rgba(200,162,74,0.15)' : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{p.icon} {p.label}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

function SectionCard({ title, action, children }) {
  return (
    <View style={{ ...card, padding: 16, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.gold }}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  )
}

function EmptyState({ children }) {
  return <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>{children}</Text>
}

// ─── Owner edit modals ──────────────────────────────────────────────────────

function EditLinksModal({ creator, onClose, onSaved }) {
  const [tagline, setTagline] = useState(creator.tagline ?? '')
  const [links, setLinks] = useState(creator.links?.length ? creator.links : [{ platform: 'youtube', url: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateLink(i, field, value) {
    setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }
  function addLink() { setLinks(prev => [...prev, { platform: 'youtube', url: '' }]) }
  function removeLink(i) { setLinks(prev => prev.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true); setError('')
    const cleanLinks = links.map(l => ({ platform: l.platform, url: l.url.trim() })).filter(l => l.url)
    const { data, error: err } = await supabase.from('creators').update({ tagline: tagline.trim() || null, links: cleanLinks, updated_at: new Date().toISOString() }).eq('user_id', creator.user_id).select().single()
    setSaving(false)
    if (err) { setError('Failed to save: ' + err.message); return }
    onSaved(data)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.goldLine, maxHeight: '88%' }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 4 }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text, marginBottom: 12 }}>Edit Creator Page</Text>

            <FieldLabel>Tagline</FieldLabel>
            <TextInput
              placeholder="e.g. OPTCG deck guides & tournament VODs"
              placeholderTextColor={colors.faint}
              value={tagline}
              onChangeText={setTagline}
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            <FieldLabel>Links</FieldLabel>
            <View style={{ gap: 10, marginBottom: 10 }}>
              {links.map((l, i) => (
                <View key={i} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <PlatformPicker value={l.platform} onChange={v => updateLink(i, 'platform', v)} />
                    </View>
                    <TouchableOpacity onPress={() => removeLink(i)} hitSlop={8}>
                      <Text style={{ color: colors.faint, fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    placeholder="https://..."
                    placeholderTextColor={colors.faint}
                    value={l.url}
                    onChangeText={v => updateLink(i, 'url', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={inputStyle}
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={addLink} style={{ ...btnGhost, marginBottom: 16 }}>
              <Text style={btnGhostText}>+ Add Link</Text>
            </TouchableOpacity>

            {error ? <Text style={{ fontSize: 12, color: colors.crimson, marginBottom: 12, fontFamily: font.body }}>{error}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={onClose} style={{ ...btnGhost, flex: 1 }}>
                <Text style={btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>
                <Text style={btnPrimaryText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function FeatureDecklistsModal({ session, featuredIds, onClose, onFeature, onUnfeature }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('decklists').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false })
      setDecks(data ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.goldLine, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text }}>Manage Featured Decklists</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={{ color: colors.faint, fontSize: 18 }}>✕</Text></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ padding: 30 }} />
          ) : decks.length === 0 ? (
            <EmptyState>No saved decklists yet — build one in the Deck Builder first.</EmptyState>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
              {decks.map(d => {
                const featured = featuredIds.includes(d.id)
                return (
                  <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 10 }}>
                    <Image source={{ uri: getCardImageUrl(d.leader_id) }} style={{ width: 32, height: 44, borderRadius: 4 }} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{d.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>{d.leader_name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => featured ? onUnfeature(d.id) : onFeature(d.id)}
                      style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: featured ? colors.goldLine : colors.lineStrong, backgroundColor: featured ? 'rgba(200,162,74,0.15)' : 'transparent' }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: font.bold, color: featured ? colors.gold : colors.muted }}>{featured ? '✓ Featured' : 'Feature'}</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

function ContentItemModal({ creatorId, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState('youtube')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim() || !url.trim()) { setError('Title and link are required.'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('creator_content_items').insert({
      creator_id: creatorId,
      title: title.trim(),
      url: url.trim(),
      thumbnail_url: thumbnailUrl.trim() || null,
      description: description.trim() || null,
      platform,
    }).select().single()
    setSaving(false)
    if (err) { setError('Failed to save: ' + err.message); return }
    onSaved(data)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.goldLine, maxHeight: '88%' }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text, marginBottom: 16 }}>Add Content</Text>

            <FieldLabel>Platform</FieldLabel>
            <View style={{ marginBottom: 14 }}><PlatformPicker value={platform} onChange={setPlatform} /></View>

            <FieldLabel>Title</FieldLabel>
            <TextInput placeholder="e.g. Red Zoro Deck Tech" placeholderTextColor={colors.faint} value={title} onChangeText={setTitle} style={{ ...inputStyle, marginBottom: 12 }} />

            <FieldLabel>Link</FieldLabel>
            <TextInput placeholder="https://..." placeholderTextColor={colors.faint} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" style={{ ...inputStyle, marginBottom: 12 }} />

            <FieldLabel>Thumbnail URL (optional)</FieldLabel>
            <TextInput placeholder="https://..." placeholderTextColor={colors.faint} value={thumbnailUrl} onChangeText={setThumbnailUrl} autoCapitalize="none" keyboardType="url" style={{ ...inputStyle, marginBottom: 12 }} />

            <FieldLabel>Description (optional)</FieldLabel>
            <TextInput value={description} onChangeText={setDescription} multiline style={{ ...inputStyle, minHeight: 70, textAlignVertical: 'top', marginBottom: 12 }} />

            {error ? <Text style={{ fontSize: 12, color: colors.crimson, marginBottom: 12, fontFamily: font.body }}>{error}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={onClose} style={{ ...btnGhost, flex: 1 }}>
                <Text style={btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>
                <Text style={btnPrimaryText}>{saving ? 'Saving...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── Display tiles ───────────────────────────────────────────────────────────

function DecklistTile({ deck, onPress, width }) {
  const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
  return (
    <TouchableOpacity onPress={onPress} style={{ width, backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' }}>
      <View style={{ height: 90 }}>
        <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: color }} />
      </View>
      <View style={{ padding: 10 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.bold, color: colors.text }}>{deck.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 10.5, color: colors.muted, marginTop: 2, fontFamily: font.body }}>{deck.leader_name}</Text>
      </View>
    </TouchableOpacity>
  )
}

function ArticleTile({ article }) {
  return (
    <TouchableOpacity onPress={() => router.push(`/articles/${article.slug}`)} style={{ backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, marginBottom: 8 }}>
      {article.category ? <Text style={{ fontSize: 9.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.gold, marginBottom: 6 }}>{article.category.replace('_', ' ')}</Text> : null}
      <Text style={{ fontSize: 14, fontFamily: font.bold, color: colors.text, marginBottom: 6 }}>{article.title}</Text>
      {article.excerpt ? <Text numberOfLines={2} style={{ fontSize: 12, color: colors.muted, lineHeight: 17, fontFamily: font.body }}>{article.excerpt}</Text> : null}
      <Text style={{ fontSize: 11, color: colors.faint, marginTop: 8, fontFamily: font.body }}>
        {article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
      </Text>
    </TouchableOpacity>
  )
}

function ContentTile({ item, isOwner, onDelete, width }) {
  const meta = platformMeta(item.platform)
  return (
    <TouchableOpacity onPress={() => Linking.openURL(item.url)} style={{ width, position: 'relative', backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' }}>
      <View style={{ height: 90, backgroundColor: 'rgba(140,176,208,0.06)', alignItems: 'center', justifyContent: 'center' }}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 30 }}>{meta.icon}</Text>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={{ fontSize: 9.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.gold, marginBottom: 4 }}>{meta.icon} {meta.label}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.bold, color: colors.text }}>{item.title}</Text>
        {item.description ? <Text numberOfLines={2} style={{ fontSize: 10.5, color: colors.muted, marginTop: 3, fontFamily: font.body }}>{item.description}</Text> : null}
      </View>
      {isOwner ? (
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={6}
          style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: colors.line, borderRadius: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.text, fontSize: 12 }}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  )
}

function PostRow({ post }) {
  return (
    <View style={{ backgroundColor: 'rgba(140,176,208,0.03)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 12, marginBottom: 8 }}>
      <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text, marginBottom: 4 }}>{post.title}</Text>
      {post.body ? <Text numberOfLines={2} style={{ fontSize: 12, color: colors.muted, lineHeight: 17, fontFamily: font.body }}>{post.body}</Text> : null}
      <Text style={{ fontSize: 11, color: colors.faint, marginTop: 6, fontFamily: font.body }}>
        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ❤ {post.likes ?? 0}
      </Text>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CreatorPage() {
  const { username } = useLocalSearchParams()
  const { session } = useSession()
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState(null)
  const [creator, setCreator] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  const [featured, setFeatured] = useState([])
  const [articles, setArticles] = useState([])
  const [content, setContent] = useState([])
  const [posts, setPosts] = useState([])

  const [editMode, setEditMode] = useState(false)
  const [showEditLinks, setShowEditLinks] = useState(false)
  const [showFeature, setShowFeature] = useState(false)
  const [showAddContent, setShowAddContent] = useState(false)
  const [becoming, setBecoming] = useState(false)
  const [openDeck, setOpenDeck] = useState(null)

  const isOwner = !!(session && profile && session.user.id === profile.id)

  const loadCreatorData = useCallback(async creatorId => {
    const [{ data: fd }, { data: ad }, { data: cd }, { data: pd }] = await Promise.all([
      supabase.from('creator_decklists').select('decklist_id, position, decklists(*)').eq('creator_id', creatorId).order('position'),
      supabase.from('articles').select('id, title, slug, category, excerpt, cover_card_id, status, published_at').eq('author_id', creatorId).eq('status', 'published').order('published_at', { ascending: false }),
      supabase.from('creator_content_items').select('*').eq('creator_id', creatorId).order('position'),
      supabase.from('posts').select('*').eq('user_id', creatorId).order('created_at', { ascending: false }).limit(20),
    ])
    setFeatured((fd ?? []).map(f => f.decklists).filter(Boolean))
    setArticles(ad ?? [])
    setContent(cd ?? [])
    setPosts(pd ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: p } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
      if (cancelled) return
      if (!p) { setNotFound(true); setLoading(false); return }
      setProfile(p)
      const { data: c } = await supabase.from('creators').select('*').eq('user_id', p.id).maybeSingle()
      if (cancelled) return
      setCreator(c)
      if (c) await loadCreatorData(p.id)
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [username, loadCreatorData])

  async function becomeCreator() {
    setBecoming(true)
    const { data, error } = await supabase.from('creators').insert({ user_id: session.user.id }).select().single()
    setBecoming(false)
    if (!error) { setCreator(data); loadCreatorData(session.user.id) }
  }

  async function featureDeck(decklistId) {
    const { data } = await supabase.from('creator_decklists').insert({ creator_id: creator.user_id, decklist_id: decklistId }).select('decklist_id, position, decklists(*)').single()
    if (data?.decklists) setFeatured(prev => [...prev, data.decklists])
  }
  async function unfeatureDeck(decklistId) {
    await supabase.from('creator_decklists').delete().eq('creator_id', creator.user_id).eq('decklist_id', decklistId)
    setFeatured(prev => prev.filter(d => d.id !== decklistId))
  }
  async function deleteContentItem(id) {
    await supabase.from('creator_content_items').delete().eq('id', id)
    setContent(prev => prev.filter(c => c.id !== id))
  }

  const screenOpts = {
    headerShown: true,
    title: profile?.username ?? 'Creator',
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: '#08101b' },
    headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
    headerTintColor: colors.parchment,
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </>
    )
  }

  if (notFound) {
    return (
      <>
        <Stack.Screen options={screenOpts} />
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🏴‍☠️</Text>
          <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted }}>No user found with that username.</Text>
        </View>
      </>
    )
  }

  const tileWidth = 150 // 2 up with 16px padding / 10px gap, good enough across phone widths

  return (
    <>
      <Stack.Screen options={screenOpts} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48 }}>

        {/* Header */}
        <View style={{ ...card, padding: 18, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <Avatar profile={profile} size={64} rounded />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontFamily: font.display, color: colors.text }}>{profile.username}</Text>
              {creator?.tagline ? <Text style={{ fontSize: 13, color: colors.textSoft, marginTop: 3, fontFamily: font.body }}>{creator.tagline}</Text> : null}
              {creator?.links?.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {creator.links.map((l, i) => {
                    const meta = platformMeta(l.platform)
                    return (
                      <TouchableOpacity key={i} onPress={() => Linking.openURL(l.url)} style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(140,176,208,0.06)', borderWidth: 1, borderColor: colors.line }}>
                        <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{meta.icon} {meta.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ) : null}
            </View>
          </View>
          {isOwner && creator ? (
            <TouchableOpacity onPress={() => setEditMode(m => !m)} style={{ ...(editMode ? btnPrimary : btnGhost), marginTop: 14 }}>
              <Text style={editMode ? btnPrimaryText : btnGhostText}>{editMode ? '✓ Done Editing' : '✎ Edit Page'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!creator ? (
          isOwner ? (
            <View style={{ ...card, padding: 26, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text, marginBottom: 8 }}>Become a Creator</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 18, textAlign: 'center', fontFamily: font.body }}>
                Set up a public page linking your YouTube, Twitch, articles, decklists and more.
              </Text>
              <TouchableOpacity onPress={becomeCreator} disabled={becoming} style={{ ...btnPrimary, opacity: becoming ? 0.6 : 1 }}>
                <Text style={btnPrimaryText}>{becoming ? 'Creating...' : '🎬 Create My Creator Page'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ ...card, padding: 26, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>{profile.username} hasn't set up a creator page yet.</Text>
            </View>
          )
        ) : (
          <>
            {editMode ? (
              <TouchableOpacity onPress={() => setShowEditLinks(true)} style={{ ...btnGhost, marginBottom: 16 }}>
                <Text style={btnGhostText}>Edit Tagline / Links</Text>
              </TouchableOpacity>
            ) : null}

            {profile.bio ? (
              <SectionCard title="About">
                <Text style={{ fontSize: 13, color: colors.textSoft, lineHeight: 19, fontFamily: font.body }}>{profile.bio}</Text>
              </SectionCard>
            ) : null}

            <SectionCard
              title="Featured Decklists"
              action={editMode ? (
                <TouchableOpacity onPress={() => setShowFeature(true)}><Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>Manage</Text></TouchableOpacity>
              ) : null}
            >
              {featured.length === 0 ? <EmptyState>No decklists featured yet.</EmptyState> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {featured.map(d => <DecklistTile key={d.id} deck={d} width={tileWidth} onPress={() => setOpenDeck(d)} />)}
                </View>
              )}
            </SectionCard>

            <SectionCard title="Articles">
              {articles.length === 0 ? <EmptyState>No published articles yet.</EmptyState> : articles.map(a => <ArticleTile key={a.id} article={a} />)}
            </SectionCard>

            <SectionCard
              title="Content"
              action={editMode ? (
                <TouchableOpacity onPress={() => setShowAddContent(true)}><Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>+ Add</Text></TouchableOpacity>
              ) : null}
            >
              {content.length === 0 ? <EmptyState>No content added yet.</EmptyState> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {content.map(item => <ContentTile key={item.id} item={item} width={tileWidth} isOwner={editMode} onDelete={deleteContentItem} />)}
                </View>
              )}
            </SectionCard>

            <SectionCard title="Posts">
              {posts.length === 0 ? <EmptyState>No community posts yet.</EmptyState> : posts.map(p => <PostRow key={p.id} post={p} />)}
            </SectionCard>
          </>
        )}
      </ScrollView>

      {showEditLinks && creator ? <EditLinksModal creator={creator} onClose={() => setShowEditLinks(false)} onSaved={setCreator} /> : null}
      {showFeature && creator ? (
        <FeatureDecklistsModal
          session={session}
          featuredIds={featured.map(d => d.id)}
          onClose={() => setShowFeature(false)}
          onFeature={featureDeck}
          onUnfeature={unfeatureDeck}
        />
      ) : null}
      {showAddContent && creator ? (
        <ContentItemModal creatorId={creator.user_id} onClose={() => setShowAddContent(false)} onSaved={item => setContent(prev => [...prev, item])} />
      ) : null}
      {openDeck ? <DeckModal deck={openDeck} onClose={() => setOpenDeck(null)} /> : null}
    </>
  )
}
