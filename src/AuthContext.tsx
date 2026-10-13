import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface Perfil {
  nombre: string
  rol: string
}

interface AuthContextValue {
  session: Session | null
  /** true mientras Supabase resuelve la sesión inicial */
  cargando: boolean
  perfil: Perfil | null
  /** true mientras se consulta el perfil (nombre/rol) en la tabla usuarios */
  cargandoPerfil: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(false)

  // Sesión de Supabase (inicial + cambios de login/logout)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCargando(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setCargando(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Perfil del usuario (nombre y rol)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) {
      setPerfil(null)
      setCargandoPerfil(false)
      return
    }

    let cancelado = false
    setCargandoPerfil(true)

    supabase
      .from('usuarios')
      .select('nombre, rol')
      .eq('id_usuario', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) console.error('Error al cargar el perfil:', error)
        setPerfil(!error && data ? { nombre: data.nombre, rol: data.rol } : null)
        setCargandoPerfil(false)
      })

    return () => {
      cancelado = true
    }
  }, [userId])

  return (
    <AuthContext.Provider value={{ session, cargando, perfil, cargandoPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
