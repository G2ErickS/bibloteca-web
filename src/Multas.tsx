import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esStaff } from './roles'

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
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${clase}`}>
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
      <header className="bg-green-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">{staff ? 'Multas' : 'Mis multas'}</h1>
        <Link
          to="/dashboard"
          className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
        >
          Volver al menú
        </Link>
      </header>

      <main className="p-8 max-w-6xl">
        {staff && (
          <button
            onClick={handleRevisar}
            disabled={ocupado}
            className="mb-6 bg-orange-600 text-white text-lg font-semibold px-6 py-3 rounded-lg shadow hover:bg-orange-700 disabled:opacity-50"
          >
            {revisando ? 'Revisando...' : 'Ejecutar Revisión de Vencimientos'}
          </button>
        )}

        {aviso && (
          <p
            role={aviso.tipo === 'error' ? 'alert' : 'status'}
            className={`mb-4 rounded px-4 py-2 text-sm ${
              aviso.tipo === 'exito'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {cargando ? (
          <p className="text-gray-600">Cargando multas...</p>
        ) : multas.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-600">
            {staff ? '✅ No hay multas registradas.' : '✅ No tienes multas.'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {staff && <th className="p-3">Usuario</th>}
                  <th className="p-3">Libro</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Fecha de generación</th>
                  <th className="p-3">Estado</th>
                  {staff && <th className="p-3 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {multas.map((m) => {
                  const pendiente = m.estado === 'Pendiente'
                  const titulo = primero(primero(m.prestamos)?.libros ?? null)?.titulo
                  return (
                    <tr
                      key={m.id_multa}
                      className={`border-t ${pendiente ? 'bg-red-50' : ''}`}
                    >
                      {staff && (
                        <td className="p-3">{primero(m.usuarios)?.nombre ?? '—'}</td>
                      )}
                      <td className="p-3">{titulo ?? '—'}</td>
                      <td
                        className={`p-3 font-semibold ${
                          pendiente ? 'text-red-700' : ''
                        }`}
                      >
                        {formatearMonto(m.monto)}
                      </td>
                      <td className="p-3">{formatearFecha(m.fecha_generacion)}</td>
                      <td className="p-3">
                        <InsigniaEstado estado={m.estado} />
                      </td>
                      {staff && (
                        <td className="p-3 text-right">
                          {pendiente && (
                            <button
                              onClick={() => handlePagar(m)}
                              disabled={ocupado}
                              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
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
