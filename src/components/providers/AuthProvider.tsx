import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { invoke } from '@tauri-apps/api/core'

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
      // Set default user if settings can't be loaded
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

  useEffect(() => {
    refreshUser()
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