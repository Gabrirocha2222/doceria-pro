'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Paginação"
      className="mt-6 flex items-center justify-center gap-3"
    >
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3.5 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        <span>Anterior</span>
      </button>

      <span className="min-w-[100px] text-center text-sm font-medium text-[#1A0A08]">
        Página {currentPage} de {totalPages}
      </span>

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3.5 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>Próximo</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  )
}

export const PAGE_SIZE = 20

export function paginate<T>(items: T[], page: number): { paged: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const paged = items.slice(start, start + PAGE_SIZE)

  return { paged, totalPages }
}
