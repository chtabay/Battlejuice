import type { CompanyState, Player } from '../game/types';
import { COMPANIES, getCardPrice } from '../game/types';

export class PlayerPanel {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'player-panel';
    parent.appendChild(this.container);
  }

  render(player: Player, companies: Record<string, CompanyState>, isActive: boolean) {
    this.container.innerHTML = '';
    this.container.classList.toggle('player-active', isActive);

    const header = document.createElement('div');
    header.className = 'player-header';
    header.innerHTML = `
      <h3>${player.name}</h3>
      <span class="player-cash">${player.cash}M</span>
    `;
    this.container.appendChild(header);

    // Portefeuille regroupé par entreprise
    const portfolio = document.createElement('div');
    portfolio.className = 'player-portfolio';

    const byCompany = new Map<string, { cards: number[]; level: number }>();
    for (const card of player.cards) {
      const existing = byCompany.get(card.companyId);
      const level = companies[card.companyId]?.level ?? 1;
      if (existing) {
        existing.cards.push(card.cardNumber);
      } else {
        byCompany.set(card.companyId, { cards: [card.cardNumber], level });
      }
    }

    let totalValue = player.cash;
    for (const [companyId, data] of byCompany) {
      const config = COMPANIES[companyId as keyof typeof COMPANIES];
      if (!config) continue;
      const value = data.cards.reduce(
        (s, n) => s + getCardPrice(n, data.level as 1 | 2 | 3 | 4 | 5), 0,
      );
      totalValue += value;

      const row = document.createElement('div');
      row.className = 'portfolio-row';
      row.innerHTML = `
        <span class="portfolio-color" style="background:${config.color}"></span>
        <span class="portfolio-company">${config.label}</span>
        <span class="portfolio-cards">${data.cards.sort((a, b) => a - b).join(', ')}</span>
        <span class="portfolio-value">${value}M</span>
      `;
      portfolio.appendChild(row);
    }

    this.container.appendChild(portfolio);

    const total = document.createElement('div');
    total.className = 'player-total';
    total.textContent = `Valeur totale : ${totalValue}M`;
    this.container.appendChild(total);
  }
}
