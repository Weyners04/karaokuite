/**
 * Authentification Spotify en PKCE (Authorization Code + Proof Key).
 *
 * PKCE se fait entièrement côté navigateur : on n'expose JAMAIS le client_secret.
 * Scopes nécessaires au Web Playback SDK : `streaming` (+ lecture du profil).
 *
 * Le flux :
 *   1. login()   → génère un verifier, redirige vers Spotify.
 *   2. Spotify renvoie sur redirectUri avec ?code=...
 *   3. handleRedirect() → échange le code contre un token (avec le verifier).
 *   4. getToken() → renvoie un token valide (rafraîchi si expiré).
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = 'streaming user-read-email user-read-private';

const LS_TOKEN = 'btp_token';
const SS_VERIFIER = 'btp_verifier';
const LS_CLIENT_ID = 'btp_client_id';

// --- Helpers crypto ---
function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class SpotifyAuth {
  /**
   * @param {{clientId:string, redirectUri:string}} cfg
   */
  constructor(cfg) {
    // Client ID « par défaut » servi par le backend (l'app Spotify du déploiement).
    // Chaque joueur peut le remplacer par celui de SA propre app Spotify
    // (setCustomClientId) : il devient alors propriétaire de l'app qu'il utilise,
    // ce qui évite l'erreur 403 « user not registered » et la limite des 5
    // utilisateurs du mode développement.
    this._configClientId = cfg.clientId || '';
    this.redirectUri = cfg.redirectUri;
  }

  /**
   * Client ID effectif : celui saisi par le joueur s'il existe, sinon celui du
   * backend. Lu à chaque usage (login / échange / refresh) pour que tout le flux
   * PKCE utilise bien la même application.
   */
  get clientId() {
    return SpotifyAuth.getCustomClientId() || this._configClientId;
  }

  /** Client ID personnel éventuellement enregistré par ce navigateur. */
  static getCustomClientId() {
    try {
      return localStorage.getItem(LS_CLIENT_ID) || '';
    } catch {
      return '';
    }
  }

  /**
   * Enregistre (ou efface si vide) le Client ID de l'app Spotify du joueur.
   * On jette le token stocké : il appartenait à l'app précédente, le garder
   * provoquerait des 403 déroutants au prochain essai.
   */
  static setCustomClientId(id) {
    const clean = (id || '').trim();
    if (clean === SpotifyAuth.getCustomClientId()) return;
    try {
      if (clean) localStorage.setItem(LS_CLIENT_ID, clean);
      else localStorage.removeItem(LS_CLIENT_ID);
      localStorage.removeItem(LS_TOKEN);
    } catch {
      /* stockage indisponible : on ignore silencieusement */
    }
  }

  /** Oublie le Client ID personnel (retour à celui du backend). */
  static clearCustomClientId() {
    SpotifyAuth.setCustomClientId('');
  }

  /** Un token est-il déjà stocké et non expiré ? */
  isLoggedIn() {
    const t = this.#readToken();
    return Boolean(t && t.access_token);
  }

  /** Lance la redirection de connexion Spotify. */
  async login() {
    const verifier = randomString(64);
    const challenge = base64url(await sha256(verifier));
    sessionStorage.setItem(SS_VERIFIER, verifier);

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location.assign(`${AUTH_URL}?${params}`);
  }

  /**
   * À appeler au chargement : si l'URL contient ?code=, échange le code.
   * @returns {Promise<boolean>} true si une connexion vient d'être finalisée
   */
  async handleRedirect() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) return false;

    const verifier = sessionStorage.getItem(SS_VERIFIER);
    if (!verifier) return false;

    const body = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Échec échange token (${res.status})`);

    const data = await res.json();
    this.#storeToken(data);
    sessionStorage.removeItem(SS_VERIFIER);

    // Nettoie l'URL (retire ?code=...).
    window.history.replaceState({}, document.title, this.redirectUri.replace(/\/callback$/, '/'));
    return true;
  }

  /** Renvoie un access_token valide, rafraîchi si nécessaire. */
  async getToken() {
    let t = this.#readToken();
    if (!t) throw new Error('Non connecté à Spotify.');
    if (Date.now() < t.expires_at - 10_000) return t.access_token;

    // Rafraîchissement.
    if (t.refresh_token) {
      const body = new URLSearchParams({
        client_id: this.clientId,
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
      });
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        // Spotify ne renvoie pas toujours un nouveau refresh_token.
        this.#storeToken({ refresh_token: t.refresh_token, ...data });
        return this.#readToken().access_token;
      }
    }
    // Échec → on force une reconnexion.
    this.logout();
    throw new Error('Session Spotify expirée, reconnecte-toi.');
  }

  logout() {
    localStorage.removeItem(LS_TOKEN);
  }

  // --- privé ---
  #storeToken(data) {
    const record = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    localStorage.setItem(LS_TOKEN, JSON.stringify(record));
  }

  #readToken() {
    try {
      return JSON.parse(localStorage.getItem(LS_TOKEN));
    } catch {
      return null;
    }
  }
}
