import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      trust: null,

      login: async (username, password) => {
        const { data } = await api.post('/auth/login', { username, password })
        set({
          token: data.token,
          user: data.user,
          trust: data.trust,
        })
        return data
      },

      logout: () => {
        set({ user: null, token: null, trust: null })
      },

      isAdmin: () => get().user?.role === 'ADMIN',
      isPlatformAdmin: () => Boolean(get().user?.is_platform_admin),
    }),
    {
      name: 'temple_auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        trust: state.trust,
      }),
    }
  )
)
