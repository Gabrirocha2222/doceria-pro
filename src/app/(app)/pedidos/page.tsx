'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Edit3, Package, Plus, Search, Trash2 } from 'lucide-react'
import { formatCurrency, parseNumericValue } from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'
import { Pagination, paginate } from '@/components/Pagination'

type NumericValue = number | string | null | undefined
type DateFilter = 'upcoming' | 'today' | 'week' | 'all' | 'undated' | 'finished'

type OrderItem = {
  id: string
  order_id: string
  parent_order_item_id: string | null
  item_name: string | null
  quantity: NumericValue
  unit_price: NumericValue
  subtotal: NumericValue
  notes: string | null
}

type RecurringOccurrence = {
  id: string
  order_id: string
  occurrence_number: number
  status: 'pendente' | 'em_producao' | 'entregue' | 'cancelado'
}

type Customer = {
  id: string
  user_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
}

type Order = {
  id: string
  user_id: string
  customer_id: string | null
  order_date: string | null
  delivery_date: string | null
  delivery_time: string | null
  delivery_address?: string | null
  total_value: NumericValue
  deposit_value: NumericValue
  down_payment: NumericValue
  remaining_amount: NumericValue
  remaining_payment_date?: string | null
  status: string
  payment_status?: string | null
  created_at: string
  updated_at?: string | null
  notes?: string | null
  fulfillment_type?: string | null
  delivery_fee?: NumericValue
  discount_amount?: NumericValue
  manual_total?: NumericValue
  extras_total?: NumericValue
  is_recurring?: boolean | null
  recurrence_type?: string | null
  recurrence_count?: number | null
  first_occurrence_date?: string | null
  order_items?: OrderItem[]
  recurring_order_occurrences?: RecurringOccurrence[]
}

type OrderGroup = {
  id: string
  title: string
  subtitle: string
  tone: 'default' | 'overdue' | 'undated'
  orders: Order[]
}

const finalizedStatuses = new Set(['entregue', 'cancelado'])

const dateFilterOptions: { id: DateFilter; label: string }[] = [
  { id: 'upcoming', label: 'Próximos' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'all', label: 'Todos' },
  { id: 'undated', label: 'Sem data' },
  { id: 'finished', label: 'Finalizados' },
]

const statusOptions = [
  { id: 'todos', label: 'Todos', color: '#1A0A08' },
  { id: 'novo', label: 'Novo', color: '#3498DB' },
  { id: 'confirmado', label: 'Confirmado', color: '#2980B9' },
  { id: 'em_producao', label: 'Em produção', color: '#F39C12' },
  { id: 'pronto', label: 'Pronto', color: '#27AE60' },
  { id: 'entregue', label: 'Entregue', color: '#7F8C8D' },
  { id: 'cancelado', label: 'Cancelado', color: '#C0392B' },
]
function formatDate(date: string | null | undefined) {
  if (!date) return 'Sem data'

  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
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

function getPrimaryOrderDate(order: Order) {
  return order.delivery_date ?? order.order_date
}

function isFinalizedOrder(order: Order) {
  return finalizedStatuses.has(order.status)
}

function normalizeDeliveryTime(time: string | null | undefined) {
  return time?.trim() || '99:99'
}

function compareOrdersBySchedule(firstOrder: Order, secondOrder: Order) {
  const firstDate = getPrimaryOrderDate(firstOrder)
  const secondDate = getPrimaryOrderDate(secondOrder)

  if (firstDate && secondDate && firstDate !== secondDate) {
    return firstDate.localeCompare(secondDate)
  }

  if (firstDate && !secondDate) return -1
  if (!firstDate && secondDate) return 1

  const firstTime = normalizeDeliveryTime(firstOrder.delivery_time)
  const secondTime = normalizeDeliveryTime(secondOrder.delivery_time)

  if (firstTime !== secondTime) return firstTime.localeCompare(secondTime)

  return firstOrder.created_at.localeCompare(secondOrder.created_at)
}

function getOrderViewRank(order: Order, dateFilter: DateFilter, today: string) {
  const orderDate = getPrimaryOrderDate(order)

  if (dateFilter === 'upcoming') {
    if (orderDate && orderDate < today) return 0
    if (orderDate) return 1
    return 2
  }

  return orderDate ? 0 : 1
}

function compareOrdersForView(
  firstOrder: Order,
  secondOrder: Order,
  dateFilter: DateFilter,
  today: string
) {
  const firstRank = getOrderViewRank(firstOrder, dateFilter, today)
  const secondRank = getOrderViewRank(secondOrder, dateFilter, today)

  if (firstRank !== secondRank) return firstRank - secondRank

  return compareOrdersBySchedule(firstOrder, secondOrder)
}

function getDayLabel(date: string, today: string) {
  if (date === today) {
    return { title: 'Hoje', subtitle: formatDate(date) }
  }

  if (date === addDays(today, 1)) {
    return { title: 'Amanhã', subtitle: formatDate(date) }
  }

  const parsedDate = parseInputDate(date)
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(parsedDate)
  const formattedDay = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(parsedDate)

  return {
    title: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    subtitle: formattedDay,
  }
}

function shouldShowOrderForDateFilter(
  order: Order,
  dateFilter: DateFilter,
  today: string,
  weekEnd: string
) {
  const orderDate = getPrimaryOrderDate(order)
  const isFinalized = isFinalizedOrder(order)

  if (dateFilter === 'all') return true
  if (dateFilter === 'finished') return isFinalized
  if (dateFilter === 'undated') return !orderDate && !isFinalized
  if (isFinalized) return false
  if (dateFilter === 'upcoming') return true
  if (!orderDate) return false
  if (dateFilter === 'today') return orderDate === today

  return orderDate >= today && orderDate <= weekEnd
}

function groupOrdersByDay(orders: Order[], dateFilter: DateFilter, today: string) {
  const groups = new Map<string, OrderGroup>()

  orders.forEach((order) => {
    const orderDate = getPrimaryOrderDate(order)
    const isOverdue =
      dateFilter === 'upcoming' &&
      orderDate !== null &&
      orderDate < today &&
      !isFinalizedOrder(order)
    const groupId = !orderDate ? 'undated' : isOverdue ? 'overdue' : orderDate
    const existingGroup = groups.get(groupId)

    if (existingGroup) {
      existingGroup.orders.push(order)
      return
    }

    if (!orderDate) {
      groups.set(groupId, {
        id: groupId,
        title: 'Sem data definida',
        subtitle: 'Pedidos sem entrega ou festa informada',
        tone: 'undated',
        orders: [order],
      })
      return
    }

    if (isOverdue) {
      groups.set(groupId, {
        id: groupId,
        title: 'Atrasados',
        subtitle: 'Pedidos ativos com data anterior a hoje',
        tone: 'overdue',
        orders: [order],
      })
      return
    }

    const label = getDayLabel(orderDate, today)

    groups.set(groupId, {
      id: groupId,
      title: label.title,
      subtitle: label.subtitle,
      tone: 'default',
      orders: [order],
    })
  })

  return Array.from(groups.values())
}

function getStatusColor(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.color || '#999999'
}

function getMainItems(order: Order) {
  const items = order.order_items ?? []
  const mainItems = items.filter((item) => !item.parent_order_item_id)

  return mainItems.length > 0 ? mainItems : []
}

function getOrderSummary(order: Order) {
  const mainItems = getMainItems(order)

  if (mainItems.length === 0) {
    return order.notes || 'Pedido sem itens estruturados'
  }

  return mainItems
    .slice(0, 2)
    .map((item) => `${parseNumericValue(item.quantity)}x ${item.item_name || 'Produto'}`)
    .join(' + ')
}

function getRecurringProgress(order: Order) {
  const occurrences = order.recurring_order_occurrences ?? []
  const delivered = occurrences.filter((occurrence) => occurrence.status === 'entregue').length
  const total = order.recurrence_count ?? occurrences.length

  return { delivered, total }
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [customerById, setCustomerById] = useState<Record<string, Customer>>({})
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilter>('upcoming')
  const [selectedStatus, setSelectedStatus] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => formatInputDate(new Date()), [])
  const weekEnd = useMemo(() => getWeekEndDate(today), [today])

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuária não autenticada')
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
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
        `)
        .eq('user_id', user.id)
        .order('delivery_date', { ascending: true, nullsFirst: false })
        .order('order_date', { ascending: true, nullsFirst: false })
        .order('delivery_time', { ascending: true, nullsFirst: false })

      if (ordersError) {
        console.error('Erro Supabase orders select:', {
          message: ordersError?.message,
          details: ordersError?.details,
          hint: ordersError?.hint,
          code: ordersError?.code,
          fullError: ordersError,
          stringified: JSON.stringify(ordersError, null, 2),
        })
        throw ordersError
      }

      const orders = (ordersData ?? []) as Order[]
      const orderIds = orders.map((order) => order.id)
      const customerIds = Array.from(
        new Set(orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)))
      )
      const nextCustomerById: Record<string, Customer> = {}
      let orderItems: OrderItem[] = []
      let recurringOccurrences: RecurringOccurrence[] = []

      if (customerIds.length > 0) {
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, user_id, name, phone, whatsapp, email')
          .eq('user_id', user.id)
          .in('id', customerIds)

        if (customersError) {
          logSupabaseError('Erro Supabase customers select:', customersError)
        } else {
          ;((customersData ?? []) as Customer[]).forEach((customer) => {
            nextCustomerById[customer.id] = customer
          })
        }
      }

      if (orderIds.length > 0) {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from('order_items')
          .select('id, order_id, parent_order_item_id, item_name, quantity, unit_price, subtotal, notes')
          .eq('user_id', user.id)
          .in('order_id', orderIds)

        if (orderItemsError) {
          logSupabaseError('Erro Supabase order_items select:', orderItemsError)
        } else {
          orderItems = (orderItemsData ?? []) as OrderItem[]
        }

        const { data: recurringData, error: recurringError } = await supabase
          .from('recurring_order_occurrences')
          .select('id, order_id, occurrence_number, status')
          .eq('user_id', user.id)
          .in('order_id', orderIds)

        if (recurringError) {
          logSupabaseError('Erro Supabase recurring_order_occurrences select:', recurringError)
        } else {
          recurringOccurrences = (recurringData ?? []) as RecurringOccurrence[]
        }
      }

      const orderItemsByOrderId = orderItems.reduce<Map<string, OrderItem[]>>((groups, item) => {
        const currentItems = groups.get(item.order_id) ?? []
        groups.set(item.order_id, [...currentItems, item])

        return groups
      }, new Map())
      const recurringByOrderId = recurringOccurrences.reduce<Map<string, RecurringOccurrence[]>>(
        (groups, occurrence) => {
          const currentOccurrences = groups.get(occurrence.order_id) ?? []
          groups.set(occurrence.order_id, [...currentOccurrences, occurrence])

          return groups
        },
        new Map()
      )

      setCustomerById(nextCustomerById)
      setOrders(
        orders.map((order) => ({
          ...order,
          order_items: orderItemsByOrderId.get(order.id) ?? [],
          recurring_order_occurrences: recurringByOrderId.get(order.id) ?? [],
        }))
      )
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err)
      setError('Falha ao carregar pedidos')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrders])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return orders
      .filter((order) => {
        if (selectedStatus !== 'todos' && order.status !== selectedStatus) return false
        if (!shouldShowOrderForDateFilter(order, selectedDateFilter, today, weekEnd)) {
          return false
        }
        if (!query) return true

        const customerName = order.customer_id ? customerById[order.customer_id]?.name ?? '' : ''
        const itemNames = (order.order_items ?? [])
          .map((item) => item.item_name ?? '')
          .join(' ')
          .toLowerCase()

        return (
          customerName.toLowerCase().includes(query) ||
          order.notes?.toLowerCase().includes(query) ||
          itemNames.includes(query)
        )
      })
      .sort((firstOrder, secondOrder) =>
        compareOrdersForView(firstOrder, secondOrder, selectedDateFilter, today)
      )
  }, [customerById, orders, searchQuery, selectedDateFilter, selectedStatus, today, weekEnd])

  const { paged: pagedOrders, totalPages } = paginate(filteredOrders, currentPage)
  const orderGroups = useMemo(
    () => groupOrdersByDay(pagedOrders, selectedDateFilter, today),
    [pagedOrders, selectedDateFilter, today]
  )

  async function deleteOrder(id: string) {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return

    try {
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', id)

      if (deleteError) {
        logSupabaseError('Erro Supabase orders delete:', deleteError)
        throw deleteError
      }

      await loadOrders()
    } catch (err) {
      console.error('Erro ao deletar:', err)
      setError('Falha ao deletar pedido')
    }
  }

  async function updateOrderStatus(orderId: string, nextStatus: string) {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return

    setUpdatingOrderId(orderId)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) throw new Error('Usuária não autenticada')

      let updatePayload: Partial<Order> = { status: nextStatus }
      
      const totalValue = parseNumericValue(order.total_value ?? 0)
      const depositValue = parseNumericValue(order.down_payment ?? order.deposit_value ?? 0)
      const remainingValue = order.remaining_amount == null
        ? Math.max(totalValue - depositValue, 0)
        : parseNumericValue(order.remaining_amount)

      if (nextStatus === 'entregue' && remainingValue > 0) {
        if (confirm(`Este pedido ainda tem ${formatCurrency(remainingValue)} em aberto. Deseja marcar o restante como recebido também?`)) {
          updatePayload = {
            ...updatePayload,
            remaining_amount: 0,
            payment_status: 'pago',
            remaining_payment_date: new Date().toISOString().split('T')[0],
          }
        }
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Erro Supabase orders update:', {
          message: updateError?.message,
          details: updateError?.details,
          hint: updateError?.hint,
          code: updateError?.code,
          fullError: updateError,
          stringified: JSON.stringify(updateError, null, 2)
        })
        throw updateError
      }

      setOrders((currentOrders) =>
        currentOrders.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o))
      )
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Falha ao atualizar status')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  async function receiveRemainingPayment(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return

    const totalValue = parseNumericValue(order.total_value ?? 0)
    const depositValue = parseNumericValue(order.down_payment ?? order.deposit_value ?? 0)
    const remainingValue = order.remaining_amount == null
      ? Math.max(totalValue - depositValue, 0)
      : parseNumericValue(order.remaining_amount)

    if (remainingValue <= 0) return

    if (!confirm(`Confirmar recebimento do restante de ${formatCurrency(remainingValue)}?`)) return

    setUpdatingOrderId(orderId)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) throw new Error('Usuária não autenticada')

      const updatePayload = {
        remaining_amount: 0,
        payment_status: 'pago',
        remaining_payment_date: new Date().toISOString().split('T')[0],
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Erro Supabase orders update:', {
          message: updateError?.message,
          details: updateError?.details,
          hint: updateError?.hint,
          code: updateError?.code,
          fullError: updateError,
          stringified: JSON.stringify(updateError, null, 2)
        })
        throw updateError
      }

      setOrders((currentOrders) =>
        currentOrders.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o))
      )
    } catch (err) {
      console.error('Erro ao receber restante:', err)
      setError('Falha ao receber restante')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  function renderOrderCard(order: Order) {
    const mainItems = getMainItems(order)
    const hasStructuredItems = mainItems.length > 0
    const recurringProgress = getRecurringProgress(order)
    const isUpdating = updatingOrderId === order.id
    const customer = order.customer_id ? customerById[order.customer_id] : undefined
    const customerName = customer?.name?.trim() || 'Cliente não informado'
    const customerInitials =
      customer?.name
        ?.split(' ')
        .map((namePart) => namePart[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    const totalValue = parseNumericValue(order.total_value ?? 0)
    const depositValue = parseNumericValue(order.down_payment ?? order.deposit_value ?? 0)
    const remainingValue =
      order.remaining_amount == null
        ? Math.max(totalValue - depositValue, 0)
        : parseNumericValue(order.remaining_amount)
    const primaryDate = getPrimaryOrderDate(order)
    const deliveryTime = order.delivery_time?.trim()

    return (
      <article
        key={order.id}
        className="block overflow-hidden rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white transition-shadow hover:shadow-md"
      >
        <div
          className="flex flex-col gap-4 p-4 md:flex-row md:items-center"
          style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#C0392B] text-sm font-bold text-white">
              {customerInitials}
            </div>

            <div className="min-w-0">
              <p className="font-semibold text-[#1A0A08]">{customerName}</p>
              <p className="truncate text-sm text-[#999999]">{getOrderSummary(order)}</p>
              <p className="mt-1 text-xs text-[#999999]">
                {formatDate(primaryDate)}
                {deliveryTime ? ` as ${deliveryTime}` : ''}
              </p>
              {hasStructuredItems && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[#1A0A08]">
                  <Package size={14} className="text-[#C9A84C]" aria-hidden="true" />
                  <span>
                    {mainItems.length === 1
                      ? '1 item estruturado'
                      : `${mainItems.length} itens estruturados`}
                  </span>
                </div>
              )}
              {order.is_recurring && (
                <p className="mt-2 text-xs font-semibold text-[#C0392B]">
                  {recurringProgress.delivered}/{recurringProgress.total} entregues
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:flex-shrink-0">
            <div className="text-right">
              <p className="font-bold text-[#1A0A08]">{formatCurrency(totalValue)}</p>
              {depositValue > 0 ? (
                <>
                  <p className="text-xs text-[#C9A84C]">
                    {formatCurrency(depositValue)} sinal
                  </p>
                  <p className="text-xs text-[#999999]">
                    {formatCurrency(remainingValue)} restante
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#999999]">Sem sinal</p>
              )}
              {remainingValue > 0 && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => receiveRemainingPayment(order.id)}
                  className="mt-1 text-xs font-semibold text-[#27AE60] hover:text-[#1E8449] disabled:opacity-50"
                >
                  Receber restante
                </button>
              )}
            </div>

            {order.fulfillment_type === 'entrega' && (
              <div className="rounded-full bg-[#C9A84C] px-2 py-1 text-xs font-semibold text-white">
                Entrega
              </div>
            )}

            {order.is_recurring && (
              <div className="rounded-full bg-[#FAF6F0] px-2 py-1 text-xs font-semibold text-[#C0392B]">
                Mesversario
              </div>
            )}

            <Link
              href={`/pedidos/${order.id}`}
              className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            >
              Detalhes
            </Link>

            <Link
              href={`/pedidos/${order.id}/editar`}
              className="inline-flex items-center gap-1 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#FAF6F0]"
            >
              <Edit3 size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Editar</span>
            </Link>

            <select
              value={order.status}
              onChange={(event) => updateOrderStatus(order.id, event.target.value)}
              disabled={isUpdating}
              className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#C0392B] disabled:opacity-50"
              style={{ color: getStatusColor(order.status) }}
            >
              {statusOptions
                .filter((option) => option.id !== 'todos')
                .map((option) => (
                  <option key={option.id} value={option.id} style={{ color: '#1A0A08' }}>
                    {option.label}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                void deleteOrder(order.id)
              }}
              className="rounded-lg p-2 text-[#999999] transition-colors hover:bg-red-100 hover:text-[#C0392B]"
              aria-label="Excluir pedido"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF6F0] pb-8">
      <div className="border-b border-[rgba(26,10,8,0.07)] bg-white px-4 py-6 lg:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              Vendas
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Pedidos</h1>
          </div>
          <Link
            href="/pedidos/novo"
            className="flex items-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={20} aria-hidden="true" />
            <span className="hidden sm:inline">Novo pedido</span>
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div className="overflow-x-auto pb-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                Periodo
              </p>
            </div>
            <div className="flex min-w-min gap-2">
              {dateFilterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter(option.id)
                    setCurrentPage(1)
                  }}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors ${
                    selectedDateFilter === option.id
                      ? 'bg-[#C0392B] text-white'
                      : 'border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                Status
              </p>
            </div>
            <div className="flex min-w-min gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(option.id)
                    setCurrentPage(1)
                  }}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors ${
                    selectedStatus === option.id
                      ? 'bg-[#C0392B] text-white'
                      : 'border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
              size={20}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Buscar por cliente, pedido ou item..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-2 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#C0392B]" />
            <p className="mt-2 text-[#999999]">Carregando pedidos...</p>
          </div>
        ) : pagedOrders.length === 0 && filteredOrders.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white py-12 text-center">
            <p className="text-lg font-medium text-[#1A0A08]">Nenhum pedido encontrado</p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery || selectedStatus !== 'todos' || selectedDateFilter !== 'upcoming'
                ? 'Tente ajustar seus filtros'
                : 'Comece criando seu primeiro pedido'}
            </p>
            {selectedStatus === 'todos' && selectedDateFilter === 'upcoming' && !searchQuery && (
              <Link
                href="/pedidos/novo"
                className="mt-4 inline-block rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F]"
              >
                Criar pedido
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {orderGroups.map((group) => (
                <section
                  key={group.id}
                  className={`rounded-[16px] border bg-white p-4 ${
                    group.tone === 'overdue'
                      ? 'border-[#C0392B]'
                      : group.tone === 'undated'
                        ? 'border-dashed border-[#C9A84C]'
                        : 'border-[rgba(26,10,8,0.07)]'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-[#1A0A08]">{group.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-[#C9A84C]">
                        {group.subtitle}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#1A0A08]">
                      {group.orders.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {group.orders.map((order) => renderOrderCard(order))}
                  </div>
                </section>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </main>
    </div>
  )
}
