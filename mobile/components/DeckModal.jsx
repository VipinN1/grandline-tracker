// RN port of src/pages/DecklistPage.jsx's content — the same "Deck Stats"
// box (cost curve, type counts, color composition), a card grid with one
// thumbnail per unique card (×count badge, not one image per copy), and the
// grouped card list. Presented as a near-full-screen sheet rather than a
// dedicated route, matching how the rest of the mobile app views decklists.
import { useState, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { getCardImageUrl, enrichCards } from '../lib/optcgapi'
import { computeDeckStats } from '../lib/deckStats'
import { colors, font, radius } from '../theme'
import { LEADER_COLORS } from './forms'
import CardPreview from './CardPreview'
import DeckShareOverlay from './DeckShareOverlay'

// Target thumbnail width the grid aims for — actual width is derived from
// the container's *measured* layout width (not the screen width), so the
// row always divides evenly with no leftover gap on the right.
const GRID_GAP = 8
const TARGET_THUMB_W = 84

export default function DeckModal({ deck, onClose, onEdit }) {
  const { width: screenW } = useWindowDimensions()
  const [gridW, setGridW] = useState(0)
  const [selectedCard, setSelectedCard] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [cards, setCards] = useState(deck?.cards ?? [])

  // Backfill cost/type/color for older saved decks that predate those
  // fields, same as web's DecklistPage — needed for the cost curve chart.
  useEffect(() => {
    if (!deck) return
    setCards(deck.cards ?? [])
    let cancelled = false
    enrichCards(deck.cards ?? []).then(enriched => { if (!cancelled) setCards(enriched) })
    return () => { cancelled = true }
  }, [deck])

  if (!deck) return null

  const color = LEADER_COLORS[deck.leader_color] ?? colors.ocean
  const totalCards = cards.reduce((s, c) => s + c.count, 0)
  const stats = computeDeckStats(cards)
  const maxCostCount = Math.max(1, ...Object.values(stats.costBuckets))
  const grouped = [
    ['Characters', cards.filter(c => c.type === 'Character')],
    ['Events', cards.filter(c => c.type === 'Event')],
    ['Stages', cards.filter(c => c.type === 'Stage')],
    ['Other', cards.filter(c => !['Character', 'Event', 'Stage'].includes(c.type))],
  ]
  // Fall back to a screen-width estimate for the first frame (before
  // onLayout fires), then switch to the measured width once known.
  const availW = gridW > 0 ? gridW : screenW - 40
  const gridCols = Math.max(3, Math.round((availW + GRID_GAP) / (TARGET_THUMB_W + GRID_GAP)))
  const gridThumbW = Math.floor((availW - (gridCols - 1) * GRID_GAP) / gridCols)

  async function copyDecklist() {
    const lines = [`Leader: ${deck.leader_id}`, ...cards.map(c => `${c.count}x${c.id}`)]
    await Clipboard.setStringAsync(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0d1a2b', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '94%', borderWidth: 1, borderColor: colors.lineStrong }}>
          {/* Header */}
          <View style={{ height: 140, overflow: 'hidden', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Image source={{ uri: getCardImageUrl(deck.leader_id) }} style={{ width: '100%', height: 190 }} resizeMode="cover" />
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(6,16,27,0.55)' }} />
            <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
            <View style={{ position: 'absolute', bottom: 12, left: 20, right: 20 }}>
              <Text numberOfLines={1} style={{ fontSize: 18, fontFamily: font.display, color: colors.text }}>{deck.name}</Text>
              <Text style={{ fontSize: 12, color: colors.textSoft, fontFamily: font.body, marginTop: 2 }}>{deck.leader_name} · {deck.leader_id} · {totalCards} cards</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: color }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Deck Stats */}
            <View style={{ backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 12 }}>Deck Stats</Text>

              <Text style={{ fontSize: 9.5, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.faint, marginBottom: 8 }}>Cost Curve</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginBottom: 14 }}>
                {Array.from({ length: 11 }, (_, cost) => {
                  const n = stats.costBuckets[cost] ?? 0
                  return (
                    <View key={cost} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      {n > 0 ? <Text style={{ fontSize: 9, fontFamily: font.mono, color: colors.oceanBright, marginBottom: 3 }}>{n}</Text> : null}
                      <View style={{ width: '100%', height: Math.max(n > 0 ? 6 : 0, (n / maxCostCount) * 40), backgroundColor: n > 0 ? colors.ocean : 'transparent', borderRadius: 2 }} />
                      <Text style={{ fontSize: 8.5, color: colors.faint, marginTop: 4, fontFamily: font.mono }}>{cost}</Text>
                    </View>
                  )
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[['Character', stats.charCount], ['Event', stats.eventCount], ['Stage', stats.stageCount]].map(([label, value]) => (
                  <View key={label} style={{ flex: 1, backgroundColor: 'rgba(140,176,208,0.04)', borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: font.mono, color: colors.text }}>{value}</Text>
                    <Text style={{ fontSize: 9, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 }}>{label}</Text>
                  </View>
                ))}
              </View>

              {Object.keys(stats.colorCounts).length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
                  {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([col, n]) => (
                    <View key={col} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(140,176,208,0.04)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEADER_COLORS[col] ?? colors.faint }} />
                      <Text style={{ fontSize: 11, color: colors.textSoft, fontFamily: font.body }}>{col}</Text>
                      <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{n}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* All Cards — one thumbnail per unique card, with a count badge */}
            <Text style={{ fontSize: 10, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.faint, marginBottom: 10 }}>
              All Cards ({cards.length} unique · {totalCards} total) — tap to enlarge
            </Text>
            <View onLayout={e => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 24 }}>
              {cards.map(card => (
                <TouchableOpacity key={card.id} onPress={() => setSelectedCard(card)} style={{ position: 'relative' }}>
                  <Image source={{ uri: getCardImageUrl(card.id) }} style={{ width: gridThumbW, height: Math.round(gridThumbW * 1.4), borderRadius: 8, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
                  <View style={{ position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(6,16,27,0.88)', borderWidth: 1, borderColor: colors.goldLine, borderRadius: 6, paddingVertical: 1, paddingHorizontal: 6 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.mono, color: colors.gold }}>×{card.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
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

          <View style={{ paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(140,176,208,0.07)', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {onEdit && (
              <TouchableOpacity onPress={() => onEdit(deck)} style={{ flexGrow: 1, minWidth: 100, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(59,178,126,0.3)', backgroundColor: 'rgba(59,178,126,0.08)', alignItems: 'center' }}>
                <Text style={{ color: colors.emerald, fontSize: 13, fontFamily: font.semi }}>Edit Decklist</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowShare(true)} style={{ flexGrow: 1, minWidth: 100, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: 'rgba(200,162,74,0.08)', alignItems: 'center' }}>
              <Text style={{ color: colors.gold, fontSize: 13, fontFamily: font.semi }}>📤 Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={copyDecklist} style={{ flexGrow: 1, minWidth: 100, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.04)', alignItems: 'center' }}>
              <Text style={{ color: copied ? colors.emerald : colors.text, fontSize: 13, fontFamily: font.semi }}>{copied ? 'Copied!' : 'Copy Decklist'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {selectedCard && (
        <CardPreview
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSearchMarketplace={() => { setSelectedCard(null); onClose?.(); router.push({ pathname: '/marketplace', params: { search: selectedCard.name } }) }}
        />
      )}
      {showShare && <DeckShareOverlay deck={{ ...deck, cards }} onClose={() => setShowShare(false)} />}
    </Modal>
  )
}
