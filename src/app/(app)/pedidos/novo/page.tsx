'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trash2, Upload } from 'lucide-react'

const statusOptions = [
  { id: 'novo', label: 'Novo' },
  { id: 'confirmado', label: 'Confirmado' },
  { id: 'em_producao', label: 'Em produção' },
  { id: 'pronto', label: 'Pronto' },
  { id: 'entregue', label: 'Entregue' },
  { id: 'cancelado', label: 'Cancelado' },
]

const paymentMethods = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'PIX' },
  { id: 'cartao_credito', label: 'Cartão crédito' },
  { id: 'cartao_debito', label: 'Cartão débito' },
  { id: 'transferencia', label: 'Transferência' },
]

interface FormData {
  customer_name: string
  customer_phone: string
  product_name: string
  description: string
  order_date: string
  delivery_date: string
  delivery_time: string
  total_value: number
  deposit_value: number
  remaining_value: number
  status: string
  payment_method: string
  remaining_payment_method: string
  deposit_payment_date: string
  remaining_payment_date: string
  address: string
  notes: string
}

export default function NovoPedidoPage() {
  const [form, setForm] = useState<FormData>({
    customer_name: '',
    customer_phone: '',
    product_name: '',
    description: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    delivery_time: '',
    total_value: 0,
    deposit_value: 0,
    remaining_value: 0,
    status: 'novo',
    payment_method: 'pix',
    remaining_payment_method: 'pix',
    deposit_payment_date: '',
    remaining_payment_date: '',
    address: '',
    notes: '',
  })

  const [images, setImages] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Obter user_id ao montar o componente
  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Erro ao obter usuário:', userError)
        setError('Erro ao autenticar. Faça login novamente.')
        return
      }
      if (user) {
        console.log('✅ Usuário autenticado:', user.id)
      } else {
        setError('Usuária não autenticada. Faça login para continuar.')
      }
    }
    getUser()
  }, [supabase])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    const field = name as keyof FormData
    setForm((prev) => ({
      ...prev,
      [field]:
        field === 'total_value' || field === 'deposit_value'
          ? parseFloat(value) || 0
          : value,
      ...(field === 'total_value' && {
        remaining_value: (parseFloat(value) || 0) - prev.deposit_value,
      }),
      ...(field === 'deposit_value' && {
        remaining_value: prev.total_value - (parseFloat(value) || 0),
      }),
    }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files))
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const validateForm = (): boolean => {
    if (!form.customer_name.trim()) {
      setError('Nome da cliente é obrigatório')
      return false
    }
    if (!form.product_name.trim()) {
      setError('Nome do pedido é obrigatório')
      return false
    }
    if (!form.delivery_date) {
      setError('Data de entrega é obrigatória')
      return false
    }
    if (!form.delivery_time) {
      setError('Horário de entrega é obrigatório')
      return false
    }
    if (form.total_value <= 0) {
      setError('Valor total deve ser maior que zero')
      return false
    }
    return true
  }

  const uploadImages = async (orderId: string) => {
    const uploadedPaths: string[] = []

    for (const image of images) {
      try {
        const filename = `${orderId}/${Date.now()}-${image.name}`
        const { error } = await supabase.storage
          .from('order-images')
          .upload(filename, image)

        if (error) throw error
        uploadedPaths.push(filename)
      } catch (err) {
        console.error('Erro ao fazer upload da imagem:', err)
      }
    }

    return uploadedPaths
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    // ✅ Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('❌ Erro de autenticação:', userError)
      setError('Usuária não autenticada. Faça login novamente.')
      return
    }

    const currentUserId = user.id
    console.log('✅ user_id verificado:', currentUserId)

    setIsLoading(true)

    try {
      console.log('📝 Iniciando criação de pedido...')

      // 1. Buscar ou criar cliente na tabela customers
      let customerId: string

      const { data: existingCustomers, error: searchError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('name', form.customer_name)
        .limit(1)

      if (searchError) {
        console.error('Erro ao buscar cliente:', searchError)
        throw new Error('Erro ao buscar cliente')
      }

      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id
        console.log('✅ Cliente existente encontrado:', customerId)
      } else {
        console.log('👤 Criando nova cliente...')
        const { data: newCustomer, error: createCustomerError } = await supabase
          .from('customers')
          .insert([{
            user_id: currentUserId,
            name: form.customer_name,
            phone: form.customer_phone || null,
          }])
          .select()

        if (createCustomerError || !newCustomer || newCustomer.length === 0) {
          console.error('❌ Erro ao criar cliente:', createCustomerError)
          throw new Error('Erro ao criar cliente')
        }
        customerId = newCustomer[0].id
        console.log('✅ Nova cliente criada:', customerId)
      }

      // 2. Inserir pedido na tabela orders usando o customer_id
      const orderData = {
        user_id: currentUserId,
        customer_id: customerId,
        order_date: form.order_date,
        delivery_date: form.delivery_date,
        delivery_time: form.delivery_time,
        total_value: Number(form.total_value) || 0,
        deposit_value: Number(form.deposit_value) || 0,
        status: form.status || 'novo',
        payment_status: form.deposit_value > 0 ? 'partial' : 'pending',
        delivery_address: form.address || null,
        notes: form.notes || null,
      }

      console.log('🛒 Dados do pedido a inserir:', JSON.stringify(orderData, null, 2))

      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()

      if (orderError) {
        console.error('❌ Erro detalhado:', JSON.stringify(orderError, null, 2))
        throw new Error(`Erro ao salvar pedido: ${orderError.message || orderError.code}`)
      }

      if (!createdOrder || createdOrder.length === 0) {
        throw new Error('Falha ao criar pedido: sem resposta do servidor')
      }

      const orderId = createdOrder[0].id
      console.log('✅ Pedido criado com ID:', orderId)

      // 3. Inserir o item na tabela order_items
      const orderItem = {
        order_id: orderId,
        description: form.product_name,
        quantity: 1,
        unit_price: form.total_value,
      }

      console.log('📦 Criando item do pedido:', orderItem)

      const { error: itemError } = await supabase
        .from('order_items')
        .insert([orderItem])

      if (itemError) {
        console.error('⚠️ Aviso: Erro ao criar item do pedido:', itemError)
      } else {
        console.log('✅ Item do pedido criado')
      }

      // Criar registros de pagamento
      const payments = []

      if (form.deposit_value > 0) {
        payments.push({
          order_id: orderId,
          amount: form.deposit_value,
          method: form.payment_method,
          payment_date: form.deposit_payment_date || null,
          notes: 'Sinal'
        })
      }

      if (form.remaining_value > 0) {
        payments.push({
          order_id: orderId,
          amount: form.remaining_value,
          method: form.remaining_payment_method,
          payment_date: form.remaining_payment_date || null,
          notes: 'Restante'
        })
      }

      if (payments.length > 0) {
        console.log('💰 Criando registros de pagamento:', payments)

        const { error: paymentsError } = await supabase
          .from('payments')
          .insert(payments)

        if (paymentsError) {
          console.error('⚠️ Aviso: Erro ao criar pagamentos:', paymentsError)
        } else {
          console.log('✅ Pagamentos registrados')
        }
      }

      // Upload de imagens
      if (images.length > 0) {
        console.log('📸 Fazendo upload de', images.length, 'imagem(ns)...')
        const imagePaths = await uploadImages(orderId)
        if (imagePaths.length > 0) {
          await supabase
            .from('orders')
            .update({ image_paths: imagePaths })
            .eq('id', orderId)
          console.log('✅ Imagens salvas')
        }
      }

      console.log('🎉 Pedido criado com sucesso!')
      router.push(`/pedidos/${orderId}`)
    } catch (err) {
      console.error('❌ Erro geral:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Falha ao salvar pedido: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full pb-8">
      {/* Header */}
      <div className="px-4 lg:px-6 py-4 bg-white border-b border-[rgba(26,10,8,0.07)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[#FAF6F0] rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-[#1A0A08]" />
          </button>
          <h1 className="text-2xl font-bold text-[#1A0A08]">Novo pedido</h1>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-100 border border-red-300 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações da Cliente */}
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <h2 className="font-bold text-[#1A0A08] mb-4">Informações da Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Nome da Cliente *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleInputChange}
                  placeholder="Ex: Ana Silva"
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  name="customer_phone"
                  value={form.customer_phone}
                  onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Endereço de Entrega
                </label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleInputChange}
                  placeholder="Rua, número, complemento"
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </div>

          {/* Informações do Pedido */}
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <h2 className="font-bold text-[#1A0A08] mb-4">Informações do Pedido</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Nome do Pedido *
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleInputChange}
                  placeholder="Ex: Bolo Chocolate"
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Data do Pedido
                </label>
                <input
                  type="date"
                  name="order_date"
                  value={form.order_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Data de Entrega *
                </label>
                <input
                  type="date"
                  name="delivery_date"
                  value={form.delivery_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Horário de Entrega *
                </label>
                <input
                  type="time"
                  name="delivery_time"
                  value={form.delivery_time}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Descrição do Produto
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="Sabor, tamanho, decoração, etc."
                  rows={3}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <h2 className="font-bold text-[#1A0A08] mb-4">Valores e Pagamento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Valor Total *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="total_value"
                  value={form.total_value}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Valor do Sinal
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="deposit_value"
                  value={form.deposit_value}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Valor Restante
                </label>
                <input
                  type="text"
                  value={`R$ ${form.remaining_value.toFixed(2)}`}
                  disabled
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-[#FAF6F0] text-[#1A0A08] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Forma de Pagamento do Sinal
                </label>
                <select
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Forma de Pagamento do Restante
                </label>
                <select
                  name="remaining_payment_method"
                  value={form.remaining_payment_method}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Data de Recebimento do Sinal
                </label>
                <input
                  type="date"
                  name="deposit_payment_date"
                  value={form.deposit_payment_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A0A08] mb-2">
                  Data de Recebimento do Restante
                </label>
                <input
                  type="date"
                  name="remaining_payment_date"
                  value={form.remaining_payment_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <h2 className="font-bold text-[#1A0A08] mb-4">Status Inicial</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, status: option.id }))}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                    form.status === option.id
                      ? 'bg-[#C0392B] text-white'
                      : 'bg-[#FAF6F0] text-[#1A0A08] hover:bg-white border border-[rgba(26,10,8,0.07)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fotos de Referência */}
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <h2 className="font-bold text-[#1A0A08] mb-4">Fotos de Referência</h2>
            <div className="mb-4">
              <label className="flex items-center justify-center border-2 border-dashed border-[rgba(26,10,8,0.2)] rounded-lg p-6 cursor-pointer hover:bg-[#FAF6F0] transition-colors">
                <div className="text-center">
                  <Upload size={24} className="text-[#C0392B] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#1A0A08]">Clique para enviar fotos</p>
                  <p className="text-xs text-[#999999]">ou arraste aqui</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {images.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#1A0A08] mb-2">
                  {images.length} arquivo(s) selecionado(s)
                </p>
                <div className="space-y-2">
                  {images.map((image, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#FAF6F0] rounded-lg">
                      <p className="text-sm text-[#1A0A08] truncate">{image.name}</p>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="p-1 hover:bg-white rounded transition-colors text-[#999999] hover:text-[#C0392B]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <label className="block text-sm font-medium text-[#1A0A08] mb-2">
              Observações
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleInputChange}
              placeholder="Anotações adicionais..."
              rows={4}
              className="w-full px-3 py-2 border border-[rgba(26,10,8,0.07)] rounded-lg bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 sticky bottom-0 bg-white border-t border-[rgba(26,10,8,0.07)] p-4 -mx-4 -mb-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 rounded-lg border border-[rgba(26,10,8,0.07)] text-[#1A0A08] font-medium hover:bg-[#FAF6F0] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-[#C0392B] hover:bg-[#A0301F] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Salvando...' : 'Criar Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
