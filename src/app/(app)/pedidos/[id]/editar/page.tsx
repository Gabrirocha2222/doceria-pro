'use client'

import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Package, Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ImageUpload } from '@/components/ui/ImageUpload'
import {
  createLocalId,
  formatCurrency,
  formatNumber,
  optionalMoney,
  optionalText,
  parseDecimal,
  parseNumericValue,
  toInputValue,
} from '@/lib/format'

type NumericValue = number | string | null | undefined
type ProductType = 'simples' | 'kit'
type FulfillmentType = 'retirada' | 'entrega'

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

type CustomerOption = {
  id: string
  name: string
  phone: string | null
  balance?: NumericValue
}

type Supplier = {
  id: string
  name: string
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

type KitSubItem = {
  localId: string
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
  category: string
  required_quantity: string
  notes: string
  choices: KitCategoryChoice[]
}

type KitFlexibleGroupCategorySelection = {
  localId: string
  category: string
  distributed_quantity: string
  default_quantity: string
  choices: KitCategoryChoice[]
}

type KitFlexibleGroupSelection = {
  localId: string
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

type OrderForm = {
  customer_name: string
  customer_phone: string
  product_name: string
  description: string
  order_date: string
  delivery_date: string
  delivery_time: string
  status: string
  payment_method: string
  remaining_payment_method: string
  deposit_payment_date: string
  remaining_payment_date: string
  address: string
  notes: string
  fulfillment_type: FulfillmentType
  delivery_fee: string
  down_payment: string
  discount_amount: string
  manual_total: string
}

type OrderRow = {
  id: string
  customer_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  product_name?: string | null
  description?: string | null
  order_date?: string | null
  delivery_date?: string | null
  delivery_time?: string | null
  total_value?: NumericValue
  deposit_value?: NumericValue
  down_payment?: NumericValue
  remaining_amount?: NumericValue
  remaining_value?: NumericValue
  status?: string | null
  payment_method?: string | null
  remaining_payment_method?: string | null
  deposit_payment_date?: string | null
  remaining_payment_date?: string | null
  address?: string | null
  delivery_address?: string | null
  notes?: string | null
  fulfillment_type?: string | null
  delivery_fee?: NumericValue
  discount_amount?: NumericValue
  extras_total?: NumericValue
  manual_total?: NumericValue
  customers?: CustomerOption | CustomerOption[] | null
  order_items?: OrderItemRow[]
}

type OrderItemRow = {
  id: string
  recipe_id: string | null
  parent_order_item_id: string | null
  item_name: string | null
  quantity: NumericValue
  unit_price: NumericValue
  subtotal: NumericValue
  flavor_details: unknown
  notes: string | null
  created_at?: string | null
}

type OrderExtraRow = {
  id: string
  name: string
  amount: NumericValue
  notes: string | null
}

type OrderCakeTopperRow = {
  id: string
  supplier_id: string | null
  child_name: string | null
  age: string | null
  theme: string | null
  photo_url: string | null
  cost: NumericValue
  charged_amount: NumericValue
  notes: string | null
}

type OrderItemInsert = {
  user_id: string
  order_id: string
  recipe_id: string | null
  parent_order_item_id: string | null
  item_name: string
  quantity: number
  unit_price: number
  subtotal: number
  flavor_details: FlavorPayload | null
  notes: string | null
}

type CreatedRecord = {
  id: string
}

type OrderUpdatePayload = Record<string, string | number | boolean | null>

type KitMaps = {
  recipeById: Map<string, Recipe>
  kitItemsByKitId: Map<string, ProductKitItem[]>
  kitCategoryComponentsByKitId: Map<string, KitCategoryComponent[]>
  kitFlexibleGroupsByKitId: Map<string, KitFlexibleGroup[]>
  kitFlexibleGroupCategoriesByGroupId: Map<string, KitFlexibleGroupCategory[]>
}

type ParsedChildNotes = {
  category: string | null
  flexibleGroup: string | null
  notes: string
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

const initialCakeTopper: CakeTopperForm = {
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

const inputClass =
  'w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] outline-none transition focus:ring-2 focus:ring-[#C0392B]'
function optionalUuid(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}
function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.split('T')[0] ?? ''
}
function getEffectiveSalePrice(recipe: Recipe) {
  return parseNumericValue(recipe.sale_price ?? recipe.suggested_price)
}

function normalizeCostUnit(value: string | null) {
  return value === 'cento' || value === '100_unidades' ? 'cento' : 'unidade'
}

function calculateSupplierEstimatedCost(recipe: Recipe, quantity: number) {
  const supplierCost = parseNumericValue(recipe.supplier_cost)
  const supplierCostUnit = normalizeCostUnit(recipe.supplier_cost_unit)

  if (supplierCost <= 0) return null
  if (supplierCostUnit === 'cento') return (supplierCost / 100) * quantity

  return supplierCost * quantity
}

function logEditError(error: unknown) {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}

  console.error('Erro ao editar pedido:', {
    message: supabaseError.message,
    details: supabaseError.details,
    hint: supabaseError.hint,
    code: supabaseError.code,
    fullError: error,
  })
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function isMissingRelationError(error: unknown) {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}
  const message = supabaseError.message?.toLowerCase() ?? ''
  const code = supabaseError.code ?? ''

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

function isMissingColumnError(error: unknown) {
  const supabaseError =
    typeof error === 'object' && error !== null ? (error as SupabaseErrorLike) : {}
  const message = supabaseError.message?.toLowerCase() ?? ''

  return supabaseError.code === 'PGRST204' || message.includes('schema cache')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFlavorItems(value: unknown): FlavorItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((flavor) => {
      const name = typeof flavor.name === 'string' ? flavor.name : ''
      const quantity =
        typeof flavor.quantity === 'number' || typeof flavor.quantity === 'string'
          ? String(flavor.quantity)
          : ''

      return {
        localId: createLocalId(),
        name,
        quantity,
      }
    })
    .filter((flavor) => flavor.name.trim() || flavor.quantity.trim())
}

function buildFlavorPayload(flavors: FlavorItem[]): FlavorPayload | null {
  const payload = flavors
    .map((flavor) => ({
      name: flavor.name.trim(),
      quantity: parseDecimal(flavor.quantity),
    }))
    .filter((flavor) => flavor.name && flavor.quantity > 0)

  return payload.length > 0 ? payload : null
}

function parseChildNotes(notes: string | null): ParsedChildNotes {
  if (!notes) {
    return {
      category: null,
      flexibleGroup: null,
      notes: '',
    }
  }

  const lines = notes.split('\n')
  let category: string | null = null
  let flexibleGroup: string | null = null
  const remainingLines: string[] = []

  lines.forEach((line) => {
    const trimmedLine = line.trim()

    if (trimmedLine.toLowerCase().startsWith('categoria:')) {
      category = trimmedLine.replace(/^categoria:/i, '').trim() || null
      return
    }

    if (trimmedLine.toLowerCase().startsWith('grupo flexivel:')) {
      flexibleGroup = trimmedLine.replace(/^grupo flexivel:/i, '').trim() || null
      return
    }

    remainingLines.push(line)
  })

  return {
    category,
    flexibleGroup,
    notes: remainingLines.join('\n').trim(),
  }
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

function groupByKitId<T extends { kit_recipe_id: string }>(items: T[]) {
  const groupedItems = new Map<string, T[]>()

  items.forEach((item) => {
    const currentItems = groupedItems.get(item.kit_recipe_id) ?? []
    groupedItems.set(item.kit_recipe_id, [...currentItems, item])
  })

  return groupedItems
}

function groupFlexibleCategories(items: KitFlexibleGroupCategory[]) {
  const groupedItems = new Map<string, KitFlexibleGroupCategory[]>()

  items.forEach((item) => {
    const currentItems = groupedItems.get(item.flexible_group_id) ?? []
    groupedItems.set(item.flexible_group_id, [...currentItems, item])
  })

  return groupedItems
}

function buildDefaultKitSubItems(recipeId: string, maps: KitMaps): KitSubItem[] {
  const selectedKitItems = maps.kitItemsByKitId.get(recipeId) ?? []

  return selectedKitItems.map((kitItem) => {
    const recipe = maps.recipeById.get(kitItem.item_recipe_id)

    return {
      localId: createLocalId(),
      recipe_id: kitItem.item_recipe_id,
      item_name: recipe?.name ?? 'Item do kit',
      quantity: String(parseNumericValue(kitItem.quantity) || 1),
      notes: kitItem.notes ?? '',
      flavors: [],
    }
  })
}

function buildDefaultKitCategorySubItems(recipeId: string, maps: KitMaps): KitCategorySubItem[] {
  const selectedComponents = maps.kitCategoryComponentsByKitId.get(recipeId) ?? []

  return selectedComponents.map((component) => ({
    localId: createLocalId(),
    category: component.category,
    required_quantity: String(parseNumericValue(component.quantity) || 1),
    notes: component.notes ?? '',
    choices: [],
  }))
}

function buildDefaultKitFlexibleGroups(recipeId: string, maps: KitMaps): KitFlexibleGroupSelection[] {
  const selectedGroups = maps.kitFlexibleGroupsByKitId.get(recipeId) ?? []

  return selectedGroups.map((group) => {
    const categories = maps.kitFlexibleGroupCategoriesByGroupId.get(group.id) ?? []

    return {
      localId: createLocalId(),
      name: group.name,
      total_quantity: String(parseNumericValue(group.total_quantity)),
      notes: group.notes ?? '',
      categories: categories.map((category) => ({
        localId: createLocalId(),
        category: category.category,
        distributed_quantity: String(parseNumericValue(category.default_quantity)),
        default_quantity: String(parseNumericValue(category.default_quantity)),
        choices: [],
      })),
    }
  })
}

function buildOrderItem(recipe: Recipe, maps: KitMaps): OrderProductItem {
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
    kit_subitems: productType === 'kit' ? buildDefaultKitSubItems(recipe.id, maps) : [],
    kit_category_subitems:
      productType === 'kit' ? buildDefaultKitCategorySubItems(recipe.id, maps) : [],
    kit_flexible_groups: productType === 'kit' ? buildDefaultKitFlexibleGroups(recipe.id, maps) : [],
  }
}

function childQuantityForForm(childQuantity: NumericValue, parentQuantity: number) {
  const quantity = parseNumericValue(childQuantity)
  if (parentQuantity <= 0) return String(quantity)

  return String(quantity / parentQuantity)
}

function buildChoiceFromChild(child: OrderItemRow, parentQuantity: number): KitCategoryChoice {
  const parsedNotes = parseChildNotes(child.notes)

  return {
    localId: createLocalId(),
    recipe_id: child.recipe_id ?? '',
    item_name: child.item_name ?? 'Item do kit',
    quantity: childQuantityForForm(child.quantity, parentQuantity),
    notes: parsedNotes.notes,
    flavors: parseFlavorItems(child.flavor_details),
  }
}

function sumChoiceQuantities(choices: KitCategoryChoice[]) {
  return choices.reduce((sum, choice) => sum + parseDecimal(choice.quantity), 0)
}

function buildKitSubItemsFromRows(
  recipeId: string,
  children: OrderItemRow[],
  parentQuantity: number,
  maps: KitMaps
) {
  const fixedChildren = children.filter((child) => {
    const parsedNotes = parseChildNotes(child.notes)
    return !parsedNotes.category && !parsedNotes.flexibleGroup
  })

  if (fixedChildren.length === 0) return buildDefaultKitSubItems(recipeId, maps)

  return fixedChildren.map((child) => {
    const recipe = child.recipe_id ? maps.recipeById.get(child.recipe_id) : null

    return {
      localId: createLocalId(),
      recipe_id: child.recipe_id ?? '',
      item_name: child.item_name ?? recipe?.name ?? 'Item do kit',
      quantity: childQuantityForForm(child.quantity, parentQuantity),
      notes: child.notes ?? '',
      flavors: parseFlavorItems(child.flavor_details),
    }
  })
}

function buildKitCategorySubItemsFromRows(
  recipeId: string,
  children: OrderItemRow[],
  parentQuantity: number,
  maps: KitMaps
) {
  const choicesByCategory = new Map<string, KitCategoryChoice[]>()

  children.forEach((child) => {
    const parsedNotes = parseChildNotes(child.notes)
    if (!parsedNotes.category || parsedNotes.flexibleGroup) return

    const currentChoices = choicesByCategory.get(parsedNotes.category) ?? []
    choicesByCategory.set(parsedNotes.category, [
      ...currentChoices,
      buildChoiceFromChild(child, parentQuantity),
    ])
  })

  const defaultComponents = buildDefaultKitCategorySubItems(recipeId, maps)
  const usedCategories = new Set<string>()
  const components = defaultComponents.map((component) => {
    usedCategories.add(component.category)

    return {
      ...component,
      choices: choicesByCategory.get(component.category) ?? component.choices,
    }
  })

  choicesByCategory.forEach((choices, category) => {
    if (usedCategories.has(category)) return

    components.push({
      localId: createLocalId(),
      category,
      required_quantity: String(sumChoiceQuantities(choices)),
      notes: '',
      choices,
    })
  })

  return components
}

function buildKitFlexibleGroupsFromRows(
  recipeId: string,
  children: OrderItemRow[],
  parentQuantity: number,
  maps: KitMaps
) {
  const choicesByGroup = new Map<string, Map<string, KitCategoryChoice[]>>()

  children.forEach((child) => {
    const parsedNotes = parseChildNotes(child.notes)
    if (!parsedNotes.category || !parsedNotes.flexibleGroup) return

    const groupChoices = choicesByGroup.get(parsedNotes.flexibleGroup) ?? new Map()
    const categoryChoices = groupChoices.get(parsedNotes.category) ?? []
    groupChoices.set(parsedNotes.category, [
      ...categoryChoices,
      buildChoiceFromChild(child, parentQuantity),
    ])
    choicesByGroup.set(parsedNotes.flexibleGroup, groupChoices)
  })

  const defaultGroups = buildDefaultKitFlexibleGroups(recipeId, maps)
  const usedGroups = new Set<string>()

  const groups = defaultGroups.map((group) => {
    usedGroups.add(group.name)
    const currentGroupChoices = choicesByGroup.get(group.name) ?? new Map()
    const usedCategories = new Set<string>()

    const categories = group.categories.map((category) => {
      usedCategories.add(category.category)

      return {
        ...category,
        choices: currentGroupChoices.get(category.category) ?? category.choices,
      }
    })

    currentGroupChoices.forEach((choices, category) => {
      if (usedCategories.has(category)) return

      categories.push({
        localId: createLocalId(),
        category,
        distributed_quantity: String(sumChoiceQuantities(choices)),
        default_quantity: String(sumChoiceQuantities(choices)),
        choices,
      })
    })

    return {
      ...group,
      categories,
    }
  })

  choicesByGroup.forEach((categoryMap, groupName) => {
    if (usedGroups.has(groupName)) return

    const categories = Array.from(categoryMap.entries()).map(([category, choices]) => ({
      localId: createLocalId(),
      category,
      distributed_quantity: String(sumChoiceQuantities(choices)),
      default_quantity: String(sumChoiceQuantities(choices)),
      choices,
    }))

    groups.push({
      localId: createLocalId(),
      name: groupName,
      total_quantity: String(
        categories.reduce((sum, category) => sum + parseDecimal(category.distributed_quantity), 0)
      ),
      notes: '',
      categories,
    })
  })

  return groups
}

function buildOrderItemsFromRows(rows: OrderItemRow[], maps: KitMaps): OrderProductItem[] {
  const sortedRows = [...rows].sort((firstItem, secondItem) => {
    const firstDate = firstItem.created_at ? new Date(firstItem.created_at).getTime() : 0
    const secondDate = secondItem.created_at ? new Date(secondItem.created_at).getTime() : 0
    return firstDate - secondDate
  })
  const childrenByParentId = new Map<string, OrderItemRow[]>()

  sortedRows.forEach((item) => {
    if (!item.parent_order_item_id) return

    const currentItems = childrenByParentId.get(item.parent_order_item_id) ?? []
    childrenByParentId.set(item.parent_order_item_id, [...currentItems, item])
  })

  const mainRows = sortedRows.filter((item) => !item.parent_order_item_id)
  const rowsToMap = mainRows.length > 0 ? mainRows : sortedRows

  return rowsToMap.map((item) => {
    const childRows = childrenByParentId.get(item.id) ?? []
    const recipe = item.recipe_id ? maps.recipeById.get(item.recipe_id) : null
    const productType: ProductType =
      recipe?.product_type === 'kit' || childRows.length > 0 ? 'kit' : 'simples'
    const parentQuantity = parseNumericValue(item.quantity) || 1
    const recipeId = item.recipe_id ?? ''

    return {
      localId: createLocalId(),
      recipe_id: recipeId,
      item_name: item.item_name ?? recipe?.name ?? 'Produto',
      product_type: productType,
      quantity: String(parseNumericValue(item.quantity) || 1),
      unit_price: String(parseNumericValue(item.unit_price)),
      notes: item.notes ?? '',
      flavors: productType === 'simples' ? parseFlavorItems(item.flavor_details) : [],
      kit_subitems:
        productType === 'kit'
          ? buildKitSubItemsFromRows(recipeId, childRows, parentQuantity, maps)
          : [],
      kit_category_subitems:
        productType === 'kit'
          ? buildKitCategorySubItemsFromRows(recipeId, childRows, parentQuantity, maps)
          : [],
      kit_flexible_groups:
        productType === 'kit'
          ? buildKitFlexibleGroupsFromRows(recipeId, childRows, parentQuantity, maps)
          : [],
    }
  })
}

function getCustomer(order: OrderRow) {
  if (Array.isArray(order.customers)) return order.customers[0] ?? null
  return order.customers ?? null
}

function buildFormFromOrder(order: OrderRow, orderItems: OrderProductItem[]): OrderForm {
  const customer = getCustomer(order)
  const hasStructuredItems = orderItems.length > 0
  const manualTotal =
    order.manual_total !== null && order.manual_total !== undefined
      ? toInputValue(order.manual_total)
      : hasStructuredItems
        ? ''
        : toInputValue(order.total_value)

  return {
    customer_name: customer?.name ?? order.customer_name ?? '',
    customer_phone: customer?.phone ?? order.customer_phone ?? '',
    product_name: order.product_name ?? orderItems[0]?.item_name ?? '',
    description: order.description ?? '',
    order_date: toDateInput(order.order_date) || new Date().toISOString().split('T')[0],
    delivery_date: toDateInput(order.delivery_date),
    delivery_time: order.delivery_time ?? '',
    status: order.status ?? 'novo',
    payment_method: order.payment_method ?? 'pix',
    remaining_payment_method: order.remaining_payment_method ?? 'pix',
    deposit_payment_date: toDateInput(order.deposit_payment_date),
    remaining_payment_date: toDateInput(order.remaining_payment_date),
    address: order.delivery_address ?? order.address ?? '',
    notes: order.notes ?? '',
    fulfillment_type: order.fulfillment_type === 'entrega' ? 'entrega' : 'retirada',
    delivery_fee: toInputValue(order.delivery_fee ?? 0),
    down_payment: toInputValue(order.down_payment ?? order.deposit_value ?? 0),
    discount_amount: toInputValue(order.discount_amount ?? 0),
    manual_total: manualTotal,
  }
}

function buildCakeTopperForm(rows: OrderCakeTopperRow[]): CakeTopperForm {
  const cakeTopper = rows[0]
  if (!cakeTopper) return initialCakeTopper

  return {
    enabled: true,
    supplier_id: cakeTopper.supplier_id ?? '',
    child_name: cakeTopper.child_name ?? '',
    age: cakeTopper.age ?? '',
    theme: cakeTopper.theme ?? '',
    photo_url: cakeTopper.photo_url ?? '',
    cost: toInputValue(cakeTopper.cost),
    charged_amount: toInputValue(cakeTopper.charged_amount),
    notes: cakeTopper.notes ?? '',
  }
}

function buildOrderExtras(rows: OrderExtraRow[]): OrderExtra[] {
  return rows.map((extra) => ({
    localId: createLocalId(),
    name: extra.name,
    amount: toInputValue(extra.amount),
    notes: extra.notes ?? '',
  }))
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 font-bold text-[#1A0A08]">{title}</h2>
      {children}
    </section>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-[#1A0A08]">{children}</label>
}

export default function EditarPedidoPage() {
  const [form, setForm] = useState<OrderForm>(initialForm)
  const [cakeTopper, setCakeTopper] = useState<CakeTopperForm>(initialCakeTopper)
  const [orderItems, setOrderItems] = useState<OrderProductItem[]>([])
  const [orderExtras, setOrderExtras] = useState<OrderExtra[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [kitItems, setKitItems] = useState<ProductKitItem[]>([])
  const [kitCategoryComponents, setKitCategoryComponents] = useState<KitCategoryComponent[]>([])
  const [kitFlexibleGroups, setKitFlexibleGroups] = useState<KitFlexibleGroup[]>([])
  const [kitFlexibleGroupCategories, setKitFlexibleGroupCategories] = useState<
    KitFlexibleGroupCategory[]
  >([])
  const [hasOrderExtrasTable, setHasOrderExtrasTable] = useState(true)
  const [hasCakeTopperTable, setHasCakeTopperTable] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const orderId = params.id as string

  const recipeById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]))
  }, [recipes])

  const kitItemsByKitId = useMemo(() => groupByKitId(kitItems), [kitItems])
  const kitCategoryComponentsByKitId = useMemo(
    () => groupByKitId(kitCategoryComponents),
    [kitCategoryComponents]
  )
  const kitFlexibleGroupsByKitId = useMemo(
    () => groupByKitId(kitFlexibleGroups),
    [kitFlexibleGroups]
  )
  const kitFlexibleGroupCategoriesByGroupId = useMemo(
    () => groupFlexibleCategories(kitFlexibleGroupCategories),
    [kitFlexibleGroupCategories]
  )

  const kitMaps = useMemo<KitMaps>(
    () => ({
      recipeById,
      kitItemsByKitId,
      kitCategoryComponentsByKitId,
      kitFlexibleGroupsByKitId,
      kitFlexibleGroupCategoriesByGroupId,
    }),
    [
      recipeById,
      kitItemsByKitId,
      kitCategoryComponentsByKitId,
      kitFlexibleGroupsByKitId,
      kitFlexibleGroupCategoriesByGroupId,
    ]
  )

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

  const subtotalItems = useMemo(() => {
    return orderItems.reduce(
      (sum, item) => sum + parseDecimal(item.quantity) * parseDecimal(item.unit_price),
      0
    )
  }, [orderItems])

  const deliveryFee = form.fulfillment_type === 'entrega' ? parseDecimal(form.delivery_fee) : 0
  const extrasTotal = hasOrderExtrasTable
    ? orderExtras.reduce((sum, extra) => sum + parseDecimal(extra.amount), 0)
    : 0
  const cakeTopperChargedAmount =
    hasCakeTopperTable && cakeTopper.enabled ? parseDecimal(cakeTopper.charged_amount) : 0
  const discount = parseDecimal(form.discount_amount)
  const totalCalculated =
    subtotalItems + deliveryFee + extrasTotal + cakeTopperChargedAmount - discount
  const finalTotal = form.manual_total.trim() ? parseDecimal(form.manual_total) : totalCalculated
  const downPayment = parseDecimal(form.down_payment)
  const remainingAmount = Math.max(finalTotal - downPayment, 0)

  useEffect(() => {
    let isMounted = true

    async function loadOrderForEdit() {
      setIsLoading(true)
      setError('')
      setNotFound(false)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Usuária não autenticada. Faça login para continuar.')
        }

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(
            `
            *,
            customers (
              id,
              name,
              phone,
              balance
            ),
            order_items (
              id,
              recipe_id,
              parent_order_item_id,
              item_name,
              quantity,
              unit_price,
              subtotal,
              flavor_details,
              notes,
              created_at
            )
          `
          )
          .eq('id', orderId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (orderError) {
          logEditError(orderError)
          throw orderError
        }

        if (!orderData) {
          if (isMounted) setNotFound(true)
          return
        }

        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select(
            'id, name, category, product_type, is_third_party, supplier_id, sale_price, suggested_price, supplier_cost, supplier_cost_unit'
          )
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (recipesError) {
          logEditError(recipesError)
          throw recipesError
        }

        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, name, phone, balance')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (customersError) {
          logEditError(customersError)
          throw customersError
        }

        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (suppliersError) {
          logEditError(suppliersError)
          throw suppliersError
        }

        const { data: kitItemsData, error: kitItemsError } = await supabase
          .from('product_kit_items')
          .select('id, kit_recipe_id, item_recipe_id, quantity, notes')
          .eq('user_id', user.id)

        if (kitItemsError) {
          logEditError(kitItemsError)
          throw kitItemsError
        }

        let loadedKitCategoryComponents: KitCategoryComponent[] = []
        const { data: kitCategoryComponentsData, error: kitCategoryComponentsError } =
          await supabase
            .from('kit_category_components')
            .select('id, kit_recipe_id, category, quantity, notes')
            .eq('user_id', user.id)

        if (kitCategoryComponentsError) {
          if (!isMissingRelationError(kitCategoryComponentsError)) {
            logEditError(kitCategoryComponentsError)
            throw kitCategoryComponentsError
          }
        } else {
          loadedKitCategoryComponents =
            (kitCategoryComponentsData ?? []) as KitCategoryComponent[]
        }

        let loadedKitFlexibleGroups: KitFlexibleGroup[] = []
        const { data: kitFlexibleGroupsData, error: kitFlexibleGroupsError } = await supabase
          .from('kit_flexible_groups')
          .select('id, kit_recipe_id, name, total_quantity, notes')
          .eq('user_id', user.id)

        if (kitFlexibleGroupsError) {
          if (!isMissingRelationError(kitFlexibleGroupsError)) {
            logEditError(kitFlexibleGroupsError)
            throw kitFlexibleGroupsError
          }
        } else {
          loadedKitFlexibleGroups = (kitFlexibleGroupsData ?? []) as KitFlexibleGroup[]
        }

        let loadedKitFlexibleGroupCategories: KitFlexibleGroupCategory[] = []
        const { data: kitFlexibleGroupCategoriesData, error: kitFlexibleGroupCategoriesError } =
          await supabase
            .from('kit_flexible_group_categories')
            .select('id, flexible_group_id, category, default_quantity, sort_order')
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })

        if (kitFlexibleGroupCategoriesError) {
          if (!isMissingRelationError(kitFlexibleGroupCategoriesError)) {
            logEditError(kitFlexibleGroupCategoriesError)
            throw kitFlexibleGroupCategoriesError
          }
        } else {
          loadedKitFlexibleGroupCategories =
            (kitFlexibleGroupCategoriesData ?? []) as KitFlexibleGroupCategory[]
        }

        let loadedExtras: OrderExtraRow[] = []
        let loadedHasOrderExtrasTable = true
        const { data: extrasData, error: extrasError } = await supabase
          .from('order_extras')
          .select('id, name, amount, notes')
          .eq('user_id', user.id)
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })

        if (extrasError) {
          if (isMissingRelationError(extrasError)) {
            loadedHasOrderExtrasTable = false
          } else {
            logEditError(extrasError)
            throw extrasError
          }
        } else {
          loadedExtras = (extrasData ?? []) as OrderExtraRow[]
        }

        let loadedCakeToppers: OrderCakeTopperRow[] = []
        let loadedHasCakeTopperTable = true
        const { data: cakeTopperData, error: cakeTopperError } = await supabase
          .from('order_cake_toppers')
          .select('id, supplier_id, child_name, age, theme, photo_url, cost, charged_amount, notes')
          .eq('user_id', user.id)
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })

        if (cakeTopperError) {
          if (isMissingRelationError(cakeTopperError)) {
            loadedHasCakeTopperTable = false
          } else {
            logEditError(cakeTopperError)
            throw cakeTopperError
          }
        } else {
          loadedCakeToppers = (cakeTopperData ?? []) as OrderCakeTopperRow[]
        }

        const loadedRecipes = (recipesData ?? []) as Recipe[]
        const loadedKitItems = (kitItemsData ?? []) as ProductKitItem[]
        const loadedMaps: KitMaps = {
          recipeById: new Map(loadedRecipes.map((recipe) => [recipe.id, recipe])),
          kitItemsByKitId: groupByKitId(loadedKitItems),
          kitCategoryComponentsByKitId: groupByKitId(loadedKitCategoryComponents),
          kitFlexibleGroupsByKitId: groupByKitId(loadedKitFlexibleGroups),
          kitFlexibleGroupCategoriesByGroupId: groupFlexibleCategories(
            loadedKitFlexibleGroupCategories
          ),
        }
        const order = orderData as OrderRow
        const loadedOrderItems = buildOrderItemsFromRows(order.order_items ?? [], loadedMaps)

        if (isMounted) {
          setRecipes(loadedRecipes)
          setCustomers((customersData ?? []) as CustomerOption[])
          setSuppliers((suppliersData ?? []) as Supplier[])
          setKitItems(loadedKitItems)
          setKitCategoryComponents(loadedKitCategoryComponents)
          setKitFlexibleGroups(loadedKitFlexibleGroups)
          setKitFlexibleGroupCategories(loadedKitFlexibleGroupCategories)
          setHasOrderExtrasTable(loadedHasOrderExtrasTable)
          setHasCakeTopperTable(loadedHasCakeTopperTable)
          setOrderItems(loadedOrderItems)
          setOrderExtras(buildOrderExtras(loadedExtras))
          setCakeTopper(buildCakeTopperForm(loadedCakeToppers))
          setForm(buildFormFromOrder(order, loadedOrderItems))
        }
      } catch (err) {
        logEditError(err)
        if (isMounted) {
          setError(getErrorMessage(err, 'Falha ao carregar pedido para edicao'))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOrderForEdit()

    return () => {
      isMounted = false
    }
  }, [orderId, supabase])

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

  function calculateFlexibleCategoryChosenQuantity(category: KitFlexibleGroupCategorySelection) {
    return category.choices.reduce((sum, choice) => sum + parseDecimal(choice.quantity), 0)
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
  }

  function handleCakeTopperChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const field = event.target.name as Exclude<keyof CakeTopperForm, 'enabled'>
    const value = event.target.value

    setCakeTopper((currentCakeTopper) => ({
      ...currentCakeTopper,
      [field]: value,
    }))
  }

  function addOrderItem() {
    const firstRecipe = recipes[0]

    if (!firstRecipe) {
      setError('Cadastre produtos em Receitas antes de editar os itens do pedido')
      return
    }

    setOrderItems((currentItems) => [...currentItems, buildOrderItem(firstRecipe, kitMaps)])
  }

  function updateOrderItem(
    localId: string,
    field: 'recipe_id' | 'item_name' | 'quantity' | 'unit_price' | 'notes',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) return item

        if (field === 'recipe_id') {
          if (!value) {
            return {
              ...item,
              recipe_id: '',
            }
          }

          const recipe = recipeById.get(value)
          if (!recipe) return item

          return {
            ...buildOrderItem(recipe, kitMaps),
            localId: item.localId,
            quantity: item.quantity,
            notes: item.notes,
          }
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              flavors: [...item.flavors, { localId: createLocalId(), name: '', quantity: '' }],
            }
          : item
      )
    )
  }

  function updateFlavor(
    itemLocalId: string,
    flavorLocalId: string,
    field: 'name' | 'quantity',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              flavors: item.flavors.map((flavor) =>
                flavor.localId === flavorLocalId ? { ...flavor, [field]: value } : flavor
              ),
            }
          : item
      )
    )
  }

  function removeFlavor(itemLocalId: string, flavorLocalId: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              flavors: item.flavors.filter((flavor) => flavor.localId !== flavorLocalId),
            }
          : item
      )
    )
  }

  function addKitSubItem(itemLocalId: string) {
    const firstRecipe = recipes.find((recipe) => recipe.product_type !== 'kit')

    if (!firstRecipe) {
      setError('Cadastre produtos simples antes de adicionar subitens ao kit')
      return
    }

    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_subitems: [
                ...item.kit_subitems,
                {
                  localId: createLocalId(),
                  recipe_id: firstRecipe.id,
                  item_name: firstRecipe.name,
                  quantity: '1',
                  notes: '',
                  flavors: [],
                },
              ],
            }
          : item
      )
    )
  }

  function updateKitSubItem(
    itemLocalId: string,
    subItemLocalId: string,
    field: 'recipe_id' | 'item_name' | 'quantity' | 'notes',
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_subitems: item.kit_subitems.map((subItem) => {
                if (subItem.localId !== subItemLocalId) return subItem

                if (field === 'recipe_id') {
                  const recipe = recipeById.get(value)
                  return {
                    ...subItem,
                    recipe_id: value,
                    item_name: recipe?.name ?? subItem.item_name,
                  }
                }

                return { ...subItem, [field]: value }
              }),
            }
          : item
      )
    )
  }

  function removeKitSubItem(itemLocalId: string, subItemLocalId: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_subitems: item.kit_subitems.filter(
                (subItem) => subItem.localId !== subItemLocalId
              ),
            }
          : item
      )
    )
  }

  function addSubItemFlavor(itemLocalId: string, subItemLocalId: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
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
          : item
      )
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
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
          : item
      )
    )
  }

  function removeSubItemFlavor(
    itemLocalId: string,
    subItemLocalId: string,
    flavorLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_subitems: item.kit_subitems.map((subItem) =>
                subItem.localId === subItemLocalId
                  ? {
                      ...subItem,
                      flavors: subItem.flavors.filter(
                        (flavor) => flavor.localId !== flavorLocalId
                      ),
                    }
                  : subItem
              ),
            }
          : item
      )
    )
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

  function addCategoryChoice(itemLocalId: string, componentLocalId: string) {
    const item = orderItems.find((currentItem) => currentItem.localId === itemLocalId)
    const component = item?.kit_category_subitems.find(
      (currentComponent) => currentComponent.localId === componentLocalId
    )

    if (!component) return

    const firstProduct = getCategoryProducts(component.category)[0]
    if (!firstProduct) {
      setError(`Cadastre produtos na categoria ${component.category} antes de editar este kit`)
      return
    }

    setOrderItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.localId === itemLocalId
          ? {
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
          : currentItem
      )
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_category_subitems: item.kit_category_subitems.map((component) =>
                component.localId === componentLocalId
                  ? {
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

                        return { ...choice, [field]: value }
                      }),
                    }
                  : component
              ),
            }
          : item
      )
    )
  }

  function removeCategoryChoice(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_category_subitems: item.kit_category_subitems.map((component) =>
                component.localId === componentLocalId
                  ? {
                      ...component,
                      choices: component.choices.filter(
                        (choice) => choice.localId !== choiceLocalId
                      ),
                    }
                  : component
              ),
            }
          : item
      )
    )
  }

  function addCategoryChoiceFlavor(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_category_subitems: item.kit_category_subitems.map((component) =>
                component.localId === componentLocalId
                  ? {
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
                  : component
              ),
            }
          : item
      )
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_category_subitems: item.kit_category_subitems.map((component) =>
                component.localId === componentLocalId
                  ? {
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
                  : component
              ),
            }
          : item
      )
    )
  }

  function removeCategoryChoiceFlavor(
    itemLocalId: string,
    componentLocalId: string,
    choiceLocalId: string,
    flavorLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_category_subitems: item.kit_category_subitems.map((component) =>
                component.localId === componentLocalId
                  ? {
                      ...component,
                      choices: component.choices.map((choice) =>
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
                  : component
              ),
            }
          : item
      )
    )
  }

  function updateFlexibleGroupCategoryQuantity(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    value: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_flexible_groups: item.kit_flexible_groups.map((group) =>
                group.localId === groupLocalId
                  ? {
                      ...group,
                      categories: group.categories.map((category) =>
                        category.localId === categoryLocalId
                          ? { ...category, distributed_quantity: value }
                          : category
                      ),
                    }
                  : group
              ),
            }
          : item
      )
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

    const firstProduct = getCategoryProducts(category.category)[0]
    if (!firstProduct) {
      setError(`Cadastre produtos na categoria ${category.category} antes de editar este kit`)
      return
    }

    setOrderItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.localId === itemLocalId
          ? {
              ...currentItem,
              kit_flexible_groups: currentItem.kit_flexible_groups.map((currentGroup) =>
                currentGroup.localId === groupLocalId
                  ? {
                      ...currentGroup,
                      categories: currentGroup.categories.map((currentCategory) => {
                        if (currentCategory.localId !== categoryLocalId) return currentCategory

                        const requiredQuantity = parseDecimal(
                          currentCategory.distributed_quantity
                        )
                        const chosenQuantity =
                          calculateFlexibleCategoryChosenQuantity(currentCategory)
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
                  : currentGroup
              ),
            }
          : currentItem
      )
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_flexible_groups: item.kit_flexible_groups.map((group) =>
                group.localId === groupLocalId
                  ? {
                      ...group,
                      categories: group.categories.map((category) =>
                        category.localId === categoryLocalId
                          ? {
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

                                return { ...choice, [field]: value }
                              }),
                            }
                          : category
                      ),
                    }
                  : group
              ),
            }
          : item
      )
    )
  }

  function removeFlexibleCategoryChoice(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
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
          : item
      )
    )
  }

  function addFlexibleCategoryChoiceFlavor(
    itemLocalId: string,
    groupLocalId: string,
    categoryLocalId: string,
    choiceLocalId: string
  ) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_flexible_groups: item.kit_flexible_groups.map((group) =>
                group.localId === groupLocalId
                  ? {
                      ...group,
                      categories: group.categories.map((category) =>
                        category.localId === categoryLocalId
                          ? {
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
                          : category
                      ),
                    }
                  : group
              ),
            }
          : item
      )
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_flexible_groups: item.kit_flexible_groups.map((group) =>
                group.localId === groupLocalId
                  ? {
                      ...group,
                      categories: group.categories.map((category) =>
                        category.localId === categoryLocalId
                          ? {
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
                          : category
                      ),
                    }
                  : group
              ),
            }
          : item
      )
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
      currentItems.map((item) =>
        item.localId === itemLocalId
          ? {
              ...item,
              kit_flexible_groups: item.kit_flexible_groups.map((group) =>
                group.localId === groupLocalId
                  ? {
                      ...group,
                      categories: group.categories.map((category) =>
                        category.localId === categoryLocalId
                          ? {
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
                          : category
                      ),
                    }
                  : group
              ),
            }
          : item
      )
    )
  }

  function addOrderExtra() {
    setOrderExtras((currentExtras) => [
      ...currentExtras,
      { localId: createLocalId(), name: '', amount: '', notes: '' },
    ])
  }

  function updateOrderExtra(localId: string, field: 'name' | 'amount' | 'notes', value: string) {
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
    if (orderItems.length === 0 && !form.product_name.trim()) {
      return 'Adicione pelo menos um produto ou mantenha um nome de pedido antigo'
    }
    if (finalTotal <= 0) return 'Total do pedido deve ser maior que zero'
    if (downPayment < 0) return 'Valor do sinal não pode ser negativo'

    const invalidItem = orderItems.some((item) => {
      if (!item.item_name.trim() || parseDecimal(item.quantity) <= 0 || parseDecimal(item.unit_price) < 0) {
        return true
      }

      if (!validateFlavorList(item.flavors)) return true

      const invalidFixedSubItem = item.kit_subitems.some(
        (subItem) =>
          !subItem.item_name.trim() ||
          parseDecimal(subItem.quantity) <= 0 ||
          !validateFlavorList(subItem.flavors)
      )
      if (invalidFixedSubItem) return true

      const invalidCategoryChoice = item.kit_category_subitems.some((component) =>
        component.choices.some((choice) => !validateFlavorList(choice.flavors))
      )
      if (invalidCategoryChoice) return true

      return item.kit_flexible_groups.some((group) =>
        group.categories.some((category) =>
          category.choices.some((choice) => !validateFlavorList(choice.flavors))
        )
      )
    })

    if (invalidItem) return 'Confira produtos, quantidades, precos e sabores do pedido'

    const kitCategoryError = orderItems
      .map((item) => validateKitCategoryChoices(item))
      .find((message) => message)

    if (kitCategoryError) return kitCategoryError

    const kitFlexibleGroupError = orderItems
      .map((item) => validateKitFlexibleGroups(item))
      .find((message) => message)

    if (kitFlexibleGroupError) return kitFlexibleGroupError

    if (hasOrderExtrasTable) {
      const invalidExtra = orderExtras.some(
        (extra) => !extra.name.trim() || parseDecimal(extra.amount) < 0
      )

      if (invalidExtra) return 'Confira nome e valor de todos os acréscimos'
    }

    if (hasCakeTopperTable && cakeTopper.enabled) {
      if (parseDecimal(cakeTopper.cost) < 0 || parseDecimal(cakeTopper.charged_amount) < 0) {
        return 'Custo e valor cobrado do topo de bolo não podem ser negativos'
      }
    }

    return ''
  }

  async function resolveCustomerId(userId: string) {
    const customerName = form.customer_name.trim()
    const selected = customers.find(
      (customer) => customer.name.trim().toLowerCase() === customerName.toLowerCase()
    )

    if (selected) {
      const { error: customerUpdateError } = await supabase
        .from('customers')
        .update({ phone: optionalText(form.customer_phone) })
        .eq('id', selected.id)
        .eq('user_id', userId)

      if (customerUpdateError) {
        logEditError(customerUpdateError)
        throw customerUpdateError
      }

      return selected.id
    }

    const { data: existingCustomers, error: searchError } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .eq('name', customerName)
      .limit(1)

    if (searchError) {
      logEditError(searchError)
      throw searchError
    }

    const existingCustomer = (existingCustomers ?? [])[0] as { id: string } | undefined
    if (existingCustomer?.id) return existingCustomer.id

    const { data: createdCustomer, error: createCustomerError } = await supabase
      .from('customers')
      .insert([
        {
          user_id: userId,
          name: customerName,
          phone: optionalText(form.customer_phone),
        },
      ])
      .select('id')
      .single()

    if (createCustomerError) {
      logEditError(createCustomerError)
      throw createCustomerError
    }

    const customer = createdCustomer as CreatedRecord | null
    if (!customer?.id) throw new Error('Cliente criado sem id retornado pelo Supabase')

    return customer.id
  }

  async function updateOrderWithFallbacks(userId: string, customerId: string) {
    const primaryProductName =
      optionalText(form.product_name) ?? optionalText(orderItems[0]?.item_name ?? '') ?? null
    const paymentStatus = downPayment <= 0 ? 'pending' : remainingAmount > 0 ? 'partial' : 'paid'
    const payload: OrderUpdatePayload = {
      customer_id: customerId,
      order_date: form.order_date || new Date().toISOString().split('T')[0],
      delivery_date: form.delivery_date || null,
      delivery_time: form.delivery_time || null,
      total_value: finalTotal,
      deposit_value: downPayment,
      down_payment: downPayment,
      remaining_amount: remainingAmount,
      fulfillment_type: form.fulfillment_type,
      delivery_fee: deliveryFee,
      discount_amount: discount,
      extras_total: extrasTotal,
      manual_total: form.manual_total.trim() ? parseDecimal(form.manual_total) : null,
      remaining_payment_date: form.remaining_payment_date || null,
      status: form.status || 'novo',
      payment_status: paymentStatus,
      delivery_address: optionalText(form.address),
      notes: optionalText(form.notes || form.description),
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .eq('user_id', userId)

    if (updateError) {
      logEditError(updateError)
      throw updateError
    }
  }

  async function insertOrderItem(payload: OrderItemInsert) {
    const { data, error: itemError } = await supabase
      .from('order_items')
      .insert([payload])
      .select('id')
      .single()

    if (itemError) {
      logEditError(itemError)
      throw itemError
    }

    const createdItem = data as CreatedRecord | null
    if (!createdItem?.id) throw new Error('Item de pedido criado sem id retornado pelo Supabase')

    return createdItem.id
  }

  async function createSupplierOrderForThirdPartyItem(params: {
    userId: string
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
        customer_order_id: orderId,
        order_item_id: params.orderItemId,
        title: params.title,
        quantity: params.quantity,
        unit: 'unidades',
        due_date: form.delivery_date || null,
        status: 'pendente',
        estimated_cost: calculateSupplierEstimatedCost(recipe, params.quantity),
        details,
        notes: params.notes,
      },
    ])

    if (supplierOrderError) {
      logEditError(supplierOrderError)
      throw supplierOrderError
    }
  }

  async function recreateOrderItemsAndSupplierOrders(userId: string) {
    const { error: supplierDeleteError } = await supabase
      .from('supplier_orders')
      .delete()
      .eq('user_id', userId)
      .eq('customer_order_id', orderId)

    if (supplierDeleteError) {
      logEditError(supplierDeleteError)
      throw supplierDeleteError
    }

    const { error: itemDeleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('user_id', userId)
      .eq('order_id', orderId)

    if (itemDeleteError) {
      logEditError(itemDeleteError)
      throw itemDeleteError
    }

    for (const item of orderItems) {
      const quantity = parseDecimal(item.quantity)
      const unitPrice = parseDecimal(item.unit_price)
      const subtotal = quantity * unitPrice
      const flavorPayload = buildFlavorPayload(item.flavors)
      const mainItemId = await insertOrderItem({
        user_id: userId,
        order_id: orderId,
        recipe_id: optionalUuid(item.recipe_id),
        parent_order_item_id: null,
        item_name: item.item_name.trim() || 'Produto',
        quantity,
        unit_price: unitPrice,
        subtotal,
        flavor_details: item.product_type === 'simples' ? flavorPayload : null,
        notes: optionalText(item.notes),
      })

      if (item.product_type !== 'kit' && item.recipe_id) {
        await createSupplierOrderForThirdPartyItem({
          userId,
          orderItemId: mainItemId,
          recipeId: item.recipe_id,
          title: item.item_name,
          quantity,
          flavorDetails: flavorPayload,
          notes: optionalText(item.notes),
        })
      }

      if (item.product_type === 'kit') {
        for (const subItem of item.kit_subitems) {
          const childQuantity = parseDecimal(subItem.quantity) * quantity
          const childFlavorPayload = buildFlavorPayload(subItem.flavors)
          const childItemId = await insertOrderItem({
            user_id: userId,
            order_id: orderId,
            recipe_id: optionalUuid(subItem.recipe_id),
            parent_order_item_id: mainItemId,
            item_name: subItem.item_name.trim() || 'Item do kit',
            quantity: childQuantity,
            unit_price: 0,
            subtotal: 0,
            flavor_details: childFlavorPayload,
            notes: optionalText(subItem.notes),
          })

          if (subItem.recipe_id) {
            await createSupplierOrderForThirdPartyItem({
              userId,
              orderItemId: childItemId,
              recipeId: subItem.recipe_id,
              title: subItem.item_name,
              quantity: childQuantity,
              flavorDetails: childFlavorPayload,
              notes: optionalText(subItem.notes),
              parentKitName: item.item_name,
            })
          }
        }

        for (const component of item.kit_category_subitems) {
          for (const choice of component.choices) {
            const childQuantity = parseDecimal(choice.quantity) * quantity
            const childFlavorPayload = buildFlavorPayload(choice.flavors)
            const childNotes = buildCategoryChoiceNotes(component.category, choice.notes)
            const childItemId = await insertOrderItem({
              user_id: userId,
              order_id: orderId,
              recipe_id: optionalUuid(choice.recipe_id),
              parent_order_item_id: mainItemId,
              item_name: choice.item_name.trim() || 'Item do kit',
              quantity: childQuantity,
              unit_price: 0,
              subtotal: 0,
              flavor_details: childFlavorPayload,
              notes: childNotes,
            })

            if (choice.recipe_id) {
              await createSupplierOrderForThirdPartyItem({
                userId,
                orderItemId: childItemId,
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
              const childItemId = await insertOrderItem({
                user_id: userId,
                order_id: orderId,
                recipe_id: optionalUuid(choice.recipe_id),
                parent_order_item_id: mainItemId,
                item_name: choice.item_name.trim() || 'Item do kit',
                quantity: childQuantity,
                unit_price: 0,
                subtotal: 0,
                flavor_details: childFlavorPayload,
                notes: childNotes,
              })

              if (choice.recipe_id) {
                await createSupplierOrderForThirdPartyItem({
                  userId,
                  orderItemId: childItemId,
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
    }
  }

  async function recreateExtras(userId: string) {
    if (!hasOrderExtrasTable) return

    const { error: deleteExtrasError } = await supabase
      .from('order_extras')
      .delete()
      .eq('user_id', userId)
      .eq('order_id', orderId)

    if (deleteExtrasError) {
      if (isMissingRelationError(deleteExtrasError)) {
        setHasOrderExtrasTable(false)
        return
      }

      logEditError(deleteExtrasError)
      throw deleteExtrasError
    }

    if (orderExtras.length === 0) return

    const extrasData = orderExtras.map((extra) => ({
      user_id: userId,
      order_id: orderId,
      name: extra.name.trim(),
      amount: parseDecimal(extra.amount),
      notes: optionalText(extra.notes),
    }))

    const { error: insertExtrasError } = await supabase.from('order_extras').insert(extrasData)

    if (insertExtrasError) {
      if (isMissingRelationError(insertExtrasError)) {
        setHasOrderExtrasTable(false)
        return
      }

      logEditError(insertExtrasError)
      throw insertExtrasError
    }
  }

  function buildCakeTopperTitle(childName: string | null, theme: string | null) {
    const titleDetail = childName || theme
    return titleDetail ? `Topo de bolo - ${titleDetail}` : 'Topo de bolo'
  }

  async function recreateCakeTopper(userId: string) {
    if (!hasCakeTopperTable) return

    const { error: deleteCakeTopperError } = await supabase
      .from('order_cake_toppers')
      .delete()
      .eq('user_id', userId)
      .eq('order_id', orderId)

    if (deleteCakeTopperError) {
      if (isMissingRelationError(deleteCakeTopperError)) {
        setHasCakeTopperTable(false)
        return
      }

      logEditError(deleteCakeTopperError)
      throw deleteCakeTopperError
    }

    if (!cakeTopper.enabled) return

    const childName = optionalText(cakeTopper.child_name)
    const age = optionalText(cakeTopper.age)
    const theme = optionalText(cakeTopper.theme)
    const photoUrl = optionalText(cakeTopper.photo_url)
    const cost = optionalMoney(cakeTopper.cost)
    const chargedAmount = optionalMoney(cakeTopper.charged_amount)
    const notes = optionalText(cakeTopper.notes)
    const supplierId = optionalText(cakeTopper.supplier_id)

    const { error: insertCakeTopperError } = await supabase.from('order_cake_toppers').insert([
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

    if (insertCakeTopperError) {
      if (isMissingRelationError(insertCakeTopperError)) {
        setHasCakeTopperTable(false)
        return
      }

      logEditError(insertCakeTopperError)
      throw insertCakeTopperError
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
      logEditError(supplierOrderError)
      throw supplierOrderError
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

      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingOrderError) {
        logEditError(existingOrderError)
        throw existingOrderError
      }

      if (!existingOrder) {
        setNotFound(true)
        throw new Error('Pedido não encontrado para este usuário')
      }

      const customerId = await resolveCustomerId(user.id)

      await updateOrderWithFallbacks(user.id, customerId)
      await recreateOrderItemsAndSupplierOrders(user.id)
      await recreateExtras(user.id)
      await recreateCakeTopper(user.id)

      router.push(`/pedidos/${orderId}`)
    } catch (err) {
      logEditError(err)
      setError(getErrorMessage(err, 'Falha ao salvar alteracoes do pedido'))
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FAF6F0]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#C0392B]" />
          <p className="mt-2 text-[#999999]">Carregando pedido...</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FAF6F0] px-4">
        <div className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-white p-6 text-center">
          <p className="text-lg font-bold text-[#1A0A08]">Pedido não encontrado</p>
          <p className="mt-1 text-sm text-[#999999]">
            Ele pode ter sido removido ou pertencer a outro usuario.
          </p>
          <Link
            href="/pedidos"
            className="mt-4 inline-flex rounded-lg bg-[#C0392B] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#A0301F]"
          >
            Voltar para pedidos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF6F0] pb-44 lg:pb-8">
      <div className="sticky top-0 z-10 border-b border-[rgba(26,10,8,0.07)] bg-white px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg p-2 transition-colors hover:bg-[#FAF6F0]"
              aria-label="Voltar"
            >
              <ArrowLeft size={24} className="text-[#1A0A08]" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A84C]">
                Pedidos
              </p>
              <h1 className="truncate text-2xl font-bold text-[#1A0A08]">Editar pedido</h1>
            </div>
          </div>
          <button
            type="submit"
            form="edit-order-form"
            disabled={isSubmitting}
            className="hidden items-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
          >
            <Save size={18} aria-hidden="true" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar'}</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#C0392B]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form id="edit-order-form" onSubmit={handleSubmit} className="space-y-6">
          <Section title="Informacoes da cliente">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Nome da cliente *</FieldLabel>
                <input
                  type="text"
                  name="customer_name"
                  list="customer-options"
                  value={form.customer_name}
                  onChange={handleInputChange}
                  className={inputClass}
                />
                <datalist id="customer-options">
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.name} />
                  ))}
                </datalist>
                {parseNumericValue(selectedCustomer?.balance) > 0 && (
                  <p className="mt-2 rounded-lg bg-[#F4FBF6] px-3 py-2 text-sm font-semibold text-[#1F7A3A]">
                    Saldo disponivel: {formatCurrency(selectedCustomer?.balance)}
                  </p>
                )}
              </div>
              <div>
                <FieldLabel>Telefone</FieldLabel>
                <input
                  type="tel"
                  name="customer_phone"
                  value={form.customer_phone}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Endereço de entrega</FieldLabel>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          <Section title="Dados principais">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Nome do pedido</FieldLabel>
                <input
                  type="text"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  {statusOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Data do pedido</FieldLabel>
                <input
                  type="date"
                  name="order_date"
                  value={form.order_date}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Data da festa/entrega</FieldLabel>
                <input
                  type="date"
                  name="delivery_date"
                  value={form.delivery_date}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Horario</FieldLabel>
                <input
                  type="time"
                  name="delivery_time"
                  value={form.delivery_time}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Descricao geral</FieldLabel>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          <Section title="Itens do pedido">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#999999]">
                Subitens de kits entram com valor zero para não duplicar o total.
              </p>
              <button
                type="button"
                onClick={addOrderItem}
                disabled={recipes.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} aria-hidden="true" />
                <span>Adicionar produto</span>
              </button>
            </div>

            {recipes.length === 0 ? (
              <div className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#1A0A08]">
                Nenhum produto cadastrado.
              </div>
            ) : orderItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(26,10,8,0.16)] p-5 text-center text-sm text-[#999999]">
                Este pedido antigo ainda não tem itens estruturados.
              </div>
            ) : (
              <div className="space-y-4">
                {orderItems.map((item, index) => {
                  const subtotal = parseDecimal(item.quantity) * parseDecimal(item.unit_price)
                  const isKit = item.product_type === 'kit'

                  return (
                    <article
                      key={item.localId}
                      className="rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Package size={18} className="text-[#C9A84C]" aria-hidden="true" />
                          <p className="font-bold text-[#1A0A08]">Item {index + 1}</p>
                          {isKit && (
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-[#C0392B]">
                              Kit
                            </span>
                          )}
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

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_100px_120px] md:items-end">
                        <div>
                          <FieldLabel>Produto cadastrado</FieldLabel>
                          <select
                            value={item.recipe_id}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'recipe_id', event.target.value)
                            }
                            className={inputClass}
                          >
                            {!item.recipe_id && <option value="">Produto antigo/customizado</option>}
                            {recipes.map((recipe) => (
                              <option key={recipe.id} value={recipe.id}>
                                {recipe.name} {recipe.product_type === 'kit' ? '(kit)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <FieldLabel>Nome no pedido</FieldLabel>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'item_name', event.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <FieldLabel>Qtd.</FieldLabel>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'quantity', event.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <FieldLabel>Preco unit.</FieldLabel>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.unit_price}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'unit_price', event.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px] md:items-end">
                        <div>
                          <FieldLabel>Observacoes do item</FieldLabel>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(event) =>
                              updateOrderItem(item.localId, 'notes', event.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-medium text-[#999999]">Subtotal</p>
                          <p className="mt-1 font-bold text-[#1A0A08]">
                            {formatCurrency(subtotal)}
                          </p>
                        </div>
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
                                  className="grid grid-cols-[minmax(0,1fr)_96px_40px] gap-2 sm:grid-cols-[minmax(0,1fr)_110px_40px]"
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
                                    className={inputClass}
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
                                    className={inputClass}
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
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-bold text-[#1A0A08]">Subitens do kit</p>
                            <button
                              type="button"
                              onClick={() => addKitSubItem(item.localId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
                            >
                              <Plus size={15} aria-hidden="true" />
                              <span>Adicionar subitem</span>
                            </button>
                          </div>

                          {item.kit_subitems.map((subItem) => (
                            <div
                              key={subItem.localId}
                              className="rounded-lg border border-[rgba(26,10,8,0.07)] p-3"
                            >
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_96px_40px]">
                                <select
                                  value={subItem.recipe_id}
                                  onChange={(event) =>
                                    updateKitSubItem(
                                      item.localId,
                                      subItem.localId,
                                      'recipe_id',
                                      event.target.value
                                    )
                                  }
                                  className={inputClass}
                                >
                                  {!subItem.recipe_id && <option value="">Subitem antigo</option>}
                                  {recipes
                                    .filter((recipe) => recipe.product_type !== 'kit')
                                    .map((recipe) => (
                                      <option key={recipe.id} value={recipe.id}>
                                        {recipe.name}
                                      </option>
                                    ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={subItem.quantity}
                                  onChange={(event) =>
                                    updateKitSubItem(
                                      item.localId,
                                      subItem.localId,
                                      'quantity',
                                      event.target.value
                                    )
                                  }
                                  className={inputClass}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeKitSubItem(item.localId, subItem.localId)}
                                  className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                                  aria-label="Remover subitem"
                                >
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={subItem.item_name}
                                onChange={(event) =>
                                  updateKitSubItem(
                                    item.localId,
                                    subItem.localId,
                                    'item_name',
                                    event.target.value
                                  )
                                }
                                className={`${inputClass} mt-2`}
                              />
                              <input
                                type="text"
                                value={subItem.notes}
                                onChange={(event) =>
                                  updateKitSubItem(
                                    item.localId,
                                    subItem.localId,
                                    'notes',
                                    event.target.value
                                  )
                                }
                                placeholder="Observacoes do subitem"
                                className={`${inputClass} mt-2`}
                              />

                              <div className="mt-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-[#1A0A08]">
                                    Sabores/variacoes
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => addSubItemFlavor(item.localId, subItem.localId)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-2 py-1 text-xs font-semibold text-[#C0392B]"
                                  >
                                    <Plus size={13} aria-hidden="true" />
                                    <span>Adicionar sabor</span>
                                  </button>
                                </div>
                                {subItem.flavors.length > 0 && (
                                  <div className="space-y-2">
                                    {subItem.flavors.map((flavor) => (
                                      <div
                                        key={flavor.localId}
                                        className="grid grid-cols-[minmax(0,1fr)_96px_40px] gap-2 sm:grid-cols-[minmax(0,1fr)_110px_40px]"
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
                                          className={inputClass}
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
                                          className={inputClass}
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
                            </div>
                          ))}

                          {item.kit_category_subitems.map((component) => {
                            const categoryProducts = getCategoryProducts(component.category)
                            const requiredQuantity = parseDecimal(component.required_quantity)
                            const chosenQuantity = calculateCategoryChosenQuantity(component)

                            return (
                              <div
                                key={component.localId}
                                className="rounded-lg border border-[rgba(26,10,8,0.07)] p-3"
                              >
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="font-semibold text-[#1A0A08]">
                                      Categoria: {component.category}
                                    </p>
                                    <p className="text-xs text-[#999999]">
                                      Escolhido {formatNumber(chosenQuantity)} /{' '}
                                      {formatNumber(requiredQuantity)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addCategoryChoice(item.localId, component.localId)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#FAF6F0] px-3 py-2 text-sm font-semibold text-[#C0392B]"
                                  >
                                    <Plus size={15} aria-hidden="true" />
                                    <span>Adicionar produto</span>
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  {component.choices.map((choice) => (
                                    <div key={choice.localId} className="rounded-lg bg-[#FAF6F0] p-3">
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_96px_40px]">
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
                                          className={inputClass}
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
                                          className={inputClass}
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
                                        placeholder="Observações"
                                        className={`${inputClass} mt-2`}
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
                                                className="grid grid-cols-[minmax(0,1fr)_96px_40px] gap-2 sm:grid-cols-[minmax(0,1fr)_110px_40px]"
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
                                                  className={inputClass}
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
                                                  className={inputClass}
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
                              </div>
                            )
                          })}

                          {item.kit_flexible_groups.map((group) => {
                            const totalQuantity = parseDecimal(group.total_quantity)
                            const distributedQuantity =
                              calculateFlexibleGroupDistributedQuantity(group)

                            return (
                              <div
                                key={group.localId}
                                className="rounded-lg border border-[rgba(26,10,8,0.07)] p-3"
                              >
                                <div className="mb-3">
                                  <p className="font-semibold text-[#1A0A08]">
                                    Grupo flexivel: {group.name}
                                  </p>
                                  <p className="text-xs text-[#999999]">
                                    Distribuido {formatNumber(distributedQuantity)} /{' '}
                                    {formatNumber(totalQuantity)}
                                  </p>
                                </div>

                                <div className="space-y-3">
                                  {group.categories.map((category) => {
                                    const categoryProducts = getCategoryProducts(category.category)
                                    const chosenQuantity =
                                      calculateFlexibleCategoryChosenQuantity(category)

                                    return (
                                      <div
                                        key={category.localId}
                                        className="rounded-lg bg-[#FAF6F0] p-3"
                                      >
                                        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_110px_auto] md:items-end">
                                          <div>
                                            <p className="font-semibold text-[#1A0A08]">
                                              {category.category}
                                            </p>
                                            <p className="text-xs text-[#999999]">
                                              Escolhido {formatNumber(chosenQuantity)} /{' '}
                                              {formatNumber(category.distributed_quantity)}
                                            </p>
                                          </div>
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
                                            className={inputClass}
                                          />
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
                                            <span>Adicionar</span>
                                          </button>
                                        </div>

                                        <div className="space-y-3">
                                          {category.choices.map((choice) => (
                                            <div key={choice.localId} className="rounded-lg bg-white p-3">
                                              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_96px_40px]">
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
                                                  className={inputClass}
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
                                                    updateFlexibleCategoryChoice(
                                                      item.localId,
                                                      group.localId,
                                                      category.localId,
                                                      choice.localId,
                                                      'quantity',
                                                      event.target.value
                                                    )
                                                  }
                                                  className={inputClass}
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
                                                  aria-label="Remover produto do grupo"
                                                >
                                                  <Trash2 size={16} aria-hidden="true" />
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
                                                placeholder="Observações"
                                                className={`${inputClass} mt-2`}
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
                                                        className="grid grid-cols-[minmax(0,1fr)_96px_40px] gap-2 sm:grid-cols-[minmax(0,1fr)_110px_40px]"
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
                                                          className={inputClass}
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
                                                          className={inputClass}
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
                                                          aria-label="Remover sabor do grupo"
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
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Entrega ou retirada">
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
                <FieldLabel>Valor da entrega</FieldLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="delivery_fee"
                  value={form.delivery_fee}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
            )}
          </Section>

          <Section title="Topo de bolo">
            {!hasCakeTopperTable ? (
              <p className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Tabela de topo de bolo não encontrada neste ambiente.
              </p>
            ) : (
              <>
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
                  <span className="font-bold text-[#1A0A08]">Ativar topo neste pedido</span>
                </label>

                {cakeTopper.enabled && (
                  <div className="mt-4 rounded-[16px] border border-[rgba(26,10,8,0.07)] bg-[#FAF6F0] p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <FieldLabel>Fornecedor</FieldLabel>
                        <select
                          name="supplier_id"
                          value={cakeTopper.supplier_id}
                          onChange={handleCakeTopperChange}
                          className={inputClass}
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
                        <FieldLabel>Nome</FieldLabel>
                        <input
                          type="text"
                          name="child_name"
                          value={cakeTopper.child_name}
                          onChange={handleCakeTopperChange}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>Idade</FieldLabel>
                        <input
                          type="text"
                          name="age"
                          value={cakeTopper.age}
                          onChange={handleCakeTopperChange}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>Tema</FieldLabel>
                        <input
                          type="text"
                          name="theme"
                          value={cakeTopper.theme}
                          onChange={handleCakeTopperChange}
                          className={inputClass}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FieldLabel>Foto do topo</FieldLabel>
                        <ImageUpload
                          value={cakeTopper.photo_url}
                          onUpload={(url) => setCakeTopper((prev) => ({ ...prev, photo_url: url }))}
                          onRemove={() => setCakeTopper((prev) => ({ ...prev, photo_url: '' }))}
                        />
                      </div>
                      <div>
                        <FieldLabel>Custo</FieldLabel>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="cost"
                          value={cakeTopper.cost}
                          onChange={handleCakeTopperChange}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>Valor cobrado</FieldLabel>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="charged_amount"
                          value={cakeTopper.charged_amount}
                          onChange={handleCakeTopperChange}
                          className={inputClass}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FieldLabel>Observações</FieldLabel>
                        <textarea
                          name="notes"
                          value={cakeTopper.notes}
                          onChange={handleCakeTopperChange}
                          rows={3}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Section>

          <Section title="Acréscimos">
            {!hasOrderExtrasTable ? (
              <p className="rounded-lg bg-[#FAF6F0] p-4 text-sm text-[#999999]">
                Tabela de acréscimos não encontrada neste ambiente.
              </p>
            ) : (
              <>
                <div className="mb-4 flex justify-end">
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
                          placeholder="Nome"
                          className={inputClass}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={extra.amount}
                          onChange={(event) =>
                            updateOrderExtra(extra.localId, 'amount', event.target.value)
                          }
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => removeOrderExtra(extra.localId)}
                          className="inline-flex items-center justify-center rounded-lg text-[#999999] hover:bg-red-50 hover:text-[#C0392B]"
                          aria-label="Remover acrescimo"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                        <input
                          type="text"
                          value={extra.notes}
                          onChange={(event) =>
                            updateOrderExtra(extra.localId, 'notes', event.target.value)
                          }
                          placeholder="Observações"
                          className={`${inputClass} md:col-span-3`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>

          <Section title="Valores">
            <div className="space-y-4">
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Subtotal dos itens principais</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(subtotalItems)}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel>Desconto</FieldLabel>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="discount_amount"
                    value={form.discount_amount}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white p-3">
                  <p className="text-sm text-[#999999]">Entrega</p>
                  <p className="mt-1 font-bold text-[#1A0A08]">{formatCurrency(deliveryFee)}</p>
                </div>
                <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white p-3">
                  <p className="text-sm text-[#999999]">Acréscimos</p>
                  <p className="mt-1 font-bold text-[#1A0A08]">{formatCurrency(extrasTotal)}</p>
                </div>
                <div className="rounded-lg border border-[rgba(26,10,8,0.07)] bg-white p-3">
                  <p className="text-sm text-[#999999]">Topo</p>
                  <p className="mt-1 font-bold text-[#1A0A08]">
                    {formatCurrency(cakeTopperChargedAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#C9A84C] bg-[#FAF6F0] p-3 md:col-span-2">
                  <p className="text-sm text-[#999999]">Total calculado</p>
                  <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                    {formatCurrency(totalCalculated)}
                  </p>
                </div>
              </div>
              <div>
                <FieldLabel>Total manual</FieldLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="manual_total"
                  value={form.manual_total}
                  onChange={handleInputChange}
                  placeholder={`Vazio usa ${formatCurrency(totalCalculated)}`}
                  className={inputClass}
                />
              </div>
              <div className="rounded-lg border border-[#27AE60] bg-white p-4">
                <p className="text-sm text-[#999999]">Total final</p>
                <p className="mt-1 text-3xl font-bold text-[#1A0A08]">
                  {formatCurrency(finalTotal)}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Sinal e pagamento">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Valor do sinal</FieldLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="down_payment"
                  value={form.down_payment}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Valor restante</p>
                <p className="mt-1 text-xl font-bold text-[#1A0A08]">
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
              <div>
                <FieldLabel>Forma de pagamento do sinal</FieldLabel>
                <select
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Data de recebimento do sinal</FieldLabel>
                <input
                  type="date"
                  name="deposit_payment_date"
                  value={form.deposit_payment_date}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Forma de pagamento do restante</FieldLabel>
                <select
                  name="remaining_payment_method"
                  value={form.remaining_payment_method}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Data de recebimento do restante</FieldLabel>
                <input
                  type="date"
                  name="remaining_payment_date"
                  value={form.remaining_payment_date}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          <Section title="Observações">
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleInputChange}
              rows={4}
              className={inputClass}
            />
          </Section>

          <div className="-mx-4 -mb-8 flex gap-3 border-t border-[rgba(26,10,8,0.07)] bg-white p-4">
            <button
              type="button"
              onClick={() => router.push(`/pedidos/${orderId}`)}
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
              <span>{isSubmitting ? 'Salvando...' : 'Salvar alteracoes'}</span>
            </button>
          </div>
        </form>
      </main>

      <div className="fixed bottom-20 left-0 right-0 z-20 border-t border-[rgba(26,10,8,0.07)] bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(26,10,8,0.12)] lg:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#999999]">
              Total final
            </p>
            <p className="truncate text-xl font-bold text-[#1A0A08]">
              {formatCurrency(finalTotal)}
            </p>
          </div>
          <button
            type="submit"
            form="edit-order-form"
            disabled={isSubmitting}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C0392B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#A0301F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} aria-hidden="true" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar alteracoes'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
