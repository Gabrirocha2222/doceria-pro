'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos. Tente novamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 border border-[#F2D4CF]">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#D4847A] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🍰</span>
        </div>
        <h1 className="text-2xl font-bold text-[#4A2C2A]">Doceria Pro</h1>
        <p className="text-sm text-[#9C8480] mt-1">Gerencie sua confeitaria com amor</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#4A2C2A] mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#F2D4CF] bg-[#FAF7F2] text-[#4A2C2A] placeholder-[#C4B5B0] focus:outline-none focus:ring-2 focus:ring-[#D4847A] focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#4A2C2A] mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#F2D4CF] bg-[#FAF7F2] text-[#4A2C2A] placeholder-[#C4B5B0] focus:outline-none focus:ring-2 focus:ring-[#D4847A] focus:border-transparent transition"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#D4847A] hover:bg-[#C07068] text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-sm text-[#9C8480] mt-6">
        Ainda não tem conta?{' '}
        <Link href="/cadastro" className="text-[#D4847A] font-semibold hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  )
}