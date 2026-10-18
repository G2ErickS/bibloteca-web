import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'

/** Datos mínimos de un libro para mostrarlo en el carrito */
export interface LibroCarrito {
  id_libro: number
  titulo: string
  autor: string
  imagen_url: string | null
  /** Existencias al momento de agregarlo (el carrito las revalida contra la BD) */
  stock_disponible?: number
}

interface CartContextValue {
  carrito: LibroCarrito[]
  agregarLibro: (libro: LibroCarrito) => void
  eliminarLibro: (idLibro: number) => void
  vaciarCarrito: () => void
  estaEnCarrito: (idLibro: number) => boolean
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [carrito, setCarrito] = useState<LibroCarrito[]>([])

  const agregarLibro = useCallback((libro: LibroCarrito) => {
    setCarrito((actual) =>
      // Un solo ejemplar por libro
      actual.some((l) => l.id_libro === libro.id_libro)
        ? actual
        : [...actual, libro],
    )
  }, [])

  const eliminarLibro = useCallback((idLibro: number) => {
    setCarrito((actual) => actual.filter((l) => l.id_libro !== idLibro))
  }, [])

  const vaciarCarrito = useCallback(() => setCarrito([]), [])

  const estaEnCarrito = useCallback(
    (idLibro: number) => carrito.some((l) => l.id_libro === idLibro),
    [carrito],
  )

  // Si se cierra sesión, el carrito no debe quedar para el siguiente usuario
  const hayUsuario = Boolean(session)
  useEffect(() => {
    if (!hayUsuario) setCarrito([])
  }, [hayUsuario])

  const value = useMemo(
    () => ({ carrito, agregarLibro, eliminarLibro, vaciarCarrito, estaEnCarrito }),
    [carrito, agregarLibro, eliminarLibro, vaciarCarrito, estaEnCarrito],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return ctx
}
