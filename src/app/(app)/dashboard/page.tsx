'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, AlertTriangle, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Dados mockados
const mockStories = [
  { id: 1, name: 'Ana Silva', time: '14:30', today: true },
  { id: 2, name: 'Maria Santos', time: '15:00', today: true },
  { id: 3, name: 'Carla Oliveira', time: '16:00', today: true },
  { id: 4, name: 'Julia Costa', time: '17:30', today: false },
  { id: 5, name: 'Patricia Lima', time: '18:00', today: false },
]

const mockMetrics = [
  { label: 'Faturamento do mês', value: 'R$ 8.450', variation: '+12%', isPositive: true, icon: '💰' },
  { label: 'Lucro estimado', value: 'R$ 3.200', variation: '+8%', isPositive: true, icon: '📈' },
  { label: 'Pedidos ativos', value: '14', variation: '+3', isPositive: true, icon: '📦' },
  { label: 'A receber', value: 'R$ 2.100', variation: '-2%', isPositive: false, icon: '🕐' },
]

const mockOrders = [
  {
    id: 1,
    clientName: 'Ana Silva',
    orderName: 'Bolo Chocolate Premium',
    deliveryTime: '14:30',
    value: 'R$ 85,00',
    status: 'Pronto',
    statusColor: '#27AE60',
    borderColor: '#27AE60',
  },
  {
    id: 2,
    clientName: 'Maria Santos',
    orderName: 'Cupcakes Sortidos',
    deliveryTime: '15:00',
    value: 'R$ 42,00',
    status: 'Em produção',
    statusColor: '#F39C12',
    borderColor: '#F39C12',
  },
  {
    id: 3,
    clientName: 'Carla Oliveira',
    orderName: 'Bolo Vegano',
    deliveryTime: '16:00',
    value: 'R$ 95,00',
    status: 'Urgente',
    statusColor: '#C0392B',
    borderColor: '#C0392B',
  },
  {
    id: 4,
    clientName: 'Julia Costa',
    orderName: 'Doces para Festa',
    deliveryTime: '17:30',
    value: 'R$ 150,00',
    status: 'Confirmado',
    statusColor: '#3498DB',
    borderColor: '#3498DB',
  },
]

const chartData = [
  { day: 'Seg', value: 1200 },
  { day: 'Ter', value: 850 },
  { day: 'Qua', value: 1800 },
  { day: 'Qui', value: 650 },
  { day: 'Sex', value: 2100 },
  { day: 'Sab', value: 1500 },
  { day: 'Dom', value: 950 },
]

function formatCurrentDate() {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  const formatted = now.toLocaleDateString('pt-BR', options)

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Confeiteira')
  const currentDate = useMemo(() => formatCurrentDate(), [])
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    // Buscar nome real da usuária
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name.split(' ')[0])
      } else if (user?.email) {
        setUserName(user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1))
      }
    }

    getUser()
  }, [supabase])

  return (
    <div className="w-full pb-24 lg:pb-8">
      {/* Header */}
      <header className="hidden lg:block bg-white border-b border-[rgba(26,10,8,0.07)] sticky top-0 z-20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A0A08]">
              Bom dia, {userName}
            </h1>
            <p className="text-sm text-[#999999]">{currentDate}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell size={24} className="text-[#1A0A08] cursor-pointer hover:text-[#C0392B] transition-colors" />
              <div className="absolute top-0 right-0 w-2 h-2 bg-[#C0392B] rounded-full"></div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#C0392B] flex items-center justify-center text-white text-sm font-bold cursor-pointer">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-4 lg:px-6 py-6 lg:py-8 max-w-7xl mx-auto w-full">
        {/* Stories Horizontais */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-min">
            {mockStories.map((story) => (
              <div
                key={story.id}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2 transition-transform hover:scale-110 border-2"
                  style={{
                    background: '#FFFFFF',
                    borderImage: story.today
                      ? 'linear-gradient(135deg, #C0392B, #C9A84C) 1'
                      : 'rgba(26,10,8,0.1)',
                  }}
                >
                  🎂
                </div>
                <span className="text-xs text-[#1A0A08] font-medium text-center max-w-[70px] truncate">
                  {story.name.split(' ')[0]}
                </span>
                <span className="text-xs text-[#999999]">{story.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {mockMetrics.map((metric, idx) => (
            <div
              key={idx}
              className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-4 hover:shadow-md transition-shadow relative"
            >
              <div className="absolute top-4 right-4 text-xl">{metric.icon}</div>
              <p className="text-xs text-[#999999] mb-2 font-medium">{metric.label}</p>
              <div className="flex items-end justify-between pr-8">
                <h3 className="text-lg font-bold text-[#1A0A08]">{metric.value}</h3>
                <div
                  className={`flex items-center gap-0.5 text-xs font-semibold ${
                    metric.isPositive ? 'text-[#27AE60]' : 'text-[#C0392B]'
                  }`}
                >
                  {metric.isPositive ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  {metric.variation}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] p-5 mb-8">
          <h2 className="text-lg font-bold text-[#1A0A08] mb-6">
            Faturamento dos últimos 7 dias
          </h2>
          <svg viewBox="0 0 600 160" className="w-full h-40" preserveAspectRatio="xMidYMid meet">
            {/* Baseline */}
            <line x1="20" y1="130" x2="580" y2="130" stroke="rgba(26,10,8,0.08)" strokeWidth="1" />

            {/* Bars */}
            {chartData.map((data, idx) => {
              const maxVal = Math.max(...chartData.map((d) => d.value))
              const barHeight = (data.value / maxVal) * 110
              const x = 20 + idx * 80
              const y = 130 - barHeight
              const isMax = data.value === maxVal
              const fill = isMax ? '#C9A84C' : '#C0392B'

              return (
                <g key={`bar-${idx}`}>
                  {/* Bar */}
                  <rect
                    x={x + 10}
                    y={y}
                    width="50"
                    height={barHeight}
                    fill={fill}
                    rx="4"
                  />

                  {/* Value label above bar */}
                  <text
                    x={x + 35}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#1A0A08"
                    fontWeight="500"
                  >
                    R$ {(data.value / 1000).toFixed(1)}k
                  </text>

                  {/* Day label below baseline */}
                  <text
                    x={x + 35}
                    y="145"
                    textAnchor="middle"
                    fontSize="11"
                    fill="#999999"
                  >
                    {data.day}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-[#C0392B] rounded-[16px] p-4 mb-8 flex gap-4">
          <AlertTriangle size={24} className="text-white flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">Atenção: Estoque baixo</p>
            <p className="text-sm text-white text-opacity-90 mt-1">
              Chocolate em pó, Fermento e Corante vermelho com estoque abaixo do limite
            </p>
          </div>
        </div>

        {/* Orders Feed */}
        <div>
          <h2 className="text-lg font-bold text-[#1A0A08] mb-4">Pedidos de hoje</h2>
          <div className="space-y-3">
            {mockOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-[16px] border border-[rgba(26,10,8,0.07)] hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex items-center gap-4 p-4" style={{ borderLeft: `4px solid ${order.borderColor}` }}>
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-[#C0392B] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {order.clientName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A0A08] text-sm">{order.clientName}</p>
                    <p className="text-sm text-[#999999]">{order.orderName}</p>
                  </div>

                  {/* Time & Value */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-sm font-semibold text-[#1A0A08]">{order.deliveryTime}</p>
                    <p className="text-sm font-bold text-[#C9A84C]">{order.value}</p>
                  </div>

                  {/* Status Badge */}
                  <div
                    className="px-3 py-1.5 rounded-full text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: order.statusColor }}
                  >
                    {order.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Action Button Mobile */}
        <button
          onClick={() => router.push('/pedidos/novo')}
          className="lg:hidden fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[#C0392B] hover:bg-[#A0301F] text-white flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 z-10"
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  )
}
