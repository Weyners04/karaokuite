import { BETS } from '../model/GameModel.js';
import { escapeHtml } from './trackCard.js';

// Compensation empirique : les paroles affichées avaient l'air "en retard"
// d'une phrase sur du matériel filaire (donc pas une histoire de latence
// Bluetooth) — probablement un léger décalage dans les timestamps LRCLIB
// et/ou notre synchro de position. On avance l'estimation du temps courant
// d'autant pour que la ligne active corresponde mieux à ce qu'on entend.
// À ajuster : augmenter si toujours en retard, diminuer si en avance.
const LYRICS_LEAD_MS = 1000;

/**
 * KaraokeView — tout l'affichage de la scène de jeu :
 *   - en-tête du morceau,
 *   - sélecteur de mise (gorgées),
 *   - paroles défilantes synchronisées,
 *   - "trou" (rangée de mots masqués facon marquee),
 *   - révélation + verdict.
 *
 * Purement présentationnelle : elle expose des méthodes et des callbacks,
 * le GameController décide quand les appeler.
 */
export class KaraokeView {
  constructor(refs, callbacks) {
    this.root = refs.stage;
    this.header = refs.header;
    this.betBar = refs.betBar;
    this.lyricsEl = refs.lyrics;
    this.waitingEl = refs.lyricsWaiting;
    this.answerEl = refs.answer;
    this.controls = refs.controls;
    this.progressEl = refs.progress;
    this.cb = callbacks; // { onBet, onStart, onReroll, onInitials, onReveal, onContinue, onVerdict, onReplay }

    this._lineEls = [];
    this._activeIndex = -1;
    this._trackDurationMs = 0;
    // Index de la ligne où commence le trou : jamais montrée en avance (ni
    // comme active, ni en aperçu "prochaine ligne") tant que le trou n'a pas
    // été officiellement déclenché — sinon la compensation de décalage ou
    // l'aperçu de la ligne suivante spoilerait la réponse.
    this._holeLineIndex = Infinity;

    this.#buildBetBar();
    this.#buildControls();
    this.#buildProgress();
  }

  // --- En-tête ---
  showTrack(track) {
    this.root.hidden = false;
    this.header.innerHTML = `
      <div class="np__cover" ${track.cover ? `style="background-image:url('${track.cover}')"` : ''}></div>
      <div class="np__meta">
        <div class="np__title">${escapeHtml(track.title)}</div>
        <div class="np__artist">${escapeHtml(track.artist)}</div>
      </div>`;
    this.answerEl.hidden = true;
    this.answerEl.innerHTML = '';
    this.startBtn.hidden = false;
    this.rerollBtn.hidden = true; // remis à jour par setRerollVisible() si pertinent pour ce mode
    this.controls.querySelector('[data-role="verdict"]').hidden = true;
    this.controls.querySelector('[data-role="reveal"]').hidden = true;
    this.initialsBtn.hidden = true;
    this.continueBtn.hidden = true;
    this.controls.querySelector('[data-role="result"]').textContent = '';
    this._trackDurationMs = track.durationMs || 0;
    this.updateTrackProgress(0);
  }

  hide() {
    this.root.hidden = true;
  }

  /** Affiche ou masque le bouton "Une autre chanson" (mode Aléatoire uniquement). */
  setRerollVisible(visible) {
    this.rerollBtn.hidden = !visible;
  }

  /**
   * Masque les boutons de lancement et verrouille la mise une fois le
   * karaoké démarré : changer de mise en pleine lecture repasserait le
   * modèle en phase READY et empêcherait le trou de se déclencher.
   */
  lockStart() {
    this.startBtn.hidden = true;
    this.rerollBtn.hidden = true;
    this.betBar.querySelectorAll('.bet__btn').forEach((btn) => {
      btn.disabled = true;
    });
  }

  // --- Sélecteur de mise ---
  #buildBetBar() {
    this.betBar.innerHTML =
      `<span class="bet__label">Ta mise&nbsp;:</span>` +
      BETS.map(
        (b) => `
        <button type="button" class="bet__btn" data-sips="${b.sips}">
          <strong>${b.label}</strong>
          <span>${b.wordsMin}-${b.wordsMax} mots à trouver</span>
        </button>`,
      ).join('');

    this.betBar.querySelectorAll('.bet__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setActiveBet(Number(btn.dataset.sips));
        this.cb.onBet(Number(btn.dataset.sips));
      });
    });
  }

  setActiveBet(sips) {
    this.betBar.querySelectorAll('.bet__btn').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.sips) === sips);
    });
    this.startBtn.disabled = false;
  }

  // --- Contrôles ---
  #buildControls() {
    this.controls.innerHTML = `
      <button type="button" class="btn btn--primary" data-role="start" disabled>Lancer le karaoké</button>
      <button type="button" class="btn btn--ghost" data-role="reroll" hidden>🎲 Une autre chanson (−1 gorgée)</button>
      <button type="button" class="btn btn--ghost" data-role="initials" hidden>🔤 Voir les initiales (mise divisée si trouvé, doublée si raté)</button>
      <button type="button" class="btn" data-role="reveal" hidden>Révéler la réponse</button>
      <div class="verdict" data-role="verdict" hidden>
        <span>Le groupe tranche&nbsp;:</span>
        <button type="button" class="btn btn--ok" data-verdict="ok">Trouvé ✓</button>
        <button type="button" class="btn btn--ko" data-verdict="ko">Raté ✗</button>
      </div>
      <button type="button" class="btn btn--ghost" data-role="continue" hidden>▶ Continuer la chanson</button>
      <p class="result" data-role="result" role="status"></p>
      <button type="button" class="btn btn--ghost" data-role="replay" hidden>Nouvelle chanson</button>
    `;
    this.startBtn = this.controls.querySelector('[data-role="start"]');
    this.rerollBtn = this.controls.querySelector('[data-role="reroll"]');
    this.initialsBtn = this.controls.querySelector('[data-role="initials"]');
    this.revealBtn = this.controls.querySelector('[data-role="reveal"]');
    this.verdictBox = this.controls.querySelector('[data-role="verdict"]');
    this.continueBtn = this.controls.querySelector('[data-role="continue"]');
    this.resultEl = this.controls.querySelector('[data-role="result"]');
    this.replayBtn = this.controls.querySelector('[data-role="replay"]');

    this.startBtn.addEventListener('click', () => this.cb.onStart());
    this.rerollBtn.addEventListener('click', () => this.cb.onReroll());
    this.initialsBtn.addEventListener('click', () => {
      this.initialsBtn.hidden = true; // usage unique par trou
      this.cb.onInitials();
    });
    this.revealBtn.addEventListener('click', () => this.cb.onReveal());
    this.continueBtn.addEventListener('click', () => {
      this.continueBtn.hidden = true; // usage unique : évite un double resume()
      this.cb.onContinue();
    });
    this.replayBtn.addEventListener('click', () => this.cb.onReplay());
    this.verdictBox.querySelectorAll('[data-verdict]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onVerdict(btn.dataset.verdict === 'ok'));
    });
  }

  // --- Barre de progression du morceau ---
  #buildProgress() {
    this.progressEl.innerHTML = `<div class="progress__fill"></div>`;
    this.progressFill = this.progressEl.querySelector('.progress__fill');
  }

  // --- Paroles ---
  mountLyrics(lines) {
    this.lyricsEl.innerHTML = '';
    this._lineEls = lines.map((line, i) => {
      const el = document.createElement('div');
      el.className = 'line is-future'; // caché tant que pas encore chanté
      el.dataset.index = String(i);
      if (line.words.length) {
        el.innerHTML = line.words.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
      } else {
        el.textContent = '♪';
      }
      this.lyricsEl.appendChild(el);
      return el;
    });
    // undefined (pas -1) : garantit que le tout premier appel à updateProgress
    // déclenche bien la mise à jour, même si le morceau démarre par une intro
    // (idx = -1 dès la 1ère frame, ce qui égalerait -1 et serait ignoré sinon).
    this._activeIndex = undefined;
    this._holeLineIndex = Infinity;
    this.waitingEl.classList.remove('is-visible');
  }

  /**
   * Indique la ligne où commence le trou à venir, pour que l'anticipation
   * (compensation de décalage + aperçu de la ligne suivante) ne la révèle
   * jamais avant le vrai déclenchement du trou.
   * @param {number} lineIndex
   */
  setHoleLineIndex(lineIndex) {
    this._holeLineIndex = lineIndex;
  }

  /**
   * Met à jour la ligne active selon le temps courant (ms), et estime la
   * progression mot par mot dans la ligne active (LRCLIB ne fournit que des
   * timestamps par ligne : on interpole linéairement jusqu'au début de la
   * ligne suivante pour simuler un surlignage façon karaoké).
   */
  updateProgress(timeMs, lines) {
    const adjustedTimeMs = timeMs + LYRICS_LEAD_MS;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= adjustedTimeMs) idx = i;
      else break;
    }
    // La compensation ne doit jamais anticiper jusqu'à la ligne du trou :
    // ce serait révéler la réponse avant le vrai déclenchement.
    if (idx >= this._holeLineIndex) idx = this._holeLineIndex - 1;

    if (idx !== this._activeIndex) {
      // La ligne qu'on quitte est entièrement "chantée".
      const leaving = this._lineEls[this._activeIndex];
      leaving?.querySelectorAll('.word').forEach((w) => w.classList.add('is-sung'));

      this._activeIndex = idx;
      this._lineEls.forEach((el, i) => {
        // Aperçu façon téléprompteur : la ligne juste après l'active reste
        // visible en petit — sauf si c'est justement la ligne du trou.
        const isNext = i === idx + 1 && i !== this._holeLineIndex;
        el.classList.toggle('is-active', i === idx);
        el.classList.toggle('is-past', i < idx);
        el.classList.toggle('is-next', isNext);
        el.classList.toggle('is-future', i > idx && !isNext); // masqué : pas de triche
      });
      // Avant la 1ère ligne chantée (intro instrumentale) : le montrer plutôt
      // que de laisser une boîte vide qui donne l'impression d'un blocage.
      this.waitingEl.classList.toggle('is-visible', idx === -1);
      this.#centerActiveLine(this._lineEls[idx]);
    }

    if (idx >= 0) {
      const line = lines[idx];
      const nextTime = lines[idx + 1]?.time ?? line.time + 3000;
      const span = Math.max(nextTime - line.time, 1);
      const fraction = Math.min(Math.max((adjustedTimeMs - line.time) / span, 0), 1);
      const sungCount = Math.floor(fraction * line.words.length);
      const wordEls = this._lineEls[idx].querySelectorAll('.word');
      wordEls.forEach((w, i) => w.classList.toggle('is-sung', i < sungCount));
    }
  }

  /**
   * Centre la ligne active à l'intérieur de la boîte des paroles, sans jamais
   * faire défiler la page (scrollIntoView remonte parfois jusqu'aux ancêtres
   * scrollables, ce qui fait "sauter" toute la page à chaque changement de ligne).
   *
   * On utilise getBoundingClientRect() plutôt que offsetTop : offsetTop est
   * relatif à l'offsetParent (ici .scene, le 1er ancêtre positionné — .lyrics
   * elle-même n'a pas de `position`), pas au conteneur de scroll réel. Avec
   * .lyrics en display:flex + justify-content:center et un contenu qui
   * déborde largement (des dizaines de lignes), ce décalage suffisait à
   * pousser la ligne active hors de la zone visible pendant une bonne partie
   * du morceau.
   */
  #centerActiveLine(el) {
    if (!el) return;
    const containerRect = this.lyricsEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target =
      this.lyricsEl.scrollTop + (elRect.top - containerRect.top) - containerRect.height / 2 + elRect.height / 2;
    this.lyricsEl.scrollTo({ top: target, behavior: 'smooth' });
  }

  /** Fait avancer la barre de progression globale du morceau (sans indiquer où tombera la coupure). */
  updateTrackProgress(timeMs) {
    if (!this._trackDurationMs) {
      this.progressFill.style.width = '0%';
      return;
    }
    const pct = Math.min(100, Math.max(0, (timeMs / this._trackDurationMs) * 100));
    this.progressFill.style.width = `${pct}%`;
  }

  // --- Trou ---
  /**
   * Affiche le trou : masque les lignes à venir et présente N cases vides.
   * @param {{startLineIndex:number, words:string[]}} hole
   */
  showHole(hole) {
    this.waitingEl.classList.remove('is-visible');
    // On masque tout ce qui vient à partir de la ligne du trou.
    this._lineEls.forEach((el, i) => {
      el.classList.toggle('is-hidden', i >= hole.startLineIndex);
    });
    this.lyricsEl.classList.add('is-frozen');

    this.answerEl.hidden = false;
    this.answerEl.innerHTML =
      `<span class="answer__tag">${hole.words.length} mots&nbsp;?</span>` +
      hole.words.map(() => `<span class="slot"></span>`).join('');
    this.answerEl.scrollIntoView({ block: 'center', behavior: 'smooth' });

    this.revealBtn.hidden = false;
    this.initialsBtn.hidden = false;
  }

  /** Affiche la 1ère lettre de chaque mot masqué (indice, avant la réponse complète). */
  showInitials(initials) {
    const slots = this.answerEl.querySelectorAll('.slot');
    initials.forEach((letter, i) => {
      if (slots[i]) {
        slots[i].textContent = letter;
        slots[i].classList.add('is-hint');
      }
    });
  }

  /** Remplit les cases avec les mots trouvés. */
  reveal(words) {
    const slots = this.answerEl.querySelectorAll('.slot');
    words.forEach((w, i) => {
      if (slots[i]) {
        slots[i].textContent = w;
        slots[i].classList.remove('is-hint');
        slots[i].classList.add('is-filled');
      }
    });
    this.revealBtn.hidden = true;
    this.initialsBtn.hidden = true;
    this.verdictBox.hidden = false;
    this.continueBtn.hidden = false; // au choix : reprendre le morceau avant de trancher
    // La réponse est révélée : plus rien à protéger. Sans ça, updateProgress()
    // reste plafonné pile sur la ligne du trou pour toujours, et "Continuer la
    // chanson" relance bien l'audio mais l'affichage des paroles reste figé.
    this._holeLineIndex = Infinity;
  }

  showResult(result) {
    this.verdictBox.hidden = true;
    // "Continuer la chanson" reste disponible après le verdict : le groupe
    // peut vouloir garder le morceau jusqu'à ce qu'il enchaîne vraiment sur
    // le suivant (via "Nouvelle chanson", qui coupe le son à ce moment-là).
    this.resultEl.textContent = result.instruction;
    this.resultEl.className = 'result ' + (result.found ? 'result--ok' : 'result--ko');
    this.replayBtn.hidden = false;
  }

  resetControls() {
    this.startBtn.disabled = true;
    this.betBar.querySelectorAll('.bet__btn').forEach((btn) => {
      btn.disabled = false;
    });
    this.lyricsEl.classList.remove('is-frozen');
  }
}
