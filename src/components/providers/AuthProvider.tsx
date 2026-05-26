import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

interface User {
  name:           string
  church?:        string | null
  denomination?:  string | null
  language:       'EN' | 'ES'
  theme:          string
  editorFontSize: number
  logosConnected: boolean
}

interface AuthContextValue {
  user:        User | null
  loading:     boolean
  refreshUser: () => Promise<void>
  signOut:     () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user:        null,
  loading:     true,
  refreshUser: async () => {},
  signOut:     async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const settings = await invoke<User>('get_settings')
      setUser(settings)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setUser({
        name:           '',
        language:       'EN',
        theme:          'parchment',
        editorFontSize: 16,
        logosConnected: false,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  async function checkForUpdates() {
  try {
    const update = await check()
    if (update?.available) {
      const yes = window.confirm(
        `Workman ${update.version} is available.\n\n${update.body ?? ''}\n\nInstall now?`
      )
      if (yes) {
        await update.downloadAndInstall()
        await relaunch()
      }
    }
  } catch (err) {
    console.error('Update check failed:', err)
  }
}

  useEffect(() => {
    refreshUser()
    checkForUpdates()
  }, [refreshUser])

  const signOut = useCallback(async () => {
    // No sign out needed for desktop app
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}