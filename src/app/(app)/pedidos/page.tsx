'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, Trash2 } from 'lucide-react'

const statusOptions = [
  { id: 'todos', label: 'Todos', color: '#1A0A08' },
  { id: 'novo', label: 'Novo', color: '#3498DB' },
  { id: 'confirmado', label: 'Confirmado', color: '#2980B9' },
  { id: 'em_producao', label: 'Em produção', color: '#F39C12' },
  { id: 'pronto', label: 'Pronto', color: '#27AE60' },
  { id: 'entregue', label: 'Entregue', color: '#7F8C8D' },
  { id: 'cancelado', label: 'Cancelado', color: '#C0392B' },
]

interface Order {
  id: string
  product_name: string
  delivery_date: string
  delivery_time: string
  total_value: number
  deposit_value: number
  remaining_value: number
  status: string
  created_at: string
  customer_phone?: string
  notes?: string
  payment_method?: string
  address?: string
  customers?: {
    id: string
    name: string
    phone: string
  }
  order_items?: {
    id: string
    description: string
    quantity: number
    unit_price: number
  }[]
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedStatus, setSelectedStatus] = useState('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const loadOrders = useCallback(async () => {
    await Promise.resolve()
    setIsLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            name,
            phone
          ),
          order_items (
            id,
            description,
            quantity,
            unit_price
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setOrders(data || [])
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err)
      setError('Falha ao carregar pedidos')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrders])

  const filteredOrders = useMemo(() => {
    let filtered = [...orders]

    // Filtrar por status
    if (selectedStatus !== 'todos') {
      filtered = filtered.filter((order) => order.status === selectedStatus)
    }

    // Filtrar por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((order) =>
        order.customers?.name?.toLowerCase().includes(query) ||
        order.product_name.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [orders, searchQuery, selectedStatus])

  const getStatusColor = (status: string) => {
    const option = statusOptions.find((s) => s.id === status)
    return option?.color || '#999999'
  }

  const getStatusLabel = (status: string) => {
    const option = statusOptions.find((s) => s.id === status)
    return option?.label || status
  }

  const deleteOrder = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return

    try {
      const { error } = await supabase.from('orders').delete().eq('id', id)
      if (error) throw error
      loadOrders()
    } catch (err) {
      console.error('Erro ao deletar:', err)
      setError('Falha ao deletar pedido')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  return (
    <div className="w-full pb-8">
      {/* Header */}
      <div className="px-4 lg:px-6 py-6 bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1A0A08]">Pedidos</h1>
          <Link
            href="/pedidos/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C0392B] hover:bg-[#A0301F] text-white font-medium transition-colors"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Novo pedido</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 lg:px-6 py-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Status Filter */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-min">
              {statusOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedStatus(option.id)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                    selectedStatus === option.id
                      ? 'bg-[#C0392B] text-white'
                      : 'bg-white border border-[rgba(26,10,8,0.07)] text-[#1A0A08] hover:bg-[#FAF6F0]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente ou pedido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
            />
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C0392B]"></div>
            <p className="mt-2 text-[#999999]">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)]">
            <p className="text-lg font-medium text-[#1A0A08]">Nenhum pedido encontrado</p>
            <p className="text-sm text-[#999999] mt-1">
              {searchQuery || selectedStatus !== 'todos'
                ? 'Tente ajustar seus filtros'
                : 'Comece criando seu primeiro pedido'}
            </p>
            {selectedStatus === 'todos' && !searchQuery && (
              <Link
                href="/pedidos/novo"
                className="inline-block mt-4 px-4 py-2 bg-[#C0392B] hover:bg-[#A0301F] text-white rounded-lg font-medium transition-colors"
              >
                Criar Pedido
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                href={`/pedidos/${order.id}`}
                className="block bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] hover:shadow-md transition-shadow overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 p-4"
                  style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-[#C0392B] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {order.customers?.name
                      ?.split(' ')
                      ?.map((n: string) => n[0])
                      ?.join('')
                      ?.toUpperCase()
                      ?.slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A0A08]">{order.customers?.name}</p>
                    <p className="text-sm text-[#999999] truncate">{order.product_name}</p>
                    <p className="text-xs text-[#999999] mt-1">
                      {formatDate(order.delivery_date)} às {order.delivery_time}
                    </p>
                  </div>

                  {/* Value */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <p className="font-bold text-[#1A0A08]">{formatCurrency(order.total_value)}</p>
                    <p className="text-xs text-[#C9A84C]">
                      {formatCurrency(order.deposit_value)} sinal
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div
                    className="px-3 py-1.5 rounded-full text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {getStatusLabel(order.status)}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      deleteOrder(order.id)
                    }}
                    className="p-2 rounded-lg text-[#999999] hover:bg-red-100 hover:text-[#C0392B] transition-colors flex-shrink-0"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
