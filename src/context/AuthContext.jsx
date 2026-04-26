import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Escuta mudanças na autenticação (o Supabase v2 dispara um evento 'INITIAL_SESSION' automaticamente)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password, options) => {
    return supabase.auth.signUp({ email, password, options })
  }

  const signIn = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = () => {
    return supabase.auth.signOut()
  }

  // Memoriza o valor do contexto para evitar re-renderizações desnecessárias nos componentes filhos
  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  }), [user, session, loading])

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
