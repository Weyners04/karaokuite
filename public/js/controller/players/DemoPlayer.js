import { PlayerAdapter } from './PlayerAdapter.js';

/**
 * Lecteur de démonstration (Web Audio API).
 *
 * Ne dépend d'aucun service externe : synthétise une petite ambiance musicale
 * et suit une horloge de lecture pausable. Sert à tester tout le mécanisme du
 * jeu (défilement, coupure, trou) sans Spotify.
 */
export class DemoPlayer extends PlayerAdapter {
  constructor() {
    super();
    this.ctx = null;
    this.master = null;
    this._elapsed = 0; // ms cumulés en lecture
    this._startedAt = 0; // performance.now() au dernier resume
    this._paused = true;
    this._durationMs = 60_000;
    this._loop = null;
    this._beat = 0;
  }

  async ready() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);
    return true;
  }

  async loadAndPlay(track) {
    this._durationMs = track.durationMs || 60_000;
    this._elapsed = 0;
    if (this.ctx.state !== 'running') {
      // Certains navigateurs laissent resume() en attente indéfiniment si le
      // geste utilisateur n'est pas reconnu : on échoue explicitement plutôt
      // que de bloquer silencieusement toute la partie.
      await Promise.race([
        this.ctx.resume(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Impossible de démarrer l'audio (bloqué par le navigateur). Réessaie en cliquant à nouveau.")),
            3000,
          ),
        ),
      ]);
    }
    this.#resumeClock();
    this.#startAmbience();
  }

  #resumeClock() {
    this._startedAt = performance.now();
    this._paused = false;
  }

  getPositionMs() {
    const pos = this._paused ? this._elapsed : this._elapsed + (performance.now() - this._startedAt);
    if (pos >= this._durationMs) this.emit('ended');
    return pos;
  }

  async pause() {
    if (this._paused) return;
    this._elapsed = this.getPositionMs();
    this._paused = true;
    // Coupe l'ambiance de façon nette (l'effet "le son se coupe").
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.02);
    clearInterval(this._loop);
  }

  async resume() {
    if (!this._paused) return;
    await this.ctx.resume();
    this.#resumeClock();
    this.#startAmbience();
  }

  async seek(ms) {
    this._elapsed = ms;
    if (!this._paused) this._startedAt = performance.now();
  }

  // --- Synthèse d'une ambiance simple (pad + basse par temps) ---
  #startAmbience() {
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.05);
    const notes = [130.81, 146.83, 164.81, 174.61]; // Do Ré Mi Fa (basse)
    clearInterval(this._loop);
    this._loop = setInterval(() => {
      if (this._paused) return;
      const t = this.ctx.currentTime;
      const freq = notes[this._beat % notes.length];
      this.#blip(freq, t, 0.28);
      this.#blip(freq * 2.01, t, 0.14); // harmonique légère
      this._beat++;
    }, 500);
  }

  #blip(freq, at, gain) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.5);
  }

  destroy() {
    clearInterval(this._loop);
    this.ctx?.close();
  }
}
