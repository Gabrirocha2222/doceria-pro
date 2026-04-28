'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  DollarSign,
  PackageCheck,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type NumericValue = number | string | null | undefined

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type CustomerSummary = {
  id: string
  name: string | null
  phone: string | null
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

type OrderCakeTopper = {
  id: string
  order_id: string
  cost: NumericValue
}

type Order = {
  id: string
  customer_id?: string | null
  customer_name?: string | null
  product_name?: string | null
  description?: string | null
  delivery_date?: string | null
  delivery_time?: string | null
  total_value?: NumericValue
  deposit_value?: NumericValue
  down_payment?: NumericValue
  remaining_amount?: NumericValue
  remaining_value?: NumericValue
  remaining_payment_date?: string | null
  status?: string | null
  created_at?: string | null
  notes?: string | null
  customers?: CustomerSummary | null
  order_items?: OrderItem[]
  order_cake_toppers?: OrderCakeTopper[]
}

type SupplierOrder = {
  id: string
  title: string
  due_date: string | null
  status: string
  estimated_cost?: NumericValue
  customer_order_id?: string | null
}

type RecipeCost = {
  id: string
  total_cost?: NumericValue
  cost_per_unit?: NumericValue
  supplier_cost?: NumericValue
  supplier_cost_unit?: string | null
  is_third_party?: boolean | null
}

type DateRange = {
  start: string
  end: string
}

type PeriodSummary = {
  revenue: number
  profit: number
  orderCount: number
  receivable: number
  hasSimpleProfit: boolean
}

type Notification = {
  id: string
  title: string
  description: string
  tone: 'danger' | 'warning' | 'info'
}

const emptyDashboardData = {
  orders: [] as Order[],
  supplierOrders: [] as SupplierOrder[],
  recipeCostsById: new Map<string, RecipeCost>(),
}

const simpleProfitMargin = 0.4
const upcomingDays = 14

function parseNumericValue(value: NumericValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
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
    fullError: error,
  })
}

function formatCurrency(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseNumericValue(value))
}

function formatCompactCurrency(value: NumericValue) {
  const parsedValue = parseNumericValue(value)

  if (parsedValue >= 1000) {
    return `R$ ${(parsedValue / 1000).toFixed(1).replace('.', ',')}k`
  }

  return formatCurrency(parsedValue)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function normalizeDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null
}

function formatDate(date: string | null | undefined) {
  const normalizedDate = normalizeDate(date)
  if (!normalizedDate) return 'Sem data'

  return new Date(`${normalizedDate}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatDateTitle(date: string) {
  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatCurrentDate() {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  const formatted = now.toLocaleDateString('pt-BR', options)

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function getCurrentWeekRange(): DateRange {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const start = addDays(today, mondayOffset)
  const end = addDays(start, 6)

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

function isDateInRange(date: string | null | undefined, range: DateRange) {
  const normalizedDate = normalizeDate(date)

  return Boolean(normalizedDate && normalizedDate >= range.start && normalizedDate <= range.end)
}

function isActiveOrder(order: Order) {
  return order.status !== 'cancelado'
}

function getCustomerName(order: Order) {
  return order.customers?.name || order.customer_name || 'Cliente nao informado'
}

function getOrderTitle(order: Order) {
  const mainItem = order.order_items?.find((item) => !item.parent_order_item_id)

  return mainItem?.item_name || order.product_name || order.description || 'Pedido sem resumo'
}

function getOrderTotal(order: Order) {
  return parseNumericValue(order.total_value)
}

function getOrderReceivable(order: Order) {
  const remainingAmount = parseNumericValue(order.remaining_amount ?? order.remaining_value)

  if (remainingAmount > 0) return remainingAmount

  return Math.max(getOrderTotal(order) - parseNumericValue(order.down_payment ?? order.deposit_value), 0)
}

function normalizeCostUnit(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function calculateItemCost(item: OrderItem, recipeCostsById: Map<string, RecipeCost>) {
  if (!item.recipe_id) {
    return {
      cost: 0,
      hasCost: false,
    }
  }

  const recipe = recipeCostsById.get(item.recipe_id)
  if (!recipe) {
    return {
      cost: 0,
      hasCost: false,
    }
  }

  const quantity = parseNumericValue(item.quantity)
  const supplierCost = parseNumericValue(recipe.supplier_cost)
  const supplierCostUnit = normalizeCostUnit(recipe.supplier_cost_unit)

  if (recipe.is_third_party && supplierCost > 0) {
    if (supplierCostUnit === 'pedido') {
      return {
        cost: supplierCost,
        hasCost: true,
      }
    }

    return {
      cost: quantity * supplierCost,
      hasCost: true,
    }
  }

  const costPerUnit = parseNumericValue(recipe.cost_per_unit)
  if (costPerUnit > 0) {
    return {
      cost: quantity * costPerUnit,
      hasCost: true,
    }
  }

  const totalCost = parseNumericValue(recipe.total_cost)
  if (totalCost > 0) {
    return {
      cost: quantity * totalCost,
      hasCost: true,
    }
  }

  return {
    cost: 0,
    hasCost: false,
  }
}

function calculateOrderCost(order: Order, recipeCostsById: Map<string, RecipeCost>) {
  const items = order.order_items ?? []
  const childrenByParentId = items.reduce<Map<string, OrderItem[]>>((groups, item) => {
    if (!item.parent_order_item_id) return groups

    const currentItems = groups.get(item.parent_order_item_id) ?? []
    groups.set(item.parent_order_item_id, [...currentItems, item])

    return groups
  }, new Map())

  const mainItems = items.filter((item) => !item.parent_order_item_id)
  let cost = (order.order_cake_toppers ?? []).reduce(
    (sum, cakeTopper) => sum + parseNumericValue(cakeTopper.cost),
    0
  )
  let hasCost = cost > 0

  mainItems.forEach((item) => {
    const itemCost = calculateItemCost(item, recipeCostsById)

    if (itemCost.hasCost) {
      cost += itemCost.cost
      hasCost = true
      return
    }

    ;(childrenByParentId.get(item.id) ?? []).forEach((childItem) => {
      const childCost = calculateItemCost(childItem, recipeCostsById)

      if (childCost.hasCost) {
        cost += childCost.cost
        hasCost = true
      }
    })
  })

  if (mainItems.length === 0) {
    items.forEach((item) => {
      const itemCost = calculateItemCost(item, recipeCostsById)

      if (itemCost.hasCost) {
        cost += itemCost.cost
        hasCost = true
      }
    })
  }

  return {
    cost,
    hasCost,
  }
}

function calculatePeriodSummary(
  orders: Order[],
  range: DateRange,
  recipeCostsById: Map<string, RecipeCost>
): PeriodSummary {
  const ordersInPeriod = orders.filter(
    (order) => isActiveOrder(order) && isDateInRange(order.delivery_date, range)
  )
  const receivable = orders
    .filter((order) => {
      if (!isActiveOrder(order)) return false

      const referenceDate = order.remaining_payment_date || order.delivery_date

      return isDateInRange(referenceDate, range)
    })
    .reduce((sum, order) => sum + getOrderReceivable(order), 0)

  return ordersInPeriod.reduce<PeriodSummary>(
    (summary, order) => {
      const revenue = getOrderTotal(order)
      const orderCost = calculateOrderCost(order, recipeCostsById)
      const profit = orderCost.hasCost ? revenue - orderCost.cost : revenue * simpleProfitMargin

      return {
        revenue: summary.revenue + revenue,
        profit: summary.profit + profit,
        orderCount: summary.orderCount + 1,
        receivable,
        hasSimpleProfit: summary.hasSimpleProfit || !orderCost.hasCost,
      }
    },
    {
      revenue: 0,
      profit: 0,
      orderCount: 0,
      receivable,
      hasSimpleProfit: false,
    }
  )
}

function groupOrdersByDate(orders: Order[]) {
  const groups = orders.reduce<Map<string, Order[]>>((currentGroups, order) => {
    const deliveryDate = normalizeDate(order.delivery_date)
    if (!deliveryDate) return currentGroups

    const currentOrders = currentGroups.get(deliveryDate) ?? []
    currentGroups.set(deliveryDate, [...currentOrders, order])

    return currentGroups
  }, new Map())

  return Array.from(groups.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, groupedOrders]) => ({
      date,
      orders: groupedOrders.sort((firstOrder, secondOrder) =>
        (firstOrder.delivery_time || '99:99').localeCompare(secondOrder.delivery_time || '99:99')
      ),
    }))
}

function buildNotifications(params: {
  orders: Order[]
  supplierOrders: SupplierOrder[]
  today: string
}): Notification[] {
  const { orders, supplierOrders, today } = params
  const todayOrders = orders.filter(
    (order) => isActiveOrder(order) && normalizeDate(order.delivery_date) === today
  )
  const ordersWithoutDate = orders.filter((order) => isActiveOrder(order) && !order.delivery_date)
  const dueTodayOrOverdue = orders.filter((order) => {
    const receivable = getOrderReceivable(order)
    const paymentDate = normalizeDate(order.remaining_payment_date)

    return isActiveOrder(order) && receivable > 0 && Boolean(paymentDate && paymentDate <= today)
  })
  const nextPaymentLimit = formatInputDate(addDays(new Date(`${today}T00:00:00`), 3))
  const dueSoon = orders.filter((order) => {
    const receivable = getOrderReceivable(order)
    const paymentDate = normalizeDate(order.remaining_payment_date)

    return (
      isActiveOrder(order) &&
      receivable > 0 &&
      Boolean(paymentDate && paymentDate > today && paymentDate <= nextPaymentLimit)
    )
  })

  const notifications: Notification[] = []

  if (supplierOrders.length > 0) {
    notifications.push({
      id: 'supplier-orders',
      title: `${formatNumber(supplierOrders.length)} pedido(s) de fornecedor pendente(s)`,
      description: `Custo estimado pendente: ${formatCurrency(
        supplierOrders.reduce((sum, order) => sum + parseNumericValue(order.estimated_cost), 0)
      )}`,
      tone: 'warning',
    })
  }

  if (todayOrders.length > 0) {
    notifications.push({
      id: 'today-orders',
      title: `${formatNumber(todayOrders.length)} pedido(s) para hoje`,
      description: 'Confira producao, retirada e entrega antes do horario combinado.',
      tone: 'info',
    })
  }

  if (ordersWithoutDate.length > 0) {
    notifications.push({
      id: 'missing-date',
      title: `${formatNumber(ordersWithoutDate.length)} pedido(s) sem data`,
      description: 'Complete a data de entrega/festa para entrar no planejamento.',
      tone: 'danger',
    })
  }

  if (dueTodayOrOverdue.length > 0) {
    notifications.push({
      id: 'receivable-due',
      title: `${formatNumber(dueTodayOrOverdue.length)} recebimento(s) hoje ou vencido(s)`,
      description: `Total a acompanhar: ${formatCurrency(
        dueTodayOrOverdue.reduce((sum, order) => sum + getOrderReceivable(order), 0)
      )}`,
      tone: 'danger',
    })
  }

  if (dueSoon.length > 0) {
    notifications.push({
      id: 'receivable-soon',
      title: `${formatNumber(dueSoon.length)} recebimento(s) nos proximos 3 dias`,
      description: `Total previsto: ${formatCurrency(
        dueSoon.reduce((sum, order) => sum + getOrderReceivable(order), 0)
      )}`,
      tone: 'warning',
    })
  }

  return notifications
}

async function loadSupplierOrders(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<SupplierOrder[]> {
  const { data, error } = await supabase
    .from('supplier_orders')
    .select('id, title, due_date, status, estimated_cost, customer_order_id')
    .eq('user_id', userId)
    .eq('status', 'pendente')
    .order('due_date', { ascending: true })

  if (!error) return (data ?? []) as SupplierOrder[]

  logSupabaseError('Erro Supabase supplier_orders select:', error)

  const fallback = await supabase
    .from('supplier_orders')
    .select('id, title, due_date, status, customer_order_id')
    .eq('user_id', userId)
    .eq('status', 'pendente')
    .order('due_date', { ascending: true })

  if (fallback.error) {
    logSupabaseError('Erro Supabase supplier_orders fallback select:', fallback.error)
    return []
  }

  return ((fallback.data ?? []) as SupplierOrder[]).map((order) => ({
    ...order,
    estimated_cost: null,
  }))
}

async function loadRecipeCosts(supabase: ReturnType<typeof createClient>, recipeIds: string[]) {
  if (recipeIds.length === 0) return new Map<string, RecipeCost>()

  const { data, error } = await supabase
    .from('recipes')
    .select('id, total_cost, cost_per_unit, supplier_cost, supplier_cost_unit, is_third_party')
    .in('id', recipeIds)

  if (!error) {
    return new Map(((data ?? []) as RecipeCost[]).map((recipe) => [recipe.id, recipe]))
  }

  logSupabaseError('Erro Supabase recipes cost select:', error)

  const fallback = await supabase
    .from('recipes')
    .select('id, total_cost, cost_per_unit')
    .in('id', recipeIds)

  if (fallback.error) {
    logSupabaseError('Erro Supabase recipes cost fallback select:', fallback.error)
    return new Map<string, RecipeCost>()
  }

  return new Map(((fallback.data ?? []) as RecipeCost[]).map((recipe) => [recipe.id, recipe]))
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Confeiteira')
  const [dashboardData, setDashboardData] = useState(emptyDashboardData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const currentDate = useMemo(() => formatCurrentDate(), [])
  const today = useMemo(() => formatInputDate(new Date()), [])
  const weekRange = useMemo(() => getCurrentWeekRange(), [])
  const monthRange = useMemo(() => getCurrentMonthRange(), [])
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      setIsLoading(true)
      setError('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuaria nao autenticada')
        }

        if (isMounted) {
          if (user.user_metadata?.full_name) {
            setUserName(user.user_metadata.full_name.split(' ')[0])
          } else if (user.email) {
            setUserName(
              user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)
            )
          }
        }

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

        const [orderItemsResult, cakeToppersResult, supplierOrders] = await Promise.all([
          supabase
            .from('order_items')
            .select(
              'id, order_id, recipe_id, parent_order_item_id, item_name, quantity, unit_price, subtotal, notes'
            )
            .eq('user_id', user.id),
          supabase.from('order_cake_toppers').select('id, order_id, cost').eq('user_id', user.id),
          loadSupplierOrders(supabase, user.id),
        ])

        let orderItems: OrderItem[] = []
        if (orderItemsResult.error) {
          logSupabaseError('Erro Supabase order_items select:', orderItemsResult.error)
        } else {
          orderItems = (orderItemsResult.data ?? []) as OrderItem[]
        }

        let cakeToppers: OrderCakeTopper[] = []
        if (cakeToppersResult.error) {
          logSupabaseError('Erro Supabase order_cake_toppers select:', cakeToppersResult.error)
        } else {
          cakeToppers = (cakeToppersResult.data ?? []) as OrderCakeTopper[]
        }

        const recipeIds = Array.from(
          new Set(orderItems.map((item) => item.recipe_id).filter((id): id is string => Boolean(id)))
        )
        const customerIds = Array.from(
          new Set(orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)))
        )
        const recipeCostsById = await loadRecipeCosts(supabase, recipeIds)
        const customersById = new Map<string, CustomerSummary>()

        if (customerIds.length > 0) {
          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('id, name, phone')
            .eq('user_id', user.id)
            .in('id', customerIds)

          if (customersError) {
            logSupabaseError('Erro Supabase customers select:', customersError)
          } else {
            ;((customersData ?? []) as CustomerSummary[]).forEach((customer) => {
              customersById.set(customer.id, customer)
            })
          }
        }

        const itemsByOrderId = orderItems.reduce<Map<string, OrderItem[]>>((groups, item) => {
          const currentItems = groups.get(item.order_id) ?? []
          groups.set(item.order_id, [...currentItems, item])

          return groups
        }, new Map())
        const cakeToppersByOrderId = cakeToppers.reduce<Map<string, OrderCakeTopper[]>>(
          (groups, cakeTopper) => {
            const currentItems = groups.get(cakeTopper.order_id) ?? []
            groups.set(cakeTopper.order_id, [...currentItems, cakeTopper])

            return groups
          },
          new Map()
        )

        const hydratedOrders = orders.map((order) => ({
          ...order,
          customers: order.customer_id ? customersById.get(order.customer_id) ?? null : null,
          order_items: itemsByOrderId.get(order.id) ?? [],
          order_cake_toppers: cakeToppersByOrderId.get(order.id) ?? [],
        }))

        if (isMounted) {
          setDashboardData({
            orders: hydratedOrders,
            supplierOrders,
            recipeCostsById,
          })
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
        if (isMounted) {
          setError('Falha ao carregar dados do dashboard')
          setDashboardData(emptyDashboardData)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadDashboardData()
    }, 0)

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [supabase])

  const activeOrders = useMemo(
    () => dashboardData.orders.filter((order) => isActiveOrder(order)),
    [dashboardData.orders]
  )

  const todayOrders = useMemo(() => {
    return activeOrders
      .filter((order) => normalizeDate(order.delivery_date) === today)
      .sort((firstOrder, secondOrder) =>
        (firstOrder.delivery_time || '99:99').localeCompare(secondOrder.delivery_time || '99:99')
      )
  }, [activeOrders, today])

  const upcomingOrdersByDate = useMemo(() => {
    const endDate = formatInputDate(addDays(new Date(`${today}T00:00:00`), upcomingDays))
    const orders = activeOrders.filter((order) => {
      const deliveryDate = normalizeDate(order.delivery_date)

      return Boolean(deliveryDate && deliveryDate > today && deliveryDate <= endDate)
    })

    return groupOrdersByDate(orders)
  }, [activeOrders, today])

  const weekSummary = useMemo(
    () => calculatePeriodSummary(activeOrders, weekRange, dashboardData.recipeCostsById),
    [activeOrders, dashboardData.recipeCostsById, weekRange]
  )
  const monthSummary = useMemo(
    () => calculatePeriodSummary(activeOrders, monthRange, dashboardData.recipeCostsById),
    [activeOrders, dashboardData.recipeCostsById, monthRange]
  )

  const notifications = useMemo(
    () =>
      buildNotifications({
        orders: activeOrders,
        supplierOrders: dashboardData.supplierOrders,
        today,
      }),
    [activeOrders, dashboardData.supplierOrders, today]
  )

  const weeklyChartData = useMemo(() => {
    const startDate = new Date(`${weekRange.start}T00:00:00`)

    return Array.from({ length: 7 }, (_, index) => {
      const date = formatInputDate(addDays(startDate, index))
      const revenue = activeOrders
        .filter((order) => normalizeDate(order.delivery_date) === date)
        .reduce((sum, order) => sum + getOrderTotal(order), 0)

      return {
        day: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }),
        value: revenue,
      }
    })
  }, [activeOrders, weekRange.start])

  const maxChartValue = Math.max(...weeklyChartData.map((data) => data.value), 1)
  const hasBellAlert = notifications.length > 0

  const metricCards = [
    {
      label: 'Faturamento semanal',
      value: formatCurrency(weekSummary.revenue),
      helper: `${formatNumber(weekSummary.orderCount)} pedido(s)`,
      icon: DollarSign,
    },
    {
      label: 'Lucro estimado semanal',
      value: formatCurrency(weekSummary.profit),
      helper: weekSummary.hasSimpleProfit ? 'Estimativa simples em parte' : 'Com custos cadastrados',
      icon: TrendingUp,
    },
    {
      label: 'Pedidos semanais',
      value: formatNumber(weekSummary.orderCount),
      helper: `${formatDate(weekRange.start)} a ${formatDate(weekRange.end)}`,
      icon: Receipt,
    },
    {
      label: 'A receber semanal',
      value: formatCurrency(weekSummary.receivable),
      helper: 'Por data de recebimento ou entrega',
      icon: Wallet,
    },
    {
      label: 'Faturamento mensal',
      value: formatCurrency(monthSummary.revenue),
      helper: `${formatNumber(monthSummary.orderCount)} pedido(s)`,
      icon: DollarSign,
    },
    {
      label: 'Lucro estimado mensal',
      value: formatCurrency(monthSummary.profit),
      helper: monthSummary.hasSimpleProfit ? 'Estimativa simples em parte' : 'Com custos cadastrados',
      icon: TrendingUp,
    },
    {
      label: 'Pedidos mensais',
      value: formatNumber(monthSummary.orderCount),
      helper: `${formatDate(monthRange.start)} a ${formatDate(monthRange.end)}`,
      icon: Receipt,
    },
    {
      label: 'A receber no mes',
      value: formatCurrency(monthSummary.receivable),
      helper: 'Por data de recebimento ou entrega',
      icon: Wallet,
    },
  ]

  function renderOrderRow(order: Order) {
    const customerName = getCustomerName(order)
    const initials = customerName
      .split(' ')
      .map((namePart) => namePart[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    return (
      <Link
        key={order.id}
        href={`/pedidos/${order.id}`}
        className="block overflow-hidden rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white transition-shadow hover:shadow-md"
      >
        <div className="flex flex-col gap-3 border-l-4 border-[#C0392B] p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#C0392B] text-sm font-bold text-white">
              {initials || 'DP'}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#1A0A08]">{customerName}</p>
              <p className="truncate text-sm text-[#999999]">{getOrderTitle(order)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:flex-shrink-0 sm:justify-end">
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-[#1A0A08]">
                {order.delivery_time || 'Sem horario'}
              </p>
              <p className="text-sm font-bold text-[#C9A84C]">{formatCurrency(order.total_value)}</p>
            </div>
            <span className="rounded-full bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold text-[#1A0A08]">
              {order.status || 'novo'}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="w-full pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 hidden border-b border-[rgba(26,10,8,0.07)] bg-white lg:block">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A0A08]">Bom dia, {userName}</h1>
            <p className="text-sm text-[#999999]">{currentDate}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell
                size={24}
                className="cursor-pointer text-[#1A0A08] transition-colors hover:text-[#C0392B]"
                aria-hidden="true"
              />
              {hasBellAlert && (
                <div className="absolute right-0 top-0 h-2 w-2 rounded-full bg-[#C0392B]" />
              )}
            </div>
            <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#C0392B] text-sm font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando painel operacional...</p>
          </div>
        ) : (
          <>
            <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                      Operacao de hoje
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[#1A0A08]">
                      {formatNumber(todayOrders.length)} pedido(s) para hoje
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/pedidos/novo')}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
                  >
                    <Plus size={18} aria-hidden="true" />
                    <span>Novo pedido</span>
                  </button>
                </div>

                {todayOrders.length === 0 ? (
                  <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] px-4 py-8 text-center">
                    <PackageCheck
                      className="mx-auto mb-3 h-10 w-10 text-[#C9A84C]"
                      aria-hidden="true"
                    />
                    <p className="font-semibold text-[#1A0A08]">Nenhum pedido para hoje</p>
                    <p className="mt-1 text-sm text-[#999999]">
                      Sua agenda do dia esta livre no dashboard.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">{todayOrders.map((order) => renderOrderRow(order))}</div>
                )}
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-[#C0392B]" aria-hidden="true" />
                  <h2 className="text-lg font-bold text-[#1A0A08]">Notificacoes importantes</h2>
                </div>

                {notifications.length === 0 ? (
                  <div className="rounded-[16px] bg-[#FAF6F0] px-4 py-8 text-center">
                    <p className="font-semibold text-[#1A0A08]">Nada critico agora</p>
                    <p className="mt-1 text-sm text-[#999999]">
                      Pedidos, fornecedores e recebimentos estao sem alerta.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const toneClass =
                        notification.tone === 'danger'
                          ? 'border-red-200 bg-red-50 text-[#C0392B]'
                          : notification.tone === 'warning'
                            ? 'border-[#F1D7A8] bg-[#FFF7E1] text-[#8A6B1F]'
                            : 'border-[#DDE8F6] bg-[#F4F8FD] text-[#1A0A08]'

                      return (
                        <div
                          key={notification.id}
                          className={`rounded-[16px] border p-3 ${toneClass}`}
                        >
                          <p className="font-bold">{notification.title}</p>
                          <p className="mt-1 text-sm opacity-85">{notification.description}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => {
                const Icon = metric.icon

                return (
                  <div
                    key={metric.label}
                    className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-[#999999]">{metric.label}</p>
                      <Icon size={20} className="text-[#C9A84C]" aria-hidden="true" />
                    </div>
                    <p className="text-2xl font-bold text-[#1A0A08]">{metric.value}</p>
                    <p className="mt-2 text-xs font-semibold text-[#6F625F]">{metric.helper}</p>
                  </div>
                )
              })}
            </section>

            <section className="mb-8 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5">
              <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Faturamento da semana</h2>
                  <p className="text-sm text-[#999999]">
                    {formatDate(weekRange.start)} a {formatDate(weekRange.end)}
                  </p>
                </div>
                <p className="text-sm font-bold text-[#C0392B]">
                  Total {formatCurrency(weekSummary.revenue)}
                </p>
              </div>

              <svg viewBox="0 0 600 160" className="h-40 w-full" preserveAspectRatio="xMidYMid meet">
                <line
                  x1="20"
                  y1="130"
                  x2="580"
                  y2="130"
                  stroke="rgba(26,10,8,0.08)"
                  strokeWidth="1"
                />

                {weeklyChartData.map((data, index) => {
                  const barHeight = (data.value / maxChartValue) * 110
                  const x = 20 + index * 80
                  const y = 130 - barHeight
                  const isMax = data.value === maxChartValue && data.value > 0
                  const fill = isMax ? '#C9A84C' : '#C0392B'

                  return (
                    <g key={`${data.day}-${index}`}>
                      <rect
                        x={x + 10}
                        y={y}
                        width="50"
                        height={barHeight}
                        fill={fill}
                        rx="4"
                      />
                      <text
                        x={x + 35}
                        y={barHeight > 12 ? y - 5 : 122}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#1A0A08"
                        fontWeight="500"
                      >
                        {formatCompactCurrency(data.value)}
                      </text>
                      <text x={x + 35} y="145" textAnchor="middle" fontSize="11" fill="#999999">
                        {data.day.replace('.', '')}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={20} className="text-[#C0392B]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[#1A0A08]">
                  Proximos pedidos por dia
                </h2>
              </div>

              {upcomingOrdersByDate.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[rgba(26,10,8,0.16)] bg-white px-4 py-10 text-center">
                  <p className="text-base font-semibold text-[#1A0A08]">
                    Nenhum pedido nos proximos {upcomingDays} dias
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {upcomingOrdersByDate.map((group) => (
                    <div key={group.date}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="font-bold text-[#1A0A08]">{formatDateTitle(group.date)}</h3>
                        <span className="rounded-full bg-[#FAF6F0] px-3 py-1 text-xs font-semibold text-[#999999]">
                          {formatNumber(group.orders.length)} pedido(s)
                        </span>
                      </div>
                      <div className="space-y-3">
                        {group.orders.map((order) => renderOrderRow(order))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <button
          type="button"
          onClick={() => router.push('/pedidos/novo')}
          className="fixed bottom-24 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#C0392B] text-white shadow-lg transition-all duration-200 hover:bg-[#A0301F] active:scale-95 lg:hidden"
          aria-label="Novo pedido"
        >
          <Plus size={28} aria-hidden="true" />
        </button>
      </main>
    </div>
  )
}
