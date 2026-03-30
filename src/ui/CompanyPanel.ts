import type { CompanyState, Player } from '../game/types';
import { COMPANIES, getCardPrice } from '../game/types';
import { ACTION_LABELS } from '../game/RDE';
import { computeMarketValue, computeProductionMargin } from '../game/constants';

export class CompanyPanel {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'company-panel';
    parent.appendChild(this.container);
  }

  render(company: CompanyState, players: Player[], boardStats: {
    factories: number;
    schools: number;
    marketShares: number;
    prospectionPawns: number;
  }) {
    this.container.innerHTML = '';
    const config = COMPANIES[company.id];

    // Header
    const header = document.createElement('div');
    header.className = 'company-header';
    header.style.backgroundColor = config.color;
    header.style.color = this.getContrastColor(config.color);

    const name = document.createElement('h3');
    name.textContent = `${config.label} (${config.country})`;
    header.appendChild(name);

    const level = document.createElement('span');
    level.className = 'company-level';
    level.textContent = `Niv. ${company.level}`;
    header.appendChild(level);

    this.container.appendChild(header);

    // Stats
    const stats = document.createElement('div');
    stats.className = 'company-stats';

    const margin = computeProductionMargin(boardStats.factories, boardStats.marketShares);
    const marketVal = computeMarketValue(boardStats.factories, boardStats.marketShares, boardStats.schools);

    stats.innerHTML = `
      <div class="stat"><span class="stat-label">Trésorerie</span><span class="stat-value">${company.treasury}M</span></div>
      <div class="stat"><span class="stat-label">Valeur marché</span><span class="stat-value">${marketVal} pts</span></div>
      <div class="stat"><span class="stat-label">Marge production</span><span class="stat-value">${margin}M</span></div>
      <div class="stat"><span class="stat-label">Usines</span><span class="stat-value">${boardStats.factories}</span></div>
      <div class="stat"><span class="stat-label">Écoles</span><span class="stat-value">${boardStats.schools}</span></div>
      <div class="stat"><span class="stat-label">Parts de marché</span><span class="stat-value">${boardStats.marketShares}</span></div>
      <div class="stat"><span class="stat-label">Pions prospection</span><span class="stat-value">${boardStats.prospectionPawns}</span></div>
      <div class="stat"><span class="stat-label">Position RDE</span><span class="stat-value">${ACTION_LABELS[company.rdePosition.action]}</span></div>
    `;
    this.container.appendChild(stats);

    // Patron
    const patronDiv = document.createElement('div');
    patronDiv.className = 'company-patron';
    if (company.patronPlayerId !== null) {
      const patron = players.find(p => p.id === company.patronPlayerId);
      patronDiv.textContent = `Patron : ${patron?.name ?? '?'}`;
    } else {
      patronDiv.textContent = 'Pas de patron';
    }
    this.container.appendChild(patronDiv);

    // Actionnaires
    const shareholders = document.createElement('div');
    shareholders.className = 'company-shareholders';
    shareholders.innerHTML = '<h4>Actionnaires</h4>';
    for (const player of players) {
      const cards = player.cards.filter(c => c.companyId === company.id);
      if (cards.length === 0) continue;
      const total = cards.reduce((s, c) => s + c.cardNumber, 0);
      const value = cards.reduce((s, c) => s + getCardPrice(c.cardNumber, company.level), 0);
      const cardNums = cards.map(c => `#${c.cardNumber}`).join(', ');
      const div = document.createElement('div');
      div.className = 'shareholder';
      div.textContent = `${player.name} : ${cardNums} (=${total}, val. ${value}M)`;
      shareholders.appendChild(div);
    }
    this.container.appendChild(shareholders);
  }

  private getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#212121' : '#FAFAFA';
  }
}
