import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esAdmin } from './roles'

const cardClass =
  'bg-white p-6 rounded-lg shadow text-center cursor-pointer hover:shadow-lg'

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
      <header className="bg-green-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          Facultad de Ingeniería Mecánica y Eléctrica
        </h1>
        <div className="flex items-center gap-4">
          <span>
            {nombre} ({rol})
          </span>
          <button
            onClick={handleLogout}
            className="bg-white text-blue-600 px-3 py-1 rounded hover:bg-gray-100"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="p-8">
        {aviso && (
          <p className="mb-4 rounded bg-green-100 text-green-800 px-4 py-2">
            {aviso}
          </p>
        )}
        <h2 className="text-2xl font-semibold mb-6">Menú</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/libros" className={cardClass}>
            📚 Libros
          </Link>
          <Link to="/carrito" className={cardClass}>
            🛒 Carrito
          </Link>
          <Link to="/prestamos" className={cardClass}>
            📖 Préstamos
          </Link>
          <Link to="/reservaciones" className={cardClass}>
            📅 Reservaciones
          </Link>
          <Link to="/multas" className={cardClass}>
            💰 Multas
          </Link>
          <Link to="/historial" className={cardClass}>
            🧾 Historial
          </Link>
          {esAdmin(rol) && (
            <Link to="/usuarios" className={cardClass}>
              👥 Usuarios
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
