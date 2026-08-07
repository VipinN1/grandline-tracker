// RN port of src/pages/ArticlesPage.jsx — dev logs + community articles feed.
import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, ScrollView } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { CATEGORIES, categoryLabel } from '../../lib/articles'
import { colors, font, radius, card, status as statusTheme, badge, btnPrimary, btnPrimaryText } from '../../theme'

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
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const FULL_SELECT = 'id, title, slug, category, excerpt, cover_card_id, status, published_at, updated_at, author_id, profiles!articles_author_id_fkey(username, avatar_url), article_likes(count), article_comments(count)'
const BASIC_SELECT = 'id, title, slug, category, excerpt, cover_card_id, status, published_at, updated_at, author_id, profiles!articles_author_id_fkey(username, avatar_url)'

export default function ArticlesPage() {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const { filter: filterParam } = useLocalSearchParams()
  // router.setParams keeps the key with an empty string rather than removing
  // it, so fall back on falsy (not just nullish) here.
  const filter = filterParam === 'mine' && !session ? 'all' : (filterParam || 'all')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
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
    let { data, error } = await fetchArticles(FULL_SELECT)
    if (error) ({ data } = await fetchArticles(BASIC_SELECT))
    setArticles(data ?? [])
    setLoading(false)
  }, [filter, session])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const filters = [
    { value: 'all', label: 'All' },
    ...(session ? [{ value: 'mine', label: '✍ My Articles' }] : []),
    ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
  ]

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Articles',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      {loading ? (
        <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: colors.abyss }}
          data={articles}
          keyExtractor={a => a.id}
          contentContainerStyle={{ padding: 16, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 48, gap: 12 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 }}>The Grand Log</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.text }}>Articles</Text>
                <TouchableOpacity onPress={() => router.push(session ? '/articles/new' : '/login')} style={{ ...btnPrimary, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <Text style={{ ...btnPrimaryText, fontSize: 12.5 }}>✍ Write</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body, marginBottom: 14 }}>Dev logs, deck guides and strategy from the crew. Anyone can write one.</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {filters.map(f => {
                  const active = filter === f.value
                  return (
                    <TouchableOpacity
                      key={f.value}
                      onPress={() => router.setParams({ filter: f.value === 'all' ? '' : f.value })}
                      style={{ paddingVertical: 6, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? colors.goldLine : colors.line, backgroundColor: active ? colors.goldSoft : 'transparent' }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{f.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 34, marginBottom: 12 }}>📜</Text>
              <Text style={{ fontSize: 14, fontFamily: font.semi, color: colors.muted, marginBottom: 4 }}>
                {filter === 'mine' ? "You haven't written anything yet." : 'No articles here yet.'}
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.faint, fontFamily: font.body }}>Be the first to chart these waters.</Text>
            </View>
          }
          renderItem={({ item: a }) => {
            const catStyle = CATEGORY_STYLE[a.category] ?? statusTheme.completed
            const likeCount = a.article_likes?.[0]?.count ?? 0
            const commentCount = a.article_comments?.[0]?.count ?? 0
            const b = badge(catStyle)
            return (
              <TouchableOpacity
                onPress={() => {
                  if (filter === 'mine' && a.status === 'draft') router.push(`/articles/edit/${a.id}`)
                  else router.push(`/articles/${a.slug}`)
                }}
                style={{ ...card, overflow: 'hidden' }}
              >
                <View style={{ height: 120, backgroundColor: colors.surface }}>
                  {a.cover_card_id ? (
                    <Image source={{ uri: getCardImageUrl(a.cover_card_id) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 32, opacity: 0.5 }}>📜</Text>
                    </View>
                  )}
                  <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 }}>
                    <View style={b.wrap}><Text style={b.text}>{categoryLabel(a.category)}</Text></View>
                    {filter === 'mine' && a.status === 'draft' ? (
                      <View style={badge(statusTheme.closed).wrap}><Text style={badge(statusTheme.closed).text}>Draft</Text></View>
                    ) : null}
                  </View>
                </View>
                <View style={{ padding: 14, gap: 6 }}>
                  <Text numberOfLines={2} style={{ fontFamily: font.display, fontSize: 16, color: colors.text }}>{a.title}</Text>
                  {a.excerpt ? <Text numberOfLines={2} style={{ fontSize: 12.5, color: colors.muted, fontFamily: font.body, lineHeight: 18 }}>{a.excerpt}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontFamily: font.semi, color: colors.textSoft }}>{a.profiles?.username ?? 'Unknown'}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>{timeAgo(a.published_at ?? a.updated_at)}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>♥ {likeCount}</Text>
                    <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>💬 {commentCount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </>
  )
}
