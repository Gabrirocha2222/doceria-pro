'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Home,
  Package,
  DollarSign,
  Menu,
  LogOut,
  Plus,
} from 'lucide-react'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠', id: 'dashboard' },
  { href: '/pedidos', label: 'Pedidos', icon: '📦', id: 'pedidos' },
  { href: '/receitas', label: 'Receitas', icon: '🎂', id: 'receitas' },
  { href: '/ingredientes', label: 'Ingredientes', icon: '🧂', id: 'ingredientes' },
  { href: '/embalagens', label: 'Embalagens', icon: '📦', id: 'embalagens' },
  { href: '/fornecedores', label: 'Fornecedores', icon: '🚚', id: 'fornecedores' },
  { href: '/pedidos-fornecedores', label: 'Pedidos fornecedores', icon: 'PF', id: 'pedidos-fornecedores' },
  { href: '/clientes', label: 'Clientes', icon: '👩', id: 'clientes' },
  { href: '/lista-compras', label: 'Lista de compras', icon: '🛒', id: 'lista-compras' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰', id: 'financeiro' },
  { href: '/agenda', label: 'Agenda', icon: '📅', id: 'agenda' },
]

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userInitial, setUserInitial] = useState('A')
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserInitial(user.email.charAt(0).toUpperCase())
      }
    }
    getUser()
  }, [supabase.auth])

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewOrder = () => {
    router.push('/pedidos/novo')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col lg:flex-row">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-[52px] bg-[#1A0A08] border-r border-[rgba(26,10,8,0.1)] items-center py-6 fixed h-screen left-0 top-0">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#C0392B] hover:bg-[#A0301F] transition-colors cursor-pointer">
          <span className="text-lg">🍰</span>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 flex flex-col gap-4">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-[#C0392B] text-white'
                  : 'text-[#999999] hover:text-[#E8956D]'
              }`}
            >
              {item.icon}
            </Link>
          ))}
        </nav>

        {/* Logout + Avatar */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[#999999] hover:bg-[#2A1A18] transition-colors disabled:opacity-50"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#C0392B] flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:bg-[#A0301F] transition-colors">
            {userInitial}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-[52px] w-full lg:w-auto flex flex-col">
        {/* MOBILE HEADER */}
        <header className="lg:hidden bg-[#1A0A08] border-b border-[rgba(26,10,8,0.1)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <span className="text-2xl">🍰</span>
          <div className="text-white text-sm">Doceria Pro</div>
          <div className="w-8 h-8 rounded-full bg-[#C0392B] flex items-center justify-center text-white text-xs font-bold">
            {userInitial}
          </div>
        </header>

        {/* PAGE CONTENT */}
        {children}

        {/* MOBILE NAVIGATION */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[rgba(26,10,8,0.07)] h-20 flex items-center justify-around">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isActive('/dashboard')
                ? 'text-[#C0392B]'
                : 'text-[#999999]'
            }`}
          >
            <Home size={24} />
            <span className="text-xs">Home</span>
          </Link>

          <Link
            href="/pedidos"
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isActive('/pedidos')
                ? 'text-[#C0392B]'
                : 'text-[#999999]'
            }`}
          >
            <Package size={24} />
            <span className="text-xs">Pedidos</span>
          </Link>

          {/* Central + Button */}
          <div className="flex-1 flex items-center justify-center relative -top-4">
            <button
              onClick={handleNewOrder}
              className="w-14 h-14 rounded-full bg-[#C0392B] hover:bg-[#A0301F] text-white flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
            >
              <Plus size={28} />
            </button>
          </div>

          <Link
            href="/financeiro"
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isActive('/financeiro')
                ? 'text-[#C0392B]'
                : 'text-[#999999]'
            }`}
          >
            <DollarSign size={24} />
            <span className="text-xs">Financeiro</span>
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isMobileMenuOpen ? 'text-[#C0392B]' : 'text-[#999999]'
            }`}
          >
            <Menu size={24} />
            <span className="text-xs">Menu</span>
          </button>
        </nav>

        {/* MOBILE MENU DRAWER */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-30 z-40" onClick={() => setIsMobileMenuOpen(false)}>
            <div
              className="fixed bottom-20 left-0 right-0 bg-white rounded-t-2xl max-h-[60vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 space-y-2">
                <div className="text-sm font-bold text-[#1A0A08] mb-4">Menu</div>
                {menuItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block w-full px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-[#C0392B] text-white'
                        : 'text-[#1A0A08] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
                <button
                  onClick={() => {
                    handleLogout()
                    setIsMobileMenuOpen(false)
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-lg text-white bg-[#C0392B] hover:bg-[#A0301F] transition-colors disabled:opacity-50 mt-4"
                >
                  {isLoading ? 'Saindo...' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
