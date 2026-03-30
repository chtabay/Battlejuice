import type { BoardLayout, CompanyId, HexCell } from './types';
import { axialKey, hexNeighbors } from '../board/hexUtils';

/**
 * Présence d'une entreprise sur une case : part de marché détenue
 * ou pion de prospection (permet d'étendre depuis les deux).
 */
export function companyHasPresence(cell: HexCell, companyId: CompanyId): boolean {
  if (cell.marketShareOwner === companyId) return true;
  return cell.prospectionPawns.includes(companyId);
}

/**
 * Case "neutre" où l'on peut installer une part de marché par prospection.
 *
 * Sur le plateau par défaut il n'y a presque pas de cases `libre` : le vide entre
 * territoires est souvent `ocean`, le centre neutre est `désert`. Ne pas filtrer
 * uniquement sur `libre` sinon aucun déplacement n'est possible.
 *
 * Règles retenues (V1) :
 * - Pas d'expansion sur l'océan (pas de marché sur l'eau).
 * - Pas sur une case déjà possédée (marketShareOwner défini).
 * - Pas sur le cœur "entreprise" d'un cluster (réservé au territoire de départ).
 * - Désert, libre, embargo : oui.
 */
export function isProspectionTarget(cell: HexCell): boolean {
  if (cell.marketShareOwner) return false;
  if (cell.type === 'ocean') return false;
  if (cell.type === 'entreprise') return false;
  return cell.type === 'libre' || cell.type === 'desert' || cell.type === 'embargo';
}

function cellMap(board: BoardLayout): Map<string, HexCell> {
  return new Map(board.cells.map(c => [axialKey(c), c]));
}

/**
 * Cases neutres adjacentes à au moins une case où l'entreprise a une présence.
 * Voisinage = les 6 directions axiales (identique au rendu du plateau).
 */
export function findProspectionTargets(board: BoardLayout, companyId: CompanyId): HexCell[] {
  const byKey = cellMap(board);
  const out: HexCell[] = [];
  const seen = new Set<string>();

  for (const cell of board.cells) {
    if (!companyHasPresence(cell, companyId)) continue;
    for (const n of hexNeighbors(cell)) {
      const key = axialKey(n);
      if (seen.has(key)) continue;
      const neighbor = byKey.get(key);
      if (!neighbor || !isProspectionTarget(neighbor)) continue;
      seen.add(key);
      out.push(neighbor);
    }
  }
  return out;
}

/**
 * Cases possédées par un adversaire et adjacentes à notre présence (guerre des prix).
 */
export function findContestableEnemyCells(board: BoardLayout, companyId: CompanyId): HexCell[] {
  const byKey = cellMap(board);
  const out: HexCell[] = [];

  for (const cell of board.cells) {
    const owner = cell.marketShareOwner;
    if (!owner || owner === companyId) continue;
    let adjacentToUs = false;
    for (const n of hexNeighbors(cell)) {
      const neighbor = byKey.get(axialKey(n));
      if (neighbor && companyHasPresence(neighbor, companyId)) {
        adjacentToUs = true;
        break;
      }
    }
    if (adjacentToUs) out.push(cell);
  }
  return out;
}
