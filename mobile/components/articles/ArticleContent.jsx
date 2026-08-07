// Read-only renderer for article content (TipTap/ProseMirror JSON) — RN
// counterpart to src/components/articles/ArticleContent.jsx. Web renders
// this through a real (non-editable) TipTap editor instance; there's no RN
// equivalent of TipTap itself, so this walks the JSON doc tree by hand and
// maps each node type to RN components. Kept in sync with the node/mark
// vocabulary produced by src/components/articles/extensions.js.
import { Fragment } from 'react'
import { View, Text, Linking } from 'react-native'
import { colors, font } from '../../theme'
import CardEmbedView from './CardEmbedView'
import DecklistEmbedView from './DecklistEmbedView'

const body = { fontSize: 15, color: colors.textSoft, fontFamily: font.body, lineHeight: 24 }

function markStyle(mark) {
  switch (mark.type) {
    case 'bold': return { fontFamily: font.bold }
    case 'italic': return { fontStyle: 'italic' }
    case 'strike': return { textDecorationLine: 'line-through' }
    case 'code': return { fontFamily: font.mono, backgroundColor: 'rgba(140,176,208,0.1)', fontSize: 13.5 }
    case 'textStyle': return mark.attrs?.color ? { color: mark.attrs.color } : null
    default: return null
  }
}

// Renders the inline content of a paragraph/heading/listItem as one <Text>
// tree — nested <Text> per run so marks (bold, links, ...) can differ.
function InlineContent({ nodes }) {
  return (
    <Text style={body}>
      {(nodes ?? []).map((n, i) => {
        if (n.type === 'hardBreak') return '\n'
        if (n.type !== 'text') return null
        const link = n.marks?.find(m => m.type === 'link')
        const style = (n.marks ?? []).map(markStyle).filter(Boolean)
        const text = <Text key={i} style={style}>{n.text}</Text>
        if (link?.attrs?.href) {
          return (
            <Text key={i} style={[style, { color: colors.oceanBright }]} onPress={() => Linking.openURL(link.attrs.href).catch(() => {})}>
              {n.text}
            </Text>
          )
        }
        return text
      })}
    </Text>
  )
}

function Block({ node, index }) {
  switch (node.type) {
    case 'paragraph':
      if (!node.content?.length) return <View style={{ height: 10 }} />
      return <View style={{ marginBottom: 12 }}><InlineContent nodes={node.content} /></View>

    case 'heading': {
      const level = node.attrs?.level ?? 2
      const size = level === 1 ? 24 : level === 2 ? 20 : 17
      return (
        <Text style={{ fontFamily: font.display, fontSize: size, color: colors.text, marginTop: index === 0 ? 0 : 18, marginBottom: 10 }}>
          {(node.content ?? []).map(n => n.text ?? '').join('')}
        </Text>
      )
    }

    case 'bulletList':
      return (
        <View style={{ marginBottom: 12, gap: 6 }}>
          {(node.content ?? []).map((li, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ ...body, marginTop: 1 }}>•</Text>
              <View style={{ flex: 1 }}>
                {(li.content ?? []).map((p, j) => <InlineContent key={j} nodes={p.content} />)}
              </View>
            </View>
          ))}
        </View>
      )

    case 'orderedList':
      return (
        <View style={{ marginBottom: 12, gap: 6 }}>
          {(node.content ?? []).map((li, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ ...body, marginTop: 1, fontFamily: font.mono, minWidth: 18 }}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                {(li.content ?? []).map((p, j) => <InlineContent key={j} nodes={p.content} />)}
              </View>
            </View>
          ))}
        </View>
      )

    case 'blockquote':
      return (
        <View style={{ borderLeftWidth: 3, borderLeftColor: colors.goldLine, paddingLeft: 12, marginBottom: 12 }}>
          {(node.content ?? []).map((p, i) => <InlineContent key={i} nodes={p.content} />)}
        </View>
      )

    case 'codeBlock':
      return (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontFamily: font.mono, fontSize: 12.5, color: colors.textSoft }}>
            {(node.content ?? []).map(n => n.text ?? '').join('')}
          </Text>
        </View>
      )

    case 'horizontalRule':
      return <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 16 }} />

    case 'cardEmbed':
      return <CardEmbedView node={node} />

    case 'decklistEmbed':
      return <DecklistEmbedView node={node} />

    default:
      return null
  }
}

export default function ArticleContent({ content }) {
  const nodes = content?.content ?? []
  if (nodes.length === 0) return null
  return (
    <View>
      {nodes.map((node, i) => <Fragment key={i}><Block node={node} index={i} /></Fragment>)}
    </View>
  )
}
