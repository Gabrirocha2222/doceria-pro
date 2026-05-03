'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarDays, PackageCheck, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber } from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'

type NumericValue = number | string | null | undefined
type SupplierOrderStatus = 'pendente' | 'encomendado' | 'recebido' | 'cancelado'
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

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

type CakeTopperDetails = {
  childName: string | null
  age: string | null
  theme: string | null
  photoUrl: string | null
  cost: NumericValue
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
  status: SupplierOrderStatus
  details: JsonValue | null
  notes: string | null
  created_at: string
}

type Supplier = {
  id: string
  name: string
}

type CustomerSummary = {
  id: string
  name: string
  phone: string | null
}

type CustomerOrder = {
  id: string
  delivery_date: string | null
  delivery_time: string | null
  customers?: CustomerSummary | CustomerSummary[] | null
}

const statusOptions: { id: SupplierOrderStatus | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendente', label: 'Pendente' },
  { id: 'encomendado', label: 'Encomendado' },
  { id: 'recebido', label: 'Recebido' },
  { id: 'cancelado', label: 'Cancelado' },
]

const actionStatuses: { id: SupplierOrderStatus; label: string }[] = [
  { id: 'pendente', label: 'Pendente' },
  { id: 'encomendado', label: 'Encomendado' },
  { id: 'recebido', label: 'Recebido' },
  { id: 'cancelado', label: 'Cancelado' },
]
function formatDate(date: string | null) {
  if (!date) return 'Sem data'

  return new Date(date).toLocaleDateString('pt-BR')
}

function getStatusStyle(status: SupplierOrderStatus) {
  const styles: Record<SupplierOrderStatus, string> = {
    pendente: 'bg-[#FAF6F0] text-[#1A0A08]',
    encomendado: 'bg-[#FFF4D6] text-[#8A6B1F]',
    recebido: 'bg-[#EAF7EF] text-[#1F7A3A]',
    cancelado: 'bg-red-50 text-[#C0392B]',
  }

  return styles[status]
}

function isRecord(value: JsonValue | null): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFlavorDetails(details: JsonValue | null): FlavorDetail[] {
  const flavorValue = isRecord(details) ? details.flavor_details : details

  if (!Array.isArray(flavorValue)) return []

  return flavorValue
    .map((flavor): FlavorDetail | null => {
      if (!isRecord(flavor)) return null

      const name = typeof flavor.name === 'string' ? flavor.name : ''
      const quantity =
        typeof flavor.quantity === 'number' || typeof flavor.quantity === 'string'
          ? flavor.quantity
          : null

      if (!name && quantity == null) return null

      return { name, quantity }
    })
    .filter((flavor): flavor is FlavorDetail => flavor !== null)
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

function readCakeTopperDetails(order: SupplierOrder): CakeTopperDetails | null {
  const details = isRecord(order.details) ? order.details : null
  const childName = details ? readStringDetail(details, ['nome', 'child_name']) : null
  const age = details ? readStringDetail(details, ['idade', 'age']) : null
  const theme = details ? readStringDetail(details, ['tema', 'theme']) : null
  const photoUrl = details ? readStringDetail(details, ['foto_url', 'photo_url']) : null
  const hasCakeTopperKey = details
    ? hasDetailKey(details, ['nome', 'child_name', 'idade', 'age', 'tema', 'theme', 'foto_url', 'photo_url'])
    : false
  const hasCakeTopperTitle = order.title.trim().toLowerCase().startsWith('topo de bolo')

  if (!hasCakeTopperTitle && !hasCakeTopperKey) return null

  return {
    childName,
    age,
    theme,
    photoUrl,
    cost: order.estimated_cost,
  }
}

function getCustomer(customerOrder: CustomerOrder | undefined) {
  const customer = customerOrder?.customers

  return Array.isArray(customer) ? customer[0] : customer
}

export default function PedidosFornecedoresPage() {
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([])
  const [suppliersById, setSuppliersById] = useState<Record<string, Supplier>>({})
  const [customerOrdersById, setCustomerOrdersById] = useState<Record<string, CustomerOrder>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<SupplierOrderStatus | 'todos'>('todos')
  const [selectedSupplierId, setSelectedSupplierId] = useState('todos')
  const [selectedDate, setSelectedDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const loadSupplierOrders = useCallback(async () => {
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

      const { data, error: supplierOrdersError } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: false })

      if (supplierOrdersError) {
        logSupabaseError('Erro Supabase supplier_orders select:', supplierOrdersError)
        throw new Error(
          'Falha ao carregar pedidos para fornecedores. Verifique se a migration supplier_orders foi aplicada.'
        )
      }

      const orders = (data ?? []) as SupplierOrder[]
      const supplierIds = Array.from(
        new Set(orders.map((order) => order.supplier_id).filter((id): id is string => Boolean(id)))
      )
      const customerOrderIds = Array.from(
        new Set(
          orders.map((order) => order.customer_order_id).filter((id): id is string => Boolean(id))
        )
      )

      const suppliersMap = new Map<string, Supplier>()
      const customerOrdersMap = new Map<string, CustomerOrder>()

      if (supplierIds.length > 0) {
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('user_id', user.id)
          .in('id', supplierIds)

        if (suppliersError) {
          logSupabaseError('Erro Supabase suppliers select:', suppliersError)
        } else {
          ;((suppliersData ?? []) as Supplier[]).forEach((supplier) => {
            suppliersMap.set(supplier.id, supplier)
          })
        }
      }

      if (customerOrderIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            delivery_date,
            delivery_time,
            customers (
              id,
              name,
              phone
            )
          `)
          .eq('user_id', user.id)
          .in('id', customerOrderIds)

        if (ordersError) {
          logSupabaseError('Erro Supabase orders select:', ordersError)
        } else {
          ;((ordersData ?? []) as CustomerOrder[]).forEach((order) => {
            customerOrdersMap.set(order.id, order)
          })
        }
      }

      setSupplierOrders(orders)
      setSuppliersById(Object.fromEntries(suppliersMap))
      setCustomerOrdersById(Object.fromEntries(customerOrdersMap))
    } catch (err) {
      console.error('Erro ao carregar pedidos para fornecedores:', err)
      const message =
        err instanceof Error ? err.message : 'Falha ao carregar pedidos para fornecedores'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSupplierOrders()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadSupplierOrders])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get('status')
      if (statusParam && ['pendente', 'encomendado', 'recebido', 'cancelado'].includes(statusParam)) {
        setSelectedStatus(statusParam as SupplierOrderStatus)
      }
    }
  }, [])

  const supplierOptions = useMemo(() => {
    return Object.values(suppliersById).sort((a, b) => a.name.localeCompare(b.name))
  }, [suppliersById])

  const summary = useMemo(() => {
    return {
      pendente: supplierOrders.filter((order) => order.status === 'pendente').length,
      encomendado: supplierOrders.filter((order) => order.status === 'encomendado').length,
      recebido: supplierOrders.filter((order) => order.status === 'recebido').length,
      cancelado: supplierOrders.filter((order) => order.status === 'cancelado').length,
    }
  }, [supplierOrders])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return supplierOrders.filter((order) => {
      const supplier = order.supplier_id ? suppliersById[order.supplier_id] : undefined
      const customerOrder = order.customer_order_id
        ? customerOrdersById[order.customer_order_id]
        : undefined
      const customerName = getCustomer(customerOrder)?.name ?? ''
      const cakeTopperDetails = readCakeTopperDetails(order)

      if (selectedStatus !== 'todos' && order.status !== selectedStatus) return false
      if (selectedSupplierId !== 'todos' && order.supplier_id !== selectedSupplierId) return false
      if (selectedDate && order.due_date !== selectedDate) return false
      if (!query) return true

      return (
        order.title.toLowerCase().includes(query) ||
        supplier?.name.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query) ||
        Boolean(cakeTopperDetails?.childName?.toLowerCase().includes(query)) ||
        Boolean(cakeTopperDetails?.theme?.toLowerCase().includes(query))
      )
    })
  }, [
    customerOrdersById,
    searchQuery,
    selectedDate,
    selectedStatus,
    selectedSupplierId,
    supplierOrders,
    suppliersById,
  ])

  async function updateSupplierOrderStatus(id: string, status: SupplierOrderStatus) {
    try {
      const { error: updateError } = await supabase
        .from('supplier_orders')
        .update({ status })
        .eq('id', id)

      if (updateError) {
        logSupabaseError('Erro Supabase supplier_orders update:', updateError)
        throw updateError
      }

      setSupplierOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === id ? { ...order, status } : order))
      )
    } catch (err) {
      console.error('Erro ao atualizar pedido para fornecedor:', err)
      setError('Falha ao atualizar status do pedido para fornecedor')
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="border-b border-[rgba(26,10,8,0.07)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              FORNECEDORES
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Pedidos para fornecedores</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Pendentes', value: summary.pendente },
            { label: 'Encomendados', value: summary.encomendado },
            { label: 'Recebidos', value: summary.recebido },
            { label: 'Cancelados', value: summary.cancelado },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4"
            >
              <p className="text-xs font-medium text-[#999999]">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#1A0A08]">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_170px_190px_150px]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
              size={20}
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Buscar por titulo, fornecedor ou cliente..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value as SupplierOrderStatus | 'todos')
            }
            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
          >
            {statusOptions.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={selectedSupplierId}
            onChange={(event) => setSelectedSupplierId(event.target.value)}
            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
          >
            <option value="todos">Todos os fornecedores</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
          />
        </div>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">
              Carregando pedidos para fornecedores...
            </p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <PackageCheck className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              Nenhum pedido para fornecedor encontrado
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              Eles serao gerados automaticamente quando um pedido tiver produto terceirizado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredOrders.map((order) => {
              const supplier = order.supplier_id ? suppliersById[order.supplier_id] : undefined
              const customerOrder = order.customer_order_id
                ? customerOrdersById[order.customer_order_id]
                : undefined
              const customer = getCustomer(customerOrder)
              const flavors = readFlavorDetails(order.details)
              const cakeTopperDetails = readCakeTopperDetails(order)

              return (
                <article
                  key={order.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                        {supplier?.name || 'Fornecedor não definido'}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-[#1A0A08]">{order.title}</h2>
                    </div>
                    <span
                      className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-[#FAF6F0] p-3">
                      <p className="text-xs text-[#999999]">Quantidade</p>
                      <p className="mt-1 font-bold text-[#1A0A08]">
                        {formatNumber(order.quantity)} {order.unit || 'unidades'}
                      </p>
                    </div>
                    {order.estimated_cost != null && (
                      <div className="rounded-lg bg-[#FAF6F0] p-3">
                        <p className="text-xs text-[#999999]">Custo estimado</p>
                        <p className="mt-1 font-bold text-[#1A0A08]">
                          {formatCurrency(order.estimated_cost)}
                        </p>
                      </div>
                    )}
                    <div className="rounded-lg bg-[#FAF6F0] p-3">
                      <p className="text-xs text-[#999999]">Prazo</p>
                      <p className="mt-1 inline-flex items-center gap-1 font-bold text-[#1A0A08]">
                        <CalendarDays size={15} className="text-[#C0392B]" aria-hidden="true" />
                        {formatDate(order.due_date)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#FAF6F0] p-3">
                      <p className="text-xs text-[#999999]">Pedido cliente</p>
                      {order.customer_order_id ? (
                        <Link
                          href={`/pedidos/${order.customer_order_id}`}
                          className="mt-1 block truncate font-bold text-[#1A0A08] hover:text-[#C0392B]"
                        >
                          {customer?.name || 'Ver pedido'}
                        </Link>
                      ) : (
                        <p className="mt-1 font-bold text-[#1A0A08]">Nao vinculado</p>
                      )}
                    </div>
                  </div>

                  {flavors.length > 0 && (
                    <div className="mt-3 rounded-lg bg-[#FAF6F0] p-3">
                      <p className="mb-2 text-xs font-semibold text-[#999999]">Sabores</p>
                      <div className="space-y-1">
                        {flavors.map((flavor, index) => (
                          <div
                            key={`${flavor.name}-${index}`}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <span className="text-[#1A0A08]">
                              {flavor.name || 'Sabor não informado'}
                            </span>
                            <span className="font-semibold text-[#1A0A08]">
                              {formatNumber(flavor.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cakeTopperDetails && (
                    <div className="mt-3 rounded-lg bg-[#FAF6F0] p-3">
                      <p className="mb-2 text-xs font-semibold text-[#999999]">
                        Topo de bolo
                      </p>
                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-[#999999]">Nome</p>
                          <p className="font-semibold text-[#1A0A08]">
                            {cakeTopperDetails.childName || 'Nao informado'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#999999]">Idade</p>
                          <p className="font-semibold text-[#1A0A08]">
                            {cakeTopperDetails.age || 'Nao informado'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#999999]">Tema</p>
                          <p className="font-semibold text-[#1A0A08]">
                            {cakeTopperDetails.theme || 'Nao informado'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#999999]">Custo</p>
                          <p className="font-semibold text-[#1A0A08]">
                            {cakeTopperDetails.cost == null
                              ? 'Nao informado'
                              : formatCurrency(cakeTopperDetails.cost)}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="mb-2 text-xs text-[#999999]">Foto do topo</p>
                          {cakeTopperDetails.photoUrl ? (
                            <div className="flex flex-col items-start gap-2">
                              <img
                                src={cakeTopperDetails.photoUrl}
                                alt="Foto de referência do topo de bolo"
                                className="w-full max-h-[220px] object-contain rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white"
                              />
                              <a
                                href={cakeTopperDetails.photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-[#C0392B] hover:underline"
                              >
                                Abrir imagem
                              </a>
                            </div>
                          ) : (
                            <p className="font-semibold text-[#1A0A08]">Nenhuma foto enviada</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {order.notes && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[#1A0A08]">
                      {order.notes}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {actionStatuses.map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => updateSupplierOrderStatus(order.id, status.id)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          order.status === status.id
                            ? 'bg-[#C0392B] text-white'
                            : 'bg-[#FAF6F0] text-[#1A0A08] hover:bg-[#F4E9DD]'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                    <Link
                      href={`/pedidos-fornecedores/${order.id}`}
                      className="rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 text-xs font-semibold text-[#1A0A08] hover:bg-[#FAF6F0]"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
