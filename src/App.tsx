import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { CartProvider } from './CartContext'
import ProtectedRoute, { PantallaCarga } from './ProtectedRoute'
import Login from './Login'
import Dashboard from './Dashboard'
import Libros from './Libros'
import Carrito from './Carrito'

/** Rutas solo para usuarios sin sesión (si ya hay sesión -> /dashboard) */
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, cargando } = useAuth()
  const location = useLocation()
  if (cargando) return <PantallaCarga />
  if (!session) return <>{children}</>

  // Si venía de una ruta protegida, volver a ella; si no, al dashboard
  const from = (location.state as { from?: { pathname: string } } | null)?.from
  return <Navigate to={from?.pathname ?? '/dashboard'} replace />
}

/** Raíz: decide según la sesión */
function RootRedirect() {
  const { session, cargando } = useAuth()
  if (cargando) return <PantallaCarga />
  return <Navigate to={session ? '/dashboard' : '/login'} replace />
}

function NoEncontrado() {
  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
  
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
  
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/libros" element={<Libros />} />
              <Route path="/carrito" element={<Carrito />} />
            </Route>
  
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
