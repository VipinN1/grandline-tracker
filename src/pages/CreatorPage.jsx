import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCardImageUrl } from '../lib/optcgapi'
import { useWindowSize } from '../hooks/useWindowSize'
import { colors, radius, shadow, font, btnPrimary, btnGhost, label as labelStyle, input as inputStyle } from '../theme'

const LEADER_COLORS = { Red: '#d24a3a', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#dcb35e', Black: '#94a3b8' }

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

const card = { background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`, border: `1px solid ${colors.line}`, borderRadius: radius.lg, boxShadow: shadow.md }

function SectionCard({ title, action, children }) {
  return (
    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.gold }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ children }) {
  return <div style={{ fontSize: 13, color: colors.faint, padding: '4px 0 8px' }}>{children}</div>
}

// ─── Owner edit modals ─────────────────────────────────────────────────────

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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 480, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 16 }}>Edit Creator Page</div>

        <label style={labelStyle}>Tagline</label>
        <input type="text" placeholder="e.g. OPTCG deck guides & tournament VODs" value={tagline} onChange={e => setTagline(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />

        <label style={labelStyle}>Links</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <select value={l.platform} onChange={e => updateLink(i, 'platform', e.target.value)} style={{ ...inputStyle, width: 130, flexShrink: 0 }}>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
              </select>
              <input type="url" placeholder="https://..." value={l.url} onChange={e => updateLink(i, 'url', e.target.value)} style={inputStyle} />
              <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', color: colors.faint, cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={addLink} style={{ ...btnGhost, width: '100%', marginBottom: 16 }}>+ Add Link</button>

        {error && <div style={{ fontSize: 12, color: colors.crimson, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function FeatureDecklistsModal({ session, featuredIds, onClose, onFeature, onUnfeature }) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('decklists').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false })
      setDecks(data ?? [])
      setLoading(false)
    }
    load()
  }, [session])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: isMobile ? '100%' : 640, maxHeight: isMobile ? '85vh' : '80vh', borderRadius: isMobile ? '16px 16px 0 0' : radius.lg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${colors.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Manage Featured Decklists</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.faint, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <EmptyState>Loading your decklists...</EmptyState>
          ) : decks.length === 0 ? (
            <EmptyState>No saved decklists yet — build one in the Deck Builder first.</EmptyState>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
              {decks.map(d => {
                const featured = featuredIds.includes(d.id)
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(140,176,208,0.04)', border: `1px solid ${colors.line}`, borderRadius: radius.sm, padding: 10 }}>
                    <img src={getCardImageUrl(d.leader_id)} alt={d.leader_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.15' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: colors.faint }}>{d.leader_name}</div>
                    </div>
                    <button
                      onClick={() => featured ? onUnfeature(d.id) : onFeature(d.id)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: radius.sm, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, border: featured ? `1px solid ${colors.goldLine}` : `1px solid ${colors.lineStrong}`, background: featured ? colors.goldSoft : 'transparent', color: featured ? colors.gold : colors.muted }}
                    >
                      {featured ? '✓ Featured' : 'Feature'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 460, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 16 }}>Add Content</div>

        <label style={labelStyle}>Platform</label>
        <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
        </select>

        <label style={labelStyle}>Title</label>
        <input type="text" placeholder="e.g. Red Zoro Deck Tech" value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

        <label style={labelStyle}>Link</label>
        <input type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

        <label style={labelStyle}>Thumbnail URL (optional)</label>
        <input type="url" placeholder="https://..." value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

        <label style={labelStyle}>Description (optional)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 12 }} />

        {error && <div style={{ fontSize: 12, color: colors.crimson, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Add'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Display tiles ──────────────────────────────────────────────────────────

function DecklistTile({ deck }) {
  const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
  return (
    <Link to={`/decklists/${deck.id}`} style={{ textDecoration: 'none', display: 'block', background: 'rgba(140,176,208,0.04)', border: `1px solid ${colors.line}`, borderRadius: radius.md, overflow: 'hidden' }}>
      <div style={{ position: 'relative', height: 110, background: 'rgba(140,176,208,0.03)' }}>
        <img src={getCardImageUrl(deck.leader_id)} alt={deck.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={e => { e.target.style.opacity = '0.1' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
        <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{deck.leader_name}</div>
      </div>
    </Link>
  )
}

function ArticleTile({ article }) {
  return (
    <Link to={`/articles/${article.slug}`} style={{ textDecoration: 'none', display: 'block', background: 'rgba(140,176,208,0.04)', border: `1px solid ${colors.line}`, borderRadius: radius.md, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.gold, marginBottom: 6 }}>{article.category?.replace('_', ' ')}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 6 }}>{article.title}</div>
      {article.excerpt && <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{article.excerpt}</div>}
      <div style={{ fontSize: 11, color: colors.faint, marginTop: 8 }}>{article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
    </Link>
  )
}

function ContentTile({ item, isOwner, onDelete }) {
  const meta = platformMeta(item.platform)
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', position: 'relative', display: 'block', background: 'rgba(140,176,208,0.04)', border: `1px solid ${colors.line}`, borderRadius: radius.md, overflow: 'hidden' }}>
      <div style={{ height: 110, background: 'rgba(140,176,208,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
        ) : (
          <span style={{ fontSize: 32 }}>{meta.icon}</span>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.gold, marginBottom: 4 }}>{meta.icon} {meta.label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {item.description && <div style={{ fontSize: 11, color: colors.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.description}</div>}
      </div>
      {isOwner && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(item.id) }}
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: `1px solid ${colors.line}`, borderRadius: 6, color: colors.text, fontSize: 12, width: 24, height: 24, cursor: 'pointer' }}
        >✕</button>
      )}
    </a>
  )
}

function PostRow({ post }) {
  return (
    <div style={{ background: 'rgba(140,176,208,0.03)', border: `1px solid ${colors.line}`, borderRadius: radius.sm, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{post.title}</div>
      {post.body && <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.body}</div>}
      <div style={{ fontSize: 11, color: colors.faint, marginTop: 6 }}>
        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ❤ {post.likes ?? 0}
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CreatorPage({ session }) {
  const { username } = useParams()
  const { isMobile } = useWindowSize()

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

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><div style={{ fontSize: 13, color: colors.muted }}>Loading...</div></div>
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.faint }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏴‍☠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.muted }}>No user found with that username.</div>
      </div>
    )
  }

  const initials = (profile.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: isMobile ? 18 : 26, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.oceanDeep}, ${colors.ocean})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: colors.parchment, flexShrink: 0, overflow: 'hidden', border: `2px solid ${colors.goldLine}` }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: font.display }}>{profile.username}</div>
            {creator?.tagline && <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 2 }}>{creator.tagline}</div>}
            {creator?.links?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {creator.links.map((l, i) => {
                  const meta = platformMeta(l.platform)
                  return (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: colors.oceanBright, textDecoration: 'none', background: 'rgba(140,176,208,0.06)', border: `1px solid ${colors.line}`, borderRadius: radius.pill, padding: '5px 12px' }}>
                      {meta.icon} {meta.label}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
          {isOwner && creator && (
            <button onClick={() => setEditMode(m => !m)} style={editMode ? btnPrimary : btnGhost}>{editMode ? '✓ Done Editing' : '✎ Edit Page'}</button>
          )}
        </div>
      </div>

      {!creator ? (
        isOwner ? (
          <div style={{ ...card, padding: 30, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Become a Creator</div>
            <div style={{ fontSize: 13, color: colors.muted, marginBottom: 18 }}>Set up a public page linking your YouTube, Twitch, articles, decklists and more.</div>
            <button onClick={becomeCreator} disabled={becoming} style={{ ...btnPrimary, opacity: becoming ? 0.6 : 1 }}>{becoming ? 'Creating...' : '🎬 Create My Creator Page'}</button>
          </div>
        ) : (
          <div style={{ ...card, padding: 30, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: colors.muted }}>{profile.username} hasn't set up a creator page yet.</div>
          </div>
        )
      ) : (
        <>
          {editMode && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setShowEditLinks(true)} style={btnGhost}>Edit Tagline / Links</button>
            </div>
          )}

          {profile.bio && (
            <SectionCard title="About">
              <div style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{profile.bio}</div>
            </SectionCard>
          )}

          <SectionCard title="Featured Decklists" action={editMode && <button onClick={() => setShowFeature(true)} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Manage</button>}>
            {featured.length === 0 ? <EmptyState>No decklists featured yet.</EmptyState> : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
                {featured.map(d => <DecklistTile key={d.id} deck={d} />)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Articles">
            {articles.length === 0 ? <EmptyState>No published articles yet.</EmptyState> : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
                {articles.map(a => <ArticleTile key={a.id} article={a} />)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Content" action={editMode && <button onClick={() => setShowAddContent(true)} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>+ Add</button>}>
            {content.length === 0 ? <EmptyState>No content added yet.</EmptyState> : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
                {content.map(item => <ContentTile key={item.id} item={item} isOwner={editMode} onDelete={deleteContentItem} />)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Posts">
            {posts.length === 0 ? <EmptyState>No community posts yet.</EmptyState> : posts.map(p => <PostRow key={p.id} post={p} />)}
          </SectionCard>
        </>
      )}

      {showEditLinks && creator && <EditLinksModal creator={creator} onClose={() => setShowEditLinks(false)} onSaved={setCreator} />}
      {showFeature && creator && (
        <FeatureDecklistsModal
          session={session}
          featuredIds={featured.map(d => d.id)}
          onClose={() => setShowFeature(false)}
          onFeature={featureDeck}
          onUnfeature={unfeatureDeck}
        />
      )}
      {showAddContent && creator && (
        <ContentItemModal creatorId={creator.user_id} onClose={() => setShowAddContent(false)} onSaved={item => setContent(prev => [...prev, item])} />
      )}
    </div>
  )
}
