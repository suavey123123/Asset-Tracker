import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

function applyTenantColor(color) {
  const root = document.documentElement
  if (color) {
    root.style.setProperty('--accent', color)
    // Generate a subtle bg version
    root.style.setProperty('--accent-bg', color + '1a')
    root.style.setProperty('--accent-border', color + '40')
  } else {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--accent-bg')
    root.style.removeProperty('--accent-border')
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data?.blocked) {
      await supabase.auth.signOut()
      setUser(null); setProfile(null)
      return
    }
    setProfile(data)
    // Load tenant info
    if (data?.tenant_id) {
      const { data: t } = await supabase.from('tenants').select('*').eq('id', data.tenant_id).single()
      setTenant(t)
    // Only apply color for the user's own active tenant
    if (data?.tenant_id === t?.id) {
      applyTenantColor(t?.accent_color)
    }
    }
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, tenant, loading, signIn, signOut, isAdmin, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
