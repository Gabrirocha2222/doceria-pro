import RecipeForm from '@/components/recipes/RecipeForm'

type EditarReceitaPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function EditarReceitaPage({ params }: EditarReceitaPageProps) {
  const { id } = await params

  return <RecipeForm mode="edit" recipeId={id} />
}
