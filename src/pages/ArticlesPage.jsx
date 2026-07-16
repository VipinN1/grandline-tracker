import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCardImageUrl } from '../lib/optcgapi'
import { CATEGORIES, categoryLabel } from '../lib/articles'
import { useWindowSize } from '../hooks/useWindowSize'
import { colors, font, radius, eyebrow, pageHeader, btnPrimary, status as statusTheme, badge } from '../theme'

const CATEGORY_STYLE = {
  devlog: statusTheme.gold,
  deck_guide: statusTheme.active,
  strategy: statusTheme.open,
  tournament_report: statusTheme.closed,
  news: statusTheme.danger,
  other: statusTheme.completed,
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ArticleCard({ article, onClick, showStatus }) {
  const catStyle = CATEGORY_STYLE[article.category] ?? statusTheme.completed
  const likeCount = article.article_likes?.[0]?.count ?? 0
  const commentCount = article.article_comments?.[0]?.count ?? 0

  return (
    <div
      className="gl-lift"
      onClick={onClick}
      style={{
        background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
        border: `1px solid ${colors.line}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: 130, background: `linear-gradient(135deg, ${colors.oceanDeep}33, ${colors.surface})`, overflow: 'hidden' }}>
        {article.cover_card_id ? (
          <img
            src={getCardImageUrl(article.cover_card_id)}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, opacity: 0.5 }}>📜</div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(10,22,38,0.85) 100%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <span style={badge(catStyle)}>{categoryLabel(article.category)}</span>
          {showStatus && article.status === 'draft' && <span style={badge(statusTheme.closed)}>Draft</span>}
        </div>
      </div>

      <div style={{ padding: '14px 16px 15px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 17, letterSpacing: '-0.2px', color: colors.text, lineHeight: 1.25 }}>
          {article.title}
        </div>
        {article.excerpt && (
          <div style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {article.excerpt}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: `linear-gradient(135deg, ${colors.oceanDeep}, ${colors.ocean})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: colors.parchment, flexShrink: 0 }}>
            {article.profiles?.avatar_url
              ? <img src={article.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (article.profiles?.username ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.profiles?.username ?? 'Unknown'}
          </span>
          <span style={{ fontSize: 11, color: colors.faint, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {timeAgo(article.published_at ?? article.updated_at)}
          </span>
          <span style={{ fontSize: 11, color: colors.faint, whiteSpace: 'nowrap' }}>♥ {likeCount}</span>
          <span style={{ fontSize: 11, color: colors.faint, whiteSpace: 'nowrap' }}>💬 {commentCount}</span>
        </div>
      </div>
    </div>
  )
}

const FULL_SELECT = 'id, title, slug, category, excerpt, cover_card_id, status, published_at, updated_at, author_id, profiles(username, avatar_url), article_likes(count), article_comments(count)'
// Fallback without the count aggregates in case the embed-count syntax fails.
const BASIC_SELECT = 'id, title, slug, category, excerpt, cover_card_id, status, published_at, updated_at, author_id, profiles(username, avatar_url)'

export default function ArticlesPage({ session }) {
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter lives in the URL (?filter=mine) so other pages can link straight
  // to e.g. My Articles. "mine" needs a session.
  const rawFilter = searchParams.get('filter') ?? 'all'
  const filter = rawFilter === 'mine' && !session ? 'all' : rawFilter

  function setFilter(value) {
    setSearchParams(value === 'all' ? {} : { filter: value }, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    async function fetchArticles(select) {
      let query = supabase.from('articles').select(select)
      if (filter === 'mine') {
        query = query.eq('author_id', session.user.id).order('updated_at', { ascending: false })
      } else {
        query = query.eq('status', 'published').order('published_at', { ascending: false })
        if (filter !== 'all') query = query.eq('category', filter)
      }
      return query
    }
    async function load() {
      setLoading(true)
      let { data, error } = await fetchArticles(FULL_SELECT)
      if (error) {
        console.error('Articles query failed, retrying without counts:', error.message)
        ;({ data } = await fetchArticles(BASIC_SELECT))
      }
      if (!cancelled) {
        setArticles(data ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filter, session])

  const filters = [
    { value: 'all', label: 'All' },
    ...(session ? [{ value: 'mine', label: '✍ My Articles' }] : []),
    ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
  ]

  const chip = active => ({
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 13px',
    borderRadius: radius.pill,
    border: `1px solid ${active ? colors.goldLine : colors.line}`,
    background: active ? colors.goldSoft : 'transparent',
    color: active ? colors.gold : colors.muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>The Grand Log</div>
          <h1 style={{ ...pageHeader(), margin: 0 }}>Articles</h1>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
            Dev logs, deck guides and strategy from the crew. Anyone can write one.
          </div>
        </div>
        <button
          className="gl-btn"
          onClick={() => navigate(session ? '/articles/new' : '/login')}
          style={btnPrimary}
        >
          ✍ Write an Article
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {filters.map(f => (
          <button key={f.value} style={chip(filter === f.value)} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', fontSize: 13, color: colors.muted }}>Unrolling the scrolls…</div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', color: colors.faint }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.muted, marginBottom: 4 }}>
            {filter === 'mine' ? "You haven't written anything yet." : 'No articles here yet.'}
          </div>
          <div style={{ fontSize: 12.5 }}>Be the first to chart these waters.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {articles.map(a => (
            <ArticleCard
              key={a.id}
              article={a}
              showStatus={filter === 'mine'}
              onClick={() => {
                if (filter === 'mine' && a.status === 'draft') navigate(`/articles/edit/${a.id}`)
                else navigate(`/articles/${a.slug}`)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
