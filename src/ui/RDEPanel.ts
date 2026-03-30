import { ZONE_COLORS, getLegalMoves, ACTION_LABELS, ZONE_LABELS } from '../game/RDE';
import type { CompanyState, RDEAction, RDEPosition, RDEZone } from '../game/types';
import { COMPANIES } from '../game/types';

// ─── Slot definitions ──────────────────────────────────────

interface SlotDef {
  zone: RDEZone;
  action: RDEAction;
  label: string;
}

const SLOTS: SlotDef[] = [
  { zone: 'croissance_rose',        action: 'cash_capital',    label: 'Cash & Capital' },
  { zone: 'croissance_rose',        action: 'salary_deal',     label: 'Rachat Salarié' },
  { zone: 'croissance_rose',        action: 'stock_option',    label: 'Stock-Option' },
  { zone: 'croissance_rose',        action: 'opa',             label: 'OPA' },
  { zone: 'resultats_marche_haut',  action: 'resultats_marche', label: 'Résultats & Marché' },
  { zone: 'exploitation_bleue',     action: 'management',      label: 'Management' },
  { zone: 'exploitation_bleue',     action: 'prospection',     label: 'Prospection' },
  { zone: 'exploitation_bleue',     action: 'construction',    label: 'Construction' },
  { zone: 'exploitation_bleue',     action: 'guerre_des_prix', label: 'Guerre des Prix' },
  { zone: 'exploitation_verte',     action: 'guerre_des_prix', label: 'Guerre des Prix' },
  { zone: 'exploitation_verte',     action: 'construction',    label: 'Construction' },
  { zone: 'exploitation_verte',     action: 'prospection',     label: 'Prospection' },
  { zone: 'exploitation_verte',     action: 'management',      label: 'Management' },
  { zone: 'resultats_marche_bas',   action: 'resultats_marche', label: 'Résultats & Marché' },
  { zone: 'restructuration_orange', action: 'cash_capital',    label: 'Cash & Capital' },
  { zone: 'restructuration_orange', action: 'bourse',          label: 'Bourse' },
  { zone: 'restructuration_orange', action: 'location_cash',   label: 'Location & Cash' },
  { zone: 'restructuration_orange', action: 'opable',          label: 'OPAble' },
];

const N = SLOTS.length;

function findSlotIndex(pos: RDEPosition): number {
  return SLOTS.findIndex(s => s.zone === pos.zone && s.action === pos.action);
}

const ACTION_TIPS: Record<RDEAction, string> = {
  management:
    'Recruter des pions de prospection (3M chacun) et construire des écoles de management (5M). Les écoles augmentent la valeur marché.',
  prospection:
    'Déplacer les pions de prospection sur le plateau pour conquérir de nouvelles parts de marché dans les territoires adjacents.',
  construction:
    'Construire des usines (10M chacune). Chaque usine alimente jusqu\'à 3 parts de marché et génère des revenus.',
  guerre_des_prix:
    'Attaquer les parts de marché adverses sur les cases contestées. Résolution par comparaison de force (pions + usines).',
  resultats_marche:
    'Calculer les résultats financiers : revenus (parts approvisionnées × 3M) moins charges (usines, écoles, pions). Ajuster la trésorerie et le niveau.',
  cash_capital:
    'Verser des dividendes aux actionnaires depuis la trésorerie de l\'entreprise. Montant au choix du patron.',
  bourse:
    'Émettre ou racheter des cartes d\'actions sur le marché. Permet de lever des fonds ou de modifier l\'actionnariat.',
  location_cash:
    'Louer des usines à d\'autres entreprises pour générer du cash, ou emprunter du cash contre des actifs.',
  opable:
    'L\'entreprise est vulnérable à une OPA. Les actionnaires minoritaires peuvent tenter de prendre le contrôle. Case répétable.',
  opa:
    'Lancer une Offre Publique d\'Achat sur une entreprise en case OPAble. Achat hostile d\'actions pour devenir patron. Case répétable.',
  stock_option:
    'Le patron reçoit des stock-options : cartes d\'actions gratuites de son entreprise, renforçant son contrôle.',
  salary_deal:
    'Rachat salarié : les actionnaires peuvent revendre leurs cartes à l\'entreprise au prix du marché.',
};

// ─── SVG helpers ────────────────────────────────────────────

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

function svgTxt(x: number, y: number, text: string, attrs: Record<string, string | number> = {}): SVGTextElement {
  const e = svgEl('text', { x, y, 'font-family': 'system-ui, sans-serif', ...attrs }) as SVGTextElement;
  e.textContent = text;
  return e;
}

function contrast(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 128 ? '#1A1A2E' : '#FAFAFA';
}

// ═══════════════════════════════════════════════════════════
// DIAGRAM GEOMETRY — enlarged for readability
// ═══════════════════════════════════════════════════════════

const DG_W = 520, DG_ROW_H = 28, DG_ROW_S = 36;
const DG_COL_W = 115, DG_COL_GAP = 10;
const DG_LX = (DG_W - 2 * DG_COL_W - DG_COL_GAP) / 2;
const DG_RX = DG_LX + DG_COL_W + DG_COL_GAP;
const DG_FULL_W = 2 * DG_COL_W + DG_COL_GAP;
const DG_SIDE_W = 22;
const DG_FONT = 10;
const DG_FONT_SM = 8.5;
const DG_PAWN_R = 7;

const DG_ROSE_Y0 = 12;
const DG_RMH_Y0 = DG_ROSE_Y0 + 4 * DG_ROW_S + 14;
const DG_BLEUE_Y0 = DG_RMH_Y0 + DG_ROW_H + 14;
const DG_VERTE_Y0 = DG_BLEUE_Y0 + 4 * DG_ROW_S + 8;
const DG_RMB_Y0 = DG_VERTE_Y0 + 4 * DG_ROW_S + 12;
const DG_ORANGE_Y0 = DG_RMB_Y0 + DG_ROW_H + 14;
const DG_H = DG_ORANGE_Y0 + 4 * DG_ROW_S + 16;

function dgRowCY(zoneY0: number, row: number): number {
  return zoneY0 + 6 + row * DG_ROW_S + DG_ROW_H / 2;
}

type DgCol = 'L' | 'R' | 'D' | 'F';
interface DgSlotInfo { cy: number; col: DgCol }

const DG_SLOT_INFO: DgSlotInfo[] = [
  { cy: dgRowCY(DG_ROSE_Y0, 3), col: 'L' },
  { cy: dgRowCY(DG_ROSE_Y0, 2), col: 'L' },
  { cy: dgRowCY(DG_ROSE_Y0, 1), col: 'L' },
  { cy: dgRowCY(DG_ROSE_Y0, 0), col: 'D' },
  { cy: DG_RMH_Y0 + DG_ROW_H / 2, col: 'F' },
  { cy: dgRowCY(DG_BLEUE_Y0, 0), col: 'D' },
  { cy: dgRowCY(DG_BLEUE_Y0, 1), col: 'D' },
  { cy: dgRowCY(DG_BLEUE_Y0, 2), col: 'D' },
  { cy: dgRowCY(DG_BLEUE_Y0, 3), col: 'D' },
  { cy: dgRowCY(DG_VERTE_Y0, 0), col: 'D' },
  { cy: dgRowCY(DG_VERTE_Y0, 1), col: 'D' },
  { cy: dgRowCY(DG_VERTE_Y0, 2), col: 'D' },
  { cy: dgRowCY(DG_VERTE_Y0, 3), col: 'D' },
  { cy: DG_RMB_Y0 + DG_ROW_H / 2, col: 'F' },
  { cy: dgRowCY(DG_ORANGE_Y0, 0), col: 'R' },
  { cy: dgRowCY(DG_ORANGE_Y0, 1), col: 'D' },
  { cy: dgRowCY(DG_ORANGE_Y0, 2), col: 'D' },
  { cy: dgRowCY(DG_ORANGE_Y0, 3), col: 'D' },
];

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export class RDEPanel {
  private container: HTMLElement;
  private onMoveSelect: ((pos: RDEPosition) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'rde-panel';
    parent.appendChild(this.container);
  }

  setOnMoveSelect(cb: (pos: RDEPosition) => void) { this.onMoveSelect = cb; }

  render(companies: CompanyState[], currentCompanyId: string | null, showLegalMoves: boolean) {
    this.container.innerHTML = '';

    const currentCo = currentCompanyId ? companies.find(c => c.id === currentCompanyId) : undefined;

    const legalMoves = (showLegalMoves && currentCo) ? getLegalMoves(currentCo.rdePosition) : [];
    const legalSet = new Set<number>();
    for (const m of legalMoves) {
      const idx = findSlotIndex(m);
      if (idx >= 0) legalSet.add(idx);
    }

    this.renderStatusBar(currentCo, legalMoves);
    this.renderDiagram(companies, currentCompanyId, legalSet);
  }

  // ─── Status bar (text summary above diagram) ────────────

  private renderStatusBar(currentCo: CompanyState | undefined, legalMoves: RDEPosition[]) {
    const bar = document.createElement('div');
    bar.className = 'rde-status';

    if (!currentCo) {
      bar.textContent = 'Aucune entreprise sélectionnée';
      this.container.appendChild(bar);
      return;
    }

    const cfg = COMPANIES[currentCo.id];
    const pos = currentCo.rdePosition;

    const posLine = document.createElement('div');
    posLine.className = 'rde-status-pos';
    posLine.title = ACTION_TIPS[pos.action];
    const dot = document.createElement('span');
    dot.className = 'rde-status-dot';
    dot.style.background = cfg.color;
    posLine.appendChild(dot);
    posLine.appendChild(document.createTextNode(
      `${cfg.label} — ${ACTION_LABELS[pos.action]} (${ZONE_LABELS[pos.zone]})`
    ));
    bar.appendChild(posLine);

    if (legalMoves.length > 0) {
      const optLine = document.createElement('div');
      optLine.className = 'rde-status-options';
      optLine.appendChild(document.createTextNode('Options : '));

      const uniqueActions = new Map<string, { label: string; zone: RDEZone; action: RDEAction }>();
      for (const m of legalMoves) {
        const key = `${m.zone}:${m.action}`;
        if (!uniqueActions.has(key)) {
          uniqueActions.set(key, { label: ACTION_LABELS[m.action], zone: m.zone, action: m.action });
        }
      }

      let first = true;
      for (const { label, zone, action } of uniqueActions.values()) {
        if (!first) optLine.appendChild(document.createTextNode(', '));
        first = false;
        const chip = document.createElement('span');
        chip.className = 'rde-option-chip';
        chip.style.borderColor = ZONE_COLORS[zone];
        chip.style.color = ZONE_COLORS[zone];
        chip.textContent = label;
        chip.title = ACTION_TIPS[action];
        optLine.appendChild(chip);
      }

      bar.appendChild(optLine);
    }

    this.container.appendChild(bar);
  }

  // ─── Diagram ─────────────────────────────────────────────

  private renderDiagram(companies: CompanyState[], currentId: string | null, legal: Set<number>) {
    const s = this.createSvg(DG_W, DG_H);
    s.innerHTML += `<defs><filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter></defs>`;

    this.dgDrawZones(s);
    this.dgDrawArrows(s);
    for (let i = 0; i < N; i++) this.dgDrawSlot(s, i, companies, legal.has(i), currentId);
  }

  private dgDrawZones(p: SVGElement) {
    const bgX = DG_LX - 12, bgW = DG_FULL_W + 24;

    p.appendChild(svgEl('rect', { x: bgX, y: DG_ROSE_Y0, width: bgW, height: 4 * DG_ROW_S + 16, fill: ZONE_COLORS.croissance_rose, opacity: 0.12, rx: 5 }));
    p.appendChild(svgEl('rect', { x: bgX, y: DG_RMH_Y0 - 4, width: bgW, height: DG_ROW_H + 8, fill: '#757575', opacity: 0.15, rx: 4 }));

    const sideTop = DG_RMH_Y0 - 4;
    const sideBot = DG_RMB_Y0 + DG_ROW_H + 4;
    const leftX = bgX - DG_SIDE_W - 6;
    p.appendChild(svgEl('rect', { x: leftX, y: sideTop, width: DG_SIDE_W, height: sideBot - sideTop, fill: '#757575', opacity: 0.09, rx: 3 }));
    const lMidY = (sideTop + sideBot) / 2;
    const lbl_l = svgTxt(leftX + DG_SIDE_W / 2, lMidY, 'R&M', { 'font-size': DG_FONT_SM, fill: '#9E9E9E', 'text-anchor': 'middle', opacity: 0.7 });
    lbl_l.setAttribute('transform', `rotate(-90,${leftX + DG_SIDE_W / 2},${lMidY})`);
    p.appendChild(lbl_l);

    const rightX = bgX + bgW + 6;
    p.appendChild(svgEl('rect', { x: rightX, y: sideTop, width: DG_SIDE_W, height: sideBot - sideTop, fill: '#757575', opacity: 0.09, rx: 3 }));
    const rMidY = (sideTop + sideBot) / 2;
    const lbl_r = svgTxt(rightX + DG_SIDE_W / 2, rMidY, 'R&M', { 'font-size': DG_FONT_SM, fill: '#9E9E9E', 'text-anchor': 'middle', opacity: 0.7 });
    lbl_r.setAttribute('transform', `rotate(90,${rightX + DG_SIDE_W / 2},${rMidY})`);
    p.appendChild(lbl_r);

    const frameY = DG_BLEUE_Y0 - 8;
    const frameBot = DG_VERTE_Y0 + 4 * DG_ROW_S + 10;
    p.appendChild(svgEl('rect', { x: bgX - 10, y: frameY, width: bgW + 20, height: frameBot - frameY, fill: 'none', stroke: '#FFD740', 'stroke-width': 2.5, rx: 6, opacity: 0.35 }));

    p.appendChild(svgEl('rect', { x: bgX + 2, y: DG_BLEUE_Y0, width: bgW - 4, height: 4 * DG_ROW_S + 8, fill: ZONE_COLORS.exploitation_bleue, opacity: 0.1, rx: 4 }));
    p.appendChild(svgEl('rect', { x: bgX + 2, y: DG_VERTE_Y0, width: bgW - 4, height: 4 * DG_ROW_S + 8, fill: ZONE_COLORS.exploitation_verte, opacity: 0.1, rx: 4 }));
    p.appendChild(svgEl('rect', { x: bgX, y: DG_RMB_Y0 - 4, width: bgW, height: DG_ROW_H + 8, fill: '#757575', opacity: 0.15, rx: 4 }));
    p.appendChild(svgEl('rect', { x: bgX, y: DG_ORANGE_Y0, width: bgW, height: 4 * DG_ROW_S + 16, fill: ZONE_COLORS.restructuration_orange, opacity: 0.12, rx: 5 }));

    // Zone labels
    const lblAttr = { 'font-size': DG_FONT_SM, fill: 'rgba(255,255,255,0.25)', 'text-anchor': 'end' as const, 'font-weight': '700' };
    p.appendChild(svgTxt(bgX + bgW - 4, DG_ROSE_Y0 + 12, 'CROISSANCE', lblAttr));
    p.appendChild(svgTxt(bgX + bgW - 4, DG_BLEUE_Y0 + 10, 'BLEUE', { ...lblAttr, fill: 'rgba(66,165,245,0.35)' }));
    p.appendChild(svgTxt(bgX + bgW - 4, DG_VERTE_Y0 + 10, 'VERTE', { ...lblAttr, fill: 'rgba(102,187,106,0.35)' }));
    p.appendChild(svgTxt(bgX + bgW - 4, DG_ORANGE_Y0 + 12, 'RESTRUCTURATION', lblAttr));
  }

  private dgDrawArrows(p: SVGElement) {
    const ac = '#FFD740';
    const bgX = DG_LX - 12, bgW = DG_FULL_W + 24;

    const lAx = bgX - DG_SIDE_W / 2 - 6;
    const rAx = bgX + bgW + DG_SIDE_W / 2 + 6;
    const eTop = dgRowCY(DG_BLEUE_Y0, 0) - DG_ROW_H / 2 - 4;
    const eBot = dgRowCY(DG_VERTE_Y0, 3) + DG_ROW_H / 2 + 4;

    this.dgArrowV(p, lAx, eBot, eTop, ac, 0.5);
    this.dgArrowV(p, rAx, eTop, eBot, ac, 0.5);

    const tickLen = 10, tickOp = 0.3;
    for (let r = 0; r < 4; r++) {
      for (const y of [dgRowCY(DG_BLEUE_Y0, r), dgRowCY(DG_VERTE_Y0, r)]) {
        const lx = lAx + 5;
        p.appendChild(svgEl('line', { x1: lx, y1: y, x2: lx + tickLen, y2: y, stroke: ac, 'stroke-width': 1, opacity: tickOp }));
        this.dgTip(p, lx + tickLen, y, 1, 0, ac, tickOp);
        const rx = rAx - 5;
        p.appendChild(svgEl('line', { x1: rx, y1: y, x2: rx - tickLen, y2: y, stroke: ac, 'stroke-width': 1, opacity: tickOp }));
        this.dgTip(p, rx - tickLen, y, -1, 0, ac, tickOp);
      }
    }

    const flowOp = 0.45;
    const lcx = DG_LX + DG_COL_W * 0.25;
    const rcx = DG_RX + DG_COL_W * 0.75;
    const cx = DG_LX + DG_COL_W + DG_COL_GAP / 2;
    const roseCx = DG_LX + DG_COL_W / 2;

    for (let r = 3; r > 0; r--) this.dgChevron(p, roseCx, this.dgGapMid(DG_ROSE_Y0, r - 1, r), false, ac, flowOp);

    const roseExit = dgRowCY(DG_ROSE_Y0, 0) + DG_ROW_H / 2;
    this.dgChevron(p, cx, (roseExit + DG_RMH_Y0) / 2, true, ac, flowOp);
    this.dgChevron(p, cx, (DG_RMH_Y0 + DG_ROW_H + dgRowCY(DG_BLEUE_Y0, 0) - DG_ROW_H / 2) / 2, true, ac, flowOp);

    for (let r = 0; r < 3; r++) this.dgChevron(p, rcx, this.dgGapMid(DG_BLEUE_Y0, r, r + 1), true, ac, flowOp);
    const bDBot = dgRowCY(DG_BLEUE_Y0, 3) + DG_ROW_H / 2;
    const vDTop = dgRowCY(DG_VERTE_Y0, 0) - DG_ROW_H / 2;
    this.dgChevron(p, rcx, (bDBot + vDTop) / 2, true, ac, flowOp);
    for (let r = 0; r < 3; r++) this.dgChevron(p, rcx, this.dgGapMid(DG_VERTE_Y0, r, r + 1), true, ac, flowOp);

    for (let r = 3; r > 0; r--) this.dgChevron(p, lcx, this.dgGapMid(DG_VERTE_Y0, r - 1, r), false, ac, flowOp);
    const vGTop = dgRowCY(DG_VERTE_Y0, 0) - DG_ROW_H / 2;
    const bGBot = dgRowCY(DG_BLEUE_Y0, 3) + DG_ROW_H / 2;
    this.dgChevron(p, lcx, (vGTop + bGBot) / 2, false, ac, flowOp);
    for (let r = 3; r > 0; r--) this.dgChevron(p, lcx, this.dgGapMid(DG_BLEUE_Y0, r - 1, r), false, ac, flowOp);

    this.dgChevron(p, lcx, dgRowCY(DG_BLEUE_Y0, 0) - DG_ROW_H / 2 - 7, false, ac, flowOp);
    this.dgChevron(p, rcx, dgRowCY(DG_VERTE_Y0, 3) + DG_ROW_H / 2 + 7, true, ac, flowOp);

    const verteExit = dgRowCY(DG_VERTE_Y0, 3) + DG_ROW_H / 2;
    this.dgChevron(p, cx, (verteExit + DG_RMB_Y0) / 2, true, ac, flowOp);
    this.dgChevron(p, cx, (DG_RMB_Y0 + DG_ROW_H + dgRowCY(DG_ORANGE_Y0, 0) - DG_ROW_H / 2) / 2, true, ac, flowOp);
    for (let r = 0; r < 3; r++) this.dgChevron(p, cx, this.dgGapMid(DG_ORANGE_Y0, r, r + 1), true, ac, flowOp);

    const lblOp = 0.35;
    const lblY = DG_BLEUE_Y0 - 10;
    p.appendChild(svgTxt(lcx, lblY, 'G ↑', { 'font-size': DG_FONT_SM, fill: ac, 'text-anchor': 'middle', opacity: lblOp, 'font-weight': '700' }));
    p.appendChild(svgTxt(rcx, lblY, 'D ↓', { 'font-size': DG_FONT_SM, fill: ac, 'text-anchor': 'middle', opacity: lblOp, 'font-weight': '700' }));
  }

  private dgDrawSlot(p: SVGElement, i: number, cos: CompanyState[], legal: boolean, curId: string | null) {
    const slot = SLOTS[i], info = DG_SLOT_INFO[i];
    const color = ZONE_COLORS[slot.zone] ?? '#666';
    const h = DG_ROW_H;
    const g = svgEl('g', {});

    const rects: { x: number; w: number }[] = [];
    switch (info.col) {
      case 'D': rects.push({ x: DG_LX, w: DG_COL_W }, { x: DG_RX, w: DG_COL_W }); break;
      case 'L': rects.push({ x: DG_LX, w: DG_COL_W }); break;
      case 'R': rects.push({ x: DG_RX, w: DG_COL_W }); break;
      case 'F': rects.push({ x: DG_LX - 4, w: DG_FULL_W + 8 }); break;
    }

    const here = cos.filter(c => c.introduced && findSlotIndex(c.rdePosition) === i);
    const hasCurrent = here.some(c => c.id === curId);

    for (const r of rects) {
      const ry = info.cy - h / 2;

      if (legal) {
        g.appendChild(svgEl('rect', { x: r.x - 3, y: ry - 3, width: r.w + 6, height: h + 6, fill: 'none', stroke: '#FFD700', 'stroke-width': 2, rx: 4, filter: 'url(#glow-gold)', opacity: 0.8 }));
      }

      if (hasCurrent) {
        g.appendChild(svgEl('rect', { x: r.x - 1, y: ry - 1, width: r.w + 2, height: h + 2, fill: 'none', stroke: '#fff', 'stroke-width': 2, rx: 3, opacity: 0.6 }));
      }

      const rect = svgEl('rect', { x: r.x, y: ry, width: r.w, height: h, fill: color, opacity: legal ? 0.6 : hasCurrent ? 0.5 : 0.3, stroke: legal ? '#FFD700' : 'rgba(255,255,255,0.15)', 'stroke-width': legal ? 1.5 : 0.5, rx: 3 });
      const tip = svgEl('title', {});
      tip.textContent = `${slot.label}\n${ACTION_TIPS[slot.action]}`;
      rect.appendChild(tip);
      g.appendChild(rect);
      g.appendChild(svgTxt(r.x + r.w / 2, info.cy + 4, slot.label, { 'font-size': DG_FONT, fill: '#fff', 'text-anchor': 'middle', 'pointer-events': 'none', 'font-weight': hasCurrent ? '700' : '400' }));

      if (legal) {
        const hit = svgEl('rect', { x: r.x, y: ry, width: r.w, height: h, fill: 'transparent', cursor: 'pointer' });
        hit.addEventListener('click', () => this.onMoveSelect?.({ zone: slot.zone, action: slot.action, subPosition: 'gauche' }));
        g.appendChild(hit);
      }
    }

    if (here.length) {
      const lastR = rects[rects.length - 1];
      const pawnX0 = lastR.x + lastR.w + 8;
      here.forEach((co, j) => {
        const px = pawnX0 + j * (DG_PAWN_R * 2 + 3), py = info.cy;
        const cfg = COMPANIES[co.id], active = co.id === curId;
        g.appendChild(svgEl('circle', { cx: px, cy: py, r: DG_PAWN_R, fill: cfg.color, stroke: active ? '#FFD700' : '#1A1A2E', 'stroke-width': active ? 2 : 1 }));
        g.appendChild(svgTxt(px, py + 3, cfg.label.charAt(0), { 'font-size': 8, 'font-weight': '900', fill: contrast(cfg.color), 'text-anchor': 'middle', 'pointer-events': 'none' }));
      });
    }

    p.appendChild(g);
  }

  // ─── Helpers ──────────────────────────────────────────────

  private createSvg(w: number, h: number): SVGSVGElement {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('class', 'rde-svg');
    s.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    this.container.appendChild(s);
    return s;
  }

  private dgGapMid(zoneY0: number, topRow: number, botRow: number): number {
    return (dgRowCY(zoneY0, topRow) + DG_ROW_H / 2 + dgRowCY(zoneY0, botRow) - DG_ROW_H / 2) / 2;
  }

  private dgChevron(p: SVGElement, x: number, y: number, down: boolean, color: string, opacity: number) {
    const dy = down ? 4 : -4;
    p.appendChild(svgEl('path', {
      d: `M${x - 5},${y - dy} L${x},${y} L${x + 5},${y - dy}`,
      fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity,
    }));
  }

  private dgTip(p: SVGElement, x: number, y: number, dx: number, dy: number, color: string, opacity: number) {
    const sz = 3;
    p.appendChild(svgEl('path', {
      d: `M${x - dx * sz + dy * sz},${y - dy * sz - dx * sz} L${x},${y} L${x - dx * sz - dy * sz},${y - dy * sz + dx * sz}`,
      fill: 'none', stroke: color, 'stroke-width': 1, 'stroke-linecap': 'round', opacity,
    }));
  }

  private dgArrowV(p: SVGElement, x: number, y1: number, y2: number, color: string, opacity: number) {
    p.appendChild(svgEl('line', { x1: x, y1, x2: x, y2, stroke: color, 'stroke-width': 2, opacity }));
    const dir = y2 > y1 ? 1 : -1;
    p.appendChild(svgEl('path', { d: `M${x - 5},${y2 - dir * 7} L${x},${y2} L${x + 5},${y2 - dir * 7}`, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', opacity }));
  }
}
