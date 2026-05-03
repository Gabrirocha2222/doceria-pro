type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

/**
 * Log estruturado de erros do Supabase para debugging.
 * Extrai message, details, hint e code do objeto de erro.
 */
export function logSupabaseError(context: string, error: unknown): void {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}

  console.error(context, {
    message: supabaseError.message,
    details: supabaseError.details,
    hint: supabaseError.hint,
    code: supabaseError.code,
    fullError: error,
  })
}
