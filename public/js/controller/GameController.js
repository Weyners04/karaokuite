import { GameModel, Phase } from '../model/GameModel.js';
import { PartyModel, MusicMode, HoleZone } from '../model/PartyModel.js';
import { DEMO_TRACK } from '../lib/demoTrack.js';
import { pickRandomTrack, sampleTracks } from '../lib/trackPicking.js';
import { DemoPlayer } from './players/DemoPlayer.js';
import { SpotifyPlayer } from './players/SpotifyPlayer.js';

/**
 * GameController — chef d'orchestre.
 *
 * Relie le GameModel (règles d'un round : morceau/mise/trou), le PartyModel
 * (participants, paramètres, tours de la soirée), les Views (affichage) et
 * un PlayerAdapter (audio). Contient la boucle de synchronisation qui, à
 * chaque frame, lit la position de lecture, fait défiler les paroles et
 * déclenche la coupure au bon instant.
 *
 * Déroulé général : Participants → Paramètres → (par tour) sélection du
 * morceau selon le mode choisi → karaoké (GameModel, inchangé) → verdict →
 * tour suivant → retour à la sélection du morceau, en boucle.
 */

// On coupe quelques ms avant le mot pour ne pas laisser entendre le début.
const CUT_LEAD_MS = 80;

// Instant de coupure maximal selon le réglage "Moment du trou".
const MAX_CUT_MS = {
  [HoleZone.FULL]: Infinity,
  [HoleZone.FIRST_90S]: 90_000,
};

export class GameController {
  /**
   * @param {{ participants:import('../view/ParticipantsView.js').ParticipantsView,
   *           settings:import('../view/SettingsView.js').SettingsView,
   *           turn:import('../view/TurnBannerView.js').TurnBannerView,
   *           search:import('../view/SearchView.js').SearchView,
   *           picker:import('../view/TrackPickerView.js').TrackPickerView,
   *           karaoke:import('../view/KaraokeView.js').KaraokeView,
   *           status:import('../view/StatusView.js').StatusView }} views
   * @param {import('../lib/pkce.js').SpotifyAuth} auth
   * @param {(q:string, limit?:number)=>Promise<object[]>} searchApi
   */
  constructor(views, auth, searchApi) {
    this.model = new GameModel();
    this.party = new PartyModel();
    this.views = views;
    this.auth = auth;
    this.searchApi = searchApi;
    this.player = null;
    this.mode = 'none';
    this._raf = null;

    this.#wireViews();
  }

  #wireViews() {
    this.views.search.onSubmit = (q) => this.handleSearch(q);
  }

  // --- Étape 1 : participants ---
  addParticipant(name) {
    try {
      this.party.addParticipant(name);
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.views.participants.render(this.party.participants);
  }

  removeParticipant(id) {
    this.party.removeParticipant(id);
    this.views.participants.render(this.party.participants);
    this.#renderSettings(); // l'équipe assignée à ce participant peut avoir changé
  }

  goToSettings() {
    try {
      this.party.enterSettings();
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.views.participants.hide();
    this.views.settings.show();
    this.#renderSettings();
    this.views.navBack.show('← Participants', () => this.backToParticipants());
  }

  /** Retour à l'écran des participants depuis les paramètres. */
  backToParticipants() {
    this.party.backToParticipants();
    this.views.settings.hide();
    this.views.participants.show();
    this.views.participants.render(this.party.participants);
    this.views.navBack.hide(); // 1er écran : rien "avant"
  }

  /** Retour aux paramètres depuis le karaoké (n'avance PAS le tour). */
  backToSettings() {
    this.stopLoop();
    this.player?.pause?.().catch(() => {});
    this.model.reset();
    this.views.karaoke.resetControls();
    this.views.karaoke.hide();
    this.views.search.close();
    this.views.search.hide();
    this.views.picker.close();
    this.views.picker.hide();
    this.views.turn.hide();
    this.party.backToSettings();
    this.views.settings.show();
    this.#renderSettings();
    this.views.navBack.show('← Participants', () => this.backToParticipants());
  }

  // --- Étape 2 : paramètres ---
  setMusicMode(mode) {
    this.party.setMusicMode(mode);
    this.views.settings.renderMusicMode(this.party);
    this.#renderReadiness();
  }

  setHoleZone(zone) {
    this.party.setHoleZone(zone);
    this.views.settings.renderHoleZone(this.party);
  }

  setPersonMode(mode) {
    this.party.setPersonMode(mode);
    this.views.settings.renderPersonMode(this.party);
    this.views.settings.renderTeams(this.party);
    this.#renderReadiness();
  }

  setTeamCount(n) {
    try {
      this.party.setTeamCount(n);
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.views.settings.renderTeams(this.party);
    this.#renderReadiness();
  }

  assignTeam(participantId, teamId) {
    this.party.assignParticipantToTeam(participantId, teamId);
    this.views.settings.renderTeams(this.party);
    this.#renderReadiness();
  }

  #renderSettings() {
    this.views.settings.renderMusicMode(this.party);
    this.views.settings.renderHoleZone(this.party);
    this.views.settings.renderPersonMode(this.party);
    this.views.settings.renderTeams(this.party);
    this.#renderReadiness();
  }

  #renderReadiness() {
    if (this.mode === 'none') {
      this.views.settings.renderReadiness({ ok: false, reason: 'Choisis une source audio (Spotify ou Démo).' });
      return;
    }
    this.views.settings.renderReadiness(this.party.canStartParty());
  }

  startParty() {
    // Une source audio (Spotify ou Démo) doit être choisie avant de lancer :
    // sans ça, this.player reste null et le premier "Lancer le karaoké"
    // planterait (loadAndPlay sur null), quel que soit le mode de musique.
    if (this.mode === 'none') {
      this.views.status.toast('Choisis une source audio (Spotify ou Démo) avant de commencer.', 'info');
      return;
    }
    try {
      this.party.startParty();
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.views.settings.hide();
    this.views.turn.show();
    this.views.navBack.show('← Paramètres', () => this.backToSettings());
    this.#beginTurn();
  }

  // --- Étape 3 (par tour) : sélection du morceau selon le mode choisi ---
  async #beginTurn() {
    this.views.turn.render(this.party.currentTurn());

    // En mode démo, une seule chanson existe : les modes de sélection
    // musicale n'ont pas de sens, on charge toujours la démo.
    if (this.mode === 'demo') {
      this.setupTrack(DEMO_TRACK);
      return;
    }

    const musicMode = this.party.musicMode;

    if (musicMode === MusicMode.FREE) {
      this.views.search.show();
      return;
    }

    if (musicMode === MusicMode.MULTI) {
      // Le filtre se ressaisit à chaque tour (pas figé dans les paramètres) :
      // ça permet de varier l'artiste/le genre à chaque passage.
      this.views.picker.show();
      this.views.picker.showFilterPrompt(this.party.multiFilter);
      return;
    }

    if (musicMode === MusicMode.RANDOM) {
      this.views.picker.show();
      await this.#pickRandomForTurn();
    }
  }

  /**
   * Lance une recherche filtrée (mode Choix multiple) suite à la saisie du
   * joueur dans TrackPickerView, et propose 3 morceaux jouables au hasard.
   * @param {string} text - filtre artiste/genre saisi par le joueur
   */
  async handleMultiSearch(text) {
    this.party.setMultiFilter(text); // mémorisé pour pré-remplir le tour suivant
    this.views.picker.showLoading('Recherche…');
    try {
      const tracks = await this.searchApi(text, 10);
      const playable = tracks.filter((t) => t.playable);
      if (!playable.length) {
        this.views.picker.showError('Aucun morceau jouable trouvé pour ce filtre. Essaie un autre artiste/genre.');
        return;
      }
      this.views.picker.showCandidates(sampleTracks(playable, 3));
    } catch (err) {
      this.views.picker.showError(err.message);
    }
  }

  /** Tire et charge un morceau au hasard pour le tour en cours (mode Aléatoire). */
  async #pickRandomForTurn() {
    this.views.picker.showLoading('Tirage au sort…');
    const track = await pickRandomTrack(this.searchApi);
    if (!track) {
      this.views.picker.showError('Impossible de trouver un morceau jouable, réessaie.');
      return;
    }
    this.setupTrack(track);
  }

  /**
   * Le joueur ne veut vraiment pas chanter ce morceau tiré au hasard : on en
   * retire un autre, mais ça lui coûte une gorgée (sinon le hasard n'aurait
   * plus aucun enjeu).
   */
  async rerollRandomTrack() {
    if (this.mode === 'demo') return; // pas de relance en mode Démo (voir setupTrack)
    this.views.status.toast('Tu bois 1 gorgée pour changer de chanson… 🍻', 'info');
    this.stopLoop();
    this.player?.pause?.().catch(() => {});
    this.views.karaoke.hide();
    this.views.turn.show();
    this.views.picker.show();
    await this.#pickRandomForTurn();
  }

  // --- Choix de la source audio ---
  async useSpotify() {
    try {
      if (!this.auth.isLoggedIn()) {
        await this.auth.login(); // redirige — la suite se fera au retour
        return;
      }
      this.mode = 'spotify';
      this.player = new SpotifyPlayer(this.auth);
      this.player.on('error', (m) => this.views.status.toast(m, 'error'));
      await this.player.ready();
      this.views.status.renderMode({ mode: 'spotify', ready: true });
      this.views.status.toast('Spotify prêt !', 'ok');
      this.#renderReadiness();
    } catch (err) {
      this.views.status.toast(err.message, 'error');
    }
  }

  async useDemo() {
    this.mode = 'demo';
    this.player = new DemoPlayer();
    await this.player.ready();
    this.views.status.renderMode({ mode: 'demo', ready: true });
    this.#renderReadiness();
  }

  // --- Recherche (mode Libre) ---
  async handleSearch(q) {
    if (this.mode !== 'spotify') {
      this.views.status.toast('La recherche nécessite Spotify. (Mode démo : chanson fixe.)', 'info');
      return;
    }
    this.views.search.setLoading(true);
    try {
      const tracks = await this.searchApi(q);
      this.views.search.render(tracks);
    } catch (err) {
      this.views.search.showError(err.message);
    } finally {
      this.views.search.setLoading(false);
    }
  }

  // --- Préparation d'un morceau ---
  setupTrack(track) {
    this.stopLoop();
    this.model.reset();
    this.model.setTrack(track);
    this.views.search.close();
    this.views.search.hide();
    this.views.picker.close();
    this.views.picker.hide();
    this.views.karaoke.resetControls();
    this.views.karaoke.showTrack(track);
    this.views.karaoke.mountLyrics(track.lines);
    // Pas de relance en mode Démo : une seule chanson existe, "en retirer une
    // autre" n'a pas de sens et déclencherait une vraie recherche Spotify
    // inutile (le mode démo n'en a besoin d'aucune).
    this.views.karaoke.setRerollVisible(this.mode !== 'demo' && this.party.musicMode === MusicMode.RANDOM);
    this.views.karaoke.root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  setBet(sips) {
    this.model.setBet(sips);
  }

  // --- Lancement du karaoké ---
  async start() {
    if (this.model.phase !== Phase.READY) {
      this.views.status.toast('Choisis d’abord ta mise.', 'info');
      return;
    }
    const hole = this.model.prepareHole({ maxCutMs: MAX_CUT_MS[this.party.holeZone] });
    this.model.start();
    this.views.karaoke.setHoleLineIndex(hole.startLineIndex);

    try {
      await this.player.loadAndPlay(this.model.track);
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.views.karaoke.lockStart();
    this.startLoop(hole);
  }

  startLoop(hole) {
    const cutAt = hole.cutTimeMs - CUT_LEAD_MS;
    const tick = () => {
      const pos = this.player.getPositionMs();

      if (this.model.phase === Phase.PLAYING && pos >= cutAt) {
        this.triggerHole();
        return; // on arrête la boucle
      }
      this.views.karaoke.updateProgress(pos, this.model.lines);
      this.views.karaoke.updateTrackProgress(pos);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  async triggerHole() {
    this.stopLoop();
    this.model.triggerHole();
    await this.player.pause();
    this.views.karaoke.showHole(this.model.hole);
  }

  /** Indice "les initiales" : révèle la 1ère lettre de chaque mot masqué. */
  useInitials() {
    let initials;
    try {
      initials = this.model.useInitials();
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.views.karaoke.showInitials(initials);
  }

  reveal() {
    const words = this.model.reveal();
    this.views.karaoke.reveal(words);
  }

  /**
   * Optionnel après révélation : reprend la lecture du morceau (le groupe
   * peut vouloir réentendre la suite avant de trancher, ou juste continuer
   * à chanter). Le trou est déjà passé (model.phase === REVEALED, plus
   * PLAYING), donc réutiliser startLoop() ne peut pas le redéclencher.
   */
  async continueSong() {
    if (!this.player) return;
    try {
      await this.player.resume();
    } catch (err) {
      this.views.status.toast(err.message, 'error');
      return;
    }
    this.startLoop(this.model.hole);
  }

  verdict(found) {
    const result = this.model.setVerdict(found);
    this.views.karaoke.showResult(result);
  }

  /** Tour suivant : avance à la personne/équipe suivante, revient à la sélection du morceau. */
  replay() {
    this.stopLoop();
    // Coupe le son : si "Continuer la chanson" a été utilisé, la lecture
    // pourrait encore tourner en arrière-plan à ce stade.
    this.player?.pause?.().catch(() => {});
    this.model.reset();
    this.views.karaoke.resetControls();
    this.party.advanceTurn();
    this.#beginTurn();
  }

  destroy() {
    this.stopLoop();
    this.player?.destroy();
  }
}
