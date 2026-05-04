'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { optionalText } from '@/lib/format'

type SupplierForm = {
  name: string
  phone: string
  whatsapp: string
  address: string
  notes: string
}

const initialForm: SupplierForm = {
  name: '',
  phone: '',
  whatsapp: '',
  address: '',
  notes: '',
}

function normalizeUpper(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR')
}

export default function NovoFornecedorPage() {
  const [form, setForm] = useState<SupplierForm>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const field = event.target.name as keyof SupplierForm

    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Nome do fornecedor é obrigatório')
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

      const { error: insertError } = await supabase.from('suppliers').insert([
        {
          user_id: user.id,
          name: normalizeUpper(form.name),
          phone: optionalText(form.phone),
          whatsapp: optionalText(form.whatsapp),
          address: optionalText(form.address),
          notes: optionalText(form.notes),
        },
      ])

      if (insertError) throw insertError

      router.push('/fornecedores')
    } catch (err) {
      console.error('Erro ao salvar fornecedor:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar fornecedor'
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
              PARCEIROS
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Novo fornecedor</h1>
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
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados do fornecedor</h2>

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
                  placeholder="Ex: Distribuidora Doce Minas"
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

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="notes">
                  Observações
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Condições de entrega, produtos principais, horários de atendimento..."
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
              <span>{isSubmitting ? 'Salvando...' : 'Salvar fornecedor'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
