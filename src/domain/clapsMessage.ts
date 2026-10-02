// Claps notification text: a phrase and a compliment drawn at random, so coming back doesn't always read the same.

const PHRASES: ((n: number, who: string) => string)[] = [
  (n, who) => `Depuis ta dernière visite, ${who} ${n > 1 ? 'ont' : 'a'} salué tes performances`,
  (n, who) => `${who} ${n > 1 ? 'ont' : 'a'} applaudi tes scores pendant ton absence`,
  (n, who) => `Pendant que tu récupérais, ${who} ${n > 1 ? 'ont' : 'a'} clappé tes perfs`,
  (n, who) => `${who} ${n > 1 ? 'sont passés' : 'est passé'} applaudir tes scores`,
]

const COMPLIMENTS = ['grosse machine', 'quelle bête', 'respect', 'monstre', 'en feu', 'patron', 'légende du box', 'rien ne t’arrête']

const pick = <T,>(list: readonly T[], random: () => number) => list[Math.floor(random() * list.length) % list.length]

/** e.g. "Depuis ta dernière visite, 3 athlètes ont salué tes performances 👏 (grosse machine)". */
export function clapsMessage(n: number, random: () => number = Math.random) {
  const who = n > 1 ? `${n} athlètes` : '1 athlète'
  const text = pick(PHRASES, random)(n, who)
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} 👏 (${pick(COMPLIMENTS, random)})`
}
