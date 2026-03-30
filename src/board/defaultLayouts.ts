import type { BoardLayout, CompanyId, HexCell, HexType } from '../game/types';

// Génère un cluster hexagonal de 7 hexagones (1 centre + 6 voisins)
function hexCluster(
  centerQ: number,
  centerR: number,
  companyId: CompanyId | null,
  type: HexType = companyId ? 'entreprise' : 'libre',
): HexCell[] {
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];

  const cells: HexCell[] = [
    makeCell(centerQ, centerR, companyId, type),
    ...directions.map(d => makeCell(centerQ + d.q, centerR + d.r, companyId, type)),
  ];

  return cells;
}

function makeCell(
  q: number,
  r: number,
  companyId: CompanyId | null,
  type: HexType,
): HexCell {
  return {
    q, r, type,
    companyId,
    hasFactory: false,
    hasSchool: false,
    prospectionPawns: [],
    marketShareOwner: null,
    leasedFactory: null,
    leasedSchool: null,
  };
}

// ─── Layout par défaut pour 4 joueurs ───────────────────────
// Disposition inspirée de l'image du plateau :
// 8 clusters d'entreprises + 1 cluster neutre, hexagones libres/désertiques/océan autour

export function createDefault4PlayerLayout(): BoardLayout {
  const cells: HexCell[] = [];
  const occupied = new Set<string>();

  function addCells(newCells: HexCell[]) {
    for (const cell of newCells) {
      const key = `${cell.q},${cell.r}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        cells.push(cell);
      }
    }
  }

  // Clusters d'entreprises positionnés selon l'image
  //       Myrtille    Raisin
  //   Framboise  (neutre)  Litchi
  //       Banane      Fraise
  //   Orange      Kiwi

  addCells(hexCluster(-3, -1, 'framboise'));  // haut-gauche
  addCells(hexCluster(0, -3, 'myrtille'));     // haut-centre-gauche
  addCells(hexCluster(3, -4, 'raisin'));       // haut-centre-droit
  addCells(hexCluster(5, -3, 'litchi'));       // haut-droit
  addCells(hexCluster(0, 0, null, 'desert')); // centre (neutre/désertique)
  addCells(hexCluster(-3, 3, 'orange'));       // bas-gauche
  addCells(hexCluster(-1, 2, 'banane'));       // milieu-gauche
  addCells(hexCluster(2, 0, 'fraise'));        // milieu-droit
  addCells(hexCluster(3, 1, 'kiwi'));          // bas-droit

  // Cases entre les clusters : **libre** (prospection possible). Anneau extérieur du rectangle = **océan**.
  // Avant : tout était `ocean` → aucune case conquérable adjacente aux territoires.
  const minQ = Math.min(...cells.map(c => c.q)) - 1;
  const maxQ = Math.max(...cells.map(c => c.q)) + 1;
  const minR = Math.min(...cells.map(c => c.r)) - 1;
  const maxR = Math.max(...cells.map(c => c.r)) + 1;

  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      const key = `${q},${r}`;
      if (!occupied.has(key)) {
        const neighbors = [
          { q: q + 1, r }, { q: q - 1, r }, { q, r: r + 1 },
          { q, r: r - 1 }, { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 },
        ];
        const hasNeighbor = neighbors.some(n => occupied.has(`${n.q},${n.r}`));
        if (hasNeighbor) {
          occupied.add(key);
          const onSeaRing = q === minQ || q === maxQ || r === minR || r === maxR;
          const gapType: HexType = onSeaRing ? 'ocean' : 'libre';
          cells.push(makeCell(q, r, null, gapType));
        }
      }
    }
  }

  return {
    name: 'Standard 4 joueurs',
    playerCount: '2-4',
    cells,
  };
}
