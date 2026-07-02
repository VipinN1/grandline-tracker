import { View, Text } from 'react-native'
import { colors, font, eyebrow } from '../../theme'

export default function Stats() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ ...eyebrow, marginBottom: 10 }}>⚓ Navigator's Charts</Text>
      <Text style={{ fontFamily: font.display, fontSize: 22, color: colors.text, marginBottom: 8 }}>Stats</Text>
      <Text style={{ fontSize: 13, color: colors.faint, textAlign: 'center', fontFamily: font.body }}>
        Matchup charts are coming in the next update.
      </Text>
    </View>
  )
}
