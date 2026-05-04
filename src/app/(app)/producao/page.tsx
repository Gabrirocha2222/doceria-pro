'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarDays,
  ChefHat,
  ClipboardList,
  ExternalLink,
  ImageIcon,
  PackageCheck,
  Truck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, parseNumericValue } from '@/lib/format'

type NumericValue = number | string | null | undefined
type PeriodPreset = 'today' | 'tomorrow' | 'week' | 'custom'
type ViewMode = 'summary' | 'orders'
type ProductionKind = 'internal' | 'third_party'
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

type SupabaseErrorLike = {
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
  fulfillment_type: string | null
  notes: string | null
  created_at: string
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
  notes: string | null
}

type Recipe = {
  id: string
  name: string
  category: string | null
  product_type: string | null
  is_third_party: boolean | null
  supplier_id: string | null
}

type Customer = {
  id: string
  user_id: string
  name: string
  phone: string | null
  whatsapp: string | null
}

type Supplier = {
  id: string
  name: string
}

type SupplierOrder = {
  id: string
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
  created_at: string
}

type OrderCakeTopper = {
  id: string
  order_id: string
  supplier_id: string | null
  child_name: string | null
  age: string | null
  theme: string | null
  photo_url: string | null
  cost: NumericValue
  charged_amount: NumericValue
  notes: string | null
  created_at: string
}

type ProductionSummaryItem = {
  key: string
  kind: ProductionKind
  title: string
  category: string
  quantity: number
  unit: string
  supplierName: string | null
  origins: string[]
  orderIds: string[]
}

type ProductionAccumulator = Omit<
  ProductionSummaryItem,
  'quantity' | 'origins' | 'orderIds'
> & {
  quantity: number
  origins: Set<string>
  orderIds: Set<string>
}

type CakeTopperProduction = {
  id: string
  orderId: string | null
  title: string
  childName: string | null
  age: string | null
  theme: string | null
  supplierName: string | null
  cost: NumericValue
  photoUrl: string | null
  origin: string
}

type ProductionOrderView = {
  order: Order
  customerName: string
  productionItems: OrderItem[]
  thirdPartyItems: OrderItem[]
  supplierOrders: SupplierOrder[]
  cakeToppers: CakeTopperProduction[]
}

const periodOptions: { id: PeriodPreset; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'tomorrow', label: 'Amanha' },
  { id: 'week', label: 'Esta semana' },
  { id: 'custom', label: 'Personalizado' },
]

const viewModeOptions: { id: ViewMode; label: string }[] = [
  { id: 'summary', label: 'Resumo por producao' },
  { id: 'orders', label: 'Por pedido' },
]

function logProductionError(error: unknown) {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}

  console.error('Erro ao carregar produção:', {
    message: supabaseError.message,
    details: supabaseError.details,
    hint: supabaseError.hint,
    code: supabaseError.code,
    fullError: error,
    stringified: JSON.stringify(error, null, 2),
  })
}

function isMissingRelationError(error: unknown) {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}
  const message = supabaseError.message?.toLowerCase() ?? ''
  const code = supabaseError.code ?? ''

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
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

function addDays(date: string, days: number) {
  const parsedDate = parseInputDate(date)
  parsedDate.setDate(parsedDate.getDate() + days)

  return formatInputDate(parsedDate)
}

function getWeekEndDate(date: string) {
  const parsedDate = parseInputDate(date)
  const dayOfWeek = parsedDate.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek

  return addDays(date, daysUntilSunday)
}

function formatDate(date: string | null | undefined) {
  if (!date) return 'Sem data'

  return parseInputDate(date).toLocaleDateString('pt-BR')
}

function getPrimaryOrderDate(order: Order) {
  return order.delivery_date ?? order.order_date
}

function compareOrders(firstOrder: Order, secondOrder: Order) {
  const firstDate = getPrimaryOrderDate(firstOrder) ?? '9999-12-31'
  const secondDate = getPrimaryOrderDate(secondOrder) ?? '9999-12-31'

  if (firstDate !== secondDate) return firstDate.localeCompare(secondDate)

  const firstTime = firstOrder.delivery_time?.trim() || '99:99'
  const secondTime = secondOrder.delivery_time?.trim() || '99:99'

  if (firstTime !== secondTime) return firstTime.localeCompare(secondTime)

  return firstOrder.created_at.localeCompare(secondOrder.created_at)
}

function getCustomerName(order: Order, customerById: Map<string, Customer>) {
  if (!order.customer_id) return 'Cliente nao informado'

  return customerById.get(order.customer_id)?.name?.trim() || 'Cliente nao informado'
}

function getSelectedRange(period: PeriodPreset, customStart: string, customEnd: string) {
  const today = formatInputDate(new Date())

  if (period === 'today') return { start: today, end: today }
  if (period === 'tomorrow') {
    const tomorrow = addDays(today, 1)
    return { start: tomorrow, end: tomorrow }
  }
  if (period === 'week') return { start: today, end: getWeekEndDate(today) }

  const start = customStart || today
  const end = customEnd || start

  return start <= end ? { start, end } : { start: end, end: start }
}

function isRecord(value: JsonValue | null): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasDetailKey(record: { [key: string]: JsonValue }, keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key))
}

function readStringDetail(record: { [key: string]: JsonValue }, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function readCakeTopperDetails(order: SupplierOrder) {
  const details = isRecord(order.details) ? order.details : null
  const title = order.title.trim().toLowerCase()
  const hasCakeTopperTitle = title.includes('topo')
  const hasCakeTopperKey = details
    ? hasDetailKey(details, [
        'nome',
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
    childName: details ? readStringDetail(details, ['nome', 'child_name']) : null,
    age: details ? readStringDetail(details, ['idade', 'age']) : null,
    theme: details ? readStringDetail(details, ['tema', 'theme']) : null,
    photoUrl: details ? readStringDetail(details, ['foto_url', 'photo_url']) : null,
  }
}

function normalizeGroupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getProductionSourceItems(items: OrderItem[]) {
  const childrenByParentId = items.reduce<Map<string, OrderItem[]>>((groups, item) => {
    if (!item.parent_order_item_id) return groups

    const currentItems = groups.get(item.parent_order_item_id) ?? []
    groups.set(item.parent_order_item_id, [...currentItems, item])

    return groups
  }, new Map())

  return items.filter((item) => {
    if (item.parent_order_item_id) return true

    return (childrenByParentId.get(item.id) ?? []).length === 0
  })
}

function addProductionItem(
  accumulator: Map<string, ProductionAccumulator>,
  item: Omit<ProductionSummaryItem, 'origins' | 'orderIds'> & {
    origin: string
    orderId: string
  }
) {
  if (item.quantity <= 0) return

  const currentItem = accumulator.get(item.key)

  if (!currentItem) {
    accumulator.set(item.key, {
      key: item.key,
      kind: item.kind,
      title: item.title,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      supplierName: item.supplierName,
      origins: new Set([item.origin]),
      orderIds: new Set([item.orderId]),
    })
    return
  }

  currentItem.quantity += item.quantity
  currentItem.origins.add(item.origin)
  currentItem.orderIds.add(item.orderId)
}

function finalizeProductionItems(accumulator: Map<string, ProductionAccumulator>) {
  return Array.from(accumulator.values())
    .map<ProductionSummaryItem>((item) => ({
      ...item,
      origins: Array.from(item.origins).sort((firstOrigin, secondOrigin) =>
        firstOrigin.localeCompare(secondOrigin, 'pt-BR')
      ),
      orderIds: Array.from(item.orderIds),
    }))
    .sort((firstItem, secondItem) => {
      const categoryComparison = firstItem.category.localeCompare(secondItem.category, 'pt-BR')
      if (categoryComparison !== 0) return categoryComparison

      return firstItem.title.localeCompare(secondItem.title, 'pt-BR')
    })
}

function groupByCategory(items: ProductionSummaryItem[]) {
  const groups = new Map<string, ProductionSummaryItem[]>()

  items.forEach((item) => {
    const currentItems = groups.get(item.category) ?? []
    groups.set(item.category, [...currentItems, item])
  })

  return Array.from(groups.entries()).sort(([firstCategory], [secondCategory]) =>
    firstCategory.localeCompare(secondCategory, 'pt-BR')
  )
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

function getCakeTopperDedupeKey(topper: CakeTopperProduction) {
  return [
    topper.orderId ?? 'sem-pedido',
    topper.supplierName ?? 'sem-fornecedor',
    topper.childName ?? '',
    topper.age ?? '',
    topper.theme ?? '',
    topper.photoUrl ?? '',
  ].join('::')
}

export default function ProducaoPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([])
  const [cakeToppers, setCakeToppers] = useState<OrderCakeTopper[]>([])
  const [period, setPeriod] = useState<PeriodPreset>('today')
  const [customStartDate, setCustomStartDate] = useState(() => formatInputDate(new Date()))
  const [customEndDate, setCustomEndDate] = useState(() => formatInputDate(new Date()))
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [includeDelivered, setIncludeDelivered] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const selectedRange = useMemo(
    () => getSelectedRange(period, customStartDate, customEndDate),
    [customEndDate, customStartDate, period]
  )

  const loadProduction = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (userError) logProductionError(userError)
        throw new Error('Usuario nao autenticado')
      }

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
            fulfillment_type,
            notes,
            created_at
          `
        )
        .eq('user_id', user.id)
        .neq('status', 'cancelado')
        .order('delivery_date', { ascending: true, nullsFirst: false })
        .order('order_date', { ascending: true, nullsFirst: false })
        .order('delivery_time', { ascending: true, nullsFirst: false })

      if (ordersError) {
        logProductionError(ordersError)
        throw ordersError
      }

      const ordersInRange = ((ordersData ?? []) as Order[])
        .filter((order) => {
          const orderDate = getPrimaryOrderDate(order)
          if (!orderDate) return false
          if (orderDate < selectedRange.start || orderDate > selectedRange.end) return false
          if (!includeDelivered && order.status === 'entregue') return false

          return true
        })
        .sort(compareOrders)
      const orderIds = ordersInRange.map((order) => order.id)

      if (orderIds.length === 0) {
        setOrders([])
        setOrderItems([])
        setRecipes([])
        setCustomers([])
        setSuppliers([])
        setSupplierOrders([])
        setCakeToppers([])
        return
      }

      const customerIds = Array.from(
        new Set(
          ordersInRange
            .map((order) => order.customer_id)
            .filter((customerId): customerId is string => Boolean(customerId))
        )
      )

      const [orderItemsResult, customersResult] = await Promise.all([
        supabase
          .from('order_items')
          .select(
            'id, order_id, recipe_id, parent_order_item_id, item_name, quantity, unit_price, subtotal, notes'
          )
          .eq('user_id', user.id)
          .in('order_id', orderIds),
        customerIds.length > 0
          ? supabase
              .from('customers')
              .select('id, user_id, name, phone, whatsapp')
              .eq('user_id', user.id)
              .in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (orderItemsResult.error) {
        logProductionError(orderItemsResult.error)
        throw orderItemsResult.error
      }

      if (customersResult.error) {
        logProductionError(customersResult.error)
        throw customersResult.error
      }

      const loadedOrderItems = (orderItemsResult.data ?? []) as OrderItem[]
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
          .select('id, name, category, product_type, is_third_party, supplier_id')
          .eq('user_id', user.id)
          .in('id', recipeIds)

        if (recipesError) {
          logProductionError(recipesError)
          throw recipesError
        }

        loadedRecipes = (recipesData ?? []) as Recipe[]
      }

      let loadedSupplierOrders: SupplierOrder[] = []
      const { data: supplierOrdersData, error: supplierOrdersError } = await supabase
        .from('supplier_orders')
        .select(
          'id, supplier_id, customer_order_id, order_item_id, title, quantity, unit, estimated_cost, due_date, status, details, notes, created_at'
        )
        .eq('user_id', user.id)
        .in('customer_order_id', orderIds)

      if (supplierOrdersError) {
        logProductionError(supplierOrdersError)
        if (!isMissingRelationError(supplierOrdersError)) {
          throw supplierOrdersError
        }
      } else {
        loadedSupplierOrders = (supplierOrdersData ?? []) as SupplierOrder[]
      }

      let loadedCakeToppers: OrderCakeTopper[] = []
      const { data: cakeToppersData, error: cakeToppersError } = await supabase
        .from('order_cake_toppers')
        .select(
          'id, order_id, supplier_id, child_name, age, theme, photo_url, cost, charged_amount, notes, created_at'
        )
        .eq('user_id', user.id)
        .in('order_id', orderIds)

      if (cakeToppersError) {
        logProductionError(cakeToppersError)
        if (!isMissingRelationError(cakeToppersError)) {
          throw cakeToppersError
        }
      } else {
        loadedCakeToppers = (cakeToppersData ?? []) as OrderCakeTopper[]
      }

      const supplierIds = Array.from(
        new Set(
          [
            ...loadedRecipes.map((recipe) => recipe.supplier_id),
            ...loadedSupplierOrders.map((order) => order.supplier_id),
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

        if (suppliersError) {
          logProductionError(suppliersError)
        } else {
          loadedSuppliers = (suppliersData ?? []) as Supplier[]
        }
      }

      setOrders(ordersInRange)
      setOrderItems(loadedOrderItems)
      setRecipes(loadedRecipes)
      setCustomers((customersResult.data ?? []) as Customer[])
      setSuppliers(loadedSuppliers)
      setSupplierOrders(loadedSupplierOrders)
      setCakeToppers(loadedCakeToppers)
    } catch (err) {
      logProductionError(err)
      setError('Falha ao carregar producao')
    } finally {
      setIsLoading(false)
    }
  }, [includeDelivered, selectedRange.end, selectedRange.start, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProduction()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadProduction])

  const customerById = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]))
  }, [customers])

  const recipeById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]))
  }, [recipes])

  const supplierById = useMemo(() => {
    return new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  }, [suppliers])

  const orderById = useMemo(() => {
    return new Map(orders.map((order) => [order.id, order]))
  }, [orders])

  const orderItemsByOrderId = useMemo(() => {
    return orderItems.reduce<Map<string, OrderItem[]>>((groups, item) => {
      const currentItems = groups.get(item.order_id) ?? []
      groups.set(item.order_id, [...currentItems, item])

      return groups
    }, new Map())
  }, [orderItems])

  const supplierOrdersByOrderItemId = useMemo(() => {
    return supplierOrders.reduce<Map<string, SupplierOrder[]>>((groups, supplierOrder) => {
      if (!supplierOrder.order_item_id) return groups

      const currentOrders = groups.get(supplierOrder.order_item_id) ?? []
      groups.set(supplierOrder.order_item_id, [...currentOrders, supplierOrder])

      return groups
    }, new Map())
  }, [supplierOrders])

  const supplierOrdersByOrderId = useMemo(() => {
    return supplierOrders.reduce<Map<string, SupplierOrder[]>>((groups, supplierOrder) => {
      if (!supplierOrder.customer_order_id) return groups

      const currentOrders = groups.get(supplierOrder.customer_order_id) ?? []
      groups.set(supplierOrder.customer_order_id, [...currentOrders, supplierOrder])

      return groups
    }, new Map())
  }, [supplierOrders])

  const cakeTopperProduction = useMemo<CakeTopperProduction[]>(() => {
    const items: CakeTopperProduction[] = cakeToppers.map((topper) => {
      const order = orderById.get(topper.order_id)
      const supplierName = topper.supplier_id
        ? supplierById.get(topper.supplier_id)?.name ?? 'Fornecedor nao definido'
        : null
      const details = {
        childName: topper.child_name,
        age: topper.age,
        theme: topper.theme,
      }

      return {
        id: `cake-topper:${topper.id}`,
        orderId: topper.order_id,
        title: buildCakeTopperTitle(details),
        childName: topper.child_name,
        age: topper.age,
        theme: topper.theme,
        supplierName,
        cost: topper.cost,
        photoUrl: topper.photo_url,
        origin: order ? getCustomerName(order, customerById) : 'Pedido sem cliente',
      }
    })
    const existingKeys = new Set(items.map(getCakeTopperDedupeKey))

    supplierOrders.forEach((supplierOrder) => {
      const details = readCakeTopperDetails(supplierOrder)
      if (!details) return

      const order = supplierOrder.customer_order_id
        ? orderById.get(supplierOrder.customer_order_id)
        : undefined
      const supplierName = supplierOrder.supplier_id
        ? supplierById.get(supplierOrder.supplier_id)?.name ?? 'Fornecedor nao definido'
        : null
      const item: CakeTopperProduction = {
        id: `supplier-topper:${supplierOrder.id}`,
        orderId: supplierOrder.customer_order_id,
        title: buildCakeTopperTitle(details),
        childName: details.childName,
        age: details.age,
        theme: details.theme,
        supplierName,
        cost: supplierOrder.estimated_cost,
        photoUrl: details.photoUrl,
        origin: order ? getCustomerName(order, customerById) : 'Pedido sem cliente',
      }
      const dedupeKey = getCakeTopperDedupeKey(item)

      if (existingKeys.has(dedupeKey)) return

      existingKeys.add(dedupeKey)
      items.push(item)
    })

    return items.sort((firstItem, secondItem) => firstItem.title.localeCompare(secondItem.title))
  }, [cakeToppers, customerById, orderById, supplierById, supplierOrders])

  const productionSummary = useMemo(() => {
    const internalAccumulator = new Map<string, ProductionAccumulator>()
    const thirdPartyAccumulator = new Map<string, ProductionAccumulator>()

    orders.forEach((order) => {
      const customerName = getCustomerName(order, customerById)
      const productionItems = getProductionSourceItems(orderItemsByOrderId.get(order.id) ?? [])

      productionItems.forEach((item) => {
        const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
        const supplierOrder = supplierOrdersByOrderItemId.get(item.id)?.[0]
        const isThirdParty = recipe?.is_third_party === true || Boolean(supplierOrder)
        const title = (recipe?.name || item.item_name || 'Item sem nome').trim()
        const category = recipe?.category?.trim() || 'Sem categoria'
        const supplierId = supplierOrder?.supplier_id ?? recipe?.supplier_id ?? null
        const supplierName = supplierId
          ? supplierById.get(supplierId)?.name ?? 'Fornecedor nao definido'
          : supplierOrder
            ? 'Fornecedor nao definido'
            : null
        const key = item.recipe_id
          ? `${isThirdParty ? 'third' : 'internal'}:recipe:${item.recipe_id}`
          : `${isThirdParty ? 'third' : 'internal'}:name:${normalizeGroupKey(title)}:${normalizeGroupKey(
              category
            )}`

        addProductionItem(isThirdParty ? thirdPartyAccumulator : internalAccumulator, {
          key,
          kind: isThirdParty ? 'third_party' : 'internal',
          title,
          category,
          quantity: parseNumericValue(item.quantity),
          unit: supplierOrder?.unit?.trim() || 'unidades',
          supplierName,
          origin: customerName,
          orderId: order.id,
        })
      })
    })

    supplierOrders.forEach((supplierOrder) => {
      if (supplierOrder.order_item_id) return
      if (readCakeTopperDetails(supplierOrder)) return

      const order = supplierOrder.customer_order_id
        ? orderById.get(supplierOrder.customer_order_id)
        : undefined
      const supplierName = supplierOrder.supplier_id
        ? supplierById.get(supplierOrder.supplier_id)?.name ?? 'Fornecedor nao definido'
        : 'Fornecedor nao definido'

      addProductionItem(thirdPartyAccumulator, {
        key: `third:supplier-order:${supplierOrder.id}`,
        kind: 'third_party',
        title: supplierOrder.title || 'Item terceirizado',
        category: 'Terceirizados',
        quantity: parseNumericValue(supplierOrder.quantity),
        unit: supplierOrder.unit?.trim() || 'unidades',
        supplierName,
        origin: order ? getCustomerName(order, customerById) : 'Pedido sem cliente',
        orderId: supplierOrder.customer_order_id ?? supplierOrder.id,
      })
    })

    return {
      internal: finalizeProductionItems(internalAccumulator),
      thirdParty: finalizeProductionItems(thirdPartyAccumulator),
    }
  }, [
    customerById,
    orderById,
    orderItemsByOrderId,
    orders,
    recipeById,
    supplierById,
    supplierOrders,
    supplierOrdersByOrderItemId,
  ])

  const orderViews = useMemo<ProductionOrderView[]>(() => {
    return orders.map((order) => {
      const items = getProductionSourceItems(orderItemsByOrderId.get(order.id) ?? [])
      const productionItems = items.filter((item) => {
        const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
        const hasSupplierOrder = (supplierOrdersByOrderItemId.get(item.id) ?? []).length > 0

        return recipe?.is_third_party !== true && !hasSupplierOrder
      })
      const thirdPartyItems = items.filter((item) => {
        const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
        const hasSupplierOrder = (supplierOrdersByOrderItemId.get(item.id) ?? []).length > 0

        return recipe?.is_third_party === true || hasSupplierOrder
      })

      return {
        order,
        customerName: getCustomerName(order, customerById),
        productionItems,
        thirdPartyItems,
        supplierOrders: supplierOrdersByOrderId.get(order.id) ?? [],
        cakeToppers: cakeTopperProduction.filter((topper) => topper.orderId === order.id),
      }
    })
  }, [
    cakeTopperProduction,
    customerById,
    orderItemsByOrderId,
    orders,
    recipeById,
    supplierOrdersByOrderId,
    supplierOrdersByOrderItemId,
  ])

  const totalInternalQuantity = productionSummary.internal.reduce(
    (sum, item) => sum + item.quantity,
    0
  )
  const totalThirdPartyQuantity = productionSummary.thirdParty.reduce(
    (sum, item) => sum + item.quantity,
    0
  )
  const internalGroups = groupByCategory(productionSummary.internal)

  function handlePeriodChange(nextPeriod: PeriodPreset) {
    setPeriod(nextPeriod)
  }

  function handleCustomStartChange(value: string) {
    setCustomStartDate(value)
    setPeriod('custom')
  }

  function handleCustomEndChange(value: string) {
    setCustomEndDate(value)
    setPeriod('custom')
  }

  function renderSummaryItem(item: ProductionSummaryItem) {
    return (
      <article
        key={item.key}
        className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-lg font-bold uppercase text-[#1A0A08]">
              {item.title}
            </p>
            <p className="mt-1 text-sm text-[#999999]">Origem: {item.origins.join(', ')}</p>
            {item.supplierName && (
              <p className="mt-1 text-sm font-semibold text-[#C9A84C]">
                Fornecedor: {item.supplierName}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#999999]">Total</p>
            <p className="text-xl font-bold text-[#1A0A08]">
              {formatNumber(item.quantity)} {item.unit}
            </p>
          </div>
        </div>
      </article>
    )
  }

  function renderCakeTopper(topper: CakeTopperProduction) {
    return (
      <article
        key={topper.id}
        className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {topper.photoUrl ? (
            <Image
              src={topper.photoUrl}
              alt="Referencia do topo personalizado"
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-lg border border-[rgba(26,10,8,0.07)] object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C9A84C]">
              <ImageIcon size={28} aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="break-words text-base font-bold text-[#1A0A08]">{topper.title}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#6F625F] sm:grid-cols-2">
              <p>Nome: {topper.childName || 'Nao informado'}</p>
              <p>Idade: {topper.age || 'Nao informado'}</p>
              <p>Tema: {topper.theme || 'Nao informado'}</p>
              <p>Origem: {topper.origin}</p>
              <p>Fornecedor: {topper.supplierName || 'Nao informado'}</p>
              <p>Custo: {topper.cost == null ? 'Nao informado' : formatCurrency(topper.cost)}</p>
            </div>
            {topper.photoUrl && (
              <a
                href={topper.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#C0392B] hover:underline"
              >
                <ExternalLink size={15} aria-hidden="true" />
                Abrir imagem
              </a>
            )}
          </div>
        </div>
      </article>
    )
  }

  function renderOrderItem(item: OrderItem) {
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    const supplierOrder = supplierOrdersByOrderItemId.get(item.id)?.[0]
    const supplierName = supplierOrder?.supplier_id
      ? supplierById.get(supplierOrder.supplier_id)?.name ?? 'Fornecedor nao definido'
      : recipe?.supplier_id
        ? supplierById.get(recipe.supplier_id)?.name ?? 'Fornecedor nao definido'
        : null

    return (
      <li key={item.id} className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-[#1A0A08]">
            {formatNumber(item.quantity)}x {recipe?.name || item.item_name || 'Produto'}
          </span>
          {supplierName && <span className="text-[#C9A84C]">{supplierName}</span>}
        </div>
        {item.notes && <p className="mt-1 text-xs text-[#999999]">{item.notes}</p>}
      </li>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF6F0] pb-28 lg:pb-8">
      <div className="border-b border-[rgba(26,10,8,0.07)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
            PRODUÇÃO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A0A08]">Produção</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6F625F]">
            Veja o que precisa ser produzido por dia ou período.
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

        <section className="mb-5 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                Periodo
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {periodOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handlePeriodChange(option.id)}
                    className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      period === option.id
                        ? 'bg-[#C0392B] text-white'
                        : 'border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                    Data inicial
                  </span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => handleCustomStartChange(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                    Data final
                  </span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => handleCustomEndChange(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                Visualizacao
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-80">
                {viewModeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setViewMode(option.id)}
                    className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      viewMode === option.id
                        ? 'bg-[#C0392B] text-white'
                        : 'border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="flex min-h-11 items-center gap-2 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08]">
                <input
                  type="checkbox"
                  checked={includeDelivered}
                  onChange={(event) => setIncludeDelivered(event.target.checked)}
                  className="h-4 w-4 rounded border-[rgba(26,10,8,0.18)] accent-[#C0392B]"
                />
                Incluir entregues
              </label>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[16px] bg-[#1A0A08] p-4 text-white">
            <CalendarDays size={20} className="text-[#C9A84C]" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#E8D9D4]">
              Pedidos no periodo
            </p>
            <p className="mt-1 text-2xl font-bold">{orders.length}</p>
          </div>
          <div className="rounded-[16px] bg-white p-4 text-[#1A0A08]">
            <ChefHat size={20} className="text-[#C0392B]" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#999999]">
              Itens internos a produzir
            </p>
            <p className="mt-1 text-2xl font-bold">{formatNumber(totalInternalQuantity)}</p>
          </div>
          <div className="rounded-[16px] bg-white p-4 text-[#1A0A08]">
            <Truck size={20} className="text-[#C9A84C]" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#999999]">
              Itens terceirizados
            </p>
            <p className="mt-1 text-2xl font-bold">{formatNumber(totalThirdPartyQuantity)}</p>
          </div>
          <div className="rounded-[16px] bg-white p-4 text-[#1A0A08]">
            <PackageCheck size={20} className="text-[#27AE60]" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#999999]">
              Topos personalizados
            </p>
            <p className="mt-1 text-2xl font-bold">{cakeTopperProduction.length}</p>
          </div>
        </section>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando producao...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] bg-white px-4 py-12 text-center">
            <ClipboardList
              className="mx-auto mb-4 h-11 w-11 text-[#C9A84C]"
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-[#1A0A08]">
              Nenhum pedido no periodo
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              Ajuste as datas ou inclua pedidos entregues para revisar producoes passadas.
            </p>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-lg font-bold text-[#1A0A08]">Produção interna</h2>
              {productionSummary.internal.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] bg-white p-5 text-sm text-[#999999]">
                  Nenhum item interno para produzir neste periodo.
                </div>
              ) : (
                <div className="space-y-4">
                  {internalGroups.map(([category, items]) => (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#C9A84C]">
                        {category}
                      </p>
                      <div className="space-y-3">{items.map(renderSummaryItem)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold text-[#1A0A08]">Terceirizados</h2>
              {productionSummary.thirdParty.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] bg-white p-5 text-sm text-[#999999]">
                  Nenhum item terceirizado neste periodo.
                </div>
              ) : (
                <div className="space-y-3">
                  {productionSummary.thirdParty.map(renderSummaryItem)}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold text-[#1A0A08]">Topos personalizados</h2>
              {cakeTopperProduction.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] bg-white p-5 text-sm text-[#999999]">
                  Nenhum topo personalizado encontrado neste periodo.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {cakeTopperProduction.map(renderCakeTopper)}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-[#1A0A08]">Por pedido</h2>
            {orderViews.map((orderView) => {
              const orderDate = getPrimaryOrderDate(orderView.order)
              const deliveryTime = orderView.order.delivery_time?.trim()
              const externalSupplierOrders = orderView.supplierOrders.filter(
                (supplierOrder) => !readCakeTopperDetails(supplierOrder)
              )

              return (
                <article
                  key={orderView.order.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4"
                >
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                        {formatDate(orderDate)}
                        {deliveryTime ? ` as ${deliveryTime}` : ''}
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-[#1A0A08]">
                        {orderView.customerName}
                      </h3>
                      <p className="mt-1 text-sm text-[#999999]">
                        Status: {orderView.order.status || 'Sem status'}
                      </p>
                    </div>
                    <Link
                      href={`/pedidos/${orderView.order.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#FAF6F0]"
                    >
                      Ver pedido
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-bold text-[#1A0A08]">
                        Produção interna
                      </p>
                      {orderView.productionItems.length === 0 ? (
                        <p className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm text-[#999999]">
                          Sem itens internos.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {orderView.productionItems.map(renderOrderItem)}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-bold text-[#1A0A08]">
                        Terceirizados
                      </p>
                      {orderView.thirdPartyItems.length === 0 &&
                      externalSupplierOrders.length === 0 ? (
                        <p className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm text-[#999999]">
                          Sem terceirizados.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {orderView.thirdPartyItems.map(renderOrderItem)}
                          {externalSupplierOrders.map((supplierOrder) => (
                            <li
                              key={supplierOrder.id}
                              className="rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm"
                            >
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <span className="font-semibold text-[#1A0A08]">
                                  {formatNumber(supplierOrder.quantity)}x {supplierOrder.title}
                                </span>
                                <span className="text-[#C9A84C]">
                                  {supplierOrder.supplier_id
                                    ? supplierById.get(supplierOrder.supplier_id)?.name ??
                                      'Fornecedor nao definido'
                                    : 'Fornecedor nao definido'}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {orderView.cakeToppers.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-bold text-[#1A0A08]">
                        Topos personalizados
                      </p>
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {orderView.cakeToppers.map(renderCakeTopper)}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}
