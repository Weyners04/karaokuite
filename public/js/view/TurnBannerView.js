/**
 * TurnBannerView — bannière persistante "Au tour de : X", visible pendant la
 * sélection du morceau ET pendant le karaoké.
 */
export class TurnBannerView {
  /** @param {{root:HTMLElement}} refs */
  constructor(refs) {
    this.root = refs.root;
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  /** @param {{kind:'solo'|'team', label:string, members:string[]}} turn */
  render(turn) {
    if (!turn.label) {
      this.root.innerHTML = '';
      return;
    }
    const suffix =
      turn.kind === 'team' && turn.members.length ? ` <span class="turnbanner__members">(${escapeHtml(turn.members.join(', '))})</span>` : '';
    this.root.innerHTML = `🎤 Au tour de : <strong>${escapeHtml(turn.label)}</strong>${suffix}`;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
