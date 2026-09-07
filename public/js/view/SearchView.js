import { renderTrackCard, escapeHtml } from './trackCard.js';

/**
 * SearchView — affichage de la recherche et des résultats.
 * Ne contient aucune logique de jeu : elle rend et émet des événements.
 */
export class SearchView {
  /**
   * @param {object} refs - { root, form, input, results }
   * @param {(track:object)=>void} onSelect - appelé quand un morceau jouable est choisi
   */
  constructor(refs, onSelect) {
    this.root = refs.root;
    this.form = refs.form;
    this.input = refs.input;
    this.results = refs.results;
    this.onSelect = onSelect;
    this.onSubmit = null;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = this.input.value.trim();
      if (q && this.onSubmit) this.onSubmit(q);
    });
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  setLoading(isLoading) {
    this.results.setAttribute('aria-busy', String(isLoading));
    if (isLoading) {
      this.results.innerHTML = `<p class="hint">Recherche en cours…</p>`;
    }
  }

  showError(message) {
    this.results.innerHTML = `<p class="hint error">${escapeHtml(message)}</p>`;
  }

  /** Referme la liste de résultats (ex : une fois un morceau choisi). */
  close() {
    this.results.innerHTML = '';
  }

  /** @param {object[]} tracks */
  render(tracks) {
    this.results.innerHTML = '';
    if (!tracks.length) {
      this.results.innerHTML = `<p class="hint">Aucun résultat.</p>`;
      return;
    }
    for (const track of tracks) {
      this.results.appendChild(renderTrackCard(track, this.onSelect));
    }
  }
}
