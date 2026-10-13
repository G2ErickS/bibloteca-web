import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function PantallaCarga() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      Cargando...
    </div>
  )
}

/**
 * Guardián de rutas: si no hay sesión activa de Supabase redirige a /login.
 * Se usa como "layout route" y renderiza las rutas hijas con <Outlet />.
 */
export default function ProtectedRoute() {
  const { session, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <PantallaCarga />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
