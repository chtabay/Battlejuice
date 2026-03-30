// Coordonnées axiales (q, r) pour grille hexagonale flat-top.
// Référence : https://www.redblobgames.com/grids/hexagons/

export interface AxialCoord {
  q: number;
  r: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export const HEX_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },   // E
  { q: 1, r: -1 },  // NE
  { q: 0, r: -1 },  // NW
  { q: -1, r: 0 },  // W
  { q: -1, r: 1 },  // SW
  { q: 0, r: 1 },   // SE
];

export function hexNeighbors(hex: AxialCoord): AxialCoord[] {
  return HEX_DIRECTIONS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function axialKey(hex: AxialCoord): string {
  return `${hex.q},${hex.r}`;
}

export function parseAxialKey(key: string): AxialCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

// ─── Flat-top hex → pixel ───────────────────────────────────

export function hexToPixel(hex: AxialCoord, size: number): PixelCoord {
  const x = size * (3 / 2 * hex.q);
  const y = size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

export function pixelToHex(point: PixelCoord, size: number): AxialCoord {
  const q = (2 / 3 * point.x) / size;
  const r = (-1 / 3 * point.x + Math.sqrt(3) / 3 * point.y) / size;
  return hexRound({ q, r });
}

function hexRound(hex: AxialCoord): AxialCoord {
  const s = -hex.q - hex.r;
  let rq = Math.round(hex.q);
  let rr = Math.round(hex.r);
  const rs = Math.round(s);
  const qDiff = Math.abs(rq - hex.q);
  const rDiff = Math.abs(rr - hex.r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

// ─── SVG hex polygon points ────────────────────────────────

export function hexCorners(center: PixelCoord, size: number): PixelCoord[] {
  const corners: PixelCoord[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }
  return corners;
}

export function hexPolygonPoints(center: PixelCoord, size: number): string {
  return hexCorners(center, size)
    .map(c => `${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');
}
