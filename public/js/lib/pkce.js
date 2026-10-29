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
  // Web Crypto natif quand il est disponible (contexte sécurisé).
  if (globalThis.crypto?.subtle?.digest) {
    return crypto.subtle.digest('SHA-256', data);
  }
  // Repli : certains navigateurs intégrés d'applications (Instagram, WhatsApp,
  // Messenger…) n'exposent pas crypto.subtle et feraient planter la connexion
  // PKCE avec « undefined is not an object (evaluating 'crypto.subtle.digest') ».
  return sha256Fallback(data);
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * SHA-256 (FIPS 180-4) en pur JS, repli quand `crypto.subtle` est absent.
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} le condensé (32 octets)
 */
function sha256Fallback(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const l = bytes.length;
  const bitLen = l * 8;
  const total = (l + 8 + 64) & ~63; // place pour 0x80 + longueur 64 bits, arrondi au bloc de 64
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[l] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(total - 4, bitLen >>> 0, false);
  dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((hv, i) => outDv.setUint32(i * 4, hv >>> 0, false));
  return out;
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

  /** Un Client ID personnel est-il enregistré dans ce navigateur ? */
  hasCustomClientId() {
    return Boolean(SpotifyAuth.getCustomClientId());
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
