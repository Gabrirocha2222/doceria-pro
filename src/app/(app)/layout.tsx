'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Boxes,
  CakeSlice,
  CalendarDays,
  ChefHat,
  ClipboardList,
  DollarSign,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

type MenuItem = {
  href: string
  label: string
  icon: LucideIcon
  id: string
}

type PrimaryAction =
  | {
      kind: 'navigate'
      href: string
      label: string
    }
  | {
      kind: 'finance-menu'
      label: string
    }
  | {
      kind: 'notice'
      label: string
      message: string
    }

const menuItems: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
  { href: '/pedidos', label: 'Pedidos', icon: Package, id: 'pedidos' },
  { href: '/producao', label: 'Produção', icon: ChefHat, id: 'producao' },
  { href: '/receitas', label: 'Receitas', icon: CakeSlice, id: 'receitas' },
  { href: '/ingredientes', label: 'Ingredientes', icon: Wheat, id: 'ingredientes' },
  { href: '/embalagens', label: 'Embalagens', icon: Boxes, id: 'embalagens' },
  { href: '/fornecedores', label: 'Fornecedores', icon: Truck, id: 'fornecedores' },
  { href: '/pedidos-fornecedores', label: 'Terceirizados', icon: ClipboardList, id: 'pedidos-fornecedores' },
  { href: '/clientes', label: 'Clientes', icon: Users, id: 'clientes' },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign, id: 'financeiro' },
  { href: '/lista-compras', label: 'Lista de compras', icon: ShoppingCart, id: 'lista-compras' },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays, id: 'agenda' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, id: 'configuracoes' },
]

function renderMenuIcon(Icon: MenuItem['icon'], size = 20) {
  return <Icon size={size} aria-hidden="true" />
}

function isRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function getPrimaryAction(pathname: string): PrimaryAction {
  if (isRoute(pathname, '/pedidos-fornecedores')) {
    return {
      kind: 'notice',
      label: 'Pedidos de fornecedores',
      message: 'Pedidos de fornecedores são gerados pelos pedidos',
    }
  }

  if (isRoute(pathname, '/pedidos')) {
    return { kind: 'navigate', href: '/pedidos/novo', label: 'Novo pedido' }
  }

  if (isRoute(pathname, '/producao')) {
    return {
      kind: 'notice',
      label: 'Produção',
      message: 'Use os filtros da página de produção',
    }
  }

  if (isRoute(pathname, '/ingredientes')) {
    return { kind: 'navigate', href: '/ingredientes/novo', label: 'Novo ingrediente' }
  }

  if (isRoute(pathname, '/embalagens')) {
    return { kind: 'navigate', href: '/embalagens/nova', label: 'Nova embalagem' }
  }

  if (isRoute(pathname, '/clientes')) {
    return { kind: 'navigate', href: '/clientes/novo', label: 'Nova cliente' }
  }

  if (isRoute(pathname, '/fornecedores')) {
    return { kind: 'navigate', href: '/fornecedores/novo', label: 'Novo fornecedor' }
  }

  if (isRoute(pathname, '/receitas')) {
    return { kind: 'navigate', href: '/receitas/nova', label: 'Nova receita' }
  }

  if (isRoute(pathname, '/agenda')) {
    return { kind: 'navigate', href: '/agenda/novo', label: 'Novo item da agenda' }
  }

  if (isRoute(pathname, '/financeiro')) {
    return { kind: 'finance-menu', label: 'Nova movimentação financeira' }
  }

  if (isRoute(pathname, '/lista-compras')) {
    return {
      kind: 'notice',
      label: 'Gerar lista de compras',
      message: 'Gere a lista nesta página',
    }
  }

  if (isRoute(pathname, '/configuracoes')) {
    return {
      kind: 'notice',
      label: 'Configurações',
      message: 'Use as seções da página',
    }
  }

  return { kind: 'navigate', href: '/pedidos/novo', label: 'Novo pedido' }
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isFinanceActionMenuOpen, setIsFinanceActionMenuOpen] = useState(false)
  const [primaryActionNotice, setPrimaryActionNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [userInitial, setUserInitial] = useState('A')
  const router = useRouter()
  const pathname = usePathname()
  const primaryAction = getPrimaryAction(pathname)
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsFinanceActionMenuOpen(false)
      setPrimaryActionNotice(null)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [pathname])

  useEffect(() => {
    if (!primaryActionNotice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setPrimaryActionNotice(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [primaryActionNotice])

  const handleLogout = async () => {
    setIsMobileMenuOpen(false)
    setIsAccountMenuOpen(false)
    setIsFinanceActionMenuOpen(false)
    setPrimaryActionNotice(null)
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

  const handlePrimaryAction = () => {
    setIsMobileMenuOpen(false)
    setIsAccountMenuOpen(false)
    setPrimaryActionNotice(null)

    if (primaryAction.kind === 'finance-menu') {
      setIsFinanceActionMenuOpen((isOpen) => !isOpen)
      return
    }

    setIsFinanceActionMenuOpen(false)

    if (primaryAction.kind === 'notice') {
      setPrimaryActionNotice(primaryAction.message)
      return
    }

    router.push(primaryAction.href)
  }

  const closeFinanceActionMenu = () => {
    setIsFinanceActionMenuOpen(false)
    setPrimaryActionNotice(null)
  }

  const openMobileMenu = () => {
    setIsAccountMenuOpen(false)
    setIsFinanceActionMenuOpen(false)
    setPrimaryActionNotice(null)
    setIsMobileMenuOpen(true)
  }

  const toggleMobileMenu = () => {
    setIsAccountMenuOpen(false)
    setIsFinanceActionMenuOpen(false)
    setPrimaryActionNotice(null)
    setIsMobileMenuOpen((isOpen) => !isOpen)
  }

  const toggleAccountMenu = () => {
    setIsMobileMenuOpen(false)
    setIsFinanceActionMenuOpen(false)
    setPrimaryActionNotice(null)
    setIsAccountMenuOpen((isOpen) => !isOpen)
  }

  const isActive = (href: string) => isRoute(pathname, href)

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col lg:flex-row">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-[52px] bg-[#1A0A08] border-r border-[rgba(26,10,8,0.1)] items-center py-6 fixed h-screen left-0 top-0">
        {/* Logo */}
        <Link
          href="/dashboard"
          aria-label="Ir para o dashboard"
          title="Doceria Pro"
          className="mb-8 flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#C0392B] text-white hover:bg-[#A0301F] transition-colors cursor-pointer"
        >
          <CakeSlice size={20} aria-hidden="true" />
        </Link>

        {/* Menu Items */}
        <nav className="flex-1 flex flex-col gap-4">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-[#C0392B] text-white'
                  : 'text-[#999999] hover:text-[#E8956D]'
              }`}
            >
              {renderMenuIcon(item.icon)}
            </Link>
          ))}
        </nav>

        {/* Logout + Avatar */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
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
          <button
            type="button"
            onClick={openMobileMenu}
            aria-label="Abrir menu de módulos"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-app-menu"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white transition-colors hover:bg-[#2A1A18]"
          >
            <CakeSlice size={24} aria-hidden="true" />
          </button>

          <Link
            href="/dashboard"
            aria-label="Ir para o dashboard"
            title="Ir para o dashboard"
            className="text-white text-sm"
          >
            Doceria Pro
          </Link>

          <button
            type="button"
            onClick={toggleAccountMenu}
            aria-label="Abrir menu da conta"
            aria-expanded={isAccountMenuOpen}
            aria-controls="mobile-account-menu"
            className="w-8 h-8 rounded-full bg-[#C0392B] flex items-center justify-center text-white text-xs font-bold transition-colors hover:bg-[#A0301F]"
          >
            {userInitial}
          </button>
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
            {isFinanceActionMenuOpen && (
              <div
                className="lg:hidden fixed inset-0 z-40"
                onClick={closeFinanceActionMenu}
              >
                <div
                  id="mobile-finance-action-menu"
                  role="menu"
                  aria-label="Nova movimentação financeira"
                  className="fixed bottom-24 left-1/2 w-[92vw] max-w-[320px] -translate-x-1/2 rounded-xl border border-[rgba(26,10,8,0.08)] bg-white p-2 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Link
                    href="/financeiro/nova-entrada"
                    role="menuitem"
                    onClick={closeFinanceActionMenu}
                    className="flex min-h-12 w-full items-center rounded-lg px-4 py-3 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
                  >
                    Nova entrada
                  </Link>

                  <Link
                    href="/financeiro/nova-saida"
                    role="menuitem"
                    onClick={closeFinanceActionMenu}
                    className="flex min-h-12 w-full items-center rounded-lg px-4 py-3 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
                  >
                    Nova saída
                  </Link>
                </div>
              </div>
            )}

            {primaryActionNotice && (
              <div
                role="status"
                aria-live="polite"
                className="lg:hidden fixed bottom-24 left-1/2 z-30 w-[92vw] max-w-[320px] -translate-x-1/2 rounded-xl bg-[#1A0A08] px-4 py-3 text-center text-sm font-medium text-white shadow-xl"
              >
                {primaryActionNotice}
              </div>
            )}

            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-14 h-14 rounded-full bg-[#C0392B] hover:bg-[#A0301F] text-white flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
              aria-label={primaryAction.label}
              aria-expanded={primaryAction.kind === 'finance-menu' ? isFinanceActionMenuOpen : undefined}
              aria-controls={primaryAction.kind === 'finance-menu' ? 'mobile-finance-action-menu' : undefined}
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
            type="button"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-app-menu"
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isMobileMenuOpen ? 'text-[#C0392B]' : 'text-[#999999]'
            }`}
          >
            <Menu size={24} />
            <span className="text-xs">Menu</span>
          </button>
        </nav>

        {/* MOBILE ACCOUNT MENU */}
        {isAccountMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40"
            onClick={() => setIsAccountMenuOpen(false)}
          >
            <div
              id="mobile-account-menu"
              role="menu"
              aria-label="Menu da conta"
              className="fixed right-4 top-14 w-56 rounded-xl bg-white py-2 shadow-2xl border border-[rgba(26,10,8,0.08)]"
              onClick={(event) => event.stopPropagation()}
            >
              {/* TODO: implementar */}

              <Link
                href="/configuracoes"
                role="menuitem"
                onClick={() => setIsAccountMenuOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
              >
                <Settings size={18} aria-hidden="true" />
                <span>Configurações</span>
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoading}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-[#C0392B] transition-colors hover:bg-[#FAF6F0] disabled:opacity-50"
              >
                <LogOut size={18} aria-hidden="true" />
                <span>{isLoading ? 'Saindo...' : 'Sair'}</span>
              </button>
            </div>
          </div>
        )}

        {/* MOBILE MENU DRAWER */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setIsMobileMenuOpen(false)}>
            <div
              id="mobile-app-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-app-menu-title"
              className="fixed bottom-4 left-1/2 w-[92vw] max-w-[420px] max-h-[calc(100vh-2rem)] -translate-x-1/2 bg-white rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-[rgba(26,10,8,0.08)] px-4 py-3">
                <div id="mobile-app-menu-title" className="text-sm font-bold text-[#1A0A08]">Menu</div>
              </div>

              <div className="max-h-[calc(100vh-5.5rem)] touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 pb-6">
                <div className="space-y-1.5">
                  {menuItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-[#C0392B] text-white'
                          : 'text-[#1A0A08] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <span className="inline-flex w-5 shrink-0 justify-center">
                        {renderMenuIcon(item.icon, 18)}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleLogout()
                    setIsMobileMenuOpen(false)
                  }}
                  disabled={isLoading}
                  className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-[#C0392B] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A0301F] disabled:opacity-50"
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
