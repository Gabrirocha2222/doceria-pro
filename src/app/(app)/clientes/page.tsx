'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Calendar,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  StickyNote,
  Trash2,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  user_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  address: string | null
  birthday: string | null
  preferences: string | null
  notes: string | null
  created_at?: string
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function getWhatsAppHref(whatsapp: string | null) {
  if (!whatsapp) return ''

  const digits = onlyDigits(whatsapp)
  if (!digits) return ''

  const normalizedDigits = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits

  return `https://wa.me/${normalizedDigits}`
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

function formatBirthday(birthday: string | null) {
  if (!birthday) return 'Não informado'

  const [year, month, day] = birthday.split('-').map(Number)
  if (!year || !month || !day) return birthday

  const date = new Date(2000, month - 1, day)

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadCustomers() {
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

        const { data, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (customersError) throw customersError

        if (isMounted) {
          setCustomers((data ?? []) as Customer[])
        }
      } catch (err) {
        console.error('Erro ao carregar clientes:', err)
        if (isMounted) {
          setError('Falha ao carregar clientes')
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

  async function deleteCustomer(customer: Customer) {
    const confirmed = confirm(`Excluir a cliente "${customer.name}"?`)
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

      if (deleteError) throw deleteError

      setCustomers((currentCustomers) =>
        currentCustomers.filter((currentCustomer) => currentCustomer.id !== customer.id)
      )
    } catch (err) {
      console.error('Erro ao deletar cliente:', err)
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
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white py-3 pl-10 pr-4 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const whatsappHref = getWhatsAppHref(customer.whatsapp)

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

                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex items-start gap-3 rounded-lg bg-[#FAF6F0] p-3">
                        <Phone size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#999999]">Telefone</p>
                          <p className="mt-0.5 break-words font-semibold text-[#1A0A08]">
                            {customer.phone || 'Não informado'}
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
                              {customer.whatsapp}
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
                          {formatBirthday(customer.birthday)}
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
