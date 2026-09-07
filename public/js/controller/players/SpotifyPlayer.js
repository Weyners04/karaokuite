import { PlayerAdapter } from './PlayerAdapter.js';

/**
 * Lecteur basé sur le Spotify Web Playback SDK.
 *
 * ⚠️ Nécessite un compte Spotify PREMIUM connecté (un seul suffit : celui de
 * l'hôte qui crée la partie).
 *
 * Position de lecture : le SDK ne rafraîchit pas l'état en continu. On lit
 * l'état périodiquement et on interpole avec performance.now() pour un
 * défilement fluide des paroles.
 */
export class SpotifyPlayer extends PlayerAdapter {
  /**
   * @param {import('../../lib/pkce.js').SpotifyAuth} auth
   */
  constructor(auth) {
    super();
    this.auth = auth;
    this.player = null;
    this.deviceId = null;
    this._readyPromise = null;

    // État interpolé
    this._basePos = 0; // position (ms) au dernier état connu
    this._baseAt = 0; // performance.now() correspondant
    this._paused = true;

    this._pollTimer = null;
    // URI du morceau actuellement chargé : sert à ignorer les états SDK
    // (event ou polling) qui concernent encore l'ancien morceau — sinon un
    // état en retard peut écraser la position qu'on vient d'initialiser.
    this._currentTrackUri = null;
  }

  async ready() {
    if (this._readyPromise) return this._readyPromise;
    this._readyPromise = this.#init();
    return this._readyPromise;
  }

  async #init() {
    await this.#loadSdk();
    const token = await this.auth.getToken();

    this.player = new Spotify.Player({
      name: 'Blindtest Paroles',
      getOAuthToken: (cb) => this.auth.getToken().then(cb),
      volume: 0.8,
    });

    this.player.addListener('initialization_error', ({ message }) => this.emit('error', message));
    this.player.addListener('authentication_error', ({ message }) => this.emit('error', message));
    this.player.addListener('account_error', () =>
      this.emit('error', 'Compte non Premium : la lecture Spotify nécessite Premium.'),
    );

    this.player.addListener('player_state_changed', (state) => {
      if (!state || !this.#isCurrentTrackState(state)) return;
      this.#syncState(state.position, state.paused);
      if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length) {
        this.emit('ended');
      }
    });

    const deviceId = await new Promise((resolve, reject) => {
      this.player.addListener('ready', ({ device_id }) => resolve(device_id));
      this.player.addListener('not_ready', () => {});
      this.player.connect().then((ok) => {
        if (!ok) reject(new Error('Connexion au lecteur Spotify impossible.'));
      });
    });

    this.deviceId = deviceId;
    void token;
    this.#startPolling();
    return true;
  }

  #loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.onerror = () => reject(new Error('Chargement du SDK Spotify échoué.'));
      document.head.appendChild(script);
    });
  }

  #syncState(positionMs, paused) {
    this._basePos = positionMs;
    this._baseAt = performance.now();
    this._paused = paused;
  }

  /** Un état SDK ne doit corriger notre position que s'il concerne bien le morceau chargé. */
  #isCurrentTrackState(state) {
    const uri = state.track_window?.current_track?.uri;
    return !this._currentTrackUri || uri === this._currentTrackUri;
  }

  #startPolling() {
    clearInterval(this._pollTimer);
    // Corrige la dérive toutes les 500ms.
    this._pollTimer = setInterval(async () => {
      const state = await this.player.getCurrentState();
      if (state && this.#isCurrentTrackState(state)) this.#syncState(state.position, state.paused);
    }, 500);
  }

  getPositionMs() {
    if (this._paused) return this._basePos;
    return this._basePos + (performance.now() - this._baseAt);
  }

  async loadAndPlay(track) {
    // Fixé AVANT l'appel : tout état SDK (event ou polling) concernant encore
    // l'ancien morceau sera ignoré dès maintenant par #isCurrentTrackState.
    this._currentTrackUri = track.uri;
    this.#syncState(0, false); // hypothèse optimiste, corrigée dès que le SDK confirme

    const token = await this.auth.getToken();
    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [track.uri] }),
      },
    );
    if (!res.ok && res.status !== 204) {
      const body = await res.text();
      throw new Error(`Lecture Spotify impossible (${res.status}) ${body}`);
    }

    // Le PUT ne garantit pas que le SDK a déjà basculé sur le nouveau morceau
    // (latence Spotify Connect). On confirme activement plutôt que de se fier
    // à l'hypothèse optimiste ci-dessus, pour éviter qu'un état encore lié à
    // l'ancien morceau ne fige la position pendant plusieurs secondes.
    for (let i = 0; i < 10; i++) {
      const state = await this.player.getCurrentState();
      if (state && this.#isCurrentTrackState(state)) {
        this.#syncState(state.position, state.paused);
        return;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    console.warn('[SpotifyPlayer] loadAndPlay: confirmation abandonnée après 10 tentatives, position optimiste conservée');
  }

  async pause() {
    await this.player.pause();
    this.#syncState(this.getPositionMs(), true);
  }

  async resume() {
    await this.player.resume();
    this.#syncState(this.getPositionMs(), false);
  }

  async seek(ms) {
    await this.player.seek(ms);
    this.#syncState(ms, this._paused);
  }

  destroy() {
    clearInterval(this._pollTimer);
    this.player?.disconnect();
  }
}
