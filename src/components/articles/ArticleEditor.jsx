import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { articleExtensions } from './extensions'
import CardSearchModal from './CardSearchModal'
import DecklistPickerModal from './DecklistPickerModal'
import { colors, radius } from '../../theme'

const FONT_FAMILIES = [
  { value: '', label: 'Font' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { value: "'Fraunces', Georgia, serif", label: 'Fraunces' },
  { value: "'Space Mono', monospace", label: 'Mono' },
]

const FONT_SIZES = ['', '13px', '15px', '17px', '20px', '24px', '28px']

const TEXT_COLORS = [
  { value: '', label: 'Color' },
  { value: '#dcb35e', label: 'Gold' },
  { value: '#52a9cd', label: 'Ocean' },
  { value: '#3bb27e', label: 'Emerald' },
  { value: '#d24a3a', label: 'Crimson' },
  { value: '#8d7ae6', label: 'Purple' },
  { value: '#e08a3c', label: 'Orange' },
]

function ToolBtn({ active, disabled, onClick, title, children, accent }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      style={{
        minWidth: 30,
        height: 30,
        padding: '0 8px',
        borderRadius: 6,
        border: '1px solid transparent',
        background: active ? colors.goldSoft : 'transparent',
        color: disabled ? 'rgba(103,128,154,0.4)' : active ? colors.gold : accent ?? colors.textSoft,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function ToolSelect({ value, onChange, options, width = 92, title }) {
  return (
    <select
      title={title}
      value={value}
      onMouseDown={e => e.stopPropagation()}
      onChange={onChange}
      style={{
        width,
        height: 30,
        background: colors.surface3,
        border: `1px solid ${colors.line}`,
        borderRadius: 6,
        color: colors.textSoft,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        outline: 'none',
        cursor: 'pointer',
        padding: '0 6px',
        colorScheme: 'dark',
      }}
    >
      {options}
    </select>
  )
}

function Divider() {
  return <span style={{ width: 1, height: 18, background: colors.line, margin: '0 4px', flexShrink: 0 }} />
}

// Full article editor: toolbar + TipTap content area + TCG embed modals.
export default function ArticleEditor({ session, initialContent, onEditorReady }) {
  const [cardModal, setCardModal] = useState(false)
  const [deckModal, setDeckModal] = useState(false)
  const [, setTick] = useState(0)

  const editor = useEditor({
    extensions: articleExtensions({ placeholder: 'Chart your course… write your article here.' }),
    content: initialContent ?? '',
    editorProps: { attributes: { class: 'article-prose article-prose--editing' } },
  })

  // Re-render the toolbar whenever the document or selection changes.
  useEffect(() => {
    if (!editor) return
    const update = () => setTick(t => t + 1)
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor)
  }, [editor, onEditorReady])

  if (!editor) return null

  const headingValue = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
    : 'p'

  const attrs = editor.getAttributes('textStyle')

  function setHeading(v) {
    const chain = editor.chain().focus()
    if (v === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: Number(v[1]) }).run()
  }

  function setLink() {
    const prev = editor.getAttributes('link').href
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (!url) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  function insertCard(card) {
    editor.chain().focus().insertContent({
      type: 'cardEmbed',
      attrs: {
        cardId: card.card_image_id ?? card.card_set_id,
        cardName: card.card_name ?? null,
      },
    }).run()
  }

  function insertDecklist(deck) {
    editor.chain().focus().insertContent({ type: 'decklistEmbed', attrs: deck }).run()
  }

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.md }}>
      {/* Toolbar (sticks below the navbar while writing long articles) */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '8px 10px', borderBottom: `1px solid ${colors.line}`, background: colors.deep, borderRadius: `${radius.md}px ${radius.md}px 0 0`, position: 'sticky', top: 58, zIndex: 20 }}>
        <ToolBtn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↺</ToolBtn>
        <ToolBtn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↻</ToolBtn>
        <Divider />
        <ToolSelect
          title="Text style"
          width={104}
          value={headingValue}
          onChange={e => setHeading(e.target.value)}
          options={
            <>
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </>
          }
        />
        <ToolSelect
          title="Font"
          width={92}
          value={attrs.fontFamily ?? ''}
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontFamily(v).run()
            else editor.chain().focus().unsetFontFamily().run()
          }}
          options={FONT_FAMILIES.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        />
        <ToolSelect
          title="Font size"
          width={66}
          value={attrs.fontSize ?? ''}
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontSize(v).run()
            else editor.chain().focus().unsetFontSize().run()
          }}
          options={FONT_SIZES.map(s => <option key={s || 'default'} value={s}>{s ? s.replace('px', '') : 'Size'}</option>)}
        />
        <ToolSelect
          title="Text color"
          width={80}
          value={attrs.color ?? ''}
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setColor(v).run()
            else editor.chain().focus().unsetColor().run()
          }}
          options={TEXT_COLORS.map(c => <option key={c.label} value={c.value} style={c.value ? { color: c.value } : undefined}>{c.label}</option>)}
        />
        <Divider />
        <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolBtn>
        <Divider />
        <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•≡</ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1≡</ToolBtn>
        <ToolBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolBtn>
        <ToolBtn title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</ToolBtn>
        <ToolBtn title="Link" active={editor.isActive('link')} onClick={setLink}>🔗</ToolBtn>
        <Divider />
        <ToolBtn title="Insert a card from the database" accent={colors.gold} onClick={() => setCardModal(true)}>🃏 Card</ToolBtn>
        <ToolBtn title="Embed a decklist" accent={colors.gold} onClick={() => setDeckModal(true)}>📜 Decklist</ToolBtn>
      </div>

      {/* Content */}
      <div onClick={() => editor.chain().focus().run()} style={{ padding: '18px 22px', minHeight: 380, cursor: 'text' }}>
        <EditorContent editor={editor} />
      </div>

      {cardModal && <CardSearchModal onClose={() => setCardModal(false)} onSelect={insertCard} />}
      {deckModal && <DecklistPickerModal session={session} onClose={() => setDeckModal(false)} onSelect={insertDecklist} />}
    </div>
  )
}
