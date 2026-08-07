import { Stack } from 'expo-router'
import { colors, font } from '../../theme'
import ArticleEditorForm from '../../components/articles/ArticleEditorForm'

export default function NewArticle() {
  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Write an Article',
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 16, color: colors.parchment },
        headerTintColor: colors.parchment,
      }} />
      <ArticleEditorForm />
    </>
  )
}
