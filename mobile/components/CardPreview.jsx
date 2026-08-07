// Shared full-screen card preview — RN port of src/components/CardPreview.jsx.
// Used anywhere a card thumbnail is tapped to enlarge it (decklists, community
// post decklist panels, tournament decklists, ...), with optional "search this
// card elsewhere in the app" actions.
import { Modal, View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native'
import { getCardImageUrl } from '../lib/optcgapi'
import { colors, font, radius } from '../theme'
import { GlassButton } from './glass'

export default function CardPreview({ card, onClose, onSearchCommunity, onSearchMarketplace }) {
  const { width } = useWindowDimensions()
  const w = Math.min(300, width * 0.85)
  if (!card) return null
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignItems: 'center', gap: 14 }}>
          <Image source={{ uri: getCardImageUrl(card.id) }} style={{ width: w, height: w * 1.4, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(140,176,208,0.15)' }} resizeMode="contain" />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: font.bold, color: colors.text }}>{card.name ?? card.id}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, fontFamily: font.mono }}>{card.id}</Text>
          </View>
          {(onSearchCommunity || onSearchMarketplace) && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {onSearchCommunity && (
                <GlassButton onPress={onSearchCommunity} tint="#8b5cf6" pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: '#a78bfa' }}>Search Community</Text>
                </GlassButton>
              )}
              {onSearchMarketplace && (
                <GlassButton onPress={onSearchMarketplace} tint={colors.ocean} pad={{ paddingVertical: 7, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.oceanBright }}>Search Marketplace</Text>
                </GlassButton>
              )}
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: 'rgba(140,176,208,0.08)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 24 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontFamily: font.semi }}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
