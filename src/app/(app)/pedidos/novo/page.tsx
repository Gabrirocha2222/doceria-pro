'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, ArrowLeft, Package, Plus, Save, Trash2, Upload } from 'lucide-react'

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
  product_type: ProductType | null
  is_third_party: boolean | null
  supplier_id: string | null
  sale_price: NumericValue
  suggested_price: NumericValue
}

type ProductKitItem = {
  id: string
  kit_recipe_id: string
  item_recipe_id: string
  quantity: NumericValue
  notes: string | null
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

type KitSubItem = {
  localId: string
  kit_item_id: string
  recipe_id: string
  item_name: string
  quantity: string
  notes: string
  flavors: FlavorItem[]
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
}

const statusOptions = [
  { id: 'novo', label: 'Novo' },
  { id: 'confirmado', label: 'Confirmado' },
  { id: 'em_producao', label: 'Em producao' },
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
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseDecimal(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNumericValue(value: NumericValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') return parseDecimal(value)
  return 0
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue || null
}

function formatCurrency(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseNumericValue(value))
}

function getEffectiveSalePrice(recipe: Recipe) {
  return parseNumericValue(recipe.sale_price ?? recipe.suggested_price)
}

function logSupabaseError(context: string, error: unknown) {
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

function buildFlavorPayload(flavors: FlavorItem[]): FlavorPayload | null {
  const payload = flavors
    .map((flavor) => ({
      name: flavor.name.trim(),
      quantity: parseDecimal(flavor.quantity),
    }))
    .filter((flavor) => flavor.name || flavor.quantity > 0)

  return payload.length > 0 ? payload : null
}

export default function NovoPedidoPage() {
  const [form, setForm] = useState<OrderForm>(initialForm)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [kitItems, setKitItems] = useState<ProductKitItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderProductItem[]>([])
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
          throw new Error('Usuaria nao autenticada. Faca login para continuar.')
        }

        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, name, product_type, is_third_party, supplier_id, sale_price, suggested_price')
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

        if (isMounted) {
          setRecipes((recipesData ?? []) as Recipe[])
          setKitItems((kitItemsData ?? []) as ProductKitItem[])
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

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + parseDecimal(item.quantity) * parseDecimal(item.unit_price)
    }, 0)
  }, [orderItems])

  const depositValue = parseDecimal(form.deposit_value)
  const remainingValue = Math.max(orderTotal - depositValue, 0)

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

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      setImages(Array.from(event.target.files))
    }
  }

  function removeImage(index: number) {
    setImages((currentImages) => currentImages.filter((_, currentIndex) => currentIndex !== index))
  }

  function validateFlavorList(flavors: FlavorItem[]) {
    return flavors.every((flavor) => {
      const hasContent = flavor.name.trim() || flavor.quantity.trim()
      if (!hasContent) return true

      return Boolean(flavor.name.trim()) && parseDecimal(flavor.quantity) > 0
    })
  }

  function validateForm() {
    if (!form.customer_name.trim()) return 'Nome da cliente e obrigatorio'
    if (!form.delivery_date) return 'Data da festa/evento e obrigatoria'
    if (!form.delivery_time) return 'Horario de entrega e obrigatorio'
    if (orderItems.length === 0) return 'Adicione pelo menos um produto ao pedido'
    if (orderTotal <= 0) return 'Total do pedido deve ser maior que zero'
    if (depositValue < 0) return 'Valor do sinal nao pode ser negativo'

    const invalidItem = orderItems.some((item) => {
      if (!item.recipe_id || parseDecimal(item.quantity) <= 0 || parseDecimal(item.unit_price) < 0) {
        return true
      }

      if (!validateFlavorList(item.flavors)) return true

      return item.kit_subitems.some((subItem) => !validateFlavorList(subItem.flavors))
    })

    if (invalidItem) {
      return 'Confira produtos, quantidades, precos e sabores do pedido'
    }

    return ''
  }

  async function uploadImages(orderId: string) {
    const uploadedPaths: string[] = []

    for (const image of images) {
      try {
        const filename = `${orderId}/${Date.now()}-${image.name}`
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
        throw new Error('Usuaria nao autenticada. Faca login novamente.')
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
        delivery_date: form.delivery_date,
        delivery_time: form.delivery_time,
        total_value: orderTotal,
        deposit_value: depositValue,
        status: form.status || 'novo',
        payment_status: depositValue > 0 ? 'partial' : 'pending',
        delivery_address: optionalText(form.address),
        notes: optionalText(form.notes || form.description),
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
      }

      const payments = []

      if (depositValue > 0) {
        payments.push({
          order_id: orderId,
          amount: depositValue,
          method: form.payment_method,
          payment_date: form.deposit_payment_date || null,
          notes: 'Sinal',
        })
      }

      if (remainingValue > 0) {
        payments.push({
          order_id: orderId,
          amount: remainingValue,
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
    <div className="w-full pb-8">
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  value={form.customer_name}
                  onChange={handleInputChange}
                  placeholder="Ex: Ana Silva"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
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
                  Endereco de entrega
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
                          <p className="text-sm font-bold text-[#1A0A08]">Subitens do kit</p>
                          {item.kit_subitems.length === 0 ? (
                            <p className="text-sm text-[#999999]">
                              Este kit nao tem composicao cadastrada.
                            </p>
                          ) : (
                            item.kit_subitems.map((subItem) => (
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
                                    onClick={() => addSubItemFlavor(item.localId, subItem.localId)}
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
                            ))
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
            <h2 className="mb-4 font-bold text-[#1A0A08]">Valores e pagamento</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Valor total automatico</p>
                <p className="mt-1 text-2xl font-bold text-[#1A0A08]">
                  {formatCurrency(orderTotal)}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1A0A08]">
                  Valor do sinal
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="deposit_value"
                  value={form.deposit_value}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[rgba(26,10,8,0.07)] bg-white px-3 py-2 text-[#1A0A08] focus:outline-none focus:ring-2 focus:ring-[#C0392B]"
                />
              </div>
              <div className="rounded-lg bg-[#FAF6F0] p-4">
                <p className="text-sm text-[#999999]">Valor restante</p>
                <p className="mt-1 text-xl font-bold text-[#1A0A08]">
                  {formatCurrency(remainingValue)}
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
            <label className="mb-2 block text-sm font-medium text-[#1A0A08]">Observacoes</label>
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
    </div>
  )
}
