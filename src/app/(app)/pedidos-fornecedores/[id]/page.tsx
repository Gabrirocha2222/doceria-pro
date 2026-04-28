'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CalendarDays, PackageCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  phone: string | null
  whatsapp: string | null
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

const statusOptions: { id: SupplierOrderStatus; label: string }[] = [
  { id: 'pendente', label: 'Pendente' },
  { id: 'encomendado', label: 'Encomendado' },
  { id: 'recebido', label: 'Recebido' },
  { id: 'cancelado', label: 'Cancelado' },
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

function formatNumber(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(parseNumericValue(value))
}

function formatCurrency(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseNumericValue(value))
}

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

function stringifyDetails(details: JsonValue | null) {
  if (details == null) return 'Sem detalhes adicionais'

  return JSON.stringify(details, null, 2)
}

function getCustomer(customerOrder: CustomerOrder | null) {
  const customer = customerOrder?.customers

  return Array.isArray(customer) ? customer[0] : customer
}

export default function DetalhePedidoFornecedorPage() {
  const [supplierOrder, setSupplierOrder] = useState<SupplierOrder | null>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [customerOrder, setCustomerOrder] = useState<CustomerOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const params = useParams()
  const router = useRouter()
  const supplierOrderId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const loadSupplierOrder = useCallback(async () => {
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

      const { data, error: supplierOrderError } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('id', supplierOrderId)
        .eq('user_id', user.id)
        .single()

      if (supplierOrderError) {
        logSupabaseError('Erro Supabase supplier_orders detail select:', supplierOrderError)
        throw new Error(
          'Falha ao carregar pedido para fornecedor. Verifique se a migration supplier_orders foi aplicada.'
        )
      }

      const loadedSupplierOrder = data as SupplierOrder
      setSupplierOrder(loadedSupplierOrder)

      if (loadedSupplierOrder.supplier_id) {
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('id, name, phone, whatsapp')
          .eq('id', loadedSupplierOrder.supplier_id)
          .eq('user_id', user.id)
          .single()

        if (supplierError) {
          logSupabaseError('Erro Supabase suppliers detail select:', supplierError)
        } else {
          setSupplier(supplierData as Supplier)
        }
      } else {
        setSupplier(null)
      }

      if (loadedSupplierOrder.customer_order_id) {
        const { data: orderData, error: orderError } = await supabase
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
          .eq('id', loadedSupplierOrder.customer_order_id)
          .eq('user_id', user.id)
          .single()

        if (orderError) {
          logSupabaseError('Erro Supabase orders detail select:', orderError)
        } else {
          setCustomerOrder(orderData as CustomerOrder)
        }
      } else {
        setCustomerOrder(null)
      }
    } catch (err) {
      console.error('Erro ao carregar pedido para fornecedor:', err)
      const message =
        err instanceof Error ? err.message : 'Falha ao carregar pedido para fornecedor'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [supplierOrderId, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSupplierOrder()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadSupplierOrder])

  async function updateStatus(status: SupplierOrderStatus) {
    if (!supplierOrder) return

    setIsUpdating(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('supplier_orders')
        .update({ status })
        .eq('id', supplierOrder.id)

      if (updateError) {
        logSupabaseError('Erro Supabase supplier_orders status update:', updateError)
        throw updateError
      }

      setSupplierOrder((currentOrder) =>
        currentOrder ? { ...currentOrder, status } : currentOrder
      )
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Falha ao atualizar status')
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#C0392B]" />
          <p className="mt-2 text-[#999999]">Carregando pedido para fornecedor...</p>
        </div>
      </div>
    )
  }

  if (!supplierOrder) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-[#1A0A08]">
            Pedido para fornecedor nao encontrado
          </p>
          <button
            type="button"
            onClick={() => router.push('/pedidos-fornecedores')}
            className="mt-4 rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F]"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  const flavors = readFlavorDetails(supplierOrder.details)
  const customer = getCustomer(customerOrder)

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="sticky top-0 z-10 border-b border-[rgba(26,10,8,0.07)] bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 lg:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              FORNECEDORES
            </p>
            <h1 className="truncate text-2xl font-bold text-[#1A0A08]">
              {supplierOrder.title}
            </h1>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 lg:px-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <PackageCheck size={20} className="text-[#C9A84C]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[#1A0A08]">{supplierOrder.title}</h2>
              </div>
              <p className="text-sm text-[#999999]">
                {supplier?.name || 'Fornecedor nao definido'}
              </p>
            </div>
            <span
              className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                supplierOrder.status
              )}`}
            >
              {supplierOrder.status}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-[#FAF6F0] p-4">
              <p className="text-xs text-[#999999]">Quantidade</p>
              <p className="mt-1 font-bold text-[#1A0A08]">
                {formatNumber(supplierOrder.quantity)} {supplierOrder.unit || 'unidades'}
              </p>
            </div>
            {supplierOrder.estimated_cost != null && (
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs text-[#999999]">Custo estimado</p>
                <p className="mt-1 font-bold text-[#1A0A08]">
                  {formatCurrency(supplierOrder.estimated_cost)}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-[#FAF6F0] p-4">
              <p className="text-xs text-[#999999]">Prazo</p>
              <p className="mt-1 inline-flex items-center gap-1 font-bold text-[#1A0A08]">
                <CalendarDays size={15} className="text-[#C0392B]" aria-hidden="true" />
                {formatDate(supplierOrder.due_date)}
              </p>
            </div>
            <div className="rounded-lg bg-[#FAF6F0] p-4">
              <p className="text-xs text-[#999999]">Pedido do cliente</p>
              {supplierOrder.customer_order_id ? (
                <Link
                  href={`/pedidos/${supplierOrder.customer_order_id}`}
                  className="mt-1 block font-bold text-[#1A0A08] hover:text-[#C0392B]"
                >
                  {customer?.name || 'Ver pedido'}
                </Link>
              ) : (
                <p className="mt-1 font-bold text-[#1A0A08]">Nao vinculado</p>
              )}
            </div>
          </div>

          {supplier && (
            <div className="mt-4 rounded-lg bg-[#FAF6F0] p-4">
              <p className="text-xs text-[#999999]">Contato do fornecedor</p>
              <p className="mt-1 font-semibold text-[#1A0A08]">{supplier.name}</p>
              {(supplier.phone || supplier.whatsapp) && (
                <p className="text-sm text-[#999999]">
                  {supplier.whatsapp || supplier.phone}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
          <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Status</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {statusOptions.map((status) => (
              <button
                key={status.id}
                type="button"
                disabled={isUpdating}
                onClick={() => updateStatus(status.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  supplierOrder.status === status.id
                    ? 'bg-[#C0392B] text-white'
                    : 'bg-[#FAF6F0] text-[#1A0A08] hover:bg-[#F4E9DD]'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
          <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Detalhes</h2>

          {flavors.length > 0 && (
            <div className="mb-4 rounded-lg bg-[#FAF6F0] p-4">
              <p className="mb-2 text-xs font-semibold text-[#999999]">Sabores</p>
              <div className="space-y-1">
                {flavors.map((flavor, index) => (
                  <div key={`${flavor.name}-${index}`} className="flex justify-between gap-3">
                    <span className="text-[#1A0A08]">
                      {flavor.name || 'Sabor nao informado'}
                    </span>
                    <span className="font-semibold text-[#1A0A08]">
                      {formatNumber(flavor.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <pre className="max-h-80 overflow-auto rounded-lg bg-[#FAF6F0] p-4 text-xs text-[#1A0A08]">
            {stringifyDetails(supplierOrder.details)}
          </pre>

          {supplierOrder.notes && (
            <div className="mt-4 rounded-lg bg-[#FAF6F0] p-4">
              <p className="mb-1 text-xs font-semibold text-[#999999]">Observacoes</p>
              <p className="whitespace-pre-wrap text-[#1A0A08]">{supplierOrder.notes}</p>
            </div>
          )}
        </section>

        <Link
          href="/pedidos-fornecedores"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-5 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
        >
          Voltar
        </Link>
      </main>
    </div>
  )
}
