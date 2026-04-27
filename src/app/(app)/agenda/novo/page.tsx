'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ProductionStatus = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'

type ProductionForm = {
  title: string
  production_date: string
  start_time: string
  end_time: string
  status: ProductionStatus
  recipe_id: string
  order_id: string
  quantity: string
  notes: string
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

const statusOptions: { value: ProductionStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function createInitialForm(): ProductionForm {
  return {
    title: '',
    production_date: getTodayDate(),
    start_time: '',
    end_time: '',
    status: 'pendente',
    recipe_id: '',
    order_id: '',
    quantity: '',
    notes: '',
  }
}

function parseOptionalQuantity(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) return null

  const parsed = Number(trimmedValue.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

function optionalText(value: string) {
  const trimmedValue = value.trim()

  return trimmedValue || null
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return ''

  const [year, month, day] = dateValue.split('-').map(Number)

  if (!year || !month || !day) return dateValue

  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function formatTime(timeValue: string | null) {
  if (!timeValue) return ''

  return timeValue.slice(0, 5)
}

function getCustomerName(customers: OrderOption['customers']) {
  if (Array.isArray(customers)) return customers[0]?.name?.trim() || ''

  return customers?.name?.trim() || ''
}

function getOrderTitle(order: OrderOption) {
  const itemDescription = order.order_items?.[0]?.description?.trim()
  const customerName = getCustomerName(order.customers)
  const baseTitle =
    itemDescription ||
    (customerName ? `Pedido de ${customerName}` : `Pedido ${order.id.slice(0, 8)}`)
  const deliveryDate = formatDate(order.delivery_date)
  const deliveryTime = formatTime(order.delivery_time)

  if (deliveryDate && deliveryTime) return `${baseTitle} - ${deliveryDate} às ${deliveryTime}`
  if (deliveryDate) return `${baseTitle} - ${deliveryDate}`

  return baseTitle
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

export default function NovoItemAgendaPage() {
  const [form, setForm] = useState<ProductionForm>(createInitialForm)
  const [recipes, setRecipes] = useState<RecipeOption[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      setIsLoadingOptions(true)
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
          .order('delivery_date', { ascending: false })

        if (ordersError) {
          logSupabaseError('Erro Supabase orders select:', ordersError)
          throw ordersError
        }

        if (isMounted) {
          setCurrentUserId(user.id)
          setRecipes((recipesData ?? []) as RecipeOption[])
          setOrders((ordersData ?? []) as OrderOption[])
        }
      } catch (err) {
        console.error('Erro ao carregar opções da agenda:', {
          message: getErrorMessage(err, 'Falha ao carregar opções'),
          fullError: err,
        })
        if (isMounted) {
          setError(getErrorMessage(err, 'Falha ao carregar opções'))
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false)
        }
      }
    }

    loadOptions()

    return () => {
      isMounted = false
    }
  }, [supabase])

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const field = event.target.name as keyof ProductionForm
    const value =
      field === 'status' ? (event.target.value as ProductionStatus) : event.target.value

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function validateForm() {
    if (!form.title.trim()) return 'Título é obrigatório'
    if (!form.production_date) return 'Data de produção é obrigatória'

    const quantity = parseOptionalQuantity(form.quantity)

    if (form.quantity.trim() && (quantity === null || quantity < 0)) {
      return 'Quantidade a produzir deve ser um número válido'
    }

    if (form.start_time && form.end_time && form.end_time < form.start_time) {
      return 'Horário final não pode ser antes do horário inicial'
    }

    return ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        logSupabaseError('Erro Supabase auth.getUser:', userError)
        throw userError
      }

      if (!user || (currentUserId && user.id !== currentUserId)) {
        throw new Error('Usuário não autenticado')
      }

      const quantity = parseOptionalQuantity(form.quantity)

      const { error: insertError } = await supabase.from('production_schedule').insert([
        {
          user_id: user.id,
          title: form.title.trim(),
          production_date: form.production_date,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          status: form.status,
          recipe_id: form.recipe_id || null,
          order_id: form.order_id || null,
          quantity,
          notes: optionalText(form.notes),
        },
      ])

      if (insertError) {
        logSupabaseError('Erro Supabase production_schedule insert:', insertError)
        throw insertError
      }

      router.push('/agenda')
    } catch (err) {
      console.error('Erro ao salvar item da agenda:', {
        message: getErrorMessage(err, 'Falha ao salvar item da agenda'),
        fullError: err,
      })
      setError(getErrorMessage(err, 'Falha ao salvar item da agenda'))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              PRODUÇÃO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">
              Novo item da agenda
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados da produção</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="title">
                  Título *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Ex: Produzir massa do bolo de chocolate"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="production_date"
                >
                  Data de produção *
                </label>
                <input
                  id="production_date"
                  name="production_date"
                  type="date"
                  value={form.production_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="start_time"
                >
                  Horário inicial
                </label>
                <input
                  id="start_time"
                  name="start_time"
                  type="time"
                  value={form.start_time}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="end_time">
                  Horário final
                </label>
                <input
                  id="end_time"
                  name="end_time"
                  type="time"
                  value={form.end_time}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="recipe_id"
                >
                  Receita vinculada
                </label>
                <select
                  id="recipe_id"
                  name="recipe_id"
                  value={form.recipe_id}
                  onChange={handleChange}
                  disabled={isLoadingOptions}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B] disabled:cursor-not-allowed disabled:bg-[#FAF6F0]"
                >
                  <option value="">Nenhuma receita</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="order_id"
                >
                  Pedido vinculado
                </label>
                <select
                  id="order_id"
                  name="order_id"
                  value={form.order_id}
                  onChange={handleChange}
                  disabled={isLoadingOptions}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B] disabled:cursor-not-allowed disabled:bg-[#FAF6F0]"
                >
                  <option value="">Nenhum pedido</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {getOrderTitle(order)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="quantity">
                  Quantidade a produzir
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={handleChange}
                  placeholder="Ex: 24"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="notes">
                  Observações
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Detalhes de preparo, prioridades, embalagem ou observações do pedido..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="min-h-11 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-5 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} aria-hidden="true" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar item'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
