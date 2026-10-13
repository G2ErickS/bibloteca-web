import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useCart } from './CartContext'

interface Fallo {
  id_libro: string
  titulo: string
  motivo: string
}

function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Ocurrió un error inesperado.'
}

export default function Carrito() {
  const { session } = useAuth()
  const { carrito, eliminarLibro, vaciarCarrito } = useCart()
  const navigate = useNavigate()

  const [procesando, setProcesando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [exitosos, setExitosos] = useState<string[]>([])
  const [fallos, setFallos] = useState<Fallo[]>([])

  const handleConfirmar = async () => {
    if (!session || procesando || carrito.length === 0) return
    const idUsuarioActual = session.user.id

    setErrorGeneral('')
    setExitosos([])
    setFallos([])
    setProcesando(true)

    try {
      const prestados: string[] = []
      const fallidos: Fallo[] = []

      // Una llamada a prestar_libro por cada libro (copia para iterar con seguridad)
      for (const libroEnCarrito of [...carrito]) {
        try {
          const { error } = await supabase.rpc('prestar_libro', {
            p_id_usuario: idUsuarioActual,
            p_id_libro: libroEnCarrito.id_libro,
          })

          if (error) throw error

          prestados.push(libroEnCarrito.titulo)
          eliminarLibro(libroEnCarrito.id_libro) // ya prestado: sale del carrito
        } catch (err) {
          // Aquí llegan las excepciones de la función (sin stock, usuario inactivo, etc.)
          fallidos.push({
            id_libro: libroEnCarrito.id_libro,
            titulo: libroEnCarrito.titulo,
            motivo: mensajeDeError(err),
          })
        }
      }

      setExitosos(prestados)
      setFallos(fallidos)

      // Todo salió bien: redirigir con mensaje de éxito
      if (fallidos.length === 0) {
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
              <div className="rounded bg-red-100 text-red-800 px-4 py-3 text-sm">
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
              {carrito.map((libro) => (
                <li
                  key={libro.id_libro}
                  className="bg-white p-3 rounded-lg shadow flex items-center gap-4"
                >
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
                    disabled={procesando}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-sm text-gray-600 mb-4">{carrito.length} libro(s) en el carrito.</p>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmar}
                disabled={procesando}
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
