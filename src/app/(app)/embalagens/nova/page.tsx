'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Calculator, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  formatCurrency,
  optionalText,
  parseDecimal,
} from '@/lib/format'

type PackagingForm = {
  name: string
  category: string
  package_quantity: string
  unit: string
  package_cost: string
  stock_quantity: string
  stock_unit: string
  supplier_id: string
  capacity: string
  capacity_unit: string
  notes: string
}

type Supplier = {
  id: string
  name: string
}

const categoryOptions = ['Forminha', 'Caixa', 'Saco', 'Bandeja', 'Transporte', 'Outro']
const stockUnitOptions = [
  'unidade',
  'pacote',
  'caixa',
  'rolo',
  'kg',
  'g',
  'litro',
  'ml',
  'outro',
]

const initialForm: PackagingForm = {
  name: '',
  category: 'Forminha',
  package_quantity: '',
  unit: 'unidades',
  package_cost: '',
  stock_quantity: '0',
  stock_unit: 'unidade',
  supplier_id: '',
  capacity: '',
  capacity_unit: '',
  notes: '',
}
function parseOptionalDecimal(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) return null

  const parsed = Number(trimmedValue.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

function normalizeUpper(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR')
}

function calculateCostPerUnit(packageCost: number, packageQuantity: number) {
  if (packageCost <= 0 || packageQuantity <= 0) return 0

  return packageCost / packageQuantity
}
export default function NovaEmbalagemPage() {
  const [form, setForm] = useState<PackagingForm>(initialForm)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadSuppliers() {
      setIsLoadingSuppliers(true)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuario nao autenticado')
        }

        const { data, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
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
          setIsLoadingSuppliers(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const packageQuantity = useMemo(
    () => parseDecimal(form.package_quantity),
    [form.package_quantity]
  )
  const packageCost = useMemo(() => parseDecimal(form.package_cost), [form.package_cost])
  const stockQuantity = useMemo(() => parseDecimal(form.stock_quantity), [form.stock_quantity])
  const capacity = useMemo(() => parseOptionalDecimal(form.capacity), [form.capacity])
  const costPerUnit = useMemo(
    () => calculateCostPerUnit(packageCost, packageQuantity),
    [packageCost, packageQuantity]
  )

  const hasEnoughDataToCalculate = packageQuantity > 0 && packageCost > 0

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const field = event.target.name as keyof PackagingForm

    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  function validateForm() {
    if (!form.name.trim()) return 'Nome da embalagem é obrigatório'
    if (packageQuantity <= 0) return 'Quantidade por pacote deve ser maior que zero'
    if (!form.unit.trim()) return 'Unidade é obrigatória'
    if (packageCost <= 0) return 'Custo do pacote deve ser maior que zero'
    if (stockQuantity < 0) return 'Estoque atual nao pode ser negativo'
    if (!form.stock_unit.trim()) return 'Unidade do estoque e obrigatoria'
    if (form.capacity.trim() && (capacity === null || capacity < 0)) {
      return 'Capacidade deve ser um número válido'
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

      const { error: insertError } = await supabase.from('packaging').insert([
        {
          user_id: user.id,
          name: normalizeUpper(form.name),
          category: normalizeUpper(form.category),
          package_quantity: packageQuantity,
          unit: form.unit.trim(),
          package_cost: packageCost,
          cost_per_unit: costPerUnit,
          stock_quantity: stockQuantity,
          stock_unit: form.stock_unit.trim() || 'unidade',
          supplier_id: form.supplier_id || null,
          capacity,
          capacity_unit: form.capacity_unit.trim() ? normalizeUpper(form.capacity_unit) : null,
          notes: optionalText(form.notes),
        },
      ])

      if (insertError) {
        console.error('Erro Supabase packaging:', JSON.stringify(insertError, null, 2))
        throw insertError
      }

      router.push('/embalagens')
    } catch (err) {
      console.error('Erro ao salvar embalagem:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar embalagem'
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
              ESTOQUE
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Nova embalagem</h1>
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
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados da embalagem</h2>

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
                  placeholder="Ex: Forminha nº6"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="category">
                  Categoria
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="supplier_id">
                  Fornecedor preferencial
                </label>
                <select
                  id="supplier_id"
                  name="supplier_id"
                  value={form.supplier_id}
                  onChange={handleChange}
                  disabled={isLoadingSuppliers || suppliers.length === 0}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B] disabled:cursor-not-allowed disabled:bg-[#FAF6F0] disabled:text-[#999999]"
                >
                  <option value="">Sem fornecedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {!isLoadingSuppliers && suppliers.length === 0 && (
                  <Link
                    href="/fornecedores/novo"
                    className="mt-2 inline-flex text-sm font-semibold text-[#C0392B] transition-colors hover:text-[#A0301F]"
                  >
                    Cadastre um fornecedor
                  </Link>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="unit">
                  Unidade *
                </label>
                <input
                  id="unit"
                  name="unit"
                  type="text"
                  value={form.unit}
                  onChange={handleChange}
                  placeholder="unidades"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="package_quantity"
                >
                  Quantidade por pacote *
                </label>
                <input
                  id="package_quantity"
                  name="package_quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.package_quantity}
                  onChange={handleChange}
                  placeholder="100"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="package_cost"
                >
                  Custo do pacote *
                </label>
                <input
                  id="package_cost"
                  name="package_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.package_cost}
                  onChange={handleChange}
                  placeholder="2,40"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="stock_quantity"
                >
                  Estoque atual
                </label>
                <input
                  id="stock_quantity"
                  name="stock_quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.stock_quantity}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="stock_unit"
                >
                  Unidade do estoque
                </label>
                <select
                  id="stock_unit"
                  name="stock_unit"
                  value={form.stock_unit}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {stockUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="capacity">
                  Capacidade
                </label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="48"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="capacity_unit"
                >
                  Unidade da capacidade
                </label>
                <input
                  id="capacity_unit"
                  name="capacity_unit"
                  type="text"
                  value={form.capacity_unit}
                  onChange={handleChange}
                  placeholder="brigadeiros"
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
                  placeholder="Tamanho, fornecedor, uso recomendado..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C9A84C]">
                <Calculator size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#1A0A08]">
                  Custo por unidade
                </h2>
                <p className="mt-2 text-3xl font-bold text-[#1A0A08]" aria-live="polite">
                  {formatCurrency(costPerUnit)}
                  <span className="ml-2 text-base font-semibold text-[#999999]">
                    / {form.unit.trim() || 'unidade'}
                  </span>
                </p>
                <p className="mt-2 text-sm text-[#999999]">
                  {hasEnoughDataToCalculate
                    ? 'O valor será salvo automaticamente no campo cost_per_unit.'
                    : 'Informe custo e quantidade para calcular em tempo real.'}
                </p>
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
              <span>{isSubmitting ? 'Salvando...' : 'Salvar embalagem'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
