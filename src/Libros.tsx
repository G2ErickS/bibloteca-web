import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

interface Props {
  rol: string
  onVolver: () => void
}

interface Libro {
  id_libro: string
  titulo: string
  autor: string
  isbn: string
  stock_total: number
  stock_disponible: number
}

export default function Libros({ rol, onVolver }: Props) {
  const [libros, setLibros] = useState<Libro[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [stock, setStock] = useState(1)
  const [mensaje, setMensaje] = useState('')

  const puedeAgregar = rol === 'admin' || rol === 'bibliotecario'

  const cargarLibros = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('libros')
      .select('*')
      .order('titulo', { ascending: true })

    if (!error && data) {
      setLibros(data)
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarLibros()
  }, [])

  const handleAgregar = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')

    const { error } = await supabase.from('libros').insert({
      titulo,
      autor,
      isbn,
      stock_total: stock,
      stock_disponible: stock,
    })

    if (error) {
      setMensaje('Error: ' + error.message)
    } else {
      setMensaje('Libro agregado correctamente.')
      setTitulo('')
      setAutor('')
      setIsbn('')
      setStock(1)
      setMostrarForm(false)
      cargarLibros()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Libros</h1>
        <button
          onClick={onVolver}
          className="bg-white text-green-600 px-3 py-1 rounded hover:bg-gray-100"
        >
          Volver al menú
        </button>
      </header>

      {/* Main */}
      <main className="p-8">
        {puedeAgregar && (
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="mb-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {mostrarForm ? 'Cancelar' : '+ Agregar libro'}
          </button>
        )}

        {mostrarForm && (
          <form
            onSubmit={handleAgregar}
            className="bg-white p-6 rounded-lg shadow mb-6 max-w-md"
          >
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
            <input
              type="number"
              placeholder="Cantidad de ejemplares"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              className="w-full border p-2 rounded mb-3"
              min={1}
              required
            />

            {mensaje && <p className="text-sm mb-3">{mensaje}</p>}

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Guardar libro
            </button>
          </form>
        )}

        {cargando ? (
          <p>Cargando libros...</p>
        ) : libros.length === 0 ? (
          <p>No hay libros registrados todavía.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {libros.map((libro) => (
              <div
                key={libro.id_libro}
                className="bg-white p-4 rounded-lg shadow"
              >
                <h3 className="font-bold text-lg">{libro.titulo}</h3>
                <p className="text-gray-600">{libro.autor}</p>
                <p className="text-sm text-gray-500">ISBN: {libro.isbn}</p>
                <p className="text-sm mt-2">
                  Disponibles: {libro.stock_disponible} / {libro.stock_total}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
