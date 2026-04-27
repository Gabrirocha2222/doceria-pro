'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type RecipeForm = {
  name: string
  category: string
  yield_amount: string
  yield_unit: string
  profit_margin: string
  instructions: string
  notes: string
}

type Ingredient = {
  id: string
  name: string
  usage_unit: string | null
  cost_per_unit: number | null
}

type RecipeIngredientItem = {
  localId: string
  ingredient_id: string
  quantity: string
  unit: string
}

type UnitDefinition = {
  kind: 'weight' | 'volume' | 'count'
  factor: number
}

const categoryOptions = [
  'Bolos',
  'Tortas',
  'Docinhos',
  'Salgados',
  'Bebidas',
  'Sobremesas',
  'Outros',
]

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

const initialForm: RecipeForm = {
  name: '',
  category: 'Bolos',
  yield_amount: '',
  yield_unit: 'unidades',
  profit_margin: '30',
  instructions: '',
  notes: '',
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue || null
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function calculateIngredientCost(item: RecipeIngredientItem, ingredient?: Ingredient) {
  if (!ingredient) return 0

  const quantity = parseDecimal(item.quantity)
  const costPerUnit = ingredient.cost_per_unit ?? 0
  const recipeUnit = item.unit.trim() || ingredient.usage_unit || ''
  const ingredientUnit = ingredient.usage_unit || recipeUnit

  if (quantity <= 0 || costPerUnit <= 0) return 0

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

function calculateSuggestedPrice(totalCost: number, profitMargin: number) {
  if (totalCost <= 0) return 0
  if (profitMargin >= 100) return 0

  return totalCost / (1 - profitMargin / 100)
}

export default function NovaReceitaPage() {
  const [form, setForm] = useState<RecipeForm>(initialForm)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientItem[]>([])
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadIngredients() {
      setIsLoadingIngredients(true)
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
          .select('id, name, usage_unit, cost_per_unit')
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
          setIsLoadingIngredients(false)
        }
      }
    }

    loadIngredients()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const ingredientById = useMemo(() => {
    return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  }, [ingredients])

  const yieldAmount = useMemo(() => parseDecimal(form.yield_amount), [form.yield_amount])
  const profitMargin = useMemo(() => parseDecimal(form.profit_margin), [form.profit_margin])

  const ingredientCosts = useMemo(() => {
    return new Map(
      recipeIngredients.map((item) => [
        item.localId,
        calculateIngredientCost(item, ingredientById.get(item.ingredient_id)),
      ])
    )
  }, [ingredientById, recipeIngredients])

  const totalCost = useMemo(() => {
    return Array.from(ingredientCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [ingredientCosts])

  const costPerUnit = yieldAmount > 0 ? totalCost / yieldAmount : 0
  const suggestedPrice = calculateSuggestedPrice(totalCost, profitMargin)

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as keyof RecipeForm

    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  function addRecipeIngredient() {
    const firstIngredient = ingredients[0]

    if (!firstIngredient) {
      setError('Cadastre ingredientes antes de montar uma receita')
      return
    }

    setRecipeIngredients((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        ingredient_id: firstIngredient.id,
        quantity: '1',
        unit: firstIngredient.usage_unit || 'unidade',
      },
    ])
  }

  function updateRecipeIngredient(
    localId: string,
    field: 'ingredient_id' | 'quantity' | 'unit',
    value: string
  ) {
    setRecipeIngredients((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        if (field === 'ingredient_id') {
          const ingredient = ingredientById.get(value)

          return {
            ...item,
            ingredient_id: value,
            unit: ingredient?.usage_unit || item.unit,
          }
        }

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeRecipeIngredient(localId: string) {
    setRecipeIngredients((currentItems) =>
      currentItems.filter((item) => item.localId !== localId)
    )
  }

  function validateForm() {
    if (!form.name.trim()) return 'Nome da receita é obrigatório'
    if (yieldAmount <= 0) return 'Rendimento deve ser maior que zero'
    if (!form.yield_unit.trim()) return 'Unidade de rendimento é obrigatória'
    if (profitMargin < 0 || profitMargin >= 100) {
      return 'Margem de lucro deve ficar entre 0% e 99,99%'
    }
    if (recipeIngredients.length === 0) return 'Adicione pelo menos um ingrediente'

    const invalidIngredient = recipeIngredients.some(
      (item) => !item.ingredient_id || parseDecimal(item.quantity) <= 0 || !item.unit.trim()
    )

    if (invalidIngredient) {
      return 'Confira ingrediente, quantidade e unidade de todos os itens'
    }

    return ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const { data: createdRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert([
          {
            user_id: user.id,
            name: form.name.trim(),
            category: form.category,
            yield_amount: yieldAmount,
            yield_unit: form.yield_unit.trim(),
            total_cost: totalCost,
            cost_per_unit: costPerUnit,
            profit_margin: profitMargin,
            suggested_price: suggestedPrice,
            instructions: optionalText(form.instructions),
            notes: optionalText(form.notes),
          },
        ])
        .select('id')
        .single()

      if (recipeError) {
        console.error('Erro Supabase recipes:', JSON.stringify(recipeError, null, 2))
        throw recipeError
      }

      if (!createdRecipe?.id) {
        throw new Error('Receita criada sem id retornado pelo Supabase')
      }

      const recipeIngredientsPayload = recipeIngredients.map((item) => ({
        recipe_id: createdRecipe.id,
        ingredient_id: item.ingredient_id,
        quantity: parseDecimal(item.quantity),
        unit: item.unit.trim(),
      }))

      const { error: recipeIngredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(recipeIngredientsPayload)

      if (recipeIngredientsError) {
        console.error(
          'Erro Supabase recipe_ingredients:',
          JSON.stringify(recipeIngredientsError, null, 2)
        )
        throw recipeIngredientsError
      }

      router.push('/receitas')
    } catch (err) {
      console.error('Erro ao salvar receita:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar receita'
      setError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              CARDÁPIO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Nova receita</h1>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados da receita</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="name">
                  Nome *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Ex: Brigadeiro gourmet"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="category">
                  Categoria
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(110px,0.8fr)] gap-3">
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="yield_amount"
                  >
                    Rendimento
                  </label>
                  <input
                    id="yield_amount"
                    name="yield_amount"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    value={form.yield_amount}
                    onChange={handleFormChange}
                    placeholder="12"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="yield_unit"
                  >
                    Unidade
                  </label>
                  <input
                    id="yield_unit"
                    name="yield_unit"
                    type="text"
                    value={form.yield_unit}
                    onChange={handleFormChange}
                    placeholder="unidades"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="instructions"
                >
                  Instruções
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={form.instructions}
                  onChange={handleFormChange}
                  placeholder="Modo de preparo, tempos e detalhes importantes..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="notes">
                  Observações
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Variações, validade, embalagem recomendada..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1A0A08]">Ingredientes da receita</h2>
                <p className="mt-1 text-sm text-[#999999]">
                  Selecione os ingredientes cadastrados e informe a quantidade usada.
                </p>
              </div>

              <button
                type="button"
                onClick={addRecipeIngredient}
                disabled={isLoadingIngredients || ingredients.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Adicionar ingrediente</span>
              </button>
            </div>

            {isLoadingIngredients ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Carregando ingredientes...
              </div>
            ) : ingredients.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                Nenhum ingrediente cadastrado ainda.{' '}
                <Link href="/ingredientes/novo" className="font-semibold text-[#C0392B]">
                  Cadastre um ingrediente
                </Link>
                .
              </div>
            ) : recipeIngredients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                Adicione o primeiro ingrediente para calcular os custos.
              </div>
            ) : (
              <div className="space-y-3">
                {recipeIngredients.map((item, index) => {
                  const selectedIngredient = ingredientById.get(item.ingredient_id)
                  const itemCost = ingredientCosts.get(item.localId) ?? 0

                  return (
                    <div
                      key={item.localId}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#1A0A08]">
                          Ingrediente {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeRecipeIngredient(item.localId)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                          aria-label="Remover ingrediente"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_120px_120px_140px] md:items-end">
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Ingrediente
                          </label>
                          <select
                            value={item.ingredient_id}
                            onChange={(event) =>
                              updateRecipeIngredient(
                                item.localId,
                                'ingredient_id',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            {ingredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>
                                {ingredient.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(event) =>
                              updateRecipeIngredient(item.localId, 'quantity', event.target.value)
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Unidade
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(event) =>
                              updateRecipeIngredient(item.localId, 'unit', event.target.value)
                            }
                            placeholder={selectedIngredient?.usage_unit || 'unidade'}
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          />
                        </div>

                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-medium text-[#999999]">Custo</p>
                          <p className="mt-1 font-bold text-[#1A0A08]">
                            {formatCurrency(itemCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C9A84C]">
                <Calculator size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1A0A08]">Precificação</h2>
                <p className="text-sm text-[#999999]">Valores calculados automaticamente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs font-medium text-[#999999]">Custo total dos ingredientes</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(totalCost)}
                </p>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="profit_margin"
                >
                  Margem de lucro %
                </label>
                <input
                  id="profit_margin"
                  name="profit_margin"
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  inputMode="decimal"
                  value={form.profit_margin}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs font-medium text-[#999999]">Preço sugerido</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(suggestedPrice)}
                </p>
              </div>

              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs font-medium text-[#999999]">Custo por unidade</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(costPerUnit)}
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="min-h-11 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-5 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} aria-hidden="true" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar receita'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
