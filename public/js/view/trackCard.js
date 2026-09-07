/**
 * Rendu partagé d'une carte "morceau" (utilisé par SearchView et
 * TrackPickerView) + échappement HTML (utilisé aussi par KaraokeView).
 */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

/**
 * @param {object} track - morceau enrichi renvoyé par /api/search
 * @param {(track:object)=>void} onSelect - appelé au clic si le morceau est jouable
 * @returns {HTMLButtonElement}
 */
export function renderTrackCard(track, onSelect) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'track' + (track.playable ? '' : ' track--disabled');
  card.disabled = !track.playable;

  card.innerHTML = `
    <span class="track__cover" ${track.cover ? `style="background-image:url('${track.cover}')"` : ''}></span>
    <span class="track__meta">
      <span class="track__title">${escapeHtml(track.title)}</span>
      <span class="track__artist">${escapeHtml(track.artist)}</span>
    </span>
    <span class="track__badge">${track.playable ? 'Paroles ✓' : 'Pas de paroles synchro'}</span>
  `;

  if (track.playable) {
    card.addEventListener('click', () => onSelect(track));
  }
  return card;
}
