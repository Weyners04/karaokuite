/**
 * GameModel — état et règles du jeu (PUR, sans DOM).
 *
 * Responsabilités :
 *   - conserver le morceau sélectionné et ses paroles synchronisées,
 *   - gérer la mise (gorgées → nombre de mots à trouver),
 *   - choisir aléatoirement l'emplacement du "trou" et calculer l'instant
 *     exact où couper la musique,
 *   - exposer les mots masqués pour la révélation.
 *
 * Le modèle ne touche jamais au DOM : c'est la View qui affiche, le
 * Controller qui orchestre.
 */

/**
 * Table de mise : gorgées misées → tranche de mots masqués.
 * Une tranche (pas un nombre exact) laisse de la marge à prepareHole() pour
 * caler le trou sur un morceau de PHRASE complet (voir plus bas) plutôt que
 * de forcer un nombre pile qui déborderait sur la ligne suivante.
 */
export const BETS = [
  { sips: 1, wordsMin: 3, wordsMax: 4, label: '1 gorgée' },
  { sips: 3, wordsMin: 5, wordsMax: 6, label: '3 gorgées' },
  { sips: 5, wordsMin: 7, wordsMax: 8, label: '5 gorgées' },
];

/** Phases possibles du jeu. */
export const Phase = {
  IDLE: 'idle', // aucune chanson choisie
  READY: 'ready', // chanson + mise choisies, prêt à lancer
  PLAYING: 'playing', // karaoké en cours
  HOLE: 'hole', // musique coupée, trou affiché
  REVEALED: 'revealed', // réponse révélée, en attente du verdict
};

export class GameModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.track = null;
    /** @type {{time:number, text:string, words:string[]}[]} */
    this.lines = [];
    this.bet = null; // un élément de BETS
    this.hole = null; // { cutTimeMs, startLineIndex, words[] }
    this.phase = Phase.IDLE;
    this.lastVerdict = null; // true (trouvé) / false (raté) / null
    this.usedInitials = false; // indice "initiales" utilisé pour ce trou ?
  }

  /**
   * Sélectionne un morceau et ses paroles.
   * @param {object} track - morceau enrichi renvoyé par /api/search
   */
  setTrack(track) {
    this.track = track;
    this.lines = track.lines || [];
    this.bet = null;
    this.hole = null;
    this.lastVerdict = null;
    this.usedInitials = false;
    this.phase = this.lines.length ? Phase.IDLE : Phase.IDLE;
  }

  /**
   * Définit la mise à partir du nombre de gorgées.
   * @param {number} sips - 1, 3 ou 5
   */
  setBet(sips) {
    const bet = BETS.find((b) => b.sips === sips);
    if (!bet) throw new Error(`Mise invalide : ${sips}`);
    this.bet = bet;
    if (this.track && this.lines.length) this.phase = Phase.READY;
    return bet;
  }

  /**
   * Construit la liste "à plat" de tous les mots avec leur temps de ligne.
   * Ne sert plus qu'au repli de dernier recours dans prepareHole().
   * @returns {{word:string, lineIndex:number, wordIndex:number, time:number, firstOfLine:boolean}[]}
   */
  #flattenWords() {
    const flat = [];
    this.lines.forEach((line, lineIndex) => {
      line.words.forEach((word, wordIndex) => {
        flat.push({
          word,
          lineIndex,
          wordIndex,
          time: line.time,
          firstOfLine: wordIndex === 0,
        });
      });
    });
    return flat;
  }

  /**
   * Lignes dont le nombre de mots permet un trou "propre" (un vrai début de
   * phrase, jamais coupé à cheval sur la ligne suivante) pour la mise en
   * cours : au moins `wordsMin` mots, on en masque jusqu'à `wordsMax` mais
   * jamais plus que ce que contient la ligne.
   * @param {number} minLine
   * @param {number} maxLine
   * @returns {{lineIndex:number, n:number}[]}
   */
  #cleanHoleCandidates(minLine, maxLine) {
    const { wordsMin, wordsMax } = this.bet;
    const candidates = [];
    this.lines.forEach((line, lineIndex) => {
      if (lineIndex < minLine || lineIndex > maxLine) return;
      if (line.words.length < wordsMin) return;
      candidates.push({ lineIndex, n: Math.min(line.words.length, wordsMax) });
    });
    return candidates;
  }

  /**
   * Choisit aléatoirement l'emplacement du trou et calcule l'instant de coupure.
   *
   * Règles :
   *   - le trou masque entre `bet.wordsMin` et `bet.wordsMax` mots, TOUJOURS
   *     pris dans une seule et même ligne — jamais une suite de mots à
   *     cheval sur deux phrases différentes (ex: "et faire danser les
   *     diables et les"), qui n'a aucun sens à deviner ;
   *   - il commence en début de ligne (la coupure tombe pile sur un début de
   *     ligne, donc la musique s'arrête proprement) ;
   *   - on évite le tout début et la toute fin du morceau (15 % – 85 %).
   *
   * Repli si aucune ligne de la zone médiane n'est assez longue : on relâche
   * d'abord la zone, puis en dernier recours (paroles à vers très courts) on
   * retombe sur l'ancien algorithme mot-à-mot, qui peut chevaucher deux lignes.
   *
   * @returns {{cutTimeMs:number, startLineIndex:number, words:string[]}}
   */
  prepareHole() {
    if (!this.bet) throw new Error('Aucune mise définie.');
    const lineCount = this.lines.length;
    const minLine = Math.floor(lineCount * 0.15);
    const maxLine = Math.floor(lineCount * 0.85);

    let pool = this.#cleanHoleCandidates(minLine, maxLine);
    if (!pool.length) pool = this.#cleanHoleCandidates(0, lineCount - 1);

    if (pool.length) {
      const { lineIndex, n } = pool[Math.floor(Math.random() * pool.length)];
      const line = this.lines[lineIndex];
      this.hole = {
        cutTimeMs: line.time,
        startLineIndex: lineIndex,
        words: line.words.slice(0, n),
      };
      return this.hole;
    }

    // Dernier recours : chanson à vers très courts (ex: aucune ligne n'a
    // seulement 3 mots) — on retombe sur l'ancien algorithme, qui peut
    // enchaîner des mots de deux lignes différentes.
    const flat = this.#flattenWords();
    const n = this.bet.wordsMax;
    const fallback = flat
      .map((w, i) => ({ w, i }))
      .filter(({ w, i }) => w.firstOfLine && i + n <= flat.length)
      .map(({ i }) => i);

    if (fallback.length === 0) {
      throw new Error('Paroles trop courtes pour créer un trou.');
    }

    const startFlat = fallback[Math.floor(Math.random() * fallback.length)];
    const masked = flat.slice(startFlat, startFlat + n);

    this.hole = {
      cutTimeMs: masked[0].time,
      startLineIndex: masked[0].lineIndex,
      words: masked.map((m) => m.word),
    };
    return this.hole;
  }

  /** Passe en lecture. */
  start() {
    if (this.phase !== Phase.READY) return;
    this.phase = Phase.PLAYING;
  }

  /** Déclenche le trou (musique coupée). */
  triggerHole() {
    this.phase = Phase.HOLE;
  }

  /** Révèle la réponse. */
  reveal() {
    this.phase = Phase.REVEALED;
    return this.hole?.words || [];
  }

  /**
   * Indice "les initiales" : révèle la 1ère lettre de chaque mot masqué,
   * avant la réponse complète. Utilisable une fois par trou — active un
   * risque/récompense repris par setVerdict() : trouver malgré l'indice ne
   * rapporte plus que la moitié de la mise, rater la double.
   * @returns {string[]}
   */
  useInitials() {
    if (!this.hole) throw new Error('Aucun trou en cours.');
    this.usedInitials = true;
    return this.hole.words.map((w) => (w[0] || '').toUpperCase());
  }

  /**
   * Enregistre le verdict du groupe.
   * @param {boolean} found - true si le joueur a trouvé
   * @returns {{found:boolean, sips:number, usedInitials:boolean, instruction:string}}
   */
  setVerdict(found) {
    this.lastVerdict = found;
    const baseSips = this.bet?.sips ?? 0;
    const usedInitials = this.usedInitials;
    // Indice utilisé : trouver ne rapporte que la moitié (arrondie au-dessus,
    // pour ne jamais tomber à 0 gorgée), rater double la sanction.
    const sips = usedInitials ? (found ? Math.ceil(baseSips / 2) : baseSips * 2) : baseSips;

    let instruction;
    if (usedInitials && found) {
      instruction = `Trouvé grâce aux initiales ! Distribue ${sips} gorgée${sips > 1 ? 's' : ''} (mise divisée) aux autres joueurs.`;
    } else if (usedInitials) {
      instruction = `Raté malgré les initiales… Tu bois ${sips} gorgée${sips > 1 ? 's' : ''} (mise doublée).`;
    } else if (found) {
      instruction = `Trouvé ! Distribue ${sips} gorgée${sips > 1 ? 's' : ''} aux autres joueurs.`;
    } else {
      instruction = `Raté… Tu bois ${sips} gorgée${sips > 1 ? 's' : ''}.`;
    }

    return { found, sips, usedInitials, instruction };
  }

  /**
   * (Optionnel — mode saisie clavier) Compare une réponse tapée aux mots masqués.
   * Comparaison souple : casse, accents et ponctuation ignorés.
   * @param {string} typed
   * @returns {boolean}
   */
  checkTypedAnswer(typed) {
    if (!this.hole) return false;
    const norm = (s) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return norm(typed) === norm(this.hole.words.join(' '));
  }
}
