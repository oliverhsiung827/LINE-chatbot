import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiRequestError } from '../lib/api'
import type { Admin } from '../../shared/types'

interface AuthContextValue {
  admin: Admin | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<Admin>('/auth/me')
      setAdmin(me)
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) setAdmin(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<Admin>('/auth/login', { email, password })
    setAdmin(result)
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setAdmin(null)
  }, [])

  return <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
