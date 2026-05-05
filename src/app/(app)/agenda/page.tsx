'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  ImageIcon,
  MapPin,
  PackageCheck,
  Pencil,
  Truck,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, parseNumericValue, type NumericValue } from '@/lib/format'

type StatusFilter =
  | 'todos'
  | 'pendentes'
  | 'confirmado'
  | 'em_producao'
  | 'pronto'
  | 'entregue'
  | 'cancelado'

type QuickStatus = 'em_producao' | 'pronto' | 'entregue'
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

type SupabaseErrorDetails = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type Order = {
  id: string
  user_id: string
  customer_id: string | null
  order_date: string | null
  delivery_date: string | null
  delivery_time: string | null
  status: string | null
  payment_status: string | null
  total_value: NumericValue
  deposit_value: NumericValue
  delivery_address: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
  fulfillment_type: string | null
  delivery_fee: NumericValue
  down_payment: NumericValue
  remaining_amount: NumericValue
  remaining_payment_date: string | null
  discount_amount: NumericValue
  manual_total: NumericValue
  extras_total: NumericValue
  is_recurring: boolean | null
  recurrence_type: string | null
  recurrence_count: number | null
  first_occurrence_date: string | null
}

type OrderItem = {
  id: string
  order_id: string
  recipe_id: string | null
  parent_order_item_id: string | null
  item_name: string | null
  quantity: NumericValue
  unit_price: NumericValue
  subtotal: NumericValue
  flavor_details: JsonValue | null
  notes: string | null
  created_at: string | null
}

type Recipe = {
  id: string
  user_id: string
  name: string | null
  category: string | null
  product_type: string | null
  is_third_party: boolean | null
  supplier_id: string | null
  total_cost: NumericValue
  cost_per_unit: NumericValue
  supplier_cost: NumericValue
  supplier_cost_unit: string | null
  yield_amount: NumericValue
}

type Customer = {
  id: string
  user_id: string
  name: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
}

type Supplier = {
  id: string
  name: string
}

type SupplierOrder = {
  id: string
  user_id: string
  supplier_id: string | null
  customer_order_id: string | null
  order_item_id: string | null
  title: string
  quantity: NumericValue
  unit: string | null
  estimated_cost: NumericValue
  due_date: string | null
  status: string | null
  details: JsonValue | null
  notes: string | null
  created_at: string | null
}

type OrderCakeTopper = {
  id: string
  user_id: string
  order_id: string
  supplier_id: string | null
  child_name: string | null
  age: string | null
  theme: string | null
  photo_url: string | null
  cost: NumericValue
  charged_amount: NumericValue
  notes: string | null
  created_at: string | null
}

type FlavorDetail = {
  name: string
  quantity: NumericValue
}

type CakeTopperDetails = {
  childName: string | null
  age: string | null
  theme: string | null
  photoUrl: string | null
  cost: NumericValue
}

type CakeTopperView = CakeTopperDetails & {
  id: string
  title: string
  supplierName: string | null
  notes: string | null
  source: string
}

type CostEstimate = {
  cost: number
  isPartial: boolean
}

const statusFilterOptions: {
  id: StatusFilter
  label: string
  badgeLabel: string
  statuses: string[]
  color: string
  bg: string
}[] = [
  {
    id: 'todos',
    label: 'Todos',
    badgeLabel: 'Todos',
    statuses: [],
    color: '#1A0A08',
    bg: '#FAF6F0',
  },
  {
    id: 'pendentes',
    label: 'Pendentes',
    badgeLabel: 'Pendente',
    statuses: ['novo', 'pendente'],
    color: '#9A7320',
    bg: '#FFF6D8',
  },
  {
    id: 'confirmado',
    label: 'Confirmados',
    badgeLabel: 'Confirmado',
    statuses: ['confirmado'],
    color: '#2F6F9F',
    bg: '#EAF4FF',
  },
  {
    id: 'em_producao',
    label: 'Em produção',
    badgeLabel: 'Em produção',
    statuses: ['em_producao', 'em produção'],
    color: '#B86E00',
    bg: '#FFF1D6',
  },
  {
    id: 'pronto',
    label: 'Prontos',
    badgeLabel: 'Pronto',
    statuses: ['pronto'],
    color: '#17803D',
    bg: '#EAF8EF',
  },
  {
    id: 'entregue',
    label: 'Entregues',
    badgeLabel: 'Entregue',
    statuses: ['entregue'],
    color: '#6F625F',
    bg: '#F1ECE7',
  },
  {
    id: 'cancelado',
    label: 'Cancelados',
    badgeLabel: 'Cancelado',
    statuses: ['cancelado'],
    color: '#C0392B',
    bg: '#FDECEA',
  },
]

const quickStatusOptions: { id: QuickStatus; label: string }[] = [
  { id: 'em_producao', label: 'Marcar em produção' },
  { id: 'pronto', label: 'Marcar pronto' },
  { id: 'entregue', label: 'Marcar entregue' },
]

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function getSupabaseErrorDetails(error: unknown): SupabaseErrorDetails {
  if (typeof error === 'object' && error !== null) {
    return error as SupabaseErrorDetails
  }

  return {}
}

function logAgendaError(error: unknown) {
  const supabaseError = getSupabaseErrorDetails(error)

  console.error('Erro ao carregar agenda de produção:', {
    message: supabaseError?.message,
    details: supabaseError?.details,
    hint: supabaseError?.hint,
    code: supabaseError?.code,
    fullError: error,
    stringified: JSON.stringify(error, null, 2),
  })
}

function getErrorMessage(error: unknown, fallback: string) {
  const supabaseError = getSupabaseErrorDetails(error)

  if (supabaseError.message) return supabaseError.message
  if (supabaseError.details) return supabaseError.details
  if (supabaseError.hint) return supabaseError.hint
  if (error instanceof Error && error.message) return error.message

  return fallback
}

function isMissingOptionalTableError(error: unknown) {
  const supabaseError = getSupabaseErrorDetails(error)
  const message = supabaseError.message?.toLowerCase() ?? ''

  return (
    supabaseError.code === '42P01' ||
    supabaseError.code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseInputDate(date: string) {
  return new Date(`${date}T00:00:00`)
}

function getTodayDate() {
  return formatInputDate(new Date())
}

function getMonthValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function getMonthFromDateValue(dateValue: string) {
  return dateValue.slice(0, 7)
}

function addMonths(monthValue: string, amount: number) {
  const [year, month] = monthValue.split('-').map(Number)
  const nextDate = new Date(year, month - 1 + amount, 1)

  return getMonthValue(nextDate)
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return 'Sem data'

  const [year, month, day] = dateValue.split('-').map(Number)

  if (!year || !month || !day) return dateValue

  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function formatLongDate(dateValue: string) {
  const date = parseInputDate(dateValue)
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)

  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatDate(dateValue)}`
}

function formatTime(timeValue: string | null | undefined) {
  return timeValue?.trim() ? timeValue.slice(0, 5) : 'Sem horário'
}

function getPrimaryOrderDate(order: Order) {
  return order.delivery_date ?? order.order_date
}

function compareOrdersByTime(firstOrder: Order, secondOrder: Order) {
  const firstTime = firstOrder.delivery_time?.trim() || '99:99'
  const secondTime = secondOrder.delivery_time?.trim() || '99:99'

  if (firstTime !== secondTime) return firstTime.localeCompare(secondTime)

  return firstOrder.created_at.localeCompare(secondOrder.created_at)
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getStatusMeta(status: string | null | undefined) {
  const normalizedStatus = normalizeText(status)

  return statusFilterOptions.find((option) =>
    option.statuses.some((statusValue) => normalizeText(statusValue) === normalizedStatus)
  )
}

function getStatusLabel(status: string | null | undefined) {
  const statusMeta = getStatusMeta(status)

  if (statusMeta) return statusMeta.badgeLabel
  if (!status) return 'Sem status'

  return status
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function matchesStatusFilter(order: Order, statusFilter: StatusFilter) {
  if (statusFilter === 'todos') return true

  const option = statusFilterOptions.find((statusOption) => statusOption.id === statusFilter)
  if (!option) return true
  if (!order.status && statusFilter === 'pendentes') return true

  const normalizedStatus = normalizeText(order.status)

  return option.statuses.some((statusValue) => normalizeText(statusValue) === normalizedStatus)
}

function getCustomerName(order: Order, customerById: Map<string, Customer>) {
  if (!order.customer_id) return 'Cliente não informado'

  return customerById.get(order.customer_id)?.name?.trim() || 'Cliente não informado'
}

function getOrderTotal(order: Order) {
  return parseNumericValue(order.total_value ?? 0)
}

function getOrderDeposit(order: Order) {
  return parseNumericValue(order.down_payment ?? order.deposit_value ?? 0)
}

function getOrderRemaining(order: Order) {
  const total = getOrderTotal(order)
  const deposit = getOrderDeposit(order)

  if (order.remaining_amount !== null && order.remaining_amount !== undefined) {
    return parseNumericValue(order.remaining_amount)
  }

  return Math.max(total - deposit, 0)
}

function getItemName(item: OrderItem, recipeById: Map<string, Recipe>) {
  const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
  const name = recipe?.name?.trim() || item.item_name?.trim()

  return name || 'Item sem nome'
}

function isRecord(value: JsonValue | null): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFlavorDetails(details: JsonValue | null): FlavorDetail[] {
  const flavorValue = isRecord(details) ? details.flavor_details : details

  if (!Array.isArray(flavorValue)) return []

  return flavorValue
    .map((flavor): FlavorDetail | null => {
      if (!isRecord(flavor)) return null

      const name = typeof flavor.name === 'string' ? flavor.name.trim() : ''
      const quantity =
        typeof flavor.quantity === 'number' || typeof flavor.quantity === 'string'
          ? flavor.quantity
          : null

      if (!name && quantity == null) return null

      return { name, quantity }
    })
    .filter((flavor): flavor is FlavorDetail => flavor !== null)
}

function getFlavorText(item: OrderItem) {
  const flavors = readFlavorDetails(item.flavor_details)

  return flavors.map((flavor) => {
    const quantity = parseNumericValue(flavor.quantity)

    if (quantity > 0) {
      return `${flavor.name || 'Sabor não informado'} (${formatNumber(quantity)})`
    }

    return flavor.name || 'Sabor não informado'
  })
}

function getOrderSummary(
  order: Order,
  itemsByOrderId: Map<string, OrderItem[]>,
  recipeById: Map<string, Recipe>
) {
  const items = itemsByOrderId.get(order.id) ?? []
  const mainItems = items.filter((item) => !item.parent_order_item_id)
  const summaryItems = mainItems.length > 0 ? mainItems : items

  if (summaryItems.length === 0) return 'Pedido sem itens'

  const summary = summaryItems
    .slice(0, 2)
    .map((item) => `${formatNumber(item.quantity)}x ${getItemName(item, recipeById)}`)
    .join(' + ')

  return summaryItems.length > 2 ? `${summary} + ${summaryItems.length - 2}` : summary
}

function getChildrenByParentId(items: OrderItem[]) {
  return items.reduce<Map<string, OrderItem[]>>((groups, item) => {
    if (!item.parent_order_item_id) return groups

    const currentItems = groups.get(item.parent_order_item_id) ?? []
    groups.set(item.parent_order_item_id, [...currentItems, item])

    return groups
  }, new Map())
}

function getProductionSourceItems(items: OrderItem[]) {
  const childrenByParentId = getChildrenByParentId(items)

  return items.filter((item) => {
    if (item.parent_order_item_id) return true

    return (childrenByParentId.get(item.id) ?? []).length === 0
  })
}

function getCostableOrderItems(items: OrderItem[]) {
  const childrenByParentId = getChildrenByParentId(items)
  const mainItems = items.filter((item) => !item.parent_order_item_id)

  if (mainItems.length === 0) return items

  return mainItems.flatMap((item) => {
    const children = childrenByParentId.get(item.id) ?? []

    return children.length > 0 ? children : [item]
  })
}

function hasDetailKey(record: Record<string, JsonValue>, keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key))
}

function readStringDetail(record: Record<string, JsonValue>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function readCakeTopperDetails(order: SupplierOrder): CakeTopperDetails | null {
  const details = isRecord(order.details) ? order.details : null
  const title = order.title.trim().toLowerCase()
  const hasCakeTopperTitle = title.includes('topo')
  const hasCakeTopperKey = details
    ? hasDetailKey(details, [
        'nome',
        'name',
        'child_name',
        'idade',
        'age',
        'tema',
        'theme',
        'foto_url',
        'photo_url',
      ])
    : false

  if (!hasCakeTopperTitle && !hasCakeTopperKey) return null

  return {
    childName: details ? readStringDetail(details, ['nome', 'name', 'child_name']) : null,
    age: details ? readStringDetail(details, ['idade', 'age']) : null,
    theme: details ? readStringDetail(details, ['tema', 'theme']) : null,
    photoUrl: details ? readStringDetail(details, ['foto_url', 'photo_url']) : null,
    cost: order.estimated_cost,
  }
}

function buildCakeTopperTitle(topper: {
  childName: string | null
  age: string | null
  theme: string | null
}) {
  const details = [topper.childName, topper.age ? `${topper.age} anos` : null, topper.theme]
    .filter((detail): detail is string => Boolean(detail?.trim()))
    .join(' - ')

  return details ? `Topo - ${details}` : 'Topo personalizado'
}

function getCakeTopperDedupeKey(topper: CakeTopperView) {
  return [
    topper.supplierName ?? 'sem-fornecedor',
    topper.childName ?? '',
    topper.age ?? '',
    topper.theme ?? '',
    topper.photoUrl ?? '',
    topper.source,
  ].join('::')
}

function getSupplierCostFromRecipe(recipe: Recipe | undefined, quantity: number) {
  if (!recipe) return null

  const supplierCost = parseNumericValue(recipe.supplier_cost)
  const supplierCostUnit = normalizeText(recipe.supplier_cost_unit)

  if (supplierCost <= 0) return null
  if (supplierCostUnit === 'pedido') return supplierCost

  return supplierCost * quantity
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

function getRecipeProductionCost(recipe: Recipe | undefined, quantity: number) {
  if (!recipe) return null

  const costPerUnit = parseNumericValue(recipe.cost_per_unit)
  if (costPerUnit > 0) return costPerUnit * quantity

  const totalCost = parseNumericValue(recipe.total_cost)
  if (totalCost <= 0) return null

  const yieldAmount = parseNumericValue(recipe.yield_amount)

  return yieldAmount > 0 ? totalCost * (quantity / yieldAmount) : totalCost * quantity
}

function calculateOrderCost(
  items: OrderItem[],
  recipeById: Map<string, Recipe>,
  supplierOrders: SupplierOrder[],
  supplierOrdersByOrderItemId: Map<string, SupplierOrder[]>,
  orderItemById: Map<string, OrderItem>,
  cakeTopperViews: CakeTopperView[]
): CostEstimate {
  const costableItems = getCostableOrderItems(items)
  const supplierOrderIdsUsedByItems = new Set<string>()
  let cost = 0
  let isPartial = false

  costableItems.forEach((item) => {
    const quantity = parseNumericValue(item.quantity)
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    const linkedSupplierOrders = supplierOrdersByOrderItemId.get(item.id) ?? []
    const activeLinkedSupplierOrders = linkedSupplierOrders.filter(
      (supplierOrder) => supplierOrder.status !== 'cancelado'
    )

    activeLinkedSupplierOrders.forEach((supplierOrder) =>
      supplierOrderIdsUsedByItems.add(supplierOrder.id)
    )

    if (recipe?.is_third_party === true || activeLinkedSupplierOrders.length > 0) {
      const linkedCost = activeLinkedSupplierOrders.reduce(
        (sum, supplierOrder) => sum + getSupplierOrderCost(supplierOrder, orderItemById, recipeById),
        0
      )
      const fallbackSupplierCost = getSupplierCostFromRecipe(recipe, quantity)
      const supplierCost = linkedCost > 0 ? linkedCost : fallbackSupplierCost ?? 0

      if (supplierCost <= 0) isPartial = true
      cost += supplierCost
      return
    }

    const productionCost = getRecipeProductionCost(recipe, quantity)

    if (productionCost === null || productionCost <= 0) {
      isPartial = true
      return
    }

    cost += productionCost
  })

  supplierOrders
    .filter((supplierOrder) => supplierOrder.status !== 'cancelado')
    .filter((supplierOrder) => !supplierOrderIdsUsedByItems.has(supplierOrder.id))
    .filter((supplierOrder) => !readCakeTopperDetails(supplierOrder))
    .forEach((supplierOrder) => {
      const supplierCost = getSupplierOrderCost(supplierOrder, orderItemById, recipeById)

      if (supplierCost <= 0) isPartial = true
      cost += supplierCost
    })

  cakeTopperViews.forEach((topper) => {
    const topperCost = parseNumericValue(topper.cost)

    if (topperCost <= 0) {
      isPartial = true
      return
    }

    cost += topperCost
  })

  return { cost, isPartial }
}

function buildCakeTopperViews(
  cakeToppers: OrderCakeTopper[],
  supplierOrders: SupplierOrder[],
  supplierById: Map<string, Supplier>
) {
  const views = new Map<string, CakeTopperView>()

  cakeToppers.forEach((topper) => {
    const view: CakeTopperView = {
      id: `cake-topper:${topper.id}`,
      title: buildCakeTopperTitle({
        childName: topper.child_name,
        age: topper.age,
        theme: topper.theme,
      }),
      childName: topper.child_name,
      age: topper.age,
      theme: topper.theme,
      photoUrl: topper.photo_url,
      cost: topper.cost,
      notes: topper.notes,
      supplierName: topper.supplier_id
        ? supplierById.get(topper.supplier_id)?.name ?? 'Fornecedor não informado'
        : null,
      source: 'Topo do pedido',
    }

    views.set(getCakeTopperDedupeKey(view), view)
  })

  supplierOrders.forEach((supplierOrder) => {
    const details = readCakeTopperDetails(supplierOrder)
    if (!details) return

    const view: CakeTopperView = {
      id: `supplier-topper:${supplierOrder.id}`,
      title: buildCakeTopperTitle(details),
      childName: details.childName,
      age: details.age,
      theme: details.theme,
      photoUrl: details.photoUrl,
      cost: details.cost,
      notes: supplierOrder.notes,
      supplierName: supplierOrder.supplier_id
        ? supplierById.get(supplierOrder.supplier_id)?.name ?? 'Fornecedor não informado'
        : null,
      source: 'Pedido ao fornecedor',
    }

    views.set(getCakeTopperDedupeKey(view), view)
  })

  return Array.from(views.values())
}

export default function AgendaPage() {
  const today = useMemo(() => getTodayDate(), [])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([])
  const [cakeToppers, setCakeToppers] = useState<OrderCakeTopper[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [selectedDate, setSelectedDate] = useState(today)
  const [currentMonth, setCurrentMonth] = useState(() => getMonthFromDateValue(today))
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const loadAgendaData = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Usuária não autenticada')

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(
          `
            id,
            user_id,
            customer_id,
            order_date,
            delivery_date,
            delivery_time,
            status,
            payment_status,
            total_value,
            deposit_value,
            delivery_address,
            notes,
            created_at,
            updated_at,
            fulfillment_type,
            delivery_fee,
            down_payment,
            remaining_amount,
            remaining_payment_date,
            discount_amount,
            manual_total,
            extras_total,
            is_recurring,
            recurrence_type,
            recurrence_count,
            first_occurrence_date
          `
        )
        .eq('user_id', user.id)
        .order('delivery_date', { ascending: true, nullsFirst: false })
        .order('order_date', { ascending: true, nullsFirst: false })
        .order('delivery_time', { ascending: true, nullsFirst: false })

      if (ordersError) throw ordersError

      const loadedOrders = (ordersData ?? []) as Order[]
      const orderIds = loadedOrders.map((order) => order.id)
      const customerIds = Array.from(
        new Set(
          loadedOrders
            .map((order) => order.customer_id)
            .filter((customerId): customerId is string => Boolean(customerId))
        )
      )

      let loadedCustomers: Customer[] = []
      if (customerIds.length > 0) {
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, user_id, name, phone, whatsapp, email')
          .eq('user_id', user.id)
          .in('id', customerIds)

        if (customersError) throw customersError
        loadedCustomers = (customersData ?? []) as Customer[]
      }

      let loadedOrderItems: OrderItem[] = []
      if (orderIds.length > 0) {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from('order_items')
          .select(
            'id, order_id, recipe_id, parent_order_item_id, item_name, quantity, unit_price, subtotal, flavor_details, notes, created_at'
          )
          .eq('user_id', user.id)
          .in('order_id', orderIds)

        if (orderItemsError) throw orderItemsError
        loadedOrderItems = (orderItemsData ?? []) as OrderItem[]
      }

      const recipeIds = Array.from(
        new Set(
          loadedOrderItems
            .map((item) => item.recipe_id)
            .filter((recipeId): recipeId is string => Boolean(recipeId))
        )
      )

      let loadedRecipes: Recipe[] = []
      if (recipeIds.length > 0) {
        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select(
            'id, user_id, name, category, product_type, is_third_party, supplier_id, total_cost, cost_per_unit, supplier_cost, supplier_cost_unit, yield_amount'
          )
          .eq('user_id', user.id)
          .in('id', recipeIds)

        if (recipesError) throw recipesError
        loadedRecipes = (recipesData ?? []) as Recipe[]
      }

      let loadedSupplierOrders: SupplierOrder[] = []
      if (orderIds.length > 0) {
        const { data: supplierOrdersData, error: supplierOrdersError } = await supabase
          .from('supplier_orders')
          .select(
            'id, user_id, supplier_id, customer_order_id, order_item_id, title, quantity, unit, estimated_cost, due_date, status, details, notes, created_at'
          )
          .eq('user_id', user.id)
          .in('customer_order_id', orderIds)

        if (supplierOrdersError) {
          logAgendaError(supplierOrdersError)
          if (!isMissingOptionalTableError(supplierOrdersError)) throw supplierOrdersError
        } else {
          loadedSupplierOrders = (supplierOrdersData ?? []) as SupplierOrder[]
        }
      }

      let loadedCakeToppers: OrderCakeTopper[] = []
      if (orderIds.length > 0) {
        const { data: cakeToppersData, error: cakeToppersError } = await supabase
          .from('order_cake_toppers')
          .select(
            'id, user_id, order_id, supplier_id, child_name, age, theme, photo_url, cost, charged_amount, notes, created_at'
          )
          .eq('user_id', user.id)
          .in('order_id', orderIds)

        if (cakeToppersError) {
          logAgendaError(cakeToppersError)
          if (!isMissingOptionalTableError(cakeToppersError)) throw cakeToppersError
        } else {
          loadedCakeToppers = (cakeToppersData ?? []) as OrderCakeTopper[]
        }
      }

      const supplierIds = Array.from(
        new Set(
          [
            ...loadedRecipes.map((recipe) => recipe.supplier_id),
            ...loadedSupplierOrders.map((supplierOrder) => supplierOrder.supplier_id),
            ...loadedCakeToppers.map((topper) => topper.supplier_id),
          ].filter((supplierId): supplierId is string => Boolean(supplierId))
        )
      )

      let loadedSuppliers: Supplier[] = []
      if (supplierIds.length > 0) {
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('user_id', user.id)
          .in('id', supplierIds)

        if (suppliersError) throw suppliersError
        loadedSuppliers = (suppliersData ?? []) as Supplier[]
      }

      setCurrentUserId(user.id)
      setOrders(loadedOrders)
      setCustomers(loadedCustomers)
      setOrderItems(loadedOrderItems)
      setRecipes(loadedRecipes)
      setSuppliers(loadedSuppliers)
      setSupplierOrders(loadedSupplierOrders)
      setCakeToppers(loadedCakeToppers)
    } catch (err) {
      logAgendaError(err)
      setError(getErrorMessage(err, 'Falha ao carregar agenda de produção'))
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAgendaData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadAgendaData])

  const customerById = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]))
  }, [customers])

  const recipeById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]))
  }, [recipes])

  const supplierById = useMemo(() => {
    return new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  }, [suppliers])

  const orderItemById = useMemo(() => {
    return new Map(orderItems.map((item) => [item.id, item]))
  }, [orderItems])

  const itemsByOrderId = useMemo(() => {
    return orderItems.reduce<Map<string, OrderItem[]>>((groups, item) => {
      const currentItems = groups.get(item.order_id) ?? []
      groups.set(item.order_id, [...currentItems, item])

      return groups
    }, new Map())
  }, [orderItems])

  const supplierOrdersByOrderId = useMemo(() => {
    return supplierOrders.reduce<Map<string, SupplierOrder[]>>((groups, supplierOrder) => {
      if (!supplierOrder.customer_order_id) return groups

      const currentOrders = groups.get(supplierOrder.customer_order_id) ?? []
      groups.set(supplierOrder.customer_order_id, [...currentOrders, supplierOrder])

      return groups
    }, new Map())
  }, [supplierOrders])

  const supplierOrdersByOrderItemId = useMemo(() => {
    return supplierOrders.reduce<Map<string, SupplierOrder[]>>((groups, supplierOrder) => {
      if (!supplierOrder.order_item_id) return groups

      const currentOrders = groups.get(supplierOrder.order_item_id) ?? []
      groups.set(supplierOrder.order_item_id, [...currentOrders, supplierOrder])

      return groups
    }, new Map())
  }, [supplierOrders])

  const cakeToppersByOrderId = useMemo(() => {
    return cakeToppers.reduce<Map<string, OrderCakeTopper[]>>((groups, topper) => {
      const currentToppers = groups.get(topper.order_id) ?? []
      groups.set(topper.order_id, [...currentToppers, topper])

      return groups
    }, new Map())
  }, [cakeToppers])

  const statusFilteredOrders = useMemo(() => {
    return orders.filter((order) => matchesStatusFilter(order, statusFilter))
  }, [orders, statusFilter])

  const ordersByDate = useMemo(() => {
    return statusFilteredOrders.reduce<Map<string, Order[]>>((groups, order) => {
      const orderDate = getPrimaryOrderDate(order)
      if (!orderDate) return groups

      const currentOrders = groups.get(orderDate) ?? []
      groups.set(orderDate, [...currentOrders, order])

      return groups
    }, new Map())
  }, [statusFilteredOrders])

  const calendarDays = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const startDate = new Date(year, month - 1, 1 - firstDayOfMonth.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)
      const dateValue = formatInputDate(date)

      return {
        date: dateValue,
        dayNumber: date.getDate(),
        isCurrentMonth: getMonthFromDateValue(dateValue) === currentMonth,
        isToday: dateValue === today,
        isSelected: dateValue === selectedDate,
        orderCount: ordersByDate.get(dateValue)?.length ?? 0,
      }
    })
  }, [currentMonth, ordersByDate, selectedDate, today])

  const selectedDayOrders = useMemo(() => {
    return [...(ordersByDate.get(selectedDate) ?? [])].sort(compareOrdersByTime)
  }, [ordersByDate, selectedDate])

  const selectedOrder = useMemo(() => {
    return (
      selectedDayOrders.find((order) => order.id === selectedOrderId) ??
      selectedDayOrders[0] ??
      null
    )
  }, [selectedDayOrders, selectedOrderId])
  const activeOrderId = selectedOrder?.id ?? ''

  const selectedOrderItems = selectedOrder ? itemsByOrderId.get(selectedOrder.id) ?? [] : []
  const selectedOrderSupplierOrders = selectedOrder
    ? supplierOrdersByOrderId.get(selectedOrder.id) ?? []
    : []
  const selectedOrderCakeTopperViews = selectedOrder
    ? buildCakeTopperViews(
        cakeToppersByOrderId.get(selectedOrder.id) ?? [],
        selectedOrderSupplierOrders,
        supplierById
      )
    : []
  const selectedOrderCost = selectedOrder
    ? calculateOrderCost(
        selectedOrderItems,
        recipeById,
        selectedOrderSupplierOrders,
        supplierOrdersByOrderItemId,
        orderItemById,
        selectedOrderCakeTopperViews
      )
    : null
  const selectedOrderTotal = selectedOrder ? getOrderTotal(selectedOrder) : 0
  const selectedOrderDeposit = selectedOrder ? getOrderDeposit(selectedOrder) : 0
  const selectedOrderRemaining = selectedOrder ? getOrderRemaining(selectedOrder) : 0
  const selectedOrderProfit =
    selectedOrderCost === null ? 0 : selectedOrderTotal - selectedOrderCost.cost
  const selectedOrderProductionItems = getProductionSourceItems(selectedOrderItems)
  const selectedInternalItems = selectedOrderProductionItems.filter((item) => {
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    const hasSupplierOrder = (supplierOrdersByOrderItemId.get(item.id) ?? []).length > 0

    return recipe?.is_third_party !== true && !hasSupplierOrder
  })
  const selectedThirdPartyItemsWithoutSupplierOrder = selectedOrderProductionItems.filter((item) => {
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    const hasSupplierOrder = (supplierOrdersByOrderItemId.get(item.id) ?? []).length > 0

    return recipe?.is_third_party === true && !hasSupplierOrder
  })
  const selectedExternalSupplierOrders = selectedOrderSupplierOrders.filter(
    (supplierOrder) => !readCakeTopperDetails(supplierOrder)
  )
  const currentStatusMeta = selectedOrder ? getStatusMeta(selectedOrder.status) : undefined

  function handleSelectDate(dateValue: string) {
    setSelectedDate(dateValue)

    const dateMonth = getMonthFromDateValue(dateValue)
    if (dateMonth !== currentMonth) {
      setCurrentMonth(dateMonth)
    }
  }

  function handleTodayClick() {
    setSelectedDate(today)
    setCurrentMonth(getMonthFromDateValue(today))
  }

  async function updateOrderStatus(orderId: string, nextStatus: QuickStatus) {
    if (!currentUserId) {
      setError('Usuária não autenticada')
      return
    }

    setUpdatingOrderId(orderId)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .eq('user_id', currentUserId)

      if (updateError) throw updateError

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: nextStatus } : order
        )
      )
    } catch (err) {
      const supabaseError = getSupabaseErrorDetails(err)

      console.error('Erro ao atualizar pedido na agenda de produção:', {
        message: supabaseError.message,
        details: supabaseError.details,
        hint: supabaseError.hint,
        code: supabaseError.code,
        fullError: err,
        stringified: JSON.stringify(err, null, 2),
      })
      setError(getErrorMessage(err, 'Falha ao atualizar status do pedido'))
    } finally {
      setUpdatingOrderId('')
    }
  }

  function renderItemFlavors(item: OrderItem) {
    const flavors = getFlavorText(item)

    if (flavors.length === 0) return null

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flavors.map((flavor) => (
          <span
            key={`${item.id}-${flavor}`}
            className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#6F625F]"
          >
            {flavor}
          </span>
        ))}
      </div>
    )
  }

  function renderProductionItem(item: OrderItem) {
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    const supplierOrder = supplierOrdersByOrderItemId.get(item.id)?.[0]
    const supplierName = supplierOrder?.supplier_id
      ? supplierById.get(supplierOrder.supplier_id)?.name ?? 'Fornecedor não informado'
      : recipe?.supplier_id
        ? supplierById.get(recipe.supplier_id)?.name ?? 'Fornecedor não informado'
        : null

    return (
      <li key={item.id} className="rounded-lg bg-[#FAF6F0] px-3 py-3 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <span className="font-bold text-[#1A0A08]">
            {formatNumber(item.quantity)}x {getItemName(item, recipeById)}
          </span>
          {supplierName && (
            <span className="text-xs font-semibold text-[#C9A84C]">{supplierName}</span>
          )}
        </div>
        {renderItemFlavors(item)}
        {item.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-[#6F625F]">{item.notes}</p>}
      </li>
    )
  }

  function renderOrderItemsTree() {
    const childrenByParentId = getChildrenByParentId(selectedOrderItems)
    const mainItems = selectedOrderItems.filter((item) => !item.parent_order_item_id)
    const visibleMainItems = mainItems.length > 0 ? mainItems : selectedOrderItems

    if (visibleMainItems.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] px-3 py-4 text-sm text-[#999999]">
          Nenhum item estruturado neste pedido.
        </p>
      )
    }

    return (
      <div className="space-y-2">
        {visibleMainItems.map((item) => {
          const children = childrenByParentId.get(item.id) ?? []

          return (
            <article key={item.id} className="rounded-lg bg-[#FAF6F0] p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="font-bold text-[#1A0A08]">
                  {formatNumber(item.quantity)}x {getItemName(item, recipeById)}
                </p>
                <p className="text-sm font-semibold text-[#6F625F]">
                  {formatCurrency(item.subtotal)}
                </p>
              </div>
              {renderItemFlavors(item)}
              {item.notes && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-[#6F625F]">{item.notes}</p>
              )}
              {children.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white pt-3">
                  {children.map((child) => (
                    <div key={child.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <span className="font-semibold text-[#1A0A08]">
                          {formatNumber(child.quantity)}x {getItemName(child, recipeById)}
                        </span>
                        <span className="text-xs font-semibold text-[#999999]">Item do kit</span>
                      </div>
                      {renderItemFlavors(child)}
                      {child.notes && (
                        <p className="mt-2 whitespace-pre-wrap text-xs text-[#6F625F]">
                          {child.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    )
  }

  function renderSupplierOrder(supplierOrder: SupplierOrder) {
    const supplierName = supplierOrder.supplier_id
      ? supplierById.get(supplierOrder.supplier_id)?.name ?? 'Fornecedor não informado'
      : 'Fornecedor não informado'

    return (
      <li key={supplierOrder.id} className="rounded-lg bg-[#FAF6F0] px-3 py-3 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-bold text-[#1A0A08]">{supplierOrder.title}</p>
            <p className="mt-1 text-xs font-semibold text-[#C9A84C]">{supplierName}</p>
          </div>
          <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1A0A08]">
            {supplierOrder.status || 'Sem status'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#6F625F] sm:grid-cols-3">
          <span>
            Quantidade: {formatNumber(supplierOrder.quantity)} {supplierOrder.unit || 'un'}
          </span>
          <span>Custo: {formatCurrency(supplierOrder.estimated_cost)}</span>
          <span>Prazo: {formatDate(supplierOrder.due_date)}</span>
        </div>
        {supplierOrder.notes && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-[#6F625F]">{supplierOrder.notes}</p>
        )}
      </li>
    )
  }

  function renderCakeTopper(topper: CakeTopperView) {
    return (
      <article
        key={topper.id}
        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-3"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          {topper.photoUrl ? (
            <Image
              src={topper.photoUrl}
              alt="Referência do topo personalizado"
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white text-[#C9A84C]">
              <ImageIcon size={26} aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1 text-sm">
            <p className="break-words font-bold text-[#1A0A08]">{topper.title}</p>
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-[#6F625F] sm:grid-cols-2">
              <span>Nome: {topper.childName || 'Não informado'}</span>
              <span>Idade: {topper.age || 'Não informado'}</span>
              <span>Tema: {topper.theme || 'Não informado'}</span>
              <span>Fornecedor: {topper.supplierName || 'Não informado'}</span>
              <span>Custo: {formatCurrency(topper.cost)}</span>
              <span>Origem: {topper.source}</span>
            </div>
            {topper.notes && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-[#6F625F]">{topper.notes}</p>
            )}
            {topper.photoUrl && (
              <a
                href={topper.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#C0392B] hover:underline"
              >
                <ExternalLink size={14} aria-hidden="true" />
                Abrir imagem
              </a>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF6F0] pb-28 lg:pb-8">
      <div className="border-b border-[rgba(26,10,8,0.07)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
            PRODUÇÃO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A0A08]">Agenda de produção</h1>
          <p className="mt-2 text-sm text-[#6F625F]">
            Veja os pedidos por dia e organize a produção.
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-[16px] border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          <section className="space-y-5">
            <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                    Calendário mensal
                  </p>
                  <h2 className="text-xl font-bold text-[#1A0A08]">
                    {formatMonthLabel(currentMonth)}
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth((month) => addMonths(month, -1))}
                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-2 text-xs font-bold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    <span>Mês anterior</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTodayClick}
                    className="min-h-10 rounded-lg bg-[#C0392B] px-3 text-xs font-bold text-white transition-colors hover:bg-[#A0301F]"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth((month) => addMonths(month, 1))}
                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-2 text-xs font-bold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
                  >
                    <span>Próximo mês</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                  Status
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {statusFilterOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setStatusFilter(option.id)}
                      className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                        statusFilter === option.id
                          ? 'bg-[#C0392B] text-white'
                          : 'border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-[#999999]">
                {weekDays.map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => handleSelectDate(day.date)}
                    aria-label={`${formatDate(day.date)}: ${day.orderCount} pedido${
                      day.orderCount === 1 ? '' : 's'
                    }`}
                    className={`min-h-[64px] rounded-lg border p-1.5 text-left transition-colors sm:min-h-[76px] ${
                      day.isSelected
                        ? 'border-[#C0392B] bg-[#C0392B] text-white'
                        : day.isToday
                          ? 'border-[#C9A84C] bg-[#FFF8E8] text-[#1A0A08]'
                          : 'border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                    } ${day.isCurrentMonth ? '' : 'opacity-45'}`}
                  >
                    <span className="block text-sm font-bold">{day.dayNumber}</span>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        day.isSelected
                          ? 'bg-white text-[#C0392B]'
                          : day.orderCount > 0
                            ? 'bg-[#FAF6F0] text-[#C0392B]'
                            : 'bg-transparent text-[#999999]'
                      }`}
                    >
                      {day.orderCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                    Pedidos do dia
                  </p>
                  <h2 className="text-lg font-bold text-[#1A0A08]">
                    {formatLongDate(selectedDate)}
                  </h2>
                </div>
                <span className="rounded-full bg-[#FAF6F0] px-3 py-1 text-xs font-bold text-[#1A0A08]">
                  {selectedDayOrders.length}
                </span>
              </div>

              {isLoading ? (
                <div className="py-10 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
                  <p className="mt-3 text-sm text-[#999999]">Carregando agenda...</p>
                </div>
              ) : selectedDayOrders.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-10 text-center">
                  <CalendarDays
                    className="mx-auto mb-3 h-10 w-10 text-[#C9A84C]"
                    aria-hidden="true"
                  />
                  <p className="font-semibold text-[#1A0A08]">Nenhum pedido para este dia.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayOrders.map((order) => {
                    const statusMeta = getStatusMeta(order.status)
                    const isSelected = order.id === activeOrderId

                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`w-full rounded-[16px] border p-4 text-left transition-shadow hover:shadow-md ${
                          isSelected
                            ? 'border-[#C0392B] bg-[#FFF8F5]'
                            : 'border-[rgba(26,10,8,0.07)] bg-white'
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#1A0A08] px-2.5 py-1 text-xs font-bold text-white">
                                <Clock3 size={13} aria-hidden="true" />
                                {formatTime(order.delivery_time)}
                              </span>
                              <span
                                className="rounded-full px-2.5 py-1 text-xs font-bold"
                                style={{
                                  backgroundColor: statusMeta?.bg ?? '#FAF6F0',
                                  color: statusMeta?.color ?? '#1A0A08',
                                }}
                              >
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                            <p className="break-words text-base font-bold text-[#1A0A08]">
                              {getCustomerName(order, customerById)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-[#6F625F]">
                              {getOrderSummary(order, itemsByOrderId, recipeById)}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm sm:w-36 sm:grid-cols-1 sm:text-right">
                            <div>
                              <p className="text-xs font-semibold text-[#999999]">Total</p>
                              <p className="font-bold text-[#1A0A08]">
                                {formatCurrency(getOrderTotal(order))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#999999]">Restante</p>
                              <p className="font-bold text-[#C0392B]">
                                {formatCurrency(getOrderRemaining(order))}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="xl:sticky xl:top-6 xl:self-start">
            {!selectedOrder ? (
              <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center shadow-sm">
                <PackageCheck
                  className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]"
                  aria-hidden="true"
                />
                <p className="text-lg font-bold text-[#1A0A08]">Selecione um pedido</p>
                <p className="mt-2 text-sm text-[#999999]">
                  Clique em um pedido do dia para ver produção e financeiro.
                </p>
              </div>
            ) : (
              <article className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                      Detalhe do pedido
                    </p>
                    <h2 className="mt-1 break-words text-2xl font-bold text-[#1A0A08]">
                      {getCustomerName(selectedOrder, customerById)}
                    </h2>
                    <p className="mt-2 text-sm text-[#6F625F]">
                      {formatDate(getPrimaryOrderDate(selectedOrder))} às{' '}
                      {formatTime(selectedOrder.delivery_time)}
                    </p>
                  </div>
                  <span
                    className="w-fit rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: currentStatusMeta?.bg ?? '#FAF6F0',
                      color: currentStatusMeta?.color ?? '#1A0A08',
                    }}
                  >
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <UserRound size={18} className="mb-2 text-[#C0392B]" aria-hidden="true" />
                    <p className="text-xs font-semibold text-[#999999]">Atendimento</p>
                    <p className="mt-1 font-bold text-[#1A0A08]">
                      {selectedOrder.fulfillment_type === 'entrega' ? 'Entrega' : 'Retirada'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <WalletCards size={18} className="mb-2 text-[#C9A84C]" aria-hidden="true" />
                    <p className="text-xs font-semibold text-[#999999]">Pagamento</p>
                    <p className="mt-1 font-bold text-[#1A0A08]">
                      {selectedOrder.payment_status || 'Não informado'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <CalendarDays size={18} className="mb-2 text-[#C0392B]" aria-hidden="true" />
                    <p className="text-xs font-semibold text-[#999999]">Pedido</p>
                    <p className="mt-1 font-bold text-[#1A0A08]">
                      {formatDate(selectedOrder.order_date)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <Clock3 size={18} className="mb-2 text-[#C9A84C]" aria-hidden="true" />
                    <p className="text-xs font-semibold text-[#999999]">Horário</p>
                    <p className="mt-1 font-bold text-[#1A0A08]">
                      {formatTime(selectedOrder.delivery_time)}
                    </p>
                  </div>
                </div>

                {selectedOrder.delivery_address && (
                  <div className="mb-5 rounded-lg bg-[#FAF6F0] p-3">
                    <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                      <MapPin size={14} aria-hidden="true" />
                      Endereço
                    </p>
                    <p className="whitespace-pre-wrap text-sm font-semibold text-[#1A0A08]">
                      {selectedOrder.delivery_address}
                    </p>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="mb-5 rounded-lg bg-[#FAF6F0] p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                      Observações
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-[#1A0A08]">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg bg-[#1A0A08] p-3 text-white">
                    <p className="text-xs font-semibold text-[#E8D9D4]">Total</p>
                    <p className="mt-1 text-lg font-bold">{formatCurrency(selectedOrderTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <p className="text-xs font-semibold text-[#999999]">Sinal pago</p>
                    <p className="mt-1 text-lg font-bold text-[#1A0A08]">
                      {formatCurrency(selectedOrderDeposit)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <p className="text-xs font-semibold text-[#999999]">Restante</p>
                    <p className="mt-1 text-lg font-bold text-[#C0392B]">
                      {formatCurrency(selectedOrderRemaining)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <p className="text-xs font-semibold text-[#999999]">Custo estimado</p>
                    <p className="mt-1 text-lg font-bold text-[#1A0A08]">
                      {formatCurrency(selectedOrderCost?.cost ?? 0)}
                    </p>
                    {selectedOrderCost?.isPartial && (
                      <p className="mt-1 text-xs font-bold text-[#C0392B]">estimativa parcial</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-[#FAF6F0] p-3">
                    <p className="text-xs font-semibold text-[#999999]">Lucro estimado</p>
                    <p
                      className={`mt-1 text-lg font-bold ${
                        selectedOrderProfit >= 0 ? 'text-[#17803D]' : 'text-[#C0392B]'
                      }`}
                    >
                      {formatCurrency(selectedOrderProfit)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <section>
                    <h3 className="mb-3 text-base font-bold text-[#1A0A08]">Itens do pedido</h3>
                    {renderOrderItemsTree()}
                  </section>

                  <section>
                    <h3 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-[#1A0A08]">
                      <ChefHat size={18} className="text-[#C0392B]" aria-hidden="true" />
                      Produção interna
                    </h3>
                    {selectedInternalItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] px-3 py-4 text-sm text-[#999999]">
                        Sem itens internos para este pedido.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedInternalItems.map(renderProductionItem)}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-[#1A0A08]">
                      <Truck size={18} className="text-[#C9A84C]" aria-hidden="true" />
                      Terceirizados
                    </h3>
                    {selectedThirdPartyItemsWithoutSupplierOrder.length === 0 &&
                    selectedExternalSupplierOrders.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] px-3 py-4 text-sm text-[#999999]">
                        Sem terceirizados para este pedido.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedThirdPartyItemsWithoutSupplierOrder.length > 0 && (
                          <ul className="space-y-2">
                            {selectedThirdPartyItemsWithoutSupplierOrder.map(renderProductionItem)}
                          </ul>
                        )}
                        {selectedExternalSupplierOrders.length > 0 && (
                          <ul className="space-y-2">
                            {selectedExternalSupplierOrders.map(renderSupplierOrder)}
                          </ul>
                        )}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-[#1A0A08]">
                      <ImageIcon size={18} className="text-[#C9A84C]" aria-hidden="true" />
                      Topos personalizados
                    </h3>
                    {selectedOrderCakeTopperViews.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] px-3 py-4 text-sm text-[#999999]">
                        Sem topo personalizado neste pedido.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedOrderCakeTopperViews.map(renderCakeTopper)}
                      </div>
                    )}
                  </section>
                </div>

                <div className="mt-6 flex flex-col gap-2 border-t border-[rgba(26,10,8,0.07)] pt-4 sm:flex-row sm:flex-wrap">
                  <Link
                    href={`/pedidos/${selectedOrder.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1A0A08] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2A1A18]"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    Ver pedido
                  </Link>
                  <Link
                    href={`/pedidos/${selectedOrder.id}/editar`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-4 py-2 text-sm font-bold text-[#C0392B] transition-colors hover:bg-[#FAF6F0]"
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Editar pedido
                  </Link>
                  {quickStatusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateOrderStatus(selectedOrder.id, option.id)}
                      disabled={
                        updatingOrderId === selectedOrder.id || selectedOrder.status === option.id
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-4 py-2 text-sm font-bold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {option.id === 'entregue' ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : option.id === 'pronto' ? (
                        <PackageCheck size={16} aria-hidden="true" />
                      ) : (
                        <ChefHat size={16} aria-hidden="true" />
                      )}
                      {option.label}
                    </button>
                  ))}
                </div>
              </article>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
