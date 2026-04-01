import type { BoardLayout, HexCell } from '../game/types';
import { COMPANIES } from '../game/types';
import { hexToPixel, hexPolygonPoints, axialKey } from './hexUtils';

const HEX_SIZE = 32;

const HEX_TYPE_COLORS: Record<string, string> = {
  libre: '#F5F0E1',
  desert: '#B0A890',
  embargo: '#4A4A4A',
  ocean: '#81D4FA',
};

export class BoardRenderer {
  private svg: SVGSVGElement;
  private group: SVGGElement;
  private cellMap = new Map<string, HexCell>();
  private hexElements = new Map<string, SVGPolygonElement>();
  private iconGroups = new Map<string, SVGGElement>();
  private onHexClick: ((cell: HexCell) => void) | null = null;
  private boardHighlightValid = new Set<string>();
  private boardHighlightSelected: string[] = [];


  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private isPanning = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'board-svg');

    this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(this.group);

    container.appendChild(this.svg);
    this.setupInteractions();
  }

  setOnHexClick(callback: (cell: HexCell) => void) {
    this.onHexClick = callback;
  }

  /** Met en évidence les cases valides / sélectionnées (prospection, construction). */
  setBoardHighlights(validKeys: string[], selectedKeys: string[]) {
    this.boardHighlightValid = new Set(validKeys);
    this.boardHighlightSelected = [...selectedKeys];
    for (const [key, poly] of this.hexElements) {
      poly.classList.toggle('hex-board-valid', this.boardHighlightValid.has(key));
      poly.classList.toggle('hex-board-selected', this.boardHighlightSelected.includes(key));
      const cell = this.cellMap.get(key);
      if (cell) this.restoreHexStroke(key, cell, poly);
    }
  }

  render(layout: BoardLayout) {
    this.group.innerHTML = '';
    this.hexElements.clear();
    this.iconGroups.clear();
    this.cellMap.clear();
    this.setBoardHighlights([], []);

    for (const cell of layout.cells) {
      this.cellMap.set(axialKey(cell), cell);
    }

    // Centrer le plateau
    const allPixels = layout.cells.map(c => hexToPixel(c, HEX_SIZE));
    const cx = allPixels.reduce((s, p) => s + p.x, 0) / allPixels.length;
    const cy = allPixels.reduce((s, p) => s + p.y, 0) / allPixels.length;

    this.panX = -cx;
    this.panY = -cy;
    this.updateTransform();

    for (const cell of layout.cells) {
      this.renderHex(cell);
    }
  }

  private renderHex(cell: HexCell) {
    const center = hexToPixel(cell, HEX_SIZE);
    const points = hexPolygonPoints(center, HEX_SIZE - 1);

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('class', `hex hex-${cell.type}`);
    polygon.setAttribute('data-q', String(cell.q));
    polygon.setAttribute('data-r', String(cell.r));

    const fill = this.getCellColor(cell);
    polygon.setAttribute('fill', fill);
    polygon.setAttribute('stroke', this.getStrokeColor(cell));
    polygon.setAttribute('stroke-width', '1.5');

    polygon.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onHexClick) this.onHexClick(cell);
    });

    const key = axialKey(cell);
    polygon.addEventListener('mouseenter', () => {
      if (this.boardHighlightValid.size > 0) {
        if (this.boardHighlightValid.has(key)) {
          polygon.setAttribute('stroke-width', '3');
          polygon.setAttribute(
            'stroke',
            this.boardHighlightSelected.includes(key) ? '#E65100' : '#43A047',
          );
        }
        return;
      }
      polygon.setAttribute('stroke-width', '3');
      polygon.setAttribute('stroke', '#FFD600');
    });

    polygon.addEventListener('mouseleave', () => {
      this.restoreHexStroke(key, cell, polygon);
    });

    this.group.appendChild(polygon);
    this.hexElements.set(axialKey(cell), polygon);

    const iconGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    iconGroup.setAttribute('pointer-events', 'none');
    this.renderIcons(iconGroup, cell, center);
    this.group.appendChild(iconGroup);
    this.iconGroups.set(axialKey(cell), iconGroup);
  }

  private getCellColor(cell: HexCell): string {
    if (cell.type === 'entreprise' && cell.companyId) {
      return COMPANIES[cell.companyId].color;
    }
    return HEX_TYPE_COLORS[cell.type] ?? '#F5F0E1';
  }

  private restoreHexStroke(key: string, cell: HexCell, polygon: SVGPolygonElement) {
    polygon.setAttribute('stroke-width', '1.5');
    if (this.boardHighlightSelected.includes(key)) {
      polygon.setAttribute('stroke', '#EF6C00');
      return;
    }
    if (this.boardHighlightValid.has(key)) {
      polygon.setAttribute('stroke', '#2E7D32');
      return;
    }
    polygon.setAttribute('stroke', this.getStrokeColor(cell));
  }

  private getStrokeColor(cell: HexCell): string {
    if (cell.type === 'entreprise' && cell.companyId) {
      return COMPANIES[cell.companyId].accentColor;
    }
    if (cell.type === 'ocean') return '#4FC3F7';
    if (cell.type === 'embargo') return '#212121';
    return '#C8C0A8';
  }

  private renderIcons(group: SVGGElement, cell: HexCell, center: { x: number; y: number }) {
    if (cell.hasSchool) {
      this.renderStar(group, center.x - 8, center.y - 6, '#212121');
    }
    if (cell.hasFactory) {
      this.renderFactory(group, center.x + 4, center.y - 6, '#212121');
    }
    if (cell.prospectionPawns.length > 0) {
      this.renderLightning(group, center.x - 6, center.y + 4, '#212121');
      if (cell.prospectionPawns.length > 1) {
        this.renderText(group, center.x + 6, center.y + 10, `×${cell.prospectionPawns.length}`, 8);
      }
    }
    if (cell.marketShareOwner) {
      const color = COMPANIES[cell.marketShareOwner].color;
      this.renderDisc(group, center.x + 8, center.y + 6, color);
    }
  }

  private renderStar(group: SVGGElement, x: number, y: number, color: string) {
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const s = 5;
    const points = [];
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i - Math.PI / 4;
      points.push(`${x + s * Math.cos(angle)},${y + s * Math.sin(angle)}`);
    }
    star.setAttribute('points', points.join(' '));
    star.setAttribute('fill', color);
    group.appendChild(star);
  }

  private renderFactory(group: SVGGElement, x: number, y: number, color: string) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x - 4));
    rect.setAttribute('y', String(y - 3));
    rect.setAttribute('width', '8');
    rect.setAttribute('height', '6');
    rect.setAttribute('fill', color);
    rect.setAttribute('rx', '1');
    group.appendChild(rect);
  }

  private renderLightning(group: SVGGElement, x: number, y: number, color: string) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x + 2} ${y - 4} L${x - 1} ${y + 1} L${x + 2} ${y} L${x} ${y + 5}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    group.appendChild(path);
  }

  private renderDisc(group: SVGGElement, x: number, y: number, color: string) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#333');
    circle.setAttribute('stroke-width', '0.8');
    group.appendChild(circle);
  }

  private renderText(group: SVGGElement, x: number, y: number, text: string, size: number) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
    el.setAttribute('font-size', String(size));
    el.setAttribute('fill', '#333');
    el.setAttribute('font-family', 'monospace');
    el.setAttribute('text-anchor', 'middle');
    el.textContent = text;
    group.appendChild(el);
  }

  updateCell(cell: HexCell) {
    const key = axialKey(cell);
    const polygon = this.hexElements.get(key);
    if (polygon) {
      polygon.setAttribute('fill', this.getCellColor(cell));
    }
    const iconGroup = this.iconGroups.get(key);
    if (iconGroup) {
      iconGroup.innerHTML = '';
      const center = hexToPixel(cell, HEX_SIZE);
      this.renderIcons(iconGroup, cell, center);
    }
  }

  // ─── Pan & Zoom ────────────────────────────────────────────

  private setupInteractions() {
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.3, Math.min(3, this.zoom * delta));
      this.updateTransform();
    }, { passive: false });

    this.svg.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 0 && e.ctrlKey) {
        this.isPanning = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.svg.setPointerCapture(e.pointerId);
      }
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.panX += dx / this.zoom;
      this.panY += dy / this.zoom;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.updateTransform();
    });

    this.svg.addEventListener('pointerup', () => {
      this.isPanning = false;
    });

    // Touch pinch zoom
    let lastTouchDist = 0;
    this.svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    }, { passive: true });

    this.svg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const scale = dist / lastTouchDist;
        this.zoom = Math.max(0.3, Math.min(3, this.zoom * scale));
        lastTouchDist = dist;
        this.updateTransform();
      }
    }, { passive: true });
  }

  private updateTransform() {
    const rect = this.svg.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    this.group.setAttribute(
      'transform',
      `translate(${cx}, ${cy}) scale(${this.zoom}) translate(${this.panX}, ${this.panY})`,
    );
  }

  resize() {
    this.updateTransform();
  }
}
