import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import CardEmbedView from './CardEmbedView'
import DecklistEmbedView from './DecklistEmbedView'

// Block-level atom node: an inserted card image. Draggable so authors can
// reposition it anywhere in the article.
export const CardEmbed = Node.create({
  name: 'cardEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      cardId: { default: null },
      cardName: { default: null },
      size: { default: 'md' },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-card-embed]',
      getAttrs: el => ({
        cardId: el.getAttribute('data-card-id'),
        cardName: el.getAttribute('data-card-name'),
        size: el.getAttribute('data-size') ?? 'md',
        align: el.getAttribute('data-align') ?? 'center',
      }),
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-card-embed': '',
      'data-card-id': node.attrs.cardId,
      'data-card-name': node.attrs.cardName,
      'data-size': node.attrs.size,
      'data-align': node.attrs.align,
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardEmbedView)
  },
})

// Block-level atom node: an embedded decklist rendered as a card grid.
// cards: [{ id, name, count }]
export const DecklistEmbed = Node.create({
  name: 'decklistEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      name: { default: null },
      leaderId: { default: null },
      leaderName: { default: null },
      leaderColor: { default: null },
      cards: { default: [] },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-decklist-embed]',
      getAttrs: el => {
        let cards = []
        try { cards = JSON.parse(el.getAttribute('data-cards') ?? '[]') } catch { /* malformed embed data */ }
        return {
          name: el.getAttribute('data-name'),
          leaderId: el.getAttribute('data-leader-id'),
          leaderName: el.getAttribute('data-leader-name'),
          leaderColor: el.getAttribute('data-leader-color'),
          cards,
        }
      },
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-decklist-embed': '',
      'data-name': node.attrs.name,
      'data-leader-id': node.attrs.leaderId,
      'data-leader-name': node.attrs.leaderName,
      'data-leader-color': node.attrs.leaderColor,
      'data-cards': JSON.stringify(node.attrs.cards ?? []),
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DecklistEmbedView)
  },
})

// Shared TipTap extension list — used by both the editor and the read-only
// article renderer so content always renders identically.
export function articleExtensions({ placeholder = '', linkOpenOnClick = false } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: linkOpenOnClick, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyleKit, // font family, font size, color
    Placeholder.configure({ placeholder }),
    CardEmbed,
    DecklistEmbed,
  ]
}
