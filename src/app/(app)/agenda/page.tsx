'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PackageCheck,
  PlayCircle,
  Plus,
  Search,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ProductionStatus = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'
type StatusFilter = 'todos' | ProductionStatus

type ProductionScheduleItem = {
  id: string
  user_id: string
  title: string
  production_date: string
  start_time: string | null
  end_time: string | null
  status: ProductionStatus
  recipe_id: string | null
  order_id: string | null
  quantity: number | string | null
  notes: string | null
  created_at?: string
}

type RecipeOption = {
  id: string
  user_id: string
  name: string
}

type OrderOption = {
  id: string
  user_id: string
  delivery_date: string | null
  delivery_time: string | null
  customers: {
    name: string | null
  } | {
    name: string | null
  }[] | null
  order_items: {
    description: string | null
  }[] | null
}

type SupabaseErrorDetails = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

const statusOptions: {
  value: ProductionStatus
  label: string
  color: string
  bg: string
}[] = [
  { value: 'pendente', label: 'Pendente', color: '#9A7320', bg: '#FFF6D8' },
  { value: 'em_andamento', label: 'Em andamento', color: '#2F6F9F', bg: '#EAF4FF' },
  { value: 'concluido', label: 'Concluído', color: '#17803D', bg: '#EAF8EF' },
  { value: 'cancelado', label: 'Cancelado', color: '#C0392B', bg: '#FDECEA' },
]

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseNumeric(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)

  if (!year || !month || !day) return dateValue

  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function formatTime(timeValue: string | null) {
  if (!timeValue) return ''

  return timeValue.slice(0, 5)
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  const formattedStart = formatTime(startTime)
  const formattedEnd = formatTime(endTime)

  if (formattedStart && formattedEnd) return `${formattedStart} - ${formattedEnd}`
  if (formattedStart) return `Início ${formattedStart}`
  if (formattedEnd) return `Até ${formattedEnd}`

  return 'Horário não definido'
}

function formatQuantity(value: number | string | null) {
  const quantity = parseNumeric(value)

  if (quantity <= 0) return ''

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(quantity)
}

function getStatusMeta(status: ProductionStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0]
}

function getCustomerName(customers: OrderOption['customers']) {
  if (Array.isArray(customers)) return customers[0]?.name?.trim() || ''

  return customers?.name?.trim() || ''
}

function getOrderTitle(order: OrderOption | undefined) {
  if (!order) return ''

  const itemDescription = order.order_items?.[0]?.description?.trim()
  const customerName = getCustomerName(order.customers)

  if (itemDescription && customerName) return `${itemDescription} - ${customerName}`
  if (itemDescription) return itemDescription
  if (customerName) return `Pedido de ${customerName}`

  return `Pedido ${order.id.slice(0, 8)}`
}

function logSupabaseError(context: string, error: SupabaseErrorDetails) {
  console.error(context, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    fullError: error,
  })
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as SupabaseErrorDetails
    return supabaseError.message || supabaseError.details || supabaseError.hint || fallback
  }

  return fallback
}

export default function AgendaPage() {
  const [scheduleItems, setScheduleItems] = useState<ProductionScheduleItem[]>([])
  const [recipes, setRecipes] = useState<RecipeOption[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [selectedDate, setSelectedDate] = useState(getTodayDate)
  const [currentUserId, setCurrentUserId] = useState('')
  const [updatingItemId, setUpdatingItemId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadAgendaData() {
      setIsLoading(true)
      setError('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          logSupabaseError('Erro Supabase auth.getUser:', userError)
          throw userError
        }

        if (!user) {
          throw new Error('Usuário não autenticado')
        }

        const { data: scheduleData, error: scheduleError } = await supabase
          .from('production_schedule')
          .select(
            'id, user_id, title, production_date, start_time, end_time, status, recipe_id, order_id, quantity, notes, created_at'
          )
          .eq('user_id', user.id)
          .order('production_date', { ascending: true })
          .order('start_time', { ascending: true })

        if (scheduleError) {
          logSupabaseError('Erro Supabase production_schedule select:', scheduleError)
          throw scheduleError
        }

        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, user_id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (recipesError) {
          logSupabaseError('Erro Supabase recipes select:', recipesError)
          throw recipesError
        }

        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(
            `
              id,
              user_id,
              delivery_date,
              delivery_time,
              customers (
                name
              ),
              order_items (
                description
              )
            `
          )
          .eq('user_id', user.id)
          .order('delivery_date', { ascending: true })

        if (ordersError) {
          logSupabaseError('Erro Supabase orders select:', ordersError)
          throw ordersError
        }

        if (isMounted) {
          setCurrentUserId(user.id)
          setScheduleItems((scheduleData ?? []) as ProductionScheduleItem[])
          setRecipes((recipesData ?? []) as RecipeOption[])
          setOrders((ordersData ?? []) as OrderOption[])
        }
      } catch (err) {
        console.error('Erro ao carregar agenda de produção:', {
          message: getErrorMessage(err, 'Falha ao carregar agenda de produção'),
          fullError: err,
        })
        if (isMounted) {
          setError(getErrorMessage(err, 'Falha ao carregar agenda de produção'))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAgendaData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const recipeById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]))
  }, [recipes])

  const orderById = useMemo(() => {
    return new Map(orders.map((order) => [order.id, order]))
  }, [orders])

  const summary = useMemo(() => {
    const today = getTodayDate()

    return {
      today: scheduleItems.filter((item) => item.production_date === today).length,
      pending: scheduleItems.filter((item) => item.status === 'pendente').length,
      inProgress: scheduleItems.filter((item) => item.status === 'em_andamento').length,
      completed: scheduleItems.filter((item) => item.status === 'concluido').length,
    }
  }, [scheduleItems])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return scheduleItems.filter((item) => {
      const matchesSearch = query ? item.title.toLowerCase().includes(query) : true
      const matchesStatus = statusFilter === 'todos' ? true : item.status === statusFilter
      const matchesDate = selectedDate ? item.production_date === selectedDate : true

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [scheduleItems, searchQuery, selectedDate, statusFilter])

  const summaryCards = [
    {
      label: 'Produções de hoje',
      value: summary.today,
      icon: CalendarCheck,
      color: '#C9A84C',
    },
    {
      label: 'Pendentes',
      value: summary.pending,
      icon: Clock3,
      color: '#9A7320',
    },
    {
      label: 'Em andamento',
      value: summary.inProgress,
      icon: PlayCircle,
      color: '#2F6F9F',
    },
    {
      label: 'Concluídas',
      value: summary.completed,
      icon: CheckCircle2,
      color: '#17803D',
    },
  ]

  async function updateItemStatus(itemId: string, nextStatus: ProductionStatus) {
    if (!currentUserId) {
      setError('Usuário não autenticado')
      return
    }

    setUpdatingItemId(itemId)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('production_schedule')
        .update({ status: nextStatus })
        .eq('id', itemId)
        .eq('user_id', currentUserId)

      if (updateError) {
        logSupabaseError('Erro Supabase production_schedule update:', updateError)
        throw updateError
      }

      setScheduleItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? { ...item, status: nextStatus } : item
        )
      )
    } catch (err) {
      console.error('Erro ao atualizar status da produção:', {
        message: getErrorMessage(err, 'Falha ao atualizar status'),
        fullError: err,
      })
      setError(getErrorMessage(err, 'Falha ao atualizar status'))
    } finally {
      setUpdatingItemId('')
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              PRODUÇÃO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">
              Agenda de produção
            </h1>
          </div>

          <Link
            href="/agenda/novo"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={19} aria-hidden="true" />
            <span>Novo item</span>
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

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon

            return (
              <div
                key={card.label}
                className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#999999]">{card.label}</p>
                  <Icon size={22} style={{ color: card.color }} aria-hidden="true" />
                </div>
                <p className="text-2xl font-bold text-[#1A0A08]">{card.value}</p>
              </div>
            )
          })}
        </div>

        <section className="mb-6 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_190px_170px]">
            <div>
              <label className="sr-only" htmlFor="agenda-search">
                Buscar por título
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={20}
                  aria-hidden="true"
                />
                <input
                  id="agenda-search"
                  type="search"
                  placeholder="Buscar por título..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="agenda-status">
                Status
              </label>
              <select
                id="agenda-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="todos">Todos</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="sr-only" htmlFor="agenda-date">
                Data
              </label>
              <div className="relative">
                <CalendarDays
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={18}
                  aria-hidden="true"
                />
                <input
                  id="agenda-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value || getTodayDate())}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando agenda...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <PackageCheck className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              Nenhuma produção encontrada
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              Ajuste os filtros ou crie um item para organizar a produção.
            </p>
            <Link
              href="/agenda/novo"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
            >
              <Plus size={18} aria-hidden="true" />
              <span>Novo item</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const status = getStatusMeta(item.status)
              const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
              const order = item.order_id ? orderById.get(item.order_id) : undefined
              const quantity = formatQuantity(item.quantity)
              const isUpdating = updatingItemId === item.id

              return (
                <article
                  key={item.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="break-words text-lg font-bold text-[#1A0A08]">
                            {item.title}
                          </h2>
                          <p className="mt-1 text-sm font-medium text-[#999999]">
                            {formatDate(item.production_date)} •{' '}
                            {formatTimeRange(item.start_time, item.end_time)}
                          </p>
                        </div>

                        <span
                          className="inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold"
                          style={{ backgroundColor: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                        {recipe && (
                          <div className="rounded-lg bg-[#FAF6F0] p-3">
                            <p className="text-xs font-medium text-[#999999]">
                              Receita vinculada
                            </p>
                            <p className="mt-1 font-bold text-[#1A0A08]">{recipe.name}</p>
                          </div>
                        )}

                        {order && (
                          <div className="rounded-lg bg-[#FAF6F0] p-3">
                            <p className="text-xs font-medium text-[#999999]">
                              Pedido vinculado
                            </p>
                            <p className="mt-1 font-bold text-[#1A0A08]">
                              {getOrderTitle(order)}
                            </p>
                          </div>
                        )}

                        {quantity && (
                          <div className="rounded-lg bg-[#FAF6F0] p-3">
                            <p className="text-xs font-medium text-[#999999]">
                              Quantidade a produzir
                            </p>
                            <p className="mt-1 font-bold text-[#1A0A08]">{quantity}</p>
                          </div>
                        )}

                        {item.notes && (
                          <div className="rounded-lg bg-[#FAF6F0] p-3 md:col-span-2">
                            <p className="text-xs font-medium text-[#999999]">Observações</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[#1A0A08]">
                              {item.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:w-56 xl:grid-cols-1">
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateItemStatus(item.id, option.value)}
                          disabled={isUpdating || item.status === option.value}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {option.value === 'cancelado' ? (
                            <XCircle size={16} aria-hidden="true" />
                          ) : option.value === 'concluido' ? (
                            <CheckCircle2 size={16} aria-hidden="true" />
                          ) : option.value === 'em_andamento' ? (
                            <PlayCircle size={16} aria-hidden="true" />
                          ) : (
                            <Clock3 size={16} aria-hidden="true" />
                          )}
                          <span>Marcar como {option.label.toLowerCase()}</span>
                        </button>
                      ))}
                    </div>
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
