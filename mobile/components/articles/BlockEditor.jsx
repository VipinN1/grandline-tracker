// Mobile's article body editor. Simpler than web's TipTap rich-text editor:
// content is composed as an ordered list of typed blocks (heading,
// paragraph, bullet list, card embed, decklist embed) rather than free-form
// inline-formatted text — see blockConvert.js for why and what's lost.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius, input as inputStyle } from '../../theme'
import { LEADER_COLORS } from '../forms'
import { newBlock } from './blockConvert'
import CardSearchModal from './CardSearchModal'
import DecklistPickerModal from './DecklistPickerModal'

function BlockChrome({ onMoveUp, onMoveDown, onRemove, canUp, canDown, children }) {
  return (
    <View style={{ backgroundColor: 'rgba(140,176,208,0.03)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 10 }}>
      {children}
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8, justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={onMoveUp} disabled={!canUp} hitSlop={6}>
          <Text style={{ fontSize: 13, color: canUp ? colors.muted : colors.line }}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMoveDown} disabled={!canDown} hitSlop={6}>
          <Text style={{ fontSize: 13, color: canDown ? colors.muted : colors.line }}>▼</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove} hitSlop={6}>
          <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.semi }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function BlockEditor({ blocks, onChange }) {
  const { session } = useSession()
  const [cardTarget, setCardTarget] = useState(null) // block id awaiting a card pick
  const [deckTarget, setDeckTarget] = useState(null) // block id awaiting a decklist pick

  function update(id, patch) {
    onChange(blocks.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function remove(id) {
    onChange(blocks.filter(b => b.id !== id))
  }
  function move(id, dir) {
    const i = blocks.findIndex(b => b.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= blocks.length) return
    const next = blocks.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  function add(type) {
    onChange([...blocks, newBlock(type)])
  }

  return (
    <View>
      {blocks.map((b, i) => {
        const chromeProps = {
          canUp: i > 0, canDown: i < blocks.length - 1,
          onMoveUp: () => move(b.id, -1), onMoveDown: () => move(b.id, 1),
          onRemove: () => remove(b.id),
        }

        if (b.type === 'heading') {
          return (
            <BlockChrome key={b.id} {...chromeProps}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {[1, 2, 3].map(lvl => (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => update(b.id, { level: lvl })}
                    style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: b.level === lvl ? colors.goldLine : colors.line, backgroundColor: b.level === lvl ? 'rgba(200,162,74,0.15)' : 'transparent' }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: font.bold, color: b.level === lvl ? colors.gold : colors.faint }}>H{lvl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                placeholder="Heading text..."
                placeholderTextColor={colors.faint}
                value={b.text}
                onChangeText={t => update(b.id, { text: t })}
                style={{ ...inputStyle, fontFamily: font.display, fontSize: 16 }}
              />
            </BlockChrome>
          )
        }

        if (b.type === 'paragraph') {
          return (
            <BlockChrome key={b.id} {...chromeProps}>
              <TextInput
                placeholder="Write..."
                placeholderTextColor={colors.faint}
                value={b.text}
                onChangeText={t => update(b.id, { text: t })}
                multiline
                style={{ ...inputStyle, minHeight: 90, textAlignVertical: 'top' }}
              />
            </BlockChrome>
          )
        }

        if (b.type === 'bulletList') {
          return (
            <BlockChrome key={b.id} {...chromeProps}>
              <Text style={{ fontSize: 10, fontFamily: font.semi, color: colors.faint, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>One item per line</Text>
              <TextInput
                placeholder={'First point\nSecond point\n...'}
                placeholderTextColor={colors.faint}
                value={b.text}
                onChangeText={t => update(b.id, { text: t })}
                multiline
                style={{ ...inputStyle, minHeight: 80, textAlignVertical: 'top' }}
              />
            </BlockChrome>
          )
        }

        if (b.type === 'cardEmbed') {
          return (
            <BlockChrome key={b.id} {...chromeProps}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {b.cardId ? (
                  <Image source={{ uri: getCardImageUrl(b.cardId) }} style={{ width: 44, height: 62, borderRadius: 6, borderWidth: 1, borderColor: colors.line }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 44, height: 62, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🃏</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  {b.cardId ? (
                    <>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{b.cardName ?? b.cardId}</Text>
                      <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.mono }}>{b.cardId}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>No card selected</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setCardTarget(b.id)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{b.cardId ? 'Change' : 'Choose'}</Text>
                </TouchableOpacity>
              </View>
            </BlockChrome>
          )
        }

        if (b.type === 'decklistEmbed') {
          const color = LEADER_COLORS[b.leaderColor] ?? colors.ocean
          const total = (b.cards ?? []).reduce((s, c) => s + (c.count ?? 0), 0)
          return (
            <BlockChrome key={b.id} {...chromeProps}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {b.leaderId ? (
                  <Image source={{ uri: getCardImageUrl(b.leaderId) }} style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: color }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>📜</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  {b.cards?.length > 0 ? (
                    <>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{b.name || 'Decklist'}</Text>
                      <Text style={{ fontSize: 11, color: colors.faint, fontFamily: font.body }}>{b.leaderName ? `${b.leaderName} · ` : ''}{total} cards</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>No decklist selected</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setDeckTarget(b.id)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>{b.cards?.length > 0 ? 'Change' : 'Choose'}</Text>
                </TouchableOpacity>
              </View>
            </BlockChrome>
          )
        }

        return null
      })}

      {/* Add-block toolbar */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {[
          ['paragraph', '¶ Text'],
          ['heading', 'H Heading'],
          ['bulletList', '• List'],
          ['cardEmbed', '🃏 Card'],
          ['decklistEmbed', '📜 Decklist'],
        ].map(([type, label]) => (
          <TouchableOpacity key={type} onPress={() => add(type)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(140,176,208,0.04)' }}>
            <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.textSoft }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cardTarget ? (
        <CardSearchModal
          title="Choose a Card"
          onClose={() => setCardTarget(null)}
          onSelect={card => update(cardTarget, { cardId: card.card_image_id ?? card.card_set_id, cardName: card.card_name })}
        />
      ) : null}
      {deckTarget ? (
        <DecklistPickerModal
          session={session}
          onClose={() => setDeckTarget(null)}
          onSelect={deck => update(deckTarget, deck)}
        />
      ) : null}
    </View>
  )
}
