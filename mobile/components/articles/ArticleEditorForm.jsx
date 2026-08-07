// RN port of src/pages/ArticleEditorPage.jsx — shared by the "new article"
// and "edit article" routes. See BlockEditor.jsx for how mobile authoring
// differs from the web TipTap editor.
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { CATEGORIES, slugify, makeExcerpt, firstCardId } from '../../lib/articles'
import { colors, font, radius, input as inputStyle, label as labelStyle, btnPrimary, btnPrimaryText, btnGhost, btnGhostText } from '../../theme'
import BlockEditor from './BlockEditor'
import CardSearchModal from './CardSearchModal'
import { docToBlocks, blocksToDoc, newBlock } from './blockConvert'

export default function ArticleEditorForm({ articleId }) {
  const { session } = useSession()

  const [loading, setLoading] = useState(!!articleId)
  const [article, setArticle] = useState(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [coverCardId, setCoverCardId] = useState(null)
  const [coverModal, setCoverModal] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [blocks, setBlocks] = useState([newBlock('paragraph')])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!session) return
    async function check() {
      const [{ data: profile }, { data: grant }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', session.user.id).single(),
        supabase.from('article_devs').select('user_id').eq('user_id', session.user.id).maybeSingle(),
      ])
      setIsDev(profile?.username === 'Cipin' || !!grant)
    }
    check()
  }, [session])

  useEffect(() => {
    if (!articleId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('articles').select('*').eq('id', articleId).maybeSingle()
      if (cancelled) return
      if (!data || data.author_id !== session.user.id) { router.replace('/articles'); return }
      setArticle(data)
      setTitle(data.title)
      setCategory(data.category)
      setCoverCardId(data.cover_card_id)
      setBlocks(docToBlocks(data.content))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [articleId, session])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3200)
    return () => clearTimeout(t)
  }, [notice])

  async function save(publish) {
    if (!title.trim()) { setError('Give your article a title first.'); return }
    setError(null)
    setSaving(true)

    const content = blocksToDoc(blocks)
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

    let saved, dbError
    if (article) {
      const { data, error: e } = await supabase.from('articles').update(row).eq('id', article.id).select().single()
      saved = data; dbError = e
    } else {
      const { data, error: e } = await supabase.from('articles')
        .insert({ ...row, author_id: session.user.id, slug: slugify(title), status: row.status ?? 'draft' })
        .select().single()
      saved = data; dbError = e
    }

    setSaving(false)
    if (dbError || !saved) { setError(dbError?.message ?? 'Something went wrong saving the article.'); return }

    setArticle(saved)
    if (publish) {
      router.replace(`/articles/${saved.slug}`)
    } else if (!article) {
      router.replace(`/articles/edit/${saved.id}`)
      setNotice('Draft saved ✓ — find it any time under Articles → My Articles.')
    } else {
      setNotice(saved.status === 'published' ? 'Article updated.' : 'Draft saved.')
    }
  }

  function unpublish() {
    if (!article) return
    Alert.alert('Unpublish article', 'This article will revert to a draft only you can see.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpublish', style: 'destructive', onPress: async () => {
          setSaving(true)
          const { data } = await supabase.from('articles').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', article.id).select().single()
          setSaving(false)
          if (data) { setArticle(data); setNotice('Article unpublished — it is now a draft.') }
        },
      },
    ])
  }

  function remove() {
    if (!article) return
    Alert.alert('Delete article', 'Delete this article permanently? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('articles').delete().eq('id', article.id); router.replace('/articles') } },
    ])
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  const published = article?.status === 'published'
  const categories = CATEGORIES.filter(c => !c.devOnly || isDev)

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.abyss }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 }}>The Grand Log</Text>
        <Text style={{ fontFamily: font.display, fontSize: 22, color: colors.text, marginBottom: 16 }}>
          {article ? (published ? 'Edit Article' : 'Edit Draft') : 'Write an Article'}
        </Text>

        {error ? (
          <View style={{ marginBottom: 14, padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(210,74,58,0.10)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.34)' }}>
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.crimson }}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={{ marginBottom: 14, padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(59,178,126,0.10)', borderWidth: 1, borderColor: 'rgba(59,178,126,0.34)' }}>
            <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.emerald }}>{notice}</Text>
          </View>
        ) : null}

        <TextInput
          placeholder="Article title..."
          placeholderTextColor={colors.faint}
          value={title}
          onChangeText={setTitle}
          maxLength={140}
          style={{ fontFamily: font.display, fontSize: 22, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 10, marginBottom: 16 }}
        />

        <Text style={labelStyle}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
          {categories.map(c => {
            const active = category === c.value
            return (
              <TouchableOpacity key={c.value} onPress={() => setCategory(c.value)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? colors.goldLine : colors.line, backgroundColor: active ? colors.goldSoft : 'transparent' }}>
                <Text style={{ fontSize: 12, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{c.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <Text style={labelStyle}>Cover Card</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {coverCardId ? (
            <Image source={{ uri: getCardImageUrl(coverCardId) }} style={{ width: 34, height: 48, borderRadius: 5, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
          ) : null}
          <TouchableOpacity onPress={() => setCoverModal(true)} style={{ ...btnGhost, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ ...btnGhostText, fontSize: 12 }}>{coverCardId ? 'Change' : 'Choose card'}</Text>
          </TouchableOpacity>
          {coverCardId ? (
            <TouchableOpacity onPress={() => setCoverCardId(null)} hitSlop={6}><Text style={{ color: colors.faint, fontSize: 14 }}>✕</Text></TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body, flex: 1 }}>defaults to the first card in your article</Text>
          )}
        </View>

        <BlockEditor blocks={blocks} onChange={setBlocks} />

        <Text style={{ marginTop: 16, marginBottom: 20, fontSize: 11.5, color: colors.faint, lineHeight: 17, fontFamily: font.body }}>
          Mobile uses a simplified block editor — no inline bold/italic/links. Use{' '}
          <Text style={{ color: colors.muted }}>🃏 Card</Text> and <Text style={{ color: colors.muted }}>📜 Decklist</Text> blocks to embed cards and decklists.
        </Text>

        {/* Actions */}
        <View style={{ gap: 8 }}>
          {published ? (
            <>
              <TouchableOpacity onPress={() => save(true)} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                <Text style={btnPrimaryText}>{saving ? 'Saving…' : 'Update'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={unpublish} disabled={saving} style={btnGhost}>
                <Text style={btnGhostText}>Unpublish</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => save(true)} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                <Text style={btnPrimaryText}>{saving ? 'Publishing…' : '⚓ Publish'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => save(false)} disabled={saving} style={btnGhost}>
                <Text style={btnGhostText}>{saving ? 'Saving…' : 'Save Draft'}</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ ...btnGhost, flex: 1 }}>
              <Text style={btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            {article ? (
              <TouchableOpacity onPress={remove} disabled={saving} style={{ ...btnGhost, flex: 1, borderColor: 'rgba(210,74,58,0.34)' }}>
                <Text style={{ ...btnGhostText, color: colors.crimson }}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {coverModal ? (
        <CardSearchModal title="Choose a Cover Card" onClose={() => setCoverModal(false)} onSelect={card => setCoverCardId(card.card_image_id ?? card.card_set_id)} />
      ) : null}
    </KeyboardAvoidingView>
  )
}
