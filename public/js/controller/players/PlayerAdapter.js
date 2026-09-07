/**
 * Interface commune à tous les lecteurs (Spotify, Démo, plus tard YouTube...).
 *
 * Le GameController ne connaît QUE cette interface : il peut donc changer de
 * source audio sans rien modifier de la logique de jeu.
 *
 * Contrat :
 *   - ready()            : Promise résolue quand le lecteur est prêt
 *   - loadAndPlay(track) : charge et démarre un morceau
 *   - pause() / resume() / seek(ms)
 *   - getPositionMs()    : position de lecture courante (interpolée)
 *   - on(evt, cb)        : 'position' (à chaque tick), 'ended', 'error'
 *   - destroy()
 */
export class PlayerAdapter {
  #listeners = new Map();

  on(event, cb) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(cb);
    return () => this.#listeners.get(event)?.delete(cb);
  }

  emit(event, payload) {
    this.#listeners.get(event)?.forEach((cb) => cb(payload));
  }

  // --- À implémenter par les sous-classes ---
  async ready() { throw new Error('not implemented'); }
  async loadAndPlay(_track) { throw new Error('not implemented'); }
  async pause() { throw new Error('not implemented'); }
  async resume() { throw new Error('not implemented'); }
  async seek(_ms) { throw new Error('not implemented'); }
  getPositionMs() { return 0; }
  destroy() {}
}
