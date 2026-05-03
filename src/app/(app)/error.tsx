'use client'

import { AlertTriangle } from 'lucide-react'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF6F0] px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle size={32} className="text-[#C0392B]" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1A0A08]">Algo deu errado</h1>
          <p className="mt-1 text-sm text-[#1A0A08]/60">
            Ocorreu um erro inesperado. Tente novamente.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#C0392B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A0301F] active:scale-95"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
