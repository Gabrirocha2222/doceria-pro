'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Calendar,
  Edit3,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type NumericValue, formatCurrency, optionalText } from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'
import { Pagination, paginate } from '@/components/Pagination'

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

interface Customer {
  id: string
  user_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  birthday: string | null
  birth_date: string | null
  preferences: string | null
  notes: string | null
  balance: number | string | null
  satisfaction: 'like' | 'dislike' | null
  notes_private: string | null
  last_order_date: string | null
  created_at?: string | null
  updated_at?: string | null
}

type CustomerOrder = {
  id: string
  customer_id: string | null
  delivery_date: string | null
  created_at: string | null
}

type CustomerEditForm = {
  name: string
  phone: string
  whatsapp: string
  address: string
  birthday: string
  preferences: string
  notes: string
  balance: string
  satisfaction: '' | 'like' | 'dislike'
  notes_private: string
}

const CUSTOMER_SELECT =
  'id,name,phone,whatsapp,email,address,birthday,birth_date,preferences,notes,balance,satisfaction,notes_private,last_order_date,created_at'

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function getWhatsAppHref(whatsapp: string | null | undefined) {
  if (!whatsapp) return ''

  const digits = onlyDigits(whatsapp)
  if (!digits) return ''

  const normalizedDigits = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits

  return `https://wa.me/${normalizedDigits}`
}

function parseNumeric(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}
function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return initials || '?'
}

function normalizeUpper(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR')
}

function formatBirthday(birthday: string | null | undefined) {
  if (!birthday) return 'Não informado'

  const [year, month, day] = birthday.split('-').map(Number)
  if (!year || !month || !day) return birthday

  const date = new Date(2000, month - 1, day)

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}
function optionalDate(value: string) {
  return value || null
}

function getSupabaseError(error: unknown) {
  return typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}
}

function stringifyError(error: unknown) {
  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return null
  }
}
function getCustomerPhone(customer: Pick<Customer, 'whatsapp' | 'phone'>) {
  const customerPhone = customer.whatsapp ?? customer.phone
  return customerPhone
}

function getCustomerBirthday(customer: Pick<Customer, 'birth_date' | 'birthday'>) {
  const customerBirthday = customer.birth_date ?? customer.birthday
  return customerBirthday
}

function buildEditForm(customer: Customer): CustomerEditForm {
  return {
    name: customer.name,
    phone: customer.phone ?? '',
    whatsapp: customer.whatsapp ?? '',
    address: customer.address ?? '',
    birthday: getCustomerBirthday(customer) ?? '',
    preferences: customer.preferences ?? '',
    notes: customer.notes ?? '',
    balance: String(customer.balance ?? ''),
    satisfaction: customer.satisfaction ?? '',
    notes_private: customer.notes_private ?? '',
  }
}

function getSatisfactionLabel(satisfaction: Customer['satisfaction']) {
  if (satisfaction === 'like') return 'Like'
  if (satisfaction === 'dislike') return 'Dislike'
  return 'Sem avaliacao'
}

function getDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [orderSummariesAvailable, setOrderSummariesAvailable] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CustomerEditForm | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadCustomers() {
      setIsLoading(true)
      setError('')
      setOrderSummariesAvailable(true)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuário não autenticado')
        }

        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select(CUSTOMER_SELECT)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (customersError) throw customersError

        let customerOrders: CustomerOrder[] = []
        let didLoadOrders = true

        try {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('id, customer_id, delivery_date, created_at')
            .eq('user_id', user.id)

          if (ordersError) {
            logSupabaseError('Erro ao carregar pedidos para resumos de clientes:', ordersError)
            didLoadOrders = false
          } else {
            customerOrders = (ordersData ?? []) as CustomerOrder[]
          }
        } catch (ordersError) {
          logSupabaseError('Erro ao carregar pedidos para resumos de clientes:', ordersError)
          didLoadOrders = false
        }

        if (isMounted) {
          setCustomers((customersData ?? []) as Customer[])
          setOrders(customerOrders)
          setOrderSummariesAvailable(didLoadOrders)
        }
      } catch (error) {
        const loadError = getSupabaseError(error)

        console.error('Erro ao carregar clientes:', {
          message: loadError.message,
          details: loadError.details,
          hint: loadError.hint,
          code: loadError.code,
          fullError: error,
          stringified: stringifyError(error),
        })

        if (isMounted) {
          setError(
            'Falha ao carregar clientes. Verifique se a query da página está usando apenas colunas existentes.'
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadCustomers()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return customers

    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(query)
    )
  }, [customers, searchQuery])

  const { paged: pagedCustomers, totalPages } = paginate(filteredCustomers, currentPage)

  const ordersByCustomerId = useMemo(() => {
    const groupedOrders = new Map<string, CustomerOrder[]>()

    orders.forEach((order) => {
      if (!order.customer_id) return

      const currentOrders = groupedOrders.get(order.customer_id) ?? []
      currentOrders.push(order)
      groupedOrders.set(order.customer_id, currentOrders)
    })

    return groupedOrders
  }, [orders])

  const topBalanceCustomers = useMemo(() => {
    return customers
      .filter((customer) => parseNumeric(customer.balance) > 0)
      .sort((firstCustomer, secondCustomer) => {
        return parseNumeric(secondCustomer.balance) - parseNumeric(firstCustomer.balance)
      })
      .slice(0, 5)
  }, [customers])

  const inactiveCustomers = useMemo(() => {
    if (!orderSummariesAvailable) return []

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    const cutoffValue = getDateInputValue(cutoffDate)

    return customers
      .filter((customer) => {
        const customerOrders = ordersByCustomerId.get(customer.id) ?? []
        if (customerOrders.length === 0) return true

        return customerOrders.every((order) => {
          const referenceDate = order.delivery_date || order.created_at?.slice(0, 10) || ''
          return referenceDate < cutoffValue
        })
      })
      .slice(0, 6)
  }, [customers, orderSummariesAvailable, ordersByCustomerId])

  const partyReminders = useMemo(() => {
    if (!orderSummariesAvailable) return []

    const today = new Date()
    const reminderEndDate = new Date(today)
    reminderEndDate.setDate(reminderEndDate.getDate() + 14)

    const todayValue = getDateInputValue(today)
    const endValue = getDateInputValue(reminderEndDate)
    const reminderKeys = new Set<string>()

    return orders
      .map((order) => {
        if (!order.delivery_date) return null

        const anniversaryDate = new Date(`${order.delivery_date}T00:00:00`)
        anniversaryDate.setFullYear(anniversaryDate.getFullYear() + 1)
        const anniversaryValue = getDateInputValue(anniversaryDate)

        if (anniversaryValue < todayValue || anniversaryValue > endValue) return null

        const customer = order.customer_id
          ? customers.find((currentCustomer) => currentCustomer.id === order.customer_id)
          : undefined
        const customerName = customer?.name || 'cliente'
        const reminderKey = `${customerName}-${anniversaryValue}`

        if (reminderKeys.has(reminderKey)) return null
        reminderKeys.add(reminderKey)

        return {
          key: reminderKey,
          text: `Festa de ${customerName} completa 1 ano em breve`,
        }
      })
      .filter((reminder): reminder is { key: string; text: string } => reminder !== null)
  }, [customers, orderSummariesAvailable, orders])

  function startEdit(customer: Customer) {
    setEditingId(customer.id)
    setEditForm(buildEditForm(customer))
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
    setError('')
  }

  function updateEditForm(field: keyof CustomerEditForm, value: string) {
    setEditForm((currentForm) =>
      currentForm ? { ...currentForm, [field]: value } : currentForm
    )
  }

  async function saveCustomer(customer: Customer) {
    if (!editForm) return

    if (!editForm.name.trim()) {
      setError('Nome da cliente é obrigatório')
      return
    }

    const balance = parseNumeric(editForm.balance)
    if (balance < 0) {
      setError('Saldo não pode ser negativo')
      return
    }

    setSavingId(customer.id)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const satisfaction: Customer['satisfaction'] = editForm.satisfaction || null
      const updatedCustomer: Pick<
        Customer,
        | 'name'
        | 'phone'
        | 'whatsapp'
        | 'address'
        | 'birthday'
        | 'birth_date'
        | 'preferences'
        | 'notes'
        | 'balance'
        | 'satisfaction'
        | 'notes_private'
      > = {
        name: normalizeUpper(editForm.name),
        phone: optionalText(editForm.phone),
        whatsapp: optionalText(editForm.whatsapp),
        address: optionalText(editForm.address),
        birthday: optionalDate(editForm.birthday),
        birth_date: optionalDate(editForm.birthday),
        preferences: optionalText(editForm.preferences),
        notes: optionalText(editForm.notes),
        balance,
        satisfaction,
        notes_private: optionalText(editForm.notes_private),
      }

      const { error: updateError } = await supabase
        .from('customers')
        .update(updatedCustomer)
        .eq('id', customer.id)
        .eq('user_id', user.id)

      if (updateError) {
        logSupabaseError('Erro Supabase customers update:', updateError)
        throw updateError
      }

      setCustomers((currentCustomers) =>
        currentCustomers.map((currentCustomer) =>
          currentCustomer.id === customer.id
            ? {
                ...currentCustomer,
                ...updatedCustomer,
              }
            : currentCustomer
        )
      )
      setEditingId(null)
      setEditForm(null)
    } catch (err) {
      logSupabaseError('Erro ao editar cliente:', err)
      setError('Falha ao editar cliente')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(`Excluir a cliente "${customer.name}"?`)
    if (!confirmed) return

    setDeletingId(customer.id)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)
        .eq('user_id', user.id)

      if (deleteError) {
        logSupabaseError('Erro Supabase customers delete:', deleteError)
        throw deleteError
      }

      setCustomers((currentCustomers) =>
        currentCustomers.filter((currentCustomer) => currentCustomer.id !== customer.id)
      )
    } catch (err) {
      logSupabaseError('Erro ao deletar cliente:', err)
      setError('Falha ao deletar cliente')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              CLIENTES
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Clientes</h1>
          </div>

          <Link
            href="/clientes/novo"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={19} aria-hidden="true" />
            <span>Nova cliente</span>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6">
          <label className="sr-only" htmlFor="customer-search">
            Buscar cliente por nome
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
              size={20}
              aria-hidden="true"
            />
            <input
              id="customer-search"
              type="search"
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>
        </div>

        {!isLoading && (
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
              <h2 className="font-bold text-[#1A0A08]">Maiores saldos</h2>
              {topBalanceCustomers.length === 0 ? (
                <p className="mt-3 text-sm text-[#999999]">Nenhum saldo positivo.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {topBalanceCustomers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#1A0A08]">
                        {customer.name}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-[#1F7A3A]">
                        {formatCurrency(customer.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
              <h2 className="font-bold text-[#1A0A08]">Clientes inativos</h2>
              {inactiveCustomers.length === 0 ? (
                <p className="mt-3 text-sm text-[#999999]">Nenhuma cliente inativa.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {inactiveCustomers.map((customer) => (
                    <p key={customer.id} className="truncate text-sm font-semibold text-[#1A0A08]">
                      {customer.name}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
              <h2 className="font-bold text-[#1A0A08]">Lembretes de festa</h2>
              {partyReminders.length === 0 ? (
                <p className="mt-3 text-sm text-[#999999]">Sem lembretes nos proximos 14 dias.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {partyReminders.map((reminder) => (
                    <p key={reminder.key} className="text-sm font-semibold text-[#1A0A08]">
                      {reminder.text}
                    </p>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando clientes...</p>
          </div>
        ) : pagedCustomers.length === 0 && filteredCustomers.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <UserRound className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              {searchQuery ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente cadastrada'}
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery
                ? 'Tente buscar por outro nome.'
                : 'Cadastre clientes para manter contatos, preferências e datas importantes.'}
            </p>
            {!searchQuery && (
              <Link
                href="/clientes/novo"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova cliente</span>
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedCustomers.map((customer) => {
              const customerPhone = getCustomerPhone(customer)
              const customerBirthday = getCustomerBirthday(customer)
              const whatsappHref = getWhatsAppHref(customerPhone)
              const currentEditForm = editingId === customer.id ? editForm : null

              return (
                <article
                  key={customer.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#C0392B] text-sm font-bold text-white">
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                          Cliente
                        </p>
                        <h2 className="mt-1 truncate text-base font-bold text-[#1A0A08]">
                          {customer.name}
                        </h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteCustomer(customer)}
                      disabled={deletingId === customer.id}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Excluir ${customer.name}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>

                  {currentEditForm && (
                    <div className="mb-4 grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        value={currentEditForm.name}
                        onChange={(event) => updateEditForm('name', event.target.value)}
                        placeholder="Nome"
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={currentEditForm.phone}
                          onChange={(event) => updateEditForm('phone', event.target.value)}
                          placeholder="Telefone"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="text"
                          value={currentEditForm.whatsapp}
                          onChange={(event) => updateEditForm('whatsapp', event.target.value)}
                          placeholder="WhatsApp"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="date"
                          value={currentEditForm.birthday}
                          onChange={(event) => updateEditForm('birthday', event.target.value)}
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentEditForm.balance}
                          onChange={(event) => updateEditForm('balance', event.target.value)}
                          placeholder="Saldo"
                          className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                        />
                      </div>
                      <select
                        value={currentEditForm.satisfaction}
                        onChange={(event) => updateEditForm('satisfaction', event.target.value)}
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      >
                        <option value="">Sem avaliação</option>
                        <option value="like">Like</option>
                        <option value="dislike">Dislike</option>
                      </select>
                      <input
                        type="text"
                        value={currentEditForm.address}
                        onChange={(event) => updateEditForm('address', event.target.value)}
                        placeholder="Endereço"
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                      <input
                        type="text"
                        value={currentEditForm.preferences}
                        onChange={(event) => updateEditForm('preferences', event.target.value)}
                        placeholder="Preferências"
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                      <input
                        type="text"
                        value={currentEditForm.notes}
                        onChange={(event) => updateEditForm('notes', event.target.value)}
                        placeholder="Observações"
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                      <input
                        type="text"
                        value={currentEditForm.notes_private}
                        onChange={(event) => updateEditForm('notes_private', event.target.value)}
                        placeholder="Observações internas"
                        className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-[#FAF6F0] p-3">
                        <p className="text-xs font-medium text-[#999999]">Saldo</p>
                        <p className="mt-0.5 font-bold text-[#1A0A08]">
                          {formatCurrency(customer.balance)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#FAF6F0] p-3">
                        <p className="text-xs font-medium text-[#999999]">Satisfação</p>
                        <p className="mt-0.5 font-bold text-[#1A0A08]">
                          {getSatisfactionLabel(customer.satisfaction)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex items-start gap-3 rounded-lg bg-[#FAF6F0] p-3">
                        <Phone size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#999999]">Telefone</p>
                          <p className="mt-0.5 break-words font-semibold text-[#1A0A08]">
                            {customerPhone || 'Não informado'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg bg-[#FAF6F0] p-3">
                        <MessageCircle size={18} className="mt-0.5 shrink-0 text-[#C9A84C]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#999999]">WhatsApp</p>
                          {whatsappHref ? (
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 block break-words font-semibold text-[#1A0A08] transition-colors hover:text-[#C0392B]"
                            >
                              {customerPhone}
                            </a>
                          ) : (
                            <p className="mt-0.5 font-semibold text-[#1A0A08]">Não informado</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-[#FAF6F0] p-3">
                      <Calendar size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Aniversário</p>
                        <p className="mt-0.5 break-words font-semibold text-[#1A0A08]">
                          {formatBirthday(customerBirthday)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Endereço</p>
                        <p className="mt-0.5 break-words text-[#1A0A08]">
                          {customer.address || 'Não informado'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Heart size={18} className="mt-0.5 shrink-0 text-[#C9A84C]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Preferências</p>
                        <p className="mt-0.5 break-words text-[#1A0A08]">
                          {customer.preferences || 'Não informadas'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <StickyNote size={18} className="mt-0.5 shrink-0 text-[#C9A84C]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Observações</p>
                        <p className="mt-0.5 break-words text-[#1A0A08]">
                          {customer.notes || 'Sem observações'}
                        </p>
                      </div>
                    </div>

                    {customer.notes_private && (
                      <div className="flex items-start gap-3">
                        <StickyNote size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#999999]">Observacoes internas</p>
                          <p className="mt-0.5 break-words text-[#1A0A08]">
                            {customer.notes_private}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentEditForm ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveCustomer(customer)}
                          disabled={savingId === customer.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#C0392B] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save size={16} aria-hidden="true" />
                          <span>Salvar</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#F4E9DD]"
                        >
                          <X size={16} aria-hidden="true" />
                          <span>Cancelar</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(customer)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#F4E9DD]"
                      >
                        <Edit3 size={16} aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteCustomer(customer)}
                      disabled={deletingId === customer.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </main>
    </div>
  )
}
