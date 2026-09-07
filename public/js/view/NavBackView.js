/**
 * NavBackView — bouton de retour unique, fixé en haut à gauche de l'écran
 * (toujours au même endroit, quel que soit l'écran affiché) : plus clair
 * qu'un bouton "retour" différent noyé dans chaque panneau.
 */
export class NavBackView {
  /** @param {{root:HTMLElement}} refs */
  constructor(refs) {
    this.root = refs.root;
    this._handler = null;
  }

  /**
   * @param {string} label - ex : "← Participants"
   * @param {()=>void} onClick
   */
  show(label, onClick) {
    this.root.hidden = false;
    this.root.textContent = label;
    if (this._handler) this.root.removeEventListener('click', this._handler);
    this._handler = onClick;
    this.root.addEventListener('click', this._handler);
  }

  hide() {
    this.root.hidden = true;
  }
}
