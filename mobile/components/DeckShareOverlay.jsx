// RN port of src/components/DeckShareOverlay.jsx — a shareable "screenshot
// card" for a decklist: leader header, card grid, cost curve, type/color
// breakdown. Mirrors the tournament share card's visual signature (gold
// brand line, PirateTracker footer) via the same lib/shareImage helper.
// Note: unlike the web version, this doesn't reproduce the giant
// auto-shrinking "ghosted" leader-name watermark behind the header — that
// effect relies on iterative DOM text measurement that doesn't have a clean
// RN equivalent; the card is fully functional and on-brand without it.
import { useState, useRef } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native'
import { getCardImageUrl } from '../lib/optcgapi'
import { captureAndShare } from '../lib/shareImage'
import { colors, font, radius } from '../theme'
import { LEADER_COLORS } from './forms'

function computeDeckStats(cards) {
  const costBuckets = {}
  let charCount = 0, eventCount = 0, stageCount = 0
  const colorCounts = {}
  for (const c of cards) {
    if (c.cost != null) {
      const bucket = Math.min(c.cost, 10)
      costBuckets[bucket] = (costBuckets[bucket] ?? 0) + c.count
    }
    if (c.type === 'Character') charCount += c.count
    else if (c.type === 'Event') eventCount += c.count
    else if (c.type === 'Stage') stageCount += c.count
    if (c.color) {
      for (const col of c.color.split(/[\s/]+/).filter(Boolean)) {
        colorCounts[col] = (colorCounts[col] ?? 0) + c.count
      }
    }
  }
  return { costBuckets, charCount, eventCount, stageCount, colorCounts }
}

export default function DeckShareOverlay({ deck, onClose }) {
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const cardRef = useRef(null)

  const cards = deck.cards ?? []
  const totalCards = cards.reduce((s, c) => s + c.count, 0)
  const stats = computeDeckStats(cards)
  const maxCostCount = Math.max(1, ...Object.values(stats.costBuckets))
  const color = LEADER_COLORS[(deck.leader_color ?? '').split(/[\s/]+/)[0]?.trim()] ?? colors.ocean

  async function handleShare() {
    setShareError('')
    setSharing(true)
    try {
      await captureAndShare(cardRef, {
        fileName: `${(deck.name ?? 'decklist').replace(/[^\w\- ]+/g, '').trim() || 'decklist'}.png`,
        title: deck.name,
        text: 'Check out my decklist on PirateTracker!',
      })
    } catch {
      setShareError('Could not generate the image. Try again.')
    }
    setSharing(false)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.abyss }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, paddingTop: 50, paddingBottom: 40 }}>
          <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>📸 Screenshot to share</Text>
          <Text style={{ fontSize: 11, color: colors.faint, marginTop: 3, marginBottom: 16 }}>Only the card below is captured</Text>

          <View
            ref={cardRef}
            collapsable={false}
            style={{ width: '100%', maxWidth: 420, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.goldLine, backgroundColor: colors.abyss }}
          >
            {/* Header */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <View style={{ height: 2, backgroundColor: color }} />
              <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center', padding: 16 }}>
                <Image
                  source={{ uri: getCardImageUrl(deck.leader_id) }}
                  style={{ width: 58, height: 58 * (88 / 63), borderRadius: 8, borderWidth: 2, borderColor: color }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, fontFamily: font.bold, color: colors.text }}>{deck.name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: font.body }}>
                    {deck.leader_name} · {deck.leader_id}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: font.mono, color: colors.gold, marginTop: 9 }}>{totalCards} cards</Text>
                </View>
              </View>
            </View>

            {/* Brand bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 18, backgroundColor: 'rgba(140,176,208,0.06)', borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Text style={{ fontSize: 12, fontFamily: font.bold, color: colors.ocean }}>PirateTracker</Text>
              <Text style={{ fontSize: 9.5, color: colors.faint }}>piratetracker.vercel.app</Text>
            </View>

            {/* Card grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 14 }}>
              {cards.map(c => (
                <View key={c.id} style={{ position: 'relative' }}>
                  <Image source={{ uri: getCardImageUrl(c.id) }} style={{ width: 52, height: 52 * 1.4, borderRadius: 5, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
                  <View style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: 'rgba(6,16,27,0.88)', borderWidth: 1, borderColor: colors.goldLine, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, fontFamily: font.mono, color: colors.gold }}>×{c.count}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Stats footer */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 6 }}>
              <Text style={{ fontSize: 9, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.faint, marginBottom: 6 }}>Cost Curve</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48, marginBottom: 12 }}>
                {Array.from({ length: 11 }, (_, cost) => {
                  const n = stats.costBuckets[cost] ?? 0
                  return (
                    <View key={cost} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      {n > 0 ? <Text style={{ fontSize: 8, fontFamily: font.mono, color: colors.oceanBright, marginBottom: 2 }}>{n}</Text> : null}
                      <View style={{ width: '100%', height: Math.max(n > 0 ? 6 : 0, (n / maxCostCount) * 32), backgroundColor: n > 0 ? colors.ocean : 'transparent', borderRadius: 2 }} />
                      <Text style={{ fontSize: 7.5, color: colors.faint, marginTop: 3, fontFamily: font.mono }}>{cost}</Text>
                    </View>
                  )
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[['Character', stats.charCount], ['Event', stats.eventCount], ['Stage', stats.stageCount]].map(([label, value]) => (
                  <View key={label} style={{ flex: 1, backgroundColor: 'rgba(140,176,208,0.04)', borderRadius: 8, paddingVertical: 7, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontFamily: font.mono, color: colors.text }}>{value}</Text>
                    <Text style={{ fontSize: 8.5, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>

              {Object.keys(stats.colorCounts).length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([col, n]) => (
                    <View key={col} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(140,176,208,0.04)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: LEADER_COLORS[col] ?? colors.faint }} />
                      <Text style={{ fontSize: 10, color: colors.muted, fontFamily: font.mono }}>{n}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <TouchableOpacity
              onPress={handleShare}
              disabled={sharing}
              style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: sharing ? 'rgba(200,162,74,0.08)' : 'rgba(200,162,74,0.12)' }}
            >
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.gold }}>{sharing ? 'Generating...' : '📤 Share / Save Image'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.05)' }}>
              <Text style={{ fontSize: 13, fontFamily: font.semi, color: colors.muted }}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          {shareError ? <Text style={{ marginTop: 10, fontSize: 12, color: colors.crimson }}>{shareError}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  )
}
