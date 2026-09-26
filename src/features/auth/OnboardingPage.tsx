import { useState, type FormEvent } from 'react'
import { Button, Centered, ErrorText, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

export function OnboardingPage() {
  const { profile, refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile!.id)
    if (error) setError(error.message)
    else await refreshProfile()
  }

  return (
    <Centered>
      <h1 className="text-2xl font-bold">Bienvenue !</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input label="Ton prénom (visible par le groupe)" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <Button>Continuer</Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Centered>
  )
}
