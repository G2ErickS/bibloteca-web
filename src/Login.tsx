import { useState } from 'react'
import { supabase } from './supabaseClient'

const inputLoginClass =
  'border border-gray-800 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
const btnLoginClass =
  'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md w-full transition-colors'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [esRegistro, setEsRegistro] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // Iniciar sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMensaje(error.message)
    }
  }

  // Registrar usuario
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre }, // Se guarda en raw_user_meta_data
      },
    })
    if (error) {
      setMensaje(error.message)
    } else {
      setMensaje('Revisa tu correo para confirmar tu cuenta.')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={esRegistro ? handleRegistro : handleLogin}
        className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm w-80"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">
          {esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
        </h1>

        {esRegistro && (
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={`w-full mb-3 ${inputLoginClass}`}
            required
          />
        )}

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full mb-3 ${inputLoginClass}`}
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full mb-3 ${inputLoginClass}`}
          required
        />

        {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

        <button
          type="submit"
          className={btnLoginClass}
        >
          {esRegistro ? 'Registrarme' : 'Entrar'}
        </button>

        <p
          className="text-center mt-4 text-blue-600 hover:text-blue-700 hover:underline text-sm font-normal cursor-pointer"
          onClick={() => setEsRegistro(!esRegistro)}
        >
          {esRegistro ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
        </p>
      </form>
    </div>
  )
}
