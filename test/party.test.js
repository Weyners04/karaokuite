import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PartyModel, PartyPhase, MusicMode, PersonMode } from '../public/js/model/PartyModel.js';
import { pickRandomTrack, sampleTracks } from '../public/js/lib/trackPicking.js';

// --- PartyModel : participants ---

test('addParticipant ajoute avec un id unique, rejette un nom vide', () => {
  const party = new PartyModel();
  const a = party.addParticipant('Alice');
  const b = party.addParticipant('Bob');
  assert.notEqual(a.id, b.id);
  assert.equal(party.participants.length, 2);
  assert.throws(() => party.addParticipant('   '));
  assert.throws(() => party.addParticipant(''));
});

test('removeParticipant retire le bon participant et ignore un id inconnu', () => {
  const party = new PartyModel();
  const a = party.addParticipant('Alice');
  party.addParticipant('Bob');
  party.removeParticipant(a.id);
  assert.equal(party.participants.length, 1);
  assert.equal(party.participants[0].name, 'Bob');
  assert.doesNotThrow(() => party.removeParticipant(9999));
});

test('enterSettings refuse sans aucun participant', () => {
  const party = new PartyModel();
  assert.throws(() => party.enterSettings());
  party.addParticipant('Alice');
  party.enterSettings();
  assert.equal(party.phase, PartyPhase.SETTINGS);
});

// --- Rotation solo ---

test('rotation solo boucle sur les participants dans l\'ordre d\'inscription', () => {
  const party = new PartyModel();
  party.addParticipant('Alice');
  party.addParticipant('Bob');
  party.addParticipant('Chloé');
  party.startParty();

  assert.equal(party.currentTurn().label, 'Alice');
  party.advanceTurn();
  assert.equal(party.currentTurn().label, 'Bob');
  party.advanceTurn();
  assert.equal(party.currentTurn().label, 'Chloé');
  party.advanceTurn();
  assert.equal(party.currentTurn().label, 'Alice'); // boucle
  assert.equal(party.currentTurn().kind, 'solo');
});

// --- Équipes ---

test('setTeamCount reconstruit teams et réinitialise assignments', () => {
  const party = new PartyModel();
  const a = party.addParticipant('Alice');
  party.setPersonMode(PersonMode.TEAM);
  party.setTeamCount(3);
  assert.equal(party.teams.length, 3);
  party.assignParticipantToTeam(a.id, 0);
  party.setTeamCount(2);
  assert.equal(party.teams.length, 2);
  assert.deepEqual(party.assignments, {});
});

test('setPersonMode(TEAM) matérialise tout de suite les équipes par défaut', () => {
  const party = new PartyModel();
  party.addParticipant('Alice');
  party.setPersonMode(PersonMode.TEAM);
  // Sans toucher au champ "nombre d'équipes" (resté à sa valeur par défaut),
  // les équipes doivent déjà exister — sinon canStartParty() refuse sans
  // raison visible à l'écran (bug observé : teamCount=2 affiché, teams=[]).
  assert.equal(party.teams.length, party.teamCount);
});

test('assignParticipantToTeam / unassignParticipant / getTeamMembers cohérents', () => {
  const party = new PartyModel();
  const a = party.addParticipant('Alice');
  const b = party.addParticipant('Bob');
  party.setPersonMode(PersonMode.TEAM);
  party.setTeamCount(2);

  party.assignParticipantToTeam(a.id, 0);
  party.assignParticipantToTeam(b.id, 0);
  assert.deepEqual(party.getTeamMembers(0).map((p) => p.name), ['Alice', 'Bob']);
  assert.equal(party.getTeamMembers(1).length, 0);

  party.unassignParticipant(a.id);
  assert.deepEqual(party.getTeamMembers(0).map((p) => p.name), ['Bob']);

  assert.throws(() => party.assignParticipantToTeam(9999, 0));
  assert.throws(() => party.assignParticipantToTeam(a.id, 9999));
});

test('canStartParty refuse le mode Équipe tant que tout n\'est pas assigné', () => {
  const party = new PartyModel();
  const a = party.addParticipant('Alice');
  const b = party.addParticipant('Bob');
  party.setPersonMode(PersonMode.TEAM);
  party.setTeamCount(2);

  assert.equal(party.canStartParty().ok, false); // personne assigné

  party.assignParticipantToTeam(a.id, 0);
  assert.equal(party.canStartParty().ok, false); // Bob pas assigné, équipe 1 vide

  party.assignParticipantToTeam(b.id, 0);
  assert.equal(party.canStartParty().ok, false); // équipe 1 toujours vide

  party.assignParticipantToTeam(b.id, 1);
  assert.equal(party.canStartParty().ok, true); // tout assigné, chaque équipe non vide
});

test('canStartParty accepte Choix multiple sans filtre (saisi à chaque tour, pas dans les paramètres)', () => {
  const party = new PartyModel();
  party.addParticipant('Alice');
  party.setMusicMode(MusicMode.MULTI);
  assert.equal(party.canStartParty().ok, true);
});

test('backToSettings puis startParty ne perd pas la progression des tours', () => {
  const party = new PartyModel();
  party.addParticipant('Alice');
  party.addParticipant('Bob');
  party.addParticipant('Chloé');
  party.startParty();
  party.advanceTurn(); // au tour de Bob
  assert.equal(party.currentTurn().label, 'Bob');

  party.backToSettings();
  assert.equal(party.phase, PartyPhase.SETTINGS);
  party.startParty(); // reprise, pas un nouveau départ
  assert.equal(party.currentTurn().label, 'Bob'); // toujours Bob, pas revenu à Alice
});

test('backToParticipants passe bien la phase, sans toucher aux participants', () => {
  const party = new PartyModel();
  party.addParticipant('Alice');
  party.enterSettings();
  party.backToParticipants();
  assert.equal(party.phase, PartyPhase.PARTICIPANTS);
  assert.equal(party.participants.length, 1);
});

test('rotation équipe boucle sur les équipes, pas sur les individus', () => {
  const party = new PartyModel();
  const a = party.addParticipant('Alice');
  const b = party.addParticipant('Bob');
  const c = party.addParticipant('Chloé');
  party.setPersonMode(PersonMode.TEAM);
  party.setTeamCount(2);
  party.assignParticipantToTeam(a.id, 0);
  party.assignParticipantToTeam(b.id, 1);
  party.assignParticipantToTeam(c.id, 1);
  party.startParty();

  const t1 = party.currentTurn();
  assert.equal(t1.kind, 'team');
  assert.equal(t1.label, 'Équipe 1');
  assert.deepEqual(t1.members, ['Alice']);

  party.advanceTurn();
  const t2 = party.currentTurn();
  assert.equal(t2.label, 'Équipe 2');
  assert.deepEqual(t2.members, ['Bob', 'Chloé']);

  party.advanceTurn();
  assert.equal(party.currentTurn().label, 'Équipe 1'); // boucle
});

test('reset() remet tout à zéro (y compris les participants), contrairement à advanceTurn()', () => {
  const party = new PartyModel();
  party.addParticipant('Alice');
  party.addParticipant('Bob');
  party.startParty();
  party.advanceTurn();
  assert.equal(party.participants.length, 2);

  party.reset();
  assert.equal(party.participants.length, 0);
  assert.equal(party.phase, PartyPhase.PARTICIPANTS);
  assert.equal(party.currentTurnIndex, 0);
});

// --- trackPicking ---

test('sampleTracks renvoie n éléments distincts, ou tous si moins de n disponibles', () => {
  const tracks = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const three = sampleTracks(tracks, 3);
  assert.equal(three.length, 3);
  assert.deepEqual(new Set(three.map((t) => t.id)), new Set([1, 2, 3]));

  const two = sampleTracks(tracks, 2);
  assert.equal(two.length, 2);

  const five = sampleTracks(tracks, 5);
  assert.equal(five.length, 3); // pas plus que ce qui existe
});

test('pickRandomTrack retente sur plusieurs graines et renvoie null après épuisement', async () => {
  const seeds = [
    { type: 'artist', query: 'artist:A', label: 'A' },
    { type: 'artist', query: 'artist:B', label: 'B' },
  ];

  // Aucune graine ne renvoie de résultat jouable -> null après avoir tout tenté.
  const calls = [];
  const emptySearchApi = async (q) => {
    calls.push(q);
    return [{ id: 'x', playable: false }];
  };
  const result = await pickRandomTrack(emptySearchApi, { seeds, attempts: 5 });
  assert.equal(result, null);
  assert.equal(calls.length, 2); // s'arrête une fois les graines épuisées, pas 5 tentatives inutiles

  // Une des graines renvoie un résultat jouable -> le retourne.
  const workingSearchApi = async (q) => {
    if (q === 'artist:B') return [{ id: 'ok', playable: true }];
    return [{ id: 'nope', playable: false }];
  };
  const found = await pickRandomTrack(workingSearchApi, { seeds, attempts: 5 });
  assert.equal(found.id, 'ok');
});
