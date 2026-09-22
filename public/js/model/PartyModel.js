/**
 * PartyModel — état et règles de la "soirée" (PUR, sans DOM) :
 *   - liste des participants (ordre d'inscription),
 *   - paramètres de la partie (mode de sélection musicale, moment du trou,
 *     mode joueurs),
 *   - équipes (si mode Équipe) et leurs assignations,
 *   - rotation des tours (qui chante ensuite).
 *
 * Ne connaît RIEN du morceau en cours, de la mise ou du trou : ça reste la
 * responsabilité exclusive de GameModel. GameController compose les deux.
 */

export const PartyPhase = {
  PARTICIPANTS: 'participants', // on inscrit les joueurs
  SETTINGS: 'settings', // choix des paramètres de la soirée
  PLAYING: 'playing', // la soirée a démarré, on tourne entre les participants/équipes
};

export const MusicMode = {
  FREE: 'free', // recherche libre (mode déjà existant)
  MULTI: 'multi', // filtre artiste/genre -> 3 propositions
  RANDOM: 'random', // morceau totalement aléatoire, aucun choix
};

export const HoleZone = {
  FULL: 'full', // la coupure peut tomber n'importe où dans le morceau
  FIRST_90S: 'first90s', // la coupure tombe dans les 90 premières secondes
};

export const PersonMode = {
  SOLO: 'solo', // chaque participant chante à son tour
  TEAM: 'team', // les participants sont répartis en équipes
};

export class PartyModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.participants = []; // [{id, name}]
    this._nextId = 1;
    this.phase = PartyPhase.PARTICIPANTS;
    this.musicMode = MusicMode.FREE;
    this.multiFilter = ''; // ex: "artist:Angèle" ou "genre:rap français"
    this.holeZone = HoleZone.FULL;
    this.personMode = PersonMode.SOLO;
    this.teamCount = 2;
    this.teams = []; // [{id, label}]
    this.assignments = {}; // { [participantId]: teamId }
    this.currentTurnIndex = 0;
    this._hasStarted = false; // distingue "1er lancement" d'un simple retour aux paramètres
  }

  // --- Participants ---

  /**
   * @param {string} name
   * @returns {{id:number, name:string}}
   */
  addParticipant(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Le nom du participant ne peut pas être vide.');
    const participant = { id: this._nextId++, name: trimmed };
    this.participants.push(participant);
    return participant;
  }

  /** @param {number} id */
  removeParticipant(id) {
    this.participants = this.participants.filter((p) => p.id !== id);
    delete this.assignments[id];
  }

  // --- Paramètres : choix de musique ---

  /** @param {string} mode - une valeur de MusicMode */
  setMusicMode(mode) {
    if (!Object.values(MusicMode).includes(mode)) throw new Error(`Mode de musique invalide : ${mode}`);
    this.musicMode = mode;
  }

  /**
   * Mémorise le dernier filtre utilisé en mode Choix multiple (juste pour
   * pré-remplir le champ au tour suivant — la recherche elle-même se fait
   * à chaque tour, pas une seule fois dans les paramètres).
   * @param {string} text
   */
  setMultiFilter(text) {
    this.multiFilter = (text || '').trim();
  }

  // --- Paramètres : moment du trou ---

  /** @param {string} zone - une valeur de HoleZone */
  setHoleZone(zone) {
    if (!Object.values(HoleZone).includes(zone)) throw new Error(`Moment du trou invalide : ${zone}`);
    this.holeZone = zone;
  }

  // --- Paramètres : personnes / équipes ---

  /** @param {string} mode - une valeur de PersonMode */
  setPersonMode(mode) {
    if (!Object.values(PersonMode).includes(mode)) throw new Error(`Mode de joueurs invalide : ${mode}`);
    this.personMode = mode;
    if (mode === PersonMode.SOLO) {
      // Hygiène : pas d'équipes fantômes si on repasse en solo puis en équipe.
      this.teams = [];
      this.assignments = {};
    } else if (this.teams.length === 0) {
      // Matérialise tout de suite les équipes par défaut (teamCount) : sans
      // ça, `teams` reste vide tant que l'utilisateur ne touche pas le champ
      // "nombre d'équipes", même si l'écran affiche déjà une valeur par
      // défaut — canStartParty() refuserait alors sans raison visible.
      this.setTeamCount(this.teamCount);
    }
  }

  /** @param {number} n - au moins 2 équipes */
  setTeamCount(n) {
    const count = Number(n);
    if (!Number.isInteger(count) || count < 2) throw new Error('Il faut au moins 2 équipes.');
    this.teamCount = count;
    this.teams = Array.from({ length: count }, (_, i) => ({ id: i, label: `Équipe ${i + 1}` }));
    // Changer le nombre d'équipes invalide les anciennes assignations (ids obsolètes).
    this.assignments = {};
  }

  /**
   * @param {number} participantId
   * @param {number} teamId
   */
  assignParticipantToTeam(participantId, teamId) {
    const participantExists = this.participants.some((p) => p.id === participantId);
    const teamExists = this.teams.some((t) => t.id === teamId);
    if (!participantExists) throw new Error(`Participant inconnu : ${participantId}`);
    if (!teamExists) throw new Error(`Équipe inconnue : ${teamId}`);
    this.assignments[participantId] = teamId;
  }

  /** @param {number} participantId */
  unassignParticipant(participantId) {
    delete this.assignments[participantId];
  }

  /**
   * @param {number} teamId
   * @returns {{id:number, name:string}[]}
   */
  getTeamMembers(teamId) {
    return this.participants.filter((p) => this.assignments[p.id] === teamId);
  }

  // --- Transitions de phase ---

  enterSettings() {
    if (this.participants.length === 0) throw new Error('Ajoute au moins un participant.');
    this.phase = PartyPhase.SETTINGS;
  }

  /** Retour aux paramètres depuis le karaoké (le tour en cours n'est PAS perdu). */
  backToSettings() {
    this.phase = PartyPhase.SETTINGS;
  }

  /** Retour à l'écran des participants depuis les paramètres. */
  backToParticipants() {
    this.phase = PartyPhase.PARTICIPANTS;
  }

  /**
   * Vérifie si la soirée peut démarrer, sans jamais lever d'exception —
   * pensé pour piloter en direct l'état (activé/désactivé) du bouton "Commencer".
   * @returns {{ok:boolean, reason:string|null}}
   */
  canStartParty() {
    if (this.participants.length === 0) {
      return { ok: false, reason: 'Ajoute au moins un participant.' };
    }
    if (this.personMode === PersonMode.TEAM) {
      if (this.teams.length < 2) {
        return { ok: false, reason: 'Il faut au moins 2 équipes.' };
      }
      const unassigned = this.participants.some((p) => !(p.id in this.assignments));
      if (unassigned) {
        return { ok: false, reason: 'Assigne chaque participant à une équipe.' };
      }
      const emptyTeam = this.teams.some((t) => this.getTeamMembers(t.id).length === 0);
      if (emptyTeam) {
        return { ok: false, reason: 'Chaque équipe doit avoir au moins un participant.' };
      }
    }
    return { ok: true, reason: null };
  }

  /**
   * Démarre (ou reprend, après un retour aux paramètres) la soirée. Ne remet
   * currentTurnIndex à 0 que lors du tout premier démarrage — revenir aux
   * paramètres pour ajuster un réglage puis recliquer "Commencer" ne doit
   * pas faire perdre la progression des tours déjà joués.
   */
  startParty() {
    const { ok, reason } = this.canStartParty();
    if (!ok) throw new Error(reason);
    this.phase = PartyPhase.PLAYING;
    if (!this._hasStarted) {
      this.currentTurnIndex = 0;
      this._hasStarted = true;
    }
  }

  // --- Rotation des tours ---

  #rotationLength() {
    return this.personMode === PersonMode.TEAM ? this.teams.length : this.participants.length;
  }

  /**
   * @returns {{kind:'solo'|'team', label:string, members:string[]}}
   */
  currentTurn() {
    const length = this.#rotationLength();
    if (length === 0) return { kind: this.personMode === PersonMode.TEAM ? 'team' : 'solo', label: '', members: [] };
    const idx = this.currentTurnIndex % length;

    if (this.personMode === PersonMode.TEAM) {
      const team = this.teams[idx];
      const members = this.getTeamMembers(team.id).map((p) => p.name);
      return { kind: 'team', label: team.label, members };
    }

    const participant = this.participants[idx];
    return { kind: 'solo', label: participant.name, members: [participant.name] };
  }

  /** Passe au participant/équipe suivant (boucle après le dernier). */
  advanceTurn() {
    this.currentTurnIndex += 1;
  }
}
