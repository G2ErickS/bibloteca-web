/**
 * Normaliza el rol para comparar sin importar mayúsculas/minúsculas
 * ('admin', 'Administrador', 'Bibliotecario', 'bibliotecario', etc.).
 */
const ROLES_ADMIN = ['admin', 'administrador']
const ROLES_STAFF = [...ROLES_ADMIN, 'bibliotecario']

function normalizar(rol: string | undefined | null): string {
  return (rol ?? '').trim().toLowerCase()
}

export function esStaff(rol: string | undefined | null): boolean {
  return ROLES_STAFF.includes(normalizar(rol))
}

/** Solo Administrador (no incluye Bibliotecario) */
export function esAdmin(rol: string | undefined | null): boolean {
  return ROLES_ADMIN.includes(normalizar(rol))
}
