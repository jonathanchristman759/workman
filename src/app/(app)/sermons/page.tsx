import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'

interface Sermon {
  id:           string
  title:        string
  passage_ref:  string
  status:       string
  word_count:   number
  delivery_date: string | null
  updated_at:   string
}

export default function SermonsPage() {
  const { language } = useLanguage()
  const [sermons,  setSermons]  = useState<Sermon[]>([])
  const [loading,  setLoading]  = useState(true)
const navigate = useNavigate()

useEffect(() => {
  const lastId = localStorage.getItem('lastSermonId')
  if (lastId) {
    navigate(`/sermons/${lastId}`)
  }
}, [navigate])

  useEffect(() => {
    async function load() {
      try {
        const data = await invoke<Sermon[]>('get_sermons', {})
        setSermons(data)
      } catch (err) {
        console.error('Failed to load sermons:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AppLayout>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 20,
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Sermones' : 'Sermons'}
          </h1>
          <Link to="/sermons/new" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '7px 16px', borderRadius: 6,
              border: '1px solid var(--color-accent)',
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
              fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              + {language === 'ES' ? 'Nuevo sermón' : 'New sermon'}
            </button>
          </Link>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            {language === 'ES' ? 'Cargando…' : 'Loading…'}
          </p>
        ) : sermons.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
              {language === 'ES'
                ? 'Aún no tienes sermones. ¡Crea tu primero!'
                : "You don't have any sermons yet. Create your first one!"}
            </p>
            <Link to="/sermons/new" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '8px 20px', borderRadius: 6,
                border: '1px solid var(--color-accent)',
                background: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
                fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                + {language === 'ES' ? 'Nuevo sermón' : 'New sermon'}
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sermons.map((sermon) => (
              <Link key={sermon.id} to={`/sermons/${sermon.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                      {sermon.title}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                      {sermon.passage_ref}
                      {sermon.delivery_date && ` · ${new Date(sermon.delivery_date).toLocaleDateString()}`}
                      {` · ${sermon.status}`}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="var(--color-text-hint)"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}