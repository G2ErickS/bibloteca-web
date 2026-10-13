/**
 * Normaliza el rol para comparar sin importar mayúsculas/minúsculas
 * ('admin', 'Administrador', 'Bibliotecario', 'bibliotecario', etc.).
 */
const ROLES_STAFF = ['admin', 'administrador', 'bibliotecario']

export function esStaff(rol: string | undefined | null): boolean {
  return ROLES_STAFF.includes((rol ?? '').trim().toLowerCase())
}
