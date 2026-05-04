'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  PackageCheck,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Pagination, paginate } from '@/components/Pagination'
import {
  formatCurrency,
  formatNumber,
  normalizeUnit,
  parseNumericValue,
} from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'

type NumericValue = number | string | null | undefined
type TransactionType = 'entrada' | 'saida'
type ProductType = 'simples' | 'kit'
type PackagingUsageType = 'unitaria' | 'transporte'
type ReportPeriod = 'week' | 'month' | 'custom'

interface FinancialTransaction {
  id: string
  user_id: string
  type: TransactionType
  description: string
  amount: number
  category: string | null
  transaction_date: string
  notes: string | null
  created_at?: string
}

type SupabaseErrorDetails = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type CustomerSummary = {
  id: string
  name: string | null
  phone?: string | null
}

type Order = {
  id: string
  user_id: string
  customer_id?: string | null
  customer_name?: string | null
  product_name?: string | null
  description?: string | null
  order_date?: string | null
  delivery_date?: string | null
  delivery_time?: string | null
  event_date?: string | null
  party_date?: string | null
  due_date?: string | null
  total_value?: NumericValue
  manual_total?: NumericValue
  down_payment?: NumericValue
  deposit_value?: NumericValue
  remaining_amount?: NumericValue
  remaining_payment_date?: string | null
  status?: string | null
  created_at?: string | null
}

type OrderItem = {
  id: string
  order_id: string
  recipe_id: string | null
  parent_order_item_id: string | null
  item_name: string | null
  quantity: NumericValue
  unit_price?: NumericValue
  subtotal?: NumericValue
  notes?: string | null
}

type Recipe = {
  id: string
  name?: string | null
  product_type?: ProductType | null
  is_third_party?: boolean | null
  yield_amount?: NumericValue
  yield_unit?: string | null
  total_cost?: NumericValue
  cost_per_unit?: NumericValue
  supplier_cost?: NumericValue
  supplier_cost_unit?: string | null
}

type RecipeIngredient = {
  recipe_id: string
  ingredient_id: string
  quantity: NumericValue
  unit: string | null
}

type Ingredient = {
  id: string
  name: string
  category?: string | null
  usage_unit?: string | null
  cost_per_unit?: NumericValue
  stock_quantity?: NumericValue
  stock_unit?: string | null
}

type RecipePackaging = {
  recipe_id: string
  packaging_id: string
  quantity_per_recipe_unit: NumericValue
  usage_type: PackagingUsageType
}

type Packaging = {
  id: string
  name: string
  category?: string | null
  unit?: string | null
  cost_per_unit?: NumericValue
  capacity?: NumericValue
  capacity_unit?: string | null
}

type SupplierOrder = {
  id: string
  title: string
  customer_order_id?: string | null
  order_item_id?: string | null
  quantity?: NumericValue
  unit?: string | null
  due_date?: string | null
  status?: string | null
  estimated_cost?: NumericValue
}

type OrderCakeTopper = {
  id: string
  order_id: string
  cost?: NumericValue
}

type DateRange = {
  start: string
  end: string
}

type UnitDefinition = {
  kind: 'weight' | 'volume' | 'count'
  factor: number
}

type PurchaseForecastItem = {
  key: string
  name: string
  quantity: number
  unit: string
  estimatedCost: number
  origin: 'Ingrediente' | 'Embalagem'
}

type OrderReportRow = {
  id: string
  title: string
  customerName: string
  date: string
  total: number
  cost: number
  profit: number
  receivable: number
  isPartial: boolean
}

type CostCategories = {
  ingredients: number
  packaging: number
  suppliers: number
  toppers: number
  others: number
}

type ReportData = {
  orders: Order[]
  orderItems: OrderItem[]
  customers: CustomerSummary[]
  recipes: Recipe[]
  recipeIngredients: RecipeIngredient[]
  ingredients: Ingredient[]
  recipePackaging: RecipePackaging[]
  packaging: Packaging[]
  supplierOrders: SupplierOrder[]
  cakeToppers: OrderCakeTopper[]
  transactions: FinancialTransaction[]
  warnings: string[]
}

type ReportSummary = {
  revenue: number
  estimatedCost: number
  estimatedProfit: number
  purchaseForecast: number
  supplierCosts: number
  receivable: number
  realizedRevenue: number
  realizedExpenses: number
  realizedProfit: number
  ordersWithoutDate: number
  isPartial: boolean
  rows: OrderReportRow[]
  categories: CostCategories
  purchases: PurchaseForecastItem[]
  warnings: string[]
}

const defaultCategories = [
  'Venda',
  'Encomenda',
  'Evento',
  'Ingredientes',
  'Embalagens',
  'Fornecedores',
  'Equipamentos',
  'Marketing',
  'Transporte',
  'Contas',
  'Outro',
]

const emptyReportData: ReportData = {
  orders: [],
  orderItems: [],
  customers: [],
  recipes: [],
  recipeIngredients: [],
  ingredients: [],
  recipePackaging: [],
  packaging: [],
  supplierOrders: [],
  cakeToppers: [],
  transactions: [],
  warnings: [],
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

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  return {
    start: `${monthValue}-01`,
    end: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
  }
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
  return getMonthRange(getCurrentMonth())
}
function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)

  if (!year || !month || !day) return dateValue

  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function getTransactionAmount(transaction: FinancialTransaction) {
  return parseNumericValue(transaction.amount)
}

function normalizeDate(dateValue: string | null | undefined) {
  return dateValue?.slice(0, 10) || ''
}

function isDateInRange(dateValue: string | null | undefined, range: DateRange) {
  const normalizedDate = normalizeDate(dateValue)

  return Boolean(normalizedDate && normalizedDate >= range.start && normalizedDate <= range.end)
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

function getReportRange(period: ReportPeriod, customStartDate: string, customEndDate: string) {
  if (period === 'week') return getCurrentWeekRange()
  if (period === 'month') return getCurrentMonthRange()

  return {
    start: customStartDate,
    end: customEndDate || customStartDate,
  }
}

function getOrderReferenceDate(order: Order) {
  return normalizeDate(order.delivery_date || order.order_date)
}

function isActiveOrder(order: Order) {
  return order.status !== 'cancelado'
}

function getOrderTotal(order: Order) {
  const manualTotal = parseNumericValue(order.manual_total)

  return manualTotal > 0 ? manualTotal : parseNumericValue(order.total_value)
}

function getOrderReceivable(order: Order) {
  const remainingAmount = parseNumericValue(order.remaining_amount)

  if (remainingAmount > 0) return remainingAmount

  return 0
}

function getReceivableReferenceDate(order: Order) {
  return normalizeDate(order.remaining_payment_date || order.delivery_date)
}

function getCustomerName(order: Order, customersById: Map<string, CustomerSummary>) {
  if (order.customer_id) {
    const customer = customersById.get(order.customer_id)

    if (customer?.name) return customer.name
  }

  return order.customer_name || 'Cliente não informado'
}

function getOrderTitle(order: Order, items: OrderItem[]) {
  const mainItem = items.find((item) => !item.parent_order_item_id)

  return mainItem?.item_name || order.product_name || order.description || 'Pedido sem resumo'
}

function getSupplierCostFromRecipe(recipe: Recipe | undefined, quantity: number) {
  if (!recipe) return null

  const supplierCost = parseNumericValue(recipe.supplier_cost)
  const supplierCostUnit = normalizeText(recipe.supplier_cost_unit)

  if (supplierCost <= 0) return null
  if (supplierCostUnit === 'pedido') return supplierCost

  return supplierCost * quantity
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function getCostableOrderItems(items: OrderItem[], recipeById: Map<string, Recipe>) {
  const childrenByParentId = items.reduce<Map<string, OrderItem[]>>((groups, item) => {
    if (!item.parent_order_item_id) return groups

    const currentItems = groups.get(item.parent_order_item_id) ?? []
    groups.set(item.parent_order_item_id, [...currentItems, item])

    return groups
  }, new Map())
  const mainItems = items.filter((item) => !item.parent_order_item_id)

  if (mainItems.length === 0) return items

  return mainItems.flatMap((item) => {
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    const children = childrenByParentId.get(item.id) ?? []

    if (recipe?.product_type === 'kit' && children.length > 0) return children

    return [item]
  })
}

function addPurchaseForecastItem(
  purchasesByKey: Map<string, PurchaseForecastItem>,
  item: PurchaseForecastItem
) {
  const currentItem = purchasesByKey.get(item.key)

  if (!currentItem) {
    purchasesByKey.set(item.key, item)
    return
  }

  if (normalizeUnit(currentItem.unit) === normalizeUnit(item.unit)) {
    currentItem.quantity += item.quantity
  } else {
    const convertedQuantity = convertQuantity(item.quantity, item.unit, currentItem.unit)

    if (convertedQuantity === null) {
      purchasesByKey.set(`${item.key}:${normalizeUnit(item.unit)}`, item)
      return
    }

    currentItem.quantity += convertedQuantity
  }

  currentItem.estimatedCost += item.estimatedCost
}

function getSupplierOrderCost(
  supplierOrder: SupplierOrder,
  orderItemById: Map<string, OrderItem>,
  recipeById: Map<string, Recipe>
) {
  const estimatedCost = parseNumericValue(supplierOrder.estimated_cost)

  if (estimatedCost > 0) return estimatedCost

  if (!supplierOrder.order_item_id) return 0

  const orderItem = orderItemById.get(supplierOrder.order_item_id)
  const recipe = orderItem?.recipe_id ? recipeById.get(orderItem.recipe_id) : undefined

  return getSupplierCostFromRecipe(recipe, parseNumericValue(orderItem?.quantity)) ?? 0
}

function buildFinancialReport(data: ReportData, range: DateRange): ReportSummary {
  const customersById = new Map(data.customers.map((customer) => [customer.id, customer]))
  const recipeById = new Map(data.recipes.map((recipe) => [recipe.id, recipe]))
  const ingredientById = new Map(data.ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const packagingById = new Map(data.packaging.map((packaging) => [packaging.id, packaging]))
  const orderItemById = new Map(data.orderItems.map((item) => [item.id, item]))
  const orderIdsInPeriod = new Set<string>()
  const purchasesByKey = new Map<string, PurchaseForecastItem>()
  const warnings = [...data.warnings]

  const itemsByOrderId = data.orderItems.reduce<Map<string, OrderItem[]>>((groups, item) => {
    const currentItems = groups.get(item.order_id) ?? []
    groups.set(item.order_id, [...currentItems, item])

    return groups
  }, new Map())
  const recipeIngredientsByRecipeId = data.recipeIngredients.reduce<
    Map<string, RecipeIngredient[]>
  >((groups, item) => {
    const currentItems = groups.get(item.recipe_id) ?? []
    groups.set(item.recipe_id, [...currentItems, item])

    return groups
  }, new Map())
  const recipePackagingByRecipeId = data.recipePackaging.reduce<Map<string, RecipePackaging[]>>(
    (groups, item) => {
      const currentItems = groups.get(item.recipe_id) ?? []
      groups.set(item.recipe_id, [...currentItems, item])

      return groups
    },
    new Map()
  )
  const supplierOrdersByOrderItemId = data.supplierOrders.reduce<Map<string, SupplierOrder[]>>(
    (groups, supplierOrder) => {
      if (!supplierOrder.order_item_id) return groups

      const currentOrders = groups.get(supplierOrder.order_item_id) ?? []
      groups.set(supplierOrder.order_item_id, [...currentOrders, supplierOrder])

      return groups
    },
    new Map()
  )
  const supplierOrdersByOrderId = data.supplierOrders.reduce<Map<string, SupplierOrder[]>>(
    (groups, supplierOrder) => {
      if (!supplierOrder.customer_order_id) return groups

      const currentOrders = groups.get(supplierOrder.customer_order_id) ?? []
      groups.set(supplierOrder.customer_order_id, [...currentOrders, supplierOrder])

      return groups
    },
    new Map()
  )
  const cakeToppersByOrderId = data.cakeToppers.reduce<Map<string, OrderCakeTopper[]>>(
    (groups, cakeTopper) => {
      const currentItems = groups.get(cakeTopper.order_id) ?? []
      groups.set(cakeTopper.order_id, [...currentItems, cakeTopper])

      return groups
    },
    new Map()
  )

  const ordersInPeriod = data.orders
    .filter((order) => isActiveOrder(order) && isDateInRange(getOrderReferenceDate(order), range))
    .sort((firstOrder, secondOrder) =>
      getOrderReferenceDate(firstOrder).localeCompare(getOrderReferenceDate(secondOrder))
    )
  const ordersWithoutDate = data.orders.filter(
    (order) => isActiveOrder(order) && !getOrderReferenceDate(order)
  )

  ordersInPeriod.forEach((order) => orderIdsInPeriod.add(order.id))

  const periodSupplierOrders = data.supplierOrders.filter((supplierOrder) => {
    if (supplierOrder.status === 'cancelado') return false
    if (isDateInRange(supplierOrder.due_date, range)) return true

    return Boolean(
      supplierOrder.customer_order_id && orderIdsInPeriod.has(supplierOrder.customer_order_id)
    )
  })
  const supplierCosts = periodSupplierOrders.reduce(
    (sum, supplierOrder) => sum + getSupplierOrderCost(supplierOrder, orderItemById, recipeById),
    0
  )
  const supplierOrdersWithoutCost = periodSupplierOrders.some(
    (supplierOrder) => getSupplierOrderCost(supplierOrder, orderItemById, recipeById) <= 0
  )

  const realizedRevenue = data.transactions
    .filter(
      (transaction) =>
        transaction.type === 'entrada' && isDateInRange(transaction.transaction_date, range)
    )
    .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0)
  const realizedExpenses = data.transactions
    .filter(
      (transaction) =>
        transaction.type === 'saida' && isDateInRange(transaction.transaction_date, range)
    )
    .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0)
  const receivable = data.orders
    .filter((order) => {
      if (!isActiveOrder(order)) return false

      const receivableAmount = getOrderReceivable(order)

      return receivableAmount > 0 && isDateInRange(getReceivableReferenceDate(order), range)
    })
    .reduce((sum, order) => sum + getOrderReceivable(order), 0)
  const categories: CostCategories = {
    ingredients: 0,
    packaging: 0,
    suppliers: 0,
    toppers: 0,
    others: 0,
  }
  let revenue = 0
  let estimatedCost = 0
  let hasPartialEstimate = data.warnings.length > 0 || supplierOrdersWithoutCost

  const rows = ordersInPeriod.map<OrderReportRow>((order) => {
    const orderItems = itemsByOrderId.get(order.id) ?? []
    const costableItems = getCostableOrderItems(orderItems, recipeById)
    let orderCost = 0
    let orderIsPartial = false

    costableItems.forEach((item) => {
      const quantity = parseNumericValue(item.quantity)
      const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined

      if (!item.recipe_id || !recipe || quantity <= 0) {
        orderIsPartial = true
        return
      }

      if (recipe.is_third_party === true) {
        const linkedSupplierOrders = supplierOrdersByOrderItemId.get(item.id) ?? []
        const linkedSupplierCost = linkedSupplierOrders.reduce(
          (sum, supplierOrder) =>
            sum + getSupplierOrderCost(supplierOrder, orderItemById, recipeById),
          0
        )
        const fallbackSupplierCost = getSupplierCostFromRecipe(recipe, quantity)
        const supplierCost = linkedSupplierCost > 0 ? linkedSupplierCost : fallbackSupplierCost ?? 0

        if (supplierCost <= 0) orderIsPartial = true

        orderCost += supplierCost
        categories.suppliers += supplierCost
        return
      }

      const yieldAmount = parseNumericValue(recipe.yield_amount)
      const productionFactor = yieldAmount > 0 ? quantity / yieldAmount : quantity
      const ingredientLinks = recipeIngredientsByRecipeId.get(recipe.id) ?? []
      const packagingLinks = recipePackagingByRecipeId.get(recipe.id) ?? []

      if (ingredientLinks.length === 0 && packagingLinks.length === 0) {
        const fallbackCost =
          parseNumericValue(recipe.cost_per_unit) > 0
            ? parseNumericValue(recipe.cost_per_unit) * quantity
            : parseNumericValue(recipe.total_cost) * quantity

        if (fallbackCost > 0) {
          orderCost += fallbackCost
          categories.others += fallbackCost
        } else {
          orderIsPartial = true
        }

        return
      }

      ingredientLinks.forEach((recipeIngredient) => {
        const ingredient = ingredientById.get(recipeIngredient.ingredient_id)
        const recipeUnit =
          recipeIngredient.unit?.trim() || ingredient?.usage_unit?.trim() || 'unidade'
        const costUnit = ingredient?.usage_unit?.trim() || recipeUnit
        const neededQuantity = parseNumericValue(recipeIngredient.quantity) * productionFactor
        const quantityForCost =
          normalizeUnit(recipeUnit) === normalizeUnit(costUnit)
            ? neededQuantity
            : convertQuantity(neededQuantity, recipeUnit, costUnit) ?? neededQuantity
        const costPerUnit = parseNumericValue(ingredient?.cost_per_unit)
        const cost = quantityForCost * costPerUnit

        if (!ingredient || costPerUnit <= 0) orderIsPartial = true

        orderCost += cost
        categories.ingredients += cost
        addPurchaseForecastItem(purchasesByKey, {
          key: `ingredient:${recipeIngredient.ingredient_id}`,
          name: ingredient?.name || 'Ingrediente não encontrado',
          quantity: neededQuantity,
          unit: recipeUnit,
          estimatedCost: cost,
          origin: 'Ingrediente',
        })
      })

      packagingLinks.forEach((recipePackaging) => {
        const packaging = packagingById.get(recipePackaging.packaging_id)
        const unit = packaging?.unit?.trim() || 'unidade'
        const costPerUnit = parseNumericValue(packaging?.cost_per_unit)
        const capacity = parseNumericValue(packaging?.capacity)
        const neededQuantity =
          recipePackaging.usage_type === 'transporte'
            ? Math.ceil(quantity / (capacity > 0 ? capacity : 1))
            : quantity * parseNumericValue(recipePackaging.quantity_per_recipe_unit)
        const cost = neededQuantity * costPerUnit

        if (!packaging || costPerUnit <= 0) orderIsPartial = true

        orderCost += cost
        categories.packaging += cost
        addPurchaseForecastItem(purchasesByKey, {
          key: `packaging:${recipePackaging.packaging_id}`,
          name: packaging?.name || 'Embalagem não encontrada',
          quantity: neededQuantity,
          unit,
          estimatedCost: cost,
          origin: 'Embalagem',
        })
      })
    })

    const cakeTopperCost = (cakeToppersByOrderId.get(order.id) ?? []).reduce(
      (sum, cakeTopper) => sum + parseNumericValue(cakeTopper.cost),
      0
    )
    const topperSupplierCost =
      cakeTopperCost > 0
        ? 0
        : (supplierOrdersByOrderId.get(order.id) ?? [])
            .filter(
              (supplierOrder) =>
                !supplierOrder.order_item_id && normalizeText(supplierOrder.title).includes('topo')
            )
            .reduce(
              (sum, supplierOrder) =>
                sum + getSupplierOrderCost(supplierOrder, orderItemById, recipeById),
              0
            )
    const orderTopperCost = cakeTopperCost + topperSupplierCost

    orderCost += orderTopperCost
    categories.toppers += orderTopperCost

    const orderTotal = getOrderTotal(order)
    const orderReceivable = getOrderReceivable(order)

    revenue += orderTotal
    estimatedCost += orderCost
    hasPartialEstimate = hasPartialEstimate || orderIsPartial

    return {
      id: order.id,
      title: getOrderTitle(order, orderItems),
      customerName: getCustomerName(order, customersById),
      date: getOrderReferenceDate(order),
      total: orderTotal,
      cost: orderCost,
      profit: orderTotal - orderCost,
      receivable: orderReceivable,
      isPartial: orderIsPartial,
    }
  })

  if (ordersWithoutDate.length > 0) {
    warnings.push(
      `${ordersWithoutDate.length} pedido(s) sem data ficaram fora dos relatorios por periodo.`
    )
  }

  if (supplierOrdersWithoutCost) {
    warnings.push('Alguns pedidos de fornecedor nao tinham custo estimado cadastrado.')
  }

  if (hasPartialEstimate) {
    warnings.push('Alguns custos estão incompletos por falta de composição ou preço cadastrado.')
  }

  const purchases = Array.from(purchasesByKey.values()).sort((firstItem, secondItem) => {
    const originComparison = firstItem.origin.localeCompare(secondItem.origin, 'pt-BR')
    if (originComparison !== 0) return originComparison

    return firstItem.name.localeCompare(secondItem.name, 'pt-BR')
  })
  const purchaseForecast = purchases.reduce((sum, item) => sum + item.estimatedCost, 0)

  return {
    revenue,
    estimatedCost,
    estimatedProfit: revenue - estimatedCost,
    purchaseForecast,
    supplierCosts,
    receivable,
    realizedRevenue,
    realizedExpenses,
    realizedProfit: realizedRevenue - realizedExpenses,
    ordersWithoutDate: ordersWithoutDate.length,
    isPartial: hasPartialEstimate,
    rows,
    categories,
    purchases,
    warnings: Array.from(new Set(warnings)),
  }
}
function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as SupabaseErrorDetails
    return supabaseError.message || supabaseError.details || supabaseError.hint || fallback
  }

  return fallback
}

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'todos' | TransactionType>('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('week')
  const [customStartDate, setCustomStartDate] = useState(() => getCurrentWeekRange().start)
  const [customEndDate, setCustomEndDate] = useState(() => getCurrentWeekRange().end)
  const [reportData, setReportData] = useState<ReportData>(emptyReportData)
  const [isLoadingReports, setIsLoadingReports] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = useMemo(() => createClient(), [])
  const reportRange = useMemo(
    () => getReportRange(reportPeriod, customStartDate, customEndDate),
    [customEndDate, customStartDate, reportPeriod]
  )

  useEffect(() => {
    let isMounted = true

    async function loadTransactions() {
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

        const monthRange = getMonthRange(selectedMonth)
        const { data, error: transactionsError } = await supabase
          .from('financial_transactions')
          .select('id, type, description, amount, category, transaction_date, notes')
          .eq('user_id', user.id)
          .gte('transaction_date', monthRange.start)
          .lte('transaction_date', monthRange.end)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })

        if (transactionsError) {
          logSupabaseError(
            'Erro Supabase financial_transactions select:',
            transactionsError
          )
          throw transactionsError
        }

        if (isMounted) {
          setTransactions((data ?? []) as FinancialTransaction[])
        }
      } catch (err) {
        console.error('Erro ao carregar movimentações financeiras:', {
          message: getErrorMessage(err, 'Falha ao carregar movimentações financeiras'),
          fullError: err,
        })
        if (isMounted) {
          setError(getErrorMessage(err, 'Falha ao carregar movimentações financeiras'))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadTransactions()

    return () => {
      isMounted = false
    }
  }, [selectedMonth, supabase])

  useEffect(() => {
    let isMounted = true

    async function loadReports() {
      setIsLoadingReports(true)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuário não autenticado')
        }

        const warnings: string[] = []
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('delivery_date', { ascending: true })
          .order('created_at', { ascending: false })

        if (ordersError) {
          logSupabaseError('Erro Supabase orders select:', ordersError)
          throw ordersError
        }

        const orders = (ordersData ?? []) as Order[]
        const orderIds = orders.map((order) => order.id)
        const customerIds = uniqueIds(orders.map((order) => order.customer_id))

        const [
          orderItemsResult,
          customersResult,
          supplierOrdersResult,
          cakeToppersResult,
          reportTransactionsResult,
        ] = await Promise.all([
          orderIds.length > 0
            ? supabase
                .from('order_items')
                .select(
                  'id, order_id, recipe_id, parent_order_item_id, item_name, quantity, unit_price, subtotal, notes'
                )
                .eq('user_id', user.id)
                .in('order_id', orderIds)
            : Promise.resolve({ data: [] as OrderItem[], error: null }),
          customerIds.length > 0
            ? supabase
                .from('customers')
                .select('id, name, phone')
                .eq('user_id', user.id)
                .in('id', customerIds)
            : Promise.resolve({ data: [] as CustomerSummary[], error: null }),
          supabase.from('supplier_orders').select('*').eq('user_id', user.id),
          orderIds.length > 0
            ? supabase.from('order_cake_toppers').select('*').eq('user_id', user.id).in('order_id', orderIds)
            : Promise.resolve({ data: [] as OrderCakeTopper[], error: null }),
          supabase
            .from('financial_transactions')
            .select('id, type, description, amount, category, transaction_date, notes')
            .eq('user_id', user.id)
            .gte('transaction_date', reportRange.start)
            .lte('transaction_date', reportRange.end),
        ])

        let orderItems: OrderItem[] = []
        if (orderItemsResult.error) {
          logSupabaseError('Erro Supabase order_items select:', orderItemsResult.error)
          warnings.push('Itens dos pedidos nao puderam ser carregados.')
        } else {
          orderItems = (orderItemsResult.data ?? []) as OrderItem[]
        }

        let customers: CustomerSummary[] = []
        if (customersResult.error) {
          logSupabaseError('Erro Supabase customers select:', customersResult.error)
        } else {
          customers = (customersResult.data ?? []) as CustomerSummary[]
        }

        let supplierOrders: SupplierOrder[] = []
        if (supplierOrdersResult.error) {
          logSupabaseError('Erro Supabase supplier_orders select:', supplierOrdersResult.error)
          warnings.push('Pedidos de fornecedor nao puderam ser carregados.')
        } else {
          supplierOrders = (supplierOrdersResult.data ?? []) as SupplierOrder[]
        }

        let cakeToppers: OrderCakeTopper[] = []
        if (cakeToppersResult.error) {
          logSupabaseError('Erro Supabase order_cake_toppers select:', cakeToppersResult.error)
          warnings.push('Custos de topos nao puderam ser carregados.')
        } else {
          cakeToppers = (cakeToppersResult.data ?? []) as OrderCakeTopper[]
        }

        let reportTransactions: FinancialTransaction[] = []
        if (reportTransactionsResult.error) {
          logSupabaseError(
            'Erro Supabase financial_transactions report select:',
            reportTransactionsResult.error
          )
        } else {
          reportTransactions = (reportTransactionsResult.data ?? []) as FinancialTransaction[]
        }

        const recipeIds = uniqueIds(orderItems.map((item) => item.recipe_id))
        let recipes: Recipe[] = []

        if (recipeIds.length > 0) {
          const { data: recipesData, error: recipesError } = await supabase
            .from('recipes')
            .select('*')
            .in('id', recipeIds)

          if (recipesError) {
            logSupabaseError('Erro Supabase recipes select:', recipesError)
            warnings.push('Receitas dos pedidos nao puderam ser carregadas.')
          } else {
            recipes = (recipesData ?? []) as Recipe[]
          }
        }

        const internalRecipeIds = recipes
          .filter((recipe) => recipe.is_third_party !== true)
          .map((recipe) => recipe.id)

        let recipeIngredients: RecipeIngredient[] = []
        let recipePackaging: RecipePackaging[] = []

        if (internalRecipeIds.length > 0) {
          const [recipeIngredientsResult, recipePackagingResult] = await Promise.all([
            supabase
              .from('recipe_ingredients')
              .select('recipe_id, ingredient_id, quantity, unit')
              .in('recipe_id', internalRecipeIds),
            supabase
              .from('recipe_packaging')
              .select('recipe_id, packaging_id, quantity_per_recipe_unit, usage_type')
              .in('recipe_id', internalRecipeIds),
          ])

          if (recipeIngredientsResult.error) {
            logSupabaseError(
              'Erro Supabase recipe_ingredients select:',
              recipeIngredientsResult.error
            )
            warnings.push('Ingredientes das receitas nao puderam ser carregados.')
          } else {
            recipeIngredients = (recipeIngredientsResult.data ?? []) as RecipeIngredient[]
          }

          if (recipePackagingResult.error) {
            logSupabaseError('Erro Supabase recipe_packaging select:', recipePackagingResult.error)
            warnings.push('Embalagens das receitas nao puderam ser carregadas.')
          } else {
            recipePackaging = (recipePackagingResult.data ?? []) as RecipePackaging[]
          }
        }

        const ingredientIds = uniqueIds(
          recipeIngredients.map((recipeIngredient) => recipeIngredient.ingredient_id)
        )
        const packagingIds = uniqueIds(
          recipePackaging.map((recipePackagingItem) => recipePackagingItem.packaging_id)
        )
        const [ingredientsResult, packagingResult] = await Promise.all([
          ingredientIds.length > 0
            ? supabase.from('ingredients').select('*').eq('user_id', user.id).in('id', ingredientIds)
            : Promise.resolve({ data: [] as Ingredient[], error: null }),
          packagingIds.length > 0
            ? supabase.from('packaging').select('*').eq('user_id', user.id).in('id', packagingIds)
            : Promise.resolve({ data: [] as Packaging[], error: null }),
        ])

        let ingredients: Ingredient[] = []
        if (ingredientsResult.error) {
          logSupabaseError('Erro Supabase ingredients select:', ingredientsResult.error)
          warnings.push('Custos de ingredientes nao puderam ser carregados.')
        } else {
          ingredients = (ingredientsResult.data ?? []) as Ingredient[]
        }

        let packaging: Packaging[] = []
        if (packagingResult.error) {
          logSupabaseError('Erro Supabase packaging select:', packagingResult.error)
          warnings.push('Custos de embalagens nao puderam ser carregados.')
        } else {
          packaging = (packagingResult.data ?? []) as Packaging[]
        }

        if (isMounted) {
          setReportData({
            orders,
            orderItems,
            customers,
            recipes,
            recipeIngredients,
            ingredients,
            recipePackaging,
            packaging,
            supplierOrders,
            cakeToppers,
            transactions: reportTransactions,
            warnings,
          })
        }
      } catch (err) {
        console.error('Erro ao carregar relatorios financeiros:', {
          message: getErrorMessage(err, 'Falha ao carregar relatorios financeiros'),
          fullError: err,
        })

        if (isMounted) {
          setReportData({
            ...emptyReportData,
            warnings: [getErrorMessage(err, 'Falha ao carregar relatorios financeiros')],
          })
        }
      } finally {
        if (isMounted) {
          setIsLoadingReports(false)
        }
      }
    }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [reportRange.end, reportRange.start, supabase])

  const categoryOptions = useMemo(() => {
    const categories = new Set(defaultCategories)

    transactions.forEach((transaction) => {
      if (transaction.category) {
        categories.add(transaction.category)
      }
    })

    return Array.from(categories).sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory, 'pt-BR')
    )
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return transactions.filter((transaction) => {
      const matchesSearch = query
        ? transaction.description.toLowerCase().includes(query)
        : true
      const matchesType = typeFilter === 'todos' ? true : transaction.type === typeFilter
      const matchesCategory =
        categoryFilter === 'todas' ? true : transaction.category === categoryFilter

      return matchesSearch && matchesType && matchesCategory
    })
  }, [categoryFilter, searchQuery, transactions, typeFilter])

  const { paged: pagedTransactions, totalPages: transactionPages } = paginate(filteredTransactions, currentPage)

  const summary = useMemo(() => {
    const entradas = transactions
      .filter((transaction) => transaction.type === 'entrada')
      .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0)
    const saidas = transactions
      .filter((transaction) => transaction.type === 'saida')
      .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0)
    const saldo = entradas - saidas

    return {
      entradas,
      saidas,
      saldo,
      resultado: saldo,
    }
  }, [transactions])

  const summaryCards = [
    {
      label: 'Entradas do mês',
      value: summary.entradas,
      icon: ArrowUpCircle,
      color: '#17803D',
    },
    {
      label: 'Saídas do mês',
      value: summary.saidas,
      icon: ArrowDownCircle,
      color: '#C0392B',
    },
    {
      label: 'Saldo do mês',
      value: summary.saldo,
      icon: Wallet,
      color: summary.saldo >= 0 ? '#17803D' : '#C0392B',
    },
    {
      label: 'Resultado do mes',
      value: summary.resultado,
      icon: TrendingUp,
      color: summary.resultado >= 0 ? '#C9A84C' : '#C0392B',
    },
  ]

  const reportSummary = useMemo(
    () => buildFinancialReport(reportData, reportRange),
    [reportData, reportRange]
  )

  const reportCards = [
    {
      label: 'Pedidos do periodo',
      value: reportSummary.revenue,
      realizedLabel: `${formatNumber(reportSummary.rows.length)} pedido(s) por entrega`,
      realized: null,
      difference: null,
      icon: ReceiptText,
      color: '#17803D',
    },
    {
      label: 'Recebido no periodo',
      value: reportSummary.realizedRevenue,
      realizedLabel: 'Entradas registradas no financeiro',
      realized: null,
      difference: null,
      icon: ArrowUpCircle,
      color: '#17803D',
    },
    {
      label: 'Custo estimado dos pedidos',
      value: reportSummary.estimatedCost,
      realizedLabel: 'Realizado em saidas',
      realized: reportSummary.realizedExpenses,
      difference: reportSummary.estimatedCost - reportSummary.realizedExpenses,
      icon: ArrowDownCircle,
      color: '#C0392B',
    },
    {
      label: 'Lucro estimado dos pedidos',
      value: reportSummary.estimatedProfit,
      realizedLabel: 'Baseado nos pedidos do periodo',
      realized: null,
      difference: null,
      icon: TrendingUp,
      color: reportSummary.estimatedProfit >= 0 ? '#C9A84C' : '#C0392B',
    },
    {
      label: 'Compras previstas',
      value: reportSummary.purchaseForecast,
      realizedLabel: 'Ingredientes e embalagens',
      realized: null,
      difference: null,
      icon: PackageCheck,
      color: '#C9A84C',
    },
    {
      label: 'Custos com fornecedores',
      value: reportSummary.supplierCosts,
      realizedLabel: 'Supplier orders do periodo',
      realized: null,
      difference: null,
      icon: ReceiptText,
      color: '#8E5A2A',
    },
    {
      label: 'Valores a receber',
      value: reportSummary.receivable,
      realizedLabel: 'Restantes com vencimento no periodo',
      realized: null,
      difference: null,
      icon: Wallet,
      color: '#17803D',
    },
  ]

  const costCategoryRows = [
    { label: 'Ingredientes', value: reportSummary.categories.ingredients },
    { label: 'Embalagens', value: reportSummary.categories.packaging },
    { label: 'Fornecedores terceirizados', value: reportSummary.categories.suppliers },
    { label: 'Extras/topos', value: reportSummary.categories.toppers },
    { label: 'Outros', value: reportSummary.categories.others },
  ]

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              GESTÃO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Financeiro</h1>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/financeiro/nova-entrada"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#17803D] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#11622F]"
            >
              <Plus size={19} aria-hidden="true" />
              <span>Nova entrada</span>
            </Link>
            <Link
              href="/financeiro/nova-saida"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
            >
              <Plus size={19} aria-hidden="true" />
              <span>Nova saída</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon

            return (
              <div
                key={card.label}
                className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#999999]">{card.label}</p>
                  <Icon size={22} style={{ color: card.color }} aria-hidden="true" />
                </div>
                <p className="text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(card.value)}
                </p>
              </div>
            )
          })}
        </div>

        <section className="mb-6 space-y-4">
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                  PREVISOES
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1A0A08]">
                  Relatorios e previsoes
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-[#6F625F]">
                  Os valores sao estimativas baseadas nos custos cadastrados. Pedidos do periodo
                  usam a data de entrega. Recebidos usam a data de entrada/recebimento.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#1A0A08]" htmlFor="report-period">
                    Periodo
                  </label>
                  <select
                    id="report-period"
                    value={reportPeriod}
                    onChange={(event) => setReportPeriod(event.target.value as ReportPeriod)}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  >
                    <option value="week">Semana atual</option>
                    <option value="month">Mes atual</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>

                {reportPeriod === 'custom' && (
                  <>
                    <div>
                      <label
                        className="mb-2 block text-xs font-semibold text-[#1A0A08]"
                        htmlFor="report-start"
                      >
                        Data inicial
                      </label>
                      <input
                        id="report-start"
                        type="date"
                        value={customStartDate}
                        onChange={(event) => setCustomStartDate(event.target.value)}
                        className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                      />
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-xs font-semibold text-[#1A0A08]"
                        htmlFor="report-end"
                      >
                        Data final
                      </label>
                      <input
                        id="report-end"
                        type="date"
                        value={customEndDate}
                        onChange={(event) => setCustomEndDate(event.target.value)}
                        className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {isLoadingReports ? (
            <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white py-10 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
              <p className="mt-3 text-sm text-[#999999]">Calculando previsoes...</p>
            </div>
          ) : (
            <>
              {reportSummary.warnings.length > 0 && (
                <div className="rounded-[16px] border border-[#F3D3C9] bg-[#FFF8F5] p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={18}
                      className="mt-0.5 shrink-0 text-[#C0392B]"
                      aria-hidden="true"
                    />
                    <div className="space-y-1 text-sm text-[#6F625F]">
                      {reportSummary.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reportCards.map((card) => {
                  const Icon = card.icon

                  return (
                    <div
                      key={card.label}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#999999]">{card.label}</p>
                        <Icon size={22} style={{ color: card.color }} aria-hidden="true" />
                      </div>
                      <p className="text-2xl font-bold text-[#1A0A08]">
                        {formatCurrency(card.value)}
                      </p>
                      <div className="mt-3 space-y-1 text-xs font-semibold text-[#999999]">
                        {card.realized !== null ? (
                          <>
                            <p>
                              {card.realizedLabel}: {formatCurrency(card.realized)}
                            </p>
                            <p>
                              Diferenca: {formatCurrency(card.difference ?? 0)}
                            </p>
                          </>
                        ) : (
                          <p>{card.realizedLabel}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#1A0A08]">
                        Relatorio por pedidos
                      </h3>
                      <p className="text-sm text-[#999999]">
                        {formatDate(reportRange.start)} a {formatDate(reportRange.end)}
                      </p>
                    </div>
                    {reportSummary.isPartial && (
                      <span className="rounded-full bg-[#FFF8F5] px-2.5 py-1 text-xs font-bold text-[#C0392B]">
                        Estimativa parcial
                      </span>
                    )}
                  </div>

                  {reportSummary.rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-8 text-center">
                      <p className="font-semibold text-[#1A0A08]">
                        Nenhum pedido no periodo
                      </p>
                      <p className="mt-1 text-sm text-[#999999]">
                        Ajuste o periodo para ver previsoes por pedido.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[rgba(26,10,8,0.07)] text-xs uppercase tracking-wide text-[#999999]">
                            <th className="py-3 pr-3 font-bold">Pedido/cliente</th>
                            <th className="px-3 py-3 font-bold">Data</th>
                            <th className="px-3 py-3 text-right font-bold">Total</th>
                            <th className="px-3 py-3 text-right font-bold">Custo</th>
                            <th className="px-3 py-3 text-right font-bold">Lucro</th>
                            <th className="py-3 pl-3 text-right font-bold">A receber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportSummary.rows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-[rgba(26,10,8,0.07)] last:border-b-0"
                            >
                              <td className="py-3 pr-3">
                                <p className="font-bold text-[#1A0A08]">{row.title}</p>
                                <p className="text-xs text-[#999999]">{row.customerName}</p>
                              </td>
                              <td className="px-3 py-3 text-[#6F625F]">
                                {formatDate(row.date)}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-[#1A0A08]">
                                {formatCurrency(row.total)}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-[#1A0A08]">
                                {formatCurrency(row.cost)}
                                {row.isPartial && (
                                  <span className="ml-1 text-xs text-[#C0392B]">*</span>
                                )}
                              </td>
                              <td
                                className={`px-3 py-3 text-right font-semibold ${
                                  row.profit >= 0 ? 'text-[#17803D]' : 'text-[#C0392B]'
                                }`}
                              >
                                {formatCurrency(row.profit)}
                              </td>
                              <td className="py-3 pl-3 text-right font-semibold text-[#1A0A08]">
                                {formatCurrency(row.receivable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
                  <h3 className="mb-4 text-base font-bold text-[#1A0A08]">
                    Custos por categoria
                  </h3>
                  <div className="space-y-3">
                    {costCategoryRows.map((category) => (
                      <div
                        key={category.label}
                        className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF6F0] px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-[#6F625F]">
                          {category.label}
                        </p>
                        <p className="font-bold text-[#1A0A08]">
                          {formatCurrency(category.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
                <h3 className="mb-4 text-base font-bold text-[#1A0A08]">
                  Compras previstas
                </h3>
                {reportSummary.purchases.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-8 text-center">
                    <p className="font-semibold text-[#1A0A08]">
                      Nenhuma compra prevista calculada
                    </p>
                    <p className="mt-1 text-sm text-[#999999]">
                      Produtos terceirizados entram em fornecedores, nao na lista de ingredientes.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[rgba(26,10,8,0.07)] text-xs uppercase tracking-wide text-[#999999]">
                          <th className="py-3 pr-3 font-bold">Item</th>
                          <th className="px-3 py-3 text-right font-bold">Quantidade</th>
                          <th className="px-3 py-3 font-bold">Unidade</th>
                          <th className="px-3 py-3 text-right font-bold">Custo estimado</th>
                          <th className="py-3 pl-3 font-bold">Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportSummary.purchases.map((item) => (
                          <tr
                            key={`${item.key}-${item.unit}`}
                            className="border-b border-[rgba(26,10,8,0.07)] last:border-b-0"
                          >
                            <td className="py-3 pr-3 font-bold text-[#1A0A08]">{item.name}</td>
                            <td className="px-3 py-3 text-right font-semibold text-[#1A0A08]">
                              {formatNumber(item.quantity)}
                            </td>
                            <td className="px-3 py-3 text-[#6F625F]">{item.unit}</td>
                            <td className="px-3 py-3 text-right font-semibold text-[#1A0A08]">
                              {formatCurrency(item.estimatedCost)}
                            </td>
                            <td className="py-3 pl-3 text-[#6F625F]">{item.origin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </section>

        <section className="mb-6 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px_180px_160px]">
            <div>
              <label className="sr-only" htmlFor="financial-search">
                Buscar por descrição
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={20}
                  aria-hidden="true"
                />
                <input
                  id="financial-search"
                  type="search"
                  placeholder="Buscar por descrição..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="type-filter">
                Tipo
              </label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as 'todos' | TransactionType)
                  setCurrentPage(1)
                }}
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="todos">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            <div>
              <label className="sr-only" htmlFor="category-filter">
                Categoria
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="todas">Todas categorias</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="sr-only" htmlFor="month-filter">
                Mês
              </label>
              <div className="relative">
                <CalendarDays
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={18}
                  aria-hidden="true"
                />
                <input
                  id="month-filter"
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonth())}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando movimentações...</p>
          </div>
        ) : pagedTransactions.length === 0 && filteredTransactions.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <PiggyBank className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              Nenhuma movimentação encontrada
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              Registre entradas e saídas para acompanhar o mês.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:inline-grid sm:grid-cols-2">
              <Link
                href="/financeiro/nova-entrada"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#17803D] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#11622F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova entrada</span>
              </Link>
              <Link
                href="/financeiro/nova-saida"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova saída</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
          <div className="space-y-3">
            {pagedTransactions.map((transaction) => {
              const isEntry = transaction.type === 'entrada'
              const color = isEntry ? '#17803D' : '#C0392B'
              const Icon = isEntry ? ArrowUpCircle : ArrowDownCircle

              return (
                <article
                  key={transaction.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0]"
                        style={{ color }}
                      >
                        <Icon size={21} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words text-base font-bold text-[#1A0A08]">
                          {transaction.description}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
                            style={{ backgroundColor: color }}
                          >
                            {isEntry ? 'Entrada' : 'Saída'}
                          </span>
                          <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#1A0A08]">
                            {transaction.category || 'Sem categoria'}
                          </span>
                          <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#999999]">
                            {formatDate(transaction.transaction_date)}
                          </span>
                        </div>
                        {transaction.notes && (
                          <p className="mt-3 break-words text-sm text-[#1A0A08]">
                            {transaction.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 sm:text-right">
                      <p className="text-xs font-medium text-[#999999]">Valor</p>
                      <p className="mt-1 text-xl font-bold" style={{ color }}>
                        {isEntry ? '+' : '-'} {formatCurrency(getTransactionAmount(transaction))}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination currentPage={currentPage} totalPages={transactionPages} onPageChange={setCurrentPage} />
          </>
        )}
      </main>
    </div>
  )
}
