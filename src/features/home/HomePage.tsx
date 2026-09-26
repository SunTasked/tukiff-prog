import { Card, PageTitle } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'

export function HomePage() {
  const { profile } = useAuth()
  return (
    <>
      <PageTitle>Salut {profile?.display_name} 👋</PageTitle>
      <Card>
        <p className="text-zinc-400">Aucune séance programmée pour aujourd’hui.</p>
      </Card>
    </>
  )
}
