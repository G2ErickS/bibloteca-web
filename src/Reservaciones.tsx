import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, CalendarClock, Inbox } from 'lucide-react'
import {
  btnPeligroClass,
  headerBtnClass,
  headerClass,
  headerTitleClass,
  insigniaClass,
  mainClass,
  tablaClass,
  tablaContenedorClass,
  tdClass,
  thClass,
  trZebraClass,
  vacioClass,
} from './ui'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esStaff } from './roles'

type EstadoReservacion = 'Pendiente' | 'Completada' | 'Cancelada'

/** Columnas oficiales de la tabla `reservaciones` (Diccionario de Datos, pág. 7) */
interface Reservacion {
  id_reservacion: number
  id_usuario: string // UUID
  id_libro: number
  fecha_solicitud: string
  estado: EstadoReservacion
}

/**
 * Reservación + datos relacionados del join. PostgREST puede devolver el
 * many-to-one como objeto o como arreglo, por eso se normaliza con `primero`.
 */
interface ReservacionConDetalle extends Reservacion {
  libros?: { titulo: string; autor: string } | { titulo: string; autor: string }[] | null
  usuarios?: { nombre: string } | { nombre: string }[] | null
}

interface Aviso {
  tipo: 'exito' | 'error'
  texto: string
}

/** Texto de la excepción SQL (error.message); mensaje genérico si viene vacío */
function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '').trim()
    if (msg) return msg
  }
  return 'Ocurrió un error inesperado.'
}

function primero<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor ?? null
}

function formatearFecha(valor?: string | null): string {
  if (!valor) return '—'
  // "YYYY-MM-DD" se interpreta como fecha local para evitar el desfase por zona horaria
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  const fecha = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString('es-MX')
}

const estadoClase: Record<EstadoReservacion, string> = {
  Pendiente: 'bg-orange-100 text-orange-800',
  Completada: 'bg-green-100 text-green-800',
  Cancelada: 'bg-gray-200 text-gray-700',
}

function InsigniaEstado({ estado }: { estado: EstadoReservacion }) {
  return (
    <span
      className={`${insigniaClass} ${
        estadoClase[estado] ?? 'bg-gray-100 text-gray-800'
      }`}
    >
      {estado}
    </span>
  )
}

export default function Reservaciones() {
  const { session, perfil, cargandoPerfil } = useAuth()
  const staff = esStaff(perfil?.rol)
  const userId = session?.user.id

  const [reservaciones, setReservaciones] = useState<ReservacionConDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [cancelandoId, setCancelandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const bloqueoRef = useRef(false)

  const cargarReservaciones = useCallback(
    async (silencioso = false) => {
      if (!userId) return
      if (!silencioso) setCargando(true)
      try {
        let consulta = supabase
          .from('reservaciones')
          .select('*, libros(titulo, autor), usuarios(nombre)')
          .order('fecha_solicitud', { ascending: false })

        // Lector: solo sus propias reservaciones (RLS también lo garantiza en la BD)
        if (!staff) consulta = consulta.eq('id_usuario', userId)

        const { data, error } = await consulta
        if (error) throw error
        setReservaciones((data ?? []) as ReservacionConDetalle[])
      } catch (err) {
        setAviso({
          tipo: 'error',
          texto: `No se pudieron cargar las reservaciones: ${mensajeDeError(err)}`,
        })
      } finally {
        if (!silencioso) setCargando(false)
      }
    },
    [staff, userId],
  )

  useEffect(() => {
    if (cargandoPerfil || !userId) return
    void cargarReservaciones()
  }, [cargandoPerfil, userId, cargarReservaciones])

  const handleCancelar = async (reservacion: ReservacionConDetalle) => {
    if (bloqueoRef.current) return
    bloqueoRef.current = true
    setAviso(null)
    setCancelandoId(reservacion.id_reservacion)

    const titulo = primero(reservacion.libros)?.titulo ?? 'el libro'

    try {
      const { error } = await supabase.rpc('cancelar_reservacion', {
        p_id_reservacion: reservacion.id_reservacion,
      })
      if (error) throw error

      setAviso({
        tipo: 'exito',
        texto: `Reservación cancelada: "${titulo}".`,
      })
      await cargarReservaciones(true)
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: `No se pudo cancelar la reservación: ${mensajeDeError(err)}`,
      })
    } finally {
      bloqueoRef.current = false
      setCancelandoId(null)
    }
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
      <header className={headerClass}>
        <h1 className={headerTitleClass}>
          <CalendarClock className="w-6 h-6" />
          {staff ? 'Reservaciones' : 'Mis reservaciones'}
        </h1>
        <div className="flex items-center gap-3">
          {!staff && (
            <Link to="/libros" className={headerBtnClass}>
              <BookOpen className="w-4 h-4" />
              Ver libros
            </Link>
          )}
          <Link to="/dashboard" className={headerBtnClass}>
            <ArrowLeft className="w-4 h-4" />
            Volver al menú
          </Link>
        </div>
      </header>

      <main className={mainClass}>
        {aviso && (
          <p
            role={aviso.tipo === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border px-4 py-3 text-sm ${
              aviso.tipo === 'exito'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {cargando ? (
          <p className="text-gray-600">Cargando reservaciones...</p>
        ) : reservaciones.length === 0 ? (
          <div className={vacioClass}>
            <Inbox className="w-8 h-8 text-gray-400" />
            <span>
              {staff
                ? 'No hay reservaciones registradas.'
                : 'No tienes reservaciones. Si un libro está agotado, puedes apartarlo desde el catálogo.'}
            </span>
          </div>
        ) : (
          <div className={tablaContenedorClass}>
            <table className={tablaClass}>
              <thead>
                <tr>
                  {staff && <th className={thClass}>ID</th>}
                  {staff && <th className={thClass}>Usuario</th>}
                  <th className={thClass}>Libro</th>
                  {!staff && <th className={thClass}>Autor</th>}
                  <th className={thClass}>Fecha de solicitud</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} text-right`}>
                    {staff ? 'Acciones' : 'Acción'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {reservaciones.map((r) => {
                  const libro = primero(r.libros)
                  const pendiente = r.estado === 'Pendiente'
                  return (
                    <tr key={r.id_reservacion} className={trZebraClass}>
                      {staff && <td className={tdClass}>{r.id_reservacion}</td>}
                      {staff && (
                        <td className={tdClass}>
                          {primero(r.usuarios)?.nombre ?? '—'}
                        </td>
                      )}
                      <td className={`${tdClass} font-medium`}>{libro?.titulo ?? '—'}</td>
                      {!staff && <td className={tdClass}>{libro?.autor ?? '—'}</td>}
                      <td className={tdClass}>{formatearFecha(r.fecha_solicitud)}</td>
                      <td className={tdClass}>
                        <InsigniaEstado estado={r.estado} />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        {pendiente && (
                          <button
                            onClick={() => handleCancelar(r)}
                            disabled={cancelandoId !== null}
                            className={btnPeligroClass}
                          >
                            {cancelandoId === r.id_reservacion
                              ? 'Cancelando...'
                              : staff
                                ? 'Cancelar Reserva'
                                : 'Cancelar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
