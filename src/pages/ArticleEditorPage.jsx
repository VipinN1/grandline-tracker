import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCardImageUrl } from '../lib/optcgapi'
import { CATEGORIES, slugify, makeExcerpt, firstCardId } from '../lib/articles'
import ArticleEditor from '../components/articles/ArticleEditor'
import CardSearchModal from '../components/articles/CardSearchModal'
import { useWindowSize } from '../hooks/useWindowSize'
import { colors, font, radius, eyebrow, input as inputStyle, label as labelStyle, btnPrimary, btnGhost } from '../theme'

export default function ArticleEditorPage({ session }) {
  const navigate = useNavigate()
  const { id } = useParams() // present when editing
  const { isMobile } = useWindowSize()

  const [editor, setEditor] = useState(null)
  const [loading, setLoading] = useState(!!id)
  const [article, setArticle] = useState(null) // existing row when editing
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [coverCardId, setCoverCardId] = useState(null)
  const [coverModal, setCoverModal] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  const onEditorReady = useCallback(ed => setEditor(ed), [])

  // Dev check: Cipin, or granted in article_devs.
  useEffect(() => {
    async function check() {
      const [{ data: profile }, { data: grant }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', session.user.id).single(),
        supabase.from('article_devs').select('user_id').eq('user_id', session.user.id).maybeSingle(),
      ])
      setIsDev(profile?.username === 'Cipin' || !!grant)
    }
    check()
  }, [session])

  // Load existing article when editing. (The /new and /edit routes mount
  // this page with different React keys, so state resets between them.)
  useEffect(() => {
    if (!id) return
    async function load() {
      const { data } = await supabase.from('articles').select('*').eq('id', id).maybeSingle()
      if (!data || data.author_id !== session.user.id) {
        navigate('/articles', { replace: true })
        return
      }
      setArticle(data)
      setTitle(data.title)
      setCategory(data.category)
      setCoverCardId(data.cover_card_id)
      setLoading(false)
    }
    load()
  }, [id, session, navigate])

  function flash(msg) {
    setNotice(msg)
    setTimeout(() => setNotice(null), 2400)
  }

  async function save(publish) {
    if (!editor) return
    if (!title.trim()) { setError('Give your article a title first.'); return }
    setError(null)
    setSaving(true)

    const content = editor.getJSON()
    const row = {
      title: title.trim(),
      category,
      content,
      excerpt: makeExcerpt(content),
      cover_card_id: coverCardId ?? firstCardId(content),
      updated_at: new Date().toISOString(),
    }

    const willBePublished = publish || article?.status === 'published'
    if (willBePublished) {
      row.status = 'published'
      if (!article?.published_at) row.published_at = new Date().toISOString()
    }

    let saved
    let dbError
    if (article) {
      const { data, error: e } = await supabase.from('articles').update(row).eq('id', article.id).select().single()
      saved = data
      dbError = e
    } else {
      const { data, error: e } = await supabase.from('articles')
        .insert({ ...row, author_id: session.user.id, slug: slugify(title), status: row.status ?? 'draft' })
        .select()
        .single()
      saved = data
      dbError = e
    }

    setSaving(false)
    if (dbError || !saved) {
      setError(dbError?.message ?? 'Something went wrong saving the article.')
      return
    }

    setArticle(saved)
    if (publish) {
      navigate(`/articles/${saved.slug}`)
    } else {
      if (!article) navigate(`/articles/edit/${saved.id}`, { replace: true })
      flash(saved.status === 'published' ? 'Article updated.' : 'Draft saved.')
    }
  }

  async function unpublish() {
    if (!article) return
    setSaving(true)
    const { data } = await supabase.from('articles').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', article.id).select().single()
    setSaving(false)
    if (data) { setArticle(data); flash('Article unpublished — it is now a draft.') }
  }

  async function remove() {
    if (!article) return
    if (!window.confirm('Delete this article permanently? This cannot be undone.')) return
    await supabase.from('articles').delete().eq('id', article.id)
    navigate('/articles')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', fontSize: 13, color: colors.muted }}>Loading article…</div>
  }

  const published = article?.status === 'published'
  const categories = CATEGORIES.filter(c => !c.devOnly || isDev)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>The Grand Log</div>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, letterSpacing: '-0.3px', color: colors.text, margin: 0 }}>
            {article ? (published ? 'Edit Article' : 'Edit Draft') : 'Write an Article'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {notice && <span style={{ fontSize: 12, fontWeight: 600, color: colors.emerald }}>{notice}</span>}
          <button className="gl-btn" style={btnGhost} onClick={() => navigate(-1)}>Cancel</button>
          {article && (
            <button className="gl-btn" style={{ ...btnGhost, color: colors.crimson, borderColor: 'rgba(210,74,58,0.34)' }} onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
          {published ? (
            <>
              <button className="gl-btn" style={btnGhost} onClick={unpublish} disabled={saving}>Unpublish</button>
              <button className="gl-btn" style={btnPrimary} onClick={() => save(true)} disabled={saving}>
                {saving ? 'Saving…' : 'Update'}
              </button>
            </>
          ) : (
            <>
              <button className="gl-btn" style={btnGhost} onClick={() => save(false)} disabled={saving}>
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="gl-btn" style={btnPrimary} onClick={() => save(true)} disabled={saving}>
                {saving ? 'Publishing…' : '⚓ Publish'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: radius.sm, background: 'rgba(210,74,58,0.10)', border: '1px solid rgba(210,74,58,0.34)', color: colors.crimson, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <input
        type="text"
        placeholder="Article title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        maxLength={140}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${colors.line}`,
          padding: '6px 2px 12px',
          color: colors.text,
          fontSize: isMobile ? 24 : 30,
          fontFamily: font.display,
          fontWeight: 600,
          letterSpacing: '-0.4px',
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 16,
        }}
      />

      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, width: 200, cursor: 'pointer' }}>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Cover Card</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {coverCardId && (
              <img src={getCardImageUrl(coverCardId)} alt={coverCardId} style={{ width: 34, borderRadius: 5, border: `1px solid ${colors.line}` }} onError={e => { e.target.style.opacity = '0.2' }} />
            )}
            <button className="gl-btn" style={{ ...btnGhost, padding: '8px 14px', fontSize: 12 }} onClick={() => setCoverModal(true)}>
              {coverCardId ? 'Change' : 'Choose card'}
            </button>
            {coverCardId ? (
              <button className="gl-btn" style={{ ...btnGhost, padding: '8px 10px', fontSize: 12, color: colors.faint }} onClick={() => setCoverCardId(null)}>✕</button>
            ) : (
              <span style={{ fontSize: 11, color: colors.faint }}>defaults to the first card in your article</span>
            )}
          </div>
        </div>
      </div>

      <ArticleEditor session={session} initialContent={article?.content} onEditorReady={onEditorReady} />

      <div style={{ marginTop: 12, fontSize: 12, color: colors.faint, lineHeight: 1.6 }}>
        Tip: use <b style={{ color: colors.muted }}>🃏 Card</b> to drop card images into your article (drag them to move, click to resize),
        and <b style={{ color: colors.muted }}>📜 Decklist</b> to embed one of your saved decklists or paste a list.
      </div>

      {coverModal && <CardSearchModal title="Choose a Cover Card" onClose={() => setCoverModal(false)} onSelect={card => setCoverCardId(card.card_image_id ?? card.card_set_id)} />}
    </div>
  )
}
