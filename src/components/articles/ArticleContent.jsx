import { useEditor, EditorContent } from '@tiptap/react'
import { articleExtensions } from './extensions'

// Read-only renderer for published article content (TipTap JSON).
// Uses the same extensions as the editor so embeds render identically.
export default function ArticleContent({ content }) {
  const editor = useEditor({
    editable: false,
    content,
    extensions: articleExtensions({ linkOpenOnClick: true }),
    editorProps: { attributes: { class: 'article-prose' } },
  })

  if (!editor) return null
  return <EditorContent editor={editor} />
}
