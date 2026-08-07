/**
 * Ordonnancement fractionnaire (LexoRank simplifié).
 *
 * Chaque ticket porte un `rank` textuel. Insérer ou déplacer un élément entre
 * deux voisins ne touche QUE la ligne déplacée — pas de renumérotation de tout
 * le backlog. Les rangs se trient avec un simple ORDER BY rank ASC.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;

function indexOfChar(char: string): number {
  const index = ALPHABET.indexOf(char);
  if (index === -1) throw new Error(`Caractère de rang invalide : "${char}"`);
  return index;
}

/**
 * Calcule un rang strictement compris entre `prev` et `next`.
 * `null` = début (respectivement fin) de liste.
 */
export function rankBetween(prev: string | null, next: string | null): string {
  const before = prev ?? '';
  const after = next ?? '';

  if (before && after && before >= after) {
    throw new Error(`Bornes de rang incohérentes : "${before}" >= "${after}"`);
  }

  let result = '';
  let position = 0;

  for (;;) {
    const beforeChar = before[position];
    const afterChar = after[position];
    // Hors des bornes : à gauche on prolonge par le minimum, à droite par la
    // valeur au-delà du maximum — ce qui laisse tout l'intervalle disponible.
    const low = beforeChar === undefined ? 0 : indexOfChar(beforeChar);
    const high = afterChar === undefined ? BASE : indexOfChar(afterChar);

    if (low === high) {
      result += ALPHABET[low];
      position += 1;
      continue;
    }

    const middle = Math.floor((low + high) / 2);
    if (middle !== low) return result + ALPHABET[middle];

    // Caractères adjacents : aucune place à ce niveau. On conserve celui de
    // `prev` et on descend d'un cran ; `next` ne contraint plus la suite.
    result += ALPHABET[low];
    position += 1;
    return result + rankBetween(before.slice(position), null);
  }
}

/** Rang du tout premier élément d'une liste vide. */
export const INITIAL_RANK = rankBetween(null, null);

export const rankBefore = (next: string): string => rankBetween(null, next);
export const rankAfter = (prev: string): string => rankBetween(prev, null);

/** Rangs initiaux d'une liste construite d'un bloc (import, seed). */
export function initialRanks(count: number): string[] {
  const ranks: string[] = [];
  let previous: string | null = null;
  for (let i = 0; i < count; i += 1) {
    previous = rankBetween(previous, null);
    ranks.push(previous);
  }
  return ranks;
}
