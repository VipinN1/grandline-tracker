import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { categoryLabel } from '../lib/articles'
import ArticleContent from '../components/articles/ArticleContent'
import { useWindowSize } from '../hooks/useWindowSize'
import { colors, font, radius, input as inputStyle, btnGhost, badge, status as statusTheme } from '../theme'

const CATEGORY_STYLE = {
  devlog: statusTheme.gold,
  deck_guide: statusTheme.active,
  strategy: statusTheme.open,
  tournament_report: statusTheme.closed,
  news: statusTheme.danger,
  other: statusTheme.completed,
}

function Avatar({ profile, size = 34 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: `linear-gradient(135deg, ${colors.oceanDeep}, ${colors.ocean})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, color: colors.parchment, flexShrink: 0 }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (profile?.username ?? '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ArticlePage({ session }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reported, setReported] = useState(false)
  const [adminProfile, setAdminProfile] = useState(false)
  const isAdmin = !!session && adminProfile

  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('username').eq('id', session.user.id).single()
      .then(({ data }) => setAdminProfile(data?.username === 'Cipin'))
  }, [session])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      const { data: a } = await supabase
        .from('articles')
        .select('*, profiles!articles_author_id_fkey(username, avatar_url)')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (!a) { setNotFound(true); setLoading(false); return }
      setArticle(a)

      const [{ count }, { data: cs }, likedRes] = await Promise.all([
        supabase.from('article_likes').select('*', { count: 'exact', head: true }).eq('article_id', a.id),
        supabase.from('article_comments').select('*, profiles!article_comments_user_id_fkey(username, avatar_url)').eq('article_id', a.id).order('created_at', { ascending: true }),
        session
          ? supabase.from('article_likes').select('user_id').eq('article_id', a.id).eq('user_id', session.user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      setLikeCount(count ?? 0)
      setComments(cs ?? [])
      setLiked(!!likedRes.data)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug, session])

  async function toggleLike() {
    if (!session) { navigate('/login'); return }
    if (likeBusy || !article) return
    setLikeBusy(true)
    if (liked) {
      setLiked(false); setLikeCount(c => Math.max(0, c - 1))
      const { error } = await supabase.from('article_likes').delete().eq('article_id', article.id).eq('user_id', session.user.id)
      if (error) { setLiked(true); setLikeCount(c => c + 1) }
    } else {
      setLiked(true); setLikeCount(c => c + 1)
      const { error } = await supabase.from('article_likes').insert({ article_id: article.id, user_id: session.user.id })
      if (error) { setLiked(false); setLikeCount(c => Math.max(0, c - 1)) }
    }
    setLikeBusy(false)
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  async function report() {
    if (!session || !article) return
    const reason = window.prompt('Why are you reporting this article?')
    if (!reason?.trim()) return
    await supabase.from('content_reports').insert({
      reporter_id: session.user.id,
      content_type: 'article',
      content_id: article.id,
      content_owner_id: article.author_id,
      reason: reason.trim(),
    })
    setReported(true)
  }

  async function postComment() {
    if (!commentText.trim() || posting || !article) return
    setPosting(true)
    const { data, error } = await supabase
      .from('article_comments')
      .insert({ article_id: article.id, user_id: session.user.id, body: commentText.trim() })
      .select('*, profiles!article_comments_user_id_fkey(username, avatar_url)')
      .single()
    setPosting(false)
    if (!error && data) {
      setComments(cs => [...cs, data])
      setCommentText('')
    }
  }

  async function deleteComment(comment) {
    if (!window.confirm('Delete this comment?')) return
    const { error } = await supabase.from('article_comments').delete().eq('id', comment.id)
    if (!error) setComments(cs => cs.filter(c => c.id !== comment.id))
  }

  async function adminUnpublish() {
    if (!window.confirm('Unpublish this article? It will revert to a draft only the author can see.')) return
    await supabase.from('articles').update({ status: 'draft' }).eq('id', article.id)
    navigate('/articles')
  }

  async function adminDelete() {
    if (!window.confirm('Delete this article permanently?')) return
    await supabase.from('articles').delete().eq('id', article.id)
    navigate('/articles')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '90px 20px', fontSize: 13, color: colors.muted }}>Unrolling the scroll…</div>
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '90px 20px', color: colors.faint }}>
        <div style={{ fontSize: 38, marginBottom: 14 }}>🗺</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 6, fontFamily: font.display }}>This article has sailed away.</div>
        <div style={{ fontSize: 13, marginBottom: 18 }}>It may have been unpublished or removed.</div>
        <Link to="/articles" style={{ color: colors.oceanBright, fontSize: 13, fontWeight: 600 }}>← Back to Articles</Link>
      </div>
    )
  }

  const catStyle = CATEGORY_STYLE[article.category] ?? statusTheme.completed
  const isAuthor = session?.user?.id === article.author_id
  const actionBtn = { ...btnGhost, padding: '8px 14px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {article.status === 'draft' && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: radius.sm, background: 'rgba(224,138,60,0.10)', border: '1px solid rgba(224,138,60,0.35)', color: colors.orange, fontSize: 13, fontWeight: 600 }}>
          Draft — only you can see this article.
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={badge(catStyle)}>{categoryLabel(article.category)}</span>
          <Link to="/articles" style={{ fontSize: 12, color: colors.faint, textDecoration: 'none', marginLeft: 'auto' }}>← All articles</Link>
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: isMobile ? 28 : 36, letterSpacing: '-0.5px', lineHeight: 1.15, color: colors.text, margin: '0 0 14px' }}>
          {article.title}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Avatar profile={article.profiles} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textSoft }}>{article.profiles?.username ?? 'Unknown'}</div>
            <div style={{ fontSize: 11.5, color: colors.faint }}>{formatDate(article.published_at ?? article.updated_at)}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {isAuthor && (
              <button className="gl-btn" style={actionBtn} onClick={() => navigate(`/articles/edit/${article.id}`)}>✎ Edit</button>
            )}
            {isAdmin && !isAuthor && (
              <>
                <button className="gl-btn" style={actionBtn} onClick={adminUnpublish}>Unpublish</button>
                <button className="gl-btn" style={{ ...actionBtn, color: colors.crimson, borderColor: 'rgba(210,74,58,0.34)' }} onClick={adminDelete}>Delete</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${colors.goldLine}, transparent)`, marginBottom: 26 }} />

      {/* Body */}
      <ArticleContent content={article.content} />

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '30px 0', flexWrap: 'wrap' }}>
        <button
          className="gl-btn"
          onClick={toggleLike}
          title={session ? undefined : 'Log in to like'}
          style={{
            ...actionBtn,
            color: liked ? colors.crimson : colors.textSoft,
            borderColor: liked ? 'rgba(210,74,58,0.4)' : colors.lineStrong,
            background: liked ? 'rgba(210,74,58,0.08)' : 'transparent',
          }}
        >
          {liked ? '♥' : '♡'} {likeCount}
        </button>
        <button className="gl-btn" style={{ ...actionBtn, color: copied ? colors.emerald : colors.textSoft }} onClick={share}>
          {copied ? '✓ Link copied' : '⚓ Share'}
        </button>
        {session && !isAuthor && (
          <button className="gl-btn" style={{ ...actionBtn, color: reported ? colors.faint : colors.textSoft, marginLeft: 'auto' }} onClick={report} disabled={reported}>
            {reported ? '✓ Reported' : '⚑ Report'}
          </button>
        )}
      </div>

      <div style={{ height: 1, background: colors.line, marginBottom: 24 }} />

      {/* Comments */}
      <div style={{ marginBottom: 60 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, fontFamily: font.display, marginBottom: 16 }}>
          Comments ({comments.length})
        </div>

        {comments.length === 0 && (
          <div style={{ fontSize: 13, color: colors.faint, marginBottom: 18 }}>No comments yet — be the first to weigh in.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          {comments.map(c => {
            const canDelete = session && (c.user_id === session.user.id || isAuthor || isAdmin)
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <Avatar profile={c.profiles} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.textSoft }}>{c.profiles?.username ?? 'Unknown'}</span>
                    <span style={{ fontSize: 11, color: colors.faint }}>{formatDate(c.created_at)}</span>
                    {canDelete && (
                      <button onClick={() => deleteComment(c)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: colors.faint, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Delete
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: colors.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>
                    {c.body}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {session ? (
          article.status === 'published' ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <textarea
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  style={{ ...inputStyle, resize: 'vertical', fontSize: 13.5, lineHeight: 1.5 }}
                />
                <button
                  className="gl-btn"
                  onClick={postComment}
                  disabled={!commentText.trim() || posting}
                  style={{ ...btnGhost, marginTop: 8, padding: '8px 18px', fontSize: 12.5, color: colors.gold, borderColor: colors.goldLine, opacity: !commentText.trim() || posting ? 0.5 : 1 }}
                >
                  {posting ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </div>
          ) : null
        ) : (
          <div style={{ fontSize: 13, color: colors.muted }}>
            <Link to="/login" style={{ color: colors.oceanBright, fontWeight: 600 }}>Log in</Link> to like and comment.
          </div>
        )}
      </div>
    </div>
  )
}
