import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esAdmin } from './roles'
import { headerBtnClass, headerClass, mainClass } from './ui'
import {
  BookOpen,
  Banknote,
  BookMarked,
  CalendarClock,
  LogOut,
  ScrollText,
  ShoppingCart,
  Users,
} from 'lucide-react'

const cardClass =
  'bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col items-center justify-center p-6 gap-3 cursor-pointer'

const iconClass = 'w-6 h-6 text-green-600'
const labelClass = 'font-semibold text-gray-700'

export default function Dashboard() {
  const { perfil, cargandoPerfil } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Mensaje enviado por otra pantalla (p. ej. "Préstamo confirmado")
  const [aviso] = useState<string | null>(
    () => (location.state as { mensaje?: string } | null)?.mensaje ?? null,
  )

  // Limpia el state del historial para que no reaparezca al recargar
  useEffect(() => {
    if (aviso) navigate('.', { replace: true, state: null })
  }, [aviso, navigate])

  const nombre = perfil?.nombre ?? ''
  const rol = perfil?.rol ?? ''

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (cargandoPerfil) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Cargando...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className={headerClass}>
        <h1 className="text-xl font-bold tracking-tight">
          Facultad de Ingeniería Mecánica y Eléctrica
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-50">
            {nombre} ({rol})
          </span>
          <button onClick={handleLogout} className={headerBtnClass}>
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      {/* Main */}
      <main className={mainClass}>
        {aviso && (
          <p className="rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
            {aviso}
          </p>
        )}
        <h2 className="text-2xl font-semibold text-gray-800">Menú</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/libros" className={cardClass}>
            <BookOpen className={iconClass} />
            <span className={labelClass}>Libros</span>
          </Link>
          <Link to="/carrito" className={cardClass}>
            <ShoppingCart className={iconClass} />
            <span className={labelClass}>Carrito</span>
          </Link>
          <Link to="/prestamos" className={cardClass}>
            <BookMarked className={iconClass} />
            <span className={labelClass}>Préstamos</span>
          </Link>
          <Link to="/reservaciones" className={cardClass}>
            <CalendarClock className={iconClass} />
            <span className={labelClass}>Reservaciones</span>
          </Link>
          <Link to="/multas" className={cardClass}>
            <Banknote className={iconClass} />
            <span className={labelClass}>Multas</span>
          </Link>
          <Link to="/historial" className={cardClass}>
            <ScrollText className={iconClass} />
            <span className={labelClass}>Historial</span>
          </Link>
          {esAdmin(rol) && (
            <Link to="/usuarios" className={cardClass}>
              <Users className={iconClass} />
              <span className={labelClass}>Usuarios</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
