import { Button, Centered, ErrorText } from '../../components/ui'
import { supabase } from '../../lib/supabase'

export function PendingPage({ error }: { error?: string }) {
  return (
    <Centered>
      <h1 className="text-2xl font-bold">Accès en attente</h1>
      <p className="text-zinc-300">
        Ton compte n’est rattaché à aucun groupe. Demande un lien d’invitation à ton coach, puis ouvre-le.
      </p>
      <ErrorText>{error}</ErrorText>
      <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
        Se déconnecter
      </Button>
    </Centered>
  )
}
