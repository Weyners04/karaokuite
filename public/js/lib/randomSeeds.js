/**
 * Bassin de "graines" pour le mode Aléatoire : Spotify n'a pas d'endpoint
 * "morceau au hasard", donc on tire une entrée ici, on lance une recherche
 * (syntaxe native Spotify `artist:`/`genre:`, passée telle quelle en `q`),
 * puis on choisit un résultat `playable` au hasard parmi la réponse.
 *
 * Curation volontairement orientée francophone/populaire pour maximiser les
 * chances de trouver rapidement des paroles synchronisées (LRCLIB).
 */
export const RANDOM_SEEDS = [
  { type: 'artist', query: 'artist:Angèle', label: 'Angèle' },
  { type: 'artist', query: 'artist:Stromae', label: 'Stromae' },
  { type: 'artist', query: 'artist:Orelsan', label: 'Orelsan' },
  { type: 'artist', query: 'artist:Aya Nakamura', label: 'Aya Nakamura' },
  { type: 'artist', query: 'artist:Nekfeu', label: 'Nekfeu' },
  { type: 'artist', query: 'artist:Vald', label: 'Vald' },
  { type: 'artist', query: 'artist:Damso', label: 'Damso' },
  { type: 'artist', query: 'artist:Bigflo & Oli', label: 'Bigflo & Oli' },
  { type: 'artist', query: 'artist:Louane', label: 'Louane' },
  { type: 'artist', query: 'artist:Clara Luciani', label: 'Clara Luciani' },
  { type: 'artist', query: 'artist:Gims', label: 'Gims' },
  { type: 'artist', query: 'artist:Jul', label: 'Jul' },
  { type: 'artist', query: 'artist:Soprano', label: 'Soprano' },
  { type: 'artist', query: 'artist:Indila', label: 'Indila' },
  { type: 'artist', query: 'artist:Grand Corps Malade', label: 'Grand Corps Malade' },
  { type: 'artist', query: 'artist:Christophe Maé', label: 'Christophe Maé' },
  { type: 'artist', query: 'artist:Zaz', label: 'Zaz' },
  { type: 'artist', query: 'artist:Dadju', label: 'Dadju' },
  { type: 'genre', query: 'genre:french pop', label: 'Pop française' },
  { type: 'genre', query: 'genre:chanson française', label: 'Chanson française' },
  { type: 'genre', query: 'genre:french hip hop', label: 'Rap français' },
  { type: 'genre', query: 'genre:pop', label: 'Pop' },
  { type: 'genre', query: 'genre:r&b francais', label: 'R&B français' },
  { type: 'genre', query: 'genre:variete francaise', label: 'Variété française' },
];
