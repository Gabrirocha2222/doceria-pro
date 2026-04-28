'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, CheckCircle, Clock, DollarSign, Package, Trash2 } from 'lucide-react'

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
  remaining_value?: NumericValue
  status: string
  payment_method?: string | null
  address?: string | null
  delivery_address?: string | null
  notes: string | null
  image_paths?: string[]
  created_at: string
  customers?: {
    id: string
    name: string
    phone: string | null
  } | null
  order_items?: OrderItem[]
}

const statusOptions = [
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

function getStatusColor(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.color || '#999999'
}

function getStatusLabel(status: string) {
  const option = statusOptions.find((statusOption) => statusOption.id === status)
  return option?.label || status
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

function renderFlavors(flavors: FlavorDetail[] | null) {
  if (!flavors || flavors.length === 0) return null

  return (
    <div className="mt-3 rounded-lg bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-[#999999]">Sabores/variacoes</p>
      <div className="space-y-1">
        {flavors.map((flavor, index) => (
          <div key={`${flavor.name}-${index}`} className="flex justify-between gap-3 text-sm">
            <span className="text-[#1A0A08]">{flavor.name || 'Sabor nao informado'}</span>
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
        throw new Error('Usuaria nao autenticada')
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
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (updateError) {
        logSupabaseError('Erro Supabase orders status update:', updateError)
        throw updateError
      }

      setOrder((currentOrder) =>
        currentOrder ? { ...currentOrder, status: newStatus } : currentOrder
      )
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Falha ao atualizar status')
    } finally {
      setIsUpdating(false)
    }
  }

  async function deleteOrder() {
    if (!confirm('Tem certeza que deseja excluir este pedido? Esta acao nao pode ser desfeita.')) {
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
          <p className="text-lg font-medium text-[#1A0A08]">Pedido nao encontrado</p>
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

  const customerName = order.customers?.name || order.customer_name || 'Cliente nao informado'
  const customerPhone = order.customers?.phone || order.customer_phone
  const orderTitle = mainItems.length > 0 ? mainItems[0].item_name : order.product_name
  const address = order.delivery_address || order.address
  const totalValue = parseNumericValue(order.total_value)
  const depositValue = parseNumericValue(order.deposit_value)
  const remainingValue =
    order.remaining_value == null
      ? Math.max(totalValue - depositValue, 0)
      : parseNumericValue(order.remaining_value)

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
          <div
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: getStatusColor(order.status) }}
          >
            {getStatusLabel(order.status)}
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
                <p className="mb-1 text-sm text-[#999999]">Endereco</p>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#C9A84C] p-4">
                <p className="mb-1 text-sm text-[#999999]">Sinal pago</p>
                <p className="font-bold text-[#C9A84C]">{formatCurrency(depositValue)}</p>
              </div>
              <div className="rounded-lg border border-[rgba(26,10,8,0.07)] p-4">
                <p className="mb-1 text-sm text-[#999999]">Restante</p>
                <p className="font-bold text-[#1A0A08]">{formatCurrency(remainingValue)}</p>
              </div>
            </div>

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
            <h2 className="mb-3 font-bold text-[#1A0A08]">Observacoes</h2>
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
