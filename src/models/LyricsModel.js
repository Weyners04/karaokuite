import { config } from '../config/index.js';
import { parseLrc, hasUsableLyrics } from '../services/lrcParser.js';
import { durationsMatch, normalize } from '../utils/matchTrack.js';

/**
 * Modèle Paroles (LRCLIB).
 *
 * LRCLIB est gratuit, sans clé API, sans authentification.
 * Stratégie :
 *   1. /api/get  avec (titre, artiste, album, durée) → match précis
 *   2. fallback /api/search si /api/get ne trouve rien
 * On ne garde que les résultats avec des paroles SYNCHRONISÉES utilisables.
 */
export class LyricsModel {
  #base = config.lrclib.baseUrl;
  #headers = { 'User-Agent': config.lrclib.userAgent };

  /**
   * Récupère et parse les paroles synchronisées pour un morceau donné.
   * @param {{title:string, artistPrimary:string, album:string, durationMs:number}} track
   * @returns {Promise<null | {source:string, syncedLyrics:string, lines:Array}>}
   */
  async getSyncedForTrack(track) {
    const direct = await this.#tryGet(track).catch(() => null);
    if (direct) return direct;

    const searched = await this.#trySearch(track).catch(() => null);
    return searched;
  }

  /** Appel /api/get (match exact par métadonnées). */
  async #tryGet(track) {
    const url = new URL(`${this.#base}/get`);
    url.searchParams.set('track_name', track.title || '');
    url.searchParams.set('artist_name', track.artistPrimary || '');
    url.searchParams.set('album_name', track.album || '');
    url.searchParams.set('duration', String(Math.round((track.durationMs || 0) / 1000)));

    const res = await fetch(url, { headers: this.#headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null; // 404 fréquent → pas de paroles pour ce match exact

    const data = await res.json();
    return this.#buildResult(data, 'lrclib:get');
  }

  /** Appel /api/search (recherche large) + re-filtrage par durée. */
  async #trySearch(track) {
    const url = new URL(`${this.#base}/search`);
    url.searchParams.set('track_name', track.title || '');
    if (track.artistPrimary) url.searchParams.set('artist_name', track.artistPrimary);

    const res = await fetch(url, { headers: this.#headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    // On privilégie une entrée dont la durée colle et qui a des paroles synchro.
    const scored = results
      .filter((r) => r.syncedLyrics)
      .map((r) => ({
        r,
        durationOk: durationsMatch(track.durationMs, (r.duration || 0) * 1000),
        titleOk: normalize(r.trackName) === normalize(track.title),
      }))
      .sort((a, b) => Number(b.durationOk) - Number(a.durationOk) || Number(b.titleOk) - Number(a.titleOk));

    const best = scored[0];
    if (!best) return null;
    return this.#buildResult(best.r, 'lrclib:search');
  }

  /** Construit le résultat normalisé + parse le LRC. Retourne null si inexploitable. */
  #buildResult(data, source) {
    const synced = data?.syncedLyrics;
    if (!synced) return null;

    const lines = parseLrc(synced);
    if (!hasUsableLyrics(lines)) return null;

    return {
      source,
      durationSec: data.duration || null,
      syncedLyrics: synced,
      lines,
    };
  }
}
