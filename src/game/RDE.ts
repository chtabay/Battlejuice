import type { RDEAction, RDEPosition, RDESubPosition, RDEZone } from './types';

// ─── Structure de la RDE ────────────────────────────────────
//
// FLUX BIDIRECTIONNEL dans les zones d'exploitation :
//   Droite (D) = DESCENDANT : Bleue ↓ → Verte ↓ → R&M bas / Orange
//   Gauche (G) = MONTANT   : Verte ↑ → Bleue ↑ → R&M haut / Rose
//
// Les sous-positions G/D déterminent la direction du flux.
// Avancer dans la même zone = aller vers la case suivante dans SA direction.
// Sauter à la zone suivante = toutes les cases de la zone suivante (libre choix G/D).
//
// ZONES SPÉCIALES (Rose / Orange) :
//   Rose   : C&C → RS → SO → OPA (direction unique, sortie → Bleue)
//   Orange : C&C → Brs → L&C → OPAble (direction unique, sortie → Verte)
//   C&C = entrée unique (premier dans la zone)
//   OPA / OPAble = répétables
//
// R&M (les deux) → Bleue OU Verte (n'importe quelle case, au choix)

export interface RDESlot {
  zone: RDEZone;
  action: RDEAction;
  subPositions: RDESubPosition[];
}

const ZONE_ROSE: RDESlot[] = [
  { zone: 'croissance_rose', action: 'cash_capital', subPositions: ['gauche'] },
  { zone: 'croissance_rose', action: 'salary_deal',  subPositions: ['gauche'] },
  { zone: 'croissance_rose', action: 'stock_option',  subPositions: ['gauche'] },
  { zone: 'croissance_rose', action: 'opa',            subPositions: ['gauche', 'droite'] },
];

const RM_HAUT: RDESlot = {
  zone: 'resultats_marche_haut', action: 'resultats_marche', subPositions: ['gauche'],
};

const ZONE_BLEUE: RDESlot[] = [
  { zone: 'exploitation_bleue', action: 'management',       subPositions: ['gauche', 'droite'] },
  { zone: 'exploitation_bleue', action: 'prospection',      subPositions: ['gauche', 'droite'] },
  { zone: 'exploitation_bleue', action: 'construction',     subPositions: ['gauche', 'droite'] },
  { zone: 'exploitation_bleue', action: 'guerre_des_prix',  subPositions: ['gauche', 'droite'] },
];

const ZONE_VERTE: RDESlot[] = [
  { zone: 'exploitation_verte', action: 'guerre_des_prix',  subPositions: ['gauche', 'droite'] },
  { zone: 'exploitation_verte', action: 'construction',     subPositions: ['gauche', 'droite'] },
  { zone: 'exploitation_verte', action: 'prospection',      subPositions: ['gauche', 'droite'] },
  { zone: 'exploitation_verte', action: 'management',       subPositions: ['gauche', 'droite'] },
];

const RM_BAS: RDESlot = {
  zone: 'resultats_marche_bas', action: 'resultats_marche', subPositions: ['gauche'],
};

const ZONE_ORANGE: RDESlot[] = [
  { zone: 'restructuration_orange', action: 'cash_capital',  subPositions: ['droite'] },
  { zone: 'restructuration_orange', action: 'bourse',        subPositions: ['gauche', 'droite'] },
  { zone: 'restructuration_orange', action: 'location_cash', subPositions: ['gauche', 'droite'] },
  { zone: 'restructuration_orange', action: 'opable',        subPositions: ['gauche', 'droite'] },
];

export const ALL_SLOTS: RDESlot[] = [
  ...ZONE_ROSE, RM_HAUT, ...ZONE_BLEUE, ...ZONE_VERTE, RM_BAS, ...ZONE_ORANGE,
];

// ─── Graphe des transitions ─────────────────────────────────

function pos(zone: RDEZone, action: RDEAction, sub: RDESubPosition): RDEPosition {
  return { zone, action, subPosition: sub };
}

function posKey(p: RDEPosition): string {
  return `${p.zone}:${p.action}:${p.subPosition}`;
}

function allPositions(slots: RDESlot[]): RDEPosition[] {
  return slots.flatMap(s => s.subPositions.map(sub => pos(s.zone, s.action, sub)));
}

function forwardPositions(slots: RDESlot[], fromIndex: number): RDEPosition[] {
  return slots.slice(fromIndex + 1).flatMap(
    s => s.subPositions.map(sub => pos(s.zone, s.action, sub)),
  );
}

function repeatablePosition(slot: RDESlot): RDEPosition[] {
  return slot.subPositions.map(sub => pos(slot.zone, slot.action, sub));
}

function backwardPositions(slots: RDESlot[], fromIndex: number): RDEPosition[] {
  return slots.slice(0, fromIndex).flatMap(
    s => s.subPositions.map(sub => pos(s.zone, s.action, sub)),
  );
}

function buildTransitionMap(): Map<string, RDEPosition[]> {
  const map = new Map<string, RDEPosition[]>();

  function add(from: RDEPosition, targets: RDEPosition[]) {
    const key = posKey(from);
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, ...targets]);
  }

  const allBleue = allPositions(ZONE_BLEUE);
  const allVerte = allPositions(ZONE_VERTE);
  const allOrange = allPositions(ZONE_ORANGE);
  const allRose = allPositions(ZONE_ROSE);
  const rmHaut = pos(RM_HAUT.zone, RM_HAUT.action, 'gauche');
  const rmBas = pos(RM_BAS.zone, RM_BAS.action, 'gauche');

  // ── Rose : avancer dans Rose + sortie vers Bleue ──
  for (let i = 0; i < ZONE_ROSE.length; i++) {
    const slot = ZONE_ROSE[i];
    const forward = forwardPositions(ZONE_ROSE, i);
    const isOPA = slot.action === 'opa';
    for (const sub of slot.subPositions) {
      add(pos(slot.zone, slot.action, sub), [
        ...forward,
        ...(isOPA ? repeatablePosition(slot) : []),
        ...allBleue,
      ]);
    }
  }

  // ── R&M haut → Bleue OU Verte ──
  for (const sub of RM_HAUT.subPositions) {
    add(pos(RM_HAUT.zone, RM_HAUT.action, sub), [...allBleue, ...allVerte]);
  }

  // ── Bleue : flux bidirectionnel selon G/D ──
  for (let i = 0; i < ZONE_BLEUE.length; i++) {
    const slot = ZONE_BLEUE[i];

    // D (descendant) : avancer = indices croissants, sortie → Verte
    if (slot.subPositions.includes('droite')) {
      const fwd = forwardPositions(ZONE_BLEUE, i);
      add(pos(slot.zone, slot.action, 'droite'), [...fwd, ...allVerte]);
    }

    // G (montant) : avancer = indices décroissants, sortie → R&M haut / Rose
    if (slot.subPositions.includes('gauche')) {
      const bwd = backwardPositions(ZONE_BLEUE, i);
      add(pos(slot.zone, slot.action, 'gauche'), [...bwd, rmHaut, ...allRose]);
    }
  }

  // ── Verte : flux bidirectionnel selon G/D ──
  for (let i = 0; i < ZONE_VERTE.length; i++) {
    const slot = ZONE_VERTE[i];

    // D (descendant) : avancer = indices croissants, sortie → R&M bas / Orange
    if (slot.subPositions.includes('droite')) {
      const fwd = forwardPositions(ZONE_VERTE, i);
      add(pos(slot.zone, slot.action, 'droite'), [...fwd, rmBas, ...allOrange]);
    }

    // G (montant) : avancer = indices décroissants, sortie → Bleue
    if (slot.subPositions.includes('gauche')) {
      const bwd = backwardPositions(ZONE_VERTE, i);
      add(pos(slot.zone, slot.action, 'gauche'), [...bwd, ...allBleue]);
    }
  }

  // ── R&M bas → Bleue OU Verte ──
  for (const sub of RM_BAS.subPositions) {
    add(pos(RM_BAS.zone, RM_BAS.action, sub), [...allBleue, ...allVerte]);
  }

  // ── Orange : avancer dans Orange + sortie vers Verte ──
  for (let i = 0; i < ZONE_ORANGE.length; i++) {
    const slot = ZONE_ORANGE[i];
    const forward = forwardPositions(ZONE_ORANGE, i);
    const isOPAble = slot.action === 'opable';
    for (const sub of slot.subPositions) {
      add(pos(slot.zone, slot.action, sub), [
        ...forward,
        ...(isOPAble ? repeatablePosition(slot) : []),
        ...allVerte,
      ]);
    }
  }

  return map;
}

const TRANSITION_MAP = buildTransitionMap();

export function getLegalMoves(current: RDEPosition): RDEPosition[] {
  const key = posKey(current);
  return TRANSITION_MAP.get(key) ?? [];
}

export function isLegalMove(from: RDEPosition, to: RDEPosition): boolean {
  return getLegalMoves(from).some(p => posKey(p) === posKey(to));
}

export function getSlotForPosition(position: RDEPosition): RDESlot | undefined {
  return ALL_SLOTS.find(
    s => s.zone === position.zone && s.action === position.action,
  );
}

// ─── Helpers d'affichage ────────────────────────────────────

export const ACTION_LABELS: Record<RDEAction, string> = {
  management: 'Management',
  prospection: 'Prospection',
  construction: 'Construction',
  guerre_des_prix: 'Guerre des Prix',
  resultats_marche: 'Résultats & Marché',
  cash_capital: 'Cash & Capital',
  bourse: 'Bourse',
  location_cash: 'Location & Cash',
  opable: 'OPAble',
  opa: 'OPA',
  stock_option: 'Stock-Option',
  salary_deal: 'Rachat Salarié',
};

export const ZONE_LABELS: Record<RDEZone, string> = {
  exploitation_bleue: 'Exploitation Bleue',
  exploitation_verte: 'Exploitation Verte',
  resultats_marche_haut: 'Résultats & Marché',
  resultats_marche_bas: 'Résultats & Marché',
  croissance_rose: 'Croissance',
  restructuration_orange: 'Restructuration',
};

export const ZONE_COLORS: Record<RDEZone, string> = {
  exploitation_bleue: '#42A5F5',
  exploitation_verte: '#66BB6A',
  resultats_marche_haut: '#9E9E9E',
  resultats_marche_bas: '#9E9E9E',
  croissance_rose: '#F48FB1',
  restructuration_orange: '#FFB74D',
};
