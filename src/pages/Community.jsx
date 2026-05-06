import { useState, useEffect, useRef } from 'react'
import { getCardImageUrl, enrichCards, searchLeaders } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

function CardPreview({ card, onClose }) {
  if (!card) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

function ProfileModal({ profile, session, onClose }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [friendStatus, setFriendStatus] = useState(null)
  const [selectedTournament, setSelectedTournament] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: tData }, { data: fData }] = await Promise.all([
        supabase.from('tournaments').select('*, decklists(*)').eq('user_id', profile.id).order('date', { ascending: false }),
        supabase.from('friends').select('*').or(`and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`)
      ])
      setTournaments(tData ?? [])
      if (fData && fData.length > 0) {
        const rel = fData[0]
        if (rel.status === 'accepted') setFriendStatus('accepted')
        else if (rel.user_id === session.user.id) setFriendStatus('pending_sent')
        else setFriendStatus('pending_received')
      }
      setLoading(false)
    }
    load()
  }, [profile.id])

  const totalWins = tournaments.reduce((s, t) => s + t.wins, 0)
  const totalLosses = tournaments.reduce((s, t) => s + t.losses, 0)
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
  const topEights = tournaments.filter(t => t.placement <= 8).length
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? '??'

  async function sendFriendRequest() {
    const { error } = await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' })
    if (!error) setFriendStatus('pending_sent')
  }

  async function acceptRequest() {
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', profile.id).eq('friend_id', session.user.id)
    await supabase.from('friends').insert({ user_id: session.user.id, friend_id: profile.id, status: 'accepted' })
    setFriendStatus('accepted')
  }

  function FriendButton() {
    if (profile.id === session.user.id) return null
    if (friendStatus === 'accepted') return <button style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399', cursor: 'default', fontFamily: 'inherit' }}>Friends ✓</button>
    if (friendStatus === 'pending_sent') return <button disabled style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7a99', cursor: 'default', fontFamily: 'inherit' }}>Request Sent</button>
    if (friendStatus === 'pending_received') return <button onClick={acceptRequest} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#34d399', color: '#0f1117', cursor: 'pointer', fontFamily: 'inherit' }}>Accept Request</button>
    return <button onClick={sendFriendRequest} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#3d7fff', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Friend</button>
  }

  function pLabel(n) { if (n===1) return '1st'; if (n===2) return '2nd'; if (n===3) return '3rd'; return `${n}th` }
  function pStyle(n) {
    if (n===1) return { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }
    if (n===2) return { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
    if (n===3) return { background: 'rgba(251,146,60,0.1)', color: '#fb923c' }
    return { background: 'rgba(255,255,255,0.04)', color: '#3a4560' }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 520, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#3d7fff', flexShrink: 0, overflow: 'hidden' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f2f5' }}>{profile.username}</div>
              {profile.location && <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 2 }}>{profile.location}</div>}
            </div>
            <FriendButton />
            <button onClick={onClose} style={{ marginLeft: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6b7a99', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {[['Win Rate', `${winRate}%`], ['Events', tournaments.length], ['Top 8s', topEights]].map(([label, val]) => (
              <div key={label} style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f2f5' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowY: 'auto', padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 12 }}>Tournament History — click to view deck</div>
            {loading ? (
              <div style={{ fontSize: 13, color: '#6b7a99', textAlign: 'center', padding: 20 }}>Loading...</div>
            ) : tournaments.length === 0 ? (
              <div style={{ fontSize: 13, color: '#3a4560', textAlign: 'center', padding: 20 }}>No tournaments logged yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tournaments.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTournament(t)}
                    style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', alignItems: 'center', gap: 12, background: '#1c2333', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = '#212d40' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#1c2333' }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, ...pStyle(t.placement) }}>{pLabel(t.placement)}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 1 }}>{t.date} · {t.player_count} players</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src={getCardImageUrl(t.leader_id)} alt={t.leader_name} style={{ width: 24, height: 33, objectFit: 'cover', objectPosition: 'top', borderRadius: 3 }} onError={e => { e.target.style.display = 'none' }} />
                      <div style={{ fontSize: 11, color: COLORS[t.leader_color] ?? '#6b7a99' }}>{t.leader_name}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#34d399' }}>{t.wins}W</span>
                      <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
                      <span style={{ color: '#f05252' }}>{t.losses}L</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedTournament && (
        <div onClick={() => setSelectedTournament(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', height: 120, background: '#1c2333', flexShrink: 0 }}>
              <img src={getCardImageUrl(selectedTournament.leader_id)} alt={selectedTournament.leader_name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, #161b27 100%)' }} />
              <button onClick={() => setSelectedTournament(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#f0f2f5', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <div style={{ position: 'absolute', bottom: 14, left: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{selectedTournament.deck_name ?? selectedTournament.name}</div>
                <div style={{ fontSize: 12, color: '#6b7a99' }}>{selectedTournament.leader_name} · {selectedTournament.leader_id}</div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: COLORS[selectedTournament.leader_color] ?? '#3d7fff' }} />
            </div>

            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, ...pStyle(selectedTournament.placement) }}>{pLabel(selectedTournament.placement)}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{selectedTournament.name}</div>
                <div style={{ fontSize: 11, color: '#6b7a99' }}>{selectedTournament.date} · {selectedTournament.player_count} players</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
                <span style={{ color: '#34d399' }}>{selectedTournament.wins}W</span>
                <span style={{ color: '#3a4560', margin: '0 3px' }}>·</span>
                <span style={{ color: '#f05252' }}>{selectedTournament.losses}L</span>
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 20 }}>
              {selectedTournament.decklists?.cards?.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 10 }}>
                    Decklist — {selectedTournament.decklists.cards.reduce((s, c) => s + c.count, 0)} cards
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {selectedTournament.decklists.cards.flatMap((card, i) =>
                      Array.from({ length: card.count }, (_, j) => (
                        <img key={`${i}-${j}`} src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 65, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.opacity = '0.15' }} />
                      ))
                    )}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Card List</div>
                  {selectedTournament.decklists.cards.map(card => (
                    <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#3d7fff', fontFamily: 'monospace' }}>{card.count}×</span>
                        <span style={{ fontSize: 13, color: '#f0f2f5' }}>{card.name ?? card.id}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#3a4560', fontFamily: 'monospace' }}>{card.id}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#3a4560', textAlign: 'center', padding: '20px 0' }}>No decklist attached.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DeckPanel({ decklist }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  if (!decklist) return null
  const cards = decklist.cards ?? []

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
  if (!session) return
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
        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#3d7fff', flexShrink: 0, marginTop: 2, overflow: 'hidden' }}>
          {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#1c2333', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f2f5', marginBottom: 3 }}>{comment.profiles?.username ?? 'Unknown'}</div>
            <div style={{ fontSize: 13, color: '#b0bac8', lineHeight: 1.5 }}>{comment.body}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 2, alignItems: 'center' }}>
            <button onClick={toggleLike} style={{ fontSize: 11, fontWeight: 600, color: liked ? '#f05252' : '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>♥ {likes}</button>
            {depth < 2 && <button onClick={() => setShowReply(!showReply)} style={{ fontSize: 11, fontWeight: 600, color: showReply ? '#3d7fff' : '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{showReply ? 'Cancel' : 'Reply'}</button>}
            <span style={{ fontSize: 11, color: '#3a4560' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          {showReply && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input type="text" placeholder={`Reply to ${comment.profiles?.username ?? 'comment'}...`} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitReply()} autoFocus style={{ flex: 1, background: '#161b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 10px', color: '#f0f2f5', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={submitReply} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#3d7fff', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Post</button>
            </div>
          )}
          {replies.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 4, borderLeft: '2px solid rgba(61,127,255,0.15)' }}>
              {replies.map(r => <CommentBox key={r.id} comment={r} session={session} depth={depth + 1} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, session, onProfileClick }) {
  const [expanded, setExpanded] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes ?? 0)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

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
    if (!session) return
    if (liked) {
      await supabase.from('post_likes').delete().match({ user_id: session.user.id, post_id: post.id })
      await supabase.from('posts').update({ likes: likes - 1 }).eq('id', post.id)
      setLikes(likes - 1); setLiked(false)
    } else {
      const { error } = await supabase.from('post_likes').insert({ user_id: session.user.id, post_id: post.id })
      if (!error) {
        await supabase.from('posts').update({ likes: likes + 1 }).eq('id', post.id)
        setLikes(likes + 1); setLiked(true)
      }
    }
  }

  return (
    <div style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          onClick={() => post.profiles && onProfileClick?.(post.profiles)}
          style={{ width: 36, height: 36, borderRadius: 9, background: '#3d7fff22', border: '1px solid #3d7fff44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#3d7fff', flexShrink: 0, overflow: 'hidden', cursor: post.profiles ? 'pointer' : 'default' }}
        >
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div>
          <div
            onClick={() => post.profiles && onProfileClick?.(post.profiles)}
            style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5', cursor: post.profiles ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (post.profiles) e.currentTarget.style.color = '#3d7fff' }}
            onMouseLeave={e => e.currentTarget.style.color = '#f0f2f5'}
          >
            {post.profiles?.username ?? 'Unknown'}
          </div>
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
        <button onClick={() => setShowComments(!showComments)} style={{ fontSize: 13, fontWeight: 600, color: '#6b7a99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          💬 {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#3d7fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
          {myInitials}
        </div>
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
      try { const data = await searchLeaders(val); setLeaderResults(data.slice(0, 8)) }
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
    let decklistId = null
    if (leaderResult && parsedCards.length > 0) {
      const { data: dl } = await supabase.from('decklists').insert({ user_id: session.user.id, name: deckName || `${leaderResult.card_name} Deck`, leader_id: leaderResult.card_set_id, leader_name: leaderResult.card_name, leader_color: leaderResult.card_color, cards: parsedCards }).select().single()
      if (dl) decklistId = dl.id
    }
    const { data: post } = await supabase.from('posts').insert({ user_id: session.user.id, title: title.trim(), body: body.trim(), decklist_id: decklistId }).select('*, profiles!posts_user_id_fkey(*), decklists(*)').single()
    if (post) onSubmit(post)
    setSaving(false); onClose()
  }

  const inputStyle = { width: '100%', background: '#1c2333', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '9px 12px', color: '#f0f2f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7a99', marginBottom: 6, display: 'block' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, width: 620, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f2f5' }}>Create Post</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6b7a99', fontSize: 16, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={labelStyle}>Title</label><input type="text" placeholder="Give your post a title..." value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Body</label><textarea placeholder="Share your thoughts..." value={body} onChange={e => setBody(e.target.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} /></div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#3a4560', marginBottom: 14 }}>Attach Decklist (optional)</div>
            <div style={{ marginBottom: 12 }}><label style={labelStyle}>Deck Name</label><input type="text" placeholder="e.g. Red Luffy Aggro v3" value={deckName} onChange={e => setDeckName(e.target.value)} style={inputStyle} /></div>
            <div ref={leaderRef} style={{ position: 'relative', marginBottom: 12 }}>
              <label style={labelStyle}>Leader Card</label>
              {leaderResult ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1c2333', border: '1px solid #3d7fff44', borderRadius: 8, padding: '8px 12px' }}>
                  <img src={getCardImageUrl(leaderResult.card_set_id)} alt={leaderResult.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{leaderResult.card_name}</div>
                    <div style={{ fontSize: 11, color: COLORS[leaderResult.card_color] ?? '#6b7a99' }}>{leaderResult.card_color} · {leaderResult.card_set_id}</div>
                  </div>
                  <button onClick={() => { setLeaderResult(null); setLeaderQuery('') }} style={{ background: 'none', border: 'none', color: '#6b7a99', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                </div>
              ) : (
                <>
                  <input type="text" placeholder="Search by name or ID..." value={leaderQuery} onChange={handleLeaderQuery} onFocus={() => leaderQuery.length >= 2 && setLeaderOpen(true)} style={inputStyle} />
                  {leaderOpen && leaderQuery.length >= 2 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c2333', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 260, overflowY: 'auto' }}>
                      {leaderSearching ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#6b7a99' }}>Searching...</div>
                        : leaderResults.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#3a4560' }}>No leaders found</div>
                        : leaderResults.map(card => (
                          <div key={card.card_set_id} onClick={() => { setLeaderResult(card); setLeaderQuery(''); setLeaderOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <img src={getCardImageUrl(card.card_set_id)} alt={card.card_name} style={{ width: 32, height: 44, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>{card.card_name}</div>
                              <div style={{ fontSize: 11, color: COLORS[card.card_color] ?? '#6b7a99', marginTop: 2 }}>{card.card_color} · {card.card_set_id}</div>
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
              <button onClick={handleParseDeck} disabled={!decklistRaw.trim() || enriching} style={{ marginTop: 8, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: decklistRaw.trim() ? 'rgba(255,255,255,0.05)' : 'transparent', color: decklistRaw.trim() ? '#f0f2f5' : '#3a4560', fontSize: 13, fontWeight: 600, cursor: decklistRaw.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {enriching ? 'Fetching card data...' : 'Preview Decklist'}
              </button>
            </div>
            {deckParsed && parsedCards.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3a4560', marginBottom: 8 }}>{parsedCards.reduce((s, c) => s + c.count, 0)} cards parsed</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {parsedCards.flatMap(card => Array.from({ length: card.count }, (_, i) => (
                    <img key={`${card.id}-${i}`} src={getCardImageUrl(card.id)} alt={card.name} style={{ width: 52, borderRadius: 4, border: `2px solid ${COLORS[card.color] ?? 'rgba(255,255,255,0.08)'}` }} onError={e => { e.target.style.opacity = '0.2' }} />
                  )))}
                </div>
              </div>
            )}
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
  const [selectedProfile, setSelectedProfile] = useState(null)

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*, profiles!posts_user_id_fkey(*), decklists(*)').order(filter === 'top' ? 'likes' : 'created_at', { ascending: false })
    setPosts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [filter])

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
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? '#3d7fff' : 'transparent', color: filter === f ? '#fff' : '#6b7a99', transition: 'all 0.1s', textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#3d7fff', color: '#fff', fontFamily: 'inherit' }}>+ Create Post</button>
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
          {posts.map(post => <PostCard key={post.id} post={post} session={session} onProfileClick={setSelectedProfile} />)}
        </div>
      )}

      {showCreate && <CreatePostModal session={session} onClose={() => setShowCreate(false)} onSubmit={() => { setShowCreate(false); loadPosts() }} />}
      {selectedProfile && session && <ProfileModal profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} />}
    </div>
  )
}