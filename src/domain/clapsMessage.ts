// Claps notification text: one phrase, then a compliment drawn at random from the admins' list (Communauté).

export type Compliment = { text: string; text_female: string | null }

/** The compliment in the athlete's gender: the women's version when there is one. */
export const complimentFor = (c: Compliment, gender: string | null) => (gender === 'female' && c.text_female) || c.text

/** e.g. "3 athlètes ont clappé ta perf pendant ta récup 👏 (Grosse machine va)". */
export function clapsMessage(n: number, compliments: Compliment[], gender: string | null, random: () => number = Math.random) {
  const text = n > 1 ? `${n} athlètes ont clappé ta perf pendant ta récup 👏` : '1 athlète a clappé ta perf pendant ta récup 👏'
  if (!compliments.length) return text
  const c = compliments[Math.floor(random() * compliments.length) % compliments.length]
  return `${text} (${complimentFor(c, gender)})`
}
