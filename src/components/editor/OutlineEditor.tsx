import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { OutlinePoint } from '@/app/(app)/sermons/[id]/page'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { IndentExtension } from '@/components/editor/IndentExtension'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'

interface OutlineEditorProps {
  points:       OutlinePoint[]
  onChange:     (points: OutlinePoint[]) => void
  language:     string
  onWordCount?: (count: number) => void
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const ALPHA  = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────
// POINT BODY EDITOR — one TipTap per point
// ─────────────────────────────────────────────

function PointBodyEditor({
  pointId, body, onChange, language,
}: {
  pointId: string
  body:    string
  onChange: (id: string, body: string) => void
  language: string
}) {
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const editor = useEditor({
    extensions: [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Typography,
  Highlight.configure({ multicolor: true }),
  Color,
  TextStyle,
  IndentExtension,
  Superscript,
  Subscript,
],
    content: body || '',
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(pointId, editor.getHTML())
      }, 600)
    },
    editorProps: {
  attributes: {
    style: 'font-size: 14px; line-height: 1.7; min-height: 80px; outline: none; padding: 4px 0;',
    spellcheck: 'true',
  },
},
  })

  useEffect(() => {
    if (!initialized.current && editor && body) {
      editor.commands.setContent(body)
      initialized.current = true
    }
  }, [editor])

  if (!editor) return null

  return (
    <div style={{
      marginTop:    8,
      marginLeft:   30,
      border:       '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-md)',
      background:   'var(--color-bg-primary)',
      overflow:     'hidden',
    }}>
      <EditorToolbar editor={editor} minimal topRadius={false} />
      <div style={{ padding: '8px 12px' }}>
        <style>{`
          .outline-body-editor p { margin: 0 0 0.5em; }
          .outline-body-editor p:last-child { margin: 0; }
        `}</style>
        <div className="outline-body-editor">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN OUTLINE EDITOR
// ─────────────────────────────────────────────

export function OutlineEditor({ points: initialPoints, onChange, language, onWordCount }: OutlineEditorProps) {
  const [points, setPoints] = useState<OutlinePoint[]>(initialPoints)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const lastSermonId = useRef<string | null>(null)

useEffect(() => {
  const firstPointId = initialPoints[0]?.id
  if (firstPointId && lastSermonId.current !== firstPointId) {
    setPoints(initialPoints)
    lastSermonId.current = firstPointId
  }
}, [initialPoints])

  function notifyParent(newPoints: OutlinePoint[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(newPoints)
    }, 800)
  }

  function updatePoints(newPoints: OutlinePoint[]) {
  setPoints(newPoints)
  notifyParent(newPoints)
  const count = newPoints.reduce((sum, p) => {
    const bodyText = (p.body ?? '').replace(/<[^>]*>/g, '')
    return sum + countWords(p.text) +
      countWords(bodyText) +
      (p.subpoints ?? []).reduce((s: number, sp: string) => s + countWords(sp), 0)
  }, 0)
  onWordCount?.(count)
}

  function updatePoint(id: string, updates: Partial<OutlinePoint>) {
    updatePoints(points.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function updatePointBody(id: string, body: string) {
    updatePoints(points.map(p => p.id === id ? { ...p, body } : p))
  }

  function addPoint() {
    const newPoint: OutlinePoint = { id: generateId(), text: '', subpoints: [], body: '' }
    updatePoints([...points, newPoint])
  }

  function removePoint(id: string) {
    updatePoints(points.filter(p => p.id !== id))
    setExpandedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  function addSubpoint(pointId: string) {
    updatePoints(points.map(p =>
      p.id === pointId ? { ...p, subpoints: [...(p.subpoints ?? []), ''] } : p
    ))
  }

  function updateSubpoint(pointId: string, index: number, value: string) {
    updatePoints(points.map(p =>
      p.id === pointId
        ? { ...p, subpoints: p.subpoints?.map((s: string, i: number) => i === index ? value : s) ?? [] }
        : p
    ))
  }

  function removeSubpoint(pointId: string, index: number) {
    updatePoints(points.map(p =>
      p.id === pointId
        ? { ...p, subpoints: p.subpoints?.filter((_: string, i: number) => i !== index) ?? [] }
        : p
    ))
  }

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, pointId: string) {
    if (e.key === 'Enter') { e.preventDefault(); addPoint() }
    if (e.key === 'Tab')   { e.preventDefault(); addSubpoint(pointId) }
  }

  return (
    <div>
      {points.map((point, idx) => {
        const isExpanded = expandedIds.has(point.id)
        const hasBody = point.body && point.body.replace(/<[^>]*>/g, '').trim().length > 0

        return (
          <div key={point.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
              <span style={{
                fontSize: 13, fontWeight: 500, color: 'var(--color-text-hint)',
                minWidth: 20, paddingTop: 8, fontFamily: 'var(--font-serif)',
              }}>
                {ROMAN[idx] ?? '•'}
              </span>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={point.text}
                  onChange={(e) => updatePoint(point.id, { text: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, point.id)}
                  placeholder={language === 'ES' ? 'Punto principal...' : 'Main point...'}
                  autoFocus={idx === points.length - 1 && point.text === ''}
                  style={{
                    width: '100%', padding: '7px 10px',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 14, fontFamily: 'var(--font-sans)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <input
  type="text"
  value={point.verseRef ?? ''}
  onChange={(e) => updatePoint(point.id, { verseRef: e.target.value })}
  placeholder={language === 'ES' ? 'Ref. versículo (ej. v. 11–14)' : 'Verse ref (e.g. v. 11–14)'}
  style={{
    width: 'fit-content', padding: '2px 8px',
    border: point.verseRef ? 'none' : '1px dashed var(--color-border-default)',
    borderRadius: 'var(--radius-md)',
    background: 'transparent', color: 'var(--color-text-muted)',
    fontSize: 11, fontFamily: 'var(--font-serif)',
    fontStyle: 'italic', outline: 'none', boxSizing: 'border-box', marginTop: 4,
  }}
/>
              </div>
              <div style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
                {/* Expand/collapse body button */}
                <button
                  onClick={() => toggleExpanded(point.id)}
                  title={isExpanded
                    ? (language === 'ES' ? 'Colapsar notas' : 'Collapse notes')
                    : (language === 'ES' ? 'Añadir notas' : 'Add notes')}
                  style={{
                    padding: '4px 8px', borderRadius: 4,
                    border: `1px solid ${isExpanded ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                    background: isExpanded ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
                    color: isExpanded ? 'var(--color-accent)' : hasBody ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    fontSize: 11, fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {isExpanded ? '▲' : (hasBody ? '✎·' : '✎')}
                </button>
                <button
                  onClick={() => addSubpoint(point.id)}
                  style={{
                    padding: '4px 8px', borderRadius: 4,
                    border: '1px solid var(--color-border-default)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-muted)',
                    fontSize: 10, fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  + {language === 'ES' ? 'sub' : 'sub'}
                </button>
                <button
                  onClick={() => removePoint(point.id)}
                  style={{
                    padding: '4px 6px', borderRadius: 4,
                    border: '1px solid var(--color-border-default)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-muted)',
                    fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  }}
                >×</button>
              </div>
            </div>

            {/* Subpoints */}
            {(point.subpoints ?? []).map((sub: string, j: number) => (
              <div key={j} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginLeft: 30, marginBottom: 3,
              }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-hint)', minWidth: 14, paddingTop: 2 }}>
                  {ALPHA[j] ?? '·'}
                </span>
                <input
                  type="text"
                  value={sub}
                  onChange={(e) => updateSubpoint(point.id, j, e.target.value)}
                  placeholder={language === 'ES' ? 'Sub-punto...' : 'Sub-point...'}
                  style={{
                    flex: 1, padding: '5px 8px',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                />
                <button
                  onClick={() => removeSubpoint(point.id, j)}
                  style={{
                    padding: '3px 6px', borderRadius: 4,
                    border: '1px solid var(--color-border-default)',
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-muted)', fontSize: 11, cursor: 'pointer',
                  }}
                >×</button>
              </div>
            ))}

            {/* Body editor — shown when expanded */}
            {isExpanded && (
              <PointBodyEditor
                pointId={point.id}
                body={point.body ?? ''}
                onChange={updatePointBody}
                language={language}
              />
            )}

            {/* Snippet preview when collapsed but has content */}
            {!isExpanded && hasBody && (
              <div
                onClick={() => toggleExpanded(point.id)}
                style={{
                  marginLeft: 30, marginTop: 4,
                  fontSize: 11, color: 'var(--color-text-hint)',
                  fontStyle: 'italic', cursor: 'pointer',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: 400,
                }}
              >
                {point.body!.replace(/<[^>]*>/g, '').slice(0, 80)}…
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={addPoint}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '9px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border-default)',
          background: 'transparent', color: 'var(--color-text-muted)',
          fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: 4,
        }}
      >
        + {language === 'ES' ? 'Añadir punto' : 'Add point'}
      </button>

      <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginTop: 8 }}>
        {language === 'ES'
          ? 'Enter para nuevo punto · Tab para sub-punto'
          : 'Enter for new point · Tab for sub-point'}
      </p>
    </div>
  )
}