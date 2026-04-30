'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BookOpen,
  CircleDollarSign,
  Package,
  Percent,
  Plus,
  Search,
  Utensils,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type NumericValue = number | string | null | undefined
type ProductType = 'simples' | 'kit'

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

interface Recipe {
  id: string
  user_id: string
  name: string
  category: string | null
  yield_amount: NumericValue
  yield_unit: string | null
  total_cost: NumericValue
  cost_per_unit: NumericValue
  profit_margin: NumericValue
  suggested_price: NumericValue
  sale_price: NumericValue
  supplier_cost: NumericValue
  supplier_cost_unit: string | null
  product_type: ProductType | null
  is_third_party: boolean | null
  supplier_id: string | null
  instructions: string | null
  notes: string | null
  created_at?: string
}

type RecipePackagingLink = {
  recipe_id: string
}

type ProductKitLink = {
  kit_recipe_id: string
}

type KitCategoryComponentLink = {
  kit_recipe_id: string
}

type KitFlexibleGroupLink = {
  kit_recipe_id: string
}

type Supplier = {
  id: string
  name: string
}

function parseNumericValue(value: NumericValue) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function logSupabaseError(context: string, error: unknown) {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}

  console.error(context, {
    message: supabaseError.message,
    details: supabaseError.details,
    hint: supabaseError.hint,
    code: supabaseError.code,
  })
}

function formatCurrency(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseNumericValue(value))
}

function formatNumber(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(parseNumericValue(value))
}

function formatYield(recipe: Recipe) {
  const amount = formatNumber(recipe.yield_amount)
  const unit = recipe.yield_unit?.trim() || 'unidades'

  return `${amount} ${unit}`
}

function getEffectiveSalePrice(recipe: Recipe) {
  return recipe.sale_price ?? recipe.suggested_price
}

export default function ReceitasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [packagingCountByRecipeId, setPackagingCountByRecipeId] = useState<Record<string, number>>(
    {}
  )
  const [kitItemCountByRecipeId, setKitItemCountByRecipeId] = useState<Record<string, number>>({})
  const [kitCategoryCountByRecipeId, setKitCategoryCountByRecipeId] = useState<
    Record<string, number>
  >({})
  const [kitFlexibleGroupCountByRecipeId, setKitFlexibleGroupCountByRecipeId] = useState<
    Record<string, number>
  >({})
  const [supplierNameById, setSupplierNameById] = useState<Record<string, string>>({})
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

        const recipeRows = (data ?? []) as Recipe[]
        const recipeIds = recipeRows.map((recipe) => recipe.id)
        const packagingCounts = new Map<string, number>()
        const kitItemCounts = new Map<string, number>()
        const kitCategoryCounts = new Map<string, number>()
        const kitFlexibleGroupCounts = new Map<string, number>()
        const supplierIds = Array.from(
          new Set(
            recipeRows
              .map((recipe) => recipe.supplier_id)
              .filter((supplierId): supplierId is string => Boolean(supplierId))
          )
        )
        const supplierNames = new Map<string, string>()

        if (recipeIds.length > 0) {
          const { data: packagingLinks, error: packagingError } = await supabase
            .from('recipe_packaging')
            .select('recipe_id')
            .eq('user_id', user.id)
            .in('recipe_id', recipeIds)

          if (packagingError) {
            logSupabaseError('Erro Supabase recipe_packaging:', packagingError)
          } else {
            const links = (packagingLinks ?? []) as RecipePackagingLink[]

            links.forEach((link) => {
              packagingCounts.set(link.recipe_id, (packagingCounts.get(link.recipe_id) ?? 0) + 1)
            })
          }

          const { data: kitLinks, error: kitItemsError } = await supabase
            .from('product_kit_items')
            .select('kit_recipe_id')
            .eq('user_id', user.id)
            .in('kit_recipe_id', recipeIds)

          if (kitItemsError) {
            logSupabaseError('Erro Supabase product_kit_items:', kitItemsError)
          } else {
            const links = (kitLinks ?? []) as ProductKitLink[]

            links.forEach((link) => {
              kitItemCounts.set(
                link.kit_recipe_id,
                (kitItemCounts.get(link.kit_recipe_id) ?? 0) + 1
              )
            })
          }

          const { data: kitCategoryLinks, error: kitCategoryError } = await supabase
            .from('kit_category_components')
            .select('kit_recipe_id')
            .eq('user_id', user.id)
            .in('kit_recipe_id', recipeIds)

          if (kitCategoryError) {
            logSupabaseError('Erro Supabase kit_category_components:', kitCategoryError)
          } else {
            const links = (kitCategoryLinks ?? []) as KitCategoryComponentLink[]

            links.forEach((link) => {
              kitCategoryCounts.set(
                link.kit_recipe_id,
                (kitCategoryCounts.get(link.kit_recipe_id) ?? 0) + 1
              )
            })
          }

          const { data: flexibleGroupLinks, error: flexibleGroupError } = await supabase
            .from('kit_flexible_groups')
            .select('kit_recipe_id')
            .eq('user_id', user.id)
            .in('kit_recipe_id', recipeIds)

          if (flexibleGroupError) {
            logSupabaseError('Erro Supabase kit_flexible_groups:', flexibleGroupError)
          } else {
            const links = (flexibleGroupLinks ?? []) as KitFlexibleGroupLink[]

            links.forEach((link) => {
              kitFlexibleGroupCounts.set(
                link.kit_recipe_id,
                (kitFlexibleGroupCounts.get(link.kit_recipe_id) ?? 0) + 1
              )
            })
          }
        }

        if (supplierIds.length > 0) {
          const { data: suppliersData, error: suppliersError } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('user_id', user.id)
            .in('id', supplierIds)

          if (suppliersError) {
            logSupabaseError('Erro Supabase suppliers:', suppliersError)
          } else {
            const supplierRows = (suppliersData ?? []) as Supplier[]

            supplierRows.forEach((supplier) => {
              supplierNames.set(supplier.id, supplier.name)
            })
          }
        }

        if (isMounted) {
          setRecipes(recipeRows)
          setPackagingCountByRecipeId(Object.fromEntries(packagingCounts))
          setKitItemCountByRecipeId(Object.fromEntries(kitItemCounts))
          setKitCategoryCountByRecipeId(Object.fromEntries(kitCategoryCounts))
          setKitFlexibleGroupCountByRecipeId(Object.fromEntries(kitFlexibleGroupCounts))
          setSupplierNameById(Object.fromEntries(supplierNames))
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
            {filteredRecipes.map((recipe) => {
              const effectiveSalePrice = getEffectiveSalePrice(recipe)
              const usesSuggestedPrice = recipe.sale_price == null
              const packagingCount = packagingCountByRecipeId[recipe.id] ?? 0
              const hasPackaging = packagingCount > 0
              const productType = recipe.product_type === 'kit' ? 'kit' : 'simples'
              const isKit = productType === 'kit'
              const isThirdParty = recipe.is_third_party === true
              const kitItemCount = kitItemCountByRecipeId[recipe.id] ?? 0
              const kitCategoryCount = kitCategoryCountByRecipeId[recipe.id] ?? 0
              const kitFlexibleGroupCount = kitFlexibleGroupCountByRecipeId[recipe.id] ?? 0
              const kitComponentCount = kitItemCount + kitCategoryCount + kitFlexibleGroupCount
              const supplierName = recipe.supplier_id
                ? supplierNameById[recipe.supplier_id]
                : undefined

              return (
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

                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#FAF6F0] px-3 py-1 text-xs font-semibold text-[#1A0A08]">
                      {isKit ? 'Kit' : 'Produto simples'}
                    </span>
                    {isThirdParty && (
                      <span className="rounded-full bg-[#F8EFE0] px-3 py-1 text-xs font-semibold text-[#8A6B1F]">
                        Terceirizado
                      </span>
                    )}
                  </div>

                  <div className="mb-4 space-y-3">
                    <div className="rounded-lg bg-[#FAF6F0] p-3">
                      <p className="text-xs font-medium text-[#999999]">
                        Preço usado em pedidos
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                        {formatCurrency(effectiveSalePrice)}
                      </p>
                      {usesSuggestedPrice && (
                        <p className="mt-1 text-xs font-semibold text-[#C9A84C]">
                          Usando preço sugerido
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-[#FAF6F0] p-3">
                        <p className="text-xs font-medium text-[#999999]">Preço sugerido</p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {formatCurrency(recipe.suggested_price)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-[#FAF6F0] p-3">
                        <p className="text-xs font-medium text-[#999999]">
                          Preço que eu cobro
                        </p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {recipe.sale_price == null
                            ? 'Não definido'
                            : formatCurrency(recipe.sale_price)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isKit && (
                    <div className="mb-4 rounded-lg bg-[#FAF6F0] p-3 text-sm">
                      <p className="font-semibold text-[#1A0A08]">
                        {kitComponentCount === 1
                          ? '1 componente no kit'
                          : `${kitComponentCount} componentes no kit`}
                      </p>
                      <div className="mt-1 space-y-0.5 text-xs text-[#999999]">
                        {kitItemCount > 0 && (
                          <p>
                            {kitItemCount === 1
                              ? '1 produto fixo'
                              : `${kitItemCount} produtos fixos`}
                          </p>
                        )}
                        {kitCategoryCount > 0 && (
                          <p>
                            {kitCategoryCount === 1
                              ? '1 categoria'
                              : `${kitCategoryCount} categorias`}
                          </p>
                        )}
                        {kitFlexibleGroupCount > 0 && (
                          <p>
                            {kitFlexibleGroupCount === 1
                              ? '1 grupo flexivel'
                              : `${kitFlexibleGroupCount} grupos flexiveis`}
                          </p>
                        )}
                        {kitComponentCount === 0 && <p>Composicao ainda nao cadastrada.</p>}
                      </div>
                    </div>
                  )}

                  {isThirdParty && (
                    <div className="mb-4 rounded-lg bg-[#FAF6F0] p-3 text-sm">
                      <p className="font-semibold text-[#1A0A08]">Terceirizado</p>
                      <p className="mt-1 text-xs text-[#999999]">
                        {supplierName ? `Fornecedor: ${supplierName}` : 'Fornecedor nao definido'}
                      </p>
                      <p className="mt-2 text-xs text-[#999999]">Custo fornecedor</p>
                      <p className="font-bold text-[#1A0A08]">
                        {formatCurrency(recipe.supplier_cost)}
                        {recipe.supplier_cost_unit ? ` / ${recipe.supplier_cost_unit}` : ''}
                      </p>
                    </div>
                  )}

                  {!isThirdParty && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg bg-[#FAF6F0] p-3 text-sm">
                      <Package
                        size={17}
                        className={hasPackaging ? 'text-[#C9A84C]' : 'text-[#999999]'}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-semibold text-[#1A0A08]">
                          {hasPackaging
                            ? `${packagingCount} ${
                                packagingCount === 1
                                  ? 'embalagem vinculada'
                                  : 'embalagens vinculadas'
                              }`
                            : 'Sem embalagens vinculadas'}
                        </p>
                        {hasPackaging && (
                          <p className="text-xs text-[#999999]">
                            Custo de embalagem incluido na precificacao.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

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
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
