/** Clases de Tailwind compartidas para mantener la UI homogénea (solo estilos). */

/** Header verde de todas las pantallas */
export const headerClass =
  'bg-green-700 text-white shadow-md px-6 py-4 flex justify-between items-center'

export const headerTitleClass =
  'flex items-center gap-2 text-xl font-bold tracking-tight'

/** Botón blanco del header ("Volver al menú", "Ver libros", "Carrito", "Salir") */
export const headerBtnClass =
  'inline-flex items-center gap-2 bg-white text-green-700 font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-green-50 transition-colors'

/** Contenedor principal centrado (debajo del header) */
export const mainClass =
  'w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'

/** Contenedor de tablas */
export const tablaContenedorClass =
  'w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto'

export const tablaClass = 'w-full text-left border-collapse'

/** Encabezado de columna */
export const thClass =
  'px-4 py-3 bg-gray-100 font-semibold text-gray-700 text-left border-b border-gray-200'

/** Fila de tabla con efecto zebra */
export const trZebraClass =
  'odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors'

/** Celda de tabla */
export const tdClass = 'px-4 py-3 text-sm text-gray-700'

/** Inputs y selects */
export const inputClass =
  'border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none'

/** Botones de acción */
export const btnPrimarioClass =
  'bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export const btnSecundarioClass =
  'bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export const btnPeligroClass =
  'bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

/** Tarjeta de estado vacío */
export const vacioClass =
  'bg-white border border-gray-200 rounded-xl shadow-sm p-8 flex flex-col items-center gap-3 text-gray-600'

/** Insignia de estado (píldora) */
export const insigniaClass =
  'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold'
