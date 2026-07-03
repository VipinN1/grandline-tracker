import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, useWindowDimensions } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { getCardImageUrl } from '../lib/optcgapi'
import { colors, font, radius } from '../theme'
import { LEADER_COLORS } from './forms'

function CardPreview({ card, onClose }) {
  const { width } = useWindowDimensions()
  const w = Math.min(300, width * 0.85)
  if (!card) return null
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Image source={{ uri: getCardImageUrl(card.id) }} style={{ width: w, height: w * 1.4, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(140,176,208,0.15)' }} resizeMode="contain" />
        <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text, marginTop: 14 }}>{card.name ?? card.id}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.mono }}>{card.id}</Text>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 14, backgroundColor: 'rgba(140,176,208,0.08)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 24 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontFamily: font.semi }}>Close</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

export default function DeckModal({ deck, onClose }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [copied, setCopied] = useState(false)
  if (!deck) return null

  const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
  const cards = deck.cards ?? []
  const grouped = [
    ['Characters', cards.filter(c => c.type === 'Character')],
    ['Events', cards.filter(c => c.type === 'Event')],
    ['Stages', cards.filter(c => c.type === 'Stage')],
    ['Other', cards.filter(c => !['Character', 'Event', 'Stage'].includes(c.type))],
  ]

  async function copyDecklist() {
    const lines = [`Leader: ${deck.leader_id}`, ...cards.map(c => `${c.count}x${c.id}`)]
    await Clipboard.setStringAsync(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0d1a2b', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%', borderWidth: 1, borderColor: colors.lineStrong }}>
          {/* Header */}
          <View style={{ height: 110, overflow: 'hidden', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(6,16,27,0.55)' }} />
            <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
            <View style={{ position: 'absolute', bottom: 12, left: 20 }}>
              <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>{deck.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted, fontFamily: font.body }}>{deck.leader_name} · {deck.leader_id}</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: color }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 10 }}>
              All Cards ({cards.reduce((s, c) => s + c.count, 0)}) — tap to enlarge
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {cards.flatMap(card =>
                Array.from({ length: card.count }, (_, i) => (
                  <TouchableOpacity key={`${card.id}-${i}`} onPress={() => setSelectedCard(card)}>
                    <Image source={{ uri: getCardImageUrl(card.id) }} style={{ width: 56, height: 78, borderRadius: 6, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
                  </TouchableOpacity>
                ))
              )}
            </View>

            {grouped.map(([label, group]) =>
              group.length > 0 ? (
                <View key={label} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.05)' }}>
                    {label} ({group.reduce((s, c) => s + c.count, 0)})
                  </Text>
                  {group.map(card => (
                    <TouchableOpacity key={card.id} onPress={() => setSelectedCard(card)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: font.mono, color: colors.ocean, minWidth: 24 }}>{card.count}×</Text>
                        <Text numberOfLines={1} style={{ fontSize: 13, color: colors.text, fontFamily: font.body, flexShrink: 1 }}>{card.name ?? card.id}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{card.id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            )}
          </ScrollView>

          <View style={{ paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.07)' }}>
            <TouchableOpacity onPress={copyDecklist} style={{ paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.04)', alignItems: 'center' }}>
              <Text style={{ color: copied ? colors.emerald : colors.text, fontSize: 13, fontFamily: font.semi }}>{copied ? 'Copied!' : 'Copy Decklist'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {selectedCard && <CardPreview card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </Modal>
  )
}
