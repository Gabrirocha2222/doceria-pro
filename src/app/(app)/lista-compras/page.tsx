'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Check,
  Clipboard,
  ClipboardCheck,
  Eye,
  EyeOff,
  PackageCheck,
  PackageSearch,
  RefreshCcw,
  ReceiptText,
  Save,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, normalizeUnit } from '@/lib/format'

type NumericValue = number | string | null | undefined
type ProductType = 'simples' | 'kit'
type ShoppingMode = 'recipes' | 'selected_orders' | 'week' | 'month'
type PurchaseKind = 'ingredient' | 'packaging'
type PackagingUsageType = 'unitaria' | 'transporte'

type Recipe = {
  id: string
  user_id: string
  name: string
  category: string | null
  yield_amount: NumericValue
  yield_unit: string | null
  product_type: ProductType | null
  is_third_party: boolean | null
}

type RecipeIngredient = {
  recipe_id: string
  ingredient_id: string
  quantity: NumericValue
  unit: string | null
}

type Ingredient = {
  id: string
  user_id: string
  name: string
  category: string | null
  supplier_id: string | null
  usage_unit: string | null
  cost_per_unit: NumericValue
  stock_quantity: NumericValue
  stock_unit: string | null
}

type Supplier = {
  id: string
  user_id: string
  name: string
}

type RecipePackaging = {
  recipe_id: string
  packaging_id: string
  quantity_per_recipe_unit: NumericValue
  usage_type: PackagingUsageType
}

type Packaging = {
  id: string
  user_id: string
  name: string
  category: string | null
  unit: string | null
  cost_per_unit: NumericValue
  capacity: NumericValue
  capacity_unit: string | null
}

type CustomerSummary = {
  name: string | null
}

type OrderItem = {
  id: string
  order_id: string
  recipe_id: string | null
  parent_order_item_id: string | null
  item_name: string
  quantity: NumericValue
}

type Order = {
  id: string
  user_id: string
  delivery_date: string | null
  delivery_time: string | null
  status: string | null
  customers?: CustomerSummary | CustomerSummary[] | null
  order_items?: OrderItem[]
}

type UnitDefinition = {
  kind: 'weight' | 'volume' | 'count'
  factor: number
}

type AccumulatedPurchaseItem = {
  itemKey: string
  kind: PurchaseKind
  sourceId: string
  name: string
  category: string
  supplierName: string
  quantityNeeded: number
  unit: string
  costPerUnit: NumericValue
  costUnit: string
  stockQuantity: number
  stockUnit: string
  hasMixedUnits: boolean
  sources: Set<string>
}

type ShoppingListItem = {
  itemKey: string
  kind: PurchaseKind
  sourceId: string
  name: string
  category: string
  supplierName: string
  quantityNeeded: number
  stockQuantity: number
  quantityToBuy: number
  unit: string
  stockUnit: string
  costPerUnit: NumericValue
  costUnit: string
  estimatedCost: number | null
  hasMixedUnits: boolean
  sources: string[]
  isInStock: boolean
}

type ShoppingList = {
  ingredients: ShoppingListItem[]
  packaging: ShoppingListItem[]
  inStock: ShoppingListItem[]
}

type DateRange = {
  start: string
  end: string
}

type PurchaseItemRuntime = {
  realUnitPrice?: string
  purchasedQuantity?: string
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
  pacote: { kind: 'count', factor: 1 },
  pacotes: { kind: 'count', factor: 1 },
  pct: { kind: 'count', factor: 1 },
}

const shoppingModeOptions: { id: ShoppingMode; label: string }[] = [
  { id: 'recipes', label: 'Receitas' },
  { id: 'selected_orders', label: 'Pedidos selecionados' },
  { id: 'week', label: 'Pedidos da semana' },
  { id: 'month', label: 'Pedidos do mes' },
]

function parseNumber(value: NumericValue) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}
function getUnitDefinition(unit: string) {
  return unitDefinitions[normalizeUnit(unit)]
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  const fromDefinition = getUnitDefinition(fromUnit)
  const toDefinition = getUnitDefinition(toUnit)

  if (!fromDefinition || !toDefinition || fromDefinition.kind !== toDefinition.kind) {
    return null
  }

  return (quantity * fromDefinition.factor) / toDefinition.factor
}

function canConvertUnits(fromUnit: string, toUnit: string) {
  return convertQuantity(1, fromUnit, toUnit) !== null
}
function formatInputNumber(value: number) {
  if (!Number.isFinite(value)) return ''

  return String(Number(value.toFixed(3)))
}

function formatDate(date: string | null) {
  if (!date) return 'Sem data'

  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCurrentWeekRange(): DateRange {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)

  return {
    start: formatInputDate(start),
    end: formatInputDate(end),
  }
}

function getCurrentMonthRange(): DateRange {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  return {
    start: formatInputDate(start),
    end: formatInputDate(end),
  }
}

function isDateInRange(date: string | null, range: DateRange) {
  return Boolean(date && date >= range.start && date <= range.end)
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

function getCustomer(order: Order) {
  const customer = order.customers

  return Array.isArray(customer) ? customer[0] : customer
}

function getOrderTitle(order: Order) {
  const customerName = getCustomer(order)?.name
  const firstItem = order.order_items?.[0]?.item_name

  return customerName || firstItem || 'Pedido sem cliente'
}

function getOrderSubtitle(order: Order) {
  const itemNames = (order.order_items ?? [])
    .filter((item) => !item.parent_order_item_id)
    .map((item) => item.item_name)
    .filter((itemName) => itemName.trim())

  return itemNames.length > 0 ? itemNames.join(', ') : 'Sem itens estruturados'
}

function calculateEstimatedCost(
  quantity: number,
  quantityUnit: string,
  costPerUnit: NumericValue,
  costUnit: string
) {
  const unitCost = parseNumber(costPerUnit)

  if (quantity <= 0 || unitCost <= 0) return null

  const convertedQuantity = canConvertUnits(quantityUnit, costUnit)
    ? convertQuantity(quantity, quantityUnit, costUnit)
    : null

  return (convertedQuantity ?? quantity) * unitCost
}

function calculateEstimatedUnitPrice(item: ShoppingListItem) {
  if (item.estimatedCost === null || item.quantityToBuy <= 0) return null

  return item.estimatedCost / item.quantityToBuy
}

function convertUnitPrice(pricePerUnit: number, priceUnit: string, targetUnit: string) {
  if (normalizeUnit(priceUnit) === normalizeUnit(targetUnit)) return pricePerUnit

  const targetQuantityInPriceUnit = convertQuantity(1, targetUnit, priceUnit)

  return targetQuantityInPriceUnit === null ? null : pricePerUnit * targetQuantityInPriceUnit
}

function sortShoppingItems(items: ShoppingListItem[]) {
  return [...items].sort((firstItem, secondItem) => {
    const supplierComparison = firstItem.supplierName.localeCompare(
      secondItem.supplierName,
      'pt-BR'
    )
    if (supplierComparison !== 0) return supplierComparison

    const categoryComparison = firstItem.category.localeCompare(secondItem.category, 'pt-BR')
    if (categoryComparison !== 0) return categoryComparison

    return firstItem.name.localeCompare(secondItem.name, 'pt-BR')
  })
}

function addQuantityToAccumulator(
  accumulator: Map<string, AccumulatedPurchaseItem>,
  item: Omit<AccumulatedPurchaseItem, 'quantityNeeded' | 'hasMixedUnits' | 'sources'> & {
    quantity: number
    sourceLabel: string
  }
) {
  if (item.quantity <= 0) return

  const currentItem = accumulator.get(item.itemKey)

  if (!currentItem) {
    accumulator.set(item.itemKey, {
      itemKey: item.itemKey,
      kind: item.kind,
      sourceId: item.sourceId,
      name: item.name,
      category: item.category,
      supplierName: item.supplierName,
      quantityNeeded: item.quantity,
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      costUnit: item.costUnit,
      stockQuantity: item.stockQuantity,
      stockUnit: item.stockUnit,
      hasMixedUnits: false,
      sources: new Set([item.sourceLabel]),
    })
    return
  }

  if (normalizeUnit(currentItem.unit) === normalizeUnit(item.unit)) {
    currentItem.quantityNeeded += item.quantity
  } else {
    const convertedQuantity = convertQuantity(item.quantity, item.unit, currentItem.unit)

    if (convertedQuantity === null) {
      currentItem.quantityNeeded += item.quantity
      currentItem.hasMixedUnits = true
    } else {
      currentItem.quantityNeeded += convertedQuantity
    }
  }

  currentItem.sources.add(item.sourceLabel)
}

function getStockQuantityInUnit(item: AccumulatedPurchaseItem) {
  if (item.kind !== 'ingredient') return 0
  if (item.stockQuantity <= 0) return 0

  if (normalizeUnit(item.stockUnit) === normalizeUnit(item.unit)) {
    return item.stockQuantity
  }

  return convertQuantity(item.stockQuantity, item.stockUnit, item.unit) ?? 0
}

function finalizeShoppingItem(item: AccumulatedPurchaseItem): ShoppingListItem {
  const stockQuantity = getStockQuantityInUnit(item)
  const quantityToBuy = Math.max(item.quantityNeeded - stockQuantity, 0)
  const estimatedCost = calculateEstimatedCost(
    quantityToBuy,
    item.unit,
    item.costPerUnit,
    item.costUnit
  )

  return {
    itemKey: item.itemKey,
    kind: item.kind,
    sourceId: item.sourceId,
    name: item.name,
    category: item.category,
    supplierName: item.supplierName,
    quantityNeeded: item.quantityNeeded,
    stockQuantity,
    quantityToBuy,
    unit: item.unit,
    stockUnit: item.stockUnit,
    costPerUnit: item.costPerUnit,
    costUnit: item.costUnit,
    estimatedCost,
    hasMixedUnits:
      item.hasMixedUnits ||
      (item.kind === 'ingredient' &&
        item.stockQuantity > 0 &&
        !canConvertUnits(item.stockUnit, item.unit)),
    sources: Array.from(item.sources).sort((firstSource, secondSource) =>
      firstSource.localeCompare(secondSource, 'pt-BR')
    ),
    isInStock: item.kind === 'ingredient' && quantityToBuy <= 0,
  }
}

function groupItemsBySupplierAndCategory(items: ShoppingListItem[]) {
  const groups = new Map<string, { supplierName: string; category: string; items: ShoppingListItem[] }>()

  items.forEach((item) => {
    const key = `${item.supplierName}::${item.category}`
    const currentGroup = groups.get(key)

    if (currentGroup) {
      currentGroup.items.push(item)
      return
    }

    groups.set(key, {
      supplierName: item.supplierName,
      category: item.category,
      items: [item],
    })
  })

  return Array.from(groups.values()).sort((firstGroup, secondGroup) => {
    const supplierComparison = firstGroup.supplierName.localeCompare(
      secondGroup.supplierName,
      'pt-BR'
    )
    if (supplierComparison !== 0) return supplierComparison

    return firstGroup.category.localeCompare(secondGroup.category, 'pt-BR')
  })
}

function groupItemsBySupplier(items: ShoppingListItem[]) {
  const groups = new Map<string, ShoppingListItem[]>()

  items.forEach((item) => {
    const currentItems = groups.get(item.supplierName) ?? []
    currentItems.push(item)
    groups.set(item.supplierName, currentItems)
  })

  return Array.from(groups.entries()).sort(([firstSupplier], [secondSupplier]) =>
    firstSupplier.localeCompare(secondSupplier, 'pt-BR')
  )
}

export default function ListaComprasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [recipePackaging, setRecipePackaging] = useState<RecipePackaging[]>([])
  const [packagingItems, setPackagingItems] = useState<Packaging[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [shoppingMode, setShoppingMode] = useState<ShoppingMode>('recipes')
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set())
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [productionAmounts, setProductionAmounts] = useState<Record<string, string>>({})
  const [purchasedItemKeys, setPurchasedItemKeys] = useState<Set<string>>(new Set())
  const [purchaseRuntimeByItemKey, setPurchaseRuntimeByItemKey] = useState<
    Record<string, PurchaseItemRuntime>
  >({})
  const [showPurchasedItems, setShowPurchasedItems] = useState(false)
  const [updatingPriceItemKey, setUpdatingPriceItemKey] = useState<string | null>(null)
  const [isFinalizingPurchase, setIsFinalizingPurchase] = useState(false)
  const [hasGeneratedList, setHasGeneratedList] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const weekRange = useMemo(() => getCurrentWeekRange(), [])
  const monthRange = useMemo(() => getCurrentMonthRange(), [])

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
          .select(
            'id, user_id, name, category, yield_amount, yield_unit, product_type, is_third_party'
          )
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (recipesError) throw recipesError

        const loadedRecipes = (recipesData ?? []) as Recipe[]
        const internalRecipeIds = loadedRecipes
          .filter((recipe) => recipe.is_third_party !== true)
          .map((recipe) => recipe.id)

        let loadedRecipeIngredients: RecipeIngredient[] = []
        let loadedIngredients: Ingredient[] = []
        let loadedSuppliers: Supplier[] = []
        let loadedRecipePackaging: RecipePackaging[] = []
        let loadedPackagingItems: Packaging[] = []

        if (internalRecipeIds.length > 0) {
          const { data: recipeIngredientsData, error: recipeIngredientsError } = await supabase
            .from('recipe_ingredients')
            .select('recipe_id, ingredient_id, quantity, unit')
            .in('recipe_id', internalRecipeIds)

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
              .select(
                'id, user_id, name, category, supplier_id, usage_unit, cost_per_unit, stock_quantity, stock_unit'
              )
              .eq('user_id', user.id)
              .in('id', ingredientIds)
              .order('name', { ascending: true })

            if (ingredientsError) throw ingredientsError

            loadedIngredients = (ingredientsData ?? []) as Ingredient[]
          }

          const { data: recipePackagingData, error: recipePackagingError } = await supabase
            .from('recipe_packaging')
            .select('recipe_id, packaging_id, quantity_per_recipe_unit, usage_type')
            .in('recipe_id', internalRecipeIds)

          if (recipePackagingError) throw recipePackagingError

          loadedRecipePackaging = (recipePackagingData ?? []) as RecipePackaging[]

          const packagingIds = Array.from(
            new Set(
              loadedRecipePackaging
                .map((item) => item.packaging_id)
                .filter((packagingId) => packagingId.length > 0)
            )
          )

          if (packagingIds.length > 0) {
            const { data: packagingData, error: packagingError } = await supabase
              .from('packaging')
              .select('id, user_id, name, category, unit, cost_per_unit, capacity, capacity_unit')
              .eq('user_id', user.id)
              .in('id', packagingIds)
              .order('name', { ascending: true })

            if (packagingError) throw packagingError

            loadedPackagingItems = (packagingData ?? []) as Packaging[]
          }
        }

        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, user_id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (suppliersError) throw suppliersError

        loadedSuppliers = (suppliersData ?? []) as Supplier[]

        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(
            `
              id,
              user_id,
              delivery_date,
              delivery_time,
              status,
              customers (
                name
              ),
              order_items (
                id,
                order_id,
                recipe_id,
                parent_order_item_id,
                item_name,
                quantity
              )
            `
          )
          .eq('user_id', user.id)
          .neq('status', 'cancelado')
          .order('delivery_date', { ascending: true })

        if (ordersError) throw ordersError

        const loadedOrders = (ordersData ?? []) as Order[]
        const loadedOrderItems = loadedOrders.flatMap((order) =>
          (order.order_items ?? []).map((item) => ({
            ...item,
            order_id: item.order_id || order.id,
          }))
        )

        if (isMounted) {
          setRecipes(loadedRecipes.filter((recipe) => recipe.is_third_party !== true))
          setRecipeIngredients(loadedRecipeIngredients)
          setIngredients(loadedIngredients)
          setSuppliers(loadedSuppliers)
          setRecipePackaging(loadedRecipePackaging)
          setPackagingItems(loadedPackagingItems)
          setOrders(loadedOrders)
          setOrderItems(loadedOrderItems)
          setProductionAmounts(
            loadedRecipes.reduce<Record<string, string>>((amounts, recipe) => {
              if (recipe.is_third_party !== true) {
                amounts[recipe.id] = getDefaultProductionAmount(recipe)
              }
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

    void loadShoppingData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const recipeById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]))
  }, [recipes])

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

  const supplierById = useMemo(() => {
    return new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  }, [suppliers])

  const recipePackagingByRecipeId = useMemo(() => {
    return recipePackaging.reduce<Map<string, RecipePackaging[]>>((groups, item) => {
      const currentItems = groups.get(item.recipe_id) ?? []
      currentItems.push(item)
      groups.set(item.recipe_id, currentItems)

      return groups
    }, new Map())
  }, [recipePackaging])

  const packagingById = useMemo(() => {
    return new Map(packagingItems.map((packaging) => [packaging.id, packaging]))
  }, [packagingItems])

  const ordersInWeek = useMemo(() => {
    return orders.filter((order) => isDateInRange(order.delivery_date, weekRange))
  }, [orders, weekRange])

  const ordersInMonth = useMemo(() => {
    return orders.filter((order) => isDateInRange(order.delivery_date, monthRange))
  }, [monthRange, orders])

  const selectedRecipes = useMemo(() => {
    return recipes.filter((recipe) => selectedRecipeIds.has(recipe.id))
  }, [recipes, selectedRecipeIds])

  const selectedOrders = useMemo(() => {
    return orders.filter((order) => selectedOrderIds.has(order.id))
  }, [orders, selectedOrderIds])

  const scopedOrders = useMemo(() => {
    if (shoppingMode === 'selected_orders') return selectedOrders
    if (shoppingMode === 'week') return ordersInWeek
    if (shoppingMode === 'month') return ordersInMonth

    return []
  }, [ordersInMonth, ordersInWeek, selectedOrders, shoppingMode])

  const shoppingList = useMemo<ShoppingList>(() => {
    const accumulator = new Map<string, AccumulatedPurchaseItem>()

    function addRecipeNeeds(
      recipe: Recipe,
      productQuantity: number,
      sourceLabel: string,
      skipKitRecipe: boolean
    ) {
      if (recipe.is_third_party === true) return
      if (skipKitRecipe && recipe.product_type === 'kit') return

      const yieldAmount = parseNumber(recipe.yield_amount)
      const ingredientFactor = yieldAmount > 0 ? productQuantity / yieldAmount : productQuantity
      const recipeItems = recipeIngredientsByRecipeId.get(recipe.id) ?? []

      recipeItems.forEach((recipeItem) => {
        const ingredient = ingredientById.get(recipeItem.ingredient_id)
        const unit = recipeItem.unit?.trim() || ingredient?.usage_unit?.trim() || 'unidade'
        const neededQuantity = parseNumber(recipeItem.quantity) * ingredientFactor
        const stockUnit = ingredient?.stock_unit?.trim() || ingredient?.usage_unit?.trim() || unit
        const supplierName = ingredient?.supplier_id
          ? supplierById.get(ingredient.supplier_id)?.name ?? 'Sem fornecedor definido'
          : 'Sem fornecedor definido'

        addQuantityToAccumulator(accumulator, {
          itemKey: `ingredient:${recipeItem.ingredient_id}`,
          kind: 'ingredient',
          sourceId: recipeItem.ingredient_id,
          name: ingredient?.name || 'Ingrediente não encontrado',
          category: ingredient?.category?.trim() || 'Sem categoria',
          supplierName,
          quantity: neededQuantity,
          unit,
          costPerUnit: ingredient?.cost_per_unit ?? null,
          costUnit: ingredient?.usage_unit?.trim() || unit,
          stockQuantity: parseNumber(ingredient?.stock_quantity),
          stockUnit,
          sourceLabel,
        })
      })

      const packagingLinks = recipePackagingByRecipeId.get(recipe.id) ?? []

      packagingLinks.forEach((packagingLink) => {
        const packaging = packagingById.get(packagingLink.packaging_id)
        const unit = packaging?.unit?.trim() || 'unidade'
        const capacity = parseNumber(packaging?.capacity)
        const safeCapacity = capacity > 0 ? capacity : 1
        const neededQuantity =
          packagingLink.usage_type === 'transporte'
            ? Math.ceil(productQuantity / safeCapacity)
            : productQuantity * parseNumber(packagingLink.quantity_per_recipe_unit)

        addQuantityToAccumulator(accumulator, {
          itemKey: `packaging:${packagingLink.packaging_id}`,
          kind: 'packaging',
          sourceId: packagingLink.packaging_id,
          name: packaging?.name || 'Embalagem não encontrada',
          category: packaging?.category?.trim() || 'Sem categoria',
          supplierName: 'Sem fornecedor',
          quantity: neededQuantity,
          unit,
          costPerUnit: packaging?.cost_per_unit ?? null,
          costUnit: unit,
          stockQuantity: 0,
          stockUnit: unit,
          sourceLabel,
        })
      })
    }

    if (shoppingMode === 'recipes') {
      selectedRecipes.forEach((recipe) => {
        const desiredAmount = parseNumber(productionAmounts[recipe.id])

        if (desiredAmount <= 0) return

        addRecipeNeeds(recipe, desiredAmount, recipe.name, false)
      })
    } else {
      const scopedOrderIds = new Set(scopedOrders.map((order) => order.id))
      const scopedOrderItems = orderItems.filter((item) => scopedOrderIds.has(item.order_id))

      scopedOrderItems.forEach((orderItem) => {
        if (!orderItem.recipe_id) return

        const recipe = recipeById.get(orderItem.recipe_id)
        if (!recipe) return

        addRecipeNeeds(recipe, parseNumber(orderItem.quantity), orderItem.item_name, true)
      })
    }

    const allItems = Array.from(accumulator.values()).map(finalizeShoppingItem)
    const ingredientsToBuy = allItems.filter(
      (item) => item.kind === 'ingredient' && item.quantityToBuy > 0
    )
    const packagingToBuy = allItems.filter(
      (item) => item.kind === 'packaging' && item.quantityToBuy > 0
    )
    const inStock = allItems.filter((item) => item.isInStock)

    return {
      ingredients: sortShoppingItems(ingredientsToBuy),
      packaging: sortShoppingItems(packagingToBuy),
      inStock: sortShoppingItems(inStock),
    }
  }, [
    ingredientById,
    orderItems,
    packagingById,
    productionAmounts,
    recipeById,
    recipeIngredientsByRecipeId,
    recipePackagingByRecipeId,
    scopedOrders,
    selectedRecipes,
    shoppingMode,
    supplierById,
  ])

  const allPurchaseItems = [...shoppingList.ingredients, ...shoppingList.packaging]
  const visibleIngredientItems = shoppingList.ingredients.filter(
    (item) => showPurchasedItems || !purchasedItemKeys.has(item.itemKey)
  )
  const visiblePackagingItems = shoppingList.packaging.filter(
    (item) => showPurchasedItems || !purchasedItemKeys.has(item.itemKey)
  )
  const purchasedItems = allPurchaseItems.filter((item) => purchasedItemKeys.has(item.itemKey))
  const visibleShoppingItems = [...visibleIngredientItems, ...visiblePackagingItems]
  const totalEstimatedCost = allPurchaseItems.reduce(
    (sum, item) => sum + (item.estimatedCost ?? 0),
    0
  )
  const totalRealCost = allPurchaseItems.reduce(
    (sum, item) => sum + (getItemRealTotal(item) ?? item.estimatedCost ?? 0),
    0
  )
  const hasRealCosts = allPurchaseItems.some((item) => getItemRealTotal(item) !== null)
  const totalDifference = totalRealCost - totalEstimatedCost
  const hasUnavailableCosts = allPurchaseItems.some((item) => item.estimatedCost === null)
  const hasSelectedRecipes = selectedRecipeIds.size > 0
  const hasSelectedOrders = selectedOrderIds.size > 0
  const hasModeInput =
    shoppingMode === 'recipes'
      ? hasSelectedRecipes
      : shoppingMode === 'selected_orders'
        ? hasSelectedOrders
        : scopedOrders.length > 0
  const canCopyList = hasGeneratedList && visibleShoppingItems.length > 0
  const canFinalizePurchase =
    hasGeneratedList && allPurchaseItems.length > 0 && !isFinalizingPurchase

  function resetGeneratedList() {
    setHasGeneratedList(false)
    setPurchasedItemKeys(new Set())
    setPurchaseRuntimeByItemKey({})
    setShowPurchasedItems(false)
    setCopyFeedback('')
    setActionFeedback('')
  }

  function handleModeChange(mode: ShoppingMode) {
    setShoppingMode(mode)
    setError('')
    resetGeneratedList()
  }

  function toggleRecipe(recipe: Recipe) {
    setSelectedRecipeIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(recipe.id)) {
        nextIds.delete(recipe.id)
      } else {
        nextIds.add(recipe.id)
      }

      return nextIds
    })
    resetGeneratedList()
  }

  function toggleOrder(order: Order) {
    setSelectedOrderIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(order.id)) {
        nextIds.delete(order.id)
      } else {
        nextIds.add(order.id)
      }

      return nextIds
    })
    resetGeneratedList()
  }

  function handleProductionAmountChange(recipeId: string, value: string) {
    setProductionAmounts((currentAmounts) => ({
      ...currentAmounts,
      [recipeId]: value,
    }))
    resetGeneratedList()
  }

  function validateSelection() {
    if (shoppingMode === 'recipes') {
      if (selectedRecipeIds.size === 0) {
        return 'Selecione pelo menos uma receita para gerar a lista.'
      }

      const invalidRecipe = selectedRecipes.find((recipe) => {
        const desiredAmount = parseNumber(productionAmounts[recipe.id])

        return desiredAmount <= 0
      })

      if (invalidRecipe) {
        return 'Receitas selecionadas precisam ter quantidade a produzir maior que zero.'
      }
    }

    if (shoppingMode === 'selected_orders' && selectedOrderIds.size === 0) {
      return 'Selecione pelo menos um pedido para gerar a lista.'
    }

    if ((shoppingMode === 'week' || shoppingMode === 'month') && scopedOrders.length === 0) {
      return 'Nao ha pedidos no periodo selecionado.'
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
    setActionFeedback('')
    setPurchasedItemKeys(new Set())
    setPurchaseRuntimeByItemKey({})
    setShowPurchasedItems(false)
    setHasGeneratedList(true)
  }

  function handleClearSelection() {
    setSelectedRecipeIds(new Set())
    setSelectedOrderIds(new Set())
    setProductionAmounts(
      recipes.reduce<Record<string, string>>((amounts, recipe) => {
        amounts[recipe.id] = getDefaultProductionAmount(recipe)
        return amounts
      }, {})
    )
    setError('')
    resetGeneratedList()
  }

  function getRealUnitPriceInputValue(item: ShoppingListItem) {
    return purchaseRuntimeByItemKey[item.itemKey]?.realUnitPrice ?? ''
  }

  function getPurchasedQuantityInputValue(item: ShoppingListItem) {
    return (
      purchaseRuntimeByItemKey[item.itemKey]?.purchasedQuantity ??
      formatInputNumber(item.quantityToBuy)
    )
  }

  function getItemRealTotal(item: ShoppingListItem) {
    const realUnitPrice = parseNumber(getRealUnitPriceInputValue(item))
    const purchasedQuantity = parseNumber(getPurchasedQuantityInputValue(item))

    if (realUnitPrice <= 0 || purchasedQuantity <= 0) return null

    return realUnitPrice * purchasedQuantity
  }

  function updatePurchaseRuntime(
    itemKey: string,
    field: keyof PurchaseItemRuntime,
    value: string
  ) {
    setPurchaseRuntimeByItemKey((currentRuntime) => ({
      ...currentRuntime,
      [itemKey]: {
        ...currentRuntime[itemKey],
        [field]: value,
      },
    }))
    setError('')
    setActionFeedback('')
    setCopyFeedback('')
  }

  function setItemPurchased(item: ShoppingListItem, isPurchased: boolean) {
    setPurchasedItemKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys)

      if (isPurchased) {
        nextKeys.add(item.itemKey)
      } else {
        nextKeys.delete(item.itemKey)
      }

      return nextKeys
    })

    if (isPurchased) {
      setPurchaseRuntimeByItemKey((currentRuntime) => {
        const currentItemRuntime = currentRuntime[item.itemKey] ?? {}

        if (currentItemRuntime.purchasedQuantity !== undefined) return currentRuntime

        return {
          ...currentRuntime,
          [item.itemKey]: {
            ...currentItemRuntime,
            purchasedQuantity: formatInputNumber(item.quantityToBuy),
          },
        }
      })
    }

    setActionFeedback('')
    setCopyFeedback('')
  }

  async function handleUpdateStandardPrice(item: ShoppingListItem) {
    const realUnitPrice = parseNumber(getRealUnitPriceInputValue(item))

    if (realUnitPrice <= 0) {
      setError('Informe um preco real unitario maior que zero para atualizar o padrao.')
      return
    }

    const standardPrice = convertUnitPrice(realUnitPrice, item.unit, item.costUnit)

    if (standardPrice === null || standardPrice <= 0) {
      setError(
        `Nao foi possivel converter o preco de ${item.unit} para ${item.costUnit}. Ajuste a unidade antes de atualizar o padrao.`
      )
      return
    }

    setUpdatingPriceItemKey(item.itemKey)
    setError('')
    setActionFeedback('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      if (item.kind === 'ingredient') {
        const { error: updateError } = await supabase
          .from('ingredients')
          .update({ cost_per_unit: standardPrice })
          .eq('id', item.sourceId)
          .eq('user_id', user.id)

        if (updateError) throw updateError

        setIngredients((currentIngredients) =>
          currentIngredients.map((ingredient) =>
            ingredient.id === item.sourceId
              ? { ...ingredient, cost_per_unit: standardPrice }
              : ingredient
          )
        )
      } else {
        const { error: updateError } = await supabase
          .from('packaging')
          .update({ cost_per_unit: standardPrice })
          .eq('id', item.sourceId)
          .eq('user_id', user.id)

        if (updateError) throw updateError

        setPackagingItems((currentItems) =>
          currentItems.map((packaging) =>
            packaging.id === item.sourceId
              ? { ...packaging, cost_per_unit: standardPrice }
              : packaging
          )
        )
      }

      setActionFeedback(
        item.kind === 'packaging'
          ? `Preco padrao de "${item.name}" atualizado em cost_per_unit.`
          : `Preco padrao de "${item.name}" atualizado.`
      )
    } catch (err) {
      console.error('Erro ao atualizar preco padrao:', err)
      const message = err instanceof Error ? err.message : 'Falha ao atualizar preco padrao'
      setError(message)
    } finally {
      setUpdatingPriceItemKey(null)
    }
  }

  async function handleFinalizePurchase() {
    if (!canFinalizePurchase) return

    const itemsForTransaction = purchasedItems.length > 0 ? purchasedItems : allPurchaseItems
    const estimatedAmount = itemsForTransaction.reduce(
      (sum, item) => sum + (item.estimatedCost ?? 0),
      0
    )
    const hasRealAmount = itemsForTransaction.some((item) => getItemRealTotal(item) !== null)
    const realAmount = itemsForTransaction.reduce(
      (sum, item) => sum + (getItemRealTotal(item) ?? item.estimatedCost ?? 0),
      0
    )
    const transactionAmount = hasRealAmount ? realAmount : estimatedAmount

    if (transactionAmount <= 0) {
      setError('Nao ha valor calculado para criar a saida financeira.')
      return
    }

    setIsFinalizingPurchase(true)
    setError('')
    setActionFeedback('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const notes = itemsForTransaction
        .map((item) => {
          const quantity = parseNumber(getPurchasedQuantityInputValue(item)) || item.quantityToBuy
          const realTotal = getItemRealTotal(item)
          const totalLabel =
            realTotal === null
              ? `estimado ${formatCurrency(item.estimatedCost)}`
              : `real ${formatCurrency(realTotal)}`

          return `${item.name}: ${formatNumber(quantity)} ${item.unit} - ${totalLabel}`
        })
        .join('\n')

      const { error: insertError } = await supabase.from('financial_transactions').insert([
        {
          user_id: user.id,
          description: 'Compra de itens da lista',
          type: 'saida',
          amount: transactionAmount,
          category: 'Ingredientes/Embalagens',
          transaction_date: formatInputDate(new Date()),
          notes,
        },
      ])

      if (insertError) throw insertError

      setActionFeedback('Saida financeira criada para a compra da lista.')
    } catch (err) {
      console.error('Erro ao finalizar compra:', err)
      const message =
        err instanceof Error
          ? err.message
          : 'Nao foi possivel criar a saida financeira. Confira se financial_transactions existe.'
      setError(message)
    } finally {
      setIsFinalizingPurchase(false)
    }
  }

  async function handleCopyList() {
    if (!canCopyList) return

    const copyGroups = groupItemsBySupplier(visibleShoppingItems)
    const listText = [
      'Lista de compras - Doceria Pro',
      ...copyGroups.flatMap(([supplierName, supplierItems]) => [
        supplierName,
        ...supplierItems.map((item) => {
          const costText =
            item.estimatedCost === null
              ? 'estimado indisponivel'
              : `estimado ${formatCurrency(item.estimatedCost)}`
          const realTotal = getItemRealTotal(item)
          const realText = realTotal === null ? '' : ` - real ${formatCurrency(realTotal)}`
          const statusText = purchasedItemKeys.has(item.itemKey) ? 'comprado' : 'pendente'

          return `- [${statusText}] ${item.name}: ${formatNumber(item.quantityToBuy)} ${
            item.unit
          } - ${costText}${realText}`
        }),
      ]),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(listText)
      setCopyFeedback('Lista copiada')
    } catch (err) {
      console.error('Erro ao copiar lista de compras:', err)
      setCopyFeedback('')
      setError('Nao foi possivel copiar a lista.')
    }
  }

  function renderPurchaseItems(items: ShoppingListItem[]) {
    const groups = groupItemsBySupplierAndCategory(items)

    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={`${group.supplierName}-${group.category}`} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#C9A84C]">
                {group.supplierName}
              </p>
              <span className="rounded-full bg-[#FAF6F0] px-2 py-1 text-xs font-semibold text-[#1A0A08]">
                {group.category}
              </span>
            </div>

            {group.items.map((item) => {
              const isPurchased = purchasedItemKeys.has(item.itemKey)
              const estimatedUnitPrice = calculateEstimatedUnitPrice(item)
              const realTotal = getItemRealTotal(item)
              const realDifference =
                realTotal === null ? null : realTotal - (item.estimatedCost ?? 0)
              const realUnitPriceInput = getRealUnitPriceInputValue(item)
              const purchasedQuantityInput = getPurchasedQuantityInputValue(item)
              const canUpdateStandardPrice =
                parseNumber(realUnitPriceInput) > 0 && updatingPriceItemKey !== item.itemKey

              return (
                <article
                  key={item.itemKey}
                  className={`rounded-[16px] border p-4 transition-colors ${
                    isPurchased
                      ? 'border-[#BFE8CC] bg-[#F4FBF6]'
                      : 'border-[rgba(26,10,8,0.07)] bg-[#FAF6F0]'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p
                          className={`break-words text-base font-bold text-[#1A0A08] ${
                            isPurchased ? 'line-through decoration-2' : ''
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-[#999999]">
                          Comprar {formatNumber(item.quantityToBuy)} {item.unit}
                        </p>
                        <p className="mt-1 text-xs text-[#999999]">
                          Necessario {formatNumber(item.quantityNeeded)} {item.unit}
                          {item.kind === 'ingredient' &&
                            ` - estoque ${formatNumber(item.stockQuantity)} ${item.unit}`}
                        </p>
                        {item.sources.length > 0 && (
                          <p className="mt-2 text-xs text-[#6F625F]">
                            Origem: {item.sources.join(', ')}
                          </p>
                        )}
                        {item.hasMixedUnits && (
                          <p className="mt-2 text-xs font-semibold text-[#C0392B]">
                            Ha unidades diferentes ou estoque em unidade incompativel.
                          </p>
                        )}
                      </div>

                      <label className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1A0A08]">
                        <input
                          type="checkbox"
                          checked={isPurchased}
                          onChange={(event) => setItemPurchased(item, event.target.checked)}
                          className="h-4 w-4 rounded border-[rgba(26,10,8,0.18)] accent-[#1F7A3A]"
                        />
                        <span>Comprado</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#999999]">
                          Preco estimado unitario
                        </p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {formatCurrency(estimatedUnitPrice)}
                          {estimatedUnitPrice !== null && (
                            <span className="ml-1 text-xs font-semibold text-[#999999]">
                              / {item.unit}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium text-[#999999]">Total estimado</p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {formatCurrency(item.estimatedCost)}
                        </p>
                      </div>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                          Preco real unitario
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          inputMode="decimal"
                          value={realUnitPriceInput}
                          onChange={(event) =>
                            updatePurchaseRuntime(
                              item.itemKey,
                              'realUnitPrice',
                              event.target.value
                            )
                          }
                          placeholder="0,00"
                          className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                          Quantidade comprada
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          inputMode="decimal"
                          value={purchasedQuantityInput}
                          onChange={(event) =>
                            updatePurchaseRuntime(
                              item.itemKey,
                              'purchasedQuantity',
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                        />
                      </label>
                    </div>

                    {realTotal !== null && (
                      <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-[#1A0A08]">
                            Total real: {formatCurrency(realTotal)}
                          </p>
                          <p
                            className={`font-semibold ${
                              realDifference !== null && realDifference > 0
                                ? 'text-[#C0392B]'
                                : 'text-[#1F7A3A]'
                            }`}
                          >
                            Diferenca: {formatCurrency(realDifference)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-[#999999]">
                        Padrao atual: {formatCurrency(parseNumber(item.costPerUnit))} /{' '}
                        {item.costUnit}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleUpdateStandardPrice(item)}
                        disabled={!canUpdateStandardPrice}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#F4E9DD] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save size={16} aria-hidden="true" />
                        <span>
                          {updatingPriceItemKey === item.itemKey
                            ? 'Atualizando...'
                            : 'Atualizar preco padrao'}
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  function renderReadonlyItems(items: ShoppingListItem[]) {
    if (items.length === 0) return null

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.itemKey}
            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white p-3 text-sm"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-[#1A0A08]">{item.name}</p>
              <p className="text-[#999999]">
                {formatNumber(item.quantityNeeded)} {item.unit}
              </p>
            </div>
            {item.kind === 'ingredient' && (
              <p className="mt-1 text-xs font-semibold text-[#1F7A3A]">
                Em estoque: {formatNumber(item.stockQuantity)} {item.unit}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderOrderCard(order: Order, selectable: boolean) {
    const isSelected = selectedOrderIds.has(order.id)

    return (
      <article
        key={order.id}
        className={`rounded-[16px] border p-4 transition-colors ${
          selectable && isSelected
            ? 'border-[#C0392B] bg-[#FFF8F5]'
            : 'border-[rgba(26,10,8,0.07)] bg-white'
        }`}
      >
        <div className="flex items-start gap-3">
          {selectable && (
            <input
              id={`order-${order.id}`}
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleOrder(order)}
              className="mt-1 h-5 w-5 shrink-0 rounded border-[rgba(26,10,8,0.18)] accent-[#C0392B]"
            />
          )}
          <div className="min-w-0">
            <label
              htmlFor={`order-${order.id}`}
              className="block text-base font-bold text-[#1A0A08]"
            >
              {getOrderTitle(order)}
            </label>
            <p className="mt-1 text-sm text-[#999999]">{getOrderSubtitle(order)}</p>
            <p className="mt-2 text-xs font-semibold text-[#C9A84C]">
              {formatDate(order.delivery_date)}
              {order.delivery_time ? ` as ${order.delivery_time}` : ''}
            </p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="border-b border-[rgba(26,10,8,0.07)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
            PRODUCAO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A0A08]">Lista de compras</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6F625F]">
            Gere compras por receitas ou por pedidos, com ingredientes internos,
            embalagens e estoque atual descontado.
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {actionFeedback && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#BFE8CC] bg-[#F4FBF6] p-3 text-sm text-[#1F7A3A]">
            <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando dados...</p>
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
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#1A0A08]">Origem da compra</h2>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {shoppingModeOptions.map((modeOption) => (
                    <button
                      key={modeOption.id}
                      type="button"
                      onClick={() => handleModeChange(modeOption.id)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                        shoppingMode === modeOption.id
                          ? 'bg-[#C0392B] text-white'
                          : 'border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] text-[#1A0A08] hover:bg-white'
                      }`}
                    >
                      {modeOption.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={!hasSelectedRecipes && !hasSelectedOrders && !hasGeneratedList}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-4 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw size={17} aria-hidden="true" />
                  <span>Limpar</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateList}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
                >
                  <Sparkles size={18} aria-hidden="true" />
                  <span>Gerar lista</span>
                </button>
              </div>

              {shoppingMode === 'recipes' && (
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
                                handleProductionAmountChange(recipe.id, event.target.value)
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
              )}

              {shoppingMode === 'selected_orders' && (
                <div className="space-y-3">
                  {orders.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-8 text-center">
                      <p className="text-base font-semibold text-[#1A0A08]">
                        Nenhum pedido disponivel
                      </p>
                    </div>
                  ) : (
                    orders.map((order) => renderOrderCard(order, true))
                  )}
                </div>
              )}

              {shoppingMode === 'week' && (
                <div className="space-y-3">
                  <p className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08]">
                    Semana: {formatDate(weekRange.start)} a {formatDate(weekRange.end)}
                  </p>
                  {ordersInWeek.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-8 text-center">
                      <p className="text-base font-semibold text-[#1A0A08]">
                        Nenhum pedido nesta semana
                      </p>
                    </div>
                  ) : (
                    ordersInWeek.map((order) => renderOrderCard(order, false))
                  )}
                </div>
              )}

              {shoppingMode === 'month' && (
                <div className="space-y-3">
                  <p className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08]">
                    Mes: {formatDate(monthRange.start)} a {formatDate(monthRange.end)}
                  </p>
                  {ordersInMonth.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-8 text-center">
                      <p className="text-base font-semibold text-[#1A0A08]">
                        Nenhum pedido neste mes
                      </p>
                    </div>
                  ) : (
                    ordersInMonth.map((order) => renderOrderCard(order, false))
                  )}
                </div>
              )}
            </section>

            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Lista gerada</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Itens agrupados por fornecedor e categoria.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {purchasedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPurchasedItems((currentValue) => !currentValue)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-4 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
                    >
                      {showPurchasedItems ? (
                        <EyeOff size={17} aria-hidden="true" />
                      ) : (
                        <Eye size={17} aria-hidden="true" />
                      )}
                      <span>{showPurchasedItems ? 'Ocultar comprados' : 'Mostrar comprados'}</span>
                    </button>
                  )}

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
              </div>

              {!hasModeInput ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <ShoppingCart className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]" aria-hidden="true" />
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Nenhuma origem selecionada
                  </p>
                  <p className="mt-1 text-sm text-[#999999]">
                    Escolha receitas, pedidos ou um periodo com pedidos.
                  </p>
                </div>
              ) : !hasGeneratedList ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <Sparkles className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]" aria-hidden="true" />
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Pronta para calcular
                  </p>
                  <p className="mt-1 text-sm text-[#999999]">
                    Clique em Gerar lista para consolidar compras e descontar estoque.
                  </p>
                </div>
              ) : allPurchaseItems.length === 0 && shoppingList.inStock.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <PackageSearch className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]" aria-hidden="true" />
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Nenhum item encontrado
                  </p>
                  <p className="mt-1 text-sm text-[#999999]">
                    Produtos terceirizados são ignorados e receitas sem insumos não geram compras.
                  </p>
                </div>
              ) : (
                <>
                  {allPurchaseItems.length > 0 && (
                    <div className="mb-5 rounded-[16px] bg-[#1A0A08] p-4 text-white">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-[#E8D9D4]">
                            Total estimado
                          </p>
                          <p className="mt-1 text-2xl font-bold">
                            {formatCurrency(totalEstimatedCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-[#E8D9D4]">
                            Total real
                          </p>
                          <p className="mt-1 text-2xl font-bold">
                            {formatCurrency(hasRealCosts ? totalRealCost : totalEstimatedCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-[#E8D9D4]">
                            Diferenca
                          </p>
                          <p
                            className={`mt-1 text-2xl font-bold ${
                              totalDifference > 0 ? 'text-[#FFC7BC]' : 'text-[#BFE8CC]'
                            }`}
                          >
                            {formatCurrency(hasRealCosts ? totalDifference : 0)}
                          </p>
                        </div>
                      </div>

                      {hasUnavailableCosts && (
                        <p className="mt-3 text-sm text-[#E8D9D4]">
                          Alguns itens não têm custo por unidade cadastrado.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleFinalizePurchase}
                        disabled={!canFinalizePurchase}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#F4E9DD] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ReceiptText size={18} aria-hidden="true" />
                        <span>
                          {isFinalizingPurchase ? 'Finalizando...' : 'Finalizar compra'}
                        </span>
                      </button>
                    </div>
                  )}

                  {purchasedItems.length > 0 && !showPurchasedItems && (
                    <div className="mb-4 rounded-[16px] border border-[#BFE8CC] bg-[#F4FBF6] p-4">
                      <div className="flex items-center gap-2">
                        <PackageCheck size={18} className="text-[#1F7A3A]" aria-hidden="true" />
                        <p className="font-bold text-[#1A0A08]">
                          {purchasedItems.length} item
                          {purchasedItems.length === 1 ? '' : 's'} comprado
                          {purchasedItems.length === 1 ? '' : 's'} oculto
                          {purchasedItems.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  )}

                  {visibleIngredientItems.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-base font-bold text-[#1A0A08]">Ingredientes</h3>
                      {renderPurchaseItems(visibleIngredientItems)}
                    </div>
                  )}

                  {visiblePackagingItems.length > 0 && (
                    <div className="mt-6">
                      <h3 className="mb-3 text-base font-bold text-[#1A0A08]">Embalagens</h3>
                      {renderPurchaseItems(visiblePackagingItems)}
                    </div>
                  )}

                  {shoppingList.inStock.length > 0 && (
                    <div className="mt-6 rounded-[16px] border border-[#BFE8CC] bg-[#F4FBF6] p-4">
                      <h3 className="mb-3 font-bold text-[#1F7A3A]">Em estoque</h3>
                      {renderReadonlyItems(shoppingList.inStock)}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
