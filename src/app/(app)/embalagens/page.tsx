'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Boxes, Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Packaging = {
  id: string
  user_id: string
  name: string
  category: string | null
  package_quantity: number | string
  unit: string
  package_cost: number | string
  cost_per_unit: number | string
  capacity: number | string | null
  capacity_unit: string | null
  notes: string | null
  created_at?: string
}

const categoryOptions = ['Forminha', 'Caixa', 'Saco', 'Bandeja', 'Transporte', 'Outro']

function parseNumeric(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(parseNumeric(value))
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(parseNumeric(value))
}

function getCategoryLabel(category: string | null) {
  return category?.trim() || 'Sem categoria'
}

function formatCapacity(packaging: Packaging) {
  const capacity = parseNumeric(packaging.capacity)

  if (capacity <= 0) return ''

  return `${formatNumber(capacity)} ${packaging.capacity_unit?.trim() || 'unidades'}`
}

export default function EmbalagensPage() {
  const [packagingItems, setPackagingItems] = useState<Packaging[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadPackaging() {
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

        const { data, error: packagingError } = await supabase
          .from('packaging')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (packagingError) throw packagingError

        if (isMounted) {
          setPackagingItems((data ?? []) as Packaging[])
        }
      } catch (err) {
        console.error('Erro ao carregar embalagens:', err)
        if (isMounted) {
          setError('Falha ao carregar embalagens')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadPackaging()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const categoryFilterOptions = useMemo(() => {
    const categories = new Set(categoryOptions)

    packagingItems.forEach((item) => {
      if (item.category?.trim()) {
        categories.add(item.category)
      }
    })

    return Array.from(categories).sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory, 'pt-BR')
    )
  }, [packagingItems])

  const filteredPackaging = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return packagingItems.filter((item) => {
      const matchesSearch = query ? item.name.toLowerCase().includes(query) : true
      const matchesCategory =
        categoryFilter === 'todas' ? true : item.category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [categoryFilter, packagingItems, searchQuery])

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              ESTOQUE
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Embalagens</h1>
          </div>

          <Link
            href="/embalagens/nova"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={19} aria-hidden="true" />
            <span>Nova embalagem</span>
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

        <section className="mb-6 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <label className="sr-only" htmlFor="packaging-search">
                Buscar embalagem por nome
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={20}
                  aria-hidden="true"
                />
                <input
                  id="packaging-search"
                  type="search"
                  placeholder="Buscar por nome..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="category-filter">
                Categoria
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="todas">Todas categorias</option>
                {categoryFilterOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando embalagens...</p>
          </div>
        ) : filteredPackaging.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <Boxes className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              {searchQuery || categoryFilter !== 'todas'
                ? 'Nenhuma embalagem encontrada'
                : 'Nenhuma embalagem cadastrada'}
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery || categoryFilter !== 'todas'
                ? 'Tente ajustar a busca ou categoria.'
                : 'Cadastre caixas, forminhas e outros itens para acompanhar custos.'}
            </p>
            {!searchQuery && categoryFilter === 'todas' && (
              <Link
                href="/embalagens/nova"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova embalagem</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPackaging.map((item) => {
              const capacity = formatCapacity(item)

              return (
                <article
                  key={item.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-[#1A0A08]">
                        {item.name}
                      </h2>
                      <p className="mt-1 text-sm text-[#999999]">
                        {getCategoryLabel(item.category)}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C0392B]">
                      <Boxes size={21} aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mb-4 rounded-lg bg-[#FAF6F0] p-3">
                    <p className="text-xs font-medium text-[#999999]">Custo por unidade</p>
                    <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                      {formatCurrency(item.cost_per_unit)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-[#999999]">
                        Quantidade por pacote
                      </p>
                      <p className="mt-1 font-bold text-[#1A0A08]">
                        {formatNumber(item.package_quantity)} {item.unit}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#999999]">Custo do pacote</p>
                      <p className="mt-1 font-bold text-[#1A0A08]">
                        {formatCurrency(item.package_cost)}
                      </p>
                    </div>

                    {capacity && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-[#999999]">Capacidade</p>
                        <p className="mt-1 font-bold text-[#1A0A08]">{capacity}</p>
                      </div>
                    )}

                    {item.notes && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-[#999999]">Observações</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-[#1A0A08]">
                          {item.notes}
                        </p>
                      </div>
                    )}
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
