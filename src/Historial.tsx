import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esStaff } from './roles'

/** Columnas oficiales de la tabla `historial` (pág. 7 del PIA). No tiene id_libro. */
interface Historial {
  id_historial: number
  id_usuario: string // UUID
  tipo_transaccion: string // 'Préstamo Finalizado' | 'Multa Pagada' | 'Libro Perdido'
  fecha_transaccion: string
  detalles: string
}

interface HistorialConDetalle extends Historial {
  usuarios: { nombre: string } | { nombre: string }[] | null
}

/** Celdas con líneas verticales que separan las columnas */
const celda = 'p-3 border-x border-gray-200'

function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '').trim()
    if (msg) return msg
  }
  return 'Ocurrió un error inesperado.'
}

function primero<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor
}

function formatearFechaHora(valor?: string | null): string {
  if (!valor) return '—'
  // "YYYY-MM-DD" se interpreta como fecha local para evitar el desfase por zona horaria
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloFecha) {
    return new Date(
      Number(soloFecha[1]),
      Number(soloFecha[2]) - 1,
      Number(soloFecha[3]),
    ).toLocaleDateString('es-MX')
  }
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime())
    ? valor
    : fecha.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

function claseTipo(tipo: string): string {
  switch (tipo) {
    case 'Préstamo Finalizado':
      return 'bg-blue-100 text-blue-800'
    case 'Multa Pagada':
      return 'bg-green-100 text-green-800'
    case 'Libro Perdido':
      return 'bg-red-200 text-red-900'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/** Pantalla de SOLO LECTURA: sin acciones de editar, guardar ni eliminar */
export default function HistorialPantalla() {
  const { session, perfil, cargandoPerfil } = useAuth()
  const staff = esStaff(perfil?.rol)
  const userId = session?.user.id

  const [registros, setRegistros] = useState<HistorialConDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cargandoPerfil || !userId) return
    let cancelado = false

    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        let consulta = supabase
          .from('historial')
          .select('*, usuarios(nombre)')
          .order('fecha_transaccion', { ascending: false })

        // Lector: solo su propio historial (RLS también lo garantiza en la BD)
        if (!staff) consulta = consulta.eq('id_usuario', userId)

        const { data, error: err } = await consulta
        if (err) throw err
        if (!cancelado) setRegistros((data ?? []) as HistorialConDetalle[])
      } catch (err) {
        if (!cancelado) {
          setError(`No se pudo cargar el historial: ${mensajeDeError(err)}`)
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [cargandoPerfil, userId, staff])

  if (cargandoPerfil) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Cargando...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          {staff ? 'Historial de transacciones' : 'Mi historial'}
        </h1>
        <Link
          to="/dashboard"
          className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
        >
          Volver al menú
        </Link>
      </header>

      <main className="p-8 max-w-6xl">
        <p className="mb-4 text-sm text-gray-600">
          Registro de auditoría: solo lectura. Los eventos más recientes aparecen primero.
        </p>

        {error && (
          <p role="alert" className="mb-4 rounded bg-red-100 text-red-800 px-4 py-2 text-sm">
            {error}
          </p>
        )}

        {cargando ? (
          <p className="text-gray-600">Cargando historial...</p>
        ) : registros.length === 0 && !error ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-600">
            📭 No hay transacciones registradas.
          </div>
        ) : (
          registros.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {staff && <th className={celda}>Usuario</th>}
                    <th className={celda}>Tipo de transacción</th>
                    <th className={celda}>Fecha</th>
                    <th className={celda}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((h) => (
                    <tr key={h.id_historial} className="border-t border-gray-200">
                      {staff && (
                        <td className={celda}>{primero(h.usuarios)?.nombre ?? '—'}</td>
                      )}
                      <td className={celda}>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${claseTipo(
                            h.tipo_transaccion,
                          )}`}
                        >
                          {h.tipo_transaccion}
                        </span>
                      </td>
                      <td className={`${celda} whitespace-nowrap`}>
                        {formatearFechaHora(h.fecha_transaccion)}
                      </td>
                      <td className={celda}>{h.detalles || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </main>
    </div>
  )
}
