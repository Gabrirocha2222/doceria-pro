'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Tags,
  Trash2,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logSupabaseError } from '@/lib/supabase-error'

type NumericValue = number | string | null | undefined
type CategoryType = 'produtos' | 'receitas_base' | 'embalagens' | 'financeiro' | 'acrescimos'
type SectionId = 'loja' | 'aparencia' | 'categorias' | 'preferencias' | 'backup' | 'equipe' | 'perigo'
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonRecord = Record<string, JsonValue>
type SupabaseClientType = ReturnType<typeof createClient>

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type AppSettings = {
  id: string
  user_id: string
  store_name: string | null
  owner_name: string | null
  whatsapp: string | null
  instagram: string | null
  address: string | null
  city: string | null
  state: string | null
  primary_color: string | null
  accent_color: string | null
  background_color: string | null
  text_color: string | null
  default_order_status: string | null
  require_delivery_date: boolean | null
  default_down_payment_percent: NumericValue
  purchase_list_default_mode: string | null
  production_alert_days: NumericValue
  supplier_alert_days: NumericValue
  remarketing_alert_days: NumericValue
  created_at: string | null
  updated_at: string | null
}

type AppSettingsForm = {
  store_name: string
  owner_name: string
  whatsapp: string
  instagram: string
  address: string
  city: string
  state: string
  primary_color: string
  accent_color: string
  background_color: string
  text_color: string
  default_order_status: string
  require_delivery_date: boolean
  default_down_payment_percent: string
  purchase_list_default_mode: string
  production_alert_days: string
  supplier_alert_days: string
  remarketing_alert_days: string
}

type AppCategory = {
  id: string
  user_id: string
  type: CategoryType
  name: string
  sort_order: number | null
  is_active: boolean | null
  created_at: string | null
}

type CategoryInsert = {
  user_id: string
  type: CategoryType
  name: string
  sort_order: number
  is_active: boolean
}

type BackupPayload = {
  app: 'Doceria Pro'
  created_at: string
  user_id: string
  data: Record<string, JsonRecord[]>
  warnings: string[]
}

type BackupAction = {
  label: string
  slug: string
  tables: string[]
}

const defaultSettingsForm: AppSettingsForm = {
  store_name: '',
  owner_name: '',
  whatsapp: '',
  instagram: '',
  address: '',
  city: '',
  state: '',
  primary_color: '#C0392B',
  accent_color: '#C9A84C',
  background_color: '#FAF6F0',
  text_color: '#1A0A08',
  default_order_status: 'pendente',
  require_delivery_date: false,
  default_down_payment_percent: '0',
  purchase_list_default_mode: 'semana',
  production_alert_days: '2',
  supplier_alert_days: '2',
  remarketing_alert_days: '14',
}

const sections: { id: SectionId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'loja', label: 'Dados da loja', icon: Store },
  { id: 'aparencia', label: 'Aparência', icon: Palette },
  { id: 'categorias', label: 'Categorias', icon: Tags },
  { id: 'preferencias', label: 'Preferências', icon: SlidersHorizontal },
  { id: 'backup', label: 'Backup', icon: Download },
  { id: 'equipe', label: 'Equipe', icon: Users },
  { id: 'perigo', label: 'Zona perigosa', icon: ShieldAlert },
]

const categoryTypeOptions: { id: CategoryType; label: string }[] = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'receitas_base', label: 'Receitas base' },
  { id: 'embalagens', label: 'Embalagens' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'acrescimos', label: 'Acréscimos' },
]

const defaultCategories: Record<CategoryType, string[]> = {
  produtos: [
    'Bolos',
    'Doces tradicionais',
    'Doces finos',
    'Salgados tradicionais',
    'Salgados finos',
    'Kits',
    'Topos',
    'Outros',
  ],
  receitas_base: ['Massas', 'Recheios', 'Coberturas', 'Cremes', 'Preparos base'],
  embalagens: ['Forminhas', 'Caixas', 'Sacolas', 'Bandejas', 'Transporte', 'Descartáveis', 'Outros'],
  financeiro: [
    'Venda',
    'Encomenda',
    'Ingredientes',
    'Embalagens',
    'Fornecedores',
    'Transporte',
    'Marketing',
    'Contas',
    'Outros',
  ],
  acrescimos: ['Glitter', 'Pó decorativo', 'Balas Fini', 'Embalagem especial', 'Topo de bolo', 'Outro'],
}

const orderStatusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'novo', label: 'Novo' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'em_producao', label: 'Em produção' },
]

const purchaseModeOptions = [
  { value: 'semana', label: 'Semana' },
  { value: 'selecionados', label: 'Selecionados' },
  { value: 'mes', label: 'Mês' },
]

const backupActions: BackupAction[] = [
  { label: 'Exportar clientes', slug: 'clientes', tables: ['customers'] },
  { label: 'Exportar fornecedores', slug: 'fornecedores', tables: ['suppliers'] },
  { label: 'Exportar ingredientes', slug: 'ingredientes', tables: ['ingredients'] },
  { label: 'Exportar embalagens', slug: 'embalagens', tables: ['packaging'] },
  {
    label: 'Exportar receitas/produtos',
    slug: 'receitas-produtos',
    tables: ['recipes', 'recipe_ingredients', 'recipe_packaging', 'product_kit_items', 'kit_category_components'],
  },
  {
    label: 'Exportar pedidos',
    slug: 'pedidos',
    tables: ['orders', 'order_items', 'order_extras', 'order_cake_toppers', 'supplier_orders'],
  },
  { label: 'Exportar financeiro', slug: 'financeiro', tables: ['financial_transactions'] },
]

const allBackupTables = [
  'customers',
  'suppliers',
  'ingredients',
  'packaging',
  'recipes',
  'recipe_ingredients',
  'recipe_packaging',
  'product_kit_items',
  'kit_category_components',
  'orders',
  'order_items',
  'order_extras',
  'order_cake_toppers',
  'supplier_orders',
  'financial_transactions',
  'production_schedule',
]

const teamRoles = [
  { title: 'Administrador', description: 'Acesso total' },
  { title: 'Atendimento', description: 'Pedidos e clientes' },
  { title: 'Produção', description: 'Agenda, receitas e lista de compras' },
  { title: 'Financeiro', description: 'Financeiro e relatórios' },
]

function parseNumber(value: NumericValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
function createDefaultSettingsPayload(userId: string) {
  return {
    user_id: userId,
    primary_color: defaultSettingsForm.primary_color,
    accent_color: defaultSettingsForm.accent_color,
    background_color: defaultSettingsForm.background_color,
    text_color: defaultSettingsForm.text_color,
    default_order_status: defaultSettingsForm.default_order_status,
    require_delivery_date: defaultSettingsForm.require_delivery_date,
    default_down_payment_percent: parseNumber(defaultSettingsForm.default_down_payment_percent),
    purchase_list_default_mode: defaultSettingsForm.purchase_list_default_mode,
    production_alert_days: parseNumber(defaultSettingsForm.production_alert_days),
    supplier_alert_days: parseNumber(defaultSettingsForm.supplier_alert_days),
    remarketing_alert_days: parseNumber(defaultSettingsForm.remarketing_alert_days),
  }
}

function settingsToForm(settings: AppSettings): AppSettingsForm {
  return {
    store_name: settings.store_name ?? '',
    owner_name: settings.owner_name ?? '',
    whatsapp: settings.whatsapp ?? '',
    instagram: settings.instagram ?? '',
    address: settings.address ?? '',
    city: settings.city ?? '',
    state: settings.state ?? '',
    primary_color: settings.primary_color || defaultSettingsForm.primary_color,
    accent_color: settings.accent_color || defaultSettingsForm.accent_color,
    background_color: settings.background_color || defaultSettingsForm.background_color,
    text_color: settings.text_color || defaultSettingsForm.text_color,
    default_order_status: settings.default_order_status || defaultSettingsForm.default_order_status,
    require_delivery_date: settings.require_delivery_date ?? defaultSettingsForm.require_delivery_date,
    default_down_payment_percent: String(
      settings.default_down_payment_percent ?? defaultSettingsForm.default_down_payment_percent
    ),
    purchase_list_default_mode:
      settings.purchase_list_default_mode || defaultSettingsForm.purchase_list_default_mode,
    production_alert_days: String(settings.production_alert_days ?? defaultSettingsForm.production_alert_days),
    supplier_alert_days: String(settings.supplier_alert_days ?? defaultSettingsForm.supplier_alert_days),
    remarketing_alert_days: String(
      settings.remarketing_alert_days ?? defaultSettingsForm.remarketing_alert_days
    ),
  }
}

function buildDefaultCategoryRows(userId: string): CategoryInsert[] {
  return categoryTypeOptions.flatMap((typeOption) =>
    defaultCategories[typeOption.id].map((name, index) => ({
      user_id: userId,
      type: typeOption.id,
      name,
      sort_order: index,
      is_active: true,
    }))
  )
}

async function createDefaultCategories(supabase: SupabaseClientType, userId: string) {
  const rows = buildDefaultCategoryRows(userId)
  const { error } = await supabase.from('app_categories').insert(rows)

  if (error) {
    logSupabaseError('Erro Supabase app_categories default insert:', error)
    throw error
  }
}

async function ensureAppSettings(supabase: SupabaseClientType, userId: string) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    logSupabaseError('Erro Supabase app_settings select:', error)
    throw error
  }

  if (data) return data as AppSettings

  const { data: createdSettings, error: insertError } = await supabase
    .from('app_settings')
    .insert([createDefaultSettingsPayload(userId)])
    .select('*')
    .single()

  if (insertError) {
    logSupabaseError('Erro Supabase app_settings insert:', insertError)
    throw insertError
  }

  return createdSettings as AppSettings
}

async function loadAppCategories(supabase: SupabaseClientType, userId: string) {
  const { data, error } = await supabase
    .from('app_categories')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    logSupabaseError('Erro Supabase app_categories select:', error)
    throw error
  }

  if ((data ?? []).length > 0) return (data ?? []) as AppCategory[]

  await createDefaultCategories(supabase, userId)

  const { data: createdCategories, error: reloadError } = await supabase
    .from('app_categories')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (reloadError) {
    logSupabaseError('Erro Supabase app_categories reload:', reloadError)
    throw reloadError
  }

  return (createdCategories ?? []) as AppCategory[]
}

function downloadJsonFile(payload: BackupPayload, slug: string) {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `doceria-pro-backup-${slug}-${date}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function ConfiguracoesPage() {
  const [currentUserId, setCurrentUserId] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState<AppSettingsForm>(defaultSettingsForm)
  const [categories, setCategories] = useState<AppCategory[]>([])
  const [selectedSection, setSelectedSection] = useState<SectionId>('loja')
  const [selectedCategoryType, setSelectedCategoryType] = useState<CategoryType>('produtos')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [dangerConfirmation, setDangerConfirmation] = useState('')
  const [dangerMessage, setDangerMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [backupStatus, setBackupStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setError('')
      setFeedback('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          if (userError) logSupabaseError('Erro Supabase auth.getUser:', userError)
          throw new Error('Usuária não autenticada')
        }

        const loadedSettings = await ensureAppSettings(supabase, user.id)
        const loadedCategories = await loadAppCategories(supabase, user.id)

        if (isMounted) {
          setCurrentUserId(user.id)
          setSettings(loadedSettings)
          setSettingsForm(settingsToForm(loadedSettings))
          setCategories(loadedCategories)
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err)
        if (isMounted) {
          setError('Falha ao carregar configurações. Verifique se a migration app_settings foi aplicada.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
    }
  }, [supabase])

  function updateSettingsForm<K extends keyof AppSettingsForm>(field: K, value: AppSettingsForm[K]) {
    setSettingsForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function refreshCategories(userId = currentUserId) {
    if (!userId) return

    const loadedCategories = await loadAppCategories(supabase, userId)
    setCategories(loadedCategories)
  }

  async function saveSettingsPatch(patch: Partial<AppSettingsForm>, successMessage: string) {
    if (!settings || !currentUserId) return

    setIsSaving(true)
    setError('')
    setFeedback('')

    try {
      const { data, error: updateError } = await supabase
        .from('app_settings')
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id)
        .eq('user_id', currentUserId)
        .select('*')
        .single()

      if (updateError) {
        logSupabaseError('Erro Supabase app_settings update:', updateError)
        throw updateError
      }

      const updatedSettings = data as AppSettings
      setSettings(updatedSettings)
      setSettingsForm(settingsToForm(updatedSettings))
      setFeedback(successMessage)
    } catch (err) {
      console.error('Erro ao salvar configurações:', err)
      setError('Falha ao salvar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  function saveStoreData() {
    void saveSettingsPatch(
      {
        store_name: settingsForm.store_name.trim(),
        owner_name: settingsForm.owner_name.trim(),
        whatsapp: settingsForm.whatsapp.trim(),
        instagram: settingsForm.instagram.trim(),
        address: settingsForm.address.trim(),
        city: settingsForm.city.trim(),
        state: settingsForm.state.trim(),
      },
      'Dados da loja salvos.'
    )
  }

  function saveAppearance() {
    void saveSettingsPatch(
      {
        primary_color: settingsForm.primary_color,
        accent_color: settingsForm.accent_color,
        background_color: settingsForm.background_color,
        text_color: settingsForm.text_color,
      },
      'Aparência salva. A aplicação global da paleta fica para uma próxima etapa.'
    )
  }

  function savePreferences() {
    void saveSettingsPatch(
      {
        default_order_status: settingsForm.default_order_status,
        require_delivery_date: settingsForm.require_delivery_date,
        default_down_payment_percent: String(parseNumber(settingsForm.default_down_payment_percent)),
        purchase_list_default_mode: settingsForm.purchase_list_default_mode,
        production_alert_days: String(Math.max(parseNumber(settingsForm.production_alert_days), 0)),
        supplier_alert_days: String(Math.max(parseNumber(settingsForm.supplier_alert_days), 0)),
        remarketing_alert_days: String(Math.max(parseNumber(settingsForm.remarketing_alert_days), 0)),
      },
      'Preferências salvas.'
    )
  }

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name || !currentUserId) return

    const hasDuplicate = categories.some(
      (category) =>
        category.type === selectedCategoryType && normalizeName(category.name) === normalizeName(name)
    )

    if (hasDuplicate) {
      setFeedback('')
      setError('Essa categoria já existe para o tipo selecionado.')
      return
    }

    setIsSaving(true)
    setError('')
    setFeedback('')

    try {
      const nextSortOrder =
        categories.filter((category) => category.type === selectedCategoryType).length + 1

      const { error: insertError } = await supabase.from('app_categories').insert([
        {
          user_id: currentUserId,
          type: selectedCategoryType,
          name,
          sort_order: nextSortOrder,
          is_active: true,
        },
      ])

      if (insertError) {
        logSupabaseError('Erro Supabase app_categories insert:', insertError)
        throw insertError
      }

      setNewCategoryName('')
      await refreshCategories()
      setFeedback('Categoria adicionada.')
    } catch (err) {
      console.error('Erro ao adicionar categoria:', err)
      setError('Falha ao adicionar categoria')
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleCategory(category: AppCategory) {
    setIsSaving(true)
    setError('')
    setFeedback('')

    try {
      const { error: updateError } = await supabase
        .from('app_categories')
        .update({ is_active: !(category.is_active ?? true) })
        .eq('id', category.id)
        .eq('user_id', category.user_id)

      if (updateError) {
        logSupabaseError('Erro Supabase app_categories status update:', updateError)
        throw updateError
      }

      await refreshCategories(category.user_id)
      setFeedback('Categoria atualizada.')
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err)
      setError('Falha ao atualizar categoria')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteCategory(category: AppCategory) {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return

    setIsSaving(true)
    setError('')
    setFeedback('')

    try {
      const { error: deleteError } = await supabase
        .from('app_categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', category.user_id)

      if (deleteError) {
        logSupabaseError('Erro Supabase app_categories delete:', deleteError)
        throw deleteError
      }

      await refreshCategories(category.user_id)
      setFeedback('Categoria excluída.')
    } catch (err) {
      console.error('Erro ao excluir categoria:', err)
      setError('Falha ao excluir categoria')
    } finally {
      setIsSaving(false)
    }
  }

  async function exportBackup(slug: string, tables: string[]) {
    if (!currentUserId) return

    setBackupStatus(`Gerando backup ${slug}...`)
    setError('')
    setFeedback('')

    const payload: BackupPayload = {
      app: 'Doceria Pro',
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      data: {},
      warnings: [],
    }

    for (const table of tables) {
      const { data, error: tableError } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', currentUserId)

      if (tableError) {
        logSupabaseError(`Erro Supabase backup ${table}:`, tableError)
        payload.warnings.push(`Tabela ${table} não exportada: ${tableError.message}`)
        continue
      }

      payload.data[table] = (data ?? []) as JsonRecord[]
    }

    downloadJsonFile(payload, slug)
    setBackupStatus(
      payload.warnings.length > 0
        ? `Backup gerado com ${payload.warnings.length} aviso(s).`
        : 'Backup gerado com sucesso.'
    )
  }

  function showTestDataInstruction() {
    if (dangerConfirmation !== 'APAGAR') return

    setDangerMessage(
      'Para limpar dados de teste, use um script SQL seguro no Supabase. Peça ao assistente o script atualizado antes de apagar dados.'
    )
  }

  async function resetSettings() {
    if (dangerConfirmation !== 'APAGAR' || !currentUserId) return
    if (!window.confirm('Resetar apenas configurações e categorias? Pedidos e clientes serão preservados.')) {
      return
    }

    setIsSaving(true)
    setError('')
    setFeedback('')
    setDangerMessage('')

    try {
      const { error: settingsDeleteError } = await supabase
        .from('app_settings')
        .delete()
        .eq('user_id', currentUserId)

      if (settingsDeleteError) {
        logSupabaseError('Erro Supabase app_settings reset delete:', settingsDeleteError)
        throw settingsDeleteError
      }

      const { error: categoriesDeleteError } = await supabase
        .from('app_categories')
        .delete()
        .eq('user_id', currentUserId)

      if (categoriesDeleteError) {
        logSupabaseError('Erro Supabase app_categories reset delete:', categoriesDeleteError)
        throw categoriesDeleteError
      }

      const recreatedSettings = await ensureAppSettings(supabase, currentUserId)
      const recreatedCategories = await loadAppCategories(supabase, currentUserId)

      setSettings(recreatedSettings)
      setSettingsForm(settingsToForm(recreatedSettings))
      setCategories(recreatedCategories)
      setDangerConfirmation('')
      setFeedback('Configurações e categorias resetadas.')
    } catch (err) {
      console.error('Erro ao resetar configurações:', err)
      setError('Falha ao resetar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedCategories = categories.filter((category) => category.type === selectedCategoryType)
  const canUseDangerActions = dangerConfirmation === 'APAGAR'

  function renderTextInput(
    label: string,
    field: keyof Pick<
      AppSettingsForm,
      'store_name' | 'owner_name' | 'whatsapp' | 'instagram' | 'address' | 'city' | 'state'
    >,
    placeholder = ''
  ) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#1A0A08]">{label}</span>
        <input
          type="text"
          value={settingsForm[field]}
          onChange={(event) => updateSettingsForm(field, event.target.value)}
          placeholder={placeholder}
          className="min-h-11 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
        />
      </label>
    )
  }

  function renderColorInput(
    label: string,
    field: keyof Pick<AppSettingsForm, 'primary_color' | 'accent_color' | 'background_color' | 'text_color'>
  ) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#1A0A08]">{label}</span>
        <div className="flex min-h-11 items-center gap-3 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2">
          <input
            type="color"
            value={settingsForm[field]}
            onChange={(event) => updateSettingsForm(field, event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            aria-label={label}
          />
          <span className="font-mono text-sm font-semibold text-[#1A0A08]">{settingsForm[field]}</span>
        </div>
      </label>
    )
  }

  function renderNumberInput(
    label: string,
    field: keyof Pick<
      AppSettingsForm,
      | 'default_down_payment_percent'
      | 'production_alert_days'
      | 'supplier_alert_days'
      | 'remarketing_alert_days'
    >,
    suffix: string
  ) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#1A0A08]">{label}</span>
        <div className="flex min-h-11 items-center overflow-hidden rounded-lg border border-[rgba(26,10,8,0.07)] bg-white focus-within:ring-2 focus-within:ring-[#C0392B]">
          <input
            type="number"
            min="0"
            step={field === 'default_down_payment_percent' ? '0.01' : '1'}
            value={settingsForm[field]}
            onChange={(event) => updateSettingsForm(field, event.target.value)}
            className="min-h-11 w-full bg-white px-3 py-2 text-[#1A0A08] outline-none"
          />
          <span className="shrink-0 border-l border-[rgba(26,10,8,0.07)] px-3 text-sm font-semibold text-[#999999]">
            {suffix}
          </span>
        </div>
      </label>
    )
  }

  function renderSaveButton(label: string, onClick: () => void) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isSaving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save size={17} aria-hidden="true" />
        <span>{isSaving ? 'Salvando...' : label}</span>
      </button>
    )
  }

  function renderStoreSection() {
    return (
      <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
        <h2 className="text-lg font-bold text-[#1A0A08]">Dados da loja</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderTextInput('Nome da loja', 'store_name', 'Doceria da Ana')}
          {renderTextInput('Nome da responsável', 'owner_name', 'Ana Silva')}
          {renderTextInput('WhatsApp', 'whatsapp', '(00) 00000-0000')}
          {renderTextInput('Instagram', 'instagram', '@sualoja')}
          <div className="md:col-span-2">{renderTextInput('Endereço', 'address', 'Rua, número e bairro')}</div>
          {renderTextInput('Cidade', 'city')}
          {renderTextInput('Estado', 'state')}
        </div>
        <div className="mt-5">{renderSaveButton('Salvar dados da loja', saveStoreData)}</div>
      </section>
    )
  }

  function renderAppearanceSection() {
    return (
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)]">
        <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
          <h2 className="text-lg font-bold text-[#1A0A08]">Aparência</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderColorInput('Cor principal', 'primary_color')}
            {renderColorInput('Cor de destaque', 'accent_color')}
            {renderColorInput('Cor de fundo', 'background_color')}
            {renderColorInput('Cor do texto', 'text_color')}
          </div>
          <p className="mt-4 text-sm text-[#6F625F]">
            Por enquanto as cores são salvas e mostradas na prévia. A aplicação global fica para uma próxima etapa.
          </p>
          <div className="mt-5">{renderSaveButton('Salvar aparência', saveAppearance)}</div>
        </div>

        <div
          className="rounded-[16px] border border-[rgba(26,10,8,0.07)] p-4 shadow-sm lg:p-5"
          style={{
            backgroundColor: settingsForm.background_color,
            color: settingsForm.text_color,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: settingsForm.accent_color }}>
            Prévia visual
          </p>
          <h3 className="mt-2 text-xl font-bold">Pedido especial</h3>
          <p className="mt-2 text-sm opacity-80">
            Card de exemplo com botão, destaque e texto usando a paleta escolhida.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: settingsForm.primary_color }}
            >
              Botão de exemplo
            </button>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: settingsForm.accent_color, color: settingsForm.text_color }}
            >
              Badge
            </span>
          </div>
        </div>
      </section>
    )
  }

  function renderCategoriesSection() {
    return (
      <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1A0A08]">Categorias</h2>
            <p className="mt-1 text-sm text-[#999999]">
              Gerencie categorias editáveis que serão usadas pelo app em etapas futuras.
            </p>
          </div>
          <span className="self-start rounded-full bg-[#FAF6F0] px-3 py-1 text-xs font-semibold text-[#1A0A08]">
            {categories.length} cadastradas
          </span>
        </div>

        <div className="mt-5 overflow-x-auto pb-2">
          <div className="flex min-w-min gap-2">
            {categoryTypeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedCategoryType(option.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedCategoryType === option.id
                    ? 'bg-[#C0392B] text-white'
                    : 'border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] text-[#1A0A08] hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Nova categoria"
            className="min-h-11 flex-1 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
          />
          <button
            type="button"
            onClick={() => void addCategory()}
            disabled={!newCategoryName.trim() || isSaving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={17} aria-hidden="true" />
            <span>Adicionar categoria</span>
          </button>
        </div>

        <div className="mt-5 divide-y divide-[rgba(26,10,8,0.07)] rounded-lg border border-[rgba(26,10,8,0.07)]">
          {selectedCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#999999]">
              Nenhuma categoria neste tipo.
            </div>
          ) : (
            selectedCategories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-[#1A0A08]">{category.name}</p>
                  <p className="text-xs text-[#999999]">
                    {category.is_active === false ? 'Inativa' : 'Ativa'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleCategory(category)}
                    disabled={isSaving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0] disabled:opacity-60"
                  >
                    <CheckCircle size={16} aria-hidden="true" />
                    <span>{category.is_active === false ? 'Ativar' : 'Desativar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCategory(category)}
                    disabled={isSaving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    )
  }

  function renderPreferencesSection() {
    return (
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
          <h2 className="text-lg font-bold text-[#1A0A08]">Preferências de pedidos</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#1A0A08]">
                Status padrão de novo pedido
              </span>
              <select
                value={settingsForm.default_order_status}
                onChange={(event) => updateSettingsForm('default_order_status', event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                {orderStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {renderNumberInput('Percentual padrão de sinal', 'default_down_payment_percent', '%')}
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-lg border border-[rgba(26,10,8,0.07)] p-3">
            <input
              type="checkbox"
              checked={settingsForm.require_delivery_date}
              onChange={(event) => updateSettingsForm('require_delivery_date', event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 rounded border-[rgba(26,10,8,0.18)] accent-[#C0392B]"
            />
            <span>
              <span className="block font-semibold text-[#1A0A08]">
                Exigir data de entrega/festa para salvar pedido
              </span>
              <span className="mt-1 block text-sm text-[#999999]">Sim/não para uso futuro no fluxo de pedidos.</span>
            </span>
          </label>

          <div className="mt-4 rounded-lg bg-[#FAF6F0] p-3 text-sm text-[#6F625F]">
            Permitir total manual: já aparece no fluxo de pedido quando disponível. Sem novo campo de banco nesta etapa.
          </div>
        </div>

        <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
          <h2 className="text-lg font-bold text-[#1A0A08]">Produção, compras e remarketing</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderNumberInput('Dias de alerta antes da produção', 'production_alert_days', 'dias')}
            {renderNumberInput('Dias antes de acionar fornecedor', 'supplier_alert_days', 'dias')}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#1A0A08]">
                Modo padrão da lista de compras
              </span>
              <select
                value={settingsForm.purchase_list_default_mode}
                onChange={(event) => updateSettingsForm('purchase_list_default_mode', event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
              >
                {purchaseModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {renderNumberInput('Dias antes para aniversário de festa', 'remarketing_alert_days', 'dias')}
          </div>
          <p className="mt-4 text-sm text-[#999999]">
            Essa preferência será usada como padrão na Lista de Compras em uma etapa futura.
          </p>
        </div>

        <div className="xl:col-span-2">{renderSaveButton('Salvar preferências', savePreferences)}</div>
      </section>
    )
  }

  function renderBackupSection() {
    return (
      <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
        <h2 className="text-lg font-bold text-[#1A0A08]">Backup e exportação</h2>
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#F1D7A8] bg-[#FFF7E1] p-3 text-sm text-[#8A6B1F]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Guarde esse arquivo com segurança. Ele pode conter dados de clientes, pedidos e financeiro.</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {backupActions.map((action) => (
            <button
              key={action.slug}
              type="button"
              onClick={() => void exportBackup(action.slug, action.tables)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-sm font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            >
              <Download size={16} aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void exportBackup('tudo', allBackupTables)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1A0A08] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2A1A18]"
          >
            <Download size={16} aria-hidden="true" />
            <span>Exportar tudo</span>
          </button>
        </div>

        {backupStatus && (
          <p className="mt-4 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#1A0A08]">
            {backupStatus}
          </p>
        )}
      </section>
    )
  }

  function renderTeamSection() {
    return (
      <section>
        <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm lg:p-5">
          <h2 className="text-lg font-bold text-[#1A0A08]">Equipe e permissões</h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {teamRoles.map((role) => (
            <div
              key={role.title}
              className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-4 shadow-sm"
            >
              <p className="font-bold text-[#1A0A08]">{role.title}</p>
              <p className="mt-1 text-sm text-[#999999]">{role.description}</p>
            </div>
          ))}
        </div>

        {/* TODO: implementar configuração de equipe */}
      </section>
    )
  }

  function renderDangerSection() {
    return (
      <section className="rounded-[16px] border border-red-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert size={22} className="mt-0.5 shrink-0 text-[#C0392B]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-[#1A0A08]">Zona perigosa</h2>
            <p className="mt-1 text-sm text-[#C0392B]">
              Use com cuidado. Essas ações podem apagar dados importantes.
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-[#1A0A08]">
            Digite APAGAR para habilitar ações perigosas
          </span>
          <input
            type="text"
            value={dangerConfirmation}
            onChange={(event) => setDangerConfirmation(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!canUseDangerActions}
            onClick={showTestDataInstruction}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 font-semibold text-[#C0392B] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={17} aria-hidden="true" />
            <span>Limpar dados de teste</span>
          </button>
          <button
            type="button"
            disabled={!canUseDangerActions || isSaving}
            onClick={() => void resetSettings()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={17} aria-hidden="true" />
            <span>Resetar configurações</span>
          </button>
        </div>

        {dangerMessage && (
          <div className="mt-4 rounded-lg border border-[#F1D7A8] bg-[#FFF7E1] p-3 text-sm font-semibold text-[#8A6B1F]">
            {dangerMessage}
          </div>
        )}
      </section>
    )
  }

  function renderActiveSection() {
    if (selectedSection === 'loja') return renderStoreSection()
    if (selectedSection === 'aparencia') return renderAppearanceSection()
    if (selectedSection === 'categorias') return renderCategoriesSection()
    if (selectedSection === 'preferencias') return renderPreferencesSection()
    if (selectedSection === 'backup') return renderBackupSection()
    if (selectedSection === 'equipe') return renderTeamSection()

    return renderDangerSection()
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="border-b border-[rgba(26,10,8,0.07)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#C0392B] text-white">
              <Settings size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                ADMINISTRAÇÃO
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#1A0A08]">Configurações</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6F625F]">
                Personalize sua loja, categorias, preferências e backups do Doceria Pro.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {feedback && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#BFE8CC] bg-[#F4FBF6] p-3 text-sm text-[#1F7A3A]">
            <CheckCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-14 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#F1D7CF] border-b-[#C0392B]" />
            <p className="mt-3 text-sm text-[#999999]">Carregando configurações...</p>
          </div>
        ) : (
          <>
            <div className="mb-5 overflow-x-auto pb-2">
              <div className="flex min-w-min gap-2">
                {sections.map((section) => {
                  const Icon = section.icon

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedSection(section.id)}
                      className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        selectedSection === section.id
                          ? 'bg-[#C0392B] text-white'
                          : 'border border-[rgba(26,10,8,0.07)] bg-white text-[#1A0A08] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{section.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {renderActiveSection()}
          </>
        )}
      </main>
    </div>
  )
}
