// Read-only render of a decklistEmbed TipTap node — RN counterpart to
// src/components/articles/DecklistEmbedView.jsx.
import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, Modal } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { getCardImageUrl } from '../../lib/optcgapi'
import { decklistToText } from '../../lib/articles'
import { colors, radius, font } from '../../theme'
import { LEADER_COLORS } from '../forms'

export default function DecklistEmbedView({ node }) {
  const { name, leaderId, leaderName, leaderColor, cards } = node.attrs ?? {}
  const [copied, setCopied] = useState(false)
  const [enlarged, setEnlarged] = useState(null)
  const accent = LEADER_COLORS[leaderColor] ?? colors.ocean
  const total = (cards ?? []).reduce((s, c) => s + (c.count ?? 0), 0)

  async function copyList() {
    await Clipboard.setStringAsync(decklistToText(cards))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <View style={{ marginVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        {leaderId ? (
          <Image source={{ uri: getCardImageUrl(leaderId) }} style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: font.display, color: colors.text }}>{name || 'Decklist'}</Text>
          <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>
            {leaderName ? `${leaderName} · ${leaderId} · ` : ''}{total} cards
          </Text>
        </View>
        <TouchableOpacity onPress={copyList} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 7, backgroundColor: 'rgba(140,176,208,0.06)', borderWidth: 1, borderColor: colors.line }}>
          <Text style={{ fontSize: 11, fontFamily: font.semi, color: copied ? colors.emerald : colors.muted }}>{copied ? '✓ Copied' : 'Copy List'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 2, backgroundColor: accent }} />

      {/* Card grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 }}>
        {(cards ?? []).map(c => (
          <TouchableOpacity key={c.id} onPress={() => setEnlarged(c)} style={{ position: 'relative' }}>
            <Image source={{ uri: getCardImageUrl(c.id) }} style={{ width: 60, height: 84, borderRadius: 6, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
            <View style={{ position: 'absolute', bottom: 4, right: 4, minWidth: 18, height: 18, borderRadius: 5, backgroundColor: 'rgba(6,16,27,0.88)', borderWidth: 1, borderColor: colors.goldLine, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: font.mono, color: colors.gold }}>×{c.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {enlarged ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEnlarged(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setEnlarged(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Image source={{ uri: getCardImageUrl(enlarged.id) }} style={{ width: 300, maxWidth: '100%', aspectRatio: 0.716, borderRadius: 14 }} resizeMode="contain" />
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  )
}
