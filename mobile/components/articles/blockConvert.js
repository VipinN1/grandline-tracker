// Converts between the mobile editor's flat "blocks" model and the TipTap
// (ProseMirror) JSON doc format used by src/components/articles/extensions.js
// — kept doc-compatible so mobile-authored articles read identically on web
// and vice versa. Mobile authoring is intentionally simpler than the web
// TipTap editor: no inline bold/italic/links, no blockquote/code block
// authoring. Editing a web-written article on mobile flattens any inline
// formatting to plain text (block structure, card embeds and decklist
// embeds all survive the round trip).
let counter = 0
function uid() { return `b${Date.now()}_${counter++}` }

export function newBlock(type) {
  switch (type) {
    case 'heading': return { id: uid(), type: 'heading', level: 2, text: '' }
    case 'bulletList': return { id: uid(), type: 'bulletList', text: '' }
    case 'cardEmbed': return { id: uid(), type: 'cardEmbed', cardId: null, cardName: null }
    case 'decklistEmbed': return { id: uid(), type: 'decklistEmbed', name: null, leaderId: null, leaderName: null, leaderColor: null, cards: [] }
    default: return { id: uid(), type: 'paragraph', text: '' }
  }
}

function inlineToText(nodes) {
  return (nodes ?? []).map(n => n.type === 'hardBreak' ? '\n' : (n.text ?? '')).join('')
}

function textToInline(text) {
  const lines = (text ?? '').split('\n')
  const nodes = []
  lines.forEach((line, i) => {
    if (i > 0) nodes.push({ type: 'hardBreak' })
    if (line) nodes.push({ type: 'text', text: line })
  })
  return nodes.length ? nodes : undefined
}

// TipTap doc → blocks[] (for loading an existing article into the editor).
export function docToBlocks(doc) {
  const blocks = []
  for (const node of doc?.content ?? []) {
    if (node.type === 'heading') {
      blocks.push({ id: uid(), type: 'heading', level: node.attrs?.level ?? 2, text: inlineToText(node.content) })
    } else if (node.type === 'paragraph') {
      const text = inlineToText(node.content)
      const last = blocks[blocks.length - 1]
      // Consecutive paragraphs collapse into one multi-line block (inverse
      // of the blank-line splitting blocksToDoc does below).
      if (last?.type === 'paragraph') last.text += (last.text ? '\n\n' : '') + text
      else blocks.push({ id: uid(), type: 'paragraph', text })
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content ?? []).map(li =>
        (li.content ?? []).map(p => inlineToText(p.content)).join(' ')
      ).join('\n')
      blocks.push({ id: uid(), type: 'bulletList', text: items })
    } else if (node.type === 'cardEmbed') {
      blocks.push({ id: uid(), type: 'cardEmbed', cardId: node.attrs?.cardId ?? null, cardName: node.attrs?.cardName ?? null })
    } else if (node.type === 'decklistEmbed') {
      blocks.push({
        id: uid(), type: 'decklistEmbed',
        name: node.attrs?.name ?? null, leaderId: node.attrs?.leaderId ?? null,
        leaderName: node.attrs?.leaderName ?? null, leaderColor: node.attrs?.leaderColor ?? null,
        cards: node.attrs?.cards ?? [],
      })
    } else if (node.type === 'blockquote' || node.type === 'codeBlock') {
      const text = (node.content ?? []).map(p => inlineToText(p.content ?? [p])).join('\n')
      blocks.push({ id: uid(), type: 'paragraph', text })
    }
    // horizontalRule and anything else is dropped — rare on existing content.
  }
  return blocks.length ? blocks : [newBlock('paragraph')]
}

// blocks[] → TipTap doc (for saving).
export function blocksToDoc(blocks) {
  const content = []
  for (const b of blocks) {
    if (b.type === 'heading') {
      if (!b.text?.trim()) continue
      content.push({ type: 'heading', attrs: { level: b.level ?? 2 }, content: textToInline(b.text) })
    } else if (b.type === 'paragraph') {
      const paras = (b.text ?? '').split(/\n\s*\n/)
      for (const p of paras) {
        if (!p.trim()) continue
        content.push({ type: 'paragraph', content: textToInline(p) })
      }
    } else if (b.type === 'bulletList') {
      const items = (b.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
      if (items.length > 0) {
        content.push({
          type: 'bulletList',
          content: items.map(text => ({ type: 'listItem', content: [{ type: 'paragraph', content: textToInline(text) }] })),
        })
      }
    } else if (b.type === 'cardEmbed' && b.cardId) {
      content.push({ type: 'cardEmbed', attrs: { cardId: b.cardId, cardName: b.cardName ?? null, size: 'md', align: 'center' } })
    } else if (b.type === 'decklistEmbed' && b.cards?.length) {
      content.push({ type: 'decklistEmbed', attrs: { name: b.name ?? null, leaderId: b.leaderId ?? null, leaderName: b.leaderName ?? null, leaderColor: b.leaderColor ?? null, cards: b.cards } })
    }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}
