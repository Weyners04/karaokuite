import { MusicMode, PersonMode } from '../model/PartyModel.js';

const MUSIC_MODE_LABELS = [
  { mode: MusicMode.FREE, label: 'Sélection libre', hint: 'Tu cherches et choisis toi-même' },
  { mode: MusicMode.MULTI, label: 'Choix multiple', hint: '3 morceaux proposés selon un filtre' },
  { mode: MusicMode.RANDOM, label: 'Complètement aléatoire', hint: 'Aucun choix, la chance décide' },
];

const PERSON_MODE_LABELS = [
  { mode: PersonMode.SOLO, label: 'Seul', hint: 'Chacun son tour, dans l\'ordre d\'inscription' },
  { mode: PersonMode.TEAM, label: 'En équipe', hint: 'Les participants forment des équipes' },
];

/**
 * SettingsView — écran des paramètres de la soirée : source audio (banni��re
 * Spotify/Démo pilotée par StatusView, relocalisée ici), choix de musique,
 * personnes/équipes. Purement présentationnelle.
 */
export class SettingsView {
  /**
   * @param {object} refs - { root, musicMode, multiHint, personMode,
   *   teamSetup, teamCountInput, teamAssignList, startBtn, errorEl }
   * @param {object} callbacks - { onMusicMode, onPersonMode, onTeamCount,
   *   onAssign, onStart }
   */
  constructor(refs, callbacks) {
    this.root = refs.root;
    this.musicModeEl = refs.musicMode;
    this.multiHint = refs.multiHint;
    this.personModeEl = refs.personMode;
    this.teamSetup = refs.teamSetup;
    this.teamCountInput = refs.teamCountInput;
    this.teamAssignList = refs.teamAssignList;
    this.startBtn = refs.startBtn;
    this.errorEl = refs.errorEl;
    this.cb = callbacks;

    this.#buildOptions(this.musicModeEl, MUSIC_MODE_LABELS, (mode) => this.cb.onMusicMode(mode));
    this.#buildOptions(this.personModeEl, PERSON_MODE_LABELS, (mode) => this.cb.onPersonMode(mode));

    this.teamCountInput.addEventListener('change', (e) => this.cb.onTeamCount(Number(e.target.value)));
    this.startBtn.addEventListener('click', () => this.cb.onStart());
  }

  #buildOptions(container, entries, onSelect) {
    container.innerHTML = entries
      .map(
        (e) => `
        <button type="button" class="settings__option-btn" data-mode="${e.mode}">
          <strong>${e.label}</strong>
          <span>${e.hint}</span>
        </button>`,
      )
      .join('');
    container.querySelectorAll('.settings__option-btn').forEach((btn) => {
      btn.addEventListener('click', () => onSelect(btn.dataset.mode));
    });
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  /** @param {import('../model/PartyModel.js').PartyModel} party */
  renderMusicMode(party) {
    this.musicModeEl.querySelectorAll('.settings__option-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === party.musicMode);
    });
    this.multiHint.hidden = party.musicMode !== MusicMode.MULTI;
  }

  /** @param {import('../model/PartyModel.js').PartyModel} party */
  renderPersonMode(party) {
    this.personModeEl.querySelectorAll('.settings__option-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === party.personMode);
    });
    this.teamSetup.hidden = party.personMode !== PersonMode.TEAM;
    this.teamCountInput.value = party.teamCount;
  }

  /** @param {import('../model/PartyModel.js').PartyModel} party */
  renderTeams(party) {
    if (party.personMode !== PersonMode.TEAM) {
      this.teamAssignList.innerHTML = '';
      return;
    }
    this.teamAssignList.innerHTML = party.participants
      .map(
        (p) => `
        <div class="teamassign__row" data-participant="${p.id}">
          <span class="teamassign__name">${escapeHtml(p.name)}</span>
          <span class="teamassign__chips">
            ${party.teams
              .map(
                (t) => `
              <button type="button" class="teamassign__chip${party.assignments[p.id] === t.id ? ' is-active' : ''}" data-team="${t.id}">
                ${escapeHtml(t.label)}
              </button>`,
              )
              .join('')}
          </span>
        </div>`,
      )
      .join('');

    this.teamAssignList.querySelectorAll('.teamassign__row').forEach((row) => {
      const participantId = Number(row.dataset.participant);
      row.querySelectorAll('.teamassign__chip').forEach((chip) => {
        chip.addEventListener('click', () => this.cb.onAssign(participantId, Number(chip.dataset.team)));
      });
    });
  }

  /** @param {{ok:boolean, reason:string|null}} result */
  renderReadiness(result) {
    this.startBtn.disabled = !result.ok;
    this.errorEl.textContent = result.reason || '';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
