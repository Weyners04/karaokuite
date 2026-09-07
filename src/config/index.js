import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuration centralisée de l'application.
 * Toutes les variables d'environnement sont lues ici, une seule fois,
 * pour éviter de disperser des `process.env.*` dans tout le code.
 */
export const config = {
  port: Number(process.env.PORT) || 3000,

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    // URI de redirection OAuth (doit être déclarée à l'identique dans le dashboard Spotify).
    // Spotify n'accepte plus "localhost" : on utilise l'IP loopback explicite.
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/callback',
  },

  lrclib: {
    baseUrl: 'https://lrclib.net/api',
    // LRCLIB recommande un User-Agent identifiant l'application.
    userAgent: 'blindtest-paroles/0.1.0 (https://github.com/ton-compte/blindtest-paroles)',
  },

  // Nombre de résultats Spotify pour lesquels on va chercher les paroles en parallèle.
  searchLimit: 8,
};

/**
 * Vérifie que la configuration Spotify minimale est présente.
 * La recherche côté serveur (client credentials) a besoin du secret ;
 * la lecture côté navigateur (PKCE) n'a besoin que du clientId.
 */
export function assertSpotifyConfig() {
  const missing = [];
  if (!config.spotify.clientId) missing.push('SPOTIFY_CLIENT_ID');
  if (!config.spotify.clientSecret) missing.push('SPOTIFY_CLIENT_SECRET');
  return { ok: missing.length === 0, missing };
}
