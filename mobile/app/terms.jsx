import { View, Text, ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import { colors, font, card } from '../theme'
import { TERMS_SECTIONS, LEGAL_UPDATED } from '../lib/legal'

export default function Terms() {
  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Terms of Service',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}>
        <Text style={{ fontSize: 12, color: colors.faint, fontFamily: font.body }}>Last updated: {LEGAL_UPDATED}</Text>
        {TERMS_SECTIONS.map(([title, paragraphs]) => (
          <View key={title} style={{ ...card, padding: 16 }}>
            <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.gold, marginBottom: 10 }}>{title}</Text>
            {paragraphs.map((p, i) => (
              <Text key={i} style={{ fontSize: 13, color: colors.textSoft, lineHeight: 21, fontFamily: font.body, marginTop: i > 0 ? 10 : 0 }}>{p}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  )
}
