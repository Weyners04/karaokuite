import { SpotifyAuth } from './lib/pkce.js';
import { NavBackView } from './view/NavBackView.js';
import { ParticipantsView } from './view/ParticipantsView.js';
import { SettingsView } from './view/SettingsView.js';
import { TurnBannerView } from './view/TurnBannerView.js';
import { SearchView } from './view/SearchView.js';
import { TrackPickerView } from './view/TrackPickerView.js';
import { KaraokeView } from './view/KaraokeView.js';
import { StatusView } from './view/StatusView.js';
import { GameController } from './controller/GameController.js';

/** Petit wrapper de l'API de recherche du backend. */
async function searchApi(q, limit) {
  const params = new URLSearchParams({ q });
  if (limit) params.set('limit', String(limit));
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur recherche (${res.status})`);
  }
  const data = await res.json();
  return data.tracks;
}

async function boot() {
  // 1. Config publique (client_id Spotify, redirect_uri).
  const cfg = await fetch('/api/config').then((r) => r.json());
  const auth = new SpotifyAuth(cfg.spotify);

  // 2. Références DOM.
  const $ = (id) => document.getElementById(id);

  const navBackView = new NavBackView({ root: $('nav-back') });

  const participantsView = new ParticipantsView(
    {
      root: $('participants'),
      list: $('participants-list'),
      form: $('participants-form'),
      input: $('participant-input'),
      continueBtn: $('participants-continue'),
    },
    {
      onAdd: (name) => controller.addParticipant(name),
      onRemove: (id) => controller.removeParticipant(id),
      onContinue: () => controller.goToSettings(),
    },
  );

  const settingsView = new SettingsView(
    {
      root: $('settings'),
      musicMode: $('music-mode'),
      multiHint: $('multi-hint'),
      personMode: $('person-mode'),
      teamSetup: $('team-setup'),
      teamCountInput: $('team-count-input'),
      teamAssignList: $('team-assign-list'),
      startBtn: $('settings-start'),
      errorEl: $('settings-error'),
    },
    {
      onMusicMode: (mode) => controller.setMusicMode(mode),
      onPersonMode: (mode) => controller.setPersonMode(mode),
      onTeamCount: (n) => controller.setTeamCount(n),
      onAssign: (pid, tid) => controller.assignTeam(pid, tid),
      onStart: () => controller.startParty(),
    },
  );

  const turnView = new TurnBannerView({ root: $('turn-banner') });

  const searchView = new SearchView(
    { root: $('search-panel'), form: $('search-form'), input: $('search-input'), results: $('results') },
    (track) => controller.setupTrack(track),
  );

  const pickerView = new TrackPickerView(
    {
      root: $('track-picker'),
      filterForm: $('picker-filter-form'),
      filterInput: $('picker-filter-input'),
      status: $('track-picker-status'),
      list: $('track-picker-list'),
    },
    {
      onSearch: (text) => controller.handleMultiSearch(text),
      onPick: (track) => controller.setupTrack(track),
    },
  );

  const karaokeView = new KaraokeView(
    {
      stage: $('stage'),
      header: $('now-playing'),
      progress: $('track-progress'),
      betBar: $('bet-bar'),
      lyrics: $('lyrics'),
      lyricsWaiting: $('lyrics-waiting'),
      answer: $('answer'),
      controls: $('controls'),
    },
    {
      onBet: (sips) => controller.setBet(sips),
      onStart: () => controller.start(),
      onReroll: () => controller.rerollRandomTrack(),
      onInitials: () => controller.useInitials(),
      onReveal: () => controller.reveal(),
      onContinue: () => controller.continueSong(),
      onVerdict: (found) => controller.verdict(found),
      onReplay: () => controller.replay(),
    },
  );
  const statusView = new StatusView(
    { banner: $('mode-banner'), toasts: $('toasts') },
    {
      onConnectSpotify: () => controller.useSpotify(),
      onDemo: () => controller.useDemo(),
    },
  );

  // 3. Contrôleur.
  const controller = new GameController(
    {
      navBack: navBackView,
      participants: participantsView,
      settings: settingsView,
      turn: turnView,
      search: searchView,
      picker: pickerView,
      karaoke: karaokeView,
      status: statusView,
    },
    auth,
    searchApi,
  );

  // 4. Retour de redirection OAuth ?
  try {
    await auth.handleRedirect();
  } catch (err) {
    statusView.toast(err.message, 'error');
  }

  // 5. État initial de la bannière source audio (affichée dans l'écran Paramètres).
  if (auth.isLoggedIn()) {
    // Connexion déjà valide → on arme le lecteur Spotify directement.
    controller.useSpotify();
  } else {
    statusView.renderMode({ mode: 'none', ready: cfg.ready, missing: cfg.missing });
  }

  window.addEventListener('beforeunload', () => controller.destroy());
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('toasts').innerHTML =
    `<div class="toast toast--error is-in">Erreur d'initialisation : ${err.message}</div>`;
});
