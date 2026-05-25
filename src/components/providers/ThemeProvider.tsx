// Workman — ThemeProvider.tsx
// apps/web/src/components/providers/ThemeProvider.tsx
// Reads the user's saved theme and applies it to the <html> element.
// Also exposes a hook for changing the theme from settings.



import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useAuth } from './AuthProvider'
import { invoke } from '@tauri-apps/api/core'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type Theme = 'parchment' | 'midnight' | 'linen' | 'slate' | 'olive'

interface ThemeContextValue {
  theme:     Theme
  setTheme:  (theme: Theme) => Promise<void>
}

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme:    'parchment',
  setTheme: async () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [theme, setThemeState] = useState<Theme>('parchment')

  // Apply theme from user preferences when they load
  useEffect(() => {
    if (user?.theme) {
      const t = user.theme.toLowerCase() as Theme
      setThemeState(t)
      document.documentElement.setAttribute('data-theme', t)
    }
  }, [user?.theme])

  // Also apply from localStorage on first paint to avoid flash
  useEffect(() => {
    const saved = localStorage.getItem('workman-theme') as Theme | null
    if (saved) {
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('workman-theme', newTheme)

    // Persist to the API if the user is signed in
    if (user) {
      try {
        await invoke('update_settings', { input: { theme: newTheme } })
      } catch (err) {
        console.error('Failed to save theme preference:', err)
      }
    }
  }, [user])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
