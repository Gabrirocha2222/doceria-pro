'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  MapPin,
  MessageCircle,
  PackageSearch,
  Phone,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Supplier {
  id: string
  user_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  address: string | null
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

  return `https://wa.me/${digits}`
}

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadSuppliers() {
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

        const { data, error: suppliersError } = await supabase
          .from('suppliers')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (suppliersError) throw suppliersError

        if (isMounted) {
          setSuppliers((data ?? []) as Supplier[])
        }
      } catch (err) {
        console.error('Erro ao carregar fornecedores:', err)
        if (isMounted) {
          setError('Falha ao carregar fornecedores')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadSuppliers()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return suppliers

    return suppliers.filter((supplier) =>
      supplier.name.toLowerCase().includes(query)
    )
  }, [searchQuery, suppliers])

  async function deleteSupplier(supplier: Supplier) {
    const confirmed = confirm(`Excluir o fornecedor "${supplier.name}"?`)
    if (!confirmed) return

    setDeletingId(supplier.id)
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
        .from('suppliers')
        .delete()
        .eq('id', supplier.id)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      setSuppliers((currentSuppliers) =>
        currentSuppliers.filter((currentSupplier) => currentSupplier.id !== supplier.id)
      )
    } catch (err) {
      console.error('Erro ao deletar fornecedor:', err)
      setError('Falha ao deletar fornecedor')
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
              PARCEIROS
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Fornecedores</h1>
          </div>

          <Link
            href="/fornecedores/novo"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            <Plus size={19} aria-hidden="true" />
            <span>Novo fornecedor</span>
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
          <label className="sr-only" htmlFor="supplier-search">
            Buscar fornecedor por nome
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"
              size={20}
              aria-hidden="true"
            />
            <input
              id="supplier-search"
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
            <p className="mt-3 text-sm text-[#999999]">Carregando fornecedores...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white px-5 py-12 text-center">
            <PackageSearch className="mx-auto mb-4 h-12 w-12 text-[#C9A84C]" aria-hidden="true" />
            <p className="text-lg font-semibold text-[#1A0A08]">
              {searchQuery ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
            </p>
            <p className="mt-1 text-sm text-[#999999]">
              {searchQuery
                ? 'Tente buscar por outro nome.'
                : 'Cadastre seus parceiros para manter contatos e entregas por perto.'}
            </p>
            {!searchQuery && (
              <Link
                href="/fornecedores/novo"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Novo fornecedor</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSuppliers.map((supplier) => {
              const whatsappHref = getWhatsAppHref(supplier.whatsapp)

              return (
                <article
                  key={supplier.id}
                  className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                        Fornecedor
                      </p>
                      <h2 className="mt-1 truncate text-base font-bold text-[#1A0A08]">
                        {supplier.name}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteSupplier(supplier)}
                      disabled={deletingId === supplier.id}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Excluir ${supplier.name}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 rounded-lg bg-[#FAF6F0] p-3">
                      <Phone size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Telefone</p>
                        <p className="mt-0.5 break-words font-semibold text-[#1A0A08]">
                          {supplier.phone || 'Não informado'}
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
                            {supplier.whatsapp}
                          </a>
                        ) : (
                          <p className="mt-0.5 font-semibold text-[#1A0A08]">Não informado</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Endereço</p>
                        <p className="mt-0.5 break-words text-[#1A0A08]">
                          {supplier.address || 'Não informado'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <StickyNote size={18} className="mt-0.5 shrink-0 text-[#C9A84C]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#999999]">Observações</p>
                        <p className="mt-0.5 break-words text-[#1A0A08]">
                          {supplier.notes || 'Sem observações'}
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
