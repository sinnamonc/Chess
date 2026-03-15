/**
 * Opening recognition by matching move sequences.
 * Compact ECO-based database covering common openings.
 * Longest match wins — so "Sicilian Najdorf" beats plain "Sicilian Defense".
 */

interface OpeningEntry {
  name: string;
  eco: string;
  moves: string; // space-separated SAN moves
}

// Sorted roughly by length (longest first in each family) for greedy matching
const OPENINGS: OpeningEntry[] = [
  // Sicilian
  { eco: 'B97', name: 'Sicilian Najdorf, Poisoned Pawn', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Qb6' },
  { eco: 'B96', name: 'Sicilian Najdorf', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4' },
  { eco: 'B90', name: 'Sicilian Najdorf', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6' },
  { eco: 'B80', name: 'Sicilian Scheveningen', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6' },
  { eco: 'B60', name: 'Sicilian Richter-Rauzer', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5' },
  { eco: 'B56', name: 'Sicilian Classical', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6' },
  { eco: 'B50', name: 'Sicilian Defense', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3' },
  { eco: 'B33', name: 'Sicilian Sveshnikov', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5' },
  { eco: 'B30', name: 'Sicilian Defense', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4' },
  { eco: 'B23', name: 'Sicilian Closed', moves: 'e4 c5 Nc3' },
  { eco: 'B20', name: 'Sicilian Defense', moves: 'e4 c5' },

  // Ruy Lopez
  { eco: 'C92', name: 'Ruy Lopez, Closed', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O' },
  { eco: 'C88', name: 'Ruy Lopez, Closed', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3' },
  { eco: 'C84', name: 'Ruy Lopez, Closed', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7' },
  { eco: 'C80', name: 'Ruy Lopez, Open', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4' },
  { eco: 'C78', name: 'Ruy Lopez, Archangelsk', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5' },
  { eco: 'C77', name: 'Ruy Lopez, Morphy Defense', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6' },
  { eco: 'C71', name: 'Ruy Lopez, Modern Steinitz', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6' },
  { eco: 'C68', name: 'Ruy Lopez, Exchange', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6' },
  { eco: 'C65', name: 'Ruy Lopez, Berlin', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6' },
  { eco: 'C60', name: 'Ruy Lopez', moves: 'e4 e5 Nf3 Nc6 Bb5' },

  // Italian
  { eco: 'C54', name: 'Italian, Giuoco Piano', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3' },
  { eco: 'C53', name: 'Italian, Giuoco Piano', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5' },
  { eco: 'C57', name: 'Italian, Two Knights', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6' },
  { eco: 'C50', name: 'Italian Game', moves: 'e4 e5 Nf3 Nc6 Bc4' },

  // Scotch
  { eco: 'C45', name: 'Scotch Game', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4' },
  { eco: 'C44', name: 'Scotch Game', moves: 'e4 e5 Nf3 Nc6 d4' },

  // Petrov
  { eco: 'C42', name: "Petrov's Defense", moves: 'e4 e5 Nf3 Nf6' },

  // French
  { eco: 'C19', name: 'French Winawer', moves: 'e4 e6 d4 d5 Nc3 Bb4' },
  { eco: 'C11', name: 'French Classical', moves: 'e4 e6 d4 d5 Nc3 Nf6' },
  { eco: 'C10', name: 'French Defense', moves: 'e4 e6 d4 d5 Nc3' },
  { eco: 'C03', name: 'French Tarrasch', moves: 'e4 e6 d4 d5 Nd2' },
  { eco: 'C02', name: 'French Advance', moves: 'e4 e6 d4 d5 e5' },
  { eco: 'C01', name: 'French Exchange', moves: 'e4 e6 d4 d5 exd5' },
  { eco: 'C00', name: 'French Defense', moves: 'e4 e6 d4 d5' },
  { eco: 'C00', name: 'French Defense', moves: 'e4 e6' },

  // Caro-Kann
  { eco: 'B19', name: 'Caro-Kann Classical', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3' },
  { eco: 'B18', name: 'Caro-Kann Classical', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5' },
  { eco: 'B15', name: 'Caro-Kann', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4' },
  { eco: 'B12', name: 'Caro-Kann Advance', moves: 'e4 c6 d4 d5 e5' },
  { eco: 'B13', name: 'Caro-Kann Exchange', moves: 'e4 c6 d4 d5 exd5 cxd5' },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: 'e4 c6' },

  // Pirc / Modern
  { eco: 'B09', name: 'Pirc Austrian Attack', moves: 'e4 d6 d4 Nf6 Nc3 g6 f4' },
  { eco: 'B07', name: 'Pirc Defense', moves: 'e4 d6 d4 Nf6 Nc3' },
  { eco: 'B06', name: 'Modern Defense', moves: 'e4 g6' },

  // Scandinavian
  { eco: 'B01', name: 'Scandinavian Defense', moves: 'e4 d5' },

  // Alekhine
  { eco: 'B02', name: "Alekhine's Defense", moves: 'e4 Nf6' },

  // Queen's Gambit
  { eco: 'D37', name: "QGD, 5.Bf4", moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4' },
  { eco: 'D35', name: "Queen's Gambit Declined, Exchange", moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5' },
  { eco: 'D31', name: "Queen's Gambit Declined", moves: 'd4 d5 c4 e6 Nc3' },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: 'd4 d5 c4 dxc4' },
  { eco: 'D50', name: "Queen's Gambit Declined", moves: 'd4 d5 c4 e6 Nc3 Nf6' },
  { eco: 'D06', name: "Queen's Gambit", moves: 'd4 d5 c4' },

  // Slav
  { eco: 'D17', name: 'Slav Defense', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5' },
  { eco: 'D15', name: 'Slav Defense', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3' },
  { eco: 'D10', name: 'Slav Defense', moves: 'd4 d5 c4 c6' },

  // Nimzo-Indian / Queen's Indian / King's Indian / Grünfeld
  { eco: 'E32', name: 'Nimzo-Indian, Classical', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2' },
  { eco: 'E41', name: 'Nimzo-Indian, Hübner', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 c5' },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: 'd4 Nf6 c4 e6 Nc3 Bb4' },
  { eco: 'E15', name: "Queen's Indian Defense", moves: 'd4 Nf6 c4 e6 Nf3 b6' },
  { eco: 'E97', name: "King's Indian, Mar del Plata", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6' },
  { eco: 'E90', name: "King's Indian Defense", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3' },
  { eco: 'E80', name: "King's Indian, Sämisch", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3' },
  { eco: 'E70', name: "King's Indian Defense", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6' },
  { eco: 'E60', name: "King's Indian Defense", moves: 'd4 Nf6 c4 g6' },
  { eco: 'D85', name: 'Grünfeld, Exchange', moves: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4' },
  { eco: 'D80', name: 'Grünfeld Defense', moves: 'd4 Nf6 c4 g6 Nc3 d5' },

  // Catalan
  { eco: 'E04', name: 'Catalan, Open', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 dxc4' },
  { eco: 'E01', name: 'Catalan Opening', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2' },
  { eco: 'E00', name: 'Catalan Opening', moves: 'd4 Nf6 c4 e6 g3' },

  // London / Trompowsky / Torre
  { eco: 'D00', name: 'London System', moves: 'd4 d5 Bf4' },
  { eco: 'A45', name: 'Trompowsky Attack', moves: 'd4 Nf6 Bg5' },
  { eco: 'A46', name: 'Torre Attack', moves: 'd4 Nf6 Nf3 e6 Bg5' },

  // English
  { eco: 'A30', name: 'English, Symmetrical', moves: 'c4 c5' },
  { eco: 'A20', name: 'English Opening', moves: 'c4 e5' },
  { eco: 'A16', name: 'English Opening', moves: 'c4 Nf6 Nc3' },
  { eco: 'A10', name: 'English Opening', moves: 'c4' },

  // Réti
  { eco: 'A07', name: "Réti, King's Indian Attack", moves: 'Nf3 d5 g3 c5 Bg2' },
  { eco: 'A05', name: 'Réti Opening', moves: 'Nf3 Nf6' },
  { eco: 'A04', name: 'Réti Opening', moves: 'Nf3' },

  // Dutch
  { eco: 'A83', name: 'Dutch, Stonewall', moves: 'd4 f5 c4 Nf6 g3 e6 Bg2 d5' },
  { eco: 'A80', name: 'Dutch Defense', moves: 'd4 f5' },

  // Benoni / Benko
  { eco: 'A70', name: 'Benoni Defense', moves: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6' },
  { eco: 'A57', name: 'Benko Gambit', moves: 'd4 Nf6 c4 c5 d5 b5' },

  // Vienna
  { eco: 'C26', name: 'Vienna Game', moves: 'e4 e5 Nc3 Nf6' },
  { eco: 'C25', name: 'Vienna Game', moves: 'e4 e5 Nc3' },

  // King's Gambit
  { eco: 'C36', name: "King's Gambit Accepted", moves: 'e4 e5 f4 exf4 Nf3 d5' },
  { eco: 'C33', name: "King's Gambit Accepted", moves: 'e4 e5 f4 exf4' },
  { eco: 'C30', name: "King's Gambit", moves: 'e4 e5 f4' },

  // Bird
  { eco: 'A02', name: "Bird's Opening", moves: 'f4' },

  // Bare d4/e4 catchalls
  { eco: 'A40', name: "Queen's Pawn Game", moves: 'd4 e6' },
  { eco: 'D00', name: "Queen's Pawn Game", moves: 'd4 d5' },
  { eco: 'A45', name: "Queen's Pawn Game", moves: 'd4 Nf6' },
  { eco: 'A40', name: "Queen's Pawn Game", moves: 'd4' },
  { eco: 'B00', name: "King's Pawn Game", moves: 'e4' },
];

// Pre-sort by move count descending so longest match wins
const SORTED_OPENINGS = [...OPENINGS].sort((a, b) => {
  return b.moves.split(' ').length - a.moves.split(' ').length;
});

export interface OpeningInfo {
  name: string;
  eco: string;
}

/**
 * Identify the opening from a list of SAN moves (e.g. ["e4", "e5", "Nf3", ...]).
 * Returns the longest matching opening, or null if none found.
 */
export function identifyOpening(sanMoves: string[]): OpeningInfo | null {
  const moveStr = sanMoves.join(' ');

  for (const entry of SORTED_OPENINGS) {
    if (moveStr === entry.moves || moveStr.startsWith(entry.moves + ' ')) {
      return { name: entry.name, eco: entry.eco };
    }
  }

  return null;
}
