'use client'

import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Clipboard,
  ClipboardCheck,
  PackageSearch,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Recipe = {
  id: string
  user_id: string
  name: string
  category: string | null
  yield_amount: number | string | null
  yield_unit: string | null
  is_third_party: boolean | null
}

type RecipeIngredient = {
  recipe_id: string
  ingredient_id: string
  quantity: number | string | null
  unit: string | null
}

type Ingredient = {
  id: string
  user_id: string
  name: string
  usage_unit: string | null
  cost_per_unit: number | string | null
}

type UnitDefinition = {
  kind: 'weight' | 'volume' | 'count'
  factor: number
}

type ShoppingListItem = {
  ingredientId: string
  name: string
  quantity: number
  unit: string
  estimatedCost: number | null
  hasMixedUnits: boolean
}

const unitDefinitions: Record<string, UnitDefinition> = {
  g: { kind: 'weight', factor: 1 },
  grama: { kind: 'weight', factor: 1 },
  gramas: { kind: 'weight', factor: 1 },
  kg: { kind: 'weight', factor: 1000 },
  kilo: { kind: 'weight', factor: 1000 },
  quilo: { kind: 'weight', factor: 1000 },
  kilos: { kind: 'weight', factor: 1000 },
  quilos: { kind: 'weight', factor: 1000 },
  ml: { kind: 'volume', factor: 1 },
  mililitro: { kind: 'volume', factor: 1 },
  mililitros: { kind: 'volume', factor: 1 },
  l: { kind: 'volume', factor: 1000 },
  litro: { kind: 'volume', factor: 1000 },
  litros: { kind: 'volume', factor: 1000 },
  un: { kind: 'count', factor: 1 },
  unidade: { kind: 'count', factor: 1 },
  unidades: { kind: 'count', factor: 1 },
  fatia: { kind: 'count', factor: 1 },
  fatias: { kind: 'count', factor: 1 },
  porcao: { kind: 'count', factor: 1 },
  porcoes: { kind: 'count', factor: 1 },
  porção: { kind: 'count', factor: 1 },
  porções: { kind: 'count', factor: 1 },
  pacote: { kind: 'count', factor: 1 },
  pacotes: { kind: 'count', factor: 1 },
  pct: { kind: 'count', factor: 1 },
}

function parseNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function normalizeUnit(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getUnitDefinition(unit: string) {
  return unitDefinitions[normalizeUnit(unit)]
}

function canConvertUnits(fromUnit: string, toUnit: string) {
  const fromDefinition = getUnitDefinition(fromUnit)
  const toDefinition = getUnitDefinition(toUnit)

  return Boolean(
    fromDefinition && toDefinition && fromDefinition.kind === toDefinition.kind
  )
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  const fromDefinition = getUnitDefinition(fromUnit)
  const toDefinition = getUnitDefinition(toUnit)

  if (!fromDefinition || !toDefinition || fromDefinition.kind !== toDefinition.kind) {
    return null
  }

  return (quantity * fromDefinition.factor) / toDefinition.factor
}

function calculateIngredientCost(
  quantity: number,
  recipeUnit: string,
  ingredient: Ingredient | undefined
) {
  if (!ingredient) return null

  const costPerUnit = parseNumber(ingredient.cost_per_unit)
  const ingredientUnit = ingredient.usage_unit?.trim() || recipeUnit

  if (quantity <= 0 || costPerUnit <= 0) return null

  const recipeDefinition = getUnitDefinition(recipeUnit)
  const ingredientDefinition = getUnitDefinition(ingredientUnit)

  if (
    recipeDefinition &&
    ingredientDefinition &&
    recipeDefinition.kind === ingredientDefinition.kind
  ) {
    const quantityInIngredientUnit =
      (quantity * recipeDefinition.factor) / ingredientDefinition.factor

    return quantityInIngredientUnit * costPerUnit
  }

  return quantity * costPerUnit
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Indisponível'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(value ?? 0)
}

function getYieldLabel(recipe: Recipe) {
  const yieldAmount = parseNumber(recipe.yield_amount)
  const yieldUnit = recipe.yield_unit?.trim() || 'unidades'

  if (yieldAmount <= 0) return `Rendimento não informado em ${yieldUnit}`

  return `${formatNumber(yieldAmount)} ${yieldUnit}`
}

function getDefaultProductionAmount(recipe: Recipe) {
  const yieldAmount = parseNumber(recipe.yield_amount)

  return yieldAmount > 0 ? String(yieldAmount) : ''
}

function addCost(previousCost: number | null, nextCost: number | null) {
  if (previousCost === null || nextCost === null) return null

  return previousCost + nextCost
}

export default function ListaComprasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set())
  const [productionAmounts, setProductionAmounts] = useState<Record<string, string>>({})
  const [hasGeneratedList, setHasGeneratedList] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadShoppingData() {
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

        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, user_id, name, category, yield_amount, yield_unit, is_third_party')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (recipesError) throw recipesError

        const loadedRecipes = ((recipesData ?? []) as Recipe[]).filter(
          (recipe) => recipe.is_third_party !== true
        )
        const recipeIds = loadedRecipes.map((recipe) => recipe.id)

        let loadedRecipeIngredients: RecipeIngredient[] = []
        let loadedIngredients: Ingredient[] = []

        if (recipeIds.length > 0) {
          const { data: recipeIngredientsData, error: recipeIngredientsError } =
            await supabase
              .from('recipe_ingredients')
              .select('recipe_id, ingredient_id, quantity, unit')
              .in('recipe_id', recipeIds)

          if (recipeIngredientsError) throw recipeIngredientsError

          loadedRecipeIngredients = (recipeIngredientsData ?? []) as RecipeIngredient[]

          const ingredientIds = Array.from(
            new Set(
              loadedRecipeIngredients
                .map((item) => item.ingredient_id)
                .filter((ingredientId) => ingredientId.length > 0)
            )
          )

          if (ingredientIds.length > 0) {
            const { data: ingredientsData, error: ingredientsError } = await supabase
              .from('ingredients')
              .select('id, user_id, name, usage_unit, cost_per_unit')
              .eq('user_id', user.id)
              .in('id', ingredientIds)
              .order('name', { ascending: true })

            if (ingredientsError) throw ingredientsError

            loadedIngredients = (ingredientsData ?? []) as Ingredient[]
          }
        }

        if (isMounted) {
          setRecipes(loadedRecipes)
          setRecipeIngredients(loadedRecipeIngredients)
          setIngredients(loadedIngredients)
          setProductionAmounts(
            loadedRecipes.reduce<Record<string, string>>((amounts, recipe) => {
              amounts[recipe.id] = getDefaultProductionAmount(recipe)
              return amounts
            }, {})
          )
        }
      } catch (err) {
        console.error('Erro ao carregar dados da lista de compras:', err)
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Falha ao carregar dados'
          setError(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadShoppingData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const selectedRecipes = useMemo(() => {
    return recipes.filter((recipe) => selectedRecipeIds.has(recipe.id))
  }, [recipes, selectedRecipeIds])

  const recipeIngredientsByRecipeId = useMemo(() => {
    return recipeIngredients.reduce<Map<string, RecipeIngredient[]>>((groups, item) => {
      const currentItems = groups.get(item.recipe_id) ?? []
      currentItems.push(item)
      groups.set(item.recipe_id, currentItems)

      return groups
    }, new Map())
  }, [recipeIngredients])

  const ingredientById = useMemo(() => {
    return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  }, [ingredients])

  const shoppingList = useMemo(() => {
    const groupedItems = new Map<string, ShoppingListItem>()

    selectedRecipes.forEach((recipe) => {
      const yieldAmount = parseNumber(recipe.yield_amount)
      const desiredAmount = parseNumber(productionAmounts[recipe.id])

      if (yieldAmount <= 0 || desiredAmount <= 0) return

      const factor = desiredAmount / yieldAmount
      const recipeItems = recipeIngredientsByRecipeId.get(recipe.id) ?? []

      recipeItems.forEach((recipeItem) => {
        const ingredient = ingredientById.get(recipeItem.ingredient_id)
        const unit = recipeItem.unit?.trim() || ingredient?.usage_unit || 'unidade'
        const neededQuantity = parseNumber(recipeItem.quantity) * factor
        const estimatedCost = calculateIngredientCost(neededQuantity, unit, ingredient)
        const name = ingredient?.name || 'Ingrediente não encontrado'
        const currentItem = groupedItems.get(recipeItem.ingredient_id)

        if (!currentItem) {
          groupedItems.set(recipeItem.ingredient_id, {
            ingredientId: recipeItem.ingredient_id,
            name,
            quantity: neededQuantity,
            unit,
            estimatedCost,
            hasMixedUnits: false,
          })
          return
        }

        if (normalizeUnit(currentItem.unit) === normalizeUnit(unit)) {
          currentItem.quantity += neededQuantity
        } else if (canConvertUnits(unit, currentItem.unit)) {
          currentItem.quantity += convertQuantity(neededQuantity, unit, currentItem.unit) ?? 0
        } else {
          currentItem.quantity += neededQuantity
          currentItem.hasMixedUnits = true
        }

        currentItem.estimatedCost = addCost(currentItem.estimatedCost, estimatedCost)
      })
    })

    return Array.from(groupedItems.values()).sort((firstItem, secondItem) =>
      firstItem.name.localeCompare(secondItem.name, 'pt-BR')
    )
  }, [
    ingredientById,
    productionAmounts,
    recipeIngredientsByRecipeId,
    selectedRecipes,
  ])

  const totalEstimatedCost = useMemo(() => {
    return shoppingList.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0)
  }, [shoppingList])

  const hasUnavailableCosts = shoppingList.some((item) => item.estimatedCost === null)
  const hasSelectedRecipes = selectedRecipeIds.size > 0
  const canCopyList = hasGeneratedList && shoppingList.length > 0

  function toggleRecipe(recipe: Recipe) {
    setCopyFeedback('')
    setSelectedRecipeIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(recipe.id)) {
        nextIds.delete(recipe.id)
      } else {
        nextIds.add(recipe.id)
      }

      return nextIds
    })
  }

  function handleProductionAmountChange(
    event: ChangeEvent<HTMLInputElement>,
    recipeId: string
  ) {
    setCopyFeedback('')
    setProductionAmounts((currentAmounts) => ({
      ...currentAmounts,
      [recipeId]: event.target.value,
    }))
  }

  function validateSelection() {
    if (selectedRecipeIds.size === 0) {
      return 'Selecione pelo menos uma receita para gerar a lista.'
    }

    const invalidRecipe = selectedRecipes.find((recipe) => {
      const yieldAmount = parseNumber(recipe.yield_amount)
      const desiredAmount = parseNumber(productionAmounts[recipe.id])

      return yieldAmount <= 0 || desiredAmount <= 0
    })

    if (invalidRecipe) {
      return 'Receitas selecionadas precisam ter rendimento original e quantidade a produzir maiores que zero.'
    }

    return ''
  }

  function handleGenerateList() {
    const validationError = validateSelection()

    if (validationError) {
      setError(validationError)
      setHasGeneratedList(false)
      return
    }

    setError('')
    setCopyFeedback('')
    setHasGeneratedList(true)
  }

  function handleClearSelection() {
    setSelectedRecipeIds(new Set())
    setHasGeneratedList(false)
    setCopyFeedback('')
    setError('')
    setProductionAmounts(
      recipes.reduce<Record<string, string>>((amounts, recipe) => {
        amounts[recipe.id] = getDefaultProductionAmount(recipe)
        return amounts
      }, {})
    )
  }

  async function handleCopyList() {
    if (!canCopyList) return

    const listText = [
      'Lista de compras - Doceria Pro',
      ...shoppingList.map((item) => {
        const costText =
          item.estimatedCost === null
            ? 'custo estimado indisponível'
            : `custo estimado ${formatCurrency(item.estimatedCost)}`

        return `${item.name} - ${formatNumber(item.quantity)} ${item.unit} - ${costText}`
      }),
      `Total estimado${hasUnavailableCosts ? ' parcial' : ''}: ${formatCurrency(
        totalEstimatedCost
      )}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(listText)
      setCopyFeedback('Lista copiada')
    } catch (err) {
      console.error('Erro ao copiar lista de compras:', err)
      setCopyFeedback('')
      setError('Não foi possível copiar a lista.')
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
            PRODUÇÃO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A0A08]">
            Lista de compras
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6F625F]">
            Selecione receitas e quantidades para gerar automaticamente sua lista de compras.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando receitas...</p>
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <PackageSearch className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">Nenhuma receita cadastrada</p>
            <p className="mt-1 text-sm text-[#999999]">
              Cadastre receitas com ingredientes para gerar sua lista de compras.
            </p>
            <Link
              href="/receitas/nova"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
            >
              Nova receita
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Receitas</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Ajuste a quantidade desejada antes de gerar a lista.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={!hasSelectedRecipes}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-4 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCcw size={17} aria-hidden="true" />
                    <span>Limpar seleção</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateList}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
                  >
                    <Sparkles size={18} aria-hidden="true" />
                    <span>Gerar lista</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {recipes.map((recipe) => {
                  const isSelected = selectedRecipeIds.has(recipe.id)

                  return (
                    <article
                      key={recipe.id}
                      className={`rounded-[16px] border p-4 transition-colors ${
                        isSelected
                          ? 'border-[#C0392B] bg-[#FFF8F5]'
                          : 'border-[rgba(26,10,8,0.07)] bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <input
                            id={`recipe-${recipe.id}`}
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRecipe(recipe)}
                            className="mt-1 h-5 w-5 shrink-0 rounded border-[rgba(26,10,8,0.18)] accent-[#C0392B]"
                          />
                          <div className="min-w-0">
                            <label
                              htmlFor={`recipe-${recipe.id}`}
                              className="block cursor-pointer text-base font-bold text-[#1A0A08]"
                            >
                              {recipe.name}
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#1A0A08]">
                                {recipe.category || 'Sem categoria'}
                              </span>
                              <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#999999]">
                                Rende {getYieldLabel(recipe)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="w-full md:w-48">
                          <label
                            className="mb-2 block text-xs font-semibold text-[#1A0A08]"
                            htmlFor={`production-${recipe.id}`}
                          >
                            Quantidade a produzir
                          </label>
                          <input
                            id={`production-${recipe.id}`}
                            type="number"
                            min="0"
                            step="0.001"
                            inputMode="decimal"
                            value={productionAmounts[recipe.id] ?? ''}
                            onChange={(event) =>
                              handleProductionAmountChange(event, recipe.id)
                            }
                            disabled={!isSelected}
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B] disabled:cursor-not-allowed disabled:bg-[#FAF6F0] disabled:text-[#999999]"
                          />
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Lista gerada</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Itens agrupados por ingrediente cadastrado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyList}
                  disabled={!canCopyList}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-4 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copyFeedback ? (
                    <ClipboardCheck size={17} aria-hidden="true" />
                  ) : (
                    <Clipboard size={17} aria-hidden="true" />
                  )}
                  <span>{copyFeedback || 'Copiar lista'}</span>
                </button>
              </div>

              {!hasSelectedRecipes ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <ShoppingCart className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]" aria-hidden="true" />
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Nenhuma receita selecionada
                  </p>
                  <p className="mt-1 text-sm text-[#999999]">
                    Escolha uma ou mais receitas para montar sua compra.
                  </p>
                </div>
              ) : !hasGeneratedList ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <Sparkles className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]" aria-hidden="true" />
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Pronta para calcular
                  </p>
                  <p className="mt-1 text-sm text-[#999999]">
                    Clique em Gerar lista para consolidar os ingredientes.
                  </p>
                </div>
              ) : shoppingList.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <PackageSearch className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]" aria-hidden="true" />
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Nenhum ingrediente encontrado
                  </p>
                  <p className="mt-1 text-sm text-[#999999]">
                    As receitas selecionadas ainda não possuem ingredientes vinculados.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {shoppingList.map((item) => (
                      <div
                        key={item.ingredientId}
                        className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-base font-bold text-[#1A0A08]">
                              {item.name}
                            </p>
                            <p className="mt-1 text-sm text-[#999999]">
                              {formatNumber(item.quantity)} {item.unit}
                            </p>
                            {item.hasMixedUnits && (
                              <p className="mt-2 text-xs font-semibold text-[#C0392B]">
                                Há unidades diferentes para este ingrediente.
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 rounded-lg bg-white px-3 py-2 sm:text-right">
                            <p className="text-xs font-medium text-[#999999]">
                              Custo estimado
                            </p>
                            <p className="mt-1 font-bold text-[#1A0A08]">
                              {formatCurrency(item.estimatedCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[16px] bg-[#1A0A08] p-4 text-white">
                    <p className="text-sm font-medium text-[#E8D9D4]">
                      {hasUnavailableCosts ? 'Total estimado parcial' : 'Total estimado da compra'}
                    </p>
                    <p className="mt-1 text-3xl font-bold">
                      {formatCurrency(totalEstimatedCost)}
                    </p>
                    {hasUnavailableCosts && (
                      <p className="mt-2 text-sm text-[#E8D9D4]">
                        Alguns itens não têm custo por unidade cadastrado.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
