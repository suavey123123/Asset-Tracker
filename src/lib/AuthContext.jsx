import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Intercept invite and password recovery - redirect to set password page
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        const hash = window.location.hash
        const params = new URLSearchParams(hash.replace('#', '?'))
        const type = params.get('type')
        if (type === 'invite' || type === 'recovery' || event === 'PASSWORD_RECOVERY') {
          // Don't set user session yet - send to set-password page
          if (window.location.pathname !== '/set-password' && window.location.pathname !== '/reset-password') {
            window.location.href = '/set-password' + window.location.hash
            return
          }
        }
      }
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setTenant(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) { console.error('fetchProfile error:', error.message); setLoading(false); return }
      if (data?.blocked) {
        await supabase.auth.signOut()
        setUser(null); setProfile(null); setTenant(null)
        return
      }
      setProfile(data)
      // Load tenant info
      if (data?.tenant_id) {
        const { data: t, error: te } = await supabase.from('tenants').select('*').eq('id', data.tenant_id).single()
        if (!te) setTenant(t)
      }
    } catch (e) {
      console.error('fetchProfile error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role || 'viewer'
  const isAdmin = role === 'admin'                                    // Super admin only
  const isManager = role === 'manager'                               // Ops manager
  const isTechnician = role === 'technician'                         // Field tech
  const isAuditor = role === 'auditor'                               // Finance auditor
  const isAdminOrManager = isAdmin || isManager                      // Can manage assets/employees
  const canWriteAssets = isAdmin || isManager || isTechnician        // Can update asset status
  const canReadFinancials = isAdmin || isManager || isAuditor        // Can see cost/depreciation
  const canManageUsers = isAdmin                                     // Only super admin
  const isViewer = role === 'viewer'                                 // Read-only, no financials

  return (
    <AuthContext.Provider value={{ user, profile, tenant, role, loading, signIn, signOut, isAdmin, isManager, isTechnician, isAuditor, isAdminOrManager, canWriteAssets, canReadFinancials, canManageUsers, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
