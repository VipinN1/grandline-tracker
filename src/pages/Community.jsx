import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCardImageUrl, enrichCards, searchLeaders } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import TournamentModal from '../components/TournamentModal'
import SelectDecklistModal from '../components/SelectDecklistModal'
import ProfilePopover from '../components/ProfilePopover'
import DirectMessages from '../components/DirectMessages'
import CardPreview from '../components/CardPreview'
import { useNavigate } from 'react-router-dom'

const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

function DeckPanel({ decklist }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const navigate = useNavigate()
  if (!decklist) return null
  const cards = decklist.cards ?? []

  return (
    <>
      <div style={{ border: '1px solid rgba(140,176,208,0.07)', borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>
        <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(140,176,208,0.03)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#212d40'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(140,176,208,0.03)'}>
          <img src={getCardImageUrl(decklist.leader_id)} alt={decklist.leader_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(140,176,208,0.08)', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8' }}>{decklist.name}</div>
            <div style={{ fontSize: 11, color: '#9db2c6' }}>{decklist.leader_name} · {decklist.leader_id}</div>
          </div>
          <div style={{ fontSize: 11, color: '#9db2c6' }}>{expanded ? '▲ Hide deck' : '▼ View deck'}</div>
        </div>
        {expanded && (
          <div style={{ padding: 14, background: 'rgba(140,176,208,0.05)', borderTop: '1px solid rgba(140,176,208,0.05)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#67809a', marginBottom: 10 }}>
              {cards.reduce((s, c) => s + c.count, 0)} cards · click to enlarge
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {cards.flatMap(card =>
                Array.from({ length: card.count }, (_, i) => (
                  <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 5, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 62, borderRadius: 5, border: '1px solid rgba(140,176,208,0.08)', display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
                  </div>
                ))
              )}
            </div>
            {cards.map(card => (
              <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2f7da3', fontFamily: 'monospace' }}>{card.count}×</span>
                  <span style={{ fontSize: 13, color: '#e9f1f8' }}>{card.name ?? card.id}</span>
                </div>
                <span style={{ fontSize: 11, color: '#67809a', fontFamily: 'monospace' }}>{card.id}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedCard && (
        <CardPreview
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSearchMarketplace={() => { navigate('/marketplace', { state: { search: selectedCard.name } }); setSelectedCard(null) }}
        />
      )}
    </>
  )
}

function CommentBox({ comment, session, depth = 0, onProfileClick }) {
  const navigate = useNavigate()
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(comment.likes ?? 0)
  const [replies, setReplies] = useState([])

  const initials = comment.profiles?.username?.slice(0, 2).toUpperCase() ?? '??'

  useEffect(() => {
    async function init() {
      if (session) {
        const { data } = await supabase.from('comment_likes').select('user_id').eq('comment_id', comment.id).eq('user_id', session.user.id).single()
        if (data) setLiked(true)
      }
      if (depth === 0) {
        const { data } = await supabase.from('comments').select('*, profiles!comments_user_id_fkey(*)').eq('parent_id', comment.id).order('created_at', { ascending: true })
        setReplies(data ?? [])
      }
    }
    init()
  }, [comment.id])

  async function toggleLike() {
    if (!session) { navigate('/login'); return }
    if (liked) {
      await supabase.from('comment_likes').delete().match({ user_id: session.user.id, comment_id: comment.id })
      await supabase.rpc('decrement_comment_likes', { comment_id: comment.id })
      setLikes(prev => prev - 1)
      setLiked(false)
    } else {
      const { error } = await supabase.from('comment_likes').insert({ user_id: session.user.id, comment_id: comment.id })
      if (!error) {
        await supabase.rpc('increment_comment_likes', { comment_id: comment.id })
        setLikes(prev => prev + 1)
        setLiked(true)
      }
    }
  }

  async function submitReply() {
    if (!replyText.trim() || !session) return
    const { data } = await supabase.from('comments').insert({ post_id: comment.post_id, user_id: session.user.id, parent_id: comment.id, body: replyText.trim() }).select('*, profiles!comments_user_id_fkey(*)').single()
    if (data) setReplies(prev => [...prev, data])
    setReplyText(''); setShowReply(false)
  }

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0, marginTop: depth > 0 ? 8 : 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={() => comment.profiles && onProfileClick?.(comment.profiles)} style={{ width: 26, height: 26, borderRadius: 7, background: '#2f7da322', border: '1px solid #2f7da344', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#2f7da3', flexShrink: 0, marginTop: 2, overflow: 'hidden', cursor: comment.profiles ? 'pointer' : 'default' }}>
          {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ background: 'rgba(140,176,208,0.03)', borderRadius: 8, padding: '8px 12px' }}>
            <div onClick={() => comment.profiles && onProfileClick?.(comment.profiles)} style={{ fontSize: 12, fontWeight: 700, color: '#e9f1f8', marginBottom: 3, cursor: comment.profiles ? 'pointer' : 'default' }} onMouseEnter={e => { if (comment.profiles) e.currentTarget.style.color = '#2f7da3' }} onMouseLeave={e => e.currentTarget.style.color = '#e9f1f8'}>{comment.profiles?.username ?? 'Unknown'}</div>
            <div style={{ fontSize: 13, color: '#b0bac8', lineHeight: 1.5 }}>{comment.body}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 2, alignItems: 'center' }}>
            <button onClick={toggleLike} style={{ fontSize: 11, fontWeight: 600, color: liked ? '#d24a3a' : '#9db2c6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>♥ {likes}</button>
            {depth < 2 && <button onClick={() => session ? setShowReply(!showReply) : navigate('/login')} style={{ fontSize: 11, fontWeight: 600, color: showReply ? '#2f7da3' : '#9db2c6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{showReply ? 'Cancel' : 'Reply'}</button>}
            <span style={{ fontSize: 11, color: '#67809a' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          {showReply && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input type="text" placeholder={`Reply to ${comment.profiles?.username ?? 'comment'}...`} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitReply()} autoFocus style={{ flex: 1, background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 7, padding: '6px 10px', color: '#e9f1f8', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={submitReply} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Post</button>
            </div>
          )}
          {replies.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 4, borderLeft: '2px solid rgba(140,176,208,0.2)' }}>
              {replies.map(r => <CommentBox key={r.id} comment={r} session={session} depth={depth + 1} onProfileClick={onProfileClick} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, session, onProfileClick, onDelete }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes ?? 0)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const initials = post.profiles?.username?.slice(0, 2).toUpperCase() ?? '??'
  const username = session?.user?.user_metadata?.username ?? 'Me'
  const myInitials = username.slice(0, 2).toUpperCase()

  useEffect(() => {
    async function init() {
      if (session) {
        const { data } = await supabase.from('post_likes').select('user_id').eq('post_id', post.id).eq('user_id', session.user.id).single()
        if (data) setLiked(true)
      }
      loadComments()
    }
    init()
  }, [post.id])

  async function loadComments() {
    setLoadingComments(true)
    const { data } = await supabase.from('comments').select('*, profiles!comments_user_id_fkey(*)').eq('post_id', post.id).is('parent_id', null).order('created_at', { ascending: true })
    setComments(data ?? [])
    setLoadingComments(false)
  }

  async function submitComment() {
    if (!commentText.trim() || !session) return
    const { data } = await supabase.from('comments').insert({ post_id: post.id, user_id: session.user.id, body: commentText.trim() }).select('*, profiles!comments_user_id_fkey(*)').single()
    if (data) { setComments([...comments, data]); setShowComments(true) }
    setCommentText('')
  }

  async function toggleLike() {
    if (!session) { navigate('/login'); return }
    if (liked) {
      await supabase.from('post_likes').delete().match({ user_id: session.user.id, post_id: post.id })
      await supabase.rpc('decrement_post_likes', { post_id: post.id })
      setLikes(prev => prev - 1); setLiked(false)
    } else {
      const { error } = await supabase.from('post_likes').insert({ user_id: session.user.id, post_id: post.id })
      if (!error) {
        await supabase.rpc('increment_post_likes', { post_id: post.id })
        setLikes(prev => prev + 1); setLiked(true)
      }
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return }
    await supabase.from('posts').delete().eq('id', post.id)
    // notify parent to remove post from list
    onDelete?.(post.id)
  }

  return (
    <div style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 14, padding: '18px 20px' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,162,74,0.4)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(140,176,208,0.07)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          onClick={() => post.profiles && onProfileClick?.(post.profiles)}
          style={{ width: 36, height: 36, borderRadius: 9, background: '#2f7da322', border: '1px solid #2f7da344', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2f7da3', flexShrink: 0, overflow: 'hidden', cursor: post.profiles ? 'pointer' : 'default' }}
        >
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div>
          <div
            onClick={() => post.profiles && onProfileClick?.(post.profiles)}
            style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8', cursor: post.profiles ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (post.profiles) e.currentTarget.style.color = '#2f7da3' }}
            onMouseLeave={e => e.currentTarget.style.color = '#e9f1f8'}
          >
            {post.profiles?.username ?? 'Unknown'}
          </div>
          <div style={{ fontSize: 11, color: '#67809a' }}>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
        {session?.user?.id === post.user_id && (
          <button onClick={handleDelete} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: confirmDelete ? 'rgba(210,74,58,0.15)' : 'rgba(140,176,208,0.05)', border: `1px solid ${confirmDelete ? '#d24a3a' : 'rgba(140,176,208,0.15)'}`, color: confirmDelete ? '#d24a3a' : '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {confirmDelete ? 'Confirm?' : 'Delete Post'}
          </button>
        )}
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: '#e9f1f8', marginBottom: 8, letterSpacing: '-0.2px' }}>{post.title}</div>
      <div style={{ fontSize: 13, color: '#9db2c6', lineHeight: 1.7 }}>
        {expanded ? post.body : post.body.slice(0, 180) + (post.body.length > 180 ? '...' : '')}
        {post.body.length > 180 && (
          <button onClick={() => setExpanded(!expanded)} style={{ color: '#2f7da3', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '0 4px' }}>
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </div>

      {post.decklists && <DeckPanel decklist={post.decklists} />}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(140,176,208,0.05)', alignItems: 'center' }}>
        <button onClick={toggleLike} style={{ fontSize: 13, fontWeight: 600, color: liked ? '#d24a3a' : '#9db2c6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>♥ {likes}</button>
        <button onClick={() => setShowComments(!showComments)} style={{ fontSize: 13, fontWeight: 600, color: '#9db2c6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          💬 {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </button>
      </div>

      {session ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
            {myInitials}
          </div>
          <input type="text" placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} style={{ flex: 1, background: 'rgba(26,50,81,0.92)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, padding: '7px 12px', color: '#e9f1f8', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={submitComment} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Post</button>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: '#67809a' }}>
          <button onClick={() => navigate('/login')} style={{ color: '#2f7da3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: 0 }}>Sign in</button>
          {' '}to like and comment
        </div>
      )}

      {showComments && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(140,176,208,0.05)' }}>
          {loadingComments ? (
            <div style={{ fontSize: 12, color: '#9db2c6' }}>Loading comments...</div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#67809a' }}>No comments yet. Be the first!</div>
          ) : (
            comments.map(c => <CommentBox key={c.id} comment={c} session={session} onProfileClick={onProfileClick} />)
          )}
        </div>
      )}
    </div>
  )
}

function CreatePostModal({ session, onClose, onSubmit, isMobile }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [decklistRaw, setDecklistRaw] = useState('')
  const [leaderResult, setLeaderResult] = useState(null)
  const [deckName, setDeckName] = useState('')
  const [parsedCards, setParsedCards] = useState([])
  const [deckParsed, setDeckParsed] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderResults, setLeaderResults] = useState([])
  const [leaderSearching, setLeaderSearching] = useState(false)
  const [leaderOpen, setLeaderOpen] = useState(false)
  const leaderRef = useRef(null)
  const debounceRef = useRef(null)
  const [selectingDecklist, setSelectingDecklist] = useState(false)
  const [attachedDecklist, setAttachedDecklist] = useState(null)

  useEffect(() => {
    function handleClick(e) {
      if (leaderRef.current && !leaderRef.current.contains(e.target)) setLeaderOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleLeaderQuery(e) {
    const val = e.target.value
    setLeaderQuery(val); setLeaderOpen(true)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setLeaderResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLeaderSearching(true)
      try { const data = await searchLeaders(val); setLeaderResults(data.slice(0, 50)) }
      catch { setLeaderResults([]) }
      setLeaderSearching(false)
    }, 400)
  }

  async function handleParseDeck() {
    const raw = decklistRaw.trim().split('\n').reduce((acc, line) => {
      const match = line.trim().match(/^(\d+)[xX]([A-Z0-9\-]+)$/)
      if (match) acc.push({ count: parseInt(match[1]), id: match[2].toUpperCase(), name: match[2].toUpperCase() })
      return acc
    }, [])
    if (raw.length === 0) { setParsedCards([]); setDeckParsed(true); return }
    setEnriching(true)
    const enriched = await enrichCards(raw)
    setParsedCards(enriched); setDeckParsed(true); setEnriching(false)
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim() || !session) return
    setSaving(true)
    let decklistId = attachedDecklist?.id ?? null
    if (!attachedDecklist && leaderResult && parsedCards.length > 0) {
      const { data: dl } = await supabase.from('decklists').insert({ user_id: session.user.id, name: deckName || `${leaderResult.card_name} Deck`, leader_id: leaderResult.card_set_id, leader_name: leaderResult.card_name, leader_color: leaderResult.card_color, cards: parsedCards }).select().single()
      if (dl) decklistId = dl.id
    }
    const { data: post } = await supabase.from('posts').insert({ user_id: session.user.id, title: title.trim(), body: body.trim(), decklist_id: decklistId }).select('*, profiles!posts_user_id_fkey(*), decklists(*)').single()
    if (post) onSubmit(post)
    setSaving(false); onClose()
  }

  const inputStyle = { width: '100%', background: 'rgba(26,50,81,0.92)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, padding: '9px 12px', color: '#e9f1f8', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9db2c6', marginBottom: 6, display: 'block' }

  const modalBox = {
    background: 'rgba(140,176,208,0.05)',
    border: '1px solid rgba(140,176,208,0.12)',
    borderRadius: isMobile ? '16px 16px 0 0' : 16,
    width: isMobile ? '100%' : 620,
    maxHeight: isMobile ? '95vh' : '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: isMobile ? 'slideUp 0.25s ease-out' : undefined,
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(140,176,208,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e9f1f8' }}>Create Post</div>
          <button onClick={onClose} style={{ background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.1)', borderRadius: 6, color: '#9db2c6', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={labelStyle}>Title</label><input type="text" placeholder="Give your post a title..." value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Body</label><textarea placeholder="Share your thoughts..." value={body} onChange={e => setBody(e.target.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} /></div>
      <div style={{ borderTop: '1px solid rgba(140,176,208,0.05)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#67809a', marginBottom: 14 }}>Attach Decklist (optional)</div>

        {/* Attached from account */}
        {attachedDecklist ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(140,176,208,0.08)', border: '1px solid rgba(200,162,74,0.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <img src={getCardImageUrl(attachedDecklist.leader_id)} alt={attachedDecklist.leader_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.opacity = '0.2' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8' }}>{attachedDecklist.name}</div>
              <div style={{ fontSize: 11, color: COLORS[attachedDecklist.leader_color] ?? '#9db2c6', marginTop: 2 }}>{attachedDecklist.leader_name} · {attachedDecklist.leader_id}</div>
            </div>
            <button onClick={() => setAttachedDecklist(null)} style={{ background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
          </div>
        ) : (
          <>
            {/* Attach from account button */}
            <button onClick={() => setSelectingDecklist(true)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(200,162,74,0.3)', background: 'rgba(140,176,208,0.08)', color: '#52a9cd', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
              Attach Decklist From Account
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(140,176,208,0.05)' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#67809a' }}>or</div>
              <div style={{ flex: 1, height: 1, background: 'rgba(140,176,208,0.05)' }} />
            </div>

            {/* Manual paste section */}
            <div style={{ marginBottom: 12 }}><label style={labelStyle}>Deck Name</label><input type="text" placeholder="e.g. Red Luffy Aggro v3" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} /></div>
            <div ref={leaderRef} style={{ position: 'relative', marginBottom: 12 }}>
              <label style={labelStyle}>Leader Card</label>
              {leaderResult ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(26,50,81,0.95)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, padding: '8px 12px' }}>
                  <img src={getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e9f1f8' }}>{leaderResult.card_name}</div>
                    <div style={{ fontSize: 11, color: COLORS[leaderResult.card_color] ?? '#9db2c6' }}>{leaderResult.card_color} · {leaderResult.card_set_id}</div>
                  </div>
                  <button onClick={() => { setLeaderResult(null); setLeaderQuery('') }} style={{ background: 'none', border: 'none', color: '#9db2c6', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                </div>
              ) : (
                <>
                  <input type="text" placeholder="Search by name or ID..." value={leaderQuery} onChange={handleLeaderQuery} onFocus={() => leaderQuery.length >= 2 && setLeaderOpen(true)} style={inputStyle} />
                  {leaderOpen && leaderQuery.length >= 2 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'rgba(10,22,38,0.97)', border: '1px solid rgba(200,162,74,0.35)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 260, overflowY: 'auto' }}>
                      {leaderSearching ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#9db2c6' }}>Searching...</div>
                        : leaderResults.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#67809a' }}>No leaders found</div>
                        : leaderResults.map(card => (
                          <div key={card.card_set_id} onClick={() => { setLeaderResult(card); setLeaderQuery(''); setLeaderOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(140,176,208,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <img src={getCardImageUrl(card.card_set_id)} alt={card.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#e9f1f8' }}>{card.card_name}</div>
                              <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#9db2c6', marginTop: 2 }}>
                                <span style={{ fontFamily: 'monospace' }}>{card.card_set_id}</span>
                                {card.set_name && <span style={{ color: '#67809a' }}> · {card.set_name}</span>}
                              </div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label style={labelStyle}>Paste Decklist</label>
              <textarea placeholder={'4xOP01-024\n4xOP01-013\n...'} value={decklistRaw} onChange={e => { setDecklistRaw(e.target.value); setDeckParsed(false); setParsedCards([]) }} style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
              <button onClick={handleParseDeck} disabled={!decklistRaw.trim() || enriching} style={{ marginTop: 8, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(140,176,208,0.1)', background: decklistRaw.trim() ? 'rgba(140,176,208,0.05)' : 'transparent', color: decklistRaw.trim() ? '#e9f1f8' : '#67809a', fontSize: 13, fontWeight: 600, cursor: decklistRaw.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {enriching ? 'Fetching card data...' : 'Preview Decklist'}
              </button>
            </div>
            {deckParsed && parsedCards.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#67809a', marginBottom: 8 }}>{parsedCards.reduce((s, c) => s + c.count, 0)} cards parsed</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {parsedCards.flatMap(card => Array.from({ length: card.count }, (_, i) => (
                    <img key={`${card.id}-${i}`} src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 52, borderRadius: 4, border: `2px solid ${COLORS[card.color] ?? 'rgba(140,176,208,0.08)'}` }} onError={e => { e.target.style.opacity = '0.2' }} />
                  )))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(140,176,208,0.07)', flexShrink: 0 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: saving ? '#3a526a' : '#2f7da3', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    {selectingDecklist && (
      <SelectDecklistModal
        session={session}
        isMobile={isMobile}
        onClose={() => setSelectingDecklist(false)}
        onSelect={deck => { setAttachedDecklist(deck); setLeaderResult(null); setDecklistRaw(''); setParsedCards([]) }}
      />
    )}
    </div>
  )
}

export default function Community({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('latest')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [tab, setTab] = useState(location.state?.dmUserId ? 'messages' : 'posts')
  const [dmUserId] = useState(location.state?.dmUserId ?? null)
  const [unreadDms, setUnreadDms] = useState(0)
  const { isMobile } = useWindowSize()

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*, profiles!posts_user_id_fkey(*), decklists(*)').order(filter === 'top' ? 'likes' : 'created_at', { ascending: false })
    setPosts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [filter])

  useEffect(() => {
    if (!session) return
    async function loadDmCount() {
      const { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('receiver_id', session.user.id).eq('read', false)
      setUnreadDms(count ?? 0)
    }
    loadDmCount()
    const channel = supabase
      .channel(`community_dm_${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${session.user.id}` }, () => setUnreadDms(c => c + 1))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${session.user.id}` }, () => loadDmCount())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [session])

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#dcb35e', marginBottom: 4 }}>Feed</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, color: '#e9f1f8', letterSpacing: '-0.3px', marginBottom: 2 }}>Community</div>
        <div style={{ fontSize: 13, color: '#9db2c6' }}>Decklists, tournament reports, and meta discussion</div>
      </div>

      {session && (
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '1px solid rgba(140,176,208,0.07)' }}>
          {[{ key: 'posts', label: 'Posts' }, { key: 'messages', label: 'Messages' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: tab === t.key ? '#e9f1f8' : '#9db2c6', borderBottom: tab === t.key ? '2px solid #2f7da3' : '2px solid transparent', marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.key === 'messages' && unreadDms > 0 && (
                <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#d24a3a', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>
                  {unreadDms > 9 ? '9+' : unreadDms}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'messages' && session ? (
        <DirectMessages session={session} isMobile={isMobile} initialUserId={dmUserId} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(140,176,208,0.05)', border: '1px solid rgba(140,176,208,0.07)', borderRadius: 8, padding: 4 }}>
              {['latest', 'top'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? '#2f7da3' : 'transparent', color: filter === f ? '#fff' : '#9db2c6', transition: 'all 0.1s', textTransform: 'capitalize' }}>{f}</button>
              ))}
            </div>
            {session ? (
              <button onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #2f7da3, #1b4a66)', color: '#fff', fontFamily: 'inherit' }}>+ Create Post</button>
            ) : (
              <button onClick={() => navigate('/login')} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(200,162,74,0.25)', background: 'transparent', color: '#52a9cd', fontFamily: 'inherit' }}>Sign in to post</button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9db2c6', fontSize: 13 }}>Loading posts...</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#67809a' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#9db2c6', marginBottom: 6 }}>No posts yet</div>
              <div style={{ fontSize: 13 }}>Be the first to post in the community</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {posts.map(post => <PostCard key={post.id} post={post} session={session} onProfileClick={setSelectedProfile} onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))} />)}
            </div>
          )}
        </>
      )}

      {showCreate && <CreatePostModal session={session} onClose={() => setShowCreate(false)} onSubmit={() => { setShowCreate(false); loadPosts() }} isMobile={isMobile} />}
      {selectedProfile && <ProfilePopover profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} />}
    </div>
  )
}
