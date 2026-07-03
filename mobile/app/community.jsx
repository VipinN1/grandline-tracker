// RN port of src/pages/Community.jsx — Posts feed + Messages tab.
// Create-post supports attaching a saved decklist (paste-a-list stays web-only).
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Image, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { getCardImageUrl } from '../lib/optcgapi'
import { colors, font, radius, card } from '../theme'
import { fieldInput, FieldLabel, LEADER_COLORS } from '../components/forms'
import SelectDecklistModal from '../components/SelectDecklistModal'
import ProfileCard, { Avatar } from '../components/ProfileCard'
import DirectMessages from '../components/DirectMessages'
import { GlassButton } from '../components/glass'

function CardLightbox({ url, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Image source={{ uri: url }} style={{ width: '90%', height: '75%' }} resizeMode="contain" />
      </TouchableOpacity>
    </Modal>
  )
}

// Expandable decklist attached to a post.
function DeckPanel({ decklist }) {
  const [expanded, setExpanded] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  if (!decklist) return null
  const cards = decklist.cards ?? []

  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(140,176,208,0.03)' }}>
        <Image source={{ uri: getCardImageUrl(decklist.leader_id) }} style={{ width: 32, height: 44, borderRadius: 4 }} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{decklist.name}</Text>
          <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{decklist.leader_name} · {decklist.leader_id}</Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{expanded ? '▲ Hide' : '▼ View deck'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{ padding: 14, backgroundColor: 'rgba(140,176,208,0.05)' }}>
          <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 10 }}>
            {cards.reduce((s, c) => s + c.count, 0)} cards · tap to enlarge
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cards.flatMap(c =>
              Array.from({ length: c.count }, (_, i) => (
                <TouchableOpacity key={`${c.id}-${i}`} onPress={() => setLightbox(getCardImageUrl(c.id))}>
                  <Image source={{ uri: getCardImageUrl(c.id) }} style={{ width: 56, height: 78, borderRadius: 5 }} resizeMode="cover" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}
      {lightbox && <CardLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </View>
  )
}

function CommentBox({ comment, session, depth = 0, onProfileClick }) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(comment.likes ?? 0)
  const [replies, setReplies] = useState([])

  useEffect(() => {
    async function init() {
      if (session) {
        const { data } = await supabase.from('comment_likes').select('user_id').eq('comment_id', comment.id).eq('user_id', session.user.id).maybeSingle()
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
      setLikes(prev => prev - 1); setLiked(false)
    } else {
      const { error } = await supabase.from('comment_likes').insert({ user_id: session.user.id, comment_id: comment.id })
      if (!error) {
        await supabase.rpc('increment_comment_likes', { comment_id: comment.id })
        setLikes(prev => prev + 1); setLiked(true)
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
    <View style={{ marginLeft: depth > 0 ? 20 : 0, marginTop: depth > 0 ? 8 : 0 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => comment.profiles && onProfileClick?.(comment.profiles)} style={{ marginTop: 2 }}>
          <Avatar profile={comment.profiles} size={26} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ backgroundColor: 'rgba(140,176,208,0.03)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.text, marginBottom: 3 }}>{comment.profiles?.username ?? 'Unknown'}</Text>
            <Text style={{ fontSize: 13, color: '#b0bac8', lineHeight: 19, fontFamily: font.body }}>{comment.body}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center' }}>
            <TouchableOpacity onPress={toggleLike}>
              <Text style={{ fontSize: 11, fontFamily: font.semi, color: liked ? colors.crimson : colors.muted }}>♥ {likes}</Text>
            </TouchableOpacity>
            {depth < 2 && session ? (
              <TouchableOpacity onPress={() => setShowReply(r => !r)}>
                <Text style={{ fontSize: 11, fontFamily: font.semi, color: showReply ? colors.ocean : colors.muted }}>{showReply ? 'Cancel' : 'Reply'}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>{new Date(comment.created_at).toLocaleDateString()}</Text>
          </View>
          {showReply && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <TextInput
                placeholder={`Reply to ${comment.profiles?.username ?? 'comment'}...`}
                placeholderTextColor={colors.faint}
                value={replyText}
                onChangeText={setReplyText}
                onSubmitEditing={submitReply}
                autoFocus
                style={{ flex: 1, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, borderRadius: 7, paddingVertical: 6, paddingHorizontal: 10, color: colors.text, fontSize: 12, fontFamily: font.body }}
              />
              <GlassButton onPress={submitReply} tint={colors.ocean} pad={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontFamily: font.semi }}>Post</Text>
              </GlassButton>
            </View>
          )}
          {replies.length > 0 && (
            <View style={{ marginTop: 8, paddingLeft: 4, borderLeftWidth: 2, borderLeftColor: 'rgba(140,176,208,0.2)' }}>
              {replies.map(r => <CommentBox key={r.id} comment={r} session={session} depth={depth + 1} onProfileClick={onProfileClick} />)}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

function PostCard({ post, session, onProfileClick, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes ?? 0)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)

  useEffect(() => {
    async function init() {
      if (session) {
        const { data } = await supabase.from('post_likes').select('user_id').eq('post_id', post.id).eq('user_id', session.user.id).maybeSingle()
        if (data) setLiked(true)
      }
      const { data } = await supabase.from('comments').select('*, profiles!comments_user_id_fkey(*)').eq('post_id', post.id).is('parent_id', null).order('created_at', { ascending: true })
      setComments(data ?? [])
    }
    init()
  }, [post.id])

  async function submitComment() {
    if (!commentText.trim() || !session) return
    const { data } = await supabase.from('comments').insert({ post_id: post.id, user_id: session.user.id, body: commentText.trim() }).select('*, profiles!comments_user_id_fkey(*)').single()
    if (data) { setComments(prev => [...prev, data]); setShowComments(true) }
    setCommentText('')
  }

  async function toggleLike() {
    if (!session) return
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

  function confirmDelete() {
    Alert.alert('Delete post', 'Delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('posts').delete().eq('id', post.id)
          onDelete?.(post.id)
        },
      },
    ])
  }

  return (
    <View style={{ ...card, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => post.profiles && onProfileClick?.(post.profiles)}>
          <Avatar profile={post.profiles} size={36} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => post.profiles && onProfileClick?.(post.profiles)}>
            <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{post.profiles?.username ?? 'Unknown'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>
            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        {session?.user?.id === post.user_id && (
          <TouchableOpacity onPress={confirmDelete} hitSlop={6} style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.lineStrong }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, color: '#94a3b8' }}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text, marginBottom: 8 }}>{post.title}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 22, fontFamily: font.body }}>
        {expanded ? post.body : post.body.slice(0, 180) + (post.body.length > 180 ? '...' : '')}
      </Text>
      {post.body.length > 180 && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)}>
          <Text style={{ color: colors.ocean, fontSize: 13, fontFamily: font.semi, marginTop: 2 }}>{expanded ? 'less' : 'more'}</Text>
        </TouchableOpacity>
      )}

      {post.decklists ? <DeckPanel decklist={post.decklists} /> : null}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.05)', alignItems: 'center' }}>
        <TouchableOpacity onPress={toggleLike}>
          <Text style={{ fontSize: 13, fontFamily: font.semi, color: liked ? colors.crimson : colors.muted }}>♥ {likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowComments(s => !s)}>
          <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>
            💬 {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      </View>

      {session ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TextInput
            placeholder="Write a comment..."
            placeholderTextColor={colors.faint}
            value={commentText}
            onChangeText={setCommentText}
            onSubmitEditing={submitComment}
            style={{ flex: 1, backgroundColor: 'rgba(26,50,81,0.92)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
          />
          <GlassButton onPress={submitComment} tint={colors.ocean} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontFamily: font.semi }}>Post</Text>
          </GlassButton>
        </View>
      ) : null}

      {showComments && (
        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.05)', gap: 12 }}>
          {comments.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>No comments yet. Be the first!</Text>
          ) : (
            comments.map(c => <CommentBox key={c.id} comment={c} session={session} onProfileClick={onProfileClick} />)
          )}
        </View>
      )}
    </View>
  )
}

function CreatePostModal({ session, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectingDecklist, setSelectingDecklist] = useState(false)
  const [attachedDecklist, setAttachedDecklist] = useState(null)

  async function handleSubmit() {
    if (!title.trim() || !body.trim() || !session) return
    setSaving(true)
    const { data: post } = await supabase.from('posts')
      .insert({ user_id: session.user.id, title: title.trim(), body: body.trim(), decklist_id: attachedDecklist?.id ?? null })
      .select('*, profiles!posts_user_id_fkey(*), decklists(*)')
      .single()
    setSaving(false)
    if (post) onSubmit(post)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0d1a2b', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%', borderWidth: 1, borderColor: colors.lineStrong }}>
          <View style={{ paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>Create Post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View>
              <FieldLabel>Title</FieldLabel>
              <TextInput placeholder="Give your post a title..." placeholderTextColor={colors.faint} value={title} onChangeText={setTitle} style={fieldInput} />
            </View>
            <View>
              <FieldLabel>Body</FieldLabel>
              <TextInput placeholder="Share your thoughts..." placeholderTextColor={colors.faint} value={body} onChangeText={setBody} multiline style={{ ...fieldInput, minHeight: 100, textAlignVertical: 'top' }} />
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.05)', paddingTop: 16 }}>
              <Text style={{ fontSize: 12, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1, color: colors.faint, marginBottom: 12 }}>Attach Decklist (optional)</Text>
              {attachedDecklist ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(140,176,208,0.08)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.25)', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Image source={{ uri: getCardImageUrl(attachedDecklist.leader_id) }} style={{ width: 28, height: 38, borderRadius: 4 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{attachedDecklist.name}</Text>
                    <Text style={{ fontSize: 11, color: LEADER_COLORS[attachedDecklist.leader_color] ?? colors.muted, marginTop: 2, fontFamily: font.body }}>
                      {attachedDecklist.leader_name} · {attachedDecklist.leader_id}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setAttachedDecklist(null)} hitSlop={8}>
                    <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setSelectingDecklist(true)} style={{ paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(200,162,74,0.3)', backgroundColor: 'rgba(140,176,208,0.08)', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.oceanBright }}>Attach Decklist From Account</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
          <View style={{ paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.07)' }}>
            <TouchableOpacity onPress={handleSubmit} disabled={saving || !title.trim() || !body.trim()} style={{ paddingVertical: 11, borderRadius: radius.sm, backgroundColor: saving || !title.trim() || !body.trim() ? '#3a526a' : colors.ocean, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontFamily: font.bold }}>{saving ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <SelectDecklistModal session={session} visible={selectingDecklist} onClose={() => setSelectingDecklist(false)} onSelect={deck => setAttachedDecklist(deck)} />
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function Community() {
  const { session } = useSession()
  const { dm } = useLocalSearchParams()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('latest')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [tab, setTab] = useState(dm ? 'messages' : 'posts')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*, profiles!posts_user_id_fkey(*), decklists(*)').order(filter === 'top' ? 'likes' : 'created_at', { ascending: false })
    setPosts(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { loadPosts() }, [loadPosts])

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Community',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <View style={{ flex: 1, backgroundColor: colors.abyss, paddingHorizontal: 16 }}>
        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 12 }}>
          {[['posts', 'Posts'], ['messages', 'Messages']].map(([key, label]) => {
            const active = tab === key
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setTab(key)}
                style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: radius.sm, borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong, backgroundColor: active ? colors.goldSoft : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {tab === 'messages' ? (
          <DirectMessages session={session} initialUserId={dm ?? null} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={p => p.id}
            contentContainerStyle={{ paddingBottom: 48, gap: 12 }}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 4, backgroundColor: 'rgba(140,176,208,0.05)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 4 }}>
                  {['latest', 'top'].map(f => (
                    <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{ paddingVertical: 5, paddingHorizontal: 14, borderRadius: 6, backgroundColor: filter === f ? colors.ocean : 'transparent' }}>
                      <Text style={{ fontSize: 12, fontFamily: font.semi, color: filter === f ? '#fff' : colors.muted, textTransform: 'capitalize' }}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <GlassButton onPress={() => setShowCreate(true)} tint={colors.ocean} pad={{ paddingVertical: 8, paddingHorizontal: 16 }} style={{ marginLeft: 'auto' }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#fff' }}>+ Create Post</Text>
                </GlassButton>
              </View>
            }
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={colors.gold} style={{ padding: 60 }} />
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 70 }}>
                  <Text style={{ fontSize: 40, marginBottom: 16 }}>💬</Text>
                  <Text style={{ fontSize: 15, fontFamily: font.semi, color: colors.muted, marginBottom: 6 }}>No posts yet</Text>
                  <Text style={{ fontSize: 13, color: colors.faint, fontFamily: font.body }}>Be the first to post in the community</Text>
                </View>
              )
            }
            renderItem={({ item: post }) => (
              <PostCard
                post={post}
                session={session}
                onProfileClick={setSelectedProfile}
                onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
              />
            )}
          />
        )}

        {showCreate && <CreatePostModal session={session} onClose={() => setShowCreate(false)} onSubmit={() => loadPosts()} />}
        {selectedProfile && <ProfileCard profile={selectedProfile} session={session} onClose={() => setSelectedProfile(null)} />}
      </View>
    </>
  )
}
