import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import Libros from './Libros'

interface Props {
  session: Session
}

export default function Dashboard({ session }: Props) {
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('')
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'menu' | 'libros'>('menu')

  useEffect(() => {
    const cargarUsuario = async () => {
      console.log("ID de sesión actual:", session.user.id)

      const { data, error } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('id_usuario', session.user.id)
        .maybeSingle()

      console.log("Datos recibidos:", data)
      console.log("Error recibido:", error)

      if (!error && data) {
        setNombre(data.nombre)
        setRol(data.rol)
      }
      setCargando(false)
    }

    cargarUsuario()
  }, [session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Cargando...
      </div>
    )
  }

  if (vista === 'libros') {
    return <Libros rol={rol} onVolver={() => setVista('menu')} />
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
        <h2 className="text-2xl font-semibold mb-6">Menú</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => setVista('libros')}
            className="bg-white p-6 rounded-lg shadow text-center cursor-pointer hover:shadow-lg"
          >
            📚 Libros
          </div>
          <div className="bg-white p-6 rounded-lg shadow text-center cursor-pointer hover:shadow-lg">
            📅 Reservaciones
          </div>
          {(rol === 'admin' || rol === 'bibliotecario') && (
            <div className="bg-white p-6 rounded-lg shadow text-center cursor-pointer hover:shadow-lg">
              📖 Préstamos
            </div>
          )}
          {(rol === 'admin' || rol === 'bibliotecario') && (
            <div className="bg-white p-6 rounded-lg shadow text-center cursor-pointer hover:shadow-lg">
              💰 Multas
            </div>
          )}
          {rol === 'admin' && (
            <div className="bg-white p-6 rounded-lg shadow text-center cursor-pointer hover:shadow-lg">
              👥 Usuarios
            </div>
          )}
        </div>
      </main>
    </div>
  )
}