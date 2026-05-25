

import { useState, KeyboardEvent } from 'react'
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

export function OutlineEditor({ points, onChange, language }: OutlineEditorProps) {
  function updatePoint(id: string, updates: Partial<OutlinePoint>) {
    onChange(points.map((p) => p.id === id ? { ...p, ...updates } : p))
  }

  function addPoint() {
    onChange([...points, { id: generateId(), text: '', subpoints: [] }])
  }

  function removePoint(id: string) {
    onChange(points.filter((p) => p.id !== id))
  }

  function addSubpoint(pointId: string) {
    onChange(points.map((p) =>
      p.id === pointId ? { ...p, subpoints: [...p.subpoints, ''] } : p
    ))
  }

  function updateSubpoint(pointId: string, index: number, value: string) {
    onChange(points.map((p) =>
      p.id === pointId
        ? { ...p, subpoints: p.subpoints.map((s, i) => i === index ? value : s) }
        : p
    ))
  }

  function removeSubpoint(pointId: string, index: number) {
    onChange(points.map((p) =>
      p.id === pointId
        ? { ...p, subpoints: p.subpoints.filter((_, i) => i !== index) }
        : p
    ))
  }

  function handlePointKeyDown(e: KeyboardEvent, pointId: string) {
    if (e.key === 'Enter' && !e.shiftKey) {
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
      {points.map((point, i) => (
        <div key={point.id} style={{ marginBottom: 14 }}>

          {/* Main point */}
          <div style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          10,
            padding:      '10px 12px',
            background:   'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 4,
          }}>
            <span style={{
              fontSize:   13,
              fontWeight: 600,
              color:      'var(--color-accent)',
              minWidth:   24,
              paddingTop: 2,
              fontFamily: 'var(--font-serif)',
            }}>
              {ROMAN[i] ?? `${i + 1}.`}
            </span>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={point.text}
                onChange={(e) => updatePoint(point.id, { text: e.target.value })}
                onKeyDown={(e) => handlePointKeyDown(e, point.id)}
                placeholder={language === 'ES' ? 'Punto principal…' : 'Main point…'}
                style={{
                  width:      '100%',
                  border:     'none',
                  background: 'transparent',
                  fontSize:   14,
                  fontWeight: 500,
                  color:      'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)',
                  outline:    'none',
                  padding:    0,
                }}
              />
              {/* Verse ref */}
              <input
                type="text"
                value={point.verseRef ?? ''}
                onChange={(e) => updatePoint(point.id, { verseRef: e.target.value })}
                placeholder={language === 'ES' ? 'Referencia (ej. v. 11–14)' : 'Verse ref (e.g. v. 11–14)'}
                style={{
                  width:      '100%',
                  border:     'none',
                  background: 'transparent',
                  fontSize:   11,
                  color:      'var(--color-text-muted)',
                  fontFamily: 'var(--font-sans)',
                  outline:    'none',
                  padding:    '2px 0 0',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => addSubpoint(point.id)}
                title={language === 'ES' ? 'Añadir subpunto' : 'Add sub-point'}
                style={{
                  fontSize:   10,
                  padding:    '2px 7px',
                  borderRadius: 4,
                  border:     '1px solid var(--color-border-default)',
                  background: 'transparent',
                  color:      'var(--color-text-muted)',
                  cursor:     'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                + {language === 'ES' ? 'sub' : 'sub'}
              </button>
              <button
                onClick={() => removePoint(point.id)}
                title={language === 'ES' ? 'Eliminar punto' : 'Remove point'}
                style={{
                  fontSize:   11,
                  padding:    '2px 6px',
                  borderRadius: 4,
                  border:     'none',
                  background: 'transparent',
                  color:      'var(--color-text-hint)',
                  cursor:     'pointer',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Sub-points */}
          {point.subpoints.map((sub, j) => (
            <div key={j} style={{
              display:    'flex',
              alignItems: 'flex-start',
              gap:        8,
              padding:    '6px 10px',
              marginLeft: 24,
              borderLeft: '2px solid var(--color-border-subtle)',
              marginBottom: 3,
            }}>
              <span style={{
                fontSize:   11,
                color:      'var(--color-text-hint)',
                minWidth:   16,
                paddingTop: 2,
              }}>
                {ALPHA[j]}.
              </span>
              <input
                type="text"
                value={sub}
                onChange={(e) => updateSubpoint(point.id, j, e.target.value)}
                placeholder={language === 'ES' ? 'Subpunto…' : 'Sub-point…'}
                style={{
                  flex:       1,
                  border:     'none',
                  background: 'transparent',
                  fontSize:   12,
                  color:      'var(--color-text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  outline:    'none',
                  padding:    0,
                }}
              />
              <button
                onClick={() => removeSubpoint(point.id, j)}
                style={{
                  fontSize:   11,
                  border:     'none',
                  background: 'transparent',
                  color:      'var(--color-text-hint)',
                  cursor:     'pointer',
                  padding:    0,
                }}
              >×</button>
            </div>
          ))}

        </div>
      ))}

      {/* Add point button */}
      <button
        onClick={addPoint}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          padding:      '8px 12px',
          borderRadius: 'var(--radius-md)',
          border:       '1.5px dashed var(--color-border-default)',
          background:   'transparent',
          color:        'var(--color-text-muted)',
          fontSize:     12,
          fontFamily:   'var(--font-sans)',
          cursor:       'pointer',
          width:        '100%',
          marginTop:    4,
        }}
      >
        + {language === 'ES' ? 'Añadir punto' : 'Add point'}
      </button>

      <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginTop: 8 }}>
        {language === 'ES'
          ? 'Enter para nuevo punto · Tab para subpunto'
          : 'Enter for new point · Tab for sub-point'}
      </p>
    </div>
  )
}
