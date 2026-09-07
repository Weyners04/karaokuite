import { config } from '../config/index.js';

/**
 * Modèle Spotify (données côté serveur).
 *
 * Utilise le flux "Client Credentials" : le serveur s'authentifie avec son
 * client_id/secret pour interroger l'API publique de recherche.
 * ⚠️ Ce flux ne permet PAS la lecture audio (pas de contexte utilisateur).
 * La lecture se fait côté navigateur via le Web Playback SDK (voir frontend).
 *
 * Le token client-credentials est mis en cache jusqu'à son expiration.
 */
export class SpotifyModel {
  #token = null;
  #tokenExpiresAt = 0;

  /**
   * Récupère un token d'application valide (avec cache).
   * @returns {Promise<string>}
   */
  async #getAppToken() {
    const now = Date.now();
    if (this.#token && now < this.#tokenExpiresAt - 5000) {
      return this.#token;
    }

    const creds = Buffer.from(
      `${config.spotify.clientId}:${config.spotify.clientSecret}`,
    ).toString('base64');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify token error (${res.status}): ${body}`);
    }

    const data = await res.json();
    this.#token = data.access_token;
    this.#tokenExpiresAt = now + data.expires_in * 1000;
    return this.#token;
  }

  /**
   * Recherche de morceaux.
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<Array>} liste de morceaux normalisés
   */
  async searchTracks(query, limit = config.searchLimit) {
    if (!query || !query.trim()) return [];

    const token = await this.#getAppToken();
    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'track');
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify search error (${res.status}): ${body}`);
    }

    const data = await res.json();
    return (data.tracks?.items || []).map(mapTrack);
  }
}

/**
 * Réduit un objet track Spotify au strict nécessaire pour le jeu.
 * @param {object} t
 */
function mapTrack(t) {
  return {
    id: t.id,
    uri: t.uri, // ex: "spotify:track:xxxx" -> nécessaire pour le Web Playback SDK
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    artistPrimary: t.artists?.[0]?.name || '',
    album: t.album?.name || '',
    durationMs: t.duration_ms,
    cover: t.album?.images?.[0]?.url || null,
  };
}
