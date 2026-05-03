'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Edit3, Package, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  type NumericValue,
  formatCurrency,
  optionalText,
  parseDecimal,
} from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'
import { Pagination, paginate } from '@/components/Pagination'

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

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
  stock_unit: string | null
  supplier_id: string | null
  user_id: string
  created_at: string
}

type Supplier = {
  id: string
  name: string
}

type IngredientEditForm = {
  name: string
  category: string
  purchase_unit: string
  purchase_quantity: string
  purchase_price: string
  usage_unit: string
  cost_per_unit: string
  stock_quantity: string
  stock_unit: string
  supplier_id: string
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
function getCategoryLabel(category: string | null) {
  if (!category) return 'Sem categoria'
  return categoryLabels[category] ?? category
}
function buildEditForm(ingredient: Ingredient): IngredientEditForm {
  return {
    name: ingredient.name,
    category: ingredient.category ?? '',
    purchase_unit: ingredient.purchase_unit ?? '',
    purchase_quantity: String(ingredient.purchase_quantity ?? ''),
    purchase_price: String(ingredient.purchase_price ?? ''),
    usage_unit: ingredient.usage_unit ?? '',
    cost_per_unit: String(ingredient.cost_per_unit ?? ''),
    stock_quantity: String(ingredient.stock_quantity ?? ''),
    stock_unit: ingredient.stock_unit ?? '',
    supplier_id: ingredient.supplier_id ?? '',
  }
}

export default function IngredientesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<IngredientEditForm | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
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

        const [ingredientsResponse, suppliersResponse] = await Promise.all([
          supabase
            .from('ingredients')
            .select('id, name, category, purchase_unit, purchase_quantity, purchase_price, usage_unit, cost_per_unit, stock_quantity, stock_unit, supplier_id')
            .eq('user_id', user.id)
            .order('name', { ascending: true }),
          supabase
            .from('suppliers')
            .select('id, name')
            .eq('user_id', user.id)
            .order('name', { ascending: true }),
        ])

        if (ingredientsResponse.error) throw ingredientsResponse.error
        if (suppliersResponse.error) throw suppliersResponse.error

        if (isMounted) {
          setIngredients((ingredientsResponse.data ?? []) as Ingredient[])
          setSuppliers((suppliersResponse.data ?? []) as Supplier[])
        }
      } catch (err) {
        logSupabaseError('Erro ao carregar ingredientes:', err)
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

  useEffect(() => { setCurrentPage(1) }, [searchQuery, supplierFilter])

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return ingredients.filter((ingredient) => {
      const matchesSearch = !query || ingredient.name.toLowerCase().includes(query)
      const matchesSupplier =
        !supplierFilter ||
        (supplierFilter === 'none'
          ? !ingredient.supplier_id
          : ingredient.supplier_id === supplierFilter)

      return matchesSearch && matchesSupplier
    })
  }, [ingredients, searchQuery, supplierFilter])

  const { paged: pagedIngredients, totalPages } = paginate(filteredIngredients, currentPage)

  const supplierById = useMemo(() => {
    return new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  }, [suppliers])

  function getSupplierName(supplierId: string | null) {
    if (!supplierId) return 'Sem fornecedor'

    return supplierById.get(supplierId)?.name ?? 'Sem fornecedor'
  }

  function startEdit(ingredient: Ingredient) {
    setEditingId(ingredient.id)
    setEditForm(buildEditForm(ingredient))
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
    setError('')
  }

  function updateEditForm(field: keyof IngredientEditForm, value: string) {
    setEditForm((currentForm) =>
      currentForm ? { ...currentForm, [field]: value } : currentForm
    )
  }

  async function saveIngredient(ingredient: Ingredient) {
    if (!editForm) return

    if (!editForm.name.trim()) {
      setError('Nome do ingrediente é obrigatório')
      return
    }

    setSavingId(ingredient.id)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const updatedIngredient = {
        name: editForm.name.trim(),
        category: optionalText(editForm.category),
        purchase_unit: optionalText(editForm.purchase_unit),
        purchase_quantity: parseDecimal(editForm.purchase_quantity),
        purchase_price: parseDecimal(editForm.purchase_price),
        usage_unit: optionalText(editForm.usage_unit),
        cost_per_unit: parseDecimal(editForm.cost_per_unit),
        stock_quantity: parseDecimal(editForm.stock_quantity),
        stock_unit: optionalText(editForm.stock_unit),
        supplier_id: editForm.supplier_id || null,
      }

      const { error: updateError } = await supabase
        .from('ingredients')
        .update(updatedIngredient)
        .eq('id', ingredient.id)
        .eq('user_id', user.id)

      if (updateError) {
        logSupabaseError('Erro Supabase ingredients update:', updateError)
        throw updateError
      }

      setIngredients((currentIngredients) =>
        currentIngredients.map((currentIngredient) =>
          currentIngredient.id === ingredient.id
            ? { ...currentIngredient, ...updatedIngredient }
            : currentIngredient
        )
      )
      setEditingId(null)
      setEditForm(null)
    } catch (err) {
      logSupabaseError('Erro ao editar ingrediente:', err)
      setError('Falha ao editar ingrediente')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteIngredient(ingredient: Ingredient) {
    const confirmed = window.confirm(`Excluir o ingrediente "${ingredient.name}"?`)
    if (!confirmed) return

    setDeletingId(ingredient.id)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const { error: deleteError } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', ingredient.id)
        .eq('user_id', user.id)

      if (deleteError) {
        logSupabaseError('Erro Supabase ingredients delete:', deleteError)
        throw deleteError
      }

      setIngredients((currentIngredients) =>
        currentIngredients.filter((currentIngredient) => currentIngredient.id !== ingredient.id)
      )
    } catch (err) {
      logSupabaseError('Erro ao deletar ingrediente:', err)
      setError('Falha ao deletar ingrediente')
    } finally {
      setDeletingId(null)
    }
  }

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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <div>
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

            <div>
              <label className="sr-only" htmlFor="supplier-filter">
                Filtrar por fornecedor
              </label>
              <select
                id="supplier-filter"
                value={supplierFilter}
                onChange={(event) => setSupplierFilter(event.target.value)}
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="">Todos os fornecedores</option>
                <option value="none">Sem fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando ingredientes...</p>
          </div>
        ) : pagedIngredients.length === 0 && filteredIngredients.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              {searchQuery || supplierFilter
                ? 'Nenhum ingrediente encontrado'
                : 'Nenhum ingrediente cadastrado'}
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery || supplierFilter
                ? 'Tente buscar por outro nome.'
                : 'Cadastre seus insumos para acompanhar custos e alertas de estoque.'}
            </p>
            {!searchQuery && !supplierFilter && (
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
          <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedIngredients.map((ingredient) => {
              const usageUnit = ingredient.usage_unit || 'un.'
              const stockUnit = ingredient.stock_unit || usageUnit
              const currentEditForm = editingId === ingredient.id ? editForm : null

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

                    <span className="inline-flex shrink-0 items-center rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-bold text-[#1A0A08]">
                      {ingredient.stock_quantity ?? 0} {stockUnit}
                    </span>
                  </div>

                  {currentEditForm ? (
                    <div className="mb-4 grid grid-cols-1 gap-3">
                      <input
                        type="text"
                        value={currentEditForm.name}
                        onChange={(event) => updateEditForm('name', event.target.value)}
                        placeholder="Nome"
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={currentEditForm.category}
                          onChange={(event) => updateEditForm('category', event.target.value)}
                          placeholder="Categoria"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="text"
                          value={currentEditForm.usage_unit}
                          onChange={(event) => updateEditForm('usage_unit', event.target.value)}
                          placeholder="Unidade de uso"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="text"
                          value={currentEditForm.purchase_unit}
                          onChange={(event) => updateEditForm('purchase_unit', event.target.value)}
                          placeholder="Unidade de compra"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={currentEditForm.purchase_quantity}
                          onChange={(event) =>
                            updateEditForm('purchase_quantity', event.target.value)
                          }
                          placeholder="Qtd. compra"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentEditForm.purchase_price}
                          onChange={(event) => updateEditForm('purchase_price', event.target.value)}
                          placeholder="Preco compra"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={currentEditForm.cost_per_unit}
                          onChange={(event) => updateEditForm('cost_per_unit', event.target.value)}
                          placeholder="Custo por unidade"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={currentEditForm.stock_quantity}
                          onChange={(event) => updateEditForm('stock_quantity', event.target.value)}
                          placeholder="Estoque"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="text"
                          value={currentEditForm.stock_unit}
                          onChange={(event) => updateEditForm('stock_unit', event.target.value)}
                          placeholder="Unidade estoque"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <select
                          value={currentEditForm.supplier_id}
                          onChange={(event) => updateEditForm('supplier_id', event.target.value)}
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        >
                          <option value="">Sem fornecedor</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}

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

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#999999]">Estoque atual</p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {ingredient.stock_quantity ?? 0} {stockUnit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#999999]">
                          Fornecedor preferencial
                        </p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {getSupplierName(ingredient.supplier_id)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentEditForm ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveIngredient(ingredient)}
                          disabled={savingId === ingredient.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#C0392B] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save size={16} aria-hidden="true" />
                          <span>Salvar</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#F4E9DD]"
                        >
                          <X size={16} aria-hidden="true" />
                          <span>Cancelar</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(ingredient)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#F4E9DD]"
                      >
                        <Edit3 size={16} aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteIngredient(ingredient)}
                      disabled={deletingId === ingredient.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </main>
    </div>
  )
}
