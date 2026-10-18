import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useCart } from './CartContext'
import { esStaff } from './roles'

interface Libro {
  id_libro: number
  titulo: string
  autor: string
  isbn: string
  stock_total: number
  stock_disponible: number
  imagen_url: string | null
}

const BUCKET = 'portadas'
const MAX_IMAGEN_BYTES = 2 * 1024 * 1024 // 2 MB

function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Ocurrió un error inesperado.'
}

/** Obtiene la ruta del archivo dentro del bucket a partir de su URL pública */
function rutaDesdeUrl(url: string | null): string | null {
  if (!url) return null
  const marca = `/${BUCKET}/`
  const i = url.indexOf(marca)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marca.length).split('?')[0])
}

/** Borrado "mejor esfuerzo": si falla no interrumpe la operación principal */
async function borrarImagen(ruta: string | null) {
  if (!ruta) return
  const { error } = await supabase.storage.from(BUCKET).remove([ruta])
  if (error) console.warn('No se pudo borrar la imagen anterior:', error.message)
}

function Portada({ url, titulo }: { url: string | null; titulo: string }) {
  if (!url) {
    return (
      <div
        className="w-full h-48 bg-gray-200 rounded mb-3 flex items-center justify-center text-5xl text-gray-400"
        aria-label="Sin portada"
      >
        📖
      </div>
    )
  }
  return (
    <div className="w-full h-56 bg-gray-100 flex items-center justify-center overflow-hidden rounded-t-lg">
      <img
        src={url}
        alt={`Portada de ${titulo}`}
        loading="lazy"
        className="h-full w-full object-contain p-2"
      />
    </div>
  )
}

export default function Libros() {
  const { perfil } = useAuth()
  const { agregarLibro, estaEnCarrito, carrito } = useCart()

  const staff = perfil ? esStaff(perfil.rol) : false
  const esLector = perfil ? !staff : false

  const [libros, setLibros] = useState<Libro[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  // Formulario (crear / editar)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<Libro | null>(null)
  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [stock, setStock] = useState(1)
  const [archivo, setArchivo] = useState<File | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [reservandoId, setReservandoId] = useState<number | null>(null)
  const reservaBloqueoRef = useRef(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargarLibros = async () => {
    setCargando(true)
    setErrorCarga('')
    const { data, error } = await supabase
      .from('libros')
      .select('*')
      .order('titulo', { ascending: true })

    if (error) {
      setErrorCarga('No se pudieron cargar los libros: ' + error.message)
    } else {
      // Garantiza id_libro numérico en runtime (p. ej. si PostgREST lo devuelve como texto)
      setLibros(
        ((data ?? []) as Libro[]).map((l) => ({ ...l, id_libro: Number(l.id_libro) })),
      )
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarLibros()
  }, [])

  const limpiarFormulario = () => {
    setEditando(null)
    setTitulo('')
    setAutor('')
    setIsbn('')
    setStock(1)
    setArchivo(null)
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
  }

  const cerrarFormulario = () => {
    limpiarFormulario()
    setMostrarForm(false)
  }

  const abrirNuevo = () => {
    if (mostrarForm && !editando) {
      cerrarFormulario()
      return
    }
    limpiarFormulario()
    setMensaje(null)
    setMostrarForm(true)
  }

  const abrirEdicion = (libro: Libro) => {
    limpiarFormulario()
    setMensaje(null)
    setEditando(libro)
    setTitulo(libro.titulo)
    setAutor(libro.autor)
    setIsbn(libro.isbn)
    setStock(libro.stock_total)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setArchivo(null)
      return
    }
    if (file.type !== 'image/jpeg') {
      setMensaje({ tipo: 'error', texto: 'Solo se permiten imágenes .jpg / .jpeg.' })
      e.target.value = ''
      setArchivo(null)
      return
    }
    if (file.size > MAX_IMAGEN_BYTES) {
      setMensaje({ tipo: 'error', texto: 'La imagen no debe pesar más de 2 MB.' })
      e.target.value = ''
      setArchivo(null)
      return
    }
    setMensaje(null)
    setArchivo(file)
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (guardando) return
    setMensaje(null)

    const isbnLimpio = isbn.trim()
    const tituloLimpio = titulo.trim()
    const autorLimpio = autor.trim()

    if (!Number.isInteger(stock) || stock < 1) {
      setMensaje({ tipo: 'error', texto: 'El stock total debe ser un entero mayor o igual a 1.' })
      return
    }

    // Subidas nuevas para poder deshacerlas si falla el guardado
    let rutaSubida: string | null = null

    setGuardando(true)
    try {
      // 1) Validar que el ISBN no exista en OTRO libro
      let consulta = supabase
        .from('libros')
        .select('id_libro')
        .eq('isbn', isbnLimpio)
        .limit(1)
      if (editando) consulta = consulta.neq('id_libro', editando.id_libro)

      const { data: duplicados, error: errDup } = await consulta
      if (errDup) throw errDup
      if (duplicados && duplicados.length > 0) {
        setMensaje({ tipo: 'error', texto: 'Ya existe otro libro con ese ISBN.' })
        return
      }

      // 2) En edición: no se puede bajar el stock por debajo de lo ya prestado
      let stockDisponible = stock
      if (editando) {
        const prestados = editando.stock_total - editando.stock_disponible
        if (stock < prestados) {
          setMensaje({
            tipo: 'error',
            texto: `Hay ${prestados} ejemplar(es) prestado(s); el stock total no puede ser menor.`,
          })
          return
        }
        stockDisponible = stock - prestados
      }

      // 3) Subir portada (si se eligió una) ANTES de escribir en la BD
      let imagenUrl = editando?.imagen_url ?? null
      if (archivo) {
        rutaSubida = `${crypto.randomUUID()}.jpg`
        const { error: errSubida } = await supabase.storage
          .from(BUCKET)
          .upload(rutaSubida, archivo, { contentType: 'image/jpeg', upsert: false })
        if (errSubida) {
          rutaSubida = null
          throw errSubida
        }
        imagenUrl = supabase.storage.from(BUCKET).getPublicUrl(rutaSubida).data.publicUrl
      }

      // 4) Insertar o actualizar
      if (editando) {
        const { data: filas, error } = await supabase
          .from('libros')
          .update({
            titulo: tituloLimpio,
            autor: autorLimpio,
            isbn: isbnLimpio,
            stock_total: stock,
            stock_disponible: stockDisponible,
            imagen_url: imagenUrl,
          })
          .eq('id_libro', editando.id_libro)
          .select('id_libro')

        if (error) throw error
        if (!filas || filas.length === 0) {
          throw new Error('No se actualizó ningún registro (¿sin permisos?).')
        }

        // La portada anterior ya no se usa
        if (rutaSubida) await borrarImagen(rutaDesdeUrl(editando.imagen_url))
        setMensaje({ tipo: 'ok', texto: 'Libro actualizado correctamente.' })
      } else {
        const { error } = await supabase.from('libros').insert({
          titulo: tituloLimpio,
          autor: autorLimpio,
          isbn: isbnLimpio,
          stock_total: stock,
          stock_disponible: stock, // libro nuevo: todo disponible
          imagen_url: imagenUrl,
        })
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Libro agregado correctamente.' })
      }

      cerrarFormulario()
      await cargarLibros()
    } catch (err) {
      // Si la imagen ya se subió pero la BD falló, no dejar archivos huérfanos
      await borrarImagen(rutaSubida)
      setMensaje({ tipo: 'error', texto: 'Error: ' + mensajeDeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (libro: Libro) => {
    if (eliminandoId !== null) return
    if (!window.confirm(`¿Eliminar "${libro.titulo}"? Esta acción no se puede deshacer.`)) return

    setMensaje(null)
    setEliminandoId(libro.id_libro)
    try {
      const { data: filas, error } = await supabase
        .from('libros')
        .delete()
        .eq('id_libro', libro.id_libro)
        .select('id_libro')

      if (error) throw error
      if (!filas || filas.length === 0) {
        throw new Error('No se eliminó ningún registro (¿sin permisos?).')
      }

      await borrarImagen(rutaDesdeUrl(libro.imagen_url))
      if (editando?.id_libro === libro.id_libro) cerrarFormulario()
      setMensaje({ tipo: 'ok', texto: 'Libro eliminado.' })
      await cargarLibros()
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto:
          'No se pudo eliminar (si tiene préstamos asociados no se puede borrar): ' +
          mensajeDeError(err),
      })
    } finally {
      setEliminandoId(null)
    }
  }

  /** Libro agotado: se aparta en la lista de espera con crear_reservacion */
  const handleReservar = async (libro: Libro) => {
    if (reservaBloqueoRef.current) return
    reservaBloqueoRef.current = true
    setMensaje(null)
    setReservandoId(libro.id_libro)
    try {
      const idLibro = Number(libro.id_libro)
      if (!Number.isInteger(idLibro)) throw new Error('Identificador de libro inválido.')

      const { error } = await supabase.rpc('crear_reservacion', { p_id_libro: idLibro })
      if (error) throw error

      setMensaje({
        tipo: 'ok',
        texto: 'Reservación guardada con éxito en lista de espera.',
      })
    } catch (err) {
      // Ej.: usuario deudor o reservación activa previa
      setMensaje({ tipo: 'error', texto: mensajeDeError(err) })
    } finally {
      reservaBloqueoRef.current = false
      setReservandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Libros</h1>
        <div className="flex items-center gap-3">
          {esLector && (
            <Link
              to="/carrito"
              className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
            >
              🛒 Carrito ({carrito.length})
            </Link>
          )}
          <Link
            to="/dashboard"
            className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
          >
            Volver al menú
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="p-8">
        {mensaje && (
          <p
            className={`mb-4 text-sm ${
              mensaje.tipo === 'ok' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {mensaje.texto}
          </p>
        )}

        {staff && (
          <button
            onClick={abrirNuevo}
            className="mb-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {mostrarForm && !editando ? 'Cancelar' : '+ Agregar libro'}
          </button>
        )}

        {staff && mostrarForm && (
          <form
            onSubmit={handleGuardar}
            className="bg-white p-6 rounded-lg shadow mb-6 max-w-md"
          >
            <h2 className="text-lg font-semibold mb-3">
              {editando ? 'Editar libro' : 'Nuevo libro'}
            </h2>

            <input
              type="text"
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border p-2 rounded mb-3"
              required
            />
            <input
              type="text"
              placeholder="Autor"
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              className="w-full border p-2 rounded mb-3"
              required
            />
            <input
              type="text"
              placeholder="ISBN"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className="w-full border p-2 rounded mb-3"
              required
            />

            <label className="block text-sm text-gray-600 mb-1">
              Stock total (ejemplares)
            </label>
            <input
              type="number"
              value={Number.isNaN(stock) ? '' : stock}
              onChange={(e) => setStock(e.target.valueAsNumber)}
              className="w-full border p-2 rounded mb-1"
              min={1}
              step={1}
              required
            />
            {editando && (
              <p className="text-xs text-gray-500 mb-3">
                Prestados actualmente: {editando.stock_total - editando.stock_disponible}.
                Los disponibles se recalculan automáticamente.
              </p>
            )}
            {!editando && <div className="mb-3" />}

            <label className="block text-sm text-gray-600 mb-1">
              Portada (.jpg, máx. 2 MB)
            </label>
            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/jpeg"
              onChange={handleArchivo}
              className="w-full border p-2 rounded mb-1"
            />
            {editando?.imagen_url && !archivo && (
              <p className="text-xs text-gray-500 mb-3">
                Ya tiene portada; sube otra solo si quieres reemplazarla.
              </p>
            )}
            <div className="mb-3" />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={guardando}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar libro'}
              </button>
              <button
                type="button"
                onClick={cerrarFormulario}
                disabled={guardando}
                className="border px-4 py-2 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {cargando ? (
          <p>Cargando libros...</p>
        ) : errorCarga ? (
          <p className="text-red-600">{errorCarga}</p>
        ) : libros.length === 0 ? (
          <p>No hay libros registrados todavía.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {libros.map((libro) => {
              const enCarrito = estaEnCarrito(libro.id_libro)
              return (
                <div key={libro.id_libro} className="bg-white p-4 rounded-lg shadow">
                  <Portada url={libro.imagen_url} titulo={libro.titulo} />
                  <h3 className="font-bold text-lg">{libro.titulo}</h3>
                  <p className="text-gray-600">{libro.autor}</p>
                  <p className="text-sm text-gray-500">ISBN: {libro.isbn}</p>
                  <p className="text-sm mt-2">
                    Disponibles: {libro.stock_disponible} / {libro.stock_total}
                  </p>

                  {staff && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => abrirEdicion(libro)}
                        disabled={eliminandoId === libro.id_libro}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(libro)}
                        disabled={eliminandoId !== null}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {eliminandoId === libro.id_libro ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  )}

                  {esLector && libro.stock_disponible > 0 && (
                    <button
                      onClick={() =>
                        agregarLibro({
                          id_libro: libro.id_libro,
                          titulo: libro.titulo,
                          autor: libro.autor,
                          imagen_url: libro.imagen_url,
                          stock_disponible: libro.stock_disponible,
                        })
                      }
                      disabled={enCarrito}
                      className="mt-3 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {enCarrito ? 'En el carrito' : 'Añadir al carrito'}
                    </button>
                  )}

                  {esLector && libro.stock_disponible <= 0 && (
                    <button
                      onClick={() => handleReservar(libro)}
                      disabled={reservandoId !== null}
                      className="mt-3 bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
                    >
                      {reservandoId === libro.id_libro
                        ? 'Reservando...'
                        : 'Agotado - Apartar / Reservar'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
