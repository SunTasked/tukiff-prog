import { supabase } from './supabase'

const path = (userId: string) => `${userId}/avatar.jpg`

/** Uploads the cropped picture (small JPEG from AvatarCropper) and stores its URL on the profile (versioned so caches refresh). */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string | null> {
  const { error } = await supabase.storage.from('avatars').upload(path(userId), blob, {
    upsert: true,
    contentType: 'image/jpeg',
    // The URL carries ?v=, so the file can be cached for a year (saves the free-tier egress).
    cacheControl: '31536000',
  })
  if (error) return error.message
  const url = `${supabase.storage.from('avatars').getPublicUrl(path(userId)).data.publicUrl}?v=${Date.now()}`
  const { error: e } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  return e?.message ?? null
}

export async function removeAvatar(userId: string): Promise<string | null> {
  await supabase.storage.from('avatars').remove([path(userId)])
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  return error?.message ?? null
}
