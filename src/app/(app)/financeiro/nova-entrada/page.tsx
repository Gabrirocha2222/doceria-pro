'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { optionalText } from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'

type EntryForm = {
  description: string
  amount: string
  category: string
  transaction_date: string
  notes: string
}

type SupabaseErrorDetails = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

const entryCategories = ['Venda', 'Encomenda', 'Evento', 'Outro']

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseAmount(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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

const initialForm: EntryForm = {
  description: '',
  amount: '',
  category: 'Venda',
  transaction_date: getTodayDate(),
  notes: '',
}

export default function NovaEntradaPage() {
  const [form, setForm] = useState<EntryForm>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as keyof EntryForm

    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  function validateForm() {
    if (!form.description.trim()) return 'Descrição é obrigatória'
    if (parseAmount(form.amount) <= 0) return 'Valor deve ser maior que zero'
    if (!form.transaction_date) return 'Data é obrigatória'
    if (!isDateInputValue(form.transaction_date)) {
      return 'Data deve estar no formato YYYY-MM-DD'
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

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const { error: insertError } = await supabase.from('financial_transactions').insert([
        {
          user_id: user.id,
          type: 'entrada',
          description: form.description.trim(),
          amount: Number(form.amount),
          category: form.category,
          transaction_date: form.transaction_date,
          notes: optionalText(form.notes),
        },
      ])

      if (insertError) {
        logSupabaseError('Erro Supabase financial_transactions insert:', insertError)
        throw insertError
      }

      router.push('/financeiro')
    } catch (err) {
      const message = getErrorMessage(err, 'Falha ao salvar entrada')
      console.error('Erro ao salvar entrada:', {
        message,
        fullError: err,
      })
      setError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-3">
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
              FINANCEIRO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Nova entrada</h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados da entrada</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="description"
                >
                  Descrição *
                </label>
                <input
                  id="description"
                  name="description"
                  type="text"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Ex: Encomenda bolo de chocolate"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="amount">
                  Valor *
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="category"
                >
                  Categoria
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {entryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="transaction_date"
                >
                  Data *
                </label>
                <input
                  id="transaction_date"
                  name="transaction_date"
                  type="date"
                  value={form.transaction_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
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
                  placeholder="Detalhes adicionais sobre a entrada..."
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#17803D] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#11622F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} aria-hidden="true" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar entrada'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
