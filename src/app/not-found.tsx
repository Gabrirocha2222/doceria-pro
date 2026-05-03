import Link from 'next/link'
import { CakeSlice } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF6F0] px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C0392B]">
          <CakeSlice size={32} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">404</p>
          <h1 className="mt-1 text-xl font-bold text-[#1A0A08]">Página não encontrada</h1>
          <p className="mt-1 text-sm text-[#1A0A08]/60">
            A página que você procura não existe ou foi movida.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#C0392B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A0301F] active:scale-95"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}
