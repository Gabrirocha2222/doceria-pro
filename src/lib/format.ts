export type NumericValue = number | string | null | undefined

/**
 * Converte string com vírgula ou ponto para number.
 * Retorna 0 para valores não numéricos.
 */
export function parseDecimal(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Converte NumericValue (string | number | null | undefined) para number.
 * Trata vírgulas como separador decimal.
 */
export function parseNumericValue(value: NumericValue): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') return parseDecimal(value)
  return 0
}

/**
 * Converte inteiro seguro a partir de string. Retorna 0 se inválido.
 */
export function parseInteger(value: string): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : 0
}

/**
 * Formata number como moeda BRL (ex: R$ 12,50).
 * Aceita NumericValue para conveniência — converte antes de formatar.
 */
export function formatCurrency(value: NumericValue): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseNumericValue(value))
}

/**
 * Formata number com até N casas decimais no locale pt-BR.
 */
export function formatNumber(value: NumericValue, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits,
  }).format(parseNumericValue(value))
}

/**
 * Retorna o texto trimado ou null se vazio.
 */
export function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * Converte string numérica para decimal ou null se vazio.
 */
export function optionalDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Converte string monetária para decimal ou null se vazio.
 */
export function optionalMoney(value: string): number | null {
  const trimmed = value.trim()
  return trimmed ? parseDecimal(trimmed) : null
}

/**
 * Converte NumericValue para string adequada para inputs.
 */
export function toInputValue(value: NumericValue): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * Normaliza unidade de medida para lowercase sem acentos.
 */
export function normalizeUnit(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Gera ID local único para listas temporárias.
 */
export function createLocalId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
