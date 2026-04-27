'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function CadastroPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })

    if (error) {
      setError('Erro ao criar conta. Tente novamente.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-white rounded-3xl shadow-lg p-8 border border-[#F2D4CF] text-center">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-bold text-[#4A2C2A] mb-2">Conta criada!</h2>
        <p className="text-[#9C8480] text-sm mb-6">
          Verifique seu email para confirmar o cadastro e depois faça login.
        </p>
        <Link
          href="/login"
          className="block w-full bg-[#D4847A] hover:bg-[#C07068] text-white font-semibold py-3 rounded-xl transition text-center"
        >
          Ir para o Login
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 border border-[#F2D4CF]">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#D4847A] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🍰</span>
        </div>
        <h1 className="text-2xl font-bold text-[#4A2C2A]">Criar conta</h1>
        <p className="text-sm text-[#9C8480] mt-1">Comece a organizar sua doceria hoje</p>
      </div>

      <form onSubmit={handleCadastro} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#4A2C2A] mb-1">Seu nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria Silva"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#F2D4CF] bg-[#FAF7F2] text-[#4A2C2A] placeholder-[#C4B5B0] focus:outline-none focus:ring-2 focus:ring-[#D4847A] focus:border-transparent transition"
          />
        </div>

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
            placeholder="Mínimo 6 caracteres"
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
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-sm text-[#9C8480] mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-[#D4847A] font-semibold hover:underline">
          Fazer login
        </Link>
      </p>
    </div>
  )
}