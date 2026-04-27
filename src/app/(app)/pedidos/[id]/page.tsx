'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trash2, Clock, DollarSign, CheckCircle } from 'lucide-react'

const statusOptions = [
  { id: 'novo', label: 'Novo', color: '#3498DB' },
  { id: 'confirmado', label: 'Confirmado', color: '#2980B9' },
  { id: 'em_producao', label: 'Em produção', color: '#F39C12' },
  { id: 'pronto', label: 'Pronto', color: '#27AE60' },
  { id: 'entregue', label: 'Entregue', color: '#7F8C8D' },
  { id: 'cancelado', label: 'Cancelado', color: '#C0392B' },
]

interface Order {
  id: string
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
  address: string
  notes: string
  image_paths?: string[]
  created_at: string
}

export default function DetalhesPedidoPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const orderId = params.id as string

  const loadOrder = useCallback(async () => {
    await Promise.resolve()
    setIsLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (error) throw error
      setOrder(data)
    } catch (err) {
      console.error('Erro ao carregar pedido:', err)
      setError('Falha ao carregar pedido')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrder()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrder])

  const updateStatus = async (newStatus: string) => {
    if (!order) return

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null))
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Falha ao atualizar status')
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteOrder = async () => {
    if (!confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.'))
      return

    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId)
      if (error) throw error
      router.push('/pedidos')
    } catch (err) {
      console.error('Erro ao deletar:', err)
      setError('Falha ao deletar pedido')
    }
  }

  const getStatusColor = (status: string) => {
    const option = statusOptions.find((s) => s.id === status)
    return option?.color || '#999999'
  }

  const getStatusLabel = (status: string) => {
    const option = statusOptions.find((s) => s.id === status)
    return option?.label || status
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C0392B]"></div>
          <p className="mt-2 text-[#999999]">Carregando pedido...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-[#1A0A08]">Pedido não encontrado</p>
          <button
            onClick={() => router.push('/pedidos')}
            className="mt-4 px-4 py-2 bg-[#C0392B] hover:bg-[#A0301F] text-white rounded-lg font-medium transition-colors"
          >
            Voltar para Pedidos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full pb-8">
      {/* Header */}
      <div className="px-4 lg:px-6 py-4 bg-white border-b border-[rgba(26,10,8,0.07)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-[#FAF6F0] rounded-lg transition-colors"
            >
              <ArrowLeft size={24} className="text-[#1A0A08]" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#1A0A08]">{order.customer_name}</h1>
              <p className="text-sm text-[#999999]">{order.product_name}</p>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-full text-white text-sm font-semibold"
            style={{ backgroundColor: getStatusColor(order.status) }}
          >
            {getStatusLabel(order.status)}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 lg:px-6 py-4 max-w-4xl mx-auto">
          <div className="p-3 rounded-lg bg-red-100 border border-red-300 text-red-800 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* Informações do Pedido */}
        <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
          <h2 className="font-bold text-[#1A0A08] mb-4">Informações do Pedido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-[#999999] mb-1">Cliente</p>
              <p className="font-medium text-[#1A0A08]">{order.customer_name}</p>
              {order.customer_phone && (
                <p className="text-sm text-[#999999]">{order.customer_phone}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-[#999999] mb-1">Produto</p>
              <p className="font-medium text-[#1A0A08]">{order.product_name}</p>
              {order.description && (
                <p className="text-sm text-[#999999]">{order.description}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-[#999999] mb-1">Data do Pedido</p>
              <p className="font-medium text-[#1A0A08]">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <p className="text-sm text-[#999999] mb-1">Entrega</p>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#C0392B]" />
                <div>
                  <p className="font-medium text-[#1A0A08]">{formatDate(order.delivery_date)}</p>
                  <p className="text-sm text-[#999999]">{order.delivery_time}</p>
                </div>
              </div>
            </div>
            {order.address && (
              <div className="md:col-span-2">
                <p className="text-sm text-[#999999] mb-1">Endereço</p>
                <p className="font-medium text-[#1A0A08]">{order.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
          <h2 className="font-bold text-[#1A0A08] mb-4">Pagamento</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#FAF6F0] rounded-lg">
              <div>
                <p className="text-sm text-[#999999]">Valor Total</p>
                <p className="text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(order.total_value)}
                </p>
              </div>
              <DollarSign size={32} className="text-[#C0392B]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-[#C9A84C]">
                <p className="text-sm text-[#999999] mb-1">Sinal Pago</p>
                <p className="font-bold text-[#C9A84C]">{formatCurrency(order.deposit_value)}</p>
              </div>
              <div className="p-4 rounded-lg border border-[rgba(26,10,8,0.07)]">
                <p className="text-sm text-[#999999] mb-1">Restante</p>
                <p className="font-bold text-[#1A0A08]">{formatCurrency(order.remaining_value)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-[#999999] mb-1">Forma de Pagamento</p>
              <p className="font-medium text-[#1A0A08] capitalize">
                {order.payment_method === 'dinheiro'
                  ? 'Dinheiro'
                  : order.payment_method === 'pix'
                  ? 'PIX'
                  : order.payment_method === 'cartao'
                  ? 'Cartão'
                  : 'Transferência'}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
          <h2 className="font-bold text-[#1A0A08] mb-4">Mudar Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => updateStatus(option.id)}
                disabled={isUpdating}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  order.status === option.id
                    ? 'bg-[#C0392B] text-white'
                    : 'bg-[#FAF6F0] text-[#1A0A08] hover:bg-white border border-[rgba(26,10,8,0.07)]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {order.status === option.id && <CheckCircle size={14} className="inline mr-1" />}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Observações */}
        {order.notes && (
          <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-6">
            <h2 className="font-bold text-[#1A0A08] mb-3">Observações</h2>
            <p className="text-[#1A0A08] whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Excluir */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/pedidos')}
            className="flex-1 px-4 py-2 rounded-lg border border-[rgba(26,10,8,0.07)] text-[#1A0A08] font-medium hover:bg-[#FAF6F0] transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={deleteOrder}
            className="flex-1 px-4 py-2 rounded-lg bg-[#C0392B] hover:bg-[#A0301F] text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}
