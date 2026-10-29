/**
 * StatusView — bannière de mode (Spotify / Démo) + petites notifications.
 */
export class StatusView {
  constructor(refs, callbacks) {
    this.banner = refs.banner;
    this.toasts = refs.toasts;
    this.redirectUri = refs.redirectUri || '';
    // { onConnectSpotify, onDemo, onSaveClientId, onClearClientId, getCustomClientId }
    this.cb = callbacks;
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

    // Aucun mode actif encore : on propose les sources + le tuto « ton propre accès ».
    const customId = this.cb.getCustomClientId?.() || '';
    const redirectUri = this.redirectUri;
    const canSpotify = Boolean(state.ready) || Boolean(customId);

    this.banner.className = 'banner banner--choose';
    this.banner.innerHTML = `
      <div class="source-pick">
        <span>Choisis une source&nbsp;:</span>
        <button type="button" class="btn btn--primary" data-act="spotify" ${canSpotify ? '' : 'disabled'}>
          Se connecter à Spotify
        </button>
        <button type="button" class="btn btn--ghost" data-act="demo">Essayer le mode démo</button>
      </div>

      <details class="spotify-help" ${customId ? '' : 'open'}>
        <summary class="spotify-help__summary">🔑 Première connexion&nbsp;? Configure ton accès Spotify</summary>
        <div class="spotify-help__body">
          <p class="hint">
            Pour lire la musique, Spotify demande que tu passes par <strong>ta propre
            application</strong> (gratuit, ~5&nbsp;min). Tu évites ainsi l'erreur
            « user not registered » et toute limite d'utilisateurs. Un compte
            <strong>Spotify Premium</strong> est nécessaire pour la lecture.
          </p>
          <ol class="spotify-help__steps">
            <li>Ouvre le <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">dashboard Spotify</a>, connecte-toi, puis clique <strong>Create app</strong>.</li>
            <li>
              Nom&nbsp;: <code>Karaokuite</code>. Dans <strong>Redirect URIs</strong>, ajoute <em>exactement</em>&nbsp;:
              <span class="copyfield">
                <code class="copyfield__value"></code>
                <button type="button" class="btn btn--ghost btn--mini" data-act="copy-uri">Copier</button>
              </span>
            </li>
            <li>Coche <strong>Web API</strong> et <strong>Web Playback SDK</strong>, puis <strong>Save</strong>.</li>
            <li>Ouvre <strong>Settings</strong>, copie ton <strong>Client ID</strong> et colle-le ci-dessous.</li>
          </ol>
          <form class="clientid" data-clientid-form autocomplete="off">
            <input class="search__input clientid__input" type="text" name="clientid"
              placeholder="Colle ici ton Client ID Spotify" aria-label="Ton Client ID Spotify" />
            <button type="submit" class="btn btn--primary">Enregistrer</button>
          </form>
          ${
            customId
              ? `<p class="hint spotify-help__saved">✅ Ton accès perso est configuré.
                   <button type="button" class="btn btn--ghost btn--mini" data-act="clear-id">Réinitialiser</button></p>`
              : ''
          }
          <p class="hint">Ensuite, clique <strong>Se connecter à Spotify</strong> ci-dessus&nbsp;: tu es redirigé vers Spotify puis ramené ici, prêt à jouer.</p>
        </div>
      </details>
      ${
        canSpotify
          ? ''
          : `<em class="hint">Config Spotify du serveur manquante (${(state.missing || []).join(', ')}).</em>`
      }
    `;

    // Valeurs injectées via propriété (jamais dans le HTML) pour éviter tout
    // souci d'échappement.
    const uriEl = this.banner.querySelector('.copyfield__value');
    if (uriEl) uriEl.textContent = redirectUri;
    const idInput = this.banner.querySelector('.clientid__input');
    if (idInput) idInput.value = customId;

    this.banner.querySelector('[data-act="spotify"]')?.addEventListener('click', () => this.cb.onConnectSpotify());
    this.banner.querySelector('[data-act="demo"]')?.addEventListener('click', () => this.cb.onDemo());

    const copyBtn = this.banner.querySelector('[data-act="copy-uri"]');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(redirectUri);
        const prev = copyBtn.textContent;
        copyBtn.textContent = 'Copié ✓';
        setTimeout(() => {
          copyBtn.textContent = prev;
        }, 1500);
      } catch {
        this.toast("Copie impossible — sélectionne l'adresse et copie-la à la main.", 'info');
      }
    });

    this.banner.querySelector('[data-clientid-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = (idInput?.value || '').trim();
      if (!value) {
        this.toast("Colle d'abord ton Client ID Spotify.", 'info');
        return;
      }
      this.cb.onSaveClientId?.(value);
    });

    this.banner.querySelector('[data-act="clear-id"]')?.addEventListener('click', () => this.cb.onClearClientId?.());
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
