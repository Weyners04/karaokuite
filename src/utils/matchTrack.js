/**
 * Utilitaires de rapprochement entre un morceau Spotify et une entrée LRCLIB.
 *
 * Le risque principal : matcher la mauvaise version d'un titre (remix, live,
 * réédition...). On s'appuie sur la durée pour désambiguïser.
 */

/**
 * Vérifie que deux durées correspondent à quelques secondes près.
 * @param {number} durationMsA
 * @param {number} durationMsB
 * @param {number} toleranceSec
 * @returns {boolean}
 */
export function durationsMatch(durationMsA, durationMsB, toleranceSec = 3) {
  if (!durationMsA || !durationMsB) return false;
  return Math.abs(durationMsA - durationMsB) <= toleranceSec * 1000;
}

/**
 * Normalise une chaîne pour comparaison souple (minuscules, sans accents,
 * sans ponctuation superflue). Utile pour comparer titres/artistes.
 * @param {string} str
 * @returns {string}
 */
export function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les diacritiques
    .replace(/\(.*?\)|\[.*?\]/g, '') // retire (feat...), [remix]...
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
