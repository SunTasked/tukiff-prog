import { supabase } from './supabase'

const SIZE = 256

/** Center-crops the picture to a square and shrinks it to a small JPEG (a few dozen KB). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/jpeg', 0.85),
  )
}

const path = (userId: string) => `${userId}/avatar.jpg`

/** Uploads the picture and stores its URL on the profile (versioned so caches refresh). */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const blob = await toSquareJpeg(file)
  const { error } = await supabase.storage.from('avatars').upload(path(userId), blob, { upsert: true, contentType: 'image/jpeg' })
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
