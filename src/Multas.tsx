import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esStaff } from './roles'
import {
  btnPrimarioClass,
  headerBtnClass,
  headerClass,
  headerTitleClass,
  mainClass,
  tablaClass,
  tablaContenedorClass,
  tdClass,
  thClass,
  trZebraClass,
} from './ui'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
} from 'lucide-react'

type EstadoMulta = 'Pendiente' | 'Pagada'

/** Columnas oficiales de la tabla `multas` */
interface Multa {
  id_multa: number
  id_usuario: string // UUID
  id_prestamo: number
  monto: number
  estado: EstadoMulta
  fecha_generacion: string
}

type Uno<T> = T | T[] | null

/** Multa + datos relacionados traídos con el join del select */
interface MultaConDetalle extends Multa {
  usuarios: Uno<{ nombre: string }>
  prestamos: Uno<{ libros: Uno<{ titulo: string }> }>
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

/** Un join puede venir como objeto o como arreglo */
function primero<T>(valor: Uno<T>): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor
}

const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

function formatearMonto(monto: number): string {
  return formatoMoneda.format(Number.isFinite(monto) ? monto : 0)
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

function InsigniaEstado({ estado }: { estado: EstadoMulta }) {
  const clase =
    estado === 'Pendiente'
      ? 'bg-red-100 text-red-700'
      : 'bg-green-100 text-green-800'
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${clase}`}
    >
      {estado}
    </span>
  )
}

export default function Multas() {
  const { session, perfil, cargandoPerfil } = useAuth()
  const staff = esStaff(perfil?.rol)
  const userId = session?.user.id

  const [multas, setMultas] = useState<MultaConDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [revisando, setRevisando] = useState(false)
  const [pagandoId, setPagandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const bloqueoRef = useRef(false)

  const cargarMultas = useCallback(
    async (silencioso = false) => {
      if (!userId) return
      if (!silencioso) setCargando(true)
      try {
        let consulta = supabase
          .from('multas')
          .select('*, usuarios(nombre), prestamos(libros(titulo))')
          .order('fecha_generacion', { ascending: false })

        // Lector: solo sus propias multas (RLS también lo garantiza en la BD)
        if (!staff) consulta = consulta.eq('id_usuario', userId)

        const { data, error } = await consulta
        if (error) throw error

        setMultas(
          ((data ?? []) as MultaConDetalle[]).map((m) => ({
            ...m,
            monto: Number(m.monto), // numeric puede llegar como texto
          })),
        )
      } catch (err) {
        setAviso({
          tipo: 'error',
          texto: `No se pudieron cargar las multas: ${mensajeDeError(err)}`,
        })
      } finally {
        if (!silencioso) setCargando(false)
      }
    },
    [staff, userId],
  )

  useEffect(() => {
    if (cargandoPerfil || !userId) return
    void cargarMultas()
  }, [cargandoPerfil, userId, cargarMultas])

  const ocupado = revisando || pagandoId !== null

  const handleRevisar = async () => {
    if (!staff || bloqueoRef.current) return
    bloqueoRef.current = true
    setAviso(null)
    setRevisando(true)

    try {
      const { data, error } = await supabase.rpc('revisar_vencimientos')
      if (error) throw error

      const nuevas = Number(data ?? 0)
      setAviso({
        tipo: 'exito',
        texto: `Revisión completada. Se generaron ${
          Number.isFinite(nuevas) ? nuevas : 0
        } nuevas multas.`,
      })
      await cargarMultas(true)
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: `No se pudo ejecutar la revisión: ${mensajeDeError(err)}`,
      })
    } finally {
      bloqueoRef.current = false
      setRevisando(false)
    }
  }

  const handlePagar = async (multa: MultaConDetalle) => {
    if (!staff || bloqueoRef.current) return
    bloqueoRef.current = true
    setAviso(null)
    setPagandoId(multa.id_multa)

    try {
      const { error } = await supabase.rpc('pagar_multa', {
        p_id_multa: multa.id_multa,
      })
      if (error) throw error

      setAviso({
        tipo: 'exito',
        texto: `Pago registrado: multa #${multa.id_multa} por ${formatearMonto(
          multa.monto,
        )}.`,
      })
      await cargarMultas(true)
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: `No se pudo registrar el pago: ${mensajeDeError(err)}`,
      })
    } finally {
      bloqueoRef.current = false
      setPagandoId(null)
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
          <Banknote className="w-6 h-6" />
          {staff ? 'Multas' : 'Mis multas'}
        </h1>
        <Link to="/dashboard" className={headerBtnClass}>
          <ArrowLeft className="w-4 h-4" />
          Volver al menú
        </Link>
      </header>

      <main className={mainClass}>
        {staff && (
          <button
            onClick={handleRevisar}
            disabled={ocupado}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {revisando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ClipboardCheck className="w-5 h-5" />
            )}
            {revisando ? 'Revisando...' : 'Ejecutar Revisión de Vencimientos'}
          </button>
        )}

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
          <p className="text-gray-600">Cargando multas...</p>
        ) : multas.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 flex flex-col items-center gap-3 text-gray-600">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <span>
              {staff ? 'No hay multas registradas.' : 'No tienes multas.'}
            </span>
          </div>
        ) : (
          <div className={tablaContenedorClass}>
            <table className={tablaClass}>
              <thead>
                <tr>
                  {staff && <th className={thClass}>Usuario</th>}
                  <th className={thClass}>Libro</th>
                  <th className={thClass}>Monto</th>
                  <th className={thClass}>Fecha de generación</th>
                  <th className={thClass}>Estado</th>
                  {staff && <th className={`${thClass} text-right`}>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {multas.map((m) => {
                  const pendiente = m.estado === 'Pendiente'
                  const titulo = primero(primero(m.prestamos)?.libros ?? null)?.titulo
                  return (
                    <tr
                      key={m.id_multa}
                      className={
                        pendiente
                          ? 'bg-red-50 hover:bg-red-100 transition-colors'
                          : trZebraClass
                      }
                    >
                      {staff && (
                        <td className={tdClass}>
                          {primero(m.usuarios)?.nombre ?? '—'}
                        </td>
                      )}
                      <td className={`${tdClass} font-medium`}>{titulo ?? '—'}</td>
                      <td
                        className={`${tdClass} font-semibold ${
                          pendiente ? 'text-red-700' : ''
                        }`}
                      >
                        {formatearMonto(m.monto)}
                      </td>
                      <td className={tdClass}>
                        {formatearFecha(m.fecha_generacion)}
                      </td>
                      <td className={tdClass}>
                        <InsigniaEstado estado={m.estado} />
                      </td>
                      {staff && (
                        <td className={`${tdClass} text-right`}>
                          {pendiente && (
                            <button
                              onClick={() => handlePagar(m)}
                              disabled={ocupado}
                              className={btnPrimarioClass}
                            >
                              {pagandoId === m.id_multa
                                ? 'Procesando...'
                                : 'Registrar Pago'}
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
        )}
      </main>
    </div>
  )
}
