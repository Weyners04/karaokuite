/**
 * Morceau de démonstration — paroles ORIGINALES (écrites pour ce projet),
 * synchronisées à la main. Aucune dépendance externe, aucun souci de droits.
 *
 * Sert à tester tout le mécanisme (défilement, coupure, trou, révélation)
 * sans compte Spotify.
 *
 * Format identique à ce que renvoie /api/search : { lines: [{time,text,words}] }.
 */

function line(time, text) {
  return { time, text, words: text.split(/\s+/).filter(Boolean) };
}

export const DEMO_TRACK = {
  id: 'demo',
  uri: null,
  title: 'Chanson démo du blindtest',
  artist: 'Le Groupe des Soirées',
  album: 'Démo',
  durationMs: 60_000,
  cover: null,
  playable: true,
  lines: [
    line(1000, 'Ce soir on lance le blindtest entre amis'),
    line(4500, 'La musique tourne et personne ne dort ici'),
    line(8000, 'Tu choisis ta chanson et tu mises tes gorgées'),
    line(11500, 'Un peu de courage avant de te lancer'),
    line(15000, 'La mélodie avance et les mots vont défiler'),
    line(18500, 'Reste concentré tu vas bientôt chanter'),
    line(22000, 'Soudain le son se coupe au milieu du refrain'),
    line(25500, 'À toi de retrouver les mots qui viennent enfin'),
    line(29000, 'Si tu les trouves tu distribues sans trembler'),
    line(32500, 'Sinon tu bois et tu vas recommencer'),
    line(36000, 'Le rythme repart et la salle est en feu'),
    line(39500, 'Tout le monde reprend le refrain à deux'),
    line(43000, 'On lève nos verres pour la prochaine manche'),
    line(46500, 'La nuit est longue et la victoire se tranche'),
    line(50000, 'Encore une chanson avant de terminer'),
    line(53500, 'Ce soir on ne va pas oublier les paroles'),
  ],
};
