'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BookOpen,
  CircleDollarSign,
  Percent,
  Plus,
  Search,
  Utensils,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Recipe {
  id: string
  user_id: string
  name: string
  category: string | null
  yield_amount: number | null
  yield_unit: string | null
  total_cost: number | null
  cost_per_unit: number | null
  profit_margin: number | null
  suggested_price: number | null
  instructions: string | null
  notes: string | null
  created_at?: string
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0)
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(value ?? 0)
}

function formatYield(recipe: Recipe) {
  const amount = formatNumber(recipe.yield_amount)
  const unit = recipe.yield_unit?.trim() || 'unidades'

  return `${amount} ${unit}`
}

export default function ReceitasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadRecipes() {
      setIsLoading(true)
      setError('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuário não autenticado')
        }

        const { data, error: recipesError } = await supabase
          .from('recipes')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (recipesError) throw recipesError

        if (isMounted) {
          setRecipes((data ?? []) as Recipe[])
        }
      } catch (err) {
        console.error('Erro ao carregar receitas:', err)
        if (isMounted) {
          setError('Falha ao carregar receitas')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRecipes()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return recipes

    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query))
  }, [recipes, searchQuery])

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              CARDÁPIO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Receitas</h1>
          </div>

          <Link
            href="/receitas/nova"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={19} aria-hidden="true" />
            <span>Nova receita</span>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6">
          <label className="sr-only" htmlFor="recipe-search">
            Buscar receita por nome
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
              size={20}
              aria-hidden="true"
            />
            <input
              id="recipe-search"
              type="search"
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando receitas...</p>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              {searchQuery ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery
                ? 'Tente buscar por outro nome.'
                : 'Cadastre suas receitas para calcular custos, margem e preço sugerido.'}
            </p>
            {!searchQuery && (
              <Link
                href="/receitas/nova"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova receita</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <article
                key={recipe.id}
                className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                      {recipe.category || 'Sem categoria'}
                    </p>
                    <h2 className="mt-1 truncate text-base font-bold text-[#1A0A08]">
                      {recipe.name}
                    </h2>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C0392B]">
                    <Utensils size={21} aria-hidden="true" />
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-[#FAF6F0] p-3">
                  <p className="text-xs font-medium text-[#999999]">Preço sugerido de venda</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(recipe.suggested_price)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-[#999999]">Rendimento</p>
                    <p className="mt-1 font-bold text-[#1A0A08]">{formatYield(recipe)}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[#999999]">Margem</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-bold text-[#1A0A08]">
                      <Percent size={14} className="text-[#C9A84C]" aria-hidden="true" />
                      {formatNumber(recipe.profit_margin)}%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[#999999]">Custo total</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-bold text-[#1A0A08]">
                      <CircleDollarSign size={14} className="text-[#C0392B]" aria-hidden="true" />
                      {formatCurrency(recipe.total_cost)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[#999999]">Custo por unidade</p>
                    <p className="mt-1 font-bold text-[#1A0A08]">
                      {formatCurrency(recipe.cost_per_unit)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
