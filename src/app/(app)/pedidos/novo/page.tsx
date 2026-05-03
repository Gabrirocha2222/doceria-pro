'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, ArrowLeft, Package, Plus, Save, Trash2, Upload } from 'lucide-react'
import {
  createLocalId,
  formatCurrency,
  formatNumber,
  optionalMoney,
  optionalText,
  parseDecimal,
  parseInteger,
  parseNumericValue,
} from '@/lib/format'
import { logSupabaseError } from '@/lib/supabase-error'
import { ImageUpload } from '@/components/ui/ImageUpload'

type NumericValue = number | string | null | undefined
type ProductType = 'simples' | 'kit'

type SupabaseErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

type Recipe = {
  id: string
  name: string
  category: string | null
  product_type: ProductType | null
  is_third_party: boolean | null
  supplier_id: string | null
  sale_price: NumericValue
  suggested_price: NumericValue
  supplier_cost: NumericValue
  supplier_cost_unit: string | null
}

type ProductKitItem = {
  id: string
  kit_recipe_id: string
  item_recipe_id: string
  quantity: NumericValue
  notes: string | null
}

type KitCategoryComponent = {
  id: string
  kit_recipe_id: string
  category: string
  quantity: NumericValue
  notes: string | null
}

type KitFlexibleGroup = {
  id: string
  kit_recipe_id: string
  name: string
  total_quantity: NumericValue
  notes: string | null
}

type KitFlexibleGroupCategory = {
  id: string
  flexible_group_id: string
  category: string
  default_quantity: NumericValue
  sort_order: number | null
}

type FlavorItem = {
  localId: string
  name: string
  quantity: string
}

type FlavorPayload = {
  name: string
  quantity: number
}[]

type SupplierOrderDetails = {
  flavor_details: FlavorPayload | null
  customer_name: string
  source_item: string
  parent_kit?: string
}

type CakeTopperSupplierOrderDetails = {
  nome: string | null
  idade: string | null
  tema: string | null
  foto_url: string | null
}

type Supplier = {
  id: string
  name: string
}

type CustomerOption = {
  id: string
  name: string
  phone: string | null
  balance: NumericValue
}

type CakeTopperForm = {
  enabled: boolean
  supplier_id: string
  child_name: string
  age: string
  theme: string
  photo_url: string
  cost: string
  charged_amount: string
  notes: string
}

type RecurringForm = {
  enabled: boolean
  recurrence_count: string
  first_occurrence_date: string
  recurrence_type: 'mensal'
  theme: string
  notes: string
}

type CakeTopperField = Exclude<keyof CakeTopperForm, 'enabled'>
type RecurringField = Exclude<keyof RecurringForm, 'enabled'>

type RecurringOrderOccurrenceInsert = {
  user_id: string
  order_id: string
  occurrence_number: number
  scheduled_date: string
  status: 'pendente'
  theme: string | null
  notes: string | null
}

type KitSubItem = {
  localId: string
  kit_item_id: string
  recipe_id: string
  item_name: string
  quantity: string
  notes: string
  flavors: FlavorItem[]
}

type KitCategoryChoice = {
  localId: string
  recipe_id: string
  item_name: string
  quantity: string
  notes: string
  flavors: FlavorItem[]
}

type KitCategorySubItem = {
  localId: string
  component_id: string
  category: string
  required_quantity: string
  notes: string
  choices: KitCategoryChoice[]
}

type KitFlexibleGroupCategorySelection = {
  localId: string
  group_category_id: string
  category: string
  distributed_quantity: string
  default_quantity: string
  choices: KitCategoryChoice[]
}

type KitFlexibleGroupSelection = {
  localId: string
  group_id: string
  name: string
  total_quantity: string
  notes: string
  categories: KitFlexibleGroupCategorySelection[]
}

type OrderProductItem = {
  localId: string
  recipe_id: string
  item_name: string
  product_type: ProductType
  quantity: string
  unit_price: string
  notes: string
  flavors: FlavorItem[]
  kit_subitems: KitSubItem[]
  kit_category_subitems: KitCategorySubItem[]
  kit_flexible_groups: KitFlexibleGroupSelection[]
}

type OrderExtra = {
  localId: string
  name: string
  amount: string
  notes: string
}

type OrderForm = {
  customer_name: string
  customer_phone: string
  product_name: string
  description: string
  order_date: string
  delivery_date: string
  delivery_time: string
  deposit_value: string
  status: string
  payment_method: string
  remaining_payment_method: string
  deposit_payment_date: string
  remaining_payment_date: string
  address: string
  notes: string
  fulfillment_type: 'retirada' | 'entrega'
  delivery_fee: string
  down_payment: string
  discount_amount: string
  manual_total: string
}

const statusOptions = [
  { id: 'novo', label: 'Novo' },
  { id: 'confirmado', label: 'Confirmado' },
  { id: 'em_producao', label: 'Em produção' },
  { id: 'pronto', label: 'Pronto' },
  { id: 'entregue', label: 'Entregue' },
  { id: 'cancelado', label: 'Cancelado' },
]

const paymentMethods = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'PIX' },
  { id: 'cartao_credito', label: 'Cartao credito' },
  { id: 'cartao_debito', label: 'Cartao debito' },
  { id: 'transferencia', label: 'Transferencia' },
]

const initialForm: OrderForm = {
  customer_name: '',
  customer_phone: '',
  product_name: '',
  description: '',
  order_date: new Date().toISOString().split('T')[0],
  delivery_date: '',
  delivery_time: '',
  deposit_value: '',
  status: 'novo',
  payment_method: 'pix',
  remaining_payment_method: 'pix',
  deposit_payment_date: '',
  remaining_payment_date: '',
  address: '',
  notes: '',
  fulfillment_type: 'retirada',
  delivery_fee: '0',
  down_payment: '',
  discount_amount: '0',
  manual_total: '',
}

const initialCakeTopperForm: CakeTopperForm = {
  enabled: false,
  supplier_id: '',
  child_name: '',
  age: '',
  theme: '',
  photo_url: '',
  cost: '',
  charged_amount: '',
  notes: '',
}

const initialRecurringForm: RecurringForm = {
  enabled: false,
  recurrence_count: '11',
  first_occurrence_date: '',
  recurrence_type: 'mensal',
  theme: '',
  notes: '',
}
function formatDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function addMonthsToDateString(dateValue: string, monthOffset: number) {
  const [year, month, day] = dateValue.split('-').map(Number)

  if (!year || !month || !day) return dateValue

  const targetMonthIndex = month - 1 + monthOffset
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate()
  const targetDay = Math.min(day, lastDayOfTargetMonth)

  return `${targetYear}-${formatDatePart(normalizedMonthIndex + 1)}-${formatDatePart(targetDay)}`
}
function getEffectiveSalePrice(recipe: Recipe) {
  return parseNumericValue(recipe.sale_price ?? recipe.suggested_price)
}

function normalizeCostUnit(value: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function calculateSupplierEstimatedCost(recipe: Recipe, quantity: number) {
  const supplierCost = parseNumericValue(recipe.supplier_cost)
  const supplierCostUnit = normalizeCostUnit(recipe.supplier_cost_unit)

  if (supplierCost <= 0) return null
  if (supplierCostUnit === 'unidade' || supplierCostUnit === 'unidades') {
    return quantity * supplierCost
  }
  if (supplierCostUnit === 'pedido') return supplierCost

  return null
}
function buildFlavorPayload(flavors: FlavorItem[]): FlavorPayload | null {
  const payload = flavors
    .map((flavor) => ({
      name: flavor.name.trim(),
      quantity: parseDecimal(flavor.quantity),
    }))
    .filter((flavor) => flavor.name || flavor.quantity > 0)

  return payload.length > 0 ? payload : null
}

function buildCategoryChoiceNotes(category: string, notes: string) {
  const trimmedNotes = notes.trim()
  return trimmedNotes ? `Categoria: ${category}\n${trimmedNotes}` : `Categoria: ${category}`
}

function buildFlexibleCategoryChoiceNotes(groupName: string, category: string, notes: string) {
  const trimmedNotes = notes.trim()
  const baseNotes = `Categoria: ${category}\nGrupo flexivel: ${groupName}`

  return trimmedNotes ? `${baseNotes}\n${trimmedNotes}` : baseNotes
}

export default function NovoPedidoPage() {
  const [form, setForm] = useState<OrderForm>(initialForm)
  const [cakeTopper, setCakeTopper] = useState<CakeTopperForm>(initialCakeTopperForm)
  const [recurring, setRecurring] = useState<RecurringForm>(initialRecurringForm)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [kitItems, setKitItems] = useState<ProductKitItem[]>([])
  const [kitCategoryComponents, setKitCategoryComponents] = useState<KitCategoryComponent[]>([])
  const [kitFlexibleGroups, setKitFlexibleGroups] = useState<KitFlexibleGroup[]>([])
  const [kitFlexibleGroupCategories, setKitFlexibleGroupCategories] = useState<
    KitFlexibleGroupCategory[]
  >([])
  const [orderItems, setOrderItems] = useState<OrderProductItem[]>([])
  const [orderExtras, setOrderExtras] = useState<OrderExtra[]>([])
  const [images, setImages] = useState<File[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoadingData(true)
      setError('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuária não autenticada. Faça login para continuar.')
        }

        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select(
            'id, name, category, product_type, is_third_party, supplier_id, sale_price, suggested_price, supplier_cost, supplier_cost_unit'
          )
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (recipesError) {
          logSupabaseError('Erro Supabase recipes:', recipesError)
          throw recipesError
        }

        const { data: kitItemsData, error: kitItemsError } = await supabase
          .from('product_kit_items')
          .select('id, kit_recipe_id, item_recipe_id, quantity, notes')
          .eq('user_id', user.id)

        if (kitItemsError) {
          logSupabaseError('Erro Supabase product_kit_items:', kitItemsError)
          throw kitItemsError
        }

        const { data: kitCategoryComponentsData, error: kitCategoryComponentsError } =
          await supabase
            .from('kit_category_components')
            .select('id, kit_recipe_id, category, quantity, notes')
            .eq('user_id', user.id)

        if (kitCategoryComponentsError) {
          logSupabaseError('Erro Supabase kit_category_components:', kitCategoryComponentsError)
          throw kitCategoryComponentsError
        }

        const { data: kitFlexibleGroupsData, error: kitFlexibleGroupsError } = await supabase
          .from('kit_flexible_groups')
          .select('id, kit_recipe_id, name, total_quantity, notes')
          .eq('user_id', user.id)

        if (kitFlexibleGroupsError) {
          logSupabaseError('Erro Supabase kit_flexible_groups:', kitFlexibleGroupsError)
          throw kitFlexibleGroupsError
        }

        const { data: kitFlexibleGroupCategoriesData, error: kitFlexibleGroupCategoriesError } =
          await supabase
            .from('kit_flexible_group_categories')
            .select('id, flexible_group_id, category, default_quantity, sort_order')
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })

        if (kitFlexibleGroupCategoriesError) {
          logSupabaseError(
            'Erro Supabase kit_flexible_group_categories:',
            kitFlexibleGroupCategoriesError
          )
          throw kitFlexibleGroupCategoriesError
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

        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, name, phone, balance')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (customersError) {
          logSupabaseError('Erro Supabase customers:', customersError)
          throw customersError
        }

        if (isMounted) {
          setRecipes((recipesData ?? []) as Recipe[])
          setSuppliers((suppliersData ?? []) as Supplier[])
          setCustomers((customersData ?? []) as CustomerOption[])
          setKitItems((kitItemsData ?? []) as ProductKitItem[])
          setKitCategoryComponents(
            (kitCategoryComponentsData ?? []) as KitCategoryComponent[]
          )
          setKitFlexibleGroups((kitFlexibleGroupsData ?? []) as KitFlexibleGroup[])
          setKitFlexibleGroupCategories(
            (kitFlexibleGroupCategoriesData ?? []) as KitFlexibleGroupCategory[]
          )
        }
      } catch (err) {
        console.error('Erro ao carregar produtos:', err)
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Falha ao carregar produtos'
          setError(message)
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false)
        }
      }
    }

    loadProducts()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const recipeById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]))
  }, [recipes])

  const kitItemsByKitId = useMemo(() => {
    const groupedItems = new Map<string, ProductKitItem[]>()

    kitItems.forEach((item) => {
      const currentItems = groupedItems.get(item.kit_recipe_id) ?? []
      groupedItems.set(item.kit_recipe_id, [...currentItems, item])
    })

    return groupedItems
  }, [kitItems])

  const kitCategoryComponentsByKitId = useMemo(() => {
    const groupedItems = new Map<string, KitCategoryComponent[]>()

    kitCategoryComponents.forEach((item) => {
      const currentItems = groupedItems.get(item.kit_recipe_id) ?? []
      groupedItems.set(item.kit_recipe_id, [...currentItems, item])
    })

    return groupedItems
  }, [kitCategoryComponents])

  const kitFlexibleGroupsByKitId = useMemo(() => {
    const groupedItems = new Map<string, KitFlexibleGroup[]>()

    kitFlexibleGroups.forEach((group) => {
      const currentGroups = groupedItems.get(group.kit_recipe_id) ?? []
      groupedItems.set(group.kit_recipe_id, [...currentGroups, group])
    })

    return groupedItems
  }, [kitFlexibleGroups])

  const kitFlexibleGroupCategoriesByGroupId = useMemo(() => {
    const groupedItems = new Map<string, KitFlexibleGroupCategory[]>()

    kitFlexibleGroupCategories.forEach((category) => {
      const currentCategories = groupedItems.get(category.flexible_group_id) ?? []
      groupedItems.set(category.flexible_group_id, [...currentCategories, category])
    })

    return groupedItems
  }, [kitFlexibleGroupCategories])

  const recipesByCategory = useMemo(() => {
    const groupedRecipes = new Map<string, Recipe[]>()

    recipes.forEach((recipe) => {
      if (recipe.product_type === 'kit') return

      const category = recipe.category?.trim()
      if (!category) return

      const currentRecipes = groupedRecipes.get(category) ?? []
      groupedRecipes.set(category, [...currentRecipes, recipe])
    })

    return groupedRecipes
  }, [recipes])

  const selectedCustomer = useMemo(() => {
    const customerName = form.customer_name.trim().toLowerCase()
    if (!customerName) return null

    return (
      customers.find((customer) => customer.name.trim().toLowerCase() === customerName) ?? null
    )
  }, [customers, form.customer_name])

  const selectedCustomerBalance = parseNumericValue(selectedCustomer?.balance)

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + parseDecimal(item.quantity) * parseDecimal(item.unit_price)
    }, 0)
  }, [orderItems])

  const subtotalItems = orderTotal
  const deliveryFee = parseDecimal(form.delivery_fee)
  const extrasTotal = orderExtras.reduce((sum, extra) => sum + parseDecimal(extra.amount), 0)
  const cakeTopperChargedAmount = cakeTopper.enabled ? parseDecimal(cakeTopper.charged_amount) : 0
  const discount = parseDecimal(form.discount_amount)
  const totalCalculated = subtotalItems + deliveryFee + extrasTotal + cakeTopperChargedAmount - discount
  const finalTotal = form.manual_total ? parseDecimal(form.manual_total) : totalCalculated

  const downPayment = parseDecimal(form.down_payment)
  const remainingAmount = Math.max(finalTotal - downPayment, 0)

  function buildKitSubItems(recipeId: string) {
    const selectedKitItems = kitItemsByKitId.get(recipeId) ?? []

    return selectedKitItems.map((kitItem) => {
      const recipe = recipeById.get(kitItem.item_recipe_id)

      return {
        localId: createLocalId(),
        kit_item_id: kitItem.id,
        recipe_id: kitItem.item_recipe_id,
        item_name: recipe?.name ?? 'Item do kit',
        quantity: String(parseNumericValue(kitItem.quantity) || 1),
        notes: kitItem.notes ?? '',
        flavors: [],
      }
    })
  }

  function buildKitCategorySubItems(recipeId: string) {
    const selectedComponents = kitCategoryComponentsByKitId.get(recipeId) ?? []

    return selectedComponents.map((component) => ({
      localId: createLocalId(),
      component_id: component.id,
      category: component.category,
      required_quantity: String(parseNumericValue(component.quantity) || 1),
      notes: component.notes ?? '',
      choices: [],
    }))
  }

  function buildKitFlexibleGroups(recipeId: string) {
    const selectedGroups = kitFlexibleGroupsByKitId.get(recipeId) ?? []

    return selectedGroups.map((group) => {
      const categories = kitFlexibleGroupCategoriesByGroupId.get(group.id) ?? []

      return {
        localId: createLocalId(),
        group_id: group.id,
        name: group.name,
        total_quantity: String(parseNumericValue(group.total_quantity)),
        notes: group.notes ?? '',
        categories: categories.map((category) => ({
          localId: createLocalId(),
          group_category_id: category.id,
          category: category.category,
          distributed_quantity: String(parseNumericValue(category.default_quantity)),
          default_quantity: String(parseNumericValue(category.default_quantity)),
          choices: [],
        })),
      }
    })
  }

  function buildOrderItem(recipe: Recipe): OrderProductItem {
    const productType = recipe.product_type === 'kit' ? 'kit' : 'simples'

    return {
      localId: createLocalId(),
      recipe_id: recipe.id,
      item_name: recipe.name,
      product_type: productType,
      quantity: '1',
      unit_price: String(getEffectiveSalePrice(recipe)),
      notes: '',
      flavors: [],
      kit_subitems: productType === 'kit' ? buildKitSubItems(recipe.id) : [],
      kit_category_subitems: productType === 'kit' ? buildKitCategorySubItems(recipe.id) : [],
      kit_flexible_groups: productType === 'kit' ? buildKitFlexibleGroups(recipe.id) : [],
    }
  }

  function getCategoryProducts(category: string) {
    return recipesByCategory.get(category) ?? []
  }

  function calculateCategoryChosenQuantity(component: KitCategorySubItem) {
    return component.choices.reduce((sum, choice) => sum + parseDecimal(choice.quantity), 0)
  }

  function calculateFlexibleGroupDistributedQuantity(group: KitFlexibleGroupSelection) {
    return group.categories.reduce(
      (sum, category) => sum + parseDecimal(category.distributed_quantity),
      0
    )
  }

  function calculateFlexibleCategoryChosenQuantity(
    category: KitFlexibleGroupCategorySelection
  ) {
    return category.choices.reduce((sum, choice) => sum + parseDecimal(choice.quantity), 0)
  }

  function buildCategoryChoice(recipe: Recipe, quantity: string): KitCategoryChoice {
    return {
      localId: createLocalId(),
      recipe_id: recipe.id,
      item_name: recipe.name,
      quantity,
      notes: '',
      flavors: [],
    }
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as keyof OrderForm
    const value = event.target.value

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))

    if (field === 'delivery_date') {
      setRecurring((currentRecurring) =>
        currentRecurring.enabled && !currentRecurring.first_occurrence_date
          ? { ...currentRecurring, first_occurrence_date: value }
          : currentRecurring
      )
    }
  }

  function handleCakeTopperChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as CakeTopperField
    const value = event.target.value

    setCakeTopper((currentCakeTopper) => ({
      ...currentCakeTopper,
      [field]: value,
    }))
  }

  function handleRecurringChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as RecurringField
    const value = event.target.value

    if (field === 'recurrence_type') {
      setRecurring((currentRecurring) => ({
        ...currentRecurring,
        recurrence_type: value as RecurringForm['recurrence_type'],
      }))
      return
    }

    setRecurring((currentRecurring) => ({
      ...currentRecurring,
      [field]: value,
    }))
  }

  function toggleRecurring(enabled: boolean) {
    setRecurring((currentRecurring) => ({
      ...currentRecurring,
      enabled,
      first_occurrence_date:
        enabled && !currentRecurring.first_occurrence_date
          ? form.delivery_date
          : currentRecurring.first_occurrence_date,
    }))
  }

  function addOrderItem() {
    const firstRecipe = recipes[0]

    if (!firstRecipe) {
      setError('Cadastre produtos em Receitas antes de montar um pedido')
      return
    }

    setOrderItems((currentItems) => [...currentItems, buildOrderItem(firstRecipe)])
  }

  function updateOrderItem(
    localId: string,
    field: 'recipe_id' | 'quantity' | 'unit_price' | 'notes',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        if (field === 'recipe_id') {
          const recipe = recipeById.get(value)
          return recipe ? buildOrderItem(recipe) : item
        }

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function removeOrderItem(localId: string) {
    setOrderItems((currentItems) => currentItems.filter((item) => item.localId !== localId))
  }

  function addFlavor(itemLocalId: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          flavors: [...item.flavors, { localId: createLocalId(), name: '', quantity: '' }],
        }
      })
    )
  }

  function updateFlavor(
    itemLocalId: string,
    flavorLocalId: string,
    field: 'name' | 'quantity',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          flavors: item.flavors.map((flavor) =>
            flavor.localId === flavorLocalId ? { ...flavor, [field]: value } : flavor
          ),
        }
      })
    )
  }

  function removeFlavor(itemLocalId: string, flavorLocalId: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          flavors: item.flavors.filter((flavor) => flavor.localId !== flavorLocalId),
        }
      })
    )
  }

  function addSubItemFlavor(itemLocalId: string, subItemLocalId: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_subitems: item.kit_subitems.map((subItem) =>
            subItem.localId === subItemLocalId
              ? {
                  ...subItem,
                  flavors: [
                    ...subItem.flavors,
                    { localId: createLocalId(), name: '', quantity: '' },
                  ],
                }
              : subItem
          ),
        }
      })
    )
  }

  function updateSubItemFlavor(
    itemLocalId: string,
    subItemLocalId: string,
    flavorLocalId: string,
    field: 'name' | 'quantity',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_subitems: item.kit_subitems.map((subItem) =>
            subItem.localId === subItemLocalId
              ? {
                  ...subItem,
                  flavors: subItem.flavors.map((flavor) =>
                    flavor.localId === flavorLocalId ? { ...flavor, [field]: value } : flavor
                  ),
                }
              : subItem
          ),
        }
      })
    )
  }

  function removeSubItemFlavor(
    itemLocalId: string,
    subItemLocalId: string,
    flavorLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_subitems: item.kit_subitems.map((subItem) =>
            subItem.localId === subItemLocalId
              ? {
                  ...subItem,
                  flavors: subItem.flavors.filter((flavor) => flavor.localId !== flavorLocalId),
                }
              : subItem
          ),
        }
      })
    )
  }

  function addCategoryChoice(itemLocalId: string, componentLocalId: string) {
    const item = orderItems.find((currentItem) => currentItem.localId === itemLocalId)
    const component = item?.kit_category_subitems.find(
      (currentComponent) => currentComponent.localId === componentLocalId
    )

    if (!component) return

    const categoryProducts = getCategoryProducts(component.category)
    const firstProduct = categoryProducts[0]

    if (!firstProduct) {
      setError(`Cadastre produtos na categoria ${component.category} antes de montar este kit`)
      return
    }

    setOrderItems((currentItems) =>
      currentItems.map((currentItem) => {
        if (currentItem.localId !== itemLocalId) return currentItem

        return {
          ...currentItem,
          kit_category_subitems: currentItem.kit_category_subitems.map((currentComponent) => {
            if (currentComponent.localId !== componentLocalId) return currentComponent

            const requiredQuantity = parseDecimal(currentComponent.required_quantity)
            const chosenQuantity = calculateCategoryChosenQuantity(currentComponent)
            const remainingQuantity = Math.max(requiredQuantity - chosenQuantity, 0)
            const nextQuantity = remainingQuantity > 0 ? String(remainingQuantity) : '1'

            return {
              ...currentComponent,
              choices: [
                ...currentComponent.choices,
                buildCategoryChoice(firstProduct, nextQuantity),
              ],
            }
          }),
        }
      })
    )
  }

  function updateCategoryChoice(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string,
    field: 'recipe_id' | 'quantity' | 'notes',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_category_subitems: item.kit_category_subitems.map((component) => {
            if (component.localId !== componentLocalId) return component

            return {
              ...component,
              choices: component.choices.map((choice) => {
                if (choice.localId !== choiceLocalId) return choice

                if (field === 'recipe_id') {
                  const recipe = recipeById.get(value)

                  return {
                    ...choice,
                    recipe_id: value,
                    item_name: recipe?.name ?? choice.item_name,
                  }
                }

                return {
                  ...choice,
                  [field]: value,
                }
              }),
            }
          }),
        }
      })
    )
  }

  function removeCategoryChoice(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_category_subitems: item.kit_category_subitems.map((component) =>
            component.localId === componentLocalId
              ? {
                  ...component,
                  choices: component.choices.filter((choice) => choice.localId !== choiceLocalId),
                }
              : component
          ),
        }
      })
    )
  }

  function addCategoryChoiceFlavor(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_category_subitems: item.kit_category_subitems.map((component) => {
            if (component.localId !== componentLocalId) return component

            return {
              ...component,
              choices: component.choices.map((choice) =>
                choice.localId === choiceLocalId
                  ? {
                      ...choice,
                      flavors: [
                        ...choice.flavors,
                        { localId: createLocalId(), name: '', quantity: '' },
                      ],
                    }
                  : choice
              ),
            }
          }),
        }
      })
    )
  }

  function updateCategoryChoiceFlavor(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string,
    flavorLocalId: string,
    field: 'name' | 'quantity',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_category_subitems: item.kit_category_subitems.map((component) => {
            if (component.localId !== componentLocalId) return component

            return {
              ...component,
              choices: component.choices.map((choice) =>
                choice.localId === choiceLocalId
                  ? {
                      ...choice,
                      flavors: choice.flavors.map((flavor) =>
                        flavor.localId === flavorLocalId
                          ? { ...flavor, [field]: value }
                          : flavor
                      ),
                    }
                  : choice
              ),
            }
          }),
        }
      })
    )
  }

  function removeCategoryChoiceFlavor(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string,
    flavorLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_category_subitems: item.kit_category_subitems.map((component) => {
            if (component.localId !== componentLocalId) return component

            return {
              ...component,
              choices: component.choices.map((choice) =>
                choice.localId === choiceLocalId
                  ? {
                      ...choice,
                      flavors: choice.flavors.filter((flavor) => flavor.localId !== flavorLocalId),
                    }
                  : choice
              ),
            }
          }),
        }
      })
    )
  }

  function updateFlexibleGroupCategoryQuantity(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_flexible_groups: item.kit_flexible_groups.map((group) =>
            group.localId === groupLocalId
              ? {
                  ...group,
                  categories: group.categories.map((category) =>
                    category.localId === categoryLocalId
                      ? {
                          ...category,
                          distributed_quantity: value,
                        }
                      : category
                  ),
                }
              : group
          ),
        }
      })
    )
  }

  function addFlexibleCategoryChoice(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string
  ) {
    const item = orderItems.find((currentItem) => currentItem.localId === itemLocalId)
    const group = item?.kit_flexible_groups.find(
      (currentGroup) => currentGroup.localId === groupLocalId
    )
    const category = group?.categories.find(
      (currentCategory) => currentCategory.localId === categoryLocalId
    )

    if (!category) return

    const categoryProducts = getCategoryProducts(category.category)
    const firstProduct = categoryProducts[0]

    if (!firstProduct) {
      setError(`Cadastre produtos na categoria ${category.category} antes de montar este kit`)
      return
    }

    setOrderItems((currentItems) =>
      currentItems.map((currentItem) => {
        if (currentItem.localId !== itemLocalId) return currentItem

        return {
          ...currentItem,
          kit_flexible_groups: currentItem.kit_flexible_groups.map((currentGroup) => {
            if (currentGroup.localId !== groupLocalId) return currentGroup

            return {
              ...currentGroup,
              categories: currentGroup.categories.map((currentCategory) => {
                if (currentCategory.localId !== categoryLocalId) return currentCategory

                const requiredQuantity = parseDecimal(currentCategory.distributed_quantity)
                const chosenQuantity = calculateFlexibleCategoryChosenQuantity(currentCategory)
                const remainingQuantity = Math.max(requiredQuantity - chosenQuantity, 0)
                const nextQuantity = remainingQuantity > 0 ? String(remainingQuantity) : '1'

                return {
                  ...currentCategory,
                  choices: [
                    ...currentCategory.choices,
                    buildCategoryChoice(firstProduct, nextQuantity),
                  ],
                }
              }),
            }
          }),
        }
      })
    )
  }

  function updateFlexibleCategoryChoice(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string,
    field: 'recipe_id' | 'quantity' | 'notes',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_flexible_groups: item.kit_flexible_groups.map((group) => {
            if (group.localId !== groupLocalId) return group

            return {
              ...group,
              categories: group.categories.map((category) => {
                if (category.localId !== categoryLocalId) return category

                return {
                  ...category,
                  choices: category.choices.map((choice) => {
                    if (choice.localId !== choiceLocalId) return choice

                    if (field === 'recipe_id') {
                      const recipe = recipeById.get(value)

                      return {
                        ...choice,
                        recipe_id: value,
                        item_name: recipe?.name ?? choice.item_name,
                      }
                    }

                    return {
                      ...choice,
                      [field]: value,
                    }
                  }),
                }
              }),
            }
          }),
        }
      })
    )
  }

  function removeFlexibleCategoryChoice(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_flexible_groups: item.kit_flexible_groups.map((group) =>
            group.localId === groupLocalId
              ? {
                  ...group,
                  categories: group.categories.map((category) =>
                    category.localId === categoryLocalId
                      ? {
                          ...category,
                          choices: category.choices.filter(
                            (choice) => choice.localId !== choiceLocalId
                          ),
                        }
                      : category
                  ),
                }
              : group
          ),
        }
      })
    )
  }

  function addFlexibleCategoryChoiceFlavor(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_flexible_groups: item.kit_flexible_groups.map((group) => {
            if (group.localId !== groupLocalId) return group

            return {
              ...group,
              categories: group.categories.map((category) => {
                if (category.localId !== categoryLocalId) return category

                return {
                  ...category,
                  choices: category.choices.map((choice) =>
                    choice.localId === choiceLocalId
                      ? {
                          ...choice,
                          flavors: [
                            ...choice.flavors,
                            { localId: createLocalId(), name: '', quantity: '' },
                          ],
                        }
                      : choice
                  ),
                }
              }),
            }
          }),
        }
      })
    )
  }

  function updateFlexibleCategoryChoiceFlavor(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string,
    flavorLocalId: string,
    field: 'name' | 'quantity',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_flexible_groups: item.kit_flexible_groups.map((group) => {
            if (group.localId !== groupLocalId) return group

            return {
              ...group,
              categories: group.categories.map((category) => {
                if (category.localId !== categoryLocalId) return category

                return {
                  ...category,
                  choices: category.choices.map((choice) =>
                    choice.localId === choiceLocalId
                      ? {
                          ...choice,
                          flavors: choice.flavors.map((flavor) =>
                            flavor.localId === flavorLocalId
                              ? { ...flavor, [field]: value }
                              : flavor
                          ),
                        }
                      : choice
                  ),
                }
              }),
            }
          }),
        }
      })
    )
  }

  function removeFlexibleCategoryChoiceFlavor(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string,
    flavorLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== itemLocalId) return item

        return {
          ...item,
          kit_flexible_groups: item.kit_flexible_groups.map((group) => {
            if (group.localId !== groupLocalId) return group

            return {
              ...group,
              categories: group.categories.map((category) => {
                if (category.localId !== categoryLocalId) return category

                return {
                  ...category,
                  choices: category.choices.map((choice) =>
                    choice.localId === choiceLocalId
                      ? {
                          ...choice,
                          flavors: choice.flavors.filter(
                            (flavor) => flavor.localId !== flavorLocalId
                          ),
                        }
                      : choice
                  ),
                }
              }),
            }
          }),
        }
      })
    )
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      setImages(Array.from(event.target.files))
    }
  }

  function removeImage(index: number) {
    setImages((currentImages) => currentImages.filter((_, currentIndex) => currentIndex !== index))
  }

  function addOrderExtra() {
    setOrderExtras((currentExtras) => [
      ...currentExtras,
      {
        localId: createLocalId(),
        name: '',
        amount: '',
        notes: '',
      },
    ])
  }

  function updateOrderExtra(
    localId: string,
    field: 'name' | 'amount' | 'notes',
    value: string
  ) {
    setOrderExtras((currentExtras) =>
      currentExtras.map((extra) =>
        extra.localId === localId ? { ...extra, [field]: value } : extra
      )
    )
  }

  function removeOrderExtra(localId: string) {
    setOrderExtras((currentExtras) =>
      currentExtras.filter((extra) => extra.localId !== localId)
    )
  }

  function validateFlavorList(flavors: FlavorItem[]) {
    return flavors.every((flavor) => {
      const hasContent = flavor.name.trim() || flavor.quantity.trim()
      if (!hasContent) return true

      return Boolean(flavor.name.trim()) && parseDecimal(flavor.quantity) > 0
    })
  }

  function validateKitCategoryChoices(item: OrderProductItem) {
    for (const component of item.kit_category_subitems) {
      const requiredQuantity = parseDecimal(component.required_quantity)
      const chosenQuantity = calculateCategoryChosenQuantity(component)

      if (Math.abs(chosenQuantity - requiredQuantity) > 0.001) {
        return `No kit ${item.item_name}, escolha exatamente ${formatNumber(
          requiredQuantity
        )} itens de ${component.category}. Selecionado: ${formatNumber(chosenQuantity)}.`
      }

      const invalidChoice = component.choices.some(
        (choice) =>
          !choice.recipe_id ||
          parseDecimal(choice.quantity) <= 0 ||
          !validateFlavorList(choice.flavors)
      )

      if (invalidChoice) {
        return `Confira produtos, quantidades e sabores da categoria ${component.category}`
      }
    }

    return ''
  }

  function validateKitFlexibleGroups(item: OrderProductItem) {
    for (const group of item.kit_flexible_groups) {
      const totalQuantity = parseDecimal(group.total_quantity)
      const distributedQuantity = calculateFlexibleGroupDistributedQuantity(group)

      if (Math.abs(distributedQuantity - totalQuantity) > 0.001) {
        return `No kit ${item.item_name}, distribua exatamente ${formatNumber(
          totalQuantity
        )} itens no grupo ${group.name}. Distribuido: ${formatNumber(distributedQuantity)}.`
      }

      for (const category of group.categories) {
        const requiredQuantity = parseDecimal(category.distributed_quantity)
        const chosenQuantity = calculateFlexibleCategoryChosenQuantity(category)

        if (Math.abs(chosenQuantity - requiredQuantity) > 0.001) {
          return `No kit ${item.item_name}, escolha exatamente ${formatNumber(
            requiredQuantity
          )} itens de ${category.category} no grupo ${group.name}. Selecionado: ${formatNumber(
            chosenQuantity
          )}.`
        }

        const invalidChoice = category.choices.some(
          (choice) =>
            !choice.recipe_id ||
            parseDecimal(choice.quantity) <= 0 ||
            !validateFlavorList(choice.flavors)
        )

        if (invalidChoice) {
          return `Confira produtos, quantidades e sabores de ${category.category} no grupo ${group.name}`
        }
      }
    }

    return ''
  }

  function validateForm() {
    if (!form.customer_name.trim()) return 'Nome da cliente é obrigatório'
    if (!form.delivery_time) return 'Horário de entrega é obrigatório'
    if (orderItems.length === 0) return 'Adicione pelo menos um produto ao pedido'
    if (finalTotal <= 0) return 'Total do pedido deve ser maior que zero'
    if (downPayment < 0) return 'Valor do sinal não pode ser negativo'

    const invalidItem = orderItems.some((item) => {
      if (!item.recipe_id || parseDecimal(item.quantity) <= 0 || parseDecimal(item.unit_price) < 0) {
        return true
      }

      if (!validateFlavorList(item.flavors)) return true

      const hasInvalidFixedSubItem = item.kit_subitems.some(
        (subItem) => !validateFlavorList(subItem.flavors)
      )
      if (hasInvalidFixedSubItem) return true

      const hasInvalidCategoryChoice = item.kit_category_subitems.some((component) =>
        component.choices.some((choice) => !validateFlavorList(choice.flavors))
      )
      if (hasInvalidCategoryChoice) return true

      return item.kit_flexible_groups.some((group) =>
        group.categories.some((category) =>
          category.choices.some((choice) => !validateFlavorList(choice.flavors))
        )
      )
    })

    if (invalidItem) {
      return 'Confira produtos, quantidades, precos e sabores do pedido'
    }

    const kitCategoryError = orderItems
      .map((item) => validateKitCategoryChoices(item))
      .find((message) => message)

    if (kitCategoryError) return kitCategoryError

    const kitFlexibleGroupError = orderItems
      .map((item) => validateKitFlexibleGroups(item))
      .find((message) => message)

    if (kitFlexibleGroupError) return kitFlexibleGroupError

    const invalidExtra = orderExtras.some(
      (extra) => !extra.name.trim() || parseDecimal(extra.amount) < 0
    )

    if (invalidExtra) {
      return 'Confira nome e valor de todos os acréscimos'
    }

    if (cakeTopper.enabled) {
      if (parseDecimal(cakeTopper.cost) < 0 || parseDecimal(cakeTopper.charged_amount) < 0) {
        return 'Custo e valor cobrado do topo de bolo não podem ser negativos'
      }
    }

    if (recurring.enabled) {
      const recurrenceCount = parseInteger(recurring.recurrence_count)

      if (recurrenceCount <= 0) {
        return 'Informe a quantidade de meses/ocorrências do mesversário'
      }

      if (!recurring.first_occurrence_date) {
        return 'Informe a data da primeira entrega recorrente'
      }
    }

    return ''
  }

  async function uploadImages(orderId: string) {
    const uploadedPaths: string[] = []

    for (const image of images) {
      try {
        const filename = `${orderId}/${createLocalId()}-${image.name}`
        const { error: uploadError } = await supabase.storage
          .from('order-images')
          .upload(filename, image)

        if (uploadError) throw uploadError
        uploadedPaths.push(filename)
      } catch (err) {
        logSupabaseError('Erro ao fazer upload da imagem:', err)
      }
    }

    return uploadedPaths
  }

  function buildCakeTopperTitle(childName: string | null, theme: string | null) {
    const titleDetail = childName || theme
    return titleDetail ? `Topo de bolo - ${titleDetail}` : 'Topo de bolo'
  }

  async function createSupplierOrderForThirdPartyItem(params: {
    userId: string
    orderId: string
    orderItemId: string
    recipeId: string
    title: string
    quantity: number
    flavorDetails: FlavorPayload | null
    notes: string | null
    parentKitName?: string
  }) {
    const recipe = recipeById.get(params.recipeId)

    if (!recipe?.is_third_party || !recipe.supplier_id) return

    const estimatedCost = calculateSupplierEstimatedCost(recipe, params.quantity)

    const details: SupplierOrderDetails = {
      flavor_details: params.flavorDetails,
      customer_name: form.customer_name.trim(),
      source_item: params.title,
      ...(params.parentKitName ? { parent_kit: params.parentKitName } : {}),
    }

    const { error: supplierOrderError } = await supabase.from('supplier_orders').insert([
      {
        user_id: params.userId,
        supplier_id: recipe.supplier_id,
        customer_order_id: params.orderId,
        order_item_id: params.orderItemId,
        title: params.title,
        quantity: params.quantity,
        unit: 'unidades',
        due_date: form.delivery_date || null,
        status: 'pendente',
        estimated_cost: estimatedCost,
        details,
        notes: params.notes,
      },
    ])

    if (supplierOrderError) {
      logSupabaseError('Erro Supabase supplier_orders insert:', supplierOrderError)
      throw new Error(
        'Falha ao gerar pedido para fornecedor. Verifique se a migration supplier_orders foi aplicada no Supabase.'
      )
    }
  }

  async function createCakeTopperForOrder(userId: string, orderId: string) {
    if (!cakeTopper.enabled) return

    const childName = optionalText(cakeTopper.child_name)
    const age = optionalText(cakeTopper.age)
    const theme = optionalText(cakeTopper.theme)
    const photoUrl = optionalText(cakeTopper.photo_url)
    const cost = optionalMoney(cakeTopper.cost)
    const chargedAmount = optionalMoney(cakeTopper.charged_amount)
    const notes = optionalText(cakeTopper.notes)
    const supplierId = optionalText(cakeTopper.supplier_id)

    const { error: cakeTopperError } = await supabase.from('order_cake_toppers').insert([
      {
        user_id: userId,
        order_id: orderId,
        supplier_id: supplierId,
        child_name: childName,
        age,
        theme,
        photo_url: photoUrl,
        cost,
        charged_amount: chargedAmount,
        notes,
      },
    ])

    if (cakeTopperError) {
      logSupabaseError('Erro Supabase order_cake_toppers insert:', cakeTopperError)
      throw new Error(
        'Falha ao salvar topo de bolo. Verifique se a migration order_cake_toppers foi aplicada no Supabase.'
      )
    }

    if (!supplierId) return

    const details: CakeTopperSupplierOrderDetails = {
      nome: childName,
      idade: age,
      tema: theme,
      foto_url: photoUrl,
    }

    const { error: supplierOrderError } = await supabase.from('supplier_orders').insert([
      {
        user_id: userId,
        supplier_id: supplierId,
        customer_order_id: orderId,
        title: buildCakeTopperTitle(childName, theme),
        quantity: 1,
        unit: 'unidade',
        due_date: form.delivery_date || null,
        status: 'pendente',
        estimated_cost: cost,
        details,
        notes,
      },
    ])

    if (supplierOrderError) {
      logSupabaseError('Erro Supabase supplier_orders topo insert:', supplierOrderError)
      throw new Error(
        'Falha ao gerar pedido de topo para fornecedor. Verifique se a migration supplier_orders foi aplicada no Supabase.'
      )
    }
  }

  async function createRecurringOccurrencesForOrder(userId: string, orderId: string) {
    if (!recurring.enabled) return

    const recurrenceCount = parseInteger(recurring.recurrence_count)
    const theme = optionalText(recurring.theme)
    const notes = optionalText(recurring.notes)
    const occurrences: RecurringOrderOccurrenceInsert[] = Array.from(
      { length: recurrenceCount },
      (_, index) => ({
        user_id: userId,
        order_id: orderId,
        occurrence_number: index + 1,
        scheduled_date: addMonthsToDateString(recurring.first_occurrence_date, index),
        status: 'pendente',
        theme,
        notes,
      })
    )

    const { error: occurrencesError } = await supabase
      .from('recurring_order_occurrences')
      .insert(occurrences)

    if (occurrencesError) {
      logSupabaseError('Erro Supabase recurring_order_occurrences insert:', occurrencesError)
      throw new Error(
        'Falha ao gerar ocorrências recorrentes. Verifique se a migration create_recurring_orders foi aplicada no Supabase.'
      )
    }
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
        throw new Error('Usuária não autenticada. Faça login novamente.')
      }

      const currentUserId = user.id
      let customerId: string

      const { data: existingCustomers, error: searchError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('name', form.customer_name.trim())
        .limit(1)

      if (searchError) {
        logSupabaseError('Erro Supabase customers select:', searchError)
        throw searchError
      }

      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id
      } else {
        const { data: newCustomer, error: createCustomerError } = await supabase
          .from('customers')
          .insert([
            {
              user_id: currentUserId,
              name: form.customer_name.trim(),
              phone: optionalText(form.customer_phone),
            },
          ])
          .select('id')
          .single()

        if (createCustomerError) {
          logSupabaseError('Erro Supabase customers insert:', createCustomerError)
          throw createCustomerError
        }

        if (!newCustomer?.id) {
          throw new Error('Cliente criado sem id retornado pelo Supabase')
        }

        customerId = newCustomer.id
      }

      const orderData = {
        user_id: currentUserId,
        customer_id: customerId,
        order_date: form.order_date,
        delivery_date: form.delivery_date || null,
        delivery_time: form.delivery_time,
        total_value: finalTotal,
        deposit_value: downPayment,
        down_payment: downPayment,
        fulfillment_type: form.fulfillment_type,
        delivery_fee: deliveryFee,
        discount_amount: discount,
        extras_total: extrasTotal,
        manual_total: form.manual_total ? parseDecimal(form.manual_total) : null,
        remaining_payment_date: form.remaining_payment_date || null,
        status: downPayment > 0 ? 'confirmado' : (form.status || 'novo'),
        payment_status: downPayment > 0 ? 'partial' : 'pending',
        delivery_address: optionalText(form.address),
        notes: optionalText(form.notes || form.description),
        is_recurring: recurring.enabled,
        recurrence_type: recurring.enabled ? recurring.recurrence_type : 'mensal',
        recurrence_count: recurring.enabled ? parseInteger(recurring.recurrence_count) : null,
        first_occurrence_date: recurring.enabled ? recurring.first_occurrence_date : null,
      }

      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select('id')
        .single()

      if (orderError) {
        logSupabaseError('Erro Supabase orders insert:', orderError)
        throw orderError
      }

      if (!createdOrder?.id) {
        throw new Error('Pedido criado sem id retornado pelo Supabase')
      }

      const orderId = createdOrder.id

      for (const item of orderItems) {
        const quantity = parseDecimal(item.quantity)
        const unitPrice = parseDecimal(item.unit_price)
        const subtotal = quantity * unitPrice
        const flavorPayload = buildFlavorPayload(item.flavors)

        const { data: createdItem, error: itemError } = await supabase
          .from('order_items')
          .insert([
            {
              user_id: currentUserId,
              order_id: orderId,
              recipe_id: item.recipe_id,
              parent_order_item_id: null,
              item_name: item.item_name,
              quantity,
              unit_price: unitPrice,
              subtotal,
              flavor_details: flavorPayload,
              notes: optionalText(item.notes),
            },
          ])
          .select('id')
          .single()

        if (itemError) {
          logSupabaseError('Erro Supabase order_items insert:', itemError)
          throw itemError
        }

        if (!createdItem?.id) {
          throw new Error('Item de pedido criado sem id retornado pelo Supabase')
        }

        if (item.product_type !== 'kit') {
          await createSupplierOrderForThirdPartyItem({
            userId: currentUserId,
            orderId,
            orderItemId: createdItem.id,
            recipeId: item.recipe_id,
            title: item.item_name,
            quantity,
            flavorDetails: flavorPayload,
            notes: optionalText(item.notes),
          })
        }

        if (item.product_type === 'kit' && item.kit_subitems.length > 0) {
          for (const subItem of item.kit_subitems) {
            const childQuantity = parseDecimal(subItem.quantity) * quantity
            const childFlavorPayload = buildFlavorPayload(subItem.flavors)

            const { data: createdChildItem, error: childItemError } = await supabase
              .from('order_items')
              .insert([
                {
                  user_id: currentUserId,
                  order_id: orderId,
                  recipe_id: subItem.recipe_id,
                  parent_order_item_id: createdItem.id,
                  item_name: subItem.item_name,
                  quantity: childQuantity,
                  unit_price: 0,
                  subtotal: 0,
                  flavor_details: childFlavorPayload,
                  notes: optionalText(subItem.notes),
                },
              ])
              .select('id')
              .single()

            if (childItemError) {
              logSupabaseError('Erro Supabase order_items filho insert:', childItemError)
              throw childItemError
            }

            if (!createdChildItem?.id) {
              throw new Error('Subitem de pedido criado sem id retornado pelo Supabase')
            }

            await createSupplierOrderForThirdPartyItem({
              userId: currentUserId,
              orderId,
              orderItemId: createdChildItem.id,
              recipeId: subItem.recipe_id,
              title: subItem.item_name,
              quantity: childQuantity,
              flavorDetails: childFlavorPayload,
              notes: optionalText(subItem.notes),
              parentKitName: item.item_name,
            })
          }
        }

        if (item.product_type === 'kit' && item.kit_category_subitems.length > 0) {
          for (const component of item.kit_category_subitems) {
            for (const choice of component.choices) {
              const childQuantity = parseDecimal(choice.quantity) * quantity
              const childFlavorPayload = buildFlavorPayload(choice.flavors)
              const childNotes = buildCategoryChoiceNotes(component.category, choice.notes)

              const { data: createdCategoryChildItem, error: categoryChildItemError } =
                await supabase
                  .from('order_items')
                  .insert([
                    {
                      user_id: currentUserId,
                      order_id: orderId,
                      recipe_id: choice.recipe_id,
                      parent_order_item_id: createdItem.id,
                      item_name: choice.item_name,
                      quantity: childQuantity,
                      unit_price: 0,
                      subtotal: 0,
                      flavor_details: childFlavorPayload,
                      notes: childNotes,
                    },
                  ])
                  .select('id')
                  .single()

              if (categoryChildItemError) {
                logSupabaseError(
                  'Erro Supabase order_items filho de categoria insert:',
                  categoryChildItemError
                )
                throw categoryChildItemError
              }

              if (!createdCategoryChildItem?.id) {
                throw new Error('Subitem de categoria criado sem id retornado pelo Supabase')
              }

              await createSupplierOrderForThirdPartyItem({
                userId: currentUserId,
                orderId,
                orderItemId: createdCategoryChildItem.id,
                recipeId: choice.recipe_id,
                title: choice.item_name,
                quantity: childQuantity,
                flavorDetails: childFlavorPayload,
                notes: childNotes,
                parentKitName: item.item_name,
              })
            }
          }
        }

        if (item.product_type === 'kit' && item.kit_flexible_groups.length > 0) {
          for (const group of item.kit_flexible_groups) {
            for (const category of group.categories) {
              for (const choice of category.choices) {
                const childQuantity = parseDecimal(choice.quantity) * quantity
                const childFlavorPayload = buildFlavorPayload(choice.flavors)
                const childNotes = buildFlexibleCategoryChoiceNotes(
                  group.name,
                  category.category,
                  choice.notes
                )

                const { data: createdFlexibleChildItem, error: flexibleChildItemError } =
                  await supabase
                    .from('order_items')
                    .insert([
                      {
                        user_id: currentUserId,
                        order_id: orderId,
                        recipe_id: choice.recipe_id,
                        parent_order_item_id: createdItem.id,
                        item_name: choice.item_name,
                        quantity: childQuantity,
                        unit_price: 0,
                        subtotal: 0,
                        flavor_details: childFlavorPayload,
                        notes: childNotes,
                      },
                    ])
                    .select('id')
                    .single()

                if (flexibleChildItemError) {
                  logSupabaseError(
                    'Erro Supabase order_items filho de grupo flexivel insert:',
                    flexibleChildItemError
                  )
                  throw flexibleChildItemError
                }

                if (!createdFlexibleChildItem?.id) {
                  throw new Error('Subitem de grupo flexivel criado sem id retornado pelo Supabase')
                }

                await createSupplierOrderForThirdPartyItem({
                  userId: currentUserId,
                  orderId,
                  orderItemId: createdFlexibleChildItem.id,
                  recipeId: choice.recipe_id,
                  title: choice.item_name,
                  quantity: childQuantity,
                  flavorDetails: childFlavorPayload,
                  notes: childNotes,
                  parentKitName: item.item_name,
                })
              }
            }
          }
        }
      }

      if (orderExtras.length > 0) {
        const extrasData = orderExtras.map((extra) => ({
          user_id: currentUserId,
          order_id: orderId,
          name: extra.name.trim(),
          amount: parseDecimal(extra.amount),
          notes: optionalText(extra.notes),
        }))

        const { error: extrasError } = await supabase.from('order_extras').insert(extrasData)

        if (extrasError) {
          logSupabaseError('Aviso Supabase order_extras insert:', extrasError)
        }
      }

      await createCakeTopperForOrder(currentUserId, orderId)

      const payments = []

      if (downPayment > 0) {
        payments.push({
          order_id: orderId,
          amount: downPayment,
          method: form.payment_method,
          payment_date: form.deposit_payment_date || null,
          notes: 'Sinal',
        })
      }

      if (remainingAmount > 0) {
        payments.push({
          order_id: orderId,
          amount: remainingAmount,
          method: form.remaining_payment_method,
          payment_date: form.remaining_payment_date || null,
          notes: 'Restante',
        })
      }

      if (payments.length > 0) {
        const { error: paymentsError } = await supabase.from('payments').insert(payments)

        if (paymentsError) {
          logSupabaseError('Aviso Supabase payments insert:', paymentsError)
        }
      }

      await createRecurringOccurrencesForOrder(currentUserId, orderId)

      if (images.length > 0) {
        const imagePaths = await uploadImages(orderId)

        if (imagePaths.length > 0) {
          const { error: imageUpdateError } = await supabase
            .from('orders')
            .update({ image_paths: imagePaths })
            .eq('id', orderId)

          if (imageUpdateError) {
            logSupabaseError('Aviso Supabase orders image_paths update:', imageUpdateError)
          }
        }
      }

      router.push(`/pedidos/${orderId}`)
    } catch (err) {
      console.error('Erro geral ao salvar pedido:', err)
      const message = err instanceof Error ? err.message : 'Falha ao salvar pedido'
      setError(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-44 lg:pb-8">
      <div className="sticky top-0 z-10 border-b border-[rgba(26,10,8,0.07)] bg-white px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg p-2 transition-colors hover:bg-[#FAF6F0]"
            aria-label="Voltar"
          >
            <ArrowLeft size={24} className="text-[#1A0A08]" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">Pedidos</p>
            <h1 className="text-2xl font-bold text-[#1A0A08]">Novo pedido</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form id="order-form" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Informacoes da cliente</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Nome da cliente *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  list="customer-options"
                  value={form.customer_name}
                  onChange={handleInputChange}
                  placeholder="Ex: Ana Silva"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
                <datalist id="customer-options">
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.name} />
                  ))}
                </datalist>
                {selectedCustomerBalance > 0 && (
                  <p className="mt-2 rounded-lg bg-[#F4FBF6] px-3 py-2 text-sm font-semibold text-[#1F7A3A]">
                    Cliente tem {formatCurrency(selectedCustomerBalance)} de saldo disponivel.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">Telefone</label>
                <input
                  type="tel"
                  name="customer_phone"
                  value={form.customer_phone}
                  onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Endereço de entrega
                </label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleInputChange}
                  placeholder="Rua, numero, complemento"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Informacoes do pedido</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Nome do pedido
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleInputChange}
                  placeholder="Ex: Festa da Maria"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Data do pedido
                </label>
                <input
                  type="date"
                  name="order_date"
                  value={form.order_date}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Data da festa/evento *
                </label>
                <input
                  type="date"
                  name="delivery_date"
                  value={form.delivery_date}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Horario de entrega *
                </label>
                <input
                  type="time"
                  name="delivery_time"
                  value={form.delivery_time}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Descricao geral
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="Tema, preferencias, detalhes combinados..."
                  rows={3}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={recurring.enabled}
                onChange={(event) => toggleRecurring(event.target.checked)}
                className="h-5 w-5 rounded border-[rgba(26,10,8,0.18)] text-[#C0392B] focus:ring-[#C0392B]"
              />
              <span className="font-bold text-[#1A0A08]">Pedido recorrente / Mesversario</span>
            </label>

            {recurring.enabled && (
              <div className="mt-4 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Quantidade de meses/ocorrências
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="recurrence_count"
                      value={recurring.recurrence_count}
                      onChange={handleRecurringChange}
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Data da primeira entrega
                    </label>
                    <input
                      type="date"
                      name="first_occurrence_date"
                      value={recurring.first_occurrence_date}
                      onChange={handleRecurringChange}
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Frequencia
                    </label>
                    <select
                      name="recurrence_type"
                      value={recurring.recurrence_type}
                      onChange={handleRecurringChange}
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    >
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Tema geral
                    </label>
                    <input
                      type="text"
                      name="theme"
                      value={recurring.theme}
                      onChange={handleRecurringChange}
                      placeholder="Ex: Safari, jardim, arco-iris..."
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Observacoes da recorrencia
                    </label>
                    <textarea
                      name="notes"
                      value={recurring.notes}
                      onChange={handleRecurringChange}
                      rows={3}
                      placeholder="Detalhes combinados para todas as entregas mensais"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-[#1A0A08]">Itens do pedido</h2>
                <p className="mt-1 text-sm text-[#999999]">
                  Escolha produtos cadastrados, quantidades, precos e sabores.
                </p>
              </div>
              <button
                type="button"
                onClick={addOrderItem}
                disabled={isLoadingData || recipes.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Adicionar produto</span>
              </button>
            </div>

            {isLoadingData ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Carregando produtos...
              </div>
            ) : recipes.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                Nenhum produto cadastrado. Cadastre receitas/produtos antes de criar pedidos.
              </div>
            ) : orderItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-6 text-center text-sm text-[#999999]">
                Adicione o primeiro produto para calcular o total automaticamente.
              </div>
            ) : (
              <div className="space-y-4">
                {orderItems.map((item, index) => {
                  const subtotal = parseDecimal(item.quantity) * parseDecimal(item.unit_price)
                  const isKit = item.product_type === 'kit'

                  return (
                    <div
                      key={item.localId}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Package size={18} className="text-[#C9A84C]" aria-hidden="true" />
                          <p className="font-bold text-[#1A0A08]">Item {index + 1}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(item.localId)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-red-50 hover:text-[#C0392B]"
                          aria-label="Remover produto"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_110px_130px_140px] md:items-end">
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Produto
                          </label>
                          <select
                            value={item.recipe_id}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'recipe_id', event.target.value)
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          >
                            {recipes.map((recipe) => (
                              <option key={recipe.id} value={recipe.id}>
                                {recipe.name} {recipe.product_type === 'kit' ? '(kit)' : ''}
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
                              updateOrderItem(item.localId, 'quantity', event.target.value)
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                            Preco unitario
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.unit_price}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'unit_price', event.target.value)
                            }
                            className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                          />
                        </div>

                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-medium text-[#999999]">Subtotal</p>
                          <p className="mt-1 font-bold text-[#1A0A08]">
                            {formatCurrency(subtotal)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                          Observacoes do item
                        </label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(event) =>
                            updateOrderItem(item.localId, 'notes', event.target.value)
                          }
                          placeholder="Ex: sem granulado, entregar separado..."
                          className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-3 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]"
                        />
                      </div>

                      {!isKit && (
                        <div className="mt-4 rounded-lg bg-white p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-[#1A0A08]">Sabores/variacoes</p>
                            <button
                              type="button"
                              onClick={() => addFlavor(item.localId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
                            >
                              <Plus size={15} aria-hidden="true" />
                              <span>Adicionar sabor</span>
                            </button>
                          </div>

                          {item.flavors.length === 0 ? (
                            <p className="text-sm text-[#999999]">Nenhum sabor informado.</p>
                          ) : (
                            <div className="space-y-2">
                              {item.flavors.map((flavor) => (
                                <div
                                  key={flavor.localId}
                                  className="grid grid-cols-[minmax(0,1fr)_110px_40px] gap-2"
                                >
                                  <input
                                    type="text"
                                    value={flavor.name}
                                    onChange={(event) =>
                                      updateFlavor(
                                        item.localId,
                                        flavor.localId,
                                        'name',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Sabor"
                                    className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={flavor.quantity}
                                    onChange={(event) =>
                                      updateFlavor(
                                        item.localId,
                                        flavor.localId,
                                        'quantity',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Qtd."
                                    className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeFlavor(item.localId, flavor.localId)}
                                    className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                    aria-label="Remover sabor"
                                  >
                                    <Trash2 size={16} aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {isKit && (
                        <div className="mt-4 space-y-3 rounded-lg bg-white p-3">
                          <p className="text-sm font-bold text-[#1A0A08]">Distribuicao do kit</p>
                          {item.kit_subitems.length === 0 &&
                          item.kit_category_subitems.length === 0 &&
                          item.kit_flexible_groups.length === 0 ? (
                            <p className="text-sm text-[#999999]">
                              Este kit não tem composição cadastrada.
                            </p>
                          ) : (
                            <>
                              {item.kit_subitems.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-xs font-semibold text-[#999999]">
                                    Produtos fixos
                                  </p>
                                  {item.kit_subitems.map((subItem) => (
                                    <div
                                      key={subItem.localId}
                                      className="rounded-lg border border-[rgba(26,10,8,0.07)] p-3"
                                    >
                                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <p className="font-semibold text-[#1A0A08]">
                                            {subItem.item_name}
                                          </p>
                                          <p className="text-xs text-[#999999]">
                                            Quantidade do kit: {subItem.quantity}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addSubItemFlavor(item.localId, subItem.localId)
                                          }
                                          className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
                                        >
                                          <Plus size={15} aria-hidden="true" />
                                          <span>Adicionar sabor</span>
                                        </button>
                                      </div>

                                      {subItem.flavors.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                          {subItem.flavors.map((flavor) => (
                                            <div
                                              key={flavor.localId}
                                              className="grid grid-cols-[minmax(0,1fr)_110px_40px] gap-2"
                                            >
                                              <input
                                                type="text"
                                                value={flavor.name}
                                                onChange={(event) =>
                                                  updateSubItemFlavor(
                                                    item.localId,
                                                    subItem.localId,
                                                    flavor.localId,
                                                    'name',
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Sabor"
                                                className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                              />
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={flavor.quantity}
                                                onChange={(event) =>
                                                  updateSubItemFlavor(
                                                    item.localId,
                                                    subItem.localId,
                                                    flavor.localId,
                                                    'quantity',
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Qtd."
                                                className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeSubItemFlavor(
                                                    item.localId,
                                                    subItem.localId,
                                                    flavor.localId
                                                  )
                                                }
                                                className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                                aria-label="Remover sabor do subitem"
                                              >
                                                <Trash2 size={16} aria-hidden="true" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {item.kit_category_subitems.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-xs font-semibold text-[#999999]">
                                    Categorias escolhidas no pedido
                                  </p>
                                  {item.kit_category_subitems.map((component) => {
                                    const categoryProducts = getCategoryProducts(
                                      component.category
                                    )
                                    const requiredQuantity = parseDecimal(
                                      component.required_quantity
                                    )
                                    const chosenQuantity =
                                      calculateCategoryChosenQuantity(component)

                                    return (
                                      <div
                                        key={component.localId}
                                        className="rounded-lg border border-[rgba(26,10,8,0.07)] p-3"
                                      >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                          <div>
                                            <p className="font-semibold text-[#1A0A08]">
                                              {component.category}
                                            </p>
                                            <p className="text-xs text-[#999999]">
                                              Escolhido {formatNumber(chosenQuantity)} /{' '}
                                              {formatNumber(requiredQuantity)}
                                            </p>
                                            {component.notes && (
                                              <p className="mt-1 text-xs text-[#999999]">
                                                {component.notes}
                                              </p>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              addCategoryChoice(item.localId, component.localId)
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
                                          >
                                            <Plus size={15} aria-hidden="true" />
                                            <span>Adicionar produto desta categoria</span>
                                          </button>
                                        </div>

                                        {component.choices.length === 0 ? (
                                          <p className="mt-3 text-sm text-[#999999]">
                                            Nenhum produto escolhido.
                                          </p>
                                        ) : (
                                          <div className="mt-3 space-y-3">
                                            {component.choices.map((choice) => (
                                              <div
                                                key={choice.localId}
                                                className="rounded-lg bg-[#FAF6F0] p-3"
                                              >
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_110px_40px]">
                                                  <select
                                                    value={choice.recipe_id}
                                                    onChange={(event) =>
                                                      updateCategoryChoice(
                                                        item.localId,
                                                        component.localId,
                                                        choice.localId,
                                                        'recipe_id',
                                                        event.target.value
                                                      )
                                                    }
                                                    className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                  >
                                                    {categoryProducts.map((recipe) => (
                                                      <option key={recipe.id} value={recipe.id}>
                                                        {recipe.name}
                                                      </option>
                                                    ))}
                                                  </select>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={choice.quantity}
                                                    onChange={(event) =>
                                                      updateCategoryChoice(
                                                        item.localId,
                                                        component.localId,
                                                        choice.localId,
                                                        'quantity',
                                                        event.target.value
                                                      )
                                                    }
                                                    placeholder="Qtd."
                                                    className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      removeCategoryChoice(
                                                        item.localId,
                                                        component.localId,
                                                        choice.localId
                                                      )
                                                    }
                                                    className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                                    aria-label="Remover produto da categoria"
                                                  >
                                                    <Trash2 size={16} aria-hidden="true" />
                                                  </button>
                                                </div>

                                                <input
                                                  type="text"
                                                  value={choice.notes}
                                                  onChange={(event) =>
                                                    updateCategoryChoice(
                                                      item.localId,
                                                      component.localId,
                                                      choice.localId,
                                                      'notes',
                                                      event.target.value
                                                    )
                                                  }
                                                  placeholder="Observacoes deste produto"
                                                  className="mt-2 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                />

                                                <div className="mt-3">
                                                  <div className="mb-2 flex items-center justify-between gap-2">
                                                    <p className="text-xs font-semibold text-[#1A0A08]">
                                                      Sabores/variacoes
                                                    </p>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        addCategoryChoiceFlavor(
                                                          item.localId,
                                                          component.localId,
                                                          choice.localId
                                                        )
                                                      }
                                                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#C0392B]"
                                                    >
                                                      <Plus size={13} aria-hidden="true" />
                                                      <span>Adicionar sabor</span>
                                                    </button>
                                                  </div>

                                                  {choice.flavors.length > 0 && (
                                                    <div className="space-y-2">
                                                      {choice.flavors.map((flavor) => (
                                                        <div
                                                          key={flavor.localId}
                                                          className="grid grid-cols-[minmax(0,1fr)_110px_40px] gap-2"
                                                        >
                                                          <input
                                                            type="text"
                                                            value={flavor.name}
                                                            onChange={(event) =>
                                                              updateCategoryChoiceFlavor(
                                                                item.localId,
                                                                component.localId,
                                                                choice.localId,
                                                                flavor.localId,
                                                                'name',
                                                                event.target.value
                                                              )
                                                            }
                                                            placeholder="Sabor"
                                                            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                          />
                                                          <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={flavor.quantity}
                                                            onChange={(event) =>
                                                              updateCategoryChoiceFlavor(
                                                                item.localId,
                                                                component.localId,
                                                                choice.localId,
                                                                flavor.localId,
                                                                'quantity',
                                                                event.target.value
                                                              )
                                                            }
                                                            placeholder="Qtd."
                                                            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              removeCategoryChoiceFlavor(
                                                                item.localId,
                                                                component.localId,
                                                                choice.localId,
                                                                flavor.localId
                                                              )
                                                            }
                                                            className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                                            aria-label="Remover sabor da categoria"
                                                          >
                                                            <Trash2 size={16} aria-hidden="true" />
                                                          </button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {item.kit_flexible_groups.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-xs font-semibold text-[#999999]">
                                    Grupos flexiveis
                                  </p>
                                  {item.kit_flexible_groups.map((group) => {
                                    const totalQuantity = parseDecimal(group.total_quantity)
                                    const distributedQuantity =
                                      calculateFlexibleGroupDistributedQuantity(group)
                                    const hasInvalidDistribution =
                                      Math.abs(distributedQuantity - totalQuantity) > 0.001

                                    return (
                                      <div
                                        key={group.localId}
                                        className="rounded-lg border border-[rgba(26,10,8,0.07)] p-3"
                                      >
                                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                          <div>
                                            <p className="font-semibold text-[#1A0A08]">
                                              {group.name}
                                            </p>
                                            <p
                                              className={`text-xs font-semibold ${
                                                hasInvalidDistribution
                                                  ? 'text-[#C0392B]'
                                                  : 'text-[#999999]'
                                              }`}
                                            >
                                              Distribuido {formatNumber(distributedQuantity)} /{' '}
                                              {formatNumber(totalQuantity)}
                                            </p>
                                            {group.notes && (
                                              <p className="mt-1 text-xs text-[#999999]">
                                                {group.notes}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-3">
                                          {group.categories.map((category) => {
                                            const categoryProducts = getCategoryProducts(
                                              category.category
                                            )
                                            const distributedCategoryQuantity = parseDecimal(
                                              category.distributed_quantity
                                            )
                                            const chosenCategoryQuantity =
                                              calculateFlexibleCategoryChosenQuantity(category)
                                            const hasInvalidCategoryTotal =
                                              Math.abs(
                                                chosenCategoryQuantity -
                                                  distributedCategoryQuantity
                                              ) > 0.001

                                            return (
                                              <div
                                                key={category.localId}
                                                className="rounded-lg bg-[#FAF6F0] p-3"
                                              >
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_130px_170px] md:items-end">
                                                  <div>
                                                    <p className="text-sm font-semibold text-[#1A0A08]">
                                                      {category.category}
                                                    </p>
                                                    <p
                                                      className={`mt-1 text-xs font-semibold ${
                                                        hasInvalidCategoryTotal
                                                          ? 'text-[#C0392B]'
                                                          : 'text-[#999999]'
                                                      }`}
                                                    >
                                                      Produtos {formatNumber(
                                                        chosenCategoryQuantity
                                                      )}{' '}
                                                      /{' '}
                                                      {formatNumber(distributedCategoryQuantity)}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <label className="mb-2 block text-xs font-semibold text-[#1A0A08]">
                                                      Quantidade
                                                    </label>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      value={category.distributed_quantity}
                                                      onChange={(event) =>
                                                        updateFlexibleGroupCategoryQuantity(
                                                          item.localId,
                                                          group.localId,
                                                          category.localId,
                                                          event.target.value
                                                        )
                                                      }
                                                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                    />
                                                  </div>

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      addFlexibleCategoryChoice(
                                                        item.localId,
                                                        group.localId,
                                                        category.localId
                                                      )
                                                    }
                                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#C0392B]"
                                                  >
                                                    <Plus size={15} aria-hidden="true" />
                                                    <span>Adicionar produto</span>
                                                  </button>
                                                </div>

                                                {categoryProducts.length === 0 && (
                                                  <p className="mt-3 text-sm text-[#C0392B]">
                                                    Nenhum produto cadastrado nesta categoria.
                                                  </p>
                                                )}

                                                {category.choices.length === 0 ? (
                                                  <p className="mt-3 text-sm text-[#999999]">
                                                    Nenhum produto escolhido.
                                                  </p>
                                                ) : (
                                                  <div className="mt-3 space-y-3">
                                                    {category.choices.map((choice) => (
                                                      <div
                                                        key={choice.localId}
                                                        className="rounded-lg bg-white p-3"
                                                      >
                                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_110px_40px]">
                                                          <select
                                                            value={choice.recipe_id}
                                                            onChange={(event) =>
                                                              updateFlexibleCategoryChoice(
                                                                item.localId,
                                                                group.localId,
                                                                category.localId,
                                                                choice.localId,
                                                                'recipe_id',
                                                                event.target.value
                                                              )
                                                            }
                                                            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                          >
                                                            {categoryProducts.map((recipe) => (
                                                              <option
                                                                key={recipe.id}
                                                                value={recipe.id}
                                                              >
                                                                {recipe.name}
                                                              </option>
                                                            ))}
                                                          </select>
                                                          <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={choice.quantity}
                                                            onChange={(event) =>
                                                              updateFlexibleCategoryChoice(
                                                                item.localId,
                                                                group.localId,
                                                                category.localId,
                                                                choice.localId,
                                                                'quantity',
                                                                event.target.value
                                                              )
                                                            }
                                                            placeholder="Qtd."
                                                            className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              removeFlexibleCategoryChoice(
                                                                item.localId,
                                                                group.localId,
                                                                category.localId,
                                                                choice.localId
                                                              )
                                                            }
                                                            className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                                            aria-label="Remover produto do grupo flexivel"
                                                          >
                                                            <Trash2
                                                              size={16}
                                                              aria-hidden="true"
                                                            />
                                                          </button>
                                                        </div>

                                                        <input
                                                          type="text"
                                                          value={choice.notes}
                                                          onChange={(event) =>
                                                            updateFlexibleCategoryChoice(
                                                              item.localId,
                                                              group.localId,
                                                              category.localId,
                                                              choice.localId,
                                                              'notes',
                                                              event.target.value
                                                            )
                                                          }
                                                          placeholder="Observacoes deste produto"
                                                          className="mt-2 w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                        />

                                                        <div className="mt-3">
                                                          <div className="mb-2 flex items-center justify-between gap-2">
                                                            <p className="text-xs font-semibold text-[#1A0A08]">
                                                              Sabores/variacoes
                                                            </p>
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                addFlexibleCategoryChoiceFlavor(
                                                                  item.localId,
                                                                  group.localId,
                                                                  category.localId,
                                                                  choice.localId
                                                                )
                                                              }
                                                              className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-2 py-1 text-xs font-semibold text-[#C0392B]"
                                                            >
                                                              <Plus size={13} aria-hidden="true" />
                                                              <span>Adicionar sabor</span>
                                                            </button>
                                                          </div>

                                                          {choice.flavors.length > 0 && (
                                                            <div className="space-y-2">
                                                              {choice.flavors.map((flavor) => (
                                                                <div
                                                                  key={flavor.localId}
                                                                  className="grid grid-cols-[minmax(0,1fr)_110px_40px] gap-2"
                                                                >
                                                                  <input
                                                                    type="text"
                                                                    value={flavor.name}
                                                                    onChange={(event) =>
                                                                      updateFlexibleCategoryChoiceFlavor(
                                                                        item.localId,
                                                                        group.localId,
                                                                        category.localId,
                                                                        choice.localId,
                                                                        flavor.localId,
                                                                        'name',
                                                                        event.target.value
                                                                      )
                                                                    }
                                                                    placeholder="Sabor"
                                                                    className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                                  />
                                                                  <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={flavor.quantity}
                                                                    onChange={(event) =>
                                                                      updateFlexibleCategoryChoiceFlavor(
                                                                        item.localId,
                                                                        group.localId,
                                                                        category.localId,
                                                                        choice.localId,
                                                                        flavor.localId,
                                                                        'quantity',
                                                                        event.target.value
                                                                      )
                                                                    }
                                                                    placeholder="Qtd."
                                                                    className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                                                                  />
                                                                  <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                      removeFlexibleCategoryChoiceFlavor(
                                                                        item.localId,
                                                                        group.localId,
                                                                        category.localId,
                                                                        choice.localId,
                                                                        flavor.localId
                                                                      )
                                                                    }
                                                                    className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                                                    aria-label="Remover sabor do grupo flexivel"
                                                                  >
                                                                    <Trash2
                                                                      size={16}
                                                                      aria-hidden="true"
                                                                    />
                                                                  </button>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Tipo de atendimento</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setForm((currentForm) => ({ ...currentForm, fulfillment_type: 'retirada' }))
                }
                className={`rounded-lg px-4 py-3 font-medium transition-colors ${
                  form.fulfillment_type === 'retirada'
                    ? 'bg-[#C0392B] text-white'
                    : 'border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] text-[#1A0A08] hover:bg-white'
                }`}
              >
                Retirada
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((currentForm) => ({ ...currentForm, fulfillment_type: 'entrega' }))
                }
                className={`rounded-lg px-4 py-3 font-medium transition-colors ${
                  form.fulfillment_type === 'entrega'
                    ? 'bg-[#C0392B] text-white'
                    : 'border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] text-[#1A0A08] hover:bg-white'
                }`}
              >
                Entrega
              </button>
            </div>

            {form.fulfillment_type === 'entrega' && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Taxa de entrega
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="delivery_fee"
                  value={form.delivery_fee}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={cakeTopper.enabled}
                onChange={(event) =>
                  setCakeTopper((currentCakeTopper) => ({
                    ...currentCakeTopper,
                    enabled: event.target.checked,
                  }))
                }
                className="h-5 w-5 rounded border-[rgba(26,10,8,0.18)] text-[#C0392B] focus:ring-[#C0392B]"
              />
              <span className="font-bold text-[#1A0A08]">Topo de bolo</span>
            </label>

            {cakeTopper.enabled && (
              <div className="mt-4 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Fornecedor
                    </label>
                    <select
                      name="supplier_id"
                      value={cakeTopper.supplier_id}
                      onChange={handleCakeTopperChange}
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    >
                      <option value="">Sem fornecedor definido</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Nome
                    </label>
                    <input
                      type="text"
                      name="child_name"
                      value={cakeTopper.child_name}
                      onChange={handleCakeTopperChange}
                      placeholder="Nome para o topo"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Idade
                    </label>
                    <input
                      type="text"
                      name="age"
                      value={cakeTopper.age}
                      onChange={handleCakeTopperChange}
                      placeholder="Ex: 5 anos"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Tema
                    </label>
                    <input
                      type="text"
                      name="theme"
                      value={cakeTopper.theme}
                      onChange={handleCakeTopperChange}
                      placeholder="Tema do topo"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Foto do topo
                    </label>
                    <ImageUpload
                      value={cakeTopper.photo_url}
                      onUpload={(url) => setCakeTopper((prev) => ({ ...prev, photo_url: url }))}
                      onRemove={() => setCakeTopper((prev) => ({ ...prev, photo_url: '' }))}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Custo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="cost"
                      value={cakeTopper.cost}
                      onChange={handleCakeTopperChange}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Valor cobrado
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="charged_amount"
                      value={cakeTopper.charged_amount}
                      onChange={handleCakeTopperChange}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                      Observacoes
                    </label>
                    <textarea
                      name="notes"
                      value={cakeTopper.notes}
                      onChange={handleCakeTopperChange}
                      rows={3}
                      placeholder="Detalhes combinados com cliente ou fornecedor"
                      className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-[#1A0A08]">Acréscimos</h2>
              <button
                type="button"
                onClick={addOrderExtra}
                className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Adicionar</span>
              </button>
            </div>

            {orderExtras.length === 0 ? (
              <p className="text-sm text-[#999999]">Sem acréscimos adicionados.</p>
            ) : (
              <div className="space-y-3">
                {orderExtras.map((extra) => (
                  <div
                    key={extra.localId}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-3 md:grid-cols-[minmax(0,1fr)_120px_40px]"
                  >
                    <input
                      type="text"
                      value={extra.name}
                      onChange={(event) =>
                        updateOrderExtra(extra.localId, 'name', event.target.value)
                      }
                      placeholder="Ex: glitter, pó decorativo..."
                      className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={extra.amount}
                      onChange={(event) =>
                        updateOrderExtra(extra.localId, 'amount', event.target.value)
                      }
                      placeholder="0.00"
                      className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                    />
                    <button
                      type="button"
                      onClick={() => removeOrderExtra(extra.localId)}
                      className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                      aria-label="Remover acrescimo"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                    {extra.notes !== undefined && (
                      <input
                        type="text"
                        value={extra.notes || ''}
                        onChange={(event) =>
                          updateOrderExtra(extra.localId, 'notes', event.target.value)
                        }
                        placeholder="Observacoes (opcional)"
                        className="col-span-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] outline-none focus:ring-2 focus:ring-[#C0392B]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Valores e calculo</h2>
            <div className="space-y-4">
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Subtotal dos itens</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">{formatCurrency(subtotalItems)}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                    Desconto
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="discount_amount"
                    value={form.discount_amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                  />
                </div>

                {form.fulfillment_type === 'entrega' && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-[#1A0A08]">Taxa de entrega</p>
                    <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08]">
                      {formatCurrency(deliveryFee)}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-[#1A0A08]">Acréscimos</p>
                  <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08]">
                    {formatCurrency(extrasTotal)}
                  </div>
                </div>

                {cakeTopper.enabled && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-[#1A0A08]">Topo de bolo</p>
                    <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08]">
                      {formatCurrency(cakeTopperChargedAmount)}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#C9A84C] bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Total calculado</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">{formatCurrency(totalCalculated)}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Total final manual (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="manual_total"
                  value={form.manual_total}
                  onChange={handleInputChange}
                  placeholder={`Deixar vazio para usar ${formatCurrency(totalCalculated)}`}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
                <p className="mt-1 text-xs text-[#999999]">
                  Se preenchido, sobrescreve o total calculado
                </p>
              </div>

              <div className="rounded-lg border border-[#27AE60] bg-white p-4">
                <p className="text-sm text-[#999999]">Total final do pedido</p>
                <p className="mt-1 text-3xl font-bold text-[#1A0A08]">{formatCurrency(finalTotal)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Sinal e formas de pagamento</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Valor do sinal
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="down_payment"
                  value={form.down_payment}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Valor restante</p>
                <p className="mt-1 text-xl font-bold text-[#1A0A08]">
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Forma de pagamento do sinal
                </label>
                <select
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Data de recebimento do sinal
                </label>
                <input
                  type="date"
                  name="deposit_payment_date"
                  value={form.deposit_payment_date}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Forma de pagamento do restante
                </label>
                <select
                  name="remaining_payment_method"
                  value={form.remaining_payment_method}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Data de recebimento do restante
                </label>
                <input
                  type="date"
                  name="remaining_payment_date"
                  value={form.remaining_payment_date}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Status inicial</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {statusOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((currentForm) => ({ ...currentForm, status: option.id }))}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    form.status === option.id
                      ? 'bg-[#C0392B] text-white'
                      : 'border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] text-[#1A0A08] hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <h2 className="mb-4 font-bold text-[#1A0A08]">Fotos de referencia</h2>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[rgba(26,10,8,0.2)] p-6 transition-colors hover:bg-[#FAF6F0]">
              <div className="text-center">
                <Upload size={24} className="mx-auto mb-2 text-[#C0392B]" aria-hidden="true" />
                <p className="text-sm font-medium text-[#1A0A08]">Clique para enviar fotos</p>
                <p className="text-xs text-[#999999]">ou arraste aqui</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {images.length > 0 && (
              <div className="mt-4 space-y-2">
                {images.map((image, index) => (
                  <div
                    key={`${image.name}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-[#FAF6F0] p-3"
                  >
                    <p className="truncate text-sm text-[#1A0A08]">{image.name}</p>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="rounded p-1 text-[#999999] transition-colors hover:bg-white hover:text-[#C0392B]"
                      aria-label="Remover foto"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6">
            <label className="mb-2 block text-sm font-medium text-[#1A0A08]">Observações</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleInputChange}
              placeholder="Anotacoes adicionais..."
              rows={4}
              className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
            />
          </section>

          <div className="-mx-4 -mb-8 flex gap-3 border-t border-[rgba(26,10,8,0.07)] bg-white p-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-[rgba(26,10,8,0.07)] px-4 py-2 font-medium text-[#1A0A08] transition-colors hover:bg-[#FAF6F0]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2 font-medium text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={18} aria-hidden="true" />
              <span>{isSubmitting ? 'Salvando...' : 'Criar pedido'}</span>
            </button>
          </div>
        </form>
      </main>

      <div className="fixed bottom-20 left-0 right-0 z-20 border-t border-[rgba(26,10,8,0.07)] bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(26,10,8,0.12)] lg:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#999999]">Total</p>
            <p className="truncate text-xl font-bold text-[#1A0A08]">{formatCurrency(finalTotal)}</p>
          </div>
          <button
            type="submit"
            form="order-form"
            disabled={isSubmitting}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} aria-hidden="true" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar pedido'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
