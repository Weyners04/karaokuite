import { renderTrackCard, escapeHtml } from './trackCard.js';

/**
 * TrackPickerView — écran de sélection du morceau pour les modes "Choix
 * multiple" (un formulaire de filtre à CHAQUE tour, puis 3 propositions à
 * choisir) et "Aléatoire" (juste un état de chargement, le morceau est
 * chargé automatiquement dès qu'il est trouvé — le formulaire ne s'affiche
 * jamais dans ce mode).
 */
export class TrackPickerView {
  /**
   * @param {object} refs - { root, filterForm, filterInput, status, list }
   * @param {{onSearch:(text:string)=>void, onPick:(track:object)=>void}} callbacks
   */
  constructor(refs, callbacks) {
    this.root = refs.root;
    this.filterForm = refs.filterForm;
    this.filterInput = refs.filterInput;
    this.status = refs.status;
    this.list = refs.list;
    this.cb = callbacks;

    this.filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.filterInput.value.trim();
      if (text) this.cb.onSearch(text);
    });
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  /**
   * Affiche le formulaire de filtre (mode Choix multiple, à chaque tour).
   * @param {string} [prefill] - dernier filtre utilisé, pour éviter de retaper
   */
  showFilterPrompt(prefill = '') {
    this.filterForm.hidden = false;
    this.filterInput.value = prefill;
    this.status.textContent = '';
    this.list.innerHTML = '';
  }

  /** @param {string} message */
  showLoading(message) {
    this.status.textContent = message;
    this.list.innerHTML = '';
  }

  /** @param {string} message */
  showError(message) {
    this.status.textContent = '';
    this.list.innerHTML = `<p class="hint error">${escapeHtml(message)}</p>`;
  }

  /** @param {object[]} tracks */
  showCandidates(tracks) {
    this.status.textContent = '';
    this.list.innerHTML = '';
    for (const track of tracks) {
      this.list.appendChild(renderTrackCard(track, this.cb.onPick));
    }
  }

  /** Vide l'écran (ex : un morceau vient d'être choisi). */
  close() {
    this.filterForm.hidden = true;
    this.status.textContent = '';
    this.list.innerHTML = '';
  }
}
