import { RANDOM_SEEDS } from './randomSeeds.js';

/**
 * Tire un morceau au hasard : pioche une graine (artiste/genre) au hasard,
 * lance une recherche, et choisit un résultat `playable` (paroles synchro
 * disponibles) au hasard. Retente avec une autre graine en cas d'échec
 * (graine sans résultat jouable), jusqu'à épuisement des tentatives.
 *
 * @param {(q:string, limit?:number) => Promise<object[]>} searchApi
 * @param {{seeds?:object[], attempts?:number, limit?:number}} [opts]
 * @returns {Promise<object|null>} un morceau jouable, ou null si rien trouvé
 */
export async function pickRandomTrack(searchApi, opts = {}) {
  // limit plafonné à 10 côté backend (voir searchController.js) : la doc
  // Spotify annonce 50 mais l'API rejette tout au-delà en mode Development.
  const { seeds = RANDOM_SEEDS, attempts = 5, limit = 10 } = opts;
  const tried = new Set();

  for (let i = 0; i < attempts; i++) {
    const pool = seeds.filter((s) => !tried.has(s.query));
    if (!pool.length) break;
    const seed = pool[Math.floor(Math.random() * pool.length)];
    tried.add(seed.query);

    const tracks = await searchApi(seed.query, limit).catch(() => []);
    const playable = tracks.filter((t) => t.playable);
    if (playable.length) {
      return playable[Math.floor(Math.random() * playable.length)];
    }
  }

  return null;
}

/**
 * Tire jusqu'à `n` morceaux distincts au hasard dans `tracks` (sans remise).
 * @param {object[]} tracks
 * @param {number} n
 * @returns {object[]}
 */
export function sampleTracks(tracks, n) {
  const pool = [...tracks];
  const picked = [];
  while (pool.length && picked.length < n) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}
