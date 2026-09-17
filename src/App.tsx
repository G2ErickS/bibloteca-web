import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import Login from './Login'
import Dashboard from './Dashboard'

function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuchar cambios en la sesión (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return session ? <Dashboard session={session} /> : <Login />
}

export default App
