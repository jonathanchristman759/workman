import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import { useEffect, useRef } from 'react'

interface ManuscriptEditorProps {
  content:  string
  onChange: (text: string) => void
  language: string
  fontSize: number
}

// ─────────────────────────────────────────────
// TOOLBAR BUTTON
// ─────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick:   () => void
  active?:   boolean
  disabled?: boolean
  title:     string
  children:  React.ReactNode
  wide?:     boolean
}

function ToolbarButton({ onClick, active, disabled, title, children, wide }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding:      wide ? '4px 8px' : '4px 7px',
        borderRadius: 4,
        border:       active
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border-default)',
        background:   active
          ? 'var(--color-accent-muted)'
          : 'var(--color-bg-secondary)',
        color:        active
          ? 'var(--color-accent)'
          : disabled
            ? 'var(--color-text-hint)'
            : 'var(--color-text-secondary)',
        fontSize:     12,
        fontFamily:   'var(--font-sans)',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.5 : 1,
        lineHeight:   1,
        minWidth:     wide ? undefined : 26,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width:      1,
      height:     22,
      background: 'var(--color-border-default)',
      margin:     '0 2px',
      alignSelf:  'center',
    }} />
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function ManuscriptEditor({
  content, onChange, language, fontSize
}: ManuscriptEditorProps) {
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
  heading: { levels: [1, 2, 3] },
  strike: {},
}),
Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Typography,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(editor.getText())
      }, 800)
    },
    editorProps: {
      attributes: {
        style: `font-size: ${fontSize}px; line-height: 1.8; min-height: 400px; outline: none; padding: 4px 0;`,
      },
    },
  })

  // Sync content from parent only on first mount
  useEffect(() => {
    if (!initialized.current && editor && content) {
      editor.commands.setContent(content)
      initialized.current = true
    }
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── TOOLBAR ── */}
      <div style={{
        display:        'flex',
        flexWrap:       'wrap',
        gap:            3,
        padding:        '6px 8px',
        background:     'var(--color-bg-secondary)',
        border:         '1px solid var(--color-border-subtle)',
        borderRadius:   'var(--radius-md) var(--radius-md) 0 0',
        alignItems:     'center',
      }}>

        {/* Undo / Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          ↪
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')}
          title="Normal text"
          wide
        >
          ¶ Normal
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
          wide
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
          wide
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
          wide
        >
          H3
        </ToolbarButton>

        <Divider />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align left"
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align center"
        >
          ☰
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align right"
        >
          ≣
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          ⊟
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          •≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1≡
        </ToolbarButton>

        <Divider />

        {/* Block quote + rule */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Block quote"
        >
          "
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          —
        </ToolbarButton>

      </div>

      {/* ── EDITOR AREA ── */}
      <div style={{
        border:         '1px solid var(--color-border-subtle)',
        borderTop:      'none',
        borderRadius:   '0 0 var(--radius-md) var(--radius-md)',
        background:     'var(--color-bg-primary)',
        padding:        '16px 20px',
        minHeight:      400,
      }}>
        <style>{`
          .tiptap p { margin: 0 0 0.75em; }
          .tiptap h1 { font-size: 1.6em; font-weight: 600; margin: 1em 0 0.5em; font-family: var(--font-serif); }
          .tiptap h2 { font-size: 1.3em; font-weight: 600; margin: 1em 0 0.4em; font-family: var(--font-serif); }
          .tiptap h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; }
          .tiptap ul { padding-left: 1.4em; margin: 0 0 0.75em; }
          .tiptap ol { padding-left: 1.4em; margin: 0 0 0.75em; }
          .tiptap li { margin-bottom: 0.25em; }
          .tiptap blockquote {
            border-left: 3px solid var(--color-accent);
            padding-left: 1em;
            margin: 0.75em 0;
            color: var(--color-text-secondary);
            font-style: italic;
            font-family: var(--font-serif);
          }
          .tiptap hr { border: none; border-top: 1px solid var(--color-border-default); margin: 1em 0; }
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--color-text-hint);
            pointer-events: none;
            height: 0;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>

    </div>
  )
}
