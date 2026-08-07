// Read-only render of a cardEmbed TipTap node — RN counterpart to
// src/components/articles/CardEmbedView.jsx (that file also handles the
// editor's drag/resize UI; mobile authoring doesn't need that, so this is
// display-only).
import { useState } from 'react'
import { View, Text, Image } from 'react-native'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, radius, font } from '../../theme'

const SIZES = { sm: 130, md: 190, lg: 260 }

export default function CardEmbedView({ node }) {
  const { cardId, cardName, size, align } = node.attrs ?? {}
  const [errored, setErrored] = useState(false)
  const width = SIZES[size] ?? SIZES.md
  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'

  return (
    <View style={{ alignItems, marginVertical: 10 }}>
      <View style={{ width, maxWidth: '100%' }}>
        {!errored ? (
          <Image
            source={{ uri: getCardImageUrl(cardId) }}
            style={{ width: '100%', aspectRatio: 0.716, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line }}
            resizeMode="cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <View style={{ width: '100%', aspectRatio: 0.716, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.faint, fontSize: 12, fontFamily: font.semi }}>{cardId}</Text>
          </View>
        )}
        <Text style={{ textAlign: 'center', fontSize: 11, color: colors.faint, marginTop: 6, fontFamily: font.mono }}>
          {cardName ? `${cardName} · ${cardId}` : cardId}
        </Text>
      </View>
    </View>
  )
}
