

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme, Theme } from '@/components/providers/ThemeProvider'

type SettingsSection = 'profile' | 'appearance' | 'language' | 'lexicon' | 'data'

export default function SettingsPage() {
  const { user, refreshUser }  = useAuth()
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme }    = useTheme()
  const router                 = useNavigate()

  const [section,      setSection]      = useState<SettingsSection>('profile')
  const [name,         setName]         = useState(user?.name ?? '')
  const [church,       setChurch]       = useState(user?.church ?? '')
  const [denomination, setDenomination] = useState(user?.denomination ?? '')
  const [fontSize,     setFontSize]     = useState(user?.editorFontSize ?? 16)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await invoke('update_settings', { input: {
        name, church: church || null, denomination: denomination || null,
        language: language as 'EN' | 'ES',
        theme:    theme.toUpperCase(),
        editorFontSize: fontSize,
      }})
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const THEMES: { value: Theme; label: string; bg: string; accent: string }[] = [
    { value: 'parchment', label: 'Parchment', bg: '#F8F7F4', accent: '#C9A96E' },
    { value: 'midnight',  label: 'Midnight',  bg: '#16181C', accent: '#7B8FBB' },
    { value: 'linen',     label: 'Linen',     bg: '#F2EDE6', accent: '#8B5E3C' },
    { value: 'slate',     label: 'Slate',     bg: '#F4F6F8', accent: '#3B5E8C' },
    { value: 'olive',     label: 'Olive',     bg: '#F5F4EE', accent: '#6B7A40' },
  ]

  const sidebarItems: { id: SettingsSection; label: string; labelEs: string }[] = [
    { id: 'profile',    label: 'Profile',    labelEs: 'Perfil'     },
    { id: 'appearance', label: 'Appearance', labelEs: 'Apariencia' },
    { id: 'language',   label: 'Language',   labelEs: 'Idioma'     },
    { id: 'lexicon',    label: 'Lexicon',    labelEs: 'Léxico'     },
    { id: 'data',       label: 'Data',       labelEs: 'Datos'      },
  ]

  return (
    <AppLayout>
      <div style={{
        background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Configuración' : 'Settings'}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              fontSize: 12, padding: '5px 16px', borderRadius: 6,
              border: '1px solid var(--color-accent)', background: 'var(--color-accent)',
              color: 'var(--color-accent-text)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saved    ? (language === 'ES' ? '✓ Guardado' : '✓ Saved')   :
             saving   ? (language === 'ES' ? 'Guardando…' : 'Saving…')   :
                        (language === 'ES' ? 'Guardar'    : 'Save changes')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0,1fr)', minHeight: 520 }}>

          {/* Sidebar */}
          <div style={{ padding: '14px', borderRight: '1px solid var(--color-border-subtle)' }}>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  fontSize: 13, padding: '6px 10px', borderRadius: 6,
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  background: section === item.id ? 'var(--color-accent-muted)' : 'transparent',
                  color:      section === item.id ? 'var(--color-accent-text)'  : 'var(--color-text-secondary)',
                  fontWeight: section === item.id ? 500 : 400, marginBottom: 2,
                }}
              >
                {language === 'ES' ? item.labelEs : item.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ padding: '20px 24px', overflowY: 'auto' }}>

            {/* Profile */}
            {section === 'profile' && (
              <div>
                <p style={sectionTitleStyle}>{language === 'ES' ? 'Perfil pastoral' : 'Pastor profile'}</p>
                {[
                  { label: language === 'ES' ? 'Nombre completo'   : 'Full name',     value: name,         setter: setName,         placeholder: 'Pastor James' },
                  { label: language === 'ES' ? 'Nombre de iglesia' : 'Church name',   value: church,       setter: setChurch,       placeholder: 'Grace Community Church' },
                  { label: language === 'ES' ? 'Denominación'      : 'Denomination',  value: denomination, setter: setDenomination, placeholder: 'Baptist, Presbyterian…' },
                ].map((f) => (
                  <div key={f.label} style={{ marginBottom: 14 }}>
                    <label style={filterLabelStyle}>{f.label}</label>
                    <input
                      type="text" value={f.value}
                      onChange={(e) => f.setter(e.target.value)}
                      placeholder={f.placeholder}
                      style={filterInputStyle}
                    />
                  </div>
                ))}
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                  {language === 'ES' ? 'Email: ' : 'Email: '}{user?.email}
                </p>
              </div>
            )}

            {/* Appearance */}
            {section === 'appearance' && (
              <div>
                <p style={sectionTitleStyle}>{language === 'ES' ? 'Apariencia' : 'Appearance'}</p>
                <label style={filterLabelStyle}>{language === 'ES' ? 'Tema de color' : 'Color theme'}</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  {THEMES.map((t) => (
                    <div
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      style={{
                        cursor: 'pointer', textAlign: 'center',
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: t.bg,
                        border: `3px solid ${theme === t.value ? t.accent : 'transparent'}`,
                        outline: `1px solid ${theme === t.value ? 'transparent' : 'var(--color-border-default)'}`,
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 20, height: 20, background: t.accent,
                          borderRadius: '50% 0 0 0',
                        }} />
                      </div>
                      <p style={{
                        fontSize: 10, color: theme === t.value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                        margin: '5px 0 0', fontWeight: theme === t.value ? 500 : 400,
                      }}>
                        {t.label}
                      </p>
                    </div>
                  ))}
                </div>

                <label style={filterLabelStyle}>
                  {language === 'ES' ? 'Tamaño de fuente en editor' : 'Editor font size'}
                </label>
                <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{ ...filterInputStyle, width: 160 }}>
                  <option value={14}>{language === 'ES' ? 'Pequeño (14px)' : 'Small (14px)'}</option>
                  <option value={16}>{language === 'ES' ? 'Normal (16px)'  : 'Default (16px)'}</option>
                  <option value={18}>{language === 'ES' ? 'Grande (18px)'  : 'Large (18px)'}</option>
                  <option value={20}>{language === 'ES' ? 'Muy grande (20px)' : 'Extra large (20px)'}</option>
                </select>
              </div>
            )}

            {/* Language */}
            {section === 'language' && (
              <div>
                <p style={sectionTitleStyle}>{language === 'ES' ? 'Idioma' : 'Language'}</p>
                <label style={filterLabelStyle}>
                  {language === 'ES' ? 'Idioma de la interfaz' : 'Interface language'}
                </label>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                  {language === 'ES'
                    ? 'Cambia el idioma de la interfaz y el texto bíblico (KJV ↔ RVR60).'
                    : 'Switches the entire interface and Bible text (KJV ↔ RVR60).'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'EN', label: 'English (KJV)' },
                    { value: 'ES', label: 'Español (RVR60)' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLanguage(opt.value as 'EN' | 'ES')}
                      style={{
                        padding: '8px 20px', borderRadius: 6, fontSize: 13,
                        border: `1px solid ${language === opt.value ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                        background: language === opt.value ? 'var(--color-accent)' : 'transparent',
                        color: language === opt.value ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: language === opt.value ? 500 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lexicon */}
            {section === 'lexicon' && (
              <div>
                <p style={sectionTitleStyle}>{language === 'ES' ? 'Fuentes del léxico' : 'Lexicon sources'}</p>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-md)', marginBottom: 8,
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                      {language === 'ES' ? 'Datos abiertos' : 'Open datasets'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                      OSHB · SBLGNT · Strong's
                    </p>
                  </div>
                  <span className="workman-badge workman-badge-success">
                    {language === 'ES' ? 'Activo' : 'Active'}
                  </span>
                </div>

                <div style={{
                  background: 'var(--color-info-muted)', borderRadius: 'var(--radius-md)',
                  padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-info)', margin: '0 0 3px' }}>
                      Logos Bible Software
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-interactive)', margin: 0 }}>
                      {user?.logosConnected
                        ? (language === 'ES' ? 'Cuenta conectada' : 'Account connected')
                        : (language === 'ES' ? 'Conecta tu cuenta de Logos para BDAG, BDB, HALOT' : 'Connect your Logos account for BDAG, BDB, HALOT')}
                    </p>
                  </div>
                  <button style={{
                    fontSize: 12, padding: '6px 14px', borderRadius: 6,
                    border: '1px solid var(--color-info)', background: 'var(--color-info)',
                    color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  }}>
                    {user?.logosConnected
                      ? (language === 'ES' ? 'Desconectar' : 'Disconnect')
                      : (language === 'ES' ? 'Conectar Logos' : 'Connect Logos')}
                  </button>
                </div>
              </div>
            )}

            {/* Data */}
            {section === 'data' && (
              <div>
                <p style={sectionTitleStyle}>{language === 'ES' ? 'Datos y exportación' : 'Data & export'}</p>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)', marginBottom: 8,
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
                      {language === 'ES' ? 'Exportar todos los sermones' : 'Export all sermons'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                      {language === 'ES'
                        ? 'Descarga el archivo completo como PDFs comprimidos'
                        : 'Download your full archive as a ZIP of PDF files'}
                    </p>
                  </div>
                  <button className="workman-btn" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    ↓ {language === 'ES' ? 'Exportar' : 'Export'}
                  </button>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', border: '1px solid var(--color-danger-muted)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-danger)', margin: '0 0 2px' }}>
                      {language === 'ES' ? 'Eliminar cuenta' : 'Delete account'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                      {language === 'ES'
                        ? 'Elimina permanentemente tu cuenta y todos tus sermones'
                        : 'Permanently removes your account and all sermon data'}
                    </p>
                  </div>
                  <button style={{
                    fontSize: 12, padding: '6px 12px', borderRadius: 6,
                    border: '1px solid var(--color-danger-muted)', background: 'transparent',
                    color: 'var(--color-danger)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}>
                    {language === 'ES' ? 'Eliminar' : 'Delete account'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  )
}

const filterLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--color-text-secondary)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

const filterInputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 12, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500,
  color: 'var(--color-text-primary)',
  margin: '0 0 14px',
  paddingBottom: 8,
  borderBottom: '1px solid var(--color-border-subtle)',
}
