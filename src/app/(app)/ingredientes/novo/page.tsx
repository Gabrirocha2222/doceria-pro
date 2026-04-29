'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Calculator, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type IngredientForm = {
  name: string
  category: string
  purchase_unit: string
  purchase_quantity: string
  purchase_price: string
  usage_unit: string
  stock_quantity: string
  stock_unit: string
  supplier_id: string
}

type Supplier = {
  id: string
  name: string
}

type UnitDefinition = {
  kind: 'weight' | 'volume' | 'count'
  factor: number
}

const categoryOptions = [
  { value: 'farinhas', label: 'Farinhas' },
  { value: 'acucares', label: 'Açúcares' },
  { value: 'laticinios', label: 'Laticínios' },
  { value: 'gorduras', label: 'Gorduras' },
  { value: 'ovos', label: 'Ovos' },
  { value: 'chocolates', label: 'Chocolates' },
  { value: 'frutas', label: 'Frutas' },
  { value: 'essencias', label: 'Essências' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'outros', label: 'Outros' },
]

const purchaseUnitSuggestions = ['kg', 'litro', 'unidade', 'pacote', 'g', 'ml']
const useUnitSuggestions = ['g', 'ml', 'unidade', 'kg', 'litro']

const unitDefinitions: Record<string, UnitDefinition> = {
  g: { kind: 'weight', factor: 1 },
  grama: { kind: 'weight', factor: 1 },
  gramas: { kind: 'weight', factor: 1 },
  kg: { kind: 'weight', factor: 1000 },
  kilo: { kind: 'weight', factor: 1000 },
  quilo: { kind: 'weight', factor: 1000 },
  kilos: { kind: 'weight', factor: 1000 },
  quilos: { kind: 'weight', factor: 1000 },
  ml: { kind: 'volume', factor: 1 },
  mililitro: { kind: 'volume', factor: 1 },
  mililitros: { kind: 'volume', factor: 1 },
  l: { kind: 'volume', factor: 1000 },
  litro: { kind: 'volume', factor: 1000 },
  litros: { kind: 'volume', factor: 1000 },
  un: { kind: 'count', factor: 1 },
  unidade: { kind: 'count', factor: 1 },
  unidades: { kind: 'count', factor: 1 },
  pacote: { kind: 'count', factor: 1 },
  pacotes: { kind: 'count', factor: 1 },
  pct: { kind: 'count', factor: 1 },
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeUnit(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getUnitDefinition(unit: string) {
  return unitDefinitions[normalizeUnit(unit)]
}

function calculateCostPerUnit(
  purchasePrice: number,
  purchaseQuantity: number,
  purchaseUnit: string,
  useUnit: string
) {
  if (purchasePrice <= 0 || purchaseQuantity <= 0) return 0

  const purchaseDefinition = getUnitDefinition(purchaseUnit)
  const useDefinition = getUnitDefinition(useUnit)

  if (purchaseDefinition && useDefinition && purchaseDefinition.kind === useDefinition.kind) {
    const totalInBaseUnit = purchaseQuantity * purchaseDefinition.factor
    const totalUseUnits = totalInBaseUnit / useDefinition.factor

    return totalUseUnits > 0 ? purchasePrice / totalUseUnits : 0
  }

  return purchasePrice / purchaseQuantity
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const initialForm: IngredientForm = {
  name: '',
  category: 'farinhas',
  purchase_unit: '',
  purchase_quantity: '',
  purchase_price: '',
  usage_unit: '',
  stock_quantity: '',
  stock_unit: '',
  supplier_id: '',
}

export default function NovoIngredientePage() {
  const [form, setForm] = useState<IngredientForm>(initialForm)
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

  const purchaseQuantity = useMemo(
    () => parseDecimal(form.purchase_quantity),
    [form.purchase_quantity]
  )
  const purchasePrice = useMemo(() => parseDecimal(form.purchase_price), [form.purchase_price])
  const stockQuantity = useMemo(() => parseDecimal(form.stock_quantity), [form.stock_quantity])

  const costPerUnit = useMemo(
    () =>
      calculateCostPerUnit(
        purchasePrice,
        purchaseQuantity,
        form.purchase_unit,
        form.usage_unit
      ),
    [form.purchase_unit, form.usage_unit, purchasePrice, purchaseQuantity]
  )

  const hasEnoughDataToCalculate =
    purchasePrice > 0 &&
    purchaseQuantity > 0 &&
    Boolean(form.purchase_unit.trim()) &&
    Boolean(form.usage_unit.trim())

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const field = event.target.name as keyof IngredientForm
    setForm((currentForm) => ({
      ...currentForm,
      [field]: event.target.value,
    }))
  }

  function validateForm() {
    if (!form.name.trim()) return 'Nome do ingrediente é obrigatório'
    if (!form.purchase_unit.trim()) return 'Unidade de compra é obrigatória'
    if (purchaseQuantity <= 0) return 'Quantidade comprada deve ser maior que zero'
    if (purchasePrice <= 0) return 'Preço de compra deve ser maior que zero'
    if (!form.usage_unit.trim()) return 'Unidade de uso na receita é obrigatória'
    if (stockQuantity < 0) return 'Estoque atual não pode ser negativo'

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

      const { error: insertError } = await supabase.from('ingredients').insert([
        {
          user_id: user.id,
          name: form.name.trim(),
          category: form.category,
          purchase_unit: form.purchase_unit.trim(),
          usage_unit: form.usage_unit.trim(),
          purchase_quantity: purchaseQuantity,
          purchase_price: purchasePrice,
          cost_per_unit: costPerUnit,
          stock_quantity: stockQuantity,
          stock_unit: form.stock_unit.trim() || form.usage_unit.trim(),
          supplier_id: form.supplier_id || null,
        },
      ])

      if (insertError) {
        console.error('Erro Supabase:', JSON.stringify(insertError, null, 2))
        throw insertError
      }

      router.push('/ingredientes')
    } catch (err) {
      console.error('Erro ao salvar ingrediente:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar ingrediente'
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
              Ingredientes
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Novo ingrediente</h1>
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
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados do ingrediente</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="name">
                  Nome do ingrediente *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ex: Chocolate em pó"
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
                    <option key={category.value} value={category.value}>
                      {category.label}
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
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="purchase_unit">
                  Unidade de compra
                </label>
                <input
                  id="purchase_unit"
                  name="purchase_unit"
                  type="text"
                  list="purchase-unit-options"
                  value={form.purchase_unit}
                  onChange={handleChange}
                  placeholder="Ex: kg, litro, pacote"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
                <datalist id="purchase-unit-options">
                  {purchaseUnitSuggestions.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="purchase_quantity">
                  Quantidade comprada
                </label>
                <input
                  id="purchase_quantity"
                  name="purchase_quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={form.purchase_quantity}
                  onChange={handleChange}
                  placeholder="Ex: 1, 5, 12"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="purchase_price">
                  Preço de compra (R$)
                </label>
                <input
                  id="purchase_price"
                  name="purchase_price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.purchase_price}
                  onChange={handleChange}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="usage_unit">
                  Unidade de uso na receita
                </label>
                <input
                  id="usage_unit"
                  name="usage_unit"
                  type="text"
                  list="use-unit-options"
                  value={form.usage_unit}
                  onChange={handleChange}
                  placeholder="Ex: g, ml, unidade"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
                <datalist id="use-unit-options">
                  {useUnitSuggestions.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="stock_quantity">
                  Estoque atual
                </label>
                <input
                  id="stock_quantity"
                  name="stock_quantity"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={form.stock_quantity}
                  onChange={handleChange}
                  placeholder="Ex: 500"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="stock_unit">
                  Unidade do estoque
                </label>
                <input
                  id="stock_unit"
                  name="stock_unit"
                  type="text"
                  list="stock-unit-options"
                  value={form.stock_unit}
                  onChange={handleChange}
                  placeholder="Ex: g, ml, unidade"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
                <datalist id="stock-unit-options">
                  {useUnitSuggestions.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
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
                  Custo por unidade de uso
                </h2>
                <p className="mt-2 text-3xl font-bold text-[#1A0A08]" aria-live="polite">
                  {formatCurrency(costPerUnit)}
                  <span className="ml-2 text-base font-semibold text-[#999999]">
                    / {form.usage_unit.trim() || 'unidade'}
                  </span>
                </p>
                <p className="mt-2 text-sm text-[#999999]">
                  {hasEnoughDataToCalculate
                    ? 'O valor será salvo automaticamente no campo cost_per_unit.'
                    : 'Informe preço, quantidade e unidades para calcular em tempo real.'}
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
              <span>{isSubmitting ? 'Salvando...' : 'Salvar ingrediente'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
