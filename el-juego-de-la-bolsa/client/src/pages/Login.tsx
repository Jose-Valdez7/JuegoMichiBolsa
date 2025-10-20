import { useState } from 'react'
import { useAuth } from '../store/useAuth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      nav('/waiting')
    } catch (err: any) {
      setError('Credenciales inválidas')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-slate-800 p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4 text-center">El Juego de la Bolsa</h1>
        <label className="block mb-2 text-sm">Email</label>
        <input className="w-full mb-4 p-2 rounded bg-slate-700" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <label className="block mb-2 text-sm">Contraseña</label>
        <input type="password" className="w-full mb-4 p-2 rounded bg-slate-700" value={password} onChange={(e)=>setPassword(e.target.value)} />
        {error && <div className="text-danger text-sm mb-2">{error}</div>}
        <button className="w-full bg-primary hover:bg-sky-500 py-2 rounded font-semibold">Ingresar</button>
        <p className="text-xs mt-3 opacity-70">Al ingresar aceptas términos y condiciones.</p>
      </form>
    </div>
  )
}
