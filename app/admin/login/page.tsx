'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ user, pass }),
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) {
      router.push('/admin')
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-black text-2xl tracking-widest">LIUX</div>
          <div className="text-xs tracking-widest text-slate-400 uppercase">Panel de administración</div>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario</label>
          <input className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400" value={user} onChange={e => setUser(e.target.value)} placeholder="admin" />
        </div>
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
          <input type="password" className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-400" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <button onClick={handleLogin} className="w-full bg-[#081224] text-white font-bold py-3 rounded-lg hover:bg-[#162040] transition">
          Entrar
        </button>
      </div>
    </div>
  )
}