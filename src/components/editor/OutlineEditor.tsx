import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { OutlinePoint } from '@/app/(app)/sermons/[id]/page'

interface OutlineEditorProps {
  points:   OutlinePoint[]
  onChange: (points: OutlinePoint[]) => void
  language: string
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const ALPHA  = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function OutlineEditor({ points: initialPoints, onChange, language }: OutlineEditorProps) {
  // Local state — edits happen here instantly without going through the parent
  const [points, setPoints] = useState<OutlinePoint[]>(initialPoints)
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialized = useRef(false)

  // Keep onChangeRef current without triggering re-renders
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

 // Sync from parent when data first arrives (sermon loads async)
  useEffect(() => {
    if (!isInitialized.current && initialPoints.length > 0) {
      setPoints(initialPoints)
      isInitialized.current = true
    }
  }, [initialPoints])

  // Debounced notify parent — fires 800ms after last change
  function notifyParent(newPoints: OutlinePoint[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(newPoints)
    }, 800)
  }

  function updatePoints(newPoints: OutlinePoint[]) {
    setPoints(newPoints)
    notifyParent(newPoints)
  }

  function updatePoint(id: string, updates: Partial<OutlinePoint>) {
    updatePoints(points.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function addPoint() {
    const newPoint: OutlinePoint = { id: generateId(), text: '', subpoints: [] }
    updatePoints([...points, newPoint])
  }

  function removePoint(id: string) {
    updatePoints(points.filter(p => p.id !== id))
  }

  function addSubpoint(pointId: string) {
    updatePoints(points.map(p =>
      p.id === pointId
        ? { ...p, subpoints: [...(p.subpoints ?? []), ''] }
        : p
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

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, pointId: string) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPoint()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      addSubpoint(pointId)
    }
  }

  return (
    <div>
      {points.map((point, idx) => (
        <div key={point.id} style={{ marginBottom: 14 }}>
          <div style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          10,
            marginBottom: 4,
          }}>
            <span style={{
              fontSize:   13,
              fontWeight: 500,
              color:      'var(--color-text-hint)',
              minWidth:   20,
              paddingTop: 8,
              fontFamily: 'var(--font-serif)',
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
                  width:        '100%',
                  padding:      '7px 10px',
                  border:       '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background:   'var(--color-bg-primary)',
                  color:        'var(--color-text-primary)',
                  fontSize:     14,
                  fontFamily:   'var(--font-sans)',
                  outline:      'none',
                  boxSizing:    'border-box',
                }}
              />
              <input
                type="text"
                value={point.verseRef ?? ''}
                onChange={(e) => updatePoint(point.id, { verseRef: e.target.value })}
                placeholder={language === 'ES' ? 'Ref. versículo (ej. v. 11–14)' : 'Verse ref (e.g. v. 11–14)'}
                style={{
                  width:        '100%',
                  padding:      '4px 10px',
                  border:       'none',
                  borderRadius: 'var(--radius-md)',
                  background:   'transparent',
                  color:        'var(--color-text-muted)',
                  fontSize:     11,
                  fontFamily:   'var(--font-serif)',
                  fontStyle:    'italic',
                  outline:      'none',
                  boxSizing:    'border-box',
                  marginTop:    2,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => addSubpoint(point.id)}
                style={{
                  padding:      '4px 8px',
                  borderRadius: 4,
                  border:       '1px solid var(--color-border-default)',
                  background:   'var(--color-bg-secondary)',
                  color:        'var(--color-text-muted)',
                  fontSize:     10,
                  fontFamily:   'var(--font-sans)',
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                }}
              >
                + {language === 'ES' ? 'sub' : 'sub'}
              </button>
              <button
                onClick={() => removePoint(point.id)}
                style={{
                  padding:      '4px 6px',
                  borderRadius: 4,
                  border:       '1px solid var(--color-border-default)',
                  background:   'var(--color-bg-secondary)',
                  color:        'var(--color-text-muted)',
                  fontSize:     12,
                  fontFamily:   'var(--font-sans)',
                  cursor:       'pointer',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {(point.subpoints ?? []).map((sub: string, j: number) => (
            <div key={j} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              marginLeft:   30,
              marginBottom: 3,
            }}>
              <span style={{
                fontSize:   11,
                color:      'var(--color-text-hint)',
                minWidth:   14,
                paddingTop: 2,
              }}>
                {ALPHA[j] ?? '·'}
              </span>
              <input
                type="text"
                value={sub}
                onChange={(e) => updateSubpoint(point.id, j, e.target.value)}
                placeholder={language === 'ES' ? 'Sub-punto...' : 'Sub-point...'}
                style={{
                  flex:         1,
                  padding:      '5px 8px',
                  border:       '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background:   'var(--color-bg-primary)',
                  color:        'var(--color-text-primary)',
                  fontSize:     12,
                  fontFamily:   'var(--font-sans)',
                  outline:      'none',
                }}
              />
              <button
                onClick={() => removeSubpoint(point.id, j)}
                style={{
                  padding:      '3px 6px',
                  borderRadius: 4,
                  border:       '1px solid var(--color-border-default)',
                  background:   'var(--color-bg-secondary)',
                  color:        'var(--color-text-muted)',
                  fontSize:     11,
                  cursor:       'pointer',
                }}
              >×</button>
            </div>
          ))}
        </div>
      ))}

      <button
        onClick={addPoint}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          width:        '100%',
          padding:      '9px 12px',
          borderRadius: 'var(--radius-md)',
          border:       '1px dashed var(--color-border-default)',
          background:   'transparent',
          color:        'var(--color-text-muted)',
          fontSize:     13,
          fontFamily:   'var(--font-sans)',
          cursor:       'pointer',
          marginTop:    4,
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
