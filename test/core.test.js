import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLrc, splitWords, hasUsableLyrics } from '../src/services/lrcParser.js';
import { GameModel, BETS, Phase } from '../public/js/model/GameModel.js';
import { durationsMatch, normalize } from '../src/utils/matchTrack.js';

// --- Exemple de paroles LRC (fictives, pour tester le parsing/la logique) ---
const SAMPLE_LRC = `[ar:Artiste Test]
[ti:Chanson Test]
[00:00.50] Ligne un avec plusieurs mots ici
[00:04.20] Ligne deux encore des mots
[00:08.00] Ligne trois toujours du texte
[00:12.10] Ligne quatre avec du contenu
[00:16.30] Ligne cinq pour la route
[00:20.00] Ligne six presque fini
[00:24.00] Ligne sept dernier bloc de mots
[00:28.00] Ligne huit fin de la chanson`;

test('splitWords découpe correctement', () => {
  assert.deepEqual(splitWords('  bonjour   le monde '), ['bonjour', 'le', 'monde']);
  assert.deepEqual(splitWords(''), []);
});

test('parseLrc extrait les lignes temporisées et ignore les métadonnées', () => {
  const lines = parseLrc(SAMPLE_LRC);
  assert.equal(lines.length, 8);
  assert.equal(lines[0].time, 500); // 00:00.50 -> 500ms
  assert.equal(lines[1].time, 4200); // 00:04.20 -> 4200ms
  assert.deepEqual(lines[0].words, ['Ligne', 'un', 'avec', 'plusieurs', 'mots', 'ici']);
});

test('parseLrc gère dixièmes, centièmes et millièmes', () => {
  const lines = parseLrc('[00:01.5] a\n[00:01.50] b\n[00:02.005] c');
  assert.equal(lines[0].time, 1500); // .5  -> dixièmes  -> 500ms
  assert.equal(lines[1].time, 1500); // .50 -> centièmes -> 500ms
  assert.equal(lines[2].time, 2005); // .005-> millièmes -> 5ms
});

test('hasUsableLyrics exige au moins 4 lignes de texte', () => {
  assert.equal(hasUsableLyrics(parseLrc(SAMPLE_LRC)), true);
  assert.equal(hasUsableLyrics(parseLrc('[00:01.00] seule ligne')), false);
});

test('durationsMatch tolère quelques secondes', () => {
  assert.equal(durationsMatch(200000, 201500), true); // 1.5s d'écart
  assert.equal(durationsMatch(200000, 210000), false); // 10s d'écart
});

test('normalize enlève accents et casse', () => {
  assert.equal(normalize('Éléphant (Remix)'), 'elephant');
});

// --- GameModel ---
function makeModel() {
  const model = new GameModel();
  model.setTrack({ id: 'x', title: 'T', lines: parseLrc(SAMPLE_LRC) });
  return model;
}

// Fixture dédiée à prepareHole() : longueurs de ligne volontairement variées
// (2 à 9 mots) pour vérifier que le trou reste toujours dans une seule ligne,
// avec un nombre de mots qui s'adapte à ce que la ligne contient réellement.
const GAME_LRC = `[00:00.00] Salut tout
[00:04.00] On commence le morceau avec une longue phrase
[00:08.00] Puis vient une courte
[00:12.00] Ensuite une phrase de taille moyenne
[00:16.00] Encore une phrase assez longue pour tester ça
[00:20.00] Trois mots seulement
[00:24.00] Cette ligne est vraiment la plus longue de toutes
[00:28.00] Sept mots pile pour la mise maximale
[00:32.00] Cinq mots pour la moyenne
[00:36.00] Fin voila`;

function makeGameModel() {
  const model = new GameModel();
  model.setTrack({ id: 'x', title: 'T', lines: parseLrc(GAME_LRC) });
  return model;
}

test('setBet mappe gorgées -> tranche de mots', () => {
  const model = makeModel();
  assert.deepEqual(model.setBet(1), { sips: 1, wordsMin: 3, wordsMax: 4, label: '1 gorgée' });
  assert.deepEqual(model.setBet(3), { sips: 3, wordsMin: 5, wordsMax: 6, label: '3 gorgées' });
  assert.deepEqual(model.setBet(5), { sips: 5, wordsMin: 7, wordsMax: 8, label: '5 gorgées' });
  assert.equal(model.phase, Phase.READY);
});

test('setBet refuse une mise invalide', () => {
  const model = makeModel();
  assert.throws(() => model.setBet(2));
});

test('prepareHole reste dans la tranche de mots de la mise', () => {
  for (const bet of BETS) {
    const model = makeGameModel();
    model.setBet(bet.sips);
    for (let i = 0; i < 30; i++) {
      const hole = model.prepareHole();
      assert.ok(hole.words.length >= bet.wordsMin && hole.words.length <= bet.wordsMax);
      assert.ok(hole.cutTimeMs > 0);
      assert.equal(typeof hole.startLineIndex, 'number');
    }
  }
});

test('prepareHole ne coupe jamais à cheval sur deux lignes', () => {
  const model = makeGameModel();
  for (const bet of BETS) {
    model.setBet(bet.sips);
    for (let i = 0; i < 30; i++) {
      const hole = model.prepareHole();
      const line = model.lines[hole.startLineIndex];
      // Le trou ne peut jamais dépasser le nombre de mots de sa propre ligne.
      assert.ok(hole.words.length <= line.words.length);
      // Les mots masqués sont exactement le début de CETTE ligne (aucun mot
      // emprunté à la ligne suivante).
      assert.deepEqual(hole.words, line.words.slice(0, hole.words.length));
    }
  }
});

test('prepareHole (mise 5 gorgées) ne choisit que des lignes assez longues', () => {
  const model = makeGameModel();
  model.setBet(5); // 7-8 mots : seules les lignes de 7+ mots peuvent qualifier
  for (let i = 0; i < 30; i++) {
    const hole = model.prepareHole();
    const line = model.lines[hole.startLineIndex];
    assert.ok(line.words.length >= 7, `ligne "${line.text}" a moins de 7 mots`);
  }
});

test('prepareHole commence toujours en début de ligne', () => {
  const model = makeGameModel();
  model.setBet(1);
  // On répète pour couvrir l'aléatoire.
  for (let i = 0; i < 50; i++) {
    const hole = model.prepareHole();
    const line = model.lines[hole.startLineIndex];
    // Le premier mot masqué doit être le premier mot de sa ligne.
    assert.equal(hole.words[0], line.words[0]);
    // Le temps de coupure doit correspondre au temps de cette ligne.
    assert.equal(hole.cutTimeMs, line.time);
  }
});

test('setVerdict renvoie la bonne instruction', () => {
  const model = makeModel();
  model.setBet(3);
  model.prepareHole();
  const win = model.setVerdict(true);
  assert.equal(win.sips, 3);
  assert.match(win.instruction, /Distribue 3 gorgées/);
  const lose = model.setVerdict(false);
  assert.match(lose.instruction, /bois 3 gorgées/);
});

test('useInitials refuse sans trou en cours', () => {
  const model = makeModel();
  model.setBet(1);
  assert.throws(() => model.useInitials());
});

test('useInitials renvoie la 1ère lettre en majuscule de chaque mot masqué', () => {
  const model = makeModel();
  model.setBet(1);
  const hole = model.prepareHole();
  const initials = model.useInitials();
  assert.deepEqual(initials, hole.words.map((w) => w[0].toUpperCase()));
  assert.equal(model.usedInitials, true);
});

test('setVerdict avec indice "initiales" : divise si trouvé, double si raté', () => {
  const found = makeModel();
  found.setBet(3); // 3 gorgées de base
  found.prepareHole();
  found.useInitials();
  const win = found.setVerdict(true);
  assert.equal(win.sips, 2); // ceil(3/2) = 2, pas 3
  assert.equal(win.usedInitials, true);
  assert.match(win.instruction, /initiales/);

  const lost = makeModel();
  lost.setBet(3);
  lost.prepareHole();
  lost.useInitials();
  const lose = lost.setVerdict(false);
  assert.equal(lose.sips, 6); // 3*2 = 6, pas 3
  assert.match(lose.instruction, /doublée/);
});

test('setVerdict sans indice "initiales" reste inchangé (sips = mise de base)', () => {
  const model = makeModel();
  model.setBet(1);
  model.prepareHole();
  const win = model.setVerdict(true);
  assert.equal(win.sips, 1);
  assert.equal(win.usedInitials, false);
});

test('checkTypedAnswer compare de façon souple', () => {
  const model = makeModel();
  model.setBet(1);
  const hole = model.prepareHole();
  const exact = hole.words.join(' ');
  assert.equal(model.checkTypedAnswer(exact), true);
  assert.equal(model.checkTypedAnswer(exact.toUpperCase() + ' !'), true);
  assert.equal(model.checkTypedAnswer('reponse totalement fausse xyz'), false);
});
