import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [esRegistro, setEsRegistro] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // 🔹 Iniciar sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMensaje(error.message)
    }
  }

  // 🔹 Registrar usuario
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
        className="bg-white p-8 rounded-lg shadow-md w-80"
      >
        <h1 className="text-2xl font-bold mb-4 text-center">
          {esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
        </h1>

        {esRegistro && (
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border p-2 rounded mb-3"
            required
          />
        )}

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded mb-3"
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded mb-3"
          required
        />

        {mensaje && <p className="text-red-500 text-sm mb-3">{mensaje}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {esRegistro ? 'Registrarme' : 'Entrar'}
        </button>

        <p
          className="text-sm text-center mt-3 text-blue-600 cursor-pointer"
          onClick={() => setEsRegistro(!esRegistro)}
        >
          {esRegistro ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
        </p>
      </form>
    </div>
  )
}
