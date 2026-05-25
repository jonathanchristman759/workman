

import { useCallback, useEffect, useState } from 'react'
import i18n from '@/lib/i18n'
import { useAuth } from '@/components/providers/AuthProvider'
import { invoke } from '@tauri-apps/api/core'

type Language = 'EN' | 'ES'

// Module-level singleton so all components share one language state
// without needing a separate context provider
let _language: Language = 'EN'
const _listeners = new Set<() => void>()

function notify() {
  _listeners.forEach((fn) => fn())
}

export function useLanguage() {
  const { user } = useAuth()
  const [, forceUpdate] = useState(0)

  // Subscribe to language changes from any component
  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1)
    _listeners.add(handler)
    return () => { _listeners.delete(handler) }
  }, [])

  // Sync from user preference on mount
  useEffect(() => {
    if (user?.language && user.language !== _language) {
      _language = user.language as Language
      i18n.changeLanguage(_language.toLowerCase())
      notify()
    }
  }, [user?.language])

  const setLanguage = useCallback(async (lang: Language) => {
    _language = lang
    i18n.changeLanguage(lang.toLowerCase())
    localStorage.setItem('workman-language', lang)
    notify()

    // Persist to API if signed in
    if (user) {
  try {
    await invoke('update_settings', { input: { language: lang } })
  } catch (err) {
    console.error('Failed to save language preference:', err)
  }
}
  }, [user])

  const toggleLanguage = useCallback(() => {
    setLanguage(_language === 'EN' ? 'ES' : 'EN')
  }, [setLanguage])

  // Simple translation helper — falls back to key if not found
  const t = useCallback((key: string, fallback?: string): string => {
    const result = i18n.t(key)
    return result !== key ? result : (fallback ?? key)
  }, [])

  return {
    language:       _language,
    setLanguage,
    toggleLanguage,
    t,
    isEnglish:      _language === 'EN',
    isSpanish:      _language === 'ES',
  }
}
