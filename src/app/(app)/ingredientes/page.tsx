'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Package, Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Ingredient {
  id: string
  name: string
  category: string | null
  purchase_unit: string | null
  purchase_quantity: number | null
  purchase_price: number | null
  usage_unit: string | null
  cost_per_unit: number | null
  stock_quantity: number | null
  minimum_stock: number | null
  user_id: string
  created_at: string
}

const categoryLabels: Record<string, string> = {
  farinhas: 'Farinhas',
  acucares: 'Açúcares',
  lactinios: 'Laticínios',
  laticinios: 'Laticínios',
  gorduras: 'Gorduras',
  ovos: 'Ovos',
  chocolates: 'Chocolates',
  frutas: 'Frutas',
  essencias: 'Essências',
  embalagens: 'Embalagens',
  outros: 'Outros',
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0)
}

function getCategoryLabel(category: string | null) {
  if (!category) return 'Sem categoria'
  return categoryLabels[category] ?? category
}

function isLowStock(ingredient: Ingredient) {
  return (ingredient.stock_quantity ?? 0) <= (ingredient.minimum_stock ?? 0)
}

export default function IngredientesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadIngredients() {
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

        const { data, error: ingredientsError } = await supabase
          .from('ingredients')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (ingredientsError) throw ingredientsError

        if (isMounted) {
          setIngredients((data ?? []) as Ingredient[])
        }
      } catch (err) {
        console.error('Erro ao carregar ingredientes:', err)
        if (isMounted) {
          setError('Falha ao carregar ingredientes')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadIngredients()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return ingredients

    return ingredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query)
    )
  }, [ingredients, searchQuery])

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              Estoque
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Ingredientes</h1>
          </div>

          <Link
            href="/ingredientes/novo"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={19} aria-hidden="true" />
            <span>Novo ingrediente</span>
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
          <label className="sr-only" htmlFor="ingredient-search">
            Buscar ingrediente por nome
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
              size={20}
              aria-hidden="true"
            />
            <input
              id="ingredient-search"
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
            <p className="mt-3 text-sm text-[#999999]">Carregando ingredientes...</p>
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              {searchQuery ? 'Nenhum ingrediente encontrado' : 'Nenhum ingrediente cadastrado'}
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery
                ? 'Tente buscar por outro nome.'
                : 'Cadastre seus insumos para acompanhar custos e alertas de estoque.'}
            </p>
            {!searchQuery && (
              <Link
                href="/ingredientes/novo"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Novo ingrediente</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredIngredients.map((ingredient) => {
              const lowStock = isLowStock(ingredient)
              const usageUnit = ingredient.usage_unit || 'un.'

              return (
                <article
                  key={ingredient.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-[#1A0A08]">
                        {ingredient.name}
                      </h2>
                      <p className="mt-1 text-sm text-[#999999]">
                        {getCategoryLabel(ingredient.category)}
                      </p>
                    </div>

                    {lowStock && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-[#C0392B]">
                        Estoque baixo
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg bg-[#FAF6F0] p-3">
                      <p className="text-xs font-medium text-[#999999]">
                        Preço por unidade de uso
                      </p>
                      <p className="mt-1 text-lg font-bold text-[#1A0A08]">
                        {formatCurrency(ingredient.cost_per_unit)}
                        <span className="ml-1 text-sm font-medium text-[#999999]">
                          / {usageUnit}
                        </span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#999999]">Estoque atual</p>
                        <p className={`mt-1 font-bold ${lowStock ? 'text-[#C0392B]' : 'text-[#1A0A08]'}`}>
                          {ingredient.stock_quantity ?? 0} {usageUnit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#999999]">Estoque mínimo</p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {ingredient.minimum_stock ?? 0} {usageUnit}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
