// RN port of src/pages/About.jsx — static info page.
import { View, Text, ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import { colors, font, radius, card } from '../theme'

const FEATURES = [
  ['🃏', 'Deck Builder', 'Search every card, filter by color/type/set, and build legal 50-card decks with a leader.'],
  ['🏆', 'Tournaments', 'Log past events round-by-round or run a live tournament as you play. Practice events stay out of your stats.'],
  ['☠', 'Bounty Board', 'A community leaderboard — earn Belly for wins and strong placements, lose some for losses.'],
  ['🏪', 'Marketplace', 'List cards for sale, post cards you want, message buyers and sellers, and browse local store inventories.'],
  ['💬', 'Community', 'Share decklists and takes, comment, like, and DM other players.'],
  ['📷', 'Card Scanner', 'Scan physical cards with your camera to identify them (web app).'],
]

const CREW = [
  ['V', 'Vipin', 'Original Creator'],
  ['W', 'Weston', 'Co-Developer'],
]

function SectionTitle({ children }) {
  return <Text style={{ fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 1.2, color: colors.gold, marginBottom: 10 }}>{children}</Text>
}

export default function About() {
  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'About',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 17, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.abyss }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}>
        <View style={{ ...card, padding: 16 }}>
          <SectionTitle>What is this?</SectionTitle>
          <Text style={{ fontSize: 13, color: colors.textSoft, lineHeight: 21, fontFamily: font.body }}>
            PirateTracker is a free companion app for the One Piece Card Game — track your tournament results,
            study your matchups, build decks, trade cards, and connect with other players on the Grand Line.
          </Text>
        </View>

        <View style={{ ...card, padding: 16 }}>
          <SectionTitle>What you can do</SectionTitle>
          <View style={{ gap: 12 }}>
            {FEATURES.map(([icon, title, blurb]) => (
              <View key={title} style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text, marginBottom: 2 }}>{title}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18, fontFamily: font.body }}>{blurb}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ ...card, padding: 16 }}>
          <SectionTitle>Who we are</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {CREW.map(([initial, name, role]) => (
              <View key={name} style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, backgroundColor: 'rgba(140,176,208,0.04)', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(47,125,163,0.2)', borderWidth: 1, borderColor: 'rgba(47,125,163,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 17, fontFamily: font.bold, color: colors.oceanBright }}>{initial}</Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{name}</Text>
                <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{role}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ ...card, padding: 16 }}>
          <SectionTitle>Credits</SectionTitle>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 19, fontFamily: font.body }}>
            Card data and images provided by the OPTCG API (optcgapi.com) — thanks to DomoBot.
          </Text>
          <Text style={{ fontSize: 11, color: colors.faint, lineHeight: 17, marginTop: 10, fontFamily: font.body }}>
            PirateTracker is an unofficial fan project and is not affiliated with or endorsed by Bandai.
            One Piece and all related properties belong to Eiichiro Oda, Shueisha, Toei Animation, and Bandai.
          </Text>
        </View>
      </ScrollView>
    </>
  )
}
