import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useCart } from './CartContext'
import type { LibroCarrito } from './CartContext'

interface Fallo {
  id_libro: number
  titulo: string
  motivo: string
}

/** Texto de la excepción SQL (error.message); mensaje genérico si viene vacío */
function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '').trim()
    if (msg) return msg
  }
  return 'Ocurrió un error inesperado.'
}

const MENSAJE_AGOTADO = 'Operación rechazada: Material agotado. Proceder a reservación.'

export default function Carrito() {
  const { session } = useAuth()
  const { carrito, eliminarLibro, vaciarCarrito } = useCart()
  const navigate = useNavigate()

  const [procesando, setProcesando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [exitosos, setExitosos] = useState<string[]>([])
  const [fallos, setFallos] = useState<Fallo[]>([])
  const [reservandoId, setReservandoId] = useState<number | null>(null)
  const [avisoReserva, setAvisoReserva] = useState<{
    tipo: 'exito' | 'error'
    texto: string
  } | null>(null)
  // Existencias actuales por libro, revalidadas contra la BD
  const [stockActual, setStockActual] = useState<Record<number, number>>({})
  const reservaBloqueoRef = useRef(false)

  // Revalida el stock de lo que hay en el carrito (puede haber cambiado desde que se añadió)
  const idsCarrito = carrito.map((l) => l.id_libro).join(',')
  useEffect(() => {
    if (!idsCarrito) return
    const ids = idsCarrito.split(',').map(Number)
    let cancelado = false

    supabase
      .from('libros')
      .select('id_libro, stock_disponible')
      .in('id_libro', ids)
      .then(({ data, error }) => {
        if (cancelado || error || !data) return
        const mapa: Record<number, number> = {}
        for (const fila of data as { id_libro: number; stock_disponible: number }[]) {
          mapa[Number(fila.id_libro)] = Number(fila.stock_disponible)
        }
        setStockActual(mapa)
      })

    return () => {
      cancelado = true
    }
  }, [idsCarrito])

  const estaAgotado = (libro: LibroCarrito): boolean => {
    const stock = stockActual[libro.id_libro] ?? libro.stock_disponible
    return stock !== undefined && stock <= 0
  }

  const prestables = carrito.filter((l) => !estaAgotado(l))
  const hayAgotados = prestables.length < carrito.length

  const handleReservar = async (libro: LibroCarrito) => {
    if (reservaBloqueoRef.current) return
    reservaBloqueoRef.current = true
    setAvisoReserva(null)
    setReservandoId(libro.id_libro)
    try {
      const idLibro = Number(libro.id_libro)
      if (!Number.isInteger(idLibro)) throw new Error('Identificador de libro inválido.')

      const { error } = await supabase.rpc('crear_reservacion', { p_id_libro: idLibro })
      if (error) throw error

      eliminarLibro(libro.id_libro) // ya está apartado: sale del carrito de préstamos
      setAvisoReserva({
        tipo: 'exito',
        texto: `"${libro.titulo}": Reservación guardada con éxito en lista de espera.`,
      })
    } catch (err) {
      setAvisoReserva({
        tipo: 'error',
        texto: `"${libro.titulo}": ${mensajeDeError(err)}`,
      })
    } finally {
      reservaBloqueoRef.current = false
      setReservandoId(null)
    }
  }

  const handleConfirmar = async () => {
    if (!session || procesando || prestables.length === 0) return

    setErrorGeneral('')
    setAvisoReserva(null)
    setExitosos([])
    setFallos([])
    setProcesando(true)

    try {
      const prestados: string[] = []
      const fallidos: Fallo[] = []

      // Una llamada a prestar_libro por cada libro con existencias (los agotados se omiten)
      for (const libroEnCarrito of [...prestables]) {
        try {
          // prestar_libro espera p_id_libro INT: validar antes de llamar al RPC
          const idLibro = Number(libroEnCarrito.id_libro)
          if (!Number.isInteger(idLibro)) {
            throw new Error('Identificador de libro inválido.')
          }

          // ÚNICA vía de préstamo: el RPC valida y registra todo en la BD
          // (usuario por auth.uid(), stock, apartados, historial). Nada de insert/update directos.
          const { error } = await supabase.rpc('prestar_libro', {
            p_id_libro: idLibro,
          })

          if (error) throw error

          // Sin error: préstamo exitoso, el libro sale del carrito
          prestados.push(libroEnCarrito.titulo)
          eliminarLibro(libroEnCarrito.id_libro)
        } catch (err) {
          // Se detiene SOLO este libro y se conserva el error.message de Supabase
          // (p. ej. "Operación rechazada: Este ejemplar se encuentra apartado...").
          fallidos.push({
            id_libro: libroEnCarrito.id_libro,
            titulo: libroEnCarrito.titulo,
            motivo: mensajeDeError(err),
          })
        }
      }

      setExitosos(prestados)
      setFallos(fallidos)

      // Todo salió bien (y no quedan agotados pendientes): redirigir con mensaje de éxito
      if (fallidos.length === 0 && !hayAgotados) {
        navigate('/dashboard', {
          replace: true,
          state: {
            mensaje:
              prestados.length === 1
                ? '¡Préstamo confirmado!'
                : `¡Préstamos confirmados! (${prestados.length} libros)`,
          },
        })
      }
      // Si hubo fallos nos quedamos aquí para que el usuario vea cuáles fallaron;
      // los libros fallidos permanecen en el carrito.
    } catch (err) {
      setErrorGeneral(mensajeDeError(err))
    } finally {
      setProcesando(false)
    }
  }

  const hayResultados = exitosos.length > 0 || fallos.length > 0

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Carrito de préstamos</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/libros"
            className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
          >
            Ver libros
          </Link>
          <Link
            to="/dashboard"
            className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
          >
            Volver al menú
          </Link>
        </div>
      </header>

      <main className="p-8 max-w-2xl">
        {errorGeneral && <p className="mb-4 text-sm text-red-600">{errorGeneral}</p>}

        {avisoReserva && (
          <p
            role={avisoReserva.tipo === 'error' ? 'alert' : 'status'}
            className={`mb-4 rounded px-4 py-2 text-sm ${
              avisoReserva.tipo === 'exito'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {avisoReserva.texto}
          </p>
        )}

        {hayResultados && (
          <div className="mb-6 space-y-3">
            {exitosos.length > 0 && (
              <div className="rounded bg-green-100 text-green-800 px-4 py-3 text-sm">
                <p className="font-semibold">Prestados correctamente:</p>
                <ul className="list-disc ml-5">
                  {exitosos.map((titulo) => (
                    <li key={titulo}>{titulo}</li>
                  ))}
                </ul>
              </div>
            )}

            {fallos.length > 0 && (
              <div
                role="alert"
                className="rounded bg-red-100 text-red-800 px-4 py-3 text-sm"
              >
                <p className="font-semibold">
                  No se pudieron prestar (siguen en tu carrito):
                </p>
                <ul className="list-disc ml-5">
                  {fallos.map((f) => (
                    <li key={f.id_libro}>
                      <span className="font-medium">{f.titulo}</span>: {f.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {carrito.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center text-gray-600">
            🛒 Tu carrito está vacío.{' '}
            <Link to="/libros" className="text-blue-600 underline">
              Explorar libros
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3 mb-6">
              {carrito.map((libro) => {
                const agotado = estaAgotado(libro)
                return (
                <li
                  key={libro.id_libro}
                  className={`bg-white p-3 rounded-lg shadow ${
                    agotado ? 'border border-orange-300' : ''
                  }`}
                >
                <div className="flex items-center gap-4">
                  {libro.imagen_url ? (
                    <img
                      src={libro.imagen_url}
                      alt={`Portada de ${libro.titulo}`}
                      className="w-14 h-20 object-cover rounded"
                    />
                  ) : (
                    <div className="w-14 h-20 bg-gray-200 rounded flex items-center justify-center text-2xl text-gray-400">
                      📖
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{libro.titulo}</p>
                    <p className="text-sm text-gray-600">{libro.autor}</p>
                  </div>
                  <button
                    onClick={() => eliminarLibro(libro.id_libro)}
                    disabled={procesando || reservandoId !== null}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </div>

                {agotado && (
                  <div className="mt-3 rounded bg-orange-50 text-orange-800 px-3 py-2 text-sm flex items-center justify-between gap-3">
                    <span>{MENSAJE_AGOTADO}</span>
                    <button
                      onClick={() => handleReservar(libro)}
                      disabled={procesando || reservandoId !== null}
                      className="shrink-0 bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
                    >
                      {reservandoId === libro.id_libro
                        ? 'Reservando...'
                        : 'Apartar / Reservar'}
                    </button>
                  </div>
                )}
                </li>
                )
              })}
            </ul>

            <p className="text-sm text-gray-600 mb-4">
              {carrito.length} libro(s) en el carrito
              {hayAgotados && ` (${carrito.length - prestables.length} agotado(s))`}.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmar}
                disabled={procesando || reservandoId !== null || prestables.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Confirmar préstamo'}
              </button>
              <button
                onClick={vaciarCarrito}
                disabled={procesando}
                className="border px-4 py-2 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Vaciar carrito
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
