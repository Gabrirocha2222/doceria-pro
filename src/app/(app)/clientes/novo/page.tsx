'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { optionalText, parseDecimal } from '@/lib/format'

type CustomerForm = {
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

const initialForm: CustomerForm = {
  name: '',
  phone: '',
  whatsapp: '',
  address: '',
  birthday: '',
  preferences: '',
  notes: '',
  balance: '',
  satisfaction: '',
  notes_private: '',
}
function optionalDate(value: string) {
  return value || null
}

function normalizeUpper(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR')
}

export default function NovaClientePage() {
  const [form, setForm] = useState<CustomerForm>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as keyof CustomerForm

    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Nome da cliente é obrigatório')
      return
    }

    const balance = parseDecimal(form.balance)
    if (balance < 0) {
      setError('Saldo inicial não pode ser negativo')
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

      const { error: insertError } = await supabase.from('customers').insert([
        {
          user_id: user.id,
          name: normalizeUpper(form.name),
          phone: optionalText(form.phone),
          whatsapp: optionalText(form.whatsapp),
          address: optionalText(form.address),
          birthday: optionalDate(form.birthday),
          preferences: optionalText(form.preferences),
          notes: optionalText(form.notes),
          balance,
          satisfaction: optionalText(form.satisfaction),
          notes_private: optionalText(form.notes_private),
        },
      ])

      if (insertError) throw insertError

      router.push('/clientes')
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar cliente'
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
              CLIENTES
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Nova cliente</h1>
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
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados da cliente</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="name">
                  Nome *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ex: Ana Silva"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="phone">
                  Telefone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(11) 3333-3333"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="whatsapp">
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={handleChange}
                  placeholder="5511999999999"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="address">
                  Endereço
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Rua, número, bairro, cidade"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="birthday">
                  Aniversário
                </label>
                <input
                  id="birthday"
                  name="birthday"
                  type="date"
                  value={form.birthday}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="preferences">
                  Preferências
                </label>
                <input
                  id="preferences"
                  name="preferences"
                  type="text"
                  value={form.preferences}
                  onChange={handleChange}
                  placeholder="sem glúten, prefere brigadeiro"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="balance">
                  Saldo inicial
                </label>
                <input
                  id="balance"
                  name="balance"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.balance}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="satisfaction">
                  Satisfação
                </label>
                <select
                  id="satisfaction"
                  name="satisfaction"
                  value={form.satisfaction}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  <option value="">Sem avaliação</option>
                  <option value="like">Like</option>
                  <option value="dislike">Dislike</option>
                </select>
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
                  placeholder="Anotações importantes sobre atendimento, entregas ou pedidos..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="notes_private"
                >
                  Observacoes internas
                </label>
                <textarea
                  id="notes_private"
                  name="notes_private"
                  value={form.notes_private}
                  onChange={handleChange}
                  placeholder="Notas privadas sobre relacionamento, combinados ou atendimento..."
                  rows={4}
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
              <span>{isSubmitting ? 'Salvando...' : 'Salvar cliente'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
