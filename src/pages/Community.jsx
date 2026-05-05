import { useState, useEffect } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'

function CardPreview({ card, onClose }) {
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 300, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>{card.name}</div>
          <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 3, fontFamily: 'monospace' }}>{card.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f2f5', fontSize: 13, fontWeight: 600, padding: '7px 24px', cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  )
}

function DeckPanel({ decklist }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  if (!decklist) return null
  const cards = decklist.cards ?? []
  const color = '#3d7fff'

  return (
    <>
      <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>
        <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1c2333', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#212d40'} onMouseLeave={e => e.currentTarget.style.background = '#1c2333'}>
          <img src={getCardImageUrl(decklist.leader_id)} alt={decklist.leader_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{decklist.name}</div>
            <div style={{ fontSize: 11, color: '#6b7a99' }}>{decklist.leader_name} · {decklist.leader_id}</div>
          </div>
          <div style={{ fontSize: 11, color: '#6b7a99' }}>{expanded ? '▲ Hide deck' : '▼ View deck'}</div>
        </div>

        {expanded && (
          <div style={{ padding: 14, background: '#161b27', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
              {cards.reduce((s, c) => s + c.count, 0)} cards · click to enlarge
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {cards.flatMap(card =>
                Array.from({ length: card.count }, (_, i) => (
                  <div key={`${card.id}-${i}`} onClick={() => setSelectedCard(card)} style={{ cursor: 'pointer', borderRadius: 5, transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <img src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 62, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} onError={e => { e.target.style.opacity = '0.15' }} />
                  </div>
                ))
              )}
            </div>
            {cards.map(card => (
              <div key={card.id} onClick={() => setSelectedCard(card)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#3d7fff', fontFamily: 'monospace' }}>{card.count}×</span>
                  <span style={{ fontSize: 13, color: '#f0f2f5' }}>{card.name ?? card.id}</span>
                </div>
                <span style={{ fontSize: 11, color: '#3a4560', fontFamily: 'monospace' }}>{card.id}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedCard && <CardPreview card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </>
  )
}

function CommentBox({ comment, session, depth = 0 }) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(comment.likes ?? 0)
  const [replies, setReplies] = useState(comment.replies ?? [])

  const initials = comment.profiles?.username?.slice(0, 2).toUpperCase() ?? '??'

  async function submitReply() {
    if (!replyText.trim() || !session) return
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: comment.post_id, user_id: session.user.id, parent_id: comment.id, body: replyText.trim() })
      .select('*, profiles(*)')
      .single()
    if (data) setReplies([...replies, data])
    setReplyText('')
    setShowReply(false)
  }

  return (
    <div style={{ marginLeft: depth > 0 ? 32 : 0, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#3d7fff', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#1c2333', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f2f5', marginBottom: 4 }}>{comment.profiles?.username ?? 'Unknown'}</div>
            <div style={{ fontSize: 13, color: '#b0bac8', lineHeight: 1.6 }}>{comment.body}</div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 4 }}>
            <button onClick={() => { setLiked(!liked); setLikes(liked ? likes - 1 : likes + 1) }} style={{ fontSize: 11, fontWeight: 600, color: liked ? '#f05252' : '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>♥ {likes}</button>
            {depth === 0 && <button onClick={() => setShowReply(!showReply)} style={{ fontSize: 11, fontWeight: 600, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Reply</button>}
            <span style={{ fontSize: 11, color: '#3a4560' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          {showReply && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="text" placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitReply()} style={{ flex: 1, background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={submitReply} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#3d7fff', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Post</button>
            </div>
          )}
          {replies.map(r => <CommentBox key={r.id} comment={r} session={session} depth={depth + 1} />)}
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, session }) {
  const [expanded, setExpanded] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes ?? 0)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  const initials = post.profiles?.username?.slice(0, 2).toUpperCase() ?? '??'

  async function loadComments() {
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(*)')
      .eq('post_id', post.id)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
    setLoadingComments(false)
  }

  async function toggleComments() {
    if (!showComments && comments.length === 0) await loadComments()
    setShowComments(!showComments)
  }

  async function submitComment() {
    if (!commentText.trim() || !session) return
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: session.user.id, body: commentText.trim() })
      .select('*, profiles(*)')
      .single()
    if (data) {
      setComments([...comments, data])
      setShowComments(true)
    }
    setCommentText('')
  }

  async function toggleLike() {
    if (!session) return
    if (liked) {
      await supabase.from('post_likes').delete().match({ user_id: session.user.id, post_id: post.id })
      await supabase.from('posts').update({ likes: likes - 1 }).eq('id', post.id)
      setLikes(likes - 1)
    } else {
      await supabase.from('post_likes').insert({ user_id: session.user.id, post_id: post.id })
      await supabase.from('posts').update({ likes: likes + 1 }).eq('id', post.id)
      setLikes(likes + 1)
    }
    setLiked(!liked)
  }

  const username = session?.user?.user_metadata?.username ?? 'Me'
  const myInitials = username.slice(0, 2).toUpperCase()

  return (
    <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#3d7fff', flexShrink: 0 }}>{initials}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{post.profiles?.username ?? 'Unknown'}</div>
          <div style={{ fontSize: 11, color: '#3a4560' }}>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5', marginBottom: 8, letterSpacing: '-0.2px' }}>{post.title}</div>
      <div style={{ fontSize: 13, color: '#8a9bb0', lineHeight: 1.7 }}>
        {expanded ? post.body : post.body.slice(0, 180) + (post.body.length > 180 ? '...' : '')}
        {post.body.length > 180 && (
          <button onClick={() => setExpanded(!expanded)} style={{ color: '#3d7fff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '0 4px' }}>
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </div>

      {post.decklists && <DeckPanel decklist={post.decklists} />}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
        <button onClick={toggleLike} style={{ fontSize: 13, fontWeight: 600, color: liked ? '#f05252' : '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>♥ {likes}</button>
        <button onClick={toggleComments} style={{ fontSize: 13, fontWeight: 600, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          💬 {post.comment_count ?? 0} comments
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#3d7fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{myInitials}</div>
        <input type="text" placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} style={{ flex: 1, background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={submitComment} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#3d7fff', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Post</button>
      </div>

      {showComments && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {loadingComments ? (
            <div style={{ fontSize: 12, color: '#6b7a99' }}>Loading comments...</div>
          ) : comments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#3a4560' }}>No comments yet. Be the first!</div>
          ) : (
            comments.map(c => <CommentBox key={c.id} comment={c} session={session} />)
          )}
        </div>
      )}
    </div>
  )
}

function CreatePostModal({ session, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [decklistRaw, setDecklistRaw] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [deckName, setDeckName] = useState('')
  const [saving, setSaving] = useState(false)

  function parseDeck(raw) {
    return raw.trim().split('\n').reduce((acc, line) => {
      const match = line.trim().match(/^(\d+)[xX]([A-Z0-9\-]+)$/)
      if (match) acc.push({ count: parseInt(match[1]), id: match[2].toUpperCase(), name: match[2].toUpperCase() })
      return acc
    }, [])
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim() || !session) return
    setSaving(true)

    let decklistId = null

    if (leaderId.trim() && decklistRaw.trim()) {
      const cards = parseDeck(decklistRaw)
      const { data: dl } = await supabase
        .from('decklists')
        .insert({
          user_id: session.user.id,
          name: deckName || 'My Deck',
          leader_id: leaderId.trim().toUpperCase(),
          leader_name: leaderName || leaderId.trim().toUpperCase(),
          leader_color: 'Red',
          cards,
        })
        .select()
        .single()
      if (dl) decklistId = dl.id
    }

    const { data: post } = await supabase
      .from('posts')
      .insert({ user_id: session.user.id, title: title.trim(), body: body.trim(), decklist_id: decklistId })
      .select('*, profiles(*), decklists(*)')
      .single()

    if (post) onSubmit(post)
    setSaving(false)
    onClose()
  }

  const inputStyle = { width: '100%', background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7a99', marginBottom: 6, display: 'block' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>Create Post</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6b7a99', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={labelStyle}>Title</label><input type="text" placeholder="Give your post a title..." value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Body</label><textarea placeholder="Share your thoughts..." value={body} onChange={e => setBody(e.target.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} /></div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#3a4560', marginBottom: 14 }}>Attach Decklist (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Deck Name</label><input type="text" placeholder="e.g. Red Luffy Aggro" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Leader Card ID</label><input type="text" placeholder="e.g. OP01-060" value={leaderId} onChange={e => setLeaderId(e.target.value)} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Leader Name</label><input type="text" placeholder="e.g. Monkey D. Luffy" value={leaderName} onChange={e => setLeaderName(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} /></div>
            <div><label style={labelStyle}>Paste Decklist</label><textarea placeholder={'4xOP01-024\n4xOP01-013\n...'} value={decklistRaw} onChange={e => setDecklistRaw(e.target.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} /></div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: saving ? '#2a4a8a' : '#3d7fff', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Community({ session }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('latest')

  useEffect(() => {
    loadPosts()
  }, [filter])

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*), decklists(*)')
      .order(filter === 'top' ? 'likes' : 'created_at', { ascending: false })
    setPosts(data ?? [])
    setLoading(false)
  }

  function handleNewPost(post) {
    setPosts([post, ...posts])
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3d7fff', marginBottom: 4 }}>Feed</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Community</div>
        <div style={{ fontSize: 13, color: '#6b7a99' }}>Decklists, tournament reports, and meta discussion</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 4 }}>
          {['latest', 'top'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? '#3d7fff' : 'transparent', color: filter === f ? '#fff' : '#6b7a99', transition: 'all 0.1s', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#3d7fff', color: '#fff', fontFamily: 'inherit' }}>
          + Create Post
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7a99', fontSize: 13 }}>Loading posts...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#3a4560' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7a99', marginBottom: 6 }}>No posts yet</div>
          <div style={{ fontSize: 13 }}>Be the first to post in the community</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(post => <PostCard key={post.id} post={post} session={session} />)}
        </div>
      )}

      {showCreate && <CreatePostModal session={session} onClose={() => setShowCreate(false)} onSubmit={handleNewPost} />}
    </div>
  )
}