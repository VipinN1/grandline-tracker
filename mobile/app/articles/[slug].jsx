// RN port of src/pages/ArticlePage.jsx — full article reader with like,
// share, comments, and author/admin actions.
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Share } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { categoryLabel } from '../../lib/articles'
import { colors, font, radius, status as statusTheme, badge, btnGhost, btnGhostText, input as inputStyle } from '../../theme'
import { Avatar } from '../../components/ProfileCard'
import ArticleContent from '../../components/articles/ArticleContent'

const CATEGORY_STYLE = {
  devlog: statusTheme.gold,
  deck_guide: statusTheme.active,
  strategy: statusTheme.open,
  tournament_report: statusTheme.closed,
  news: statusTheme.danger,
  other: statusTheme.completed,
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ArticlePage() {
  const { slug } = useLocalSearchParams()
  const { session } = useSession()

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('username').eq('id', session.user.id).single()
      .then(({ data }) => setIsAdmin(data?.username === 'Cipin'))
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
    if (!session) { router.push('/login'); return }
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
    try { await Share.share({ message: article.title, url: `https://piratetracker.vercel.app/articles/${article.slug}` }) } catch {}
  }

  function report() {
    if (!session || !article) return
    Alert.prompt(
      'Report this article',
      'Why are you reporting this article?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async reason => {
            if (!reason?.trim()) return
            await supabase.from('content_reports').insert({
              reporter_id: session.user.id, content_type: 'article', content_id: article.id,
              content_owner_id: article.author_id, reason: reason.trim(),
            })
            Alert.alert('Reported', 'Thanks — a moderator will take a look.')
          },
        },
      ]
    )
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
    if (!error && data) { setComments(cs => [...cs, data]); setCommentText('') }
  }

  function confirmDeleteComment(comment) {
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('article_comments').delete().eq('id', comment.id)
        if (!error) setComments(cs => cs.filter(c => c.id !== comment.id))
      } },
    ])
  }

  function adminUnpublish() {
    Alert.alert('Unpublish article', 'This article will revert to a draft only the author can see.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpublish', style: 'destructive', onPress: async () => {
        await supabase.from('articles').update({ status: 'draft' }).eq('id', article.id)
        router.replace('/articles')
      } },
    ])
  }

  function adminDelete() {
    Alert.alert('Delete article', 'Delete this article permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('articles').delete().eq('id', article.id)
        router.replace('/articles')
      } },
    ])
  }

  const screenOpts = {
    headerShown: true,
    title: article?.title ?? 'Article',
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: '#08101b' },
    headerTitleStyle: { fontFamily: font.display, fontSize: 15, color: colors.parchment },
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
          <Text style={{ fontSize: 34, marginBottom: 12 }}>🗺</Text>
          <Text style={{ fontSize: 15, fontFamily: font.bold, color: colors.text, marginBottom: 6 }}>This article has sailed away.</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 18, fontFamily: font.body }}>It may have been unpublished or removed.</Text>
          <TouchableOpacity onPress={() => router.replace('/articles')}>
            <Text style={{ color: colors.oceanBright, fontSize: 13, fontFamily: font.semi }}>← Back to Articles</Text>
          </TouchableOpacity>
        </View>
      </>
    )
  }

  const catStyle = CATEGORY_STYLE[article.category] ?? statusTheme.completed
  const b = badge(catStyle)
  const isAuthor = session?.user?.id === article.author_id
  const actionBtn = { ...btnGhost, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }

  return (
    <>
      <Stack.Screen options={screenOpts} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {article.status === 'draft' ? (
          <View style={{ marginBottom: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: 'rgba(224,138,60,0.10)', borderWidth: 1, borderColor: 'rgba(224,138,60,0.35)' }}>
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.orange }}>Draft — only you can see this article.</Text>
          </View>
        ) : null}

        <View style={b.wrap}><Text style={b.text}>{categoryLabel(article.category)}</Text></View>
        <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.text, marginTop: 12, marginBottom: 14, lineHeight: 32 }}>{article.title}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar profile={article.profiles} size={34} rounded />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontFamily: font.bold, color: colors.textSoft }}>{article.profiles?.username ?? 'Unknown'}</Text>
            <Text style={{ fontSize: 11.5, color: colors.faint, fontFamily: font.body }}>{formatDate(article.published_at ?? article.updated_at)}</Text>
          </View>
          {isAuthor ? (
            <TouchableOpacity onPress={() => router.push(`/articles/edit/${article.id}`)} style={actionBtn}>
              <Text style={btnGhostText}>✎ Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isAdmin && !isAuthor ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={adminUnpublish} style={actionBtn}><Text style={btnGhostText}>Unpublish</Text></TouchableOpacity>
            <TouchableOpacity onPress={adminDelete} style={{ ...actionBtn, borderColor: 'rgba(210,74,58,0.34)' }}><Text style={{ ...btnGhostText, color: colors.crimson }}>Delete</Text></TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 1, backgroundColor: colors.goldLine, marginVertical: 22 }} />

        <ArticleContent content={article.content} />

        {/* Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 24, flexWrap: 'wrap' }}>
          <TouchableOpacity onPress={toggleLike} style={{ ...actionBtn, borderColor: liked ? 'rgba(210,74,58,0.4)' : colors.lineStrong, backgroundColor: liked ? 'rgba(210,74,58,0.08)' : 'transparent' }}>
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: liked ? colors.crimson : colors.textSoft }}>{liked ? '♥' : '♡'} {likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={share} style={actionBtn}>
            <Text style={btnGhostText}>⚓ Share</Text>
          </TouchableOpacity>
          {session && !isAuthor ? (
            <TouchableOpacity onPress={report} style={{ ...actionBtn, marginLeft: 'auto' }}>
              <Text style={btnGhostText}>⚑ Report</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ height: 1, backgroundColor: colors.line, marginBottom: 20 }} />

        {/* Comments */}
        <Text style={{ fontFamily: font.display, fontSize: 16, color: colors.text, marginBottom: 14 }}>Comments ({comments.length})</Text>

        {comments.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.faint, marginBottom: 16, fontFamily: font.body }}>No comments yet — be the first to weigh in.</Text>
        ) : null}

        <View style={{ gap: 14, marginBottom: 20 }}>
          {comments.map(c => {
            const canDelete = session && (c.user_id === session.user.id || isAuthor || isAdmin)
            return (
              <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
                <Avatar profile={c.profiles} size={30} rounded />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.textSoft }}>{c.profiles?.username ?? 'Unknown'}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>{formatDate(c.created_at)}</Text>
                    {canDelete ? (
                      <TouchableOpacity onPress={() => confirmDeleteComment(c)} style={{ marginLeft: 'auto' }} hitSlop={6}>
                        <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 20, fontFamily: font.body, marginTop: 2 }}>{c.body}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {session ? (
          article.status === 'published' ? (
            <View>
              <TextInput
                placeholder="Add a comment…"
                placeholderTextColor={colors.faint}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={4000}
                style={{ ...inputStyle, minHeight: 70, textAlignVertical: 'top' }}
              />
              <TouchableOpacity onPress={postComment} disabled={!commentText.trim() || posting} style={{ ...btnGhost, marginTop: 8, paddingVertical: 9, paddingHorizontal: 18, alignSelf: 'flex-start', borderColor: colors.goldLine, opacity: !commentText.trim() || posting ? 0.5 : 1 }}>
                <Text style={{ fontSize: 12.5, fontFamily: font.semi, color: colors.gold }}>{posting ? 'Posting…' : 'Post Comment'}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        ) : (
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>
              <Text style={{ color: colors.oceanBright, fontFamily: font.semi }}>Log in</Text> to like and comment.
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  )
}
