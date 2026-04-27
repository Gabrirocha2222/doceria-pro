'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  PiggyBank,
  Plus,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type TransactionType = 'entrada' | 'saida'

interface FinancialTransaction {
  id: string
  user_id: string
  type: TransactionType
  description: string
  amount: number
  category: string | null
  transaction_date: string
  notes: string | null
  created_at?: string
}

type SupabaseErrorDetails = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

const defaultCategories = [
  'Venda',
  'Encomenda',
  'Evento',
  'Ingredientes',
  'Embalagens',
  'Fornecedores',
  'Equipamentos',
  'Marketing',
  'Transporte',
  'Contas',
  'Outro',
]

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  return {
    start: `${monthValue}-01`,
    end: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)

  if (!year || !month || !day) return dateValue

  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function getTransactionAmount(transaction: FinancialTransaction) {
  return Number(transaction.amount) || 0
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

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'todos' | TransactionType>('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadTransactions() {
      setIsLoading(true)
      setError('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuário não autenticado')
        }

        const monthRange = getMonthRange(selectedMonth)
        const { data, error: transactionsError } = await supabase
          .from('financial_transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('transaction_date', monthRange.start)
          .lte('transaction_date', monthRange.end)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })

        if (transactionsError) {
          logSupabaseError(
            'Erro Supabase financial_transactions select:',
            transactionsError
          )
          throw transactionsError
        }

        if (isMounted) {
          setTransactions((data ?? []) as FinancialTransaction[])
        }
      } catch (err) {
        console.error('Erro ao carregar movimentações financeiras:', {
          message: getErrorMessage(err, 'Falha ao carregar movimentações financeiras'),
          fullError: err,
        })
        if (isMounted) {
          setError(getErrorMessage(err, 'Falha ao carregar movimentações financeiras'))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadTransactions()

    return () => {
      isMounted = false
    }
  }, [selectedMonth, supabase])

  const categoryOptions = useMemo(() => {
    const categories = new Set(defaultCategories)

    transactions.forEach((transaction) => {
      if (transaction.category) {
        categories.add(transaction.category)
      }
    })

    return Array.from(categories).sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory, 'pt-BR')
    )
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return transactions.filter((transaction) => {
      const matchesSearch = query
        ? transaction.description.toLowerCase().includes(query)
        : true
      const matchesType = typeFilter === 'todos' ? true : transaction.type === typeFilter
      const matchesCategory =
        categoryFilter === 'todas' ? true : transaction.category === categoryFilter

      return matchesSearch && matchesType && matchesCategory
    })
  }, [categoryFilter, searchQuery, transactions, typeFilter])

  const summary = useMemo(() => {
    const entradas = transactions
      .filter((transaction) => transaction.type === 'entrada')
      .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0)
    const saidas = transactions
      .filter((transaction) => transaction.type === 'saida')
      .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0)
    const saldo = entradas - saidas

    return {
      entradas,
      saidas,
      saldo,
      lucroEstimado: saldo,
    }
  }, [transactions])

  const summaryCards = [
    {
      label: 'Entradas do mês',
      value: summary.entradas,
      icon: ArrowUpCircle,
      color: '#17803D',
    },
    {
      label: 'Saídas do mês',
      value: summary.saidas,
      icon: ArrowDownCircle,
      color: '#C0392B',
    },
    {
      label: 'Saldo do mês',
      value: summary.saldo,
      icon: Wallet,
      color: summary.saldo >= 0 ? '#17803D' : '#C0392B',
    },
    {
      label: 'Lucro estimado',
      value: summary.lucroEstimado,
      icon: TrendingUp,
      color: summary.lucroEstimado >= 0 ? '#C9A84C' : '#C0392B',
    },
  ]

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              GESTÃO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Financeiro</h1>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/financeiro/nova-entrada"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#17803D] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#11622F]"
            >
              <Plus size={19} aria-hidden="true" />
              <span>Nova entrada</span>
            </Link>
            <Link
              href="/financeiro/nova-saida"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
            >
              <Plus size={19} aria-hidden="true" />
              <span>Nova saída</span>
            </Link>
          </div>
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
                <p className="text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(card.value)}
                </p>
              </div>
            )
          })}
        </div>

        <section className="mb-6 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px_180px_160px]">
            <div>
              <label className="sr-only" htmlFor="financial-search">
                Buscar por descrição
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={20}
                  aria-hidden="true"
                />
                <input
                  id="financial-search"
                  type="search"
                  placeholder="Buscar por descrição..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>

            <div>
              <label className="sr-only" htmlFor="type-filter">
                Tipo
              </label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as 'todos' | TransactionType)
                }
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="todos">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            <div>
              <label className="sr-only" htmlFor="category-filter">
                Categoria
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                <option value="todas">Todas categorias</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="sr-only" htmlFor="month-filter">
                Mês
              </label>
              <div className="relative">
                <CalendarDays
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
                  size={18}
                  aria-hidden="true"
                />
                <input
                  id="month-filter"
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonth())}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando movimentações...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <PiggyBank className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              Nenhuma movimentação encontrada
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              Registre entradas e saídas para acompanhar o mês.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:inline-grid sm:grid-cols-2">
              <Link
                href="/financeiro/nova-entrada"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#17803D] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#11622F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova entrada</span>
              </Link>
              <Link
                href="/financeiro/nova-saida"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Nova saída</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => {
              const isEntry = transaction.type === 'entrada'
              const color = isEntry ? '#17803D' : '#C0392B'
              const Icon = isEntry ? ArrowUpCircle : ArrowDownCircle

              return (
                <article
                  key={transaction.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0]"
                        style={{ color }}
                      >
                        <Icon size={21} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words text-base font-bold text-[#1A0A08]">
                          {transaction.description}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
                            style={{ backgroundColor: color }}
                          >
                            {isEntry ? 'Entrada' : 'Saída'}
                          </span>
                          <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#1A0A08]">
                            {transaction.category || 'Sem categoria'}
                          </span>
                          <span className="rounded-full bg-[#FAF6F0] px-2.5 py-1 text-xs font-semibold text-[#999999]">
                            {formatDate(transaction.transaction_date)}
                          </span>
                        </div>
                        {transaction.notes && (
                          <p className="mt-3 break-words text-sm text-[#1A0A08]">
                            {transaction.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 sm:text-right">
                      <p className="text-xs font-medium text-[#999999]">Valor</p>
                      <p className="mt-1 text-xl font-bold" style={{ color }}>
                        {isEntry ? '+' : '-'} {formatCurrency(getTransactionAmount(transaction))}
                      </p>
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
