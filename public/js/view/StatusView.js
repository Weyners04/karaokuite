/**
 * StatusView — bannière de mode (Spotify / Démo) + petites notifications.
 */
export class StatusView {
  constructor(refs, callbacks) {
    this.banner = refs.banner;
    this.toasts = refs.toasts;
    this.cb = callbacks; // { onConnectSpotify, onDemo }
  }

  /**
   * @param {{mode:'none'|'spotify'|'demo', ready:boolean, missing:string[]}} state
   */
  renderMode(state) {
    if (state.mode === 'spotify') {
      this.banner.className = 'banner banner--ok';
      this.banner.innerHTML = `🎧 Connecté à Spotify Premium — recherche et lecture actives.`;
      return;
    }
    if (state.mode === 'demo') {
      this.banner.className = 'banner banner--demo';
      this.banner.innerHTML = `🧪 Mode démo (sans Spotify) — chanson de test synthétisée.`;
      return;
    }

    // Aucun mode actif encore.
    this.banner.className = 'banner';
    const canSpotify = state.ready;
    this.banner.innerHTML = `
      <span>Choisis une source&nbsp;:</span>
      <button type="button" class="btn btn--primary" data-act="spotify" ${canSpotify ? '' : 'disabled'}>
        Se connecter à Spotify
      </button>
      <button type="button" class="btn btn--ghost" data-act="demo">Essayer le mode démo</button>
      ${
        canSpotify
          ? ''
          : `<em class="hint">Config Spotify manquante (${(state.missing || []).join(', ')}) — voir le README.</em>`
      }
    `;
    this.banner.querySelector('[data-act="spotify"]')?.addEventListener('click', () =>
      this.cb.onConnectSpotify(),
    );
    this.banner.querySelector('[data-act="demo"]')?.addEventListener('click', () => this.cb.onDemo());
  }

  toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('is-in'), 10);
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }
}
