'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type NumericValue = number | string | null | undefined

type CustomerRelation =
  | {
      name: string | null
    }
  | {
      name: string | null
    }[]
  | null

type OrderItem = {
  id: string
  quantity: NumericValue
  unit_price: NumericValue
}

type Order = {
  id: string
  user_id: string
  customer_id: string | null
  delivery_date: string | null
  delivery_time: string | null
  total_value: NumericValue
  deposit_value: NumericValue
  status: string | null
  payment_status: string | null
  order_date: string | null
  customers?: CustomerRelation
  order_items?: OrderItem[] | null
}

type Ingredient = {
  id: string
  user_id: string
  name: string
  stock_quantity: NumericValue
  minimum_stock: NumericValue
  usage_unit: string | null
}

type DashboardData = {
  orders: Order[]
  stockAlerts: Ingredient[]
}

type IconProps = {
  className?: string
}

const monthlyGoal = 6000
const emptyData: DashboardData = {
  orders: [],
  stockAlerts: [],
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
})

const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const months = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function parseNumber(value: NumericValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatCurrency(value: NumericValue) {
  return currencyFormatter.format(parseNumber(value))
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

function addDays(date: string, amount: number) {
  const parsedDate = parseInputDate(date)
  parsedDate.setDate(parsedDate.getDate() + amount)

  return formatInputDate(parsedDate)
}

function getCurrentWeekRange(today: string) {
  const parsedToday = parseInputDate(today)
  const dayOfWeek = parsedToday.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const start = new Date(parsedToday)
  start.setDate(parsedToday.getDate() + mondayOffset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    start: formatInputDate(start),
    end: formatInputDate(end),
  }
}

function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return {
    start: formatInputDate(start),
    end: formatInputDate(end),
  }
}

function getCurrentDateLabel() {
  const now = new Date()

  return `${weekdays[now.getDay()]}, ${now.getDate()} de ${
    months[now.getMonth()]
  } de ${now.getFullYear()}`
}

function getOrderBusinessDate(order: Order) {
  return order.order_date ?? order.delivery_date
}

function isDateInRange(date: string | null | undefined, start: string, end: string) {
  return Boolean(date && date >= start && date <= end)
}

function getCustomerName(order: Order) {
  const customer = order.customers

  if (Array.isArray(customer)) {
    return customer[0]?.name?.trim() || 'Cliente'
  }

  return customer?.name?.trim() || 'Cliente'
}

function getProductDescription() {
  return 'Pedido'
}

function getInitials(name: string) {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function normalizePaymentStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? ''
}

function normalizeOrderStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase().replace(/_/g, ' ') ?? 'novo'

  if (normalized.includes('produc')) return 'produção'
  if (normalized.includes('pronto')) return 'pronto'
  if (normalized.includes('entregue')) return 'entregue'

  return 'novo'
}

function getStatusStyle(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status)

  if (normalized === 'produção') {
    return { label: 'produção', className: 'bg-[#EEF0FE] text-[#3730A3]' }
  }

  if (normalized === 'pronto') {
    return { label: 'pronto', className: 'bg-[#E6F4E6] text-[#2D6A2D]' }
  }

  if (normalized === 'entregue') {
    return { label: 'entregue', className: 'bg-[#F0F0F0] text-[#888888]' }
  }

  return { label: 'novo', className: 'bg-[#FEF0DC] text-[#8B5E3C]' }
}

function formatDeliveryTime(time: string | null | undefined) {
  if (!time) return 'sem hora'

  const [hour = '', minute = ''] = time.split(':')

  if (!hour) return 'sem hora'
  if (minute && minute !== '00') return `${hour.padStart(2, '0')}h${minute}`

  return `${hour.padStart(2, '0')}h`
}

function formatDeliveryDate(date: string | null | undefined, today: string) {
  if (!date) return 'sem data'
  if (date === today) return 'hoje'
  if (date === addDays(today, 1)) return 'amanhã'

  return shortDateFormatter.format(parseInputDate(date))
}

function compareOrdersByDelivery(firstOrder: Order, secondOrder: Order) {
  const firstDate = firstOrder.delivery_date ?? '9999-12-31'
  const secondDate = secondOrder.delivery_date ?? '9999-12-31'

  if (firstDate !== secondDate) return firstDate.localeCompare(secondDate)

  const firstTime = firstOrder.delivery_time ?? '99:99'
  const secondTime = secondOrder.delivery_time ?? '99:99'

  return firstTime.localeCompare(secondTime)
}

function CalendarIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3.5 9.5h17" />
      <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v11A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5Z" />
    </svg>
  )
}

function AlertIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10.4 4.2 2.9 17.1A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.9L13.6 4.2a1.9 1.9 0 0 0-3.2 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function HomeIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m3 10.8 9-7 9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  )
}

function OrdersIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6.5 3.5h11l2 4v13h-15v-13l2-4Z" />
      <path d="M4.5 7.5h15" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  )
}

function RecipeIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 3.5h10.5A1.5 1.5 0 0 1 18 5v15.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5" />
      <path d="M8 7h6" />
      <path d="M8 10.5h6" />
      <path d="M8 14h4" />
    </svg>
  )
}

function ProfileIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

function SectionHeader({
  title,
  href,
  actionLabel,
}: {
  title: string
  href?: string
  actionLabel?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[10px] font-bold uppercase tracking-[2px] text-[#8B5E3C]">{title}</h2>
      {href && actionLabel ? (
        <Link href={href} className="text-xs font-semibold text-[#D4845A]">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen overflow-y-auto bg-[#F5ECD7] px-4 pb-[80px] pt-6">
      <div className="mx-auto max-w-[1120px] space-y-5">
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse rounded-full bg-[#E8D8C0]" />
          <div className="h-8 w-64 max-w-full animate-pulse rounded-full bg-[#E8D8C0]" />
          <div className="h-9 w-56 animate-pulse rounded-full bg-[#E8D8C0]" />
        </div>
        <div className="h-48 animate-pulse rounded-[22px] bg-[#E8D8C0]" />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-28 min-w-[150px] flex-1 animate-pulse rounded-2xl bg-[#E8D8C0]" />
          <div className="h-28 min-w-[150px] flex-1 animate-pulse rounded-2xl bg-[#E8D8C0]" />
          <div className="h-28 min-w-[150px] flex-1 animate-pulse rounded-2xl bg-[#E8D8C0]" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded-full bg-[#E8D8C0]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[#E8D8C0]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[#E8D8C0]" />
        </div>
      </div>
    </div>
  )
}

function MetricPill({
  value,
  label,
  tag,
  tagClassName,
}: {
  value: string
  label: string
  tag?: string
  tagClassName?: string
}) {
  return (
    <div className="min-w-[150px] flex-1 rounded-2xl border border-[#E8D8C0] bg-[#FFFAF2] p-4">
      <div className="flex min-h-[24px] items-start justify-between gap-2">
        <p className="text-2xl font-bold leading-none text-[#2C1A0E]">{value}</p>
        {tag ? (
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold leading-none ${tagClassName}`}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-medium text-[#8B5E3C]">{label}</p>
    </div>
  )
}

function DeliveryCard({ order, today }: { order: Order; today: string }) {
  const customerName = getCustomerName(order)
  const status = getStatusStyle(order.status)

  return (
    <article className="flex gap-3 rounded-2xl border border-[#E8D8C0] bg-[#FFFAF2] px-[14px] py-3">
      <div className="w-[54px] shrink-0">
        <p className="text-base font-bold leading-tight text-[#D4845A]">
          {formatDeliveryTime(order.delivery_time)}
        </p>
        <p className="mt-1 text-[11px] font-medium text-[#8B5E3C]">
          {formatDeliveryDate(order.delivery_date, today)}
        </p>
      </div>
      <div className="w-px shrink-0 bg-[#E8D8C0]" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E4CC] text-xs font-bold text-[#8B5E3C]">
          {getInitials(customerName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#2C1A0E]">{customerName}</p>
              <p className="truncate text-xs text-[#8B5E3C]">{getProductDescription()}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-[#2C1A0E]">
              {formatCurrency(order.total_value)}
            </p>
          </div>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </div>
    </article>
  )
}

function StockAlertCard({ ingredients }: { ingredients: Ingredient[] }) {
  const barColors = ['#D4845A', '#C9A84C', '#8B5E3C']

  return (
    <section className="rounded-2xl border border-[#E8D8C0] bg-[#FFFAF2] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF0DC] text-[#D4845A]">
          <AlertIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#2C1A0E]">
            {ingredients.length} {ingredients.length === 1 ? 'ingrediente acabando' : 'ingredientes acabando'}
          </h2>
          <p className="text-xs text-[#8B5E3C]">abasteça antes de produzir</p>
        </div>
      </div>
      <div className="space-y-3">
        {ingredients.map((ingredient, index) => {
          const stock = parseNumber(ingredient.stock_quantity)
          const minimum = parseNumber(ingredient.minimum_stock)
          const progress = minimum > 0 ? Math.min((stock / minimum) * 100, 100) : 0

          return (
            <div key={ingredient.id}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-[#2C1A0E]">{ingredient.name}</p>
                <p className="shrink-0 text-xs font-medium text-[#8B5E3C]">
                  {stock.toLocaleString('pt-BR')} {ingredient.usage_unit ?? ''}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#E8D8C0]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: barColors[index] ?? '#8B5E3C',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BottomNav() {
  const items = [
    { href: '/dashboard', label: 'início', icon: HomeIcon, active: true },
    { href: '/pedidos', label: 'pedidos', icon: OrdersIcon, active: false },
    { href: '/receitas', label: 'receitas', icon: RecipeIcon, active: false },
    { href: '/agenda', label: 'agenda', icon: CalendarIcon, active: false },
    { href: '/configuracoes', label: 'perfil', icon: ProfileIcon, active: false },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-20 border-t border-[#E8D8C0] bg-[#FFFAF2] md:hidden">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[9px] font-semibold ${
              item.active ? 'text-[#D4845A]' : 'text-[#8B5E3C]'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
            <span
              className={`h-1 w-1 rounded-full ${item.active ? 'bg-[#D4845A]' : 'bg-transparent'}`}
            />
          </Link>
        )
      })}
    </nav>
  )
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => formatInputDate(new Date()), [])
  const weekRange = useMemo(() => getCurrentWeekRange(today), [today])
  const monthRange = useMemo(() => getCurrentMonthRange(), [])
  const [userName, setUserName] = useState('confeiteira')
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

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
          throw new Error('Usuária não autenticada.')
        }

        const fullName = user.user_metadata?.full_name

        if (isMounted) {
          setUserName(typeof fullName === 'string' && fullName.trim() ? fullName.trim() : 'confeiteira')
        }

        const [ordersResult, ingredientsResult] = await Promise.all([
          supabase
            .from('orders')
            .select('*, customers(name), order_items(id, quantity, unit_price)')
            .eq('user_id', user.id)
            .order('delivery_date', { ascending: true, nullsFirst: false })
            .order('delivery_time', { ascending: true, nullsFirst: false }),
          supabase
            .from('ingredients')
            .select('id, user_id, name, stock_quantity, minimum_stock, usage_unit')
            .eq('user_id', user.id)
            .order('name', { ascending: true }),
        ])

        if (ordersResult.error) throw ordersResult.error
        if (ingredientsResult.error) throw ingredientsResult.error

        const orders = (ordersResult.data ?? []) as unknown as Order[]
        const stockAlerts = ((ingredientsResult.data ?? []) as unknown as Ingredient[])
          .filter((ingredient) => {
            const stock = parseNumber(ingredient.stock_quantity)
            const minimum = parseNumber(ingredient.minimum_stock)

            return minimum >= 0 && stock <= minimum
          })
          .sort((firstIngredient, secondIngredient) => {
            const firstMinimum = parseNumber(firstIngredient.minimum_stock)
            const secondMinimum = parseNumber(secondIngredient.minimum_stock)
            const firstRatio =
              firstMinimum > 0 ? parseNumber(firstIngredient.stock_quantity) / firstMinimum : 0
            const secondRatio =
              secondMinimum > 0 ? parseNumber(secondIngredient.stock_quantity) / secondMinimum : 0

            return firstRatio - secondRatio
          })
          .slice(0, 3)

        if (isMounted) {
          setDashboardData({ orders, stockAlerts })
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', JSON.stringify(err, null, 2))
        console.error('Mensagem:', (err as any)?.message)
        console.error('Detalhes:', (err as any)?.details)
        console.error('Hint:', (err as any)?.hint)
        console.error('Code:', (err as any)?.code)

        if (isMounted) {
          setError('Não foi possível carregar o dashboard agora.')
          setDashboardData(emptyData)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const monthlyOrders = dashboardData.orders.filter((order) =>
    isDateInRange(getOrderBusinessDate(order), monthRange.start, monthRange.end)
  )
  const weeklyOrders = dashboardData.orders.filter((order) =>
    isDateInRange(getOrderBusinessDate(order), weekRange.start, weekRange.end)
  )
  const todayDeliveries = dashboardData.orders.filter((order) => order.delivery_date === today)
  const openReceivables = dashboardData.orders.filter(
    (order) => normalizePaymentStatus(order.payment_status) !== 'pago'
  )
  const upcomingDeliveries = dashboardData.orders
    .filter((order) => order.delivery_date && order.delivery_date >= today)
    .sort(compareOrdersByDelivery)
    .slice(0, 3)
  const monthlyRevenue = monthlyOrders.reduce(
    (total, order) => total + parseNumber(order.total_value),
    0
  )
  const monthlyProgress = Math.min((monthlyRevenue / monthlyGoal) * 100, 100)
  const receivableTotal = openReceivables.reduce((total, order) => {
    const openValue = parseNumber(order.total_value) - parseNumber(order.deposit_value)

    return total + Math.max(openValue, 0)
  }, 0)

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#F5ECD7] px-4 pb-[80px] pt-6 text-[#2C1A0E] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1120px] space-y-5">
        <header className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[#8B5E3C]">bom dia</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-[#2C1A0E]">
              sua cozinha te espera, {userName}
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-[20px] border border-[#E8D8C0] bg-[#FFFAF2] px-3 py-2 text-xs font-medium text-[#8B5E3C]">
            <CalendarIcon className="h-4 w-4 text-[#D4845A]" />
            <span>{getCurrentDateLabel()}</span>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-[#E8D8C0] bg-[#FFFAF2] p-4 text-sm text-[#8B5E3C]">
            {error}
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[22px] bg-[#2C1A0E] p-5">
          <div
            className="absolute -right-10 -top-8 h-32 w-32 rounded-full"
            style={{ backgroundColor: 'rgba(212, 132, 90, 0.16)' }}
          />
          <div
            className="absolute -bottom-14 right-12 h-28 w-28 rounded-full"
            style={{ backgroundColor: 'rgba(212, 132, 90, 0.10)' }}
          />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#C9A84C]">
              RECEITA DO MÊS
            </p>
            <p className="mt-4 text-[32px] font-bold leading-none text-[#FFFAF2]">
              {formatCurrency(monthlyRevenue)}
            </p>
            <p className="mt-2 text-sm text-[rgba(255,250,242,0.45)]">meta de R$ 6.000</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.10)]">
              <div
                className="h-full rounded-full bg-[#C9A84C]"
                style={{ width: `${monthlyProgress}%` }}
              />
            </div>
          </div>
        </section>

        <section className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          <MetricPill
            value={String(todayDeliveries.length)}
            label="entregas hoje"
            tag={todayDeliveries.length > 0 ? 'urgente' : undefined}
            tagClassName="bg-[#FEF0DC] text-[#8B5E3C]"
          />
          <MetricPill
            value={String(monthlyOrders.length)}
            label="pedidos no mês"
            tag={`+${weeklyOrders.length} semana`}
            tagClassName="bg-[#E6F4E6] text-[#2D6A2D]"
          />
          <MetricPill
            value={formatCurrency(receivableTotal)}
            label="a receber"
            tag={`${openReceivables.length} abertos`}
            tagClassName="bg-[#FFF4C7] text-[#8B5E3C]"
          />
        </section>

        <section>
          <SectionHeader title="ENTREGAS" href="/agenda" actionLabel="ver agenda" />
          <div className="space-y-3">
            {upcomingDeliveries.length > 0 ? (
              upcomingDeliveries.map((order) => (
                <DeliveryCard key={order.id} order={order} today={today} />
              ))
            ) : (
              <div className="rounded-2xl border border-[#E8D8C0] bg-[#FFFAF2] p-4 text-sm text-[#8B5E3C]">
                Nenhuma entrega programada por enquanto.
              </div>
            )}
          </div>
        </section>

        {dashboardData.stockAlerts.length > 0 ? (
          <section>
            <SectionHeader title="ESTOQUE - ATENÇÃO" />
            <StockAlertCard ingredients={dashboardData.stockAlerts} />
          </section>
        ) : null}
      </div>

      <BottomNav />
    </div>
  )
}
