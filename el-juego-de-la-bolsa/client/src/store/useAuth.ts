import { create } from 'zustand'
import { setAuth, api } from '../utils/api'

interface AuthState {
  token: string | null
  user: { id: number; name: string; email: string; role: string } | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    set({ token: data.access_token, user: data.user })
    setAuth(data.access_token)
    return true
  },
  logout() {
    set({ token: null, user: null })
    setAuth(null)
  },
}))
