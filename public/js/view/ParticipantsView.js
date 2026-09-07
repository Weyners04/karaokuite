/**
 * ParticipantsView — écran d'inscription des joueurs avant la soirée.
 * Purement présentationnelle : liste, formulaire d'ajout, bouton "Continuer".
 */
export class ParticipantsView {
  /**
   * @param {object} refs - { root, list, form, input, continueBtn }
   * @param {{onAdd:(name:string)=>void, onRemove:(id:number)=>void, onContinue:()=>void}} callbacks
   */
  constructor(refs, callbacks) {
    this.root = refs.root;
    this.list = refs.list;
    this.form = refs.form;
    this.input = refs.input;
    this.continueBtn = refs.continueBtn;
    this.cb = callbacks;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.input.value.trim();
      if (!name) return;
      this.cb.onAdd(name);
      this.input.value = '';
      this.input.focus();
    });

    this.continueBtn.addEventListener('click', () => this.cb.onContinue());
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  focusInput() {
    this.input.focus();
  }

  /** @param {{id:number, name:string}[]} participants */
  render(participants) {
    this.list.innerHTML = '';
    for (const p of participants) {
      const li = document.createElement('li');
      li.className = 'participants__row';
      li.innerHTML = `
        <span class="participants__name">${escapeHtml(p.name)}</span>
        <button type="button" class="participants__remove" aria-label="Retirer ${escapeHtml(p.name)}">✕</button>
      `;
      li.querySelector('.participants__remove').addEventListener('click', () => this.cb.onRemove(p.id));
      this.list.appendChild(li);
    }
    this.continueBtn.disabled = participants.length === 0;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
