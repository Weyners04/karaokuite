/**
 * Service de parsing LRC (paroles synchronisées).
 *
 * Format LRC : chaque ligne commence par un ou plusieurs tags temporels
 *   [mm:ss.xx] Texte de la ligne
 * On convertit ça en une liste d'objets { time, text, words } triés par temps.
 *
 * Ce module est PUR (aucun accès réseau, aucun état) → facilement testable.
 */

// Capture tous les tags [mm:ss.xx] ou [mm:ss] en tête de ligne.
const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Découpe une ligne de texte en mots exploitables par le jeu.
 * On conserve les mots "affichables" ; la ponctuation reste collée au mot.
 * @param {string} text
 * @returns {string[]}
 */
export function splitWords(text) {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Parse un temps LRC en millisecondes.
 * @param {string} min
 * @param {string} sec
 * @param {string|undefined} frac - centièmes ou millièmes de seconde
 * @returns {number} millisecondes
 */
function toMs(min, sec, frac) {
  const minutes = Number(min);
  const seconds = Number(sec);
  let ms = 0;
  if (frac != null) {
    // "5" -> dixièmes (500ms) ; "12" -> centièmes (120ms) ; "123" -> millièmes (123ms)
    const factor = frac.length === 1 ? 100 : frac.length === 2 ? 10 : 1;
    ms = Number(frac) * factor;
  }
  return minutes * 60_000 + seconds * 1_000 + ms;
}

/**
 * Parse un bloc de paroles LRC complet.
 * @param {string} lrc - contenu LRC brut (tel que renvoyé par LRCLIB dans syncedLyrics)
 * @returns {{time:number, text:string, words:string[]}[]} lignes triées par temps
 */
export function parseLrc(lrc) {
  if (!lrc || typeof lrc !== 'string') return [];

  const lines = [];

  for (const rawLine of lrc.split(/\r?\n/)) {
    // On récupère tous les tags temporels de la ligne (une ligne peut en avoir plusieurs).
    const tags = [...rawLine.matchAll(TIME_TAG)];
    if (tags.length === 0) continue; // ligne de métadonnée ([ar:], [ti:]...) ou vide

    // Le texte est ce qui reste une fois tous les tags retirés.
    const text = rawLine.replace(TIME_TAG, '').trim();

    for (const tag of tags) {
      const time = toMs(tag[1], tag[2], tag[3]);
      lines.push({ time, text, words: splitWords(text) });
    }
  }

  // Tri chronologique + suppression des doublons de temps exacts.
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * Indique si des paroles synchronisées sont réellement exploitables :
 * il faut au moins quelques lignes contenant du texte.
 * @param {{text:string}[]} parsedLines
 * @returns {boolean}
 */
export function hasUsableLyrics(parsedLines) {
  const withText = parsedLines.filter((l) => l.text.length > 0);
  return withText.length >= 4;
}
