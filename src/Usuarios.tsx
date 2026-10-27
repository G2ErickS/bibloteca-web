import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Ban, Inbox, Users } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { esAdmin } from './roles'
import {
  btnPrimarioClass,
  headerBtnClass,
  headerClass,
  headerTitleClass,
  inputClass,
  insigniaClass,
  mainClass,
  tablaClass,
  tablaContenedorClass,
  tdClass,
  thClass,
  trZebraClass,
  vacioClass,
} from './ui'

type EstadoUsuario = 'Activo' | 'Suspendido' | 'Deudor'

const ESTADOS: EstadoUsuario[] = ['Activo', 'Suspendido', 'Deudor']

type RolUsuario = 'usuario' | 'bibliotecario' | 'admin'

const ROLES: RolUsuario[] = ['usuario', 'bibliotecario', 'admin']

/** Convierte el rol guardado (p. ej. 'Administrador') al valor de las opciones del select */
function rolParaSelect(rol: string): string {
  const r = (rol ?? '').trim().toLowerCase()
  return r === 'administrador' ? 'admin' : r
}

/** Columnas oficiales de la tabla `usuarios` (pág. 5 del PIA) */
interface Usuario {
  id_usuario: string // UUID
  nombre: string
  rol: string
  estado: EstadoUsuario
  contacto: string
}

interface Aviso {
  tipo: 'exito' | 'error'
  texto: string
}

/** Celdas con líneas verticales que separan las columnas */
const celda = `${tdClass} border-x border-gray-200`
const celdaTh = `${thClass} border-x border-gray-200`

const CONTACTO_SUPER_ADMIN = 'admin@gmail.com'

/** El Admin Principal es el usuario con contacto admin@gmail.com: su estado es inmutable */
function esSuperAdmin(u: Usuario): boolean {
  return (u.contacto ?? '').trim().toLowerCase() === CONTACTO_SUPER_ADMIN
}

/** Texto de la excepción SQL (error.message); mensaje genérico si viene vacío */
function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? '').trim()
    if (msg) return msg
  }
  return 'Ocurrió un error inesperado.'
}

function claseFila(estado: EstadoUsuario): string {
  if (estado === 'Deudor') return 'bg-red-50 text-red-900 hover:bg-red-100 transition-colors'
  if (estado === 'Suspendido') return 'bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors'
  return trZebraClass
}

function InsigniaEstado({ estado }: { estado: EstadoUsuario }) {
  const clase =
    estado === 'Deudor'
      ? 'bg-red-100 text-red-700'
      : estado === 'Suspendido'
        ? 'bg-gray-300 text-gray-700'
        : 'bg-green-100 text-green-800'
  return (
    <span className={`${insigniaClass} ${clase}`}>
      {estado}
    </span>
  )
}

export default function Usuarios() {
  const { session, perfil, cargandoPerfil } = useAuth()
  const admin = esAdmin(perfil?.rol)
  const miId = session?.user.id
  // Solo el Admin Principal puede crear otros administradores
  const soyAdminPrincipal =
    (session?.user.email ?? '').trim().toLowerCase() === CONTACTO_SUPER_ADMIN

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState<{
    id: string
    campo: 'estado' | 'rol'
  } | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const bloqueoRef = useRef(false)

  const cargarUsuarios = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nombre', { ascending: true })
      if (error) throw error
      setUsuarios((data ?? []) as Usuario[])
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: `No se pudieron cargar los usuarios: ${mensajeDeError(err)}`,
      })
    } finally {
      if (!silencioso) setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (admin) void cargarUsuarios()
  }, [admin, cargarUsuarios])

  const handleCambiarEstado = async (
    usuario: Usuario,
    estadoSeleccionado: EstadoUsuario,
  ) => {
    if (!admin || bloqueoRef.current) return
    if (esSuperAdmin(usuario)) return // protegido también a nivel de lógica
    if (estadoSeleccionado === usuario.estado) return
    bloqueoRef.current = true
    setAviso(null)
    setActualizando({ id: usuario.id_usuario, campo: 'estado' })

    try {
      const { error } = await supabase.rpc('actualizar_estado_usuario', {
        p_id_usuario: usuario.id_usuario,
        p_nuevo_estado: estadoSeleccionado,
      })
      if (error) throw error

      setUsuarios((actuales) =>
        actuales.map((u) =>
          u.id_usuario === usuario.id_usuario ? { ...u, estado: estadoSeleccionado } : u,
        ),
      )
      setAviso({
        tipo: 'exito',
        texto: `Estado de ${usuario.nombre} actualizado a "${estadoSeleccionado}".`,
      })
      void cargarUsuarios(true) // sincroniza con la BD
    } catch (err) {
      // El select es controlado por el estado guardado: al fallar vuelve al valor anterior
      setAviso({
        tipo: 'error',
        texto: `No se pudo actualizar a ${usuario.nombre}: ${mensajeDeError(err)}`,
      })
    } finally {
      bloqueoRef.current = false
      setActualizando(null)
    }
  }

  const handleCambiarRol = async (usuario: Usuario, rolSeleccionado: RolUsuario) => {
    if (!admin || bloqueoRef.current) return
    if (esSuperAdmin(usuario)) return // Admin Principal protegido
    // Solo el Admin Principal puede otorgar el rol admin
    if (rolSeleccionado === 'admin' && !soyAdminPrincipal) return
    if (rolSeleccionado === rolParaSelect(usuario.rol)) return
    bloqueoRef.current = true
    setAviso(null)
    setActualizando({ id: usuario.id_usuario, campo: 'rol' })

    try {
      const { error } = await supabase.rpc('actualizar_rol_usuario', {
        p_id_usuario: usuario.id_usuario,
        p_nuevo_rol: rolSeleccionado,
      })
      if (error) throw error

      setUsuarios((actuales) =>
        actuales.map((u) =>
          u.id_usuario === usuario.id_usuario ? { ...u, rol: rolSeleccionado } : u,
        ),
      )
      setAviso({
        tipo: 'exito',
        texto: `Rol de ${usuario.nombre} actualizado a "${rolSeleccionado}".`,
      })
      void cargarUsuarios(true) // sincroniza con la BD
    } catch (err) {
      // El select es controlado por el rol guardado: al fallar vuelve al valor anterior
      setAviso({
        tipo: 'error',
        texto: `No se pudo cambiar el rol de ${usuario.nombre}: ${mensajeDeError(err)}`,
      })
    } finally {
      bloqueoRef.current = false
      setActualizando(null)
    }
  }

  if (cargandoPerfil) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Cargando...
      </div>
    )
  }

  // Solo Administrador (Bibliotecario y Lector quedan fuera)
  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <div
          role="alert"
          className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm text-center max-w-md"
        >
          <Ban className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-red-700 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-6">
            Solo los Administradores pueden gestionar usuarios.
          </p>
          <Link
            to="/dashboard"
            className={`${btnPrimarioClass} inline-flex items-center gap-2`}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al menú
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className={headerClass}>
        <h1 className={headerTitleClass}>
          <Users className="w-6 h-6" />
          Usuarios
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

        {cargando ? (
          <p className="text-gray-600">Cargando usuarios...</p>
        ) : usuarios.length === 0 ? (
          <div className={vacioClass}>
            <Inbox className="w-8 h-8 text-gray-400" />
            <span>No hay usuarios registrados.</span>
          </div>
        ) : (
          <div className={tablaContenedorClass}>
            <table className={tablaClass}>
              <thead>
                <tr>
                  <th className={celdaTh}>Nombre</th>
                  <th className={celdaTh}>Rol</th>
                  <th className={celdaTh}>Contacto</th>
                  <th className={celdaTh}>Estado</th>
                  <th className={celdaTh}>Cambiar estado</th>
                  <th className={celdaTh}>Cambiar rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const esYo = u.id_usuario === miId
                  const superAdmin = esSuperAdmin(u)
                  const ocupadoEstado =
                    actualizando?.id === u.id_usuario && actualizando.campo === 'estado'
                  const ocupadoRol =
                    actualizando?.id === u.id_usuario && actualizando.campo === 'rol'
                  const rolActual = rolParaSelect(u.rol)
                  const rolConocido = ROLES.includes(rolActual as RolUsuario)
                  return (
                    <tr
                      key={u.id_usuario}
                      className={claseFila(u.estado)}
                    >
                      <td className={`${celda} font-medium`}>
                        {u.nombre}
                        {esYo && <span className="ml-2 text-xs">(tú)</span>}
                        {superAdmin && (
                          <span className="ml-2 text-xs font-semibold text-amber-700">
                            Admin Principal
                          </span>
                        )}
                      </td>
                      <td className={celda}>{u.rol}</td>
                      <td className={celda}>{u.contacto || '—'}</td>
                      <td className={celda}>
                        <InsigniaEstado estado={u.estado} />
                      </td>
                      <td className={celda}>
                        <select
                          value={u.estado}
                          onChange={(e) =>
                            handleCambiarEstado(u, e.target.value as EstadoUsuario)
                          }
                          disabled={actualizando !== null || esYo || superAdmin}
                          title={
                            superAdmin
                              ? 'Admin Principal protegido: su estado no se puede cambiar'
                              : esYo
                                ? 'No puedes cambiar tu propio estado'
                                : undefined
                          }
                          aria-label={`Estado de ${u.nombre}`}
                          className={`${inputClass} bg-white text-gray-900 disabled:opacity-50`}
                        >
                          {ESTADOS.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                        </select>
                        {ocupadoEstado && (
                          <span className="ml-2 text-xs text-gray-500">Guardando...</span>
                        )}
                      </td>
                      <td className={celda}>
                        <select
                          value={rolActual}
                          onChange={(e) =>
                            handleCambiarRol(u, e.target.value as RolUsuario)
                          }
                          disabled={actualizando !== null || esYo || superAdmin}
                          title={
                            superAdmin
                              ? 'Admin Principal protegido: su rol no se puede cambiar'
                              : esYo
                                ? 'No puedes cambiar tu propio rol'
                                : undefined
                          }
                          aria-label={`Rol de ${u.nombre}`}
                          className={`${inputClass} bg-white text-gray-900 disabled:opacity-50`}
                        >
                          {/* Rol guardado fuera del catálogo: se muestra pero no se puede elegir */}
                          {!rolConocido && (
                            <option value={rolActual} disabled>
                              {u.rol}
                            </option>
                          )}
                          {ROLES.map((r) => (
                            <option
                              key={r}
                              value={r}
                              disabled={r === 'admin' && !soyAdminPrincipal}
                            >
                              {r}
                            </option>
                          ))}
                        </select>
                        {ocupadoRol && (
                          <span className="ml-2 text-xs text-gray-500">Guardando...</span>
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
