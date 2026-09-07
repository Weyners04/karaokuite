import { config, assertSpotifyConfig } from '../config/index.js';

/**
 * Expose au frontend la configuration publique nécessaire au flux PKCE
 * (client_id + redirect_uri). Le client_secret n'est JAMAIS envoyé.
 */
export function getPublicConfig(_req, res) {
  const { ok, missing } = assertSpotifyConfig();
  res.json({
    spotify: {
      clientId: config.spotify.clientId,
      redirectUri: config.spotify.redirectUri,
    },
    ready: ok,
    missing,
  });
}
