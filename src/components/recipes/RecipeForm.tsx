'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Package,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createLocalId,
  formatCurrency,
  formatNumber,
  normalizeUnit,
  optionalDecimal,
  optionalText,
  parseDecimal,
  parseNumericValue,
  toInputValue,
} from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'

type ProductType = 'simple' | 'recipe' | 'kit' | 'outsourced'
type ThirdPartyChoice = 'nao' | 'sim'

type RecipeForm = {
  name: string
  category: string
  product_type: ProductType
  is_third_party: ThirdPartyChoice
  supplier_id: string
  supplier_cost: string
  supplier_cost_unit: string
  yield_amount: string
  yield_unit: string
  profit_margin: string
  sale_price: string
  instructions: string
  notes: string
}

type RecipeFormMode = 'create' | 'edit'

type RecipeFormProps = {
  mode?: RecipeFormMode
  recipeId?: string
}

type Ingredient = {
  id: string
  name: string
  usage_unit: string | null
  purchase_unit?: string | null
  unit?: string | null
  stock_unit?: string | null
  cost_per_unit: number | null
}

type RecipeIngredientItem = {
  localId: string
  ingredient_id: string
  quantity: string
  unit: string
}

type UnitDefinition = {
  kind: 'weight' | 'volume' | 'count'
  factor: number
}

type NumericValue = number | string | null | undefined

type RecipeRecord = {
  id: string
  user_id: string
  name: string | null
  category: string | null
  product_type: string | null
  is_third_party: boolean | null
  supplier_id: string | null
  supplier_cost: NumericValue
  supplier_cost_unit: string | null
  yield_amount: NumericValue
  yield_unit: string | null
  total_cost: NumericValue
  cost_per_unit: NumericValue
  profit_margin: NumericValue
  suggested_price: NumericValue
  sale_price: NumericValue
  instructions: string | null
  notes: string | null
}

type RecipeIngredientRecord = {
  ingredient_id: string | null
  quantity: NumericValue
  unit: string | null
}

type RecipePackagingRecord = {
  packaging_id: string | null
  usage_type: string | null
  quantity_per_recipe_unit: NumericValue
  notes: string | null
}

type ProductKitItemRecord = {
  item_recipe_id: string | null
  quantity: NumericValue
  notes: string | null
}

type KitCategoryComponentRecord = {
  category: string | null
  quantity: NumericValue
  notes: string | null
}

type KitFlexibleGroupRecord = {
  id: string
  name: string | null
  total_quantity: NumericValue
  notes: string | null
}

type KitFlexibleGroupCategoryRecord = {
  flexible_group_id: string
  category: string | null
  default_quantity: NumericValue
  sort_order: number | null
}

type RecipePackagingItem = {
  localId: string
  packaging_id: string
  usage_type: 'unitaria' | 'transporte'
  quantity_per_recipe_unit: string
  notes: string
}

type Packaging = {
  id: string
  name: string
  cost_per_unit: NumericValue
  capacity: NumericValue
  capacity_unit: string | null
}

type Supplier = {
  id: string
  name: string
}

type KitProduct = {
  id: string
  name: string
  total_cost: NumericValue
  supplier_cost: NumericValue
  supplier_cost_unit: string | null
  product_type: ProductType | null
  is_third_party: boolean | null
}

type RecipeKitItem = {
  localId: string
  item_recipe_id: string
  quantity: string
  notes: string
}

type KitCategoryComponentItem = {
  localId: string
  category: string
  quantity: string
  notes: string
}

type KitFlexibleGroupCategoryItem = {
  localId: string
  category: string
  default_quantity: string
}

type KitFlexibleGroupItem = {
  localId: string
  name: string
  total_quantity: string
  notes: string
  categories: KitFlexibleGroupCategoryItem[]
}

const categoryOptions = [
  'BOLOS',
  'TORTAS',
  'DOCINHOS',
  'SALGADOS',
  'BEBIDAS',
  'SOBREMESAS',
  'OUTROS',
]

const kitCategoryOptions = [
  'BOLOS',
  'DOCES TRADICIONAIS',
  'DOCES FINOS',
  'SALGADOS TRADICIONAIS',
  'SALGADOS FINOS',
  'OUTROS',
]

const supplierCostUnitOptions = ['unidade', 'cento', 'kg', 'pedido', 'outro']

const productTypeOptions: Array<{ label: string; value: ProductType }> = [
  { label: 'Produto simples', value: 'simple' },
  { label: 'Receita', value: 'recipe' },
  { label: 'Kit', value: 'kit' },
  { label: 'Terceirizado', value: 'outsourced' },
]

const unitDefinitions: Record<string, UnitDefinition> = {
  g: { kind: 'weight', factor: 1 },
  grama: { kind: 'weight', factor: 1 },
  gramas: { kind: 'weight', factor: 1 },
  kg: { kind: 'weight', factor: 1000 },
  kilogram: { kind: 'weight', factor: 1000 },
  kilogramas: { kind: 'weight', factor: 1000 },
  kilo: { kind: 'weight', factor: 1000 },
  quilo: { kind: 'weight', factor: 1000 },
  quilograma: { kind: 'weight', factor: 1000 },
  quilogramas: { kind: 'weight', factor: 1000 },
  kilos: { kind: 'weight', factor: 1000 },
  quilos: { kind: 'weight', factor: 1000 },
  ml: { kind: 'volume', factor: 1 },
  mililitro: { kind: 'volume', factor: 1 },
  mililitros: { kind: 'volume', factor: 1 },
  l: { kind: 'volume', factor: 1000 },
  litro: { kind: 'volume', factor: 1000 },
  litros: { kind: 'volume', factor: 1000 },
  un: { kind: 'count', factor: 1 },
  unidade: { kind: 'count', factor: 1 },
  unidades: { kind: 'count', factor: 1 },
  fatia: { kind: 'count', factor: 1 },
  fatias: { kind: 'count', factor: 1 },
  porcao: { kind: 'count', factor: 1 },
  porcoes: { kind: 'count', factor: 1 },
  porção: { kind: 'count', factor: 1 },
  porções: { kind: 'count', factor: 1 },
  pacote: { kind: 'count', factor: 1 },
  pacotes: { kind: 'count', factor: 1 },
  pct: { kind: 'count', factor: 1 },
}

const initialForm: RecipeForm = {
  name: '',
  category: 'BOLOS',
  product_type: 'simple',
  is_third_party: 'nao',
  supplier_id: '',
  supplier_cost: '',
  supplier_cost_unit: 'unidade',
  yield_amount: '',
  yield_unit: 'unidades',
  profit_margin: '30',
  sale_price: '',
  instructions: '',
  notes: '',
}
function normalizeProductType(value: string): ProductType {
  if (value === 'kit' || value === 'Kit') return 'kit'
  if (value === 'recipe' || value === 'Receita') return 'recipe'
  if (value === 'outsourced' || value === 'Terceirizado') return 'outsourced'

  return 'simple'
}

function normalizeUpper(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR')
}

function getDefaultRecipeUsageUnit(ingredient: Ingredient | null | undefined) {
  const unit =
    ingredient?.usage_unit?.trim() ||
    ingredient?.purchase_unit?.trim() ||
    ingredient?.unit?.trim() ||
    ingredient?.stock_unit?.trim()

  if (!unit) return 'unidade'

  const normalizedUnit = normalizeUnit(unit)

  if (
    ['kg', 'quilo', 'quilos', 'kilogram', 'kilogramas', 'quilograma', 'quilogramas'].includes(
      normalizedUnit
    )
  ) {
    return 'g'
  }

  if (['litro', 'litros', 'l'].includes(normalizedUnit)) return 'ml'
  if (['unidade', 'unidades', 'un'].includes(normalizedUnit)) return 'unidade'
  if (['pacote', 'pacotes'].includes(normalizedUnit)) return 'pacote'
  if (normalizedUnit === 'g') return 'g'
  if (normalizedUnit === 'ml') return 'ml'

  return unit
}
function getUnitDefinition(unit: string) {
  return unitDefinitions[normalizeUnit(unit)]
}
function calculateIngredientCost(item: RecipeIngredientItem, ingredient?: Ingredient) {
  if (!ingredient) return 0

  const quantity = parseDecimal(item.quantity)
  const costPerUnit = ingredient.cost_per_unit ?? 0
  const recipeUnit = item.unit.trim() || ingredient.usage_unit || ''
  const ingredientUnit = ingredient.usage_unit || recipeUnit

  if (quantity <= 0 || costPerUnit <= 0) return 0

  const recipeDefinition = getUnitDefinition(recipeUnit)
  const ingredientDefinition = getUnitDefinition(ingredientUnit)

  if (
    recipeDefinition &&
    ingredientDefinition &&
    recipeDefinition.kind === ingredientDefinition.kind
  ) {
    const quantityInIngredientUnit =
      (quantity * recipeDefinition.factor) / ingredientDefinition.factor

    return quantityInIngredientUnit * costPerUnit
  }

  return quantity * costPerUnit
}

function calculateSuggestedPrice(totalCost: number, profitMargin: number) {
  if (totalCost <= 0) return 0
  if (profitMargin >= 100) return 0

  return totalCost / (1 - profitMargin / 100)
}

function calculatePackagingItemCost(
  item: RecipePackagingItem,
  packaging: Packaging | undefined,
  recipeYield: number
) {
  if (!packaging || recipeYield <= 0) return 0

  const costPerUnit = parseNumericValue(packaging.cost_per_unit)
  if (costPerUnit <= 0) return 0

  if (item.usage_type === 'transporte') {
    const capacity = parseNumericValue(packaging.capacity)
    const safeCapacity = capacity > 0 ? capacity : 1

    return Math.ceil(recipeYield / safeCapacity) * costPerUnit
  }

  const quantityPerRecipeUnit = parseDecimal(item.quantity_per_recipe_unit)

  if (quantityPerRecipeUnit <= 0) return 0

  return quantityPerRecipeUnit * costPerUnit * recipeYield
}

function getKitProductBaseCost(product: KitProduct) {
  const supplierCost = parseNumericValue(product.supplier_cost)

  if (product.is_third_party && supplierCost > 0) {
    return supplierCost
  }

  return parseNumericValue(product.total_cost)
}

function calculateKitItemCost(item: RecipeKitItem, product: KitProduct | undefined) {
  if (!product) return 0

  const quantity = parseDecimal(item.quantity)
  const itemCost = getKitProductBaseCost(product)

  if (quantity <= 0 || itemCost <= 0) return 0

  return quantity * itemCost
}

export default function RecipeForm({ mode = 'create', recipeId }: RecipeFormProps) {
  const isEditMode = mode === 'edit'
  const [form, setForm] = useState<RecipeForm>(initialForm)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientItem[]>([])
  const [availablePackaging, setAvailablePackaging] = useState<Packaging[]>([])
  const [recipePackaging, setRecipePackaging] = useState<RecipePackagingItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [availableKitProducts, setAvailableKitProducts] = useState<KitProduct[]>([])
  const [recipeKitItems, setRecipeKitItems] = useState<RecipeKitItem[]>([])
  const [kitCategoryComponents, setKitCategoryComponents] = useState<KitCategoryComponentItem[]>(
    []
  )
  const [kitFlexibleGroups, setKitFlexibleGroups] = useState<KitFlexibleGroupItem[]>([])
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [isQuickIngredientModalOpen, setIsQuickIngredientModalOpen] = useState(false)
  const [quickIngredientTargetLocalId, setQuickIngredientTargetLocalId] = useState<string | null>(null)
  const [quickIngredientLoading, setQuickIngredientLoading] = useState(false)
  const [quickIngredientError, setQuickIngredientError] = useState('')
  const [quickIngredientForm, setQuickIngredientForm] = useState({
    name: '',
    category: '',
    purchase_unit: 'kg',
    purchase_quantity: '',
    purchase_price: '',
    usage_unit: 'g',
    stock_quantity: '',
    supplier_id: ''
  })

  async function handleQuickSaveIngredient() {
    setQuickIngredientError('')
    
    const { name, purchase_unit, purchase_quantity, purchase_price, usage_unit } = quickIngredientForm
    
    if (!name.trim()) return setQuickIngredientError('Nome é obrigatório.')
    if (!purchase_unit.trim()) return setQuickIngredientError('Unidade de compra é obrigatória.')
    if (!usage_unit.trim()) return setQuickIngredientError('Unidade de uso é obrigatória.')
    
    const pq = parseDecimal(purchase_quantity)
    const pp = parseDecimal(purchase_price)
    
    if (pq <= 0) return setQuickIngredientError('Quantidade de compra deve ser maior que 0.')
    if (pp < 0) return setQuickIngredientError('Preço não pode ser negativo.')
    if (purchase_price === '') return setQuickIngredientError('Preço é obrigatório.')
    
    setQuickIngredientLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const cost_per_unit = pp / pq
      
      const payload = {
        user_id: user.id,
        name: normalizeUpper(name),
        category: quickIngredientForm.category.trim()
          ? normalizeUpper(quickIngredientForm.category)
          : null,
        purchase_unit: purchase_unit.trim(),
        purchase_quantity: pq,
        purchase_price: pp,
        usage_unit: usage_unit.trim(),
        cost_per_unit,
        package_quantity: pq,
        package_cost: pp,
        stock_quantity: parseDecimal(quickIngredientForm.stock_quantity) || 0,
        stock_unit: usage_unit.trim(),
        supplier_id: quickIngredientForm.supplier_id || null
      }
      
      const { data, error } = await supabase
        .from('ingredients')
        .insert([payload])
        .select('id, name, usage_unit, purchase_unit, stock_unit, cost_per_unit')
        .single()
      
      if (error) {
        console.error('Erro ao criar ingrediente rápido:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          fullError: error,
          stringified: JSON.stringify(error, null, 2)
        })
        throw new Error('Falha ao salvar ingrediente no banco de dados.')
      }
      
      if (data) {
        setIngredients(prev => [...prev, data as Ingredient].sort((a, b) => a.name.localeCompare(b.name)))
        
        if (quickIngredientTargetLocalId) {
          updateRecipeIngredient(quickIngredientTargetLocalId, 'ingredient_id', data.id)
          updateRecipeIngredient(
            quickIngredientTargetLocalId,
            'unit',
            getDefaultRecipeUsageUnit(data as Ingredient)
          )
        }
      }
      
      setIsQuickIngredientModalOpen(false)
      setQuickIngredientForm({
        name: '',
        category: '',
        purchase_unit: 'kg',
        purchase_quantity: '',
        purchase_price: '',
        usage_unit: 'g',
        stock_quantity: '',
        supplier_id: ''
      })
      alert('Ingrediente salvo com sucesso!')
      
    } catch (err) {
       setQuickIngredientError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
       setQuickIngredientLoading(false)
    }
  }

  function handleCancel() {
    router.push('/receitas')
  }

  useEffect(() => {
    let isMounted = true

    async function loadFormData() {
      setIsLoadingIngredients(true)
      setError('')

      try {
        if (isEditMode && !recipeId) {
          throw new Error('Receita/produto não encontrada')
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuário não autenticado')
        }

        const { data, error: ingredientsError } = await supabase
          .from('ingredients')
          .select('id, name, usage_unit, purchase_unit, stock_unit, cost_per_unit')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (ingredientsError) {
          logSupabaseError('Erro Supabase ingredients:', ingredientsError)
          throw ingredientsError
        }

        const { data: packagingData, error: packagingError } = await supabase
          .from('packaging')
          .select('id, name, cost_per_unit, capacity, capacity_unit')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (packagingError) {
          logSupabaseError('Erro Supabase packaging:', packagingError)
          throw packagingError
        }

        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (suppliersError) {
          logSupabaseError('Erro Supabase suppliers:', suppliersError)
          throw suppliersError
        }

        const { data: kitProductsData, error: kitProductsError } = await supabase
          .from('recipes')
          .select('id, name, total_cost, supplier_cost, supplier_cost_unit, product_type, is_third_party')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (kitProductsError) {
          logSupabaseError('Erro Supabase recipes para kit:', kitProductsError)
          throw kitProductsError
        }

        let loadedRecipe: RecipeRecord | null = null
        let loadedRecipeIngredients: RecipeIngredientRecord[] = []
        let loadedRecipePackaging: RecipePackagingRecord[] = []
        let loadedKitItems: ProductKitItemRecord[] = []
        let loadedKitCategoryComponents: KitCategoryComponentRecord[] = []
        let loadedKitFlexibleGroups: KitFlexibleGroupItem[] = []

        if (isEditMode && recipeId) {
          const { data: recipeData, error: recipeError } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .eq('user_id', user.id)
            .maybeSingle()

          if (recipeError) {
            logSupabaseError('Erro Supabase recipes select:', recipeError)
            throw recipeError
          }

          if (!recipeData) {
            throw new Error('Receita/produto não encontrada')
          }

          loadedRecipe = recipeData as RecipeRecord

          const { data: recipeIngredientsData, error: recipeIngredientsError } = await supabase
            .from('recipe_ingredients')
            .select('ingredient_id, quantity, unit')
            .eq('recipe_id', recipeId)

          if (recipeIngredientsError) {
            logSupabaseError('Erro Supabase recipe_ingredients select:', recipeIngredientsError)
            throw recipeIngredientsError
          }

          loadedRecipeIngredients = (recipeIngredientsData ?? []) as RecipeIngredientRecord[]

          const { data: recipePackagingData, error: recipePackagingError } = await supabase
            .from('recipe_packaging')
            .select('packaging_id, usage_type, quantity_per_recipe_unit, notes')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .order('created_at', { ascending: true })

          if (recipePackagingError) {
            logSupabaseError('Erro Supabase recipe_packaging select:', recipePackagingError)
            throw recipePackagingError
          }

          loadedRecipePackaging = (recipePackagingData ?? []) as RecipePackagingRecord[]

          const { data: kitItemsData, error: kitItemsError } = await supabase
            .from('product_kit_items')
            .select('item_recipe_id, quantity, notes')
            .eq('user_id', user.id)
            .eq('kit_recipe_id', recipeId)
            .order('created_at', { ascending: true })

          if (kitItemsError) {
            logSupabaseError('Erro Supabase product_kit_items select:', kitItemsError)
            throw kitItemsError
          }

          loadedKitItems = (kitItemsData ?? []) as ProductKitItemRecord[]

          const { data: kitCategoryData, error: kitCategoryError } = await supabase
            .from('kit_category_components')
            .select('category, quantity, notes')
            .eq('user_id', user.id)
            .eq('kit_recipe_id', recipeId)
            .order('created_at', { ascending: true })

          if (kitCategoryError) {
            logSupabaseError('Erro Supabase kit_category_components select:', kitCategoryError)
            throw kitCategoryError
          }

          loadedKitCategoryComponents = (kitCategoryData ?? []) as KitCategoryComponentRecord[]

          const { data: flexibleGroupsData, error: flexibleGroupsError } = await supabase
            .from('kit_flexible_groups')
            .select('id, name, total_quantity, notes')
            .eq('user_id', user.id)
            .eq('kit_recipe_id', recipeId)
            .order('created_at', { ascending: true })

          if (flexibleGroupsError) {
            logSupabaseError('Erro Supabase kit_flexible_groups select:', flexibleGroupsError)
            throw flexibleGroupsError
          }

          const flexibleGroups = (flexibleGroupsData ?? []) as KitFlexibleGroupRecord[]
          const flexibleGroupIds = flexibleGroups.map((group) => group.id)
          const categoriesByGroupId = new Map<string, KitFlexibleGroupCategoryRecord[]>()

          if (flexibleGroupIds.length > 0) {
            const { data: flexibleGroupCategoriesData, error: flexibleGroupCategoriesError } =
              await supabase
                .from('kit_flexible_group_categories')
                .select('flexible_group_id, category, default_quantity, sort_order')
                .eq('user_id', user.id)
                .in('flexible_group_id', flexibleGroupIds)
                .order('sort_order', { ascending: true })

            if (flexibleGroupCategoriesError) {
              logSupabaseError(
                'Erro Supabase kit_flexible_group_categories select:',
                flexibleGroupCategoriesError
              )
              throw flexibleGroupCategoriesError
            }

            const flexibleGroupCategories =
              (flexibleGroupCategoriesData ?? []) as KitFlexibleGroupCategoryRecord[]

            flexibleGroupCategories.forEach((categoryItem) => {
              const currentItems = categoriesByGroupId.get(categoryItem.flexible_group_id) ?? []

              categoriesByGroupId.set(categoryItem.flexible_group_id, [
                ...currentItems,
                categoryItem,
              ])
            })
          }

          loadedKitFlexibleGroups = flexibleGroups.map((group) => ({
            localId: group.id,
            name: group.name ? normalizeUpper(group.name) : '',
            total_quantity: toInputValue(group.total_quantity),
            notes: group.notes ?? '',
            categories: (categoriesByGroupId.get(group.id) ?? []).map((categoryItem) => ({
              localId: createLocalId(),
              category: categoryItem.category
                ? normalizeUpper(categoryItem.category)
                : kitCategoryOptions[0],
              default_quantity: toInputValue(categoryItem.default_quantity),
            })),
          }))
        }

        if (isMounted) {
          const availableProducts = ((kitProductsData ?? []) as KitProduct[]).filter(
            (product) => product.id !== recipeId
          )

          setIngredients((data ?? []) as Ingredient[])
          setAvailablePackaging((packagingData ?? []) as Packaging[])
          setSuppliers((suppliersData ?? []) as Supplier[])
          setAvailableKitProducts(availableProducts)

          if (loadedRecipe) {
            const productType = normalizeProductType(loadedRecipe.product_type ?? '')
            const isThirdPartyRecipe =
              productType === 'outsourced' || loadedRecipe.is_third_party === true

            setForm({
              name: loadedRecipe.name ?? '',
              category: loadedRecipe.category
                ? normalizeUpper(loadedRecipe.category)
                : categoryOptions[0],
              product_type: isThirdPartyRecipe ? 'outsourced' : productType,
              is_third_party: isThirdPartyRecipe ? 'sim' : 'nao',
              supplier_id: loadedRecipe.supplier_id ?? '',
              supplier_cost: toInputValue(loadedRecipe.supplier_cost),
              supplier_cost_unit: loadedRecipe.supplier_cost_unit || 'unidade',
              yield_amount: toInputValue(loadedRecipe.yield_amount),
              yield_unit: loadedRecipe.yield_unit || 'unidades',
              profit_margin: toInputValue(loadedRecipe.profit_margin) || '30',
              sale_price: toInputValue(loadedRecipe.sale_price),
              instructions: loadedRecipe.instructions ?? '',
              notes: loadedRecipe.notes ?? '',
            })

            setRecipeIngredients(
              loadedRecipeIngredients
                .filter((item) => Boolean(item.ingredient_id))
                .map((item) => ({
                  localId: createLocalId(),
                  ingredient_id: item.ingredient_id as string,
                  quantity: toInputValue(item.quantity),
                  unit: item.unit || 'unidade',
                }))
            )
            setRecipePackaging(
              loadedRecipePackaging
                .filter((item) => Boolean(item.packaging_id))
                .map((item) => ({
                  localId: createLocalId(),
                  packaging_id: item.packaging_id as string,
                  usage_type: item.usage_type === 'transporte' ? 'transporte' : 'unitaria',
                  quantity_per_recipe_unit: toInputValue(item.quantity_per_recipe_unit) || '1',
                  notes: item.notes ?? '',
                }))
            )
            setRecipeKitItems(
              loadedKitItems
                .filter((item) => Boolean(item.item_recipe_id))
                .map((item) => ({
                  localId: createLocalId(),
                  item_recipe_id: item.item_recipe_id as string,
                  quantity: toInputValue(item.quantity),
                  notes: item.notes ?? '',
                }))
            )
            setKitCategoryComponents(
              loadedKitCategoryComponents.map((item) => ({
                localId: createLocalId(),
                category: item.category ? normalizeUpper(item.category) : kitCategoryOptions[0],
                quantity: toInputValue(item.quantity),
                notes: item.notes ?? '',
              }))
            )
            setKitFlexibleGroups(loadedKitFlexibleGroups)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados da receita:', err)
        if (isMounted) {
          setError('Falha ao carregar dados da receita')
        }
      } finally {
        if (isMounted) {
          setIsLoadingIngredients(false)
        }
      }
    }

    loadFormData()

    return () => {
      isMounted = false
    }
  }, [isEditMode, recipeId, supabase])

  const ingredientById = useMemo(() => {
    return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  }, [ingredients])

  const packagingById = useMemo(() => {
    return new Map(availablePackaging.map((packaging) => [packaging.id, packaging]))
  }, [availablePackaging])

  const kitProductById = useMemo(() => {
    return new Map(availableKitProducts.map((product) => [product.id, product]))
  }, [availableKitProducts])

  const isKit = form.product_type === 'kit'
  const isOutsourcedProduct = form.product_type === 'outsourced'
  const isSimpleProduct = form.product_type === 'simple'
  const isThirdParty = form.is_third_party === 'sim'
  const isSimpleThirdParty = isOutsourcedProduct || (isSimpleProduct && isThirdParty)
  const isSimpleInternal = !isKit && !isSimpleThirdParty
  const yieldAmount = useMemo(() => parseDecimal(form.yield_amount), [form.yield_amount])
  const profitMargin = useMemo(() => parseDecimal(form.profit_margin), [form.profit_margin])
  const salePrice = useMemo(() => optionalDecimal(form.sale_price), [form.sale_price])
  const supplierCost = useMemo(() => optionalDecimal(form.supplier_cost), [form.supplier_cost])
  const supplierCostAmount = supplierCost ?? 0

  const ingredientCosts = useMemo(() => {
    return new Map(
      recipeIngredients.map((item) => [
        item.localId,
        calculateIngredientCost(item, ingredientById.get(item.ingredient_id)),
      ])
    )
  }, [ingredientById, recipeIngredients])

  const ingredientTotalCost = useMemo(() => {
    return Array.from(ingredientCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [ingredientCosts])

  const packagingCosts = useMemo(() => {
    return new Map(
      recipePackaging.map((item) => [
        item.localId,
        calculatePackagingItemCost(item, packagingById.get(item.packaging_id), yieldAmount),
      ])
    )
  }, [packagingById, recipePackaging, yieldAmount])

  const packagingTotalCost = useMemo(() => {
    return Array.from(packagingCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [packagingCosts])

  const kitItemCosts = useMemo(() => {
    return new Map(
      recipeKitItems.map((item) => [
        item.localId,
        calculateKitItemCost(item, kitProductById.get(item.item_recipe_id)),
      ])
    )
  }, [kitProductById, recipeKitItems])

  const kitTotalCost = useMemo(() => {
    return Array.from(kitItemCosts.values()).reduce((sum, cost) => sum + cost, 0)
  }, [kitItemCosts])

  const simpleTotalCost = isSimpleThirdParty
    ? supplierCostAmount
    : ingredientTotalCost + packagingTotalCost
  const totalCost = isKit ? kitTotalCost : simpleTotalCost
  const costPerUnit = isSimpleThirdParty
    ? supplierCostAmount
    : yieldAmount > 0
      ? totalCost / yieldAmount
      : 0
  const suggestedPrice = calculateSuggestedPrice(totalCost, profitMargin)

  function handleFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as keyof RecipeForm
    const value = event.target.value

    if (field === 'product_type') {
      const productType: ProductType = normalizeProductType(value)
      const allowsThirdParty = productType === 'simple' || productType === 'outsourced'

      setForm((currentForm) => ({
        ...currentForm,
        product_type: productType,
        is_third_party:
          productType === 'outsourced'
            ? 'sim'
            : allowsThirdParty
              ? currentForm.is_third_party
              : 'nao',
        supplier_id: allowsThirdParty ? currentForm.supplier_id : '',
        supplier_cost: allowsThirdParty ? currentForm.supplier_cost : '',
        supplier_cost_unit: allowsThirdParty
          ? currentForm.supplier_cost_unit || 'unidade'
          : 'unidade',
        yield_amount:
          productType === 'kit' && !currentForm.yield_amount ? '1' : currentForm.yield_amount,
        yield_unit: productType === 'kit' && !currentForm.yield_unit ? 'kit' : currentForm.yield_unit,
      }))

      return
    }

    if (field === 'is_third_party') {
      setForm((currentForm) => {
        const thirdPartyChoice: ThirdPartyChoice =
          currentForm.product_type === 'simple' && value === 'sim' ? 'sim' : 'nao'

        return {
          ...currentForm,
          is_third_party: thirdPartyChoice,
          supplier_id: thirdPartyChoice === 'sim' ? currentForm.supplier_id : '',
          supplier_cost: thirdPartyChoice === 'sim' ? currentForm.supplier_cost : '',
          supplier_cost_unit:
            thirdPartyChoice === 'sim' ? currentForm.supplier_cost_unit || 'unidade' : 'unidade',
        }
      })

      return
    }

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function addRecipeIngredient() {
    const firstIngredient = ingredients[0]

    if (!firstIngredient) {
      setError('Cadastre ingredientes antes de montar uma receita')
      return
    }

    setRecipeIngredients((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        ingredient_id: firstIngredient.id,
        quantity: '1',
        unit: getDefaultRecipeUsageUnit(firstIngredient),
      },
    ])
  }

  function updateRecipeIngredient(
    localId: string,
    field: 'ingredient_id' | 'quantity' | 'unit',
    value: string
  ) {
    setRecipeIngredients((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        if (field === 'ingredient_id') {
          const ingredient = ingredientById.get(value)

          return {
            ...item,
            ingredient_id: value,
            unit: getDefaultRecipeUsageUnit(ingredient) || item.unit,
          }
        }

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeRecipeIngredient(localId: string) {
    setRecipeIngredients((currentItems) =>
      currentItems.filter((item) => item.localId !== localId)
    )
  }

  function addRecipePackaging() {
    const firstPackaging = availablePackaging[0]

    if (!firstPackaging) {
      setError('Cadastre embalagens antes de vincular ao produto')
      return
    }

    setRecipePackaging((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        packaging_id: firstPackaging.id,
        usage_type: 'unitaria',
        quantity_per_recipe_unit: '1',
        notes: '',
      },
    ])
  }

  function updateRecipePackaging(
    localId: string,
    field: 'packaging_id' | 'usage_type' | 'quantity_per_recipe_unit' | 'notes',
    value: string
  ) {
    setRecipePackaging((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        if (field === 'usage_type') {
          const usageType = value === 'transporte' ? 'transporte' : 'unitaria'

          return {
            ...item,
            usage_type: usageType,
            quantity_per_recipe_unit:
              usageType === 'unitaria' && !item.quantity_per_recipe_unit
                ? '1'
                : item.quantity_per_recipe_unit,
          }
        }

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeRecipePackaging(localId: string) {
    setRecipePackaging((currentItems) =>
      currentItems.filter((item) => item.localId !== localId)
    )
  }

  function addKitItem() {
    const firstProduct = availableKitProducts[0]

    if (!firstProduct) {
      setError('Cadastre produtos antes de montar um kit')
      return
    }

    setRecipeKitItems((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        item_recipe_id: firstProduct.id,
        quantity: '1',
        notes: '',
      },
    ])
  }

  function updateKitItem(
    localId: string,
    field: 'item_recipe_id' | 'quantity' | 'notes',
    value: string
  ) {
    setRecipeKitItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeKitItem(localId: string) {
    setRecipeKitItems((currentItems) => currentItems.filter((item) => item.localId !== localId))
  }

  function addKitCategoryComponent() {
    setKitCategoryComponents((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        category: kitCategoryOptions[0],
        quantity: '1',
        notes: '',
      },
    ])
  }

  function updateKitCategoryComponent(
    localId: string,
    field: 'category' | 'quantity' | 'notes',
    value: string
  ) {
    setKitCategoryComponents((currentItems) =>
      currentItems.map((item) =>
        item.localId === localId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    )
  }

  function removeKitCategoryComponent(localId: string) {
    setKitCategoryComponents((currentItems) =>
      currentItems.filter((item) => item.localId !== localId)
    )
  }

  function buildDefaultFlexibleGroupCategories(): KitFlexibleGroupCategoryItem[] {
    return [
      {
        localId: createLocalId(),
        category: 'DOCES TRADICIONAIS',
        default_quantity: '50',
      },
      {
        localId: createLocalId(),
        category: 'SALGADOS TRADICIONAIS',
        default_quantity: '50',
      },
    ]
  }

  function addKitFlexibleGroup() {
    setKitFlexibleGroups((currentGroups) => [
      ...currentGroups,
      {
        localId: createLocalId(),
        name: 'DOCES E SALGADOS',
        total_quantity: '100',
        notes: '',
        categories: buildDefaultFlexibleGroupCategories(),
      },
    ])
  }

  function updateKitFlexibleGroup(
    localId: string,
    field: 'name' | 'total_quantity' | 'notes',
    value: string
  ) {
    setKitFlexibleGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.localId === localId
          ? {
              ...group,
              [field]: value,
            }
          : group
      )
    )
  }

  function removeKitFlexibleGroup(localId: string) {
    setKitFlexibleGroups((currentGroups) =>
      currentGroups.filter((group) => group.localId !== localId)
    )
  }

  function addKitFlexibleGroupCategory(groupLocalId: string) {
    setKitFlexibleGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.localId === groupLocalId
          ? {
              ...group,
              categories: [
                ...group.categories,
                {
                  localId: createLocalId(),
                  category: kitCategoryOptions[0],
                  default_quantity: '0',
                },
              ],
            }
          : group
      )
    )
  }

  function updateKitFlexibleGroupCategory(
    groupLocalId: string,
    categoryLocalId: string,
    field: 'category' | 'default_quantity',
    value: string
  ) {
    setKitFlexibleGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.localId === groupLocalId
          ? {
              ...group,
              categories: group.categories.map((categoryItem) =>
                categoryItem.localId === categoryLocalId
                  ? {
                      ...categoryItem,
                      [field]: value,
                    }
                  : categoryItem
              ),
            }
          : group
      )
    )
  }

  function removeKitFlexibleGroupCategory(groupLocalId: string, categoryLocalId: string) {
    setKitFlexibleGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.localId === groupLocalId
          ? {
              ...group,
              categories: group.categories.filter(
                (categoryItem) => categoryItem.localId !== categoryLocalId
              ),
            }
          : group
      )
    )
  }

  function calculateFlexibleGroupDefaultTotal(group: KitFlexibleGroupItem) {
    return group.categories.reduce(
      (sum, categoryItem) => sum + parseDecimal(categoryItem.default_quantity),
      0
    )
  }

  function validateForm() {
    if (!form.name.trim()) return 'Nome da receita é obrigatório'
    if (!form.product_type) return 'Tipo de produto é obrigatório'
    if (yieldAmount <= 0) return 'Rendimento deve ser maior que zero'
    if (!form.yield_unit.trim()) return 'Unidade de rendimento é obrigatória'
    if (profitMargin < 0 || profitMargin >= 100) {
      return 'Margem de lucro deve ficar entre 0% e 99,99%'
    }
    if (form.sale_price.trim() && (salePrice === null || salePrice < 0)) {
      return 'Preço que eu cobro deve ser um valor válido'
    }
    if (isKit) {
      if (
        recipeKitItems.length === 0 &&
        kitCategoryComponents.length === 0 &&
        kitFlexibleGroups.length === 0
      ) {
        return 'Adicione pelo menos um produto fixo, uma categoria ou um grupo flexivel ao kit'
      }

      const invalidKitItem = recipeKitItems.some(
        (item) => !item.item_recipe_id || parseDecimal(item.quantity) <= 0
      )

      if (invalidKitItem) {
        return 'Confira produto e quantidade de todos os itens do kit'
      }

      const invalidCategoryComponent = kitCategoryComponents.some(
        (item) => !item.category.trim() || parseDecimal(item.quantity) <= 0
      )

      if (invalidCategoryComponent) {
        return 'Confira categoria e quantidade de todos os componentes por categoria'
      }

      const invalidFlexibleGroup = kitFlexibleGroups.some((group) => {
        const totalQuantity = parseDecimal(group.total_quantity)
        const defaultTotal = calculateFlexibleGroupDefaultTotal(group)

        return (
          !group.name.trim() ||
          totalQuantity <= 0 ||
          group.categories.length < 2 ||
          Math.abs(defaultTotal - totalQuantity) > 0.001 ||
          group.categories.some(
            (categoryItem) =>
              !categoryItem.category.trim() || parseDecimal(categoryItem.default_quantity) < 0
          )
        )
      })

      if (invalidFlexibleGroup) {
        return 'Confira nome, total, categorias e distribuicao padrao dos grupos flexiveis'
      }

      return ''
    }

    if (isSimpleThirdParty) {
      if (!form.supplier_id) return 'Selecione o fornecedor do produto terceirizado'
      if (!suppliers.some((supplier) => supplier.id === form.supplier_id)) {
        return 'Selecione um fornecedor valido'
      }
      if (supplierCost === null || supplierCost <= 0) {
        return 'Informe o custo pago ao fornecedor'
      }
      if (!form.supplier_cost_unit.trim()) return 'Selecione a unidade do custo do fornecedor'

      return ''
    }

    if (recipeIngredients.length === 0) return 'Adicione pelo menos um ingrediente'

    const invalidIngredient = recipeIngredients.some(
      (item) => !item.ingredient_id || parseDecimal(item.quantity) <= 0 || !item.unit.trim()
    )

    if (invalidIngredient) {
      return 'Confira ingrediente, quantidade e unidade de todos os itens'
    }

    const invalidPackaging = recipePackaging.some((item) => {
      if (!item.packaging_id) return true

      return item.usage_type === 'unitaria' && parseDecimal(item.quantity_per_recipe_unit) <= 0
    })

    if (invalidPackaging) {
      return 'Confira embalagem, tipo de uso e quantidade dos itens unitários'
    }

    return ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const productType: ProductType = isSimpleThirdParty ? 'outsourced' : form.product_type
      const recipePayload = {
        user_id: user.id,
        name: normalizeUpper(form.name),
        category: normalizeUpper(form.category),
        product_type: productType,
        is_third_party: isSimpleThirdParty,
        supplier_id: isSimpleThirdParty ? optionalText(form.supplier_id) : null,
        supplier_cost: isSimpleThirdParty ? supplierCost : null,
        supplier_cost_unit: isSimpleThirdParty ? optionalText(form.supplier_cost_unit) : null,
        yield_amount: yieldAmount,
        yield_unit: form.yield_unit.trim(),
        total_cost: totalCost,
        cost_per_unit: costPerUnit,
        profit_margin: profitMargin,
        suggested_price: suggestedPrice,
        sale_price: salePrice,
        instructions: optionalText(form.instructions),
        notes: optionalText(form.notes),
      }

      let savedRecipeId = recipeId

      if (isEditMode) {
        if (!recipeId) {
          throw new Error('Receita/produto não encontrada')
        }

        const { data: updatedRecipe, error: recipeError } = await supabase
          .from('recipes')
          .update(recipePayload)
          .eq('id', recipeId)
          .eq('user_id', user.id)
          .select('id')
          .maybeSingle()

        if (recipeError) {
          console.error('Erro Supabase recipes:', JSON.stringify(recipeError, null, 2))
          throw recipeError
        }

        if (!updatedRecipe?.id) {
          throw new Error('Receita/produto não encontrada ou sem permissão para editar')
        }

        savedRecipeId = updatedRecipe.id

        const { error: deleteRecipeIngredientsError } = await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('recipe_id', savedRecipeId)

        if (deleteRecipeIngredientsError) {
          logSupabaseError(
            'Erro Supabase recipe_ingredients delete:',
            deleteRecipeIngredientsError
          )
          throw deleteRecipeIngredientsError
        }

        const { error: deleteRecipePackagingError } = await supabase
          .from('recipe_packaging')
          .delete()
          .eq('user_id', user.id)
          .eq('recipe_id', savedRecipeId)

        if (deleteRecipePackagingError) {
          logSupabaseError('Erro Supabase recipe_packaging delete:', deleteRecipePackagingError)
          throw deleteRecipePackagingError
        }

        const { error: deleteKitItemsError } = await supabase
          .from('product_kit_items')
          .delete()
          .eq('user_id', user.id)
          .eq('kit_recipe_id', savedRecipeId)

        if (deleteKitItemsError) {
          logSupabaseError('Erro Supabase product_kit_items delete:', deleteKitItemsError)
          throw deleteKitItemsError
        }

        const { error: deleteKitCategoriesError } = await supabase
          .from('kit_category_components')
          .delete()
          .eq('user_id', user.id)
          .eq('kit_recipe_id', savedRecipeId)

        if (deleteKitCategoriesError) {
          logSupabaseError(
            'Erro Supabase kit_category_components delete:',
            deleteKitCategoriesError
          )
          throw deleteKitCategoriesError
        }

        const { error: deleteFlexibleGroupsError } = await supabase
          .from('kit_flexible_groups')
          .delete()
          .eq('user_id', user.id)
          .eq('kit_recipe_id', savedRecipeId)

        if (deleteFlexibleGroupsError) {
          logSupabaseError('Erro Supabase kit_flexible_groups delete:', deleteFlexibleGroupsError)
          throw deleteFlexibleGroupsError
        }
      } else {
        const { data: createdRecipe, error: recipeError } = await supabase
          .from('recipes')
          .insert([recipePayload])
          .select('id')
          .single()

        if (recipeError) {
          console.error('Erro Supabase recipes:', JSON.stringify(recipeError, null, 2))
          throw recipeError
        }

        if (!createdRecipe?.id) {
          throw new Error('Receita criada sem id retornado pelo Supabase')
        }

        savedRecipeId = createdRecipe.id
      }

      if (!savedRecipeId) {
        throw new Error('Receita salva sem id retornado pelo Supabase')
      }

      if (isKit) {
        if (recipeKitItems.length > 0) {
          const kitItemsPayload = recipeKitItems.map((item) => ({
            user_id: user.id,
            kit_recipe_id: savedRecipeId,
            item_recipe_id: item.item_recipe_id,
            quantity: parseDecimal(item.quantity),
            notes: optionalText(item.notes),
          }))

          const { error: kitItemsError } = await supabase
            .from('product_kit_items')
            .insert(kitItemsPayload)

          if (kitItemsError) {
            logSupabaseError('Erro Supabase product_kit_items:', kitItemsError)
            throw kitItemsError
          }
        }

        if (kitCategoryComponents.length > 0) {
          const categoryComponentsPayload = kitCategoryComponents.map((item) => ({
            user_id: user.id,
            kit_recipe_id: savedRecipeId,
            category: normalizeUpper(item.category),
            quantity: parseDecimal(item.quantity),
            notes: optionalText(item.notes),
          }))

          const { error: categoryComponentsError } = await supabase
            .from('kit_category_components')
            .insert(categoryComponentsPayload)

          if (categoryComponentsError) {
            logSupabaseError('Erro Supabase kit_category_components:', categoryComponentsError)
            throw categoryComponentsError
          }
        }

        for (const group of kitFlexibleGroups) {
          const { data: createdGroup, error: flexibleGroupError } = await supabase
            .from('kit_flexible_groups')
            .insert([
              {
                user_id: user.id,
                kit_recipe_id: savedRecipeId,
                name: normalizeUpper(group.name),
                total_quantity: parseDecimal(group.total_quantity),
                notes: optionalText(group.notes),
              },
            ])
            .select('id')
            .single()

          if (flexibleGroupError) {
            logSupabaseError('Erro Supabase kit_flexible_groups:', flexibleGroupError)
            throw flexibleGroupError
          }

          if (!createdGroup?.id) {
            throw new Error('Grupo flexivel criado sem id retornado pelo Supabase')
          }

          const groupCategoriesPayload = group.categories.map((categoryItem, index) => ({
            user_id: user.id,
            flexible_group_id: createdGroup.id,
            category: normalizeUpper(categoryItem.category),
            default_quantity: parseDecimal(categoryItem.default_quantity),
            sort_order: index,
          }))

          const { error: groupCategoriesError } = await supabase
            .from('kit_flexible_group_categories')
            .insert(groupCategoriesPayload)

          if (groupCategoriesError) {
            logSupabaseError(
              'Erro Supabase kit_flexible_group_categories:',
              groupCategoriesError
            )
            throw groupCategoriesError
          }
        }
      } else if (isSimpleInternal) {
        const recipeIngredientsPayload = recipeIngredients.map((item) => ({
          recipe_id: savedRecipeId,
          ingredient_id: item.ingredient_id,
          quantity: parseDecimal(item.quantity),
          unit: item.unit.trim(),
        }))

        const { error: recipeIngredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(recipeIngredientsPayload)

        if (recipeIngredientsError) {
          console.error(
            'Erro Supabase recipe_ingredients:',
            JSON.stringify(recipeIngredientsError, null, 2)
          )
          throw recipeIngredientsError
        }

        if (recipePackaging.length > 0) {
          const recipePackagingPayload = recipePackaging.map((item) => ({
            user_id: user.id,
            recipe_id: savedRecipeId,
            packaging_id: item.packaging_id,
            usage_type: item.usage_type,
            quantity_per_recipe_unit:
              item.usage_type === 'unitaria'
                ? parseDecimal(item.quantity_per_recipe_unit)
                : null,
            notes: optionalText(item.notes),
          }))

          const { error: recipePackagingError } = await supabase
            .from('recipe_packaging')
            .insert(recipePackagingPayload)

          if (recipePackagingError) {
            logSupabaseError('Erro Supabase recipe_packaging:', recipePackagingError)
            throw recipePackagingError
          }
        }
      }

      router.push('/receitas')
    } catch (err) {
      console.error('Erro ao salvar receita:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar receita'
      setError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-28 lg:pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(26,10,8,0.07)]">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
              CARDÁPIO
            </p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">
              {isEditMode ? 'Editar receita/produto' : 'Nova receita'}
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 lg:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-[#1A0A08]">Dados da receita</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="name">
                  Nome *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Ex: Brigadeiro gourmet"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="category">
                  Categoria
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="product_type"
                >
                  Tipo de produto
                </label>
                <select
                  id="product_type"
                  name="product_type"
                  value={form.product_type}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                >
                  {productTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {isSimpleProduct && (
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="is_third_party"
                  >
                    Produto terceirizado?
                  </label>
                  <select
                    id="is_third_party"
                    name="is_third_party"
                    value={form.is_third_party}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>
              )}

              {isSimpleThirdParty && (
                <div className="md:col-span-2">
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="supplier_id"
                  >
                    Fornecedor
                  </label>
                  {suppliers.length === 0 ? (
                    <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                      Nenhum fornecedor cadastrado.{' '}
                      <Link href="/fornecedores/novo" className="font-semibold text-[#C0392B]">
                        Cadastre um fornecedor primeiro.
                      </Link>
                    </div>
                  ) : (
                    <select
                      id="supplier_id"
                      name="supplier_id"
                      value={form.supplier_id}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                    >
                      <option value="">Selecione um fornecedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(110px,0.8fr)] gap-3">
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="yield_amount"
                  >
                    Rendimento
                  </label>
                  <input
                    id="yield_amount"
                    name="yield_amount"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    value={form.yield_amount}
                    onChange={handleFormChange}
                    placeholder="12"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="yield_unit"
                  >
                    Unidade
                  </label>
                  <input
                    id="yield_unit"
                    name="yield_unit"
                    type="text"
                    value={form.yield_unit}
                    onChange={handleFormChange}
                    placeholder="unidades"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="instructions"
                >
                  Instruções
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={form.instructions}
                  onChange={handleFormChange}
                  placeholder="Modo de preparo, tempos e detalhes importantes..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#1A0A08]" htmlFor="notes">
                  Observações
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Variações, validade, embalagem recomendada..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          {isSimpleThirdParty && (
            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#1A0A08]">Custo do fornecedor</h2>
                <p className="mt-1 text-sm text-[#999999]">
                  Informe o custo que voce paga para comprar este produto pronto.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="supplier_cost"
                  >
                    Custo pago ao fornecedor
                  </label>
                  <input
                    id="supplier_cost"
                    name="supplier_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.supplier_cost}
                    onChange={handleFormChange}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                    htmlFor="supplier_cost_unit"
                  >
                    Unidade do custo
                  </label>
                  <select
                    id="supplier_cost_unit"
                    name="supplier_cost_unit"
                    value={form.supplier_cost_unit}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                  >
                    {supplierCostUnitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {isKit && (
            <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
              <div className="mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Composição do kit</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Combine produtos fixos e categorias que serao escolhidas no pedido.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-[#1A0A08]">Produtos fixos</h3>
                      <p className="mt-1 text-sm text-[#999999]">
                        Itens definidos no cadastro e incluidos automaticamente no kit.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addKitItem}
                      disabled={isLoadingIngredients || availableKitProducts.length === 0}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={18} aria-hidden="true" />
                      <span>Adicionar produto</span>
                    </button>
                  </div>

                  {isLoadingIngredients ? (
                    <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                      Carregando produtos...
                    </div>
                  ) : availableKitProducts.length === 0 ? (
                    <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                      Nenhum produto cadastrado ainda. Cadastre produtos simples antes de montar um
                      kit.
                    </div>
                  ) : recipeKitItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                      Nenhum produto fixo adicionado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recipeKitItems.map((item, index) => {
                        const selectedProduct = kitProductById.get(item.item_recipe_id)
                        const selectedProductCost = selectedProduct
                          ? getKitProductBaseCost(selectedProduct)
                          : 0
                        const itemCost = kitItemCosts.get(item.localId) ?? 0

                        return (
                          <div
                            key={item.localId}
                            className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-[#1A0A08]">
                                Produto fixo {index + 1}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeKitItem(item.localId)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                                aria-label="Remover produto fixo do kit"
                              >
                                <Trash2 size={17} aria-hidden="true" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.5fr)_120px_150px] md:items-end">
                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                  Produto
                                </label>
                                <select
                                  value={item.item_recipe_id}
                                  onChange={(event) =>
                                    updateKitItem(
                                      item.localId,
                                      'item_recipe_id',
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                                >
                                  {availableKitProducts.map((product) => (
                                    <option key={product.id} value={product.id}>
                                      {product.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                  Quantidade
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateKitItem(item.localId, 'quantity', event.target.value)
                                  }
                                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                                />
                              </div>

                              <div className="rounded-lg bg-white p-3">
                                <p className="text-xs font-medium text-[#999999]">
                                  Custo estimado
                                </p>
                                <p className="mt-1 font-bold text-[#1A0A08]">
                                  {formatCurrency(itemCost)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                  Observacoes
                                </label>
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(event) =>
                                    updateKitItem(item.localId, 'notes', event.target.value)
                                  }
                                  placeholder="Ex: cliente escolhe os sabores no pedido"
                                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                                />
                              </div>

                              <div className="rounded-lg bg-white p-3">
                                <p className="text-xs font-medium text-[#999999]">
                                  Custo do produto
                                </p>
                                <p className="mt-1 font-bold text-[#1A0A08]">
                                  {formatCurrency(selectedProductCost)}
                                </p>
                                {selectedProduct?.is_third_party && (
                                  <p className="mt-1 text-xs text-[#999999]">
                                    Custo do fornecedor
                                    {selectedProduct.supplier_cost_unit
                                      ? ` / ${selectedProduct.supplier_cost_unit}`
                                      : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-[rgba(26,10,8,0.07)] pt-5">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-[#1A0A08]">Categorias do kit</h3>
                      <p className="mt-1 text-sm text-[#999999]">
                        O produto exato sera escolhido quando o pedido for montado.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addKitCategoryComponent}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
                    >
                      <Plus size={18} aria-hidden="true" />
                      <span>Adicionar categoria</span>
                    </button>
                  </div>

                  {kitCategoryComponents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                      Nenhuma categoria adicionada.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {kitCategoryComponents.map((item, index) => (
                        <div
                          key={item.localId}
                          className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-[#1A0A08]">
                              Categoria {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeKitCategoryComponent(item.localId)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                              aria-label="Remover categoria do kit"
                            >
                              <Trash2 size={17} aria-hidden="true" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_120px] md:items-end">
                            <div>
                              <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                Categoria
                              </label>
                              <select
                                value={item.category}
                                onChange={(event) =>
                                  updateKitCategoryComponent(
                                    item.localId,
                                    'category',
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                              >
                                {kitCategoryOptions.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                Quantidade
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateKitCategoryComponent(
                                    item.localId,
                                    'quantity',
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                              Observacoes
                            </label>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(event) =>
                                updateKitCategoryComponent(
                                  item.localId,
                                  'notes',
                                  event.target.value
                                )
                              }
                              placeholder="Ex: cliente escolhe os doces no pedido"
                              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-[rgba(26,10,8,0.07)] pt-5">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-[#1A0A08]">Grupos flexiveis</h3>
                      <p className="mt-1 text-sm text-[#999999]">
                        Categorias que compartilham uma quantidade total e podem ser redistribuidas
                        no pedido.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addKitFlexibleGroup}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F]"
                    >
                      <Plus size={18} aria-hidden="true" />
                      <span>Adicionar grupo</span>
                    </button>
                  </div>

                  {kitFlexibleGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                      Nenhum grupo flexivel adicionado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {kitFlexibleGroups.map((group, groupIndex) => {
                        const defaultTotal = calculateFlexibleGroupDefaultTotal(group)
                        const totalQuantity = parseDecimal(group.total_quantity)
                        const hasInvalidTotal = Math.abs(defaultTotal - totalQuantity) > 0.001

                        return (
                          <div
                            key={group.localId}
                            className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-[#1A0A08]">
                                Grupo flexivel {groupIndex + 1}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeKitFlexibleGroup(group.localId)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                                aria-label="Remover grupo flexivel do kit"
                              >
                                <Trash2 size={17} aria-hidden="true" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_130px] md:items-end">
                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                  Nome do grupo
                                </label>
                                <input
                                  type="text"
                                  value={group.name}
                                  onChange={(event) =>
                                    updateKitFlexibleGroup(
                                      group.localId,
                                      'name',
                                      event.target.value
                                    )
                                  }
                                  placeholder="Ex: Doces e salgados"
                                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                  Total
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={group.total_quantity}
                                  onChange={(event) =>
                                    updateKitFlexibleGroup(
                                      group.localId,
                                      'total_quantity',
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                                />
                              </div>
                            </div>

                            <div className="mt-3 rounded-lg bg-white p-3">
                              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-[#1A0A08]">
                                    Categorias permitidas
                                  </p>
                                  <p
                                    className={`mt-1 text-xs font-semibold ${
                                      hasInvalidTotal ? 'text-[#C0392B]' : 'text-[#999999]'
                                    }`}
                                  >
                                    Distribuicao padrao: {formatNumber(defaultTotal)} /{' '}
                                    {formatNumber(totalQuantity)}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => addKitFlexibleGroupCategory(group.localId)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
                                >
                                  <Plus size={15} aria-hidden="true" />
                                  <span>Adicionar categoria</span>
                                </button>
                              </div>

                              <div className="space-y-2">
                                {group.categories.map((categoryItem) => (
                                  <div
                                    key={categoryItem.localId}
                                    className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_130px_40px]"
                                  >
                                    <select
                                      value={categoryItem.category}
                                      onChange={(event) =>
                                        updateKitFlexibleGroupCategory(
                                          group.localId,
                                          categoryItem.localId,
                                          'category',
                                          event.target.value
                                        )
                                      }
                                      className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                    >
                                      {kitCategoryOptions.map((category) => (
                                        <option key={category} value={category}>
                                          {category}
                                        </option>
                                      ))}
                                    </select>

                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={categoryItem.default_quantity}
                                      onChange={(event) =>
                                        updateKitFlexibleGroupCategory(
                                          group.localId,
                                          categoryItem.localId,
                                          'default_quantity',
                                          event.target.value
                                        )
                                      }
                                      className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeKitFlexibleGroupCategory(
                                          group.localId,
                                          categoryItem.localId
                                        )
                                      }
                                      className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                      aria-label="Remover categoria do grupo flexivel"
                                    >
                                      <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                Observacoes
                              </label>
                              <input
                                type="text"
                                value={group.notes}
                                onChange={(event) =>
                                  updateKitFlexibleGroup(
                                    group.localId,
                                    'notes',
                                    event.target.value
                                  )
                                }
                                placeholder="Ex: cliente pode trocar doces por salgados"
                                className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {isSimpleInternal && (
            <>
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1A0A08]">Ingredientes da receita</h2>
                <p className="mt-1 text-sm text-[#999999]">
                  Selecione os ingredientes cadastrados e informe a quantidade usada.
                </p>
              </div>

              <button
                type="button"
                onClick={addRecipeIngredient}
                disabled={isLoadingIngredients || ingredients.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Adicionar ingrediente</span>
              </button>
            </div>

            {isLoadingIngredients ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Carregando ingredientes...
              </div>
            ) : ingredients.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                Nenhum ingrediente cadastrado ainda.{' '}
                <Link href="/ingredientes/novo" className="font-semibold text-[#C0392B]">
                  Cadastre um ingrediente
                </Link>
                .
              </div>
            ) : recipeIngredients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                Adicione o primeiro ingrediente para calcular os custos.
              </div>
            ) : (
              <div className="space-y-3">
                {recipeIngredients.map((item, index) => {
                  const selectedIngredient = ingredientById.get(item.ingredient_id)
                  const itemCost = ingredientCosts.get(item.localId) ?? 0

                  return (
                    <div
                      key={item.localId}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#1A0A08]">
                          Ingrediente {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeRecipeIngredient(item.localId)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                          aria-label="Remover ingrediente"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_120px_120px_140px] md:items-end">
                        <div>
                          <label className="mb-2 flex items-center justify-between text-xs font-semibold text-[#1A0A08]">
                            <span>Ingrediente</span>
                            <button 
                               type="button" 
                               onClick={() => {
                                 setQuickIngredientTargetLocalId(item.localId)
                                 setQuickIngredientError('')
                                 setIsQuickIngredientModalOpen(true)
                               }}
                               className="text-[#C0392B] hover:underline"
                            >
                              + Novo rapido
                            </button>
                          </label>
                          <select
                            value={item.ingredient_id}
                            onChange={(event) =>
                              updateRecipeIngredient(
                                item.localId,
                                'ingredient_id',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            {ingredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>
                                {ingredient.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(event) =>
                              updateRecipeIngredient(item.localId, 'quantity', event.target.value)
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Unidade
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(event) =>
                              updateRecipeIngredient(item.localId, 'unit', event.target.value)
                            }
                            placeholder={getDefaultRecipeUsageUnit(selectedIngredient)}
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          />
                        </div>

                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-medium text-[#999999]">Custo</p>
                          <p className="mt-1 font-bold text-[#1A0A08]">
                            {formatCurrency(itemCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C9A84C]">
                  <Package size={22} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1A0A08]">Embalagens do produto</h2>
                  <p className="mt-1 text-sm text-[#999999]">
                    Vincule forminhas, caixas, bandejas ou itens de transporte usados na receita.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addRecipePackaging}
                disabled={isLoadingIngredients || availablePackaging.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Adicionar embalagem</span>
              </button>
            </div>

            {isLoadingIngredients ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Carregando embalagens...
              </div>
            ) : availablePackaging.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                Nenhuma embalagem cadastrada.{' '}
                <Link href="/embalagens/nova" className="font-semibold text-[#C0392B]">
                  Cadastre embalagens primeiro.
                </Link>
              </div>
            ) : recipePackaging.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                Adicione embalagens para incluir esse custo na precificacao.
              </div>
            ) : (
              <div className="space-y-3">
                {recipePackaging.map((item, index) => {
                  const selectedPackaging = packagingById.get(item.packaging_id)
                  const itemCost = packagingCosts.get(item.localId) ?? 0
                  const capacity = parseNumericValue(selectedPackaging?.capacity)

                  return (
                    <div
                      key={item.localId}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#1A0A08]">
                          Embalagem {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeRecipePackaging(item.localId)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                          aria-label="Remover embalagem"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_150px_150px_140px] md:items-end">
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Embalagem
                          </label>
                          <select
                            value={item.packaging_id}
                            onChange={(event) =>
                              updateRecipePackaging(
                                item.localId,
                                'packaging_id',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            {availablePackaging.map((packaging) => (
                              <option key={packaging.id} value={packaging.id}>
                                {packaging.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Tipo de uso
                          </label>
                          <select
                            value={item.usage_type}
                            onChange={(event) =>
                              updateRecipePackaging(
                                item.localId,
                                'usage_type',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            <option value="unitaria">Unitaria</option>
                            <option value="transporte">Transporte</option>
                          </select>
                        </div>

                        {item.usage_type === 'unitaria' ? (
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                              Qtd. por unidade
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              inputMode="decimal"
                              value={item.quantity_per_recipe_unit}
                              onChange={(event) =>
                                updateRecipePackaging(
                                  item.localId,
                                  'quantity_per_recipe_unit',
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                            />
                          </div>
                        ) : (
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs font-medium text-[#999999]">Capacidade</p>
                            <p className="mt-1 font-bold text-[#1A0A08]">
                              {capacity > 0
                                ? `${formatNumber(capacity)} ${
                                    selectedPackaging?.capacity_unit || 'unidades'
                                  }`
                                : 'Usando 1'}
                            </p>
                          </div>
                        )}

                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-medium text-[#999999]">Custo estimado</p>
                          <p className="mt-1 font-bold text-[#1A0A08]">
                            {formatCurrency(itemCost)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                          Observacoes
                        </label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(event) =>
                            updateRecipePackaging(item.localId, 'notes', event.target.value)
                          }
                          placeholder="Ex: caixa apenas para entregas acima de 48 unidades"
                          className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
            </>
          )}

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#C9A84C]">
                <Calculator size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1A0A08]">Precificação</h2>
                <p className="text-sm text-[#999999]">Valores calculados automaticamente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {isKit ? (
                <div className="rounded-lg bg-[#FAF6F0] p-4">
                  <p className="text-xs font-medium text-[#999999]">Custo dos produtos fixos</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(kitTotalCost)}
                  </p>
                  {(kitCategoryComponents.length > 0 || kitFlexibleGroups.length > 0) && (
                    <p className="mt-1 text-xs text-[#999999]">
                      Categorias e grupos flexiveis entram como custo 0 ate a escolha no pedido.
                    </p>
                  )}
                </div>
              ) : isSimpleThirdParty ? (
                <div className="rounded-lg bg-[#FAF6F0] p-4">
                  <p className="text-xs font-medium text-[#999999]">Custo do fornecedor</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(supplierCostAmount)}
                  </p>
                  <p className="mt-1 text-xs text-[#999999]">
                    por {form.supplier_cost_unit || 'unidade'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-[#FAF6F0] p-4">
                    <p className="text-xs font-medium text-[#999999]">Custo dos ingredientes</p>
                    <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                      {formatCurrency(ingredientTotalCost)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#FAF6F0] p-4">
                    <p className="text-xs font-medium text-[#999999]">Custo das embalagens</p>
                    <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                      {formatCurrency(packagingTotalCost)}
                    </p>
                  </div>
                </>
              )}

              {!isSimpleThirdParty && (
                <div className="rounded-lg bg-[#FAF6F0] p-4">
                  <p className="text-xs font-medium text-[#999999]">Custo total</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(totalCost)}
                  </p>
                </div>
              )}

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="profit_margin"
                >
                  Margem de lucro %
                </label>
                <input
                  id="profit_margin"
                  name="profit_margin"
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  inputMode="decimal"
                  value={form.profit_margin}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              {!isSimpleThirdParty && (
                <div className="rounded-lg bg-[#FAF6F0] p-4">
                  <p className="text-xs font-medium text-[#999999]">Custo por unidade</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(costPerUnit)}
                  </p>
                </div>
              )}

              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-xs font-medium text-[#999999]">Preço sugerido</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(suggestedPrice)}
                </p>
              </div>

              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-semibold text-[#1A0A08]"
                  htmlFor="sale_price"
                >
                  Preço que eu cobro
                </label>
                <input
                  id="sale_price"
                  name="sale_price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.sale_price}
                  onChange={handleFormChange}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                />
                <p className="mt-2 text-sm text-[#999999]">
                  Se vazio, o app usará o preço sugerido nos pedidos.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-11 rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-5 py-2.5 font-semibold text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} aria-hidden="true" />
              <span>
                {isSubmitting
                  ? 'Salvando...'
                  : isEditMode
                    ? 'Salvar alterações'
                    : 'Salvar receita'}
              </span>
            </button>
          </div>
        </form>
      </main>

      {isQuickIngredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-bold text-[#1A0A08]">Novo ingrediente rapido</h3>
            
            {quickIngredientError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[#C0392B]">
                {quickIngredientError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Nome *</label>
                <input 
                  type="text" 
                  value={quickIngredientForm.name}
                  onChange={e => setQuickIngredientForm({...quickIngredientForm, name: e.target.value})}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Categoria</label>
                <input 
                  type="text" 
                  value={quickIngredientForm.category}
                  onChange={e => setQuickIngredientForm({...quickIngredientForm, category: e.target.value})}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Unidade de compra *</label>
                  <input 
                    type="text" 
                    value={quickIngredientForm.purchase_unit}
                    onChange={e => setQuickIngredientForm({...quickIngredientForm, purchase_unit: e.target.value})}
                    placeholder="Ex: kg"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Qtd. de compra *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={quickIngredientForm.purchase_quantity}
                    onChange={e => setQuickIngredientForm({...quickIngredientForm, purchase_quantity: e.target.value})}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Preco de compra *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={quickIngredientForm.purchase_price}
                    onChange={e => setQuickIngredientForm({...quickIngredientForm, purchase_price: e.target.value})}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Unidade de uso *</label>
                  <input 
                    type="text" 
                    value={quickIngredientForm.usage_unit}
                    onChange={e => setQuickIngredientForm({...quickIngredientForm, usage_unit: e.target.value})}
                    placeholder="Ex: g"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Estoque atual</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={quickIngredientForm.stock_quantity}
                    onChange={e => setQuickIngredientForm({...quickIngredientForm, stock_quantity: e.target.value})}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1A0A08]">Fornecedor preferencial</label>
                {suppliers.length > 0 ? (
                  <select
                    value={quickIngredientForm.supplier_id}
                    onChange={e => setQuickIngredientForm({...quickIngredientForm, supplier_id: e.target.value})}
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] px-3 py-2 outline-none focus:ring-2 focus:ring-[#C0392B]"
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <p className="mt-1 text-xs text-[#999999]">Voce pode vincular fornecedor depois.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsQuickIngredientModalOpen(false)}
                className="rounded-lg px-4 py-2 font-semibold text-[#1A0A08] hover:bg-[#FAF6F0]"
                disabled={quickIngredientLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuickSaveIngredient}
                disabled={quickIngredientLoading}
                className="rounded-lg bg-[#C0392B] px-4 py-2 font-semibold text-white hover:bg-[#A0301F] disabled:opacity-60"
              >
                {quickIngredientLoading ? 'Salvando...' : 'Salvar ingrediente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
