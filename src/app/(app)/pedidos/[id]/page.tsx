'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, CheckCircle, Clock, DollarSign, Edit3, Package, Trash2 } from 'lucide-react'
import { formatCurrency, formatNumber, parseNumericValue } from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'

type NumericValue = number | string | null | undefined

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type FlavorDetail = {
  name: string
  quantity: NumericValue
}

type OrderItem = {
  id: string
  recipe_id: string | null
  parent_order_item_id: string | null
  item_name: string
  quantity: NumericValue
  unit_price: NumericValue
  subtotal: NumericValue
  flavor_details: FlavorDetail[] | null
  notes: string | null
  created_at?: string
}

type SupplierSummary = {
  id: string
  name: string
}

type OrderCakeTopper = {
  id: string
  supplier_id: string | null
  child_name: string | null
  age: string | null
  theme: string | null
  photo_url: string | null
  cost: NumericValue
  charged_amount: NumericValue
  notes: string | null
  created_at: string
  suppliers?: SupplierSummary | SupplierSummary[] | null
}

type RecurringOccurrenceStatus = 'pendente' | 'em_producao' | 'entregue' | 'cancelado'

type RecurringOrderOccurrence = {
  id: string
  order_id: string
  occurrence_number: number
  scheduled_date: string | null
  status: RecurringOccurrenceStatus
  theme: string | null
  notes: string | null
  created_at: string
}

type Order = {
  id: string
  customer_name?: string | null
  customer_phone?: string | null
  product_name?: string | null
  description?: string | null
  order_date: string
  delivery_date: string
  delivery_time: string
  total_value: NumericValue
  deposit_value: NumericValue
  down_payment?: NumericValue
  remaining_amount?: NumericValue
  status: string
  payment_status?: string | null
  payment_method?: string | null
  delivery_address?: string | null
  notes: string | null
  image_paths?: string[]
  created_at: string
  fulfillment_type?: string | null
  delivery_fee?: NumericValue
  discount_amount?: NumericValue
  extras_total?: NumericValue
  manual_total?: NumericValue
  remaining_payment_date?: string | null
  is_recurring?: boolean | null
  recurrence_type?: string | null
  recurrence_count?: number | null
  first_occurrence_date?: string | null
  customers?: {
    id: string
    name: string
    phone: string | null
  } | null
  order_items?: OrderItem[]
  order_cake_toppers?: OrderCakeTopper[]
  recurring_order_occurrences?: RecurringOrderOccurrence[]
}

const statusOptions = [
  { id: 'novo', label: 'Novo', color: '#3498DB' },
  { id: 'confirmado', label: 'Confirmado', color: '#2980B9' },
  { id: 'em_producao', label: 'Em produção', color: '#F39C12' },
  { id: 'pronto', label: 'Pronto', color: '#27AE60' },
  { id: 'entregue', label: 'Entregue', color: '#7F8C8D' },
  { id: 'cancelado', label: 'Cancelado', color: '#C0392B' },
]

const recurringStatusOptions: {
  id: RecurringOccurrenceStatus
  label: string
  color: string
  bg: string
}[] = [
  { id: 'pendente', label: 'Pendente', color: '#9A7320', bg: '#FFF6D8' },
  { id: 'em_producao', label: 'Em produção', color: '#F39C12', bg: '#FFF2DD' },
  { id: 'entregue', label: 'Entregue', color: '#17803D', bg: '#EAF8EF' },
  { id: 'cancelado', label: 'Cancelado', color: '#C0392B', bg: '#FDECEA' },
]
function getStatusColor(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.color || '#999999'
}

function getStatusLabel(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.label || status
}

function getRecurringStatusMeta(status: RecurringOccurrenceStatus) {
  return recurringStatusOptions.find((option) => option.id === status) ?? recurringStatusOptions[0]
}
function formatDate(date: string) {
  if (!date) return 'Sem data'

  return new Date(date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getPaymentLabel(method?: string | null) {
  if (!method) return 'Nao informado'

  const labels: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao_credito: 'Cartao credito',
    cartao_debito: 'Cartao debito',
    cartao: 'Cartao',
    transferencia: 'Transferencia',
  }

  return labels[method] ?? method
}

function getCakeTopperSupplier(cakeTopper: OrderCakeTopper) {
  const supplier = cakeTopper.suppliers

  return Array.isArray(supplier) ? supplier[0] : supplier
}

function renderFlavors(flavors: FlavorDetail[] | null) {
  if (!flavors || flavors.length === 0) return null

  return (
    <div className="mt-3 rounded-lg bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-[#999999]">Sabores/variacoes</p>
      <div className="space-y-1">
        {flavors.map((flavor, index) => (
          <div key={`${flavor.name}-${index}`} className="flex justify-between gap-3 text-sm">
            <span className="text-[#1A0A08]">{flavor.name || 'Sabor não informado'}</span>
            <span className="font-semibold text-[#1A0A08]">{formatNumber(flavor.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseCategoryNotes(notes: string | null) {
  if (!notes) {
    return {
      category: null,
      notes: null,
    }
  }

  const lines = notes.split('\n')
  const firstLine = lines[0]?.trim() ?? ''

  if (!firstLine.toLowerCase().startsWith('categoria:')) {
    return {
      category: null,
      notes,
    }
  }

  const category = firstLine.replace(/^categoria:/i, '').trim()
  const remainingNotes = lines.slice(1).join('\n').trim()

  return {
    category: category || null,
    notes: remainingNotes || null,
  }
}

export default function DetalhesPedidoPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatingOccurrenceId, setUpdatingOccurrenceId] = useState('')
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const orderId = params.id as string

  const loadOrder = useCallback(async () => {
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

      const { data, error: orderError } = await supabase
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
            recipe_id,
            parent_order_item_id,
            item_name,
            quantity,
            unit_price,
            subtotal,
            flavor_details,
            notes,
            created_at
          ),
          order_cake_toppers (
            id,
            supplier_id,
            child_name,
            age,
            theme,
            photo_url,
            cost,
            charged_amount,
            notes,
            created_at,
            suppliers (
              id,
              name
            )
          ),
          recurring_order_occurrences (
            id,
            order_id,
            occurrence_number,
            scheduled_date,
            status,
            theme,
            notes,
            created_at
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single()

      if (orderError) {
        logSupabaseError('Erro Supabase orders detail select:', orderError)
        throw orderError
      }

      setOrder(data as Order)
    } catch (err) {
      console.error('Erro ao carregar pedido:', err)
      setError('Falha ao carregar pedido')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrder()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrder])

  const mainItems = useMemo(() => {
    const items = order?.order_items ?? []
    return items.filter((item) => !item.parent_order_item_id)
  }, [order])

  const cakeToppers = order?.order_cake_toppers ?? []

  const recurringOccurrences = useMemo(() => {
    return [...(order?.recurring_order_occurrences ?? [])].sort(
      (firstOccurrence, secondOccurrence) =>
        firstOccurrence.occurrence_number - secondOccurrence.occurrence_number
    )
  }, [order])

  const childItemsByParentId = useMemo(() => {
    const groupedItems = new Map<string, OrderItem[]>()

    ;(order?.order_items ?? []).forEach((item) => {
      if (!item.parent_order_item_id) return

      const currentItems = groupedItems.get(item.parent_order_item_id) ?? []
      groupedItems.set(item.parent_order_item_id, [...currentItems, item])
    })

    return groupedItems
  }, [order])

  async function updateStatus(newStatus: string) {
    if (!order) return

    setIsUpdating(true)
    setError('')
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) throw new Error('Usuária não autenticada')

      let updatePayload: Partial<Order> = { status: newStatus }

      const totalValue = parseNumericValue(order.total_value)
      const depositValue = parseNumericValue(order.down_payment ?? order.deposit_value)
      const remainingValue =
        order.remaining_amount == null
          ? Math.max(totalValue - depositValue, 0)
          : parseNumericValue(order.remaining_amount)

      if (newStatus === 'entregue' && remainingValue > 0) {
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
        console.error('Erro Supabase orders status update:', {
          message: updateError?.message,
          details: updateError?.details,
          hint: updateError?.hint,
          code: updateError?.code,
          fullError: updateError,
          stringified: JSON.stringify(updateError, null, 2)
        })
        throw updateError
      }

      setOrder((currentOrder) =>
        currentOrder ? { ...currentOrder, ...updatePayload } : currentOrder
      )
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Falha ao atualizar status')
    } finally {
      setIsUpdating(false)
    }
  }

  async function receiveRemainingPayment() {
    if (!order) return

    const totalValue = parseNumericValue(order.total_value)
    const depositValue = parseNumericValue(order.down_payment ?? order.deposit_value)
    const remainingValue =
      order.remaining_amount == null
        ? Math.max(totalValue - depositValue, 0)
        : parseNumericValue(order.remaining_amount)

    if (remainingValue <= 0) return

    if (!confirm(`Confirmar recebimento do restante de ${formatCurrency(remainingValue)}?`)) return

    setIsUpdating(true)
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
        console.error('Erro Supabase receiveRemainingPayment:', {
          message: updateError?.message,
          details: updateError?.details,
          hint: updateError?.hint,
          code: updateError?.code,
          fullError: updateError,
          stringified: JSON.stringify(updateError, null, 2)
        })
        throw updateError
      }

      setOrder((currentOrder) =>
        currentOrder ? { ...currentOrder, ...updatePayload } : currentOrder
      )
    } catch (err) {
      console.error('Erro ao receber restante:', err)
      setError('Falha ao receber restante')
    } finally {
      setIsUpdating(false)
    }
  }

  async function updateOccurrenceStatus(
    occurrenceId: string,
    nextStatus: RecurringOccurrenceStatus
  ) {
    if (!order) return

    setUpdatingOccurrenceId(occurrenceId)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('recurring_order_occurrences')
        .update({ status: nextStatus })
        .eq('id', occurrenceId)
        .eq('order_id', order.id)

      if (updateError) {
        logSupabaseError('Erro Supabase recurring_order_occurrences status update:', updateError)
        throw updateError
      }

      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              recurring_order_occurrences: (
                currentOrder.recurring_order_occurrences ?? []
              ).map((occurrence) =>
                occurrence.id === occurrenceId
                  ? { ...occurrence, status: nextStatus }
                  : occurrence
              ),
            }
          : currentOrder
      )
    } catch (err) {
      console.error('Erro ao atualizar ocorrência recorrente:', err)
      setError('Falha ao atualizar ocorrência recorrente')
    } finally {
      setUpdatingOccurrenceId('')
    }
  }

  async function deleteOrder() {
    if (!confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId)

      if (deleteError) {
        logSupabaseError('Erro Supabase orders delete:', deleteError)
        throw deleteError
      }

      router.push('/pedidos')
    } catch (err) {
      console.error('Erro ao deletar:', err)
      setError('Falha ao deletar pedido')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#C0392B]" />
          <p className="mt-2 text-[#999999]">Carregando pedido...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-[#1A0A08]">Pedido não encontrado</p>
          <button
            type="button"
            onClick={() => router.push('/pedidos')}
            className="mt-4 rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F]"
          >
            Voltar para pedidos
          </button>
        </div>
      </div>
    )
  }

  const customerName = order.customers?.name || 'Cliente não informado'
  const customerPhone = order.customers?.phone
  const orderTitle = mainItems.length > 0 ? mainItems[0].item_name : order.product_name
  const address = order.delivery_address
  const totalValue = parseNumericValue(order.total_value)
  const depositValue = parseNumericValue(order.down_payment ?? order.deposit_value)
  const remainingValue =
    order.remaining_amount == null
      ? Math.max(totalValue - depositValue, 0)
      : parseNumericValue(order.remaining_amount)
  const deliveredRecurringCount = recurringOccurrences.filter(
    (occurrence) => occurrence.status === 'entregue'
  ).length
  const recurrenceCount = order.recurrence_count ?? recurringOccurrences.length

  return (
    <div className="w-full pb-8">
      <div className="sticky top-0 z-10 border-b border-[rgba(26,10,8,0.07)] bg-white px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg p-2 transition-colors hover:bg-[#FAF6F0]"
              aria-label="Voltar"
            >
              <ArrowLeft size={24} className="text-[#1A0A08]" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-[#1A0A08]">{customerName}</h1>
              <p className="truncate text-sm text-[#999999]">
                {orderTitle || 'Pedido sem produto informado'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {remainingValue > 0 && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={receiveRemainingPayment}
                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#27AE60] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E8449] disabled:opacity-50"
              >
                Receber restante
              </button>
            )}
            <Link
              href={`/pedidos/${order.id}/editar`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FAF6F0] border border-[rgba(26,10,8,0.07)] px-3 py-2 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-white"
            >
              <Edit3 size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Editar</span>
            </Link>
            <select
              value={order.status}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={isUpdating}
              className="rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
              style={{ backgroundColor: getStatusColor(order.status) }}
            >
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id} className="bg-white text-[#1A0A08]">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto max-w-4xl px-4 py-4 lg:px-6">
          <div className="rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-800">
            {error}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 lg:px-6">
        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
          <h2 className="mb-4 font-bold text-[#1A0A08]">Informacoes do pedido</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-[#999999]">Cliente</p>
              <p className="font-medium text-[#1A0A08]">{customerName}</p>
              {customerPhone && <p className="text-sm text-[#999999]">{customerPhone}</p>}
            </div>
            <div>
              <p className="mb-1 text-sm text-[#999999]">Resumo</p>
              <p className="font-medium text-[#1A0A08]">
                {orderTitle || order.product_name || 'Pedido antigo sem itens estruturados'}
              </p>
              {order.description && <p className="text-sm text-[#999999]">{order.description}</p>}
            </div>
            <div>
              <p className="mb-1 text-sm text-[#999999]">Data do pedido</p>
              <p className="font-medium text-[#1A0A08]">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-[#999999]">Entrega</p>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#C0392B]" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[#1A0A08]">{formatDate(order.delivery_date)}</p>
                  <p className="text-sm text-[#999999]">{order.delivery_time}</p>
                </div>
              </div>
            </div>
            {address && (
              <div className="md:col-span-2">
                <p className="mb-1 text-sm text-[#999999]">Endereço</p>
                <p className="font-medium text-[#1A0A08]">{address}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
          <h2 className="mb-4 font-bold text-[#1A0A08]">Itens do pedido</h2>

          {mainItems.length === 0 ? (
            <div className="rounded-lg bg-[#FAF6F0] p-4">
              <p className="font-semibold text-[#1A0A08]">
                {order.product_name || 'Pedido antigo sem itens estruturados'}
              </p>
              {(order.description || order.notes) && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#999999]">
                  {order.description || order.notes}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {mainItems.map((item) => {
                const childItems = childItemsByParentId.get(item.id) ?? []
                const isKit = childItems.length > 0

                return (
                  <article
                    key={item.id}
                    className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <Package size={18} className="text-[#C9A84C]" aria-hidden="true" />
                          <p className="font-bold text-[#1A0A08]">{item.item_name}</p>
                          {isKit && (
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#C0392B]">
                              Kit
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#999999]">
                          {formatNumber(item.quantity)} x {formatCurrency(item.unit_price)}
                        </p>
                        {item.notes && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-[#1A0A08]">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg bg-white p-3 text-right">
                        <p className="text-xs text-[#999999]">Subtotal</p>
                        <p className="font-bold text-[#1A0A08]">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>

                    {renderFlavors(item.flavor_details)}

                    {childItems.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm font-bold text-[#1A0A08]">
                          Componentes escolhidos no kit
                        </p>
                        {childItems.map((childItem) => {
                          const parsedNotes = parseCategoryNotes(childItem.notes)

                          return (
                            <div
                              key={childItem.id}
                              className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white p-3"
                            >
                              <div className="flex justify-between gap-3">
                                <div>
                                  {parsedNotes.category && (
                                    <p className="mb-1 text-xs font-semibold text-[#C9A84C]">
                                      {parsedNotes.category}
                                    </p>
                                  )}
                                  <p className="font-semibold text-[#1A0A08]">
                                    {childItem.item_name}
                                  </p>
                                  <p className="text-xs text-[#999999]">
                                    Quantidade: {formatNumber(childItem.quantity)}
                                  </p>
                                </div>
                                <p className="text-xs font-semibold text-[#999999]">
                                  Incluso no kit
                                </p>
                              </div>
                              {parsedNotes.notes && (
                                <p className="mt-2 text-sm text-[#1A0A08]">
                                  {parsedNotes.notes}
                                </p>
                              )}
                              {renderFlavors(childItem.flavor_details)}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {order.is_recurring && (
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-bold text-[#1A0A08]">Mesversario / Recorrencia</h2>
                <p className="mt-1 text-sm text-[#999999]">
                  {deliveredRecurringCount}/{recurrenceCount || recurringOccurrences.length}{' '}
                  entregues
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#FAF6F0] px-3 py-1 text-xs font-bold text-[#C0392B]">
                {order.recurrence_type === 'mensal' || !order.recurrence_type
                  ? 'Mensal'
                  : order.recurrence_type}
              </span>
            </div>

            {recurringOccurrences.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Nenhuma ocorrência recorrente foi gerada para este pedido.
              </div>
            ) : (
              <div className="space-y-3">
                {recurringOccurrences.map((occurrence) => {
                  const status = getRecurringStatusMeta(occurrence.status)
                  const isOccurrenceUpdating = updatingOccurrenceId === occurrence.id

                  return (
                    <article
                      key={occurrence.id}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="font-bold text-[#1A0A08]">
                                Mes {occurrence.occurrence_number}/{recurrenceCount}
                              </h3>
                              <p className="mt-1 text-sm text-[#999999]">
                                {occurrence.scheduled_date
                                  ? formatDate(occurrence.scheduled_date)
                                  : 'Sem data'}
                              </p>
                            </div>

                            <span
                              className="w-fit rounded-full px-3 py-1 text-xs font-bold"
                              style={{ backgroundColor: status.bg, color: status.color }}
                            >
                              {status.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-xs font-medium text-[#999999]">Tema</p>
                              <p className="mt-1 font-semibold text-[#1A0A08]">
                                {occurrence.theme || 'Nao informado'}
                              </p>
                            </div>

                            <div className="rounded-lg bg-white p-3">
                              <p className="text-xs font-medium text-[#999999]">
                                Observacoes
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words font-semibold text-[#1A0A08]">
                                {occurrence.notes || 'Nao informado'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-52 lg:grid-cols-1">
                          {recurringStatusOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => updateOccurrenceStatus(occurrence.id, option.id)}
                              disabled={isOccurrenceUpdating || occurrence.status === option.id}
                              className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-55"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {cakeToppers.length > 0 && (
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Topo de bolo</h2>
            <div className="space-y-3">
              {cakeToppers.map((cakeTopper) => {
                const supplier = getCakeTopperSupplier(cakeTopper)

                return (
                  <article
                    key={cakeTopper.id}
                    className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-sm text-[#999999]">Fornecedor</p>
                        <p className="font-medium text-[#1A0A08]">
                          {supplier?.name || 'Nao informado'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm text-[#999999]">Nome</p>
                        <p className="font-medium text-[#1A0A08]">
                          {cakeTopper.child_name || 'Nao informado'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm text-[#999999]">Idade</p>
                        <p className="font-medium text-[#1A0A08]">
                          {cakeTopper.age || 'Nao informado'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm text-[#999999]">Tema</p>
                        <p className="font-medium text-[#1A0A08]">
                          {cakeTopper.theme || 'Nao informado'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm text-[#999999]">Custo</p>
                        <p className="font-medium text-[#1A0A08]">
                          {cakeTopper.cost == null ? 'Nao informado' : formatCurrency(cakeTopper.cost)}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm text-[#999999]">Valor cobrado</p>
                        <p className="font-medium text-[#1A0A08]">
                          {cakeTopper.charged_amount == null
                            ? 'Nao informado'
                            : formatCurrency(cakeTopper.charged_amount)}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="mb-2 text-sm text-[#999999]">Foto do topo</p>
                        {cakeTopper.photo_url ? (
                          <div className="flex flex-col items-start gap-2">
                            <img
                              src={cakeTopper.photo_url}
                              alt="Foto de referência do topo de bolo"
                              className="w-full max-w-sm max-h-[280px] object-contain rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white"
                            />
                            <a
                              href={cakeTopper.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-[#C0392B] hover:underline"
                            >
                              Abrir imagem
                            </a>
                          </div>
                        ) : (
                          <p className="font-medium text-[#1A0A08]">Nenhuma foto enviada</p>
                        )}
                      </div>
                      {cakeTopper.notes && (
                        <div className="md:col-span-2">
                          <p className="mb-1 text-sm text-[#999999]">Observações</p>
                          <p className="whitespace-pre-wrap text-[#1A0A08]">
                            {cakeTopper.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
          <h2 className="mb-4 font-bold text-[#1A0A08]">Pagamento</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-[#FAF6F0] p-4">
              <div>
                <p className="text-sm text-[#999999]">Valor total</p>
                <p className="text-2xl font-bold text-[#1A0A08]">{formatCurrency(totalValue)}</p>
              </div>
              <DollarSign size={32} className="text-[#C0392B]" aria-hidden="true" />
            </div>

            {order.fulfillment_type && (
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Tipo de atendimento</p>
                <p className="font-bold text-[#1A0A08]">
                  {order.fulfillment_type === 'entrega' ? 'Entrega' : 'Retirada'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#C9A84C] p-4">
                <p className="mb-1 text-sm text-[#999999]">Sinal pago</p>
                <p className="font-bold text-[#C9A84C]">
                  {formatCurrency(depositValue)}
                </p>
              </div>
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4 flex flex-col justify-between items-start gap-2">
                <div>
                  <p className="mb-1 text-sm text-[#999999]">Restante</p>
                  <p className="font-bold text-[#1A0A08]">{formatCurrency(remainingValue)}</p>
                </div>
                {remainingValue > 0 && (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={receiveRemainingPayment}
                    className="w-fit rounded-lg bg-[#27AE60] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E8449] disabled:opacity-50"
                  >
                    Receber restante
                  </button>
                )}
              </div>
            </div>

            {order.payment_status && (
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Status do pagamento</p>
                <p className="font-bold text-[#1A0A08] capitalize">{order.payment_status}</p>
              </div>
            )}

            {order.remaining_payment_date && (
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Data de recebimento do restante</p>
                <p className="font-medium text-[#1A0A08]">{formatDate(order.remaining_payment_date)}</p>
              </div>
            )}

            {order.discount_amount && parseNumericValue(order.discount_amount) > 0 && (
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Desconto</p>
                <p className="font-bold text-[#1A0A08]">
                  -{formatCurrency(order.discount_amount)}
                </p>
              </div>
            )}

            {order.delivery_fee && order.fulfillment_type === 'entrega' && parseNumericValue(order.delivery_fee) > 0 && (
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Taxa de entrega</p>
                <p className="font-bold text-[#1A0A08]">
                  +{formatCurrency(order.delivery_fee)}
                </p>
              </div>
            )}

            {order.extras_total && parseNumericValue(order.extras_total) > 0 && (
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Acréscimos</p>
                <p className="font-bold text-[#1A0A08]">
                  +{formatCurrency(order.extras_total)}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1 text-sm text-[#999999]">Forma de pagamento</p>
              <p className="font-medium text-[#1A0A08]">{getPaymentLabel(order.payment_method)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
          <h2 className="mb-4 font-bold text-[#1A0A08]">Mudar status</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {statusOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => updateStatus(option.id)}
                disabled={isUpdating}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  order.status === option.id
                    ? 'bg-[#C0392B] text-white'
                    : 'border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] text-[#1A0A08] hover:bg-white'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {order.status === option.id && (
                  <CheckCircle size={14} className="mr-1 inline" aria-hidden="true" />
                )}
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {order.notes && mainItems.length > 0 && (
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-3 font-bold text-[#1A0A08]">Observações</h2>
            <p className="whitespace-pre-wrap text-[#1A0A08]">{order.notes}</p>
          </section>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/pedidos')}
            className="flex-1 rounded-lg border border-[rgba(26,10,8,0.07)] px-4 py-2 font-medium text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={deleteOrder}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F]"
          >
            <Trash2 size={18} aria-hidden="true" />
            Excluir
          </button>
        </div>
      </main>
    </div>
  )
}
