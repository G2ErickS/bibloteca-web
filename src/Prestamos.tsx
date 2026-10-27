import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esStaff } from './roles'
import { ArrowLeft, BookMarked, Inbox } from 'lucide-react'
import {
  btnPrimarioClass,
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

type EstadoPrestamo = 'Activo' | 'Finalizado' | 'Vencido'

/** Columnas oficiales de la tabla `prestamos` */
interface Prestamo {
  id_prestamo: number
  id_usuario: string 
  id_libro: number
  fecha_prestamo: string
  fecha_limite: string
  fecha_devolucion?: string | null
  estado: EstadoPrestamo
}

/** Préstamo + datos relacionados traídos con el join del select */
interface PrestamoConDetalle extends Prestamo {
  usuarios: { nombre: string } | { nombre: string }[] | null
  libros: { titulo: string } | { titulo: string }[] | null
}

interface Aviso {
  tipo: 'exito' | 'error'
  texto: string
}

type Pestana = 'activos' | 'historial'

/** Texto de la excepción SQL (error.message); mensaje genérico si viene vacío */
function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '').trim()
    if (msg) return msg
  }
  return 'Ocurrió un error inesperado.'
}

/** Un join many-to-one puede venir como objeto o como arreglo */
function primero<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor
}

function formatearFecha(valor?: string | null): string {
  if (!valor) return '—'
  // Las fechas "YYYY-MM-DD" se interpretan como locales para evitar el desfase por zona horaria
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  const fecha = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString('es-MX')
}

const estadoClase: Record<EstadoPrestamo, string> = {
  Activo: 'bg-blue-100 text-blue-800',
  Finalizado: 'bg-green-100 text-green-800',
  Vencido: 'bg-red-100 text-red-800',
}

function InsigniaEstado({ estado }: { estado: EstadoPrestamo }) {
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

interface TablaProps {
  prestamos: PrestamoConDetalle[]
  /** Muestra la columna "Usuario" (vista de staff) */
  mostrarUsuario: boolean
  /** Si se pasa, se muestra la columna de acción con "Procesar Devolución" */
  onDevolver?: (p: PrestamoConDetalle) => void
  procesandoId: number | null
  vacio: string
}

function TablaPrestamos({
  prestamos,
  mostrarUsuario,
  onDevolver,
  procesandoId,
  vacio,
}: TablaProps) {
  if (prestamos.length === 0) {
    return (
      <div className={vacioClass}>
        <Inbox className="w-8 h-8 text-gray-400" />
        <span>{vacio}</span>
      </div>
    )
  }

  return (
    <div className={tablaContenedorClass}>
      <table className={tablaClass}>
        <thead>
          <tr>
            {mostrarUsuario && <th className={thClass}>Usuario</th>}
            <th className={thClass}>Título del libro</th>
            <th className={thClass}>Fecha de préstamo</th>
            <th className={thClass}>Fecha límite</th>
            <th className={thClass}>Fecha de devolución</th>
            <th className={thClass}>Estado</th>
            {onDevolver && <th className={`${thClass} text-right`}>Acción</th>}
          </tr>
        </thead>
        <tbody>
          {prestamos.map((p) => {
            const ocupado = procesandoId === p.id_prestamo
            const devolvible = p.estado === 'Activo' || p.estado === 'Vencido'
            return (
              <tr key={p.id_prestamo} className={trZebraClass}>
                {mostrarUsuario && (
                  <td className={tdClass}>{primero(p.usuarios)?.nombre ?? '—'}</td>
                )}
                <td className={`${tdClass} font-medium`}>
                  {primero(p.libros)?.titulo ?? '—'}
                </td>
                <td className={tdClass}>{formatearFecha(p.fecha_prestamo)}</td>
                <td className={tdClass}>{formatearFecha(p.fecha_limite)}</td>
                <td className={tdClass}>{formatearFecha(p.fecha_devolucion)}</td>
                <td className={tdClass}>
                  <InsigniaEstado estado={p.estado} />
                </td>
                {onDevolver && (
                  <td className={`${tdClass} text-right`}>
                    {devolvible && (
                      <button
                        onClick={() => onDevolver(p)}
                        disabled={procesandoId !== null}
                        className={btnPrimarioClass}
                      >
                        {ocupado ? 'Procesando...' : 'Procesar Devolución'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Prestamos() {
  const { session, perfil, cargandoPerfil } = useAuth()
  const staff = esStaff(perfil?.rol)
  const userId = session?.user.id

  const [prestamos, setPrestamos] = useState<PrestamoConDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState<Pestana>('activos')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const bloqueoRef = useRef(false)

  const cargarPrestamos = useCallback(
    async (silencioso = false) => {
      if (!userId) return
      if (!silencioso) setCargando(true)
      try {
        let consulta = supabase
          .from('prestamos')
          .select('*, usuarios(nombre), libros(titulo)')
          .order('fecha_prestamo', { ascending: false })

        // Lector: solo sus propios préstamos (RLS también lo garantiza en la BD)
        if (!staff) consulta = consulta.eq('id_usuario', userId)

        const { data, error } = await consulta
        if (error) throw error
        setPrestamos((data ?? []) as PrestamoConDetalle[])
      } catch (err) {
        setAviso({
          tipo: 'error',
          texto: `No se pudieron cargar los préstamos: ${mensajeDeError(err)}`,
        })
      } finally {
        if (!silencioso) setCargando(false)
      }
    },
    [staff, userId],
  )

  useEffect(() => {
    if (cargandoPerfil || !userId) return
    void cargarPrestamos()
  }, [cargandoPerfil, userId, cargarPrestamos])

  const activosYVencidos = useMemo(
    () => prestamos.filter((p) => p.estado === 'Activo' || p.estado === 'Vencido'),
    [prestamos],
  )

  const handleDevolver = async (prestamo: PrestamoConDetalle) => {
    if (!staff) return 
    // los lectores no pueden procesar devoluciones
    // El ref se actualiza al instante: evita dobles clics antes del siguiente render
    if (bloqueoRef.current) return
    bloqueoRef.current = true
    setAviso(null)
    setProcesandoId(prestamo.id_prestamo)

    const titulo = primero(prestamo.libros)?.titulo ?? 'el libro'
    const nombre = primero(prestamo.usuarios)?.nombre ?? ''

    try {
      const { error } = await supabase.rpc('devolver_libro', {
        p_id_prestamo: prestamo.id_prestamo,
      })
      if (error) throw error

      // Sale de inmediato de Activos y Vencidos y pasa a Finalizado en el historial
      setPrestamos((actuales) =>
        actuales.map((p) =>
          p.id_prestamo === prestamo.id_prestamo
            ? { ...p, estado: 'Finalizado' as const }
            : p,
        ),
      )
      setAviso({
        tipo: 'exito',
        texto: `Devolución registrada: "${titulo}" fue devuelto${
          nombre ? ` por ${nombre}` : ''
        } y el préstamo quedó finalizado.`,
      })

      // Sincroniza en segundo plano (p. ej. fecha_devolucion asignada por la BD)
      void cargarPrestamos(true)
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: `No se pudo procesar la devolución: ${mensajeDeError(err)}`,
      })
    } finally {
      bloqueoRef.current = false
      setProcesandoId(null)
    }
  }

  if (cargandoPerfil) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Cargando...
      </div>
    )
  }

  const claseTab = (activa: boolean) =>
    `px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
      activa
        ? 'border-green-600 text-green-700'
        : 'border-transparent text-gray-600 hover:text-gray-800'
    }`

  return (
    <div className="min-h-screen bg-gray-100">
      <header className={headerClass}>
        <h1 className={headerTitleClass}>
          <BookMarked className="w-6 h-6" />
          {staff ? 'Préstamos' : 'Mis préstamos'}
        </h1>
        <Link to="/dashboard" className={headerBtnClass}>
          <ArrowLeft className="w-4 h-4" />
          Volver al menú
        </Link>
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

        {staff && (
          <div className="flex gap-2 border-b border-gray-200" role="tablist">
            <button
              role="tab"
              aria-selected={pestana === 'activos'}
              onClick={() => setPestana('activos')}
              className={claseTab(pestana === 'activos')}
            >
              Préstamos Activos y Vencidos ({activosYVencidos.length})
            </button>
            <button
              role="tab"
              aria-selected={pestana === 'historial'}
              onClick={() => setPestana('historial')}
              className={claseTab(pestana === 'historial')}
            >
              Historial / Todos los Préstamos
            </button>
          </div>
        )}

        {cargando ? (
          <p className="text-gray-600">Cargando préstamos...</p>
        ) : staff ? (
          pestana === 'activos' ? (
            <TablaPrestamos
              prestamos={activosYVencidos}
              mostrarUsuario
              onDevolver={handleDevolver}
              procesandoId={procesandoId}
              vacio="No hay préstamos activos ni vencidos."
            />
          ) : (
            <TablaPrestamos
              prestamos={prestamos}
              mostrarUsuario
              procesandoId={procesandoId}
              vacio="Aún no hay préstamos registrados."
            />
          )
        ) : (
          <TablaPrestamos
            prestamos={prestamos}
            mostrarUsuario={false}
            procesandoId={procesandoId}
            vacio="No tienes préstamos registrados."
          />
        )}
      </main>
    </div>
  )
}
