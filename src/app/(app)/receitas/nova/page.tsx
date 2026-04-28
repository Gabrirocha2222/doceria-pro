'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Package,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ProductType = 'simples' | 'kit'
type ThirdPartyChoice = 'nao' | 'sim'

type RecipeForm = {
  name: string
  category: string
  product_type: ProductType
  is_third_party: ThirdPartyChoice
  supplier_id: string
  yield_amount: string
  yield_unit: string
  profit_margin: string
  sale_price: string
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

type NumericValue = number | string | null | undefined

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type RecipePackagingItem = {
  localId: string
  packaging_id: string
  usage_type: 'unitaria' | 'transporte'
  quantity_per_recipe_unit: string
  notes: string
}

type Packaging = {
  id: string
  name: string
  cost_per_unit: NumericValue
  capacity: NumericValue
  capacity_unit: string | null
}

type Supplier = {
  id: string
  name: string
}

type KitProduct = {
  id: string
  name: string
  total_cost: NumericValue
  product_type: ProductType | null
}

type RecipeKitItem = {
  localId: string
  item_recipe_id: string
  quantity: string
  notes: string
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
  product_type: 'simples',
  is_third_party: 'nao',
  supplier_id: '',
  yield_amount: '',
  yield_unit: 'unidades',
  profit_margin: '30',
  sale_price: '',
  instructions: '',
  notes: '',
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNumericValue(value: NumericValue) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    return parseDecimal(value)
  }

  return 0
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue || null
}

function optionalDecimal(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) return null

  const parsed = Number(trimmedValue.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
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

function formatCurrency(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseNumericValue(value))
}

function formatNumber(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(parseNumericValue(value))
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
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

function calculatePackagingItemCost(
  item: RecipePackagingItem,
  packaging: Packaging | undefined,
  recipeYield: number
) {
  if (!packaging || recipeYield <= 0) return 0

  const costPerUnit = parseNumericValue(packaging.cost_per_unit)
  if (costPerUnit <= 0) return 0

  if (item.usage_type === 'transporte') {
    const capacity = parseNumericValue(packaging.capacity)
    const safeCapacity = capacity > 0 ? capacity : 1

    return Math.ceil(recipeYield / safeCapacity) * costPerUnit
  }

  const quantityPerRecipeUnit = parseDecimal(item.quantity_per_recipe_unit)

  if (quantityPerRecipeUnit <= 0) return 0

  return quantityPerRecipeUnit * costPerUnit * recipeYield
}

function calculateKitItemCost(item: RecipeKitItem, product: KitProduct | undefined) {
  if (!product) return 0

  const quantity = parseDecimal(item.quantity)
  const itemCost = parseNumericValue(product.total_cost)

  if (quantity <= 0 || itemCost <= 0) return 0

  return quantity * itemCost
}

export default function NovaReceitaPage() {
  const [form, setForm] = useState<RecipeForm>(initialForm)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientItem[]>([])
  const [availablePackaging, setAvailablePackaging] = useState<Packaging[]>([])
  const [recipePackaging, setRecipePackaging] = useState<RecipePackagingItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [availableKitProducts, setAvailableKitProducts] = useState<KitProduct[]>([])
  const [recipeKitItems, setRecipeKitItems] = useState<RecipeKitItem[]>([])
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

        if (ingredientsError) {
          logSupabaseError('Erro Supabase ingredients:', ingredientsError)
          throw ingredientsError
        }

        const { data: packagingData, error: packagingError } = await supabase
          .from('packaging')
          .select('id, name, cost_per_unit, capacity, capacity_unit')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (packagingError) {
          logSupabaseError('Erro Supabase packaging:', packagingError)
          throw packagingError
        }

        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (suppliersError) {
          logSupabaseError('Erro Supabase suppliers:', suppliersError)
          throw suppliersError
        }

        const { data: kitProductsData, error: kitProductsError } = await supabase
          .from('recipes')
          .select('id, name, total_cost, product_type')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (kitProductsError) {
          logSupabaseError('Erro Supabase recipes para kit:', kitProductsError)
          throw kitProductsError
        }

        if (isMounted) {
          setIngredients((data ?? []) as Ingredient[])
          setAvailablePackaging((packagingData ?? []) as Packaging[])
          setSuppliers((suppliersData ?? []) as Supplier[])
          setAvailableKitProducts((kitProductsData ?? []) as KitProduct[])
        }
      } catch (err) {
        console.error('Erro ao carregar ingredientes:', err)
        if (isMounted) {
          setError('Falha ao carregar dados da receita')
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

  const packagingById = useMemo(() => {
    return new Map(availablePackaging.map((packaging) => [packaging.id, packaging]))
  }, [availablePackaging])

  const kitProductById = useMemo(() => {
    return new Map(availableKitProducts.map((product) => [product.id, product]))
  }, [availableKitProducts])

  const isKit = form.product_type === 'kit'
  const isThirdParty = form.is_third_party === 'sim'
  const yieldAmount = useMemo(() => parseDecimal(form.yield_amount), [form.yield_amount])
  const profitMargin = useMemo(() => parseDecimal(form.profit_margin), [form.profit_margin])
  const salePrice = useMemo(() => optionalDecimal(form.sale_price), [form.sale_price])

  const ingredientCosts = useMemo(() => {
    return new Map(
      recipeIngredients.map((item) => [
        item.localId,
        calculateIngredientCost(item, ingredientById.get(item.ingredient_id)),
      ])
    )
  }, [ingredientById, recipeIngredients])

  const ingredientTotalCost = useMemo(() => {
    return Array.from(ingredientCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [ingredientCosts])

  const packagingCosts = useMemo(() => {
    return new Map(
      recipePackaging.map((item) => [
        item.localId,
        calculatePackagingItemCost(item, packagingById.get(item.packaging_id), yieldAmount),
      ])
    )
  }, [packagingById, recipePackaging, yieldAmount])

  const packagingTotalCost = useMemo(() => {
    return Array.from(packagingCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [packagingCosts])

  const kitItemCosts = useMemo(() => {
    return new Map(
      recipeKitItems.map((item) => [
        item.localId,
        calculateKitItemCost(item, kitProductById.get(item.item_recipe_id)),
      ])
    )
  }, [kitProductById, recipeKitItems])

  const kitTotalCost = useMemo(() => {
    return Array.from(kitItemCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [kitItemCosts])

  const simpleTotalCost = ingredientTotalCost + packagingTotalCost
  const totalCost = isKit ? kitTotalCost : simpleTotalCost
  const costPerUnit = yieldAmount > 0 ? totalCost / yieldAmount : 0
  const suggestedPrice = calculateSuggestedPrice(totalCost, profitMargin)

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as keyof RecipeForm
    const value = event.target.value

    if (field === 'product_type') {
      const productType: ProductType = value === 'kit' ? 'kit' : 'simples'

      setForm((currentForm) => ({
        ...currentForm,
        product_type: productType,
        yield_amount:
          productType === 'kit' && !currentForm.yield_amount ? '1' : currentForm.yield_amount,
        yield_unit: productType === 'kit' && !currentForm.yield_unit ? 'kit' : currentForm.yield_unit,
      }))

      return
    }

    if (field === 'is_third_party') {
      const thirdPartyChoice: ThirdPartyChoice = value === 'sim' ? 'sim' : 'nao'

      setForm((currentForm) => ({
        ...currentForm,
        is_third_party: thirdPartyChoice,
        supplier_id: thirdPartyChoice === 'sim' ? currentForm.supplier_id : '',
      }))

      return
    }

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
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

  function addRecipePackaging() {
    const firstPackaging = availablePackaging[0]

    if (!firstPackaging) {
      setError('Cadastre embalagens antes de vincular ao produto')
      return
    }

    setRecipePackaging((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        packaging_id: firstPackaging.id,
        usage_type: 'unitaria',
        quantity_per_recipe_unit: '1',
        notes: '',
      },
    ])
  }

  function updateRecipePackaging(
    localId: string,
    field: 'packaging_id' | 'usage_type' | 'quantity_per_recipe_unit' | 'notes',
    value: string
  ) {
    setRecipePackaging((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        if (field === 'usage_type') {
          const usageType = value === 'transporte' ? 'transporte' : 'unitaria'

          return {
            ...item,
            usage_type: usageType,
            quantity_per_recipe_unit:
              usageType === 'unitaria' && !item.quantity_per_recipe_unit
                ? '1'
                : item.quantity_per_recipe_unit,
          }
        }

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeRecipePackaging(localId: string) {
    setRecipePackaging((currentItems) =>
      currentItems.filter((item) => item.localId !== localId)
    )
  }

  function addKitItem() {
    const firstProduct = availableKitProducts[0]

    if (!firstProduct) {
      setError('Cadastre produtos antes de montar um kit')
      return
    }

    setRecipeKitItems((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        item_recipe_id: firstProduct.id,
        quantity: '1',
        notes: '',
      },
    ])
  }

  function updateKitItem(
    localId: string,
    field: 'item_recipe_id' | 'quantity' | 'notes',
    value: string
  ) {
    setRecipeKitItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeKitItem(localId: string) {
    setRecipeKitItems((currentItems) => currentItems.filter((item) => item.localId !== localId))
  }

  function validateForm() {
    if (!form.name.trim()) return 'Nome da receita é obrigatório'
    if (yieldAmount <= 0) return 'Rendimento deve ser maior que zero'
    if (!form.yield_unit.trim()) return 'Unidade de rendimento é obrigatória'
    if (profitMargin < 0 || profitMargin >= 100) {
      return 'Margem de lucro deve ficar entre 0% e 99,99%'
    }
    if (form.sale_price.trim() && (salePrice === null || salePrice < 0)) {
      return 'Preço que eu cobro deve ser um valor válido'
    }
    if (
      isThirdParty &&
      form.supplier_id &&
      !suppliers.some((supplier) => supplier.id === form.supplier_id)
    ) {
      return 'Selecione um fornecedor valido'
    }

    if (isKit) {
      if (recipeKitItems.length === 0) return 'Adicione pelo menos um item ao kit'

      const invalidKitItem = recipeKitItems.some(
        (item) => !item.item_recipe_id || parseDecimal(item.quantity) <= 0
      )

      if (invalidKitItem) {
        return 'Confira produto e quantidade de todos os itens do kit'
      }

      return ''
    }

    if (recipeIngredients.length === 0) return 'Adicione pelo menos um ingrediente'

    const invalidIngredient = recipeIngredients.some(
      (item) => !item.ingredient_id || parseDecimal(item.quantity) <= 0 || !item.unit.trim()
    )

    if (invalidIngredient) {
      return 'Confira ingrediente, quantidade e unidade de todos os itens'
    }

    const invalidPackaging = recipePackaging.some((item) => {
      if (!item.packaging_id) return true

      return item.usage_type === 'unitaria' && parseDecimal(item.quantity_per_recipe_unit) <= 0
    })

    if (invalidPackaging) {
      return 'Confira embalagem, tipo de uso e quantidade dos itens unitários'
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
            product_type: form.product_type,
            is_third_party: isThirdParty,
            supplier_id: isThirdParty ? optionalText(form.supplier_id) : null,
            yield_amount: yieldAmount,
            yield_unit: form.yield_unit.trim(),
            total_cost: totalCost,
            cost_per_unit: costPerUnit,
            profit_margin: profitMargin,
            suggested_price: suggestedPrice,
            sale_price: salePrice,
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

      if (isKit) {
        const kitItemsPayload = recipeKitItems.map((item) => ({
          user_id: user.id,
          kit_recipe_id: createdRecipe.id,
          item_recipe_id: item.item_recipe_id,
          quantity: parseDecimal(item.quantity),
          notes: optionalText(item.notes),
        }))

        const { error: kitItemsError } = await supabase
          .from('product_kit_items')
          .insert(kitItemsPayload)

        if (kitItemsError) {
          logSupabaseError('Erro Supabase product_kit_items:', kitItemsError)
          throw kitItemsError
        }
      } else {
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

        if (recipePackaging.length > 0) {
          const recipePackagingPayload = recipePackaging.map((item) => ({
            user_id: user.id,
            recipe_id: createdRecipe.id,
            packaging_id: item.packaging_id,
            usage_type: item.usage_type,
            quantity_per_recipe_unit:
              item.usage_type === 'unitaria'
                ? parseDecimal(item.quantity_per_recipe_unit)
                : null,
            notes: optionalText(item.notes),
          }))

          const { error: recipePackagingError } = await supabase
            .from('recipe_packaging')
            .insert(recipePackagingPayload)

          if (recipePackagingError) {
            logSupabaseError('Erro Supabase recipe_packaging:', recipePackagingError)
            throw recipePackagingError
          }
        }
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

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="product_type"
                >
                  Tipo de produto
                </label>
                <select
                  id="product_type"
                  name="product_type"
                  value={form.product_type}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  <option value="simples">Produto simples</option>
                  <option value="kit">Kit</option>
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="is_third_party"
                >
                  Produto terceirizado?
                </label>
                <select
                  id="is_third_party"
                  name="is_third_party"
                  value={form.is_third_party}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  <option value="nao">Nao</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              {isThirdParty && (
                <div className="md:col-span-2">
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="supplier_id"
                  >
                    Fornecedor
                  </label>
                  {suppliers.length === 0 ? (
                    <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                      Nenhum fornecedor cadastrado.{' '}
                      <Link href="/fornecedores/novo" className="font-semibold text-[#C0392B]">
                        Cadastre um fornecedor primeiro.
                      </Link>
                    </div>
                  ) : (
                    <select
                      id="supplier_id"
                      name="supplier_id"
                      value={form.supplier_id}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                    >
                      <option value="">Sem fornecedor definido</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

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

          {isKit && (
            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Composicao do kit</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Selecione produtos ja cadastrados e informe a quantidade de cada item.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addKitItem}
                  disabled={isLoadingIngredients || availableKitProducts.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={18} aria-hidden="true" />
                  <span>Adicionar item</span>
                </button>
              </div>

              {isLoadingIngredients ? (
                <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                  Carregando produtos...
                </div>
              ) : availableKitProducts.length === 0 ? (
                <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                  Nenhum produto cadastrado ainda. Cadastre produtos simples antes de montar um kit.
                </div>
              ) : recipeKitItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                  Adicione o primeiro produto para calcular o custo do kit.
                </div>
              ) : (
                <div className="space-y-3">
                  {recipeKitItems.map((item, index) => {
                    const selectedProduct = kitProductById.get(item.item_recipe_id)
                    const itemCost = kitItemCosts.get(item.localId) ?? 0

                    return (
                      <div
                        key={item.localId}
                        className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-[#1A0A08]">Item {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeKitItem(item.localId)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                            aria-label="Remover item do kit"
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.5fr)_120px_150px] md:items-end">
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                              Produto
                            </label>
                            <select
                              value={item.item_recipe_id}
                              onChange={(event) =>
                                updateKitItem(item.localId, 'item_recipe_id', event.target.value)
                              }
                              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                            >
                              {availableKitProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
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
                              step="0.01"
                              inputMode="decimal"
                              value={item.quantity}
                              onChange={(event) =>
                                updateKitItem(item.localId, 'quantity', event.target.value)
                              }
                              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                            />
                          </div>

                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs font-medium text-[#999999]">Custo estimado</p>
                            <p className="mt-1 font-bold text-[#1A0A08]">
                              {formatCurrency(itemCost)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                              Observacoes
                            </label>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(event) =>
                                updateKitItem(item.localId, 'notes', event.target.value)
                              }
                              placeholder="Ex: cliente escolhe os sabores no pedido"
                              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                            />
                          </div>

                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs font-medium text-[#999999]">Custo do produto</p>
                            <p className="mt-1 font-bold text-[#1A0A08]">
                              {formatCurrency(selectedProduct?.total_cost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {!isKit && (
            <>
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
            </>
          )}

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C9A84C]">
                  <Package size={22} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Embalagens do produto</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Vincule forminhas, caixas, bandejas ou itens de transporte usados na receita.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addRecipePackaging}
                disabled={isLoadingIngredients || availablePackaging.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Adicionar embalagem</span>
              </button>
            </div>

            {isLoadingIngredients ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Carregando embalagens...
              </div>
            ) : availablePackaging.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                Nenhuma embalagem cadastrada.{' '}
                <Link href="/embalagens/nova" className="font-semibold text-[#C0392B]">
                  Cadastre embalagens primeiro.
                </Link>
              </div>
            ) : recipePackaging.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                Adicione embalagens para incluir esse custo na precificacao.
              </div>
            ) : (
              <div className="space-y-3">
                {recipePackaging.map((item, index) => {
                  const selectedPackaging = packagingById.get(item.packaging_id)
                  const itemCost = packagingCosts.get(item.localId) ?? 0
                  const capacity = parseNumericValue(selectedPackaging?.capacity)

                  return (
                    <div
                      key={item.localId}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#1A0A08]">
                          Embalagem {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeRecipePackaging(item.localId)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                          aria-label="Remover embalagem"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_150px_150px_140px] md:items-end">
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Embalagem
                          </label>
                          <select
                            value={item.packaging_id}
                            onChange={(event) =>
                              updateRecipePackaging(
                                item.localId,
                                'packaging_id',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            {availablePackaging.map((packaging) => (
                              <option key={packaging.id} value={packaging.id}>
                                {packaging.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Tipo de uso
                          </label>
                          <select
                            value={item.usage_type}
                            onChange={(event) =>
                              updateRecipePackaging(
                                item.localId,
                                'usage_type',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            <option value="unitaria">Unitaria</option>
                            <option value="transporte">Transporte</option>
                          </select>
                        </div>

                        {item.usage_type === 'unitaria' ? (
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                              Qtd. por unidade
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              inputMode="decimal"
                              value={item.quantity_per_recipe_unit}
                              onChange={(event) =>
                                updateRecipePackaging(
                                  item.localId,
                                  'quantity_per_recipe_unit',
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                            />
                          </div>
                        ) : (
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs font-medium text-[#999999]">Capacidade</p>
                            <p className="mt-1 font-bold text-[#1A0A08]">
                              {capacity > 0
                                ? `${formatNumber(capacity)} ${
                                    selectedPackaging?.capacity_unit || 'unidades'
                                  }`
                                : 'Usando 1'}
                            </p>
                          </div>
                        )}

                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-medium text-[#999999]">Custo estimado</p>
                          <p className="mt-1 font-bold text-[#1A0A08]">
                            {formatCurrency(itemCost)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                          Observacoes
                        </label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(event) =>
                            updateRecipePackaging(item.localId, 'notes', event.target.value)
                          }
                          placeholder="Ex: caixa apenas para entregas acima de 48 unidades"
                          className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                        />
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
              {isKit ? (
                <div className="rounded-lg bg-[#FAF6F0] p-4">
                  <p className="text-xs font-medium text-[#999999]">Custo dos itens do kit</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(kitTotalCost)}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-[#FAF6F0] p-4">
                    <p className="text-xs font-medium text-[#999999]">Custo dos ingredientes</p>
                    <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                      {formatCurrency(ingredientTotalCost)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#FAF6F0] p-4">
                    <p className="text-xs font-medium text-[#999999]">Custo das embalagens</p>
                    <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                      {formatCurrency(packagingTotalCost)}
                    </p>
                  </div>
                </>
              )}

              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs font-medium text-[#999999]">Custo total</p>
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
                <p className="text-xs font-medium text-[#999999]">Custo por unidade</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(costPerUnit)}
                </p>
              </div>

              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs font-medium text-[#999999]">Preço sugerido</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(suggestedPrice)}
                </p>
              </div>

              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="sale_price"
                >
                  Preço que eu cobro
                </label>
                <input
                  id="sale_price"
                  name="sale_price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.sale_price}
                  onChange={handleFormChange}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
                <p className="mt-2 text-sm text-[#999999]">
                  Se vazio, o app usará o preço sugerido nos pedidos.
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
