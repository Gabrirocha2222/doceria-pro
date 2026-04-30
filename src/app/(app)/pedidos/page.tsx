'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Package, Plus, Search, Trash2 } from 'lucide-react'

type NumericValue = number | string | null | undefined

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type OrderItem = {
  id: string
  parent_order_item_id: string | null
  item_name: string | null
  quantity: NumericValue
  unit_price: NumericValue
  subtotal: NumericValue
  notes: string | null
}

type RecurringOccurrence = {
  id: string
  occurrence_number: number
  status: 'pendente' | 'em_producao' | 'entregue' | 'cancelado'
}

type Order = {
  id: string
  product_name: string | null
  delivery_date: string
  delivery_time: string
  total_value: NumericValue
  deposit_value: NumericValue
  down_payment: NumericValue
  remaining_value: NumericValue
  status: string
  created_at: string
  notes?: string | null
  fulfillment_type?: string | null
  is_recurring?: boolean | null
  recurrence_count?: number | null
  customers?: {
    id: string
    name: string
    phone: string | null
  } | null
  order_items?: OrderItem[]
  recurring_order_occurrences?: RecurringOccurrence[]
}

const statusOptions = [
  { id: 'todos', label: 'Todos', color: '#1A0A08' },
  { id: 'novo', label: 'Novo', color: '#3498DB' },
  { id: 'confirmado', label: 'Confirmado', color: '#2980B9' },
  { id: 'em_producao', label: 'Em producao', color: '#F39C12' },
  { id: 'pronto', label: 'Pronto', color: '#27AE60' },
  { id: 'entregue', label: 'Entregue', color: '#7F8C8D' },
  { id: 'cancelado', label: 'Cancelado', color: '#C0392B' },
]

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

function formatDate(date: string) {
  if (!date) return 'Sem data'

  return new Date(date).toLocaleDateString('pt-BR')
}

function getStatusColor(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.color || '#999999'
}

function getStatusLabel(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.label || status
}

function getMainItems(order: Order) {
  const items = order.order_items ?? []
  const mainItems = items.filter((item) => !item.parent_order_item_id)

  return mainItems.length > 0 ? mainItems : []
}

function getOrderSummary(order: Order) {
  const mainItems = getMainItems(order)

  if (mainItems.length === 0) {
    return order.product_name || order.notes || 'Pedido sem itens estruturados'
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
  const [selectedStatus, setSelectedStatus] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const loadOrders = useCallback(async () => {
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

      const { data, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            name,
            phone
          ),
          order_items (
            id,
            parent_order_item_id,
            item_name,
            quantity,
            unit_price,
            subtotal,
            notes
          ),
          recurring_order_occurrences (
            id,
            occurrence_number,
            status
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (ordersError) {
        logSupabaseError('Erro Supabase orders select:', ordersError)
        throw ordersError
      }

      setOrders((data ?? []) as Order[])
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

    return orders.filter((order) => {
      if (selectedStatus !== 'todos' && order.status !== selectedStatus) return false
      if (!query) return true

      const itemNames = (order.order_items ?? [])
        .map((item) => item.item_name ?? '')
        .join(' ')
        .toLowerCase()

      return (
        order.customers?.name?.toLowerCase().includes(query) ||
        order.product_name?.toLowerCase().includes(query) ||
        itemNames.includes(query)
      )
    })
  }, [orders, searchQuery, selectedStatus])

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

  return (
    <div className="w-full pb-8">
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
            <div className="flex min-w-min gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedStatus(option.id)}
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
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-2 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#C0392B]" />
            <p className="mt-2 text-[#999999]">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white py-12 text-center">
            <p className="text-lg font-medium text-[#1A0A08]">Nenhum pedido encontrado</p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery || selectedStatus !== 'todos'
                ? 'Tente ajustar seus filtros'
                : 'Comece criando seu primeiro pedido'}
            </p>
            {selectedStatus === 'todos' && !searchQuery && (
              <Link
                href="/pedidos/novo"
                className="mt-4 inline-block rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F]"
              >
                Criar pedido
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const mainItems = getMainItems(order)
              const hasStructuredItems = mainItems.length > 0
              const recurringProgress = getRecurringProgress(order)

              return (
                <Link
                  key={order.id}
                  href={`/pedidos/${order.id}`}
                  className="block overflow-hidden rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white transition-shadow hover:shadow-md"
                >
                  <div
                    className="flex flex-col gap-4 p-4 md:flex-row md:items-center"
                    style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#C0392B] text-sm font-bold text-white">
                        {order.customers?.name
                          ?.split(' ')
                          .map((namePart) => namePart[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-[#1A0A08]">
                          {order.customers?.name || 'Cliente nao informado'}
                        </p>
                        <p className="truncate text-sm text-[#999999]">{getOrderSummary(order)}</p>
                        <p className="mt-1 text-xs text-[#999999]">
                          {formatDate(order.delivery_date)} as {order.delivery_time}
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

                      <div className="flex items-center justify-between gap-3 md:flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-[#1A0A08]">
                          {formatCurrency(order.total_value)}
                        </p>
                        {order.down_payment ? (
                          <>
                            <p className="text-xs text-[#C9A84C]">
                              {formatCurrency(order.down_payment)} sinal
                            </p>
                            <p className="text-xs text-[#999999]">
                              {formatCurrency(
                                Math.max(parseNumericValue(order.total_value) - parseNumericValue(order.down_payment), 0)
                              )}{' '}
                              restante
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-[#C9A84C]">
                            {formatCurrency(order.deposit_value)} sinal
                          </p>
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

                      <div
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {getStatusLabel(order.status)}
                      </div>

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
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
