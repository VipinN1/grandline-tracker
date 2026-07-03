import { View, Text } from 'react-native'
import { colors, font, eyebrow } from '../../theme'

export default function Decklists() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ ...eyebrow, marginBottom: 10 }}>⚓ Ship's Manifest</Text>
      <Text style={{ fontFamily: font.display, fontSize: 22, color: colors.text, marginBottom: 8 }}>Decklists</Text>
      <Text style={{ fontSize: 13, color: colors.faint, textAlign: 'center', fontFamily: font.body }}>
        Decklists are coming in the next update.
      </Text>
    </View>
  )
}
