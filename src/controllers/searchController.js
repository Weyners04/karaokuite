import { SpotifyModel } from '../models/SpotifyModel.js';
import { LyricsModel } from '../models/LyricsModel.js';
import { config } from '../config/index.js';

const spotify = new SpotifyModel();
const lyrics = new LyricsModel();

/**
 * Contrôleur de recherche.
 *
 * Flux d'orchestration :
 *   1. Recherche Spotify (métadonnées canoniques : titre, artiste, durée, uri).
 *   2. Pour chaque résultat, on récupère les paroles LRCLIB EN PARALLÈLE
 *      (Promise.all) — c'est le cœur du "en parallèle".
 *   3. On renvoie chaque morceau enrichi d'un flag `playable`
 *      (= a des paroles synchronisées → jouable dans le jeu).
 *
 * Résultat : le frontend n'a plus qu'à afficher la liste et laisser le
 * joueur choisir une chanson réellement jouable, sans aller-retour.
 */
export async function search(req, res) {
  const q = (req.query.q || '').toString().trim();
  if (!q) {
    return res.status(400).json({ error: 'Paramètre "q" requis.' });
  }

  // Optionnel : ?limit= permet aux modes "Choix multiple"/"Aléatoire" de
  // demander plus de résultats bruts pour augmenter les chances d'y trouver
  // plusieurs morceaux jouables. Plafonné à 10 : la doc Spotify annonce 50,
  // mais en pratique (mode Development actuel) l'API rejette tout au-delà
  // de 10 avec une erreur 400 "Invalid limit" — vérifié empiriquement.
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 10) : config.searchLimit;

  try {
    const tracks = await spotify.searchTracks(q, limit);

    // Récupération des paroles en parallèle pour tous les résultats.
    const enriched = await Promise.all(
      tracks.map(async (track) => {
        const lyricsResult = await lyrics
          .getSyncedForTrack(track)
          .catch(() => null);

        return {
          ...track,
          playable: Boolean(lyricsResult),
          lyricsSource: lyricsResult?.source || null,
          // Les lignes parsées sont incluses directement pour éviter un 2e appel.
          lines: lyricsResult?.lines || null,
        };
      }),
    );

    // Les morceaux jouables d'abord.
    enriched.sort((a, b) => Number(b.playable) - Number(a.playable));

    res.json({ query: q, count: enriched.length, tracks: enriched });
  } catch (err) {
    console.error('[searchController]', err.message);
    res.status(502).json({ error: 'Recherche indisponible.', detail: err.message });
  }
}
