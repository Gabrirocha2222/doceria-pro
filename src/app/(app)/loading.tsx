export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF6F0]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#F1D7CF] border-t-[#C0392B]" />
      <p className="mt-4 text-sm font-medium text-[#1A0A08]/60">Carregando...</p>
    </div>
  )
}
