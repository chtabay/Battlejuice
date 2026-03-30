import type {
  GameState, CompanyId, RDEAction, CompanyState, BoardLayout,
  CompanyConfig, PendingProspectionState,
} from './types';
import { COMPANIES, getLevelFromMarketValue } from './types';
import {
  computeMarketValue,
  FACTORY_UPKEEP, SCHOOL_UPKEEP, PROSPECTION_UPKEEP,
  REVENUE_PER_SUPPLIED_SHARE, SHARES_PER_FACTORY,
  RECRUIT_PAWN_COST, SCHOOL_COST, FACTORY_COST,
  MAX_SCHOOLS, MAX_FACTORIES,
} from './constants';
import { ActionModal } from '../ui/ActionModal';
import { findProspectionTargets, findContestableEnemyCells } from './boardMovement';
import { axialKey } from '../board/hexUtils';

// ─── Board helpers ──────────────────────────────────────────

export interface BoardStats {
  factories: number;
  schools: number;
  marketShares: number;
  prospectionPawns: number;
}

export function computeBoardStats(board: BoardLayout, companyId: CompanyId): BoardStats {
  let factories = 0, schools = 0, marketShares = 0, prospectionPawns = 0;
  for (const cell of board.cells) {
    if (cell.hasFactory && cell.companyId === companyId) factories++;
    if (cell.hasSchool && cell.companyId === companyId) schools++;
    if (cell.marketShareOwner === companyId) marketShares++;
    prospectionPawns += cell.prospectionPawns.filter(p => p === companyId).length;
  }
  return { factories, schools, marketShares, prospectionPawns };
}

// ─── Action context ─────────────────────────────────────────

export interface ActionContext {
  state: GameState;
  companyId: CompanyId;
  company: CompanyState;
  stats: BoardStats;
  modal: ActionModal;
}

export interface ActionResult {
  log: string;
  /** Si défini, l’UI affiche le panneau prospection (pas de modale). */
  prospectionDeferred?: PendingProspectionState;
}

export function applyProspectionCount(state: GameState, count: number): string {
  const pending = state.pendingProspection;
  if (!pending) return '';
  const { companyId, targetKeys, maxConquer } = pending;
  const cfg = COMPANIES[companyId];
  const n = Math.min(Math.max(0, Math.floor(count)), maxConquer, targetKeys.length);
  const cellByKey = new Map(state.board.cells.map(c => [axialKey(c), c]));
  let conquered = 0;
  for (let i = 0; i < n; i++) {
    const cell = cellByKey.get(targetKeys[i]);
    if (!cell) continue;
    cell.marketShareOwner = companyId;
    cell.prospectionPawns.push(companyId);
    conquered++;
  }
  state.pendingProspection = null;
  return `${cfg.label} — Prospection : ${conquered} case(s) conquise(s).`;
}

export function clearPendingProspection(state: GameState): void {
  state.pendingProspection = null;
}

function buildProspectionIntroHtml(
  cfg: CompanyConfig,
  stats: BoardStats,
  targetsCount: number,
  maxConquer: number,
): string {
  return `
<div class="prospection-guide">
  <p class="prospection-guide-lead"><strong style="color:${cfg.color}">${cfg.label}</strong> — développez sur la carte.</p>
  <div class="prospection-guide-rules">
    <p class="prospection-guide-title">Comment se développer</p>
    <ul>
      <li>Ne sont conquérables que les cases <strong>libres</strong>, <strong>désertiques</strong> ou en <strong>embargo</strong> (pas l’océan, pas l’hexagone réservé au siège d’un cluster entreprise).</li>
      <li>Chaque nouvelle case doit être <strong>adjacente</strong> (un des 6 hexagones voisins) à une case où vous avez déjà une <strong>part de marché</strong> ou un <strong>pion de prospection</strong>.</li>
      <li>Chaque case prise accueille un pion : vous ne pouvez pas dépasser le nombre de <strong>pions disponibles</strong> (${stats.prospectionPawns} sur le plateau).</li>
    </ul>
  </div>
  <div class="prospection-guide-stats">
    <p><strong>Ce tour :</strong> jusqu’à <span class="prospection-max">${maxConquer}</span> case(s) —
    ${targetsCount} case(s) neutre(s) touchant votre territoire, plafonné par vos ${stats.prospectionPawns} pion(s).</p>
  </div>
</div>`;
}

type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>;

// ─── Handlers ───────────────────────────────────────────────

async function handleResultatsMarche(ctx: ActionContext): Promise<ActionResult> {
  const { company, stats } = ctx;
  const cfg = COMPANIES[company.id];

  const suppliedShares = Math.min(stats.marketShares, stats.factories * SHARES_PER_FACTORY);
  const revenue = suppliedShares * REVENUE_PER_SUPPLIED_SHARE;
  const upkeep = stats.factories * FACTORY_UPKEEP
    + stats.schools * SCHOOL_UPKEEP
    + stats.prospectionPawns * PROSPECTION_UPKEEP;
  const result = revenue - upkeep;

  const oldTreasury = company.treasury;
  company.treasury += result;
  if (company.treasury < 0) company.treasury = 0;

  const newMarketValue = computeMarketValue(stats.factories, stats.marketShares, stats.schools);
  company.marketValue = newMarketValue;
  const newLevel = getLevelFromMarketValue(newMarketValue);
  const levelChanged = newLevel !== company.level;
  company.level = newLevel;

  const sign = result >= 0 ? '+' : '';
  let log = `${cfg.label} — Résultats : revenus ${revenue}M − charges ${upkeep}M = ${sign}${result}M.`;
  log += ` Trésorerie ${oldTreasury}M → ${company.treasury}M.`;
  log += ` Valeur marché : ${newMarketValue} pts (Niv. ${newLevel}).`;
  if (levelChanged) log += ' Changement de niveau !';

  const bodyHtml = `
    <div style="display:grid;grid-template-columns:1fr auto;gap:6px 16px;font-size:0.95rem;">
      <span>Parts approvisionnées</span><strong>${suppliedShares} / ${stats.marketShares}</strong>
      <span>Revenus (${suppliedShares} × ${REVENUE_PER_SUPPLIED_SHARE}M)</span><strong style="color:#4CAF50">+${revenue}M</strong>
      <span>Entretien usines (${stats.factories})</span><strong style="color:#EF5350">−${stats.factories * FACTORY_UPKEEP}M</strong>
      <span>Entretien écoles (${stats.schools})</span><strong style="color:#EF5350">−${stats.schools * SCHOOL_UPKEEP}M</strong>
      <span>Entretien prospection (${stats.prospectionPawns})</span><strong style="color:#EF5350">−${stats.prospectionPawns * PROSPECTION_UPKEEP}M</strong>
      <span style="border-top:1px solid rgba(255,255,255,0.2);padding-top:6px;font-weight:700">Résultat net</span>
      <strong style="border-top:1px solid rgba(255,255,255,0.2);padding-top:6px;color:${result >= 0 ? '#4CAF50' : '#EF5350'}">${sign}${result}M</strong>
      <span>Trésorerie</span><strong>${company.treasury}M</strong>
      <span>Valeur marché</span><strong>${newMarketValue} pts (Niv. ${newLevel})</strong>
    </div>
    ${levelChanged ? '<p style="margin-top:12px;color:#FFD700;font-weight:700;">⚡ Changement de niveau !</p>' : ''}
  `;

  await ctx.modal.show({
    title: `${cfg.label} — Résultats & Marché`,
    body: bodyHtml,
    buttons: [{ label: 'OK', value: 'ok', primary: true }],
    closable: false,
  });

  return { log };
}

// ─── Management ─────────────────────────────────────────────

async function handleManagement(ctx: ActionContext): Promise<ActionResult> {
  const { company, stats, state } = ctx;
  const cfg = COMPANIES[company.id];

  const maxPawns = Math.floor(company.treasury / RECRUIT_PAWN_COST);
  const canSchool = stats.schools < MAX_SCHOOLS && company.treasury >= SCHOOL_COST;

  const form = document.createElement('div');
  form.innerHTML = `
    <p style="margin-bottom:12px">Trésorerie disponible : <strong>${company.treasury}M</strong></p>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <label style="min-width:160px">Pions à recruter (${RECRUIT_PAWN_COST}M chacun) :</label>
      <input type="number" id="mgmt-pawns" min="0" max="${maxPawns}" value="0"
             style="width:60px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;font-size:1rem;text-align:center;">
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <label style="min-width:160px">Construire une école (${SCHOOL_COST}M) :</label>
      <input type="checkbox" id="mgmt-school" ${canSchool ? '' : 'disabled'}>
      <span style="font-size:0.8rem;color:var(--text-muted)">${stats.schools}/${MAX_SCHOOLS} écoles</span>
    </div>
    <p id="mgmt-cost" style="margin-top:14px;font-weight:700;color:var(--gold);">Coût total : 0M</p>
  `;

  const updateCost = () => {
    const pawns = parseInt((form.querySelector('#mgmt-pawns') as HTMLInputElement).value) || 0;
    const school = (form.querySelector('#mgmt-school') as HTMLInputElement).checked;
    const cost = pawns * RECRUIT_PAWN_COST + (school ? SCHOOL_COST : 0);
    form.querySelector('#mgmt-cost')!.textContent = `Coût total : ${cost}M`;
  };

  form.querySelector('#mgmt-pawns')!.addEventListener('input', updateCost);
  form.querySelector('#mgmt-school')!.addEventListener('change', updateCost);

  const result = await ctx.modal.show({
    title: `${cfg.label} — Management`,
    body: form,
    buttons: [
      { label: 'Annuler', value: 'cancel' },
      { label: 'Confirmer', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — Management : aucune action.` };
  }

  const pawns = parseInt((form.querySelector('#mgmt-pawns') as HTMLInputElement).value) || 0;
  const buildSchool = (form.querySelector('#mgmt-school') as HTMLInputElement).checked;
  const totalCost = pawns * RECRUIT_PAWN_COST + (buildSchool ? SCHOOL_COST : 0);

  if (totalCost > company.treasury) {
    return { log: `${cfg.label} — Management : fonds insuffisants.` };
  }

  company.treasury -= totalCost;

  const companyCells = state.board.cells.filter(c => c.companyId === company.id);
  for (let i = 0; i < pawns; i++) {
    const target = companyCells.find(c => c.hasFactory || c.hasSchool) ?? companyCells[0];
    if (target) target.prospectionPawns.push(company.id);
  }

  if (buildSchool) {
    const schoolTarget = companyCells.find(c => !c.hasSchool);
    if (schoolTarget) schoolTarget.hasSchool = true;
  }

  const parts: string[] = [];
  if (pawns > 0) parts.push(`${pawns} pion(s) recruté(s)`);
  if (buildSchool) parts.push('1 école construite');
  const summary = parts.length > 0 ? parts.join(', ') : 'aucune action';

  return { log: `${cfg.label} — Management : ${summary} (−${totalCost}M).` };
}

// ─── Construction ───────────────────────────────────────────

async function handleConstruction(ctx: ActionContext): Promise<ActionResult> {
  const { company, stats, state } = ctx;
  const cfg = COMPANIES[company.id];

  const canBuild = company.treasury >= FACTORY_COST && stats.factories < MAX_FACTORIES;
  const maxFactories = Math.min(
    Math.floor(company.treasury / FACTORY_COST),
    MAX_FACTORIES - stats.factories,
  );

  const form = document.createElement('div');
  form.innerHTML = `
    <p style="margin-bottom:12px">Trésorerie : <strong>${company.treasury}M</strong> — Usines : ${stats.factories}/${MAX_FACTORIES}</p>
    <div style="display:flex;align-items:center;gap:12px;">
      <label>Usines à construire (${FACTORY_COST}M chacune) :</label>
      <input type="number" id="build-count" min="0" max="${maxFactories}" value="${canBuild ? 1 : 0}"
             style="width:60px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;font-size:1rem;text-align:center;"
             ${canBuild ? '' : 'disabled'}>
    </div>
    <p id="build-cost" style="margin-top:12px;font-weight:700;color:var(--gold);">Coût : ${canBuild ? FACTORY_COST : 0}M</p>
  `;

  form.querySelector('#build-count')!.addEventListener('input', () => {
    const count = parseInt((form.querySelector('#build-count') as HTMLInputElement).value) || 0;
    form.querySelector('#build-cost')!.textContent = `Coût : ${count * FACTORY_COST}M`;
  });

  const result = await ctx.modal.show({
    title: `${cfg.label} — Construction`,
    body: form,
    buttons: [
      { label: 'Annuler', value: 'cancel' },
      { label: 'Construire', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — Construction : aucune action.` };
  }

  const count = parseInt((form.querySelector('#build-count') as HTMLInputElement).value) || 0;
  const cost = count * FACTORY_COST;

  if (cost > company.treasury || count <= 0) {
    return { log: `${cfg.label} — Construction : aucune usine construite.` };
  }

  company.treasury -= cost;

  const companyCells = state.board.cells.filter(
    c => c.companyId === company.id && !c.hasFactory,
  );
  let built = 0;
  for (let i = 0; i < count && i < companyCells.length; i++) {
    companyCells[i].hasFactory = true;
    built++;
  }

  return { log: `${cfg.label} — Construction : ${built} usine(s) construite(s) (−${cost}M).` };
}

// ─── Prospection ────────────────────────────────────────────

async function handleProspection(ctx: ActionContext): Promise<ActionResult> {
  const { company, stats } = ctx;
  const cfg = COMPANIES[company.id];

  if (stats.prospectionPawns === 0) {
    return {
      log: `${cfg.label} — Prospection : aucun pion sur le plateau. Recrutez des pions via Management (3M chacun).`,
    };
  }

  const { board } = ctx.state;
  const targets = findProspectionTargets(board, company.id);
  const movesAvailable = Math.min(stats.prospectionPawns, targets.length);

  if (movesAvailable === 0) {
    return {
      log: `${cfg.label} — Prospection : aucune case neutre adjacente. Étendez-vous depuis une case avec part ou pion, vers du libre / désert / embargo (pas l’océan ni le siège d’un cluster).`,
    };
  }

  const introHtml = buildProspectionIntroHtml(cfg, stats, targets.length, movesAvailable);

  return {
    log: '',
    prospectionDeferred: {
      companyId: company.id,
      targetKeys: targets.map(t => axialKey(t)),
      maxConquer: movesAvailable,
      introHtml,
    },
  };
}

// ─── Guerre des Prix ────────────────────────────────────────

async function handleGuerreDesPrix(ctx: ActionContext): Promise<ActionResult> {
  const { company, stats, state } = ctx;
  const cfg = COMPANIES[company.id];

  const contestable = findContestableEnemyCells(state.board, company.id);

  if (contestable.length === 0) {
    await ctx.modal.show({
      title: `${cfg.label} — Guerre des Prix`,
      body: '<p>Aucune case adverse adjacente à attaquer.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — Guerre des Prix : aucune cible.` };
  }

  const attackPower = stats.prospectionPawns + stats.factories;

  const targetList = contestable.map(c => {
    const enemyId = c.marketShareOwner!;
    const enemyStats = computeBoardStats(state.board, enemyId);
    const enemyPower = enemyStats.prospectionPawns + enemyStats.factories;
    const enemyCfg = COMPANIES[enemyId];
    return { cell: c, enemyId, enemyPower, enemyCfg };
  });

  const listHtml = targetList.map((t, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <input type="checkbox" id="gdp-${i}" ${attackPower > t.enemyPower ? '' : 'disabled'}>
      <span style="color:${t.enemyCfg.color};font-weight:700">${t.enemyCfg.label}</span>
      <span style="font-size:0.85rem;color:var(--text-muted)">(q:${t.cell.q} r:${t.cell.r})</span>
      <span style="margin-left:auto;font-size:0.85rem">Force : ${t.enemyPower}</span>
    </div>
  `).join('');

  const form = document.createElement('div');
  form.innerHTML = `
    <p>Votre force : <strong>${attackPower}</strong> (${stats.prospectionPawns} pions + ${stats.factories} usines)</p>
    <p style="margin:8px 0;font-size:0.85rem;color:var(--text-muted)">Seules les cibles plus faibles peuvent être attaquées.</p>
    <div style="max-height:200px;overflow-y:auto;margin-top:8px;">${listHtml}</div>
  `;

  const result = await ctx.modal.show({
    title: `${cfg.label} — Guerre des Prix`,
    body: form,
    buttons: [
      { label: 'Annuler', value: 'cancel' },
      { label: 'Attaquer', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — Guerre des Prix : aucune attaque.` };
  }

  let captured = 0;
  targetList.forEach((t, i) => {
    const cb = form.querySelector(`#gdp-${i}`) as HTMLInputElement;
    if (cb && cb.checked) {
      t.cell.marketShareOwner = company.id;
      t.cell.prospectionPawns = t.cell.prospectionPawns.filter(p => p !== t.enemyId);
      t.cell.prospectionPawns.push(company.id);
      captured++;
    }
  });

  return { log: `${cfg.label} — Guerre des Prix : ${captured} case(s) capturée(s).` };
}

// ─── Cash & Capital ─────────────────────────────────────────

async function handleCashCapital(ctx: ActionContext): Promise<ActionResult> {
  const { company, state } = ctx;
  const cfg = COMPANIES[company.id];

  if (company.treasury <= 0) {
    await ctx.modal.show({
      title: `${cfg.label} — Cash & Capital`,
      body: '<p>Trésorerie vide — aucun dividende à distribuer.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — Cash & Capital : trésorerie vide.` };
  }

  const shareholders = state.players.filter(
    p => p.cards.some(c => c.companyId === company.id),
  );

  const form = document.createElement('div');
  form.innerHTML = `
    <p>Trésorerie : <strong>${company.treasury}M</strong></p>
    <div style="display:flex;align-items:center;gap:12px;margin:12px 0;">
      <label>Montant total de dividendes :</label>
      <input type="number" id="cc-amount" min="0" max="${company.treasury}" value="0"
             style="width:80px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;font-size:1rem;text-align:center;">
      <span>M</span>
    </div>
    <p style="font-size:0.85rem;color:var(--text-muted)">
      Répartis proportionnellement à la valeur des cartes détenues par chaque actionnaire.
    </p>
  `;

  const result = await ctx.modal.show({
    title: `${cfg.label} — Cash & Capital`,
    body: form,
    buttons: [
      { label: 'Passer', value: 'cancel' },
      { label: 'Distribuer', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — Cash & Capital : aucun dividende.` };
  }

  const amount = Math.min(
    parseInt((form.querySelector('#cc-amount') as HTMLInputElement).value) || 0,
    company.treasury,
  );

  if (amount <= 0) {
    return { log: `${cfg.label} — Cash & Capital : aucun dividende.` };
  }

  company.treasury -= amount;

  const totalCardValue = shareholders.reduce((sum, p) =>
    sum + p.cards.filter(c => c.companyId === company.id).reduce((s, c) => s + c.cardNumber, 0),
  0);

  if (totalCardValue > 0) {
    for (const player of shareholders) {
      const playerValue = player.cards
        .filter(c => c.companyId === company.id)
        .reduce((s, c) => s + c.cardNumber, 0);
      const share = Math.floor(amount * playerValue / totalCardValue);
      player.cash += share;
    }
  }

  return { log: `${cfg.label} — Cash & Capital : ${amount}M distribués en dividendes.` };
}

// ─── Bourse ─────────────────────────────────────────────────

async function handleBourse(ctx: ActionContext): Promise<ActionResult> {
  const { company, state } = ctx;
  const cfg = COMPANIES[company.id];
  const patron = company.patronPlayerId !== null ? state.players[company.patronPlayerId] : null;

  const allCardNums = Array.from({ length: 10 }, (_, i) => i + 1);
  const heldCards = state.players.flatMap(p =>
    p.cards.filter(c => c.companyId === company.id).map(c => c.cardNumber),
  );
  const availableCards = allCardNums.filter(n => !heldCards.includes(n));

  if (availableCards.length === 0 && company.treasury <= 0) {
    await ctx.modal.show({
      title: `${cfg.label} — Bourse`,
      body: '<p>Aucune carte disponible et trésorerie vide.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — Bourse : rien à faire.` };
  }

  const cardPrice = (n: number) => n * 2 * company.level;
  const availHtml = availableCards.map(n =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>Carte #${n}</span><span>${cardPrice(n)}M</span>
    </div>`
  ).join('') || '<p style="color:var(--text-muted)">Aucune carte disponible</p>';

  const form = document.createElement('div');
  form.innerHTML = `
    <p>Trésorerie entreprise : <strong>${company.treasury}M</strong> — Niveau ${company.level}</p>
    <h4 style="margin-top:12px;font-size:0.9rem;color:var(--gold)">Cartes disponibles à l'achat</h4>
    <div style="max-height:160px;overflow-y:auto;margin:8px 0;">${availHtml}</div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:12px;">
      <label>Numéro de carte à acheter :</label>
      <input type="number" id="bourse-card" min="1" max="10" value=""
             style="width:60px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;font-size:1rem;text-align:center;">
    </div>
    <p style="margin-top:4px;font-size:0.8rem;color:var(--text-muted)">
      La carte sera achetée par le patron depuis la trésorerie de l'entreprise.
    </p>
  `;

  const result = await ctx.modal.show({
    title: `${cfg.label} — Bourse`,
    body: form,
    buttons: [
      { label: 'Passer', value: 'cancel' },
      { label: 'Acheter', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel' || !patron) {
    return { log: `${cfg.label} — Bourse : aucune transaction.` };
  }

  const cardNum = parseInt((form.querySelector('#bourse-card') as HTMLInputElement).value);
  if (!cardNum || !availableCards.includes(cardNum)) {
    return { log: `${cfg.label} — Bourse : carte invalide.` };
  }

  const price = cardPrice(cardNum);
  if (price > company.treasury) {
    return { log: `${cfg.label} — Bourse : fonds insuffisants pour carte #${cardNum} (${price}M).` };
  }

  company.treasury -= price;
  patron.cards.push({ companyId: company.id, cardNumber: cardNum });

  return { log: `${cfg.label} — Bourse : carte #${cardNum} achetée pour ${price}M par ${patron.name}.` };
}

// ─── Location & Cash ────────────────────────────────────────

async function handleLocationCash(ctx: ActionContext): Promise<ActionResult> {
  const { company, stats } = ctx;
  const cfg = COMPANIES[company.id];

  const loanAmount = Math.min(10, stats.factories * 5);

  const form = document.createElement('div');
  form.innerHTML = `
    <p>Trésorerie : <strong>${company.treasury}M</strong></p>
    <p style="margin:8px 0">Emprunt disponible basé sur les usines (${stats.factories}) : <strong>${loanAmount}M</strong></p>
    <div style="display:flex;align-items:center;gap:12px;margin-top:12px;">
      <label>Montant à emprunter :</label>
      <input type="number" id="loc-amount" min="0" max="${loanAmount}" value="${loanAmount}"
             style="width:80px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;font-size:1rem;text-align:center;">
      <span>M</span>
    </div>
  `;

  const result = await ctx.modal.show({
    title: `${cfg.label} — Location & Cash`,
    body: form,
    buttons: [
      { label: 'Passer', value: 'cancel' },
      { label: 'Emprunter', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — Location & Cash : aucune action.` };
  }

  const amount = Math.min(
    parseInt((form.querySelector('#loc-amount') as HTMLInputElement).value) || 0,
    loanAmount,
  );

  if (amount > 0) {
    company.treasury += amount;
  }

  return { log: `${cfg.label} — Location & Cash : +${amount}M empruntés.` };
}

// ─── Stock-Option ───────────────────────────────────────────

async function handleStockOption(ctx: ActionContext): Promise<ActionResult> {
  const { company, state } = ctx;
  const cfg = COMPANIES[company.id];
  const patron = company.patronPlayerId !== null ? state.players[company.patronPlayerId] : null;

  if (!patron) {
    await ctx.modal.show({
      title: `${cfg.label} — Stock-Option`,
      body: '<p>Aucun patron — impossible d\'attribuer des stock-options.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — Stock-Option : aucun patron.` };
  }

  const heldCards = state.players.flatMap(p =>
    p.cards.filter(c => c.companyId === company.id).map(c => c.cardNumber),
  );
  const freeCards = Array.from({ length: 10 }, (_, i) => i + 1)
    .filter(n => !heldCards.includes(n));

  if (freeCards.length === 0) {
    await ctx.modal.show({
      title: `${cfg.label} — Stock-Option`,
      body: '<p>Toutes les cartes sont déjà distribuées.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — Stock-Option : aucune carte libre.` };
  }

  const granted = freeCards[0];
  patron.cards.push({ companyId: company.id, cardNumber: granted });

  await ctx.modal.show({
    title: `${cfg.label} — Stock-Option`,
    body: `<p><strong>${patron.name}</strong> reçoit gratuitement la carte <strong>#${granted}</strong> de ${cfg.label}.</p>`,
    buttons: [{ label: 'OK', value: 'ok', primary: true }],
  });

  return { log: `${cfg.label} — Stock-Option : carte #${granted} attribuée à ${patron.name}.` };
}

// ─── Rachat Salarié ─────────────────────────────────────────

async function handleSalaryDeal(ctx: ActionContext): Promise<ActionResult> {
  const { company, state } = ctx;
  const cfg = COMPANIES[company.id];

  const sellable: { player: typeof state.players[0]; cardNum: number; price: number }[] = [];
  for (const player of state.players) {
    for (const card of player.cards) {
      if (card.companyId === company.id) {
        sellable.push({
          player,
          cardNum: card.cardNumber,
          price: card.cardNumber * 2 * company.level,
        });
      }
    }
  }

  if (sellable.length === 0) {
    await ctx.modal.show({
      title: `${cfg.label} — Rachat Salarié`,
      body: '<p>Aucune carte en circulation à racheter.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — Rachat Salarié : aucune carte.` };
  }

  const listHtml = sellable.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
      <input type="checkbox" id="rs-${i}">
      <span>${s.player.name} — Carte #${s.cardNum}</span>
      <span style="margin-left:auto;font-weight:700">${s.price}M</span>
    </div>
  `).join('');

  const form = document.createElement('div');
  form.innerHTML = `
    <p>Trésorerie entreprise : <strong>${company.treasury}M</strong></p>
    <p style="margin:8px 0;font-size:0.85rem;color:var(--text-muted)">
      L'entreprise rachète des cartes aux actionnaires au prix du marché.
    </p>
    <div style="max-height:200px;overflow-y:auto;margin-top:8px;">${listHtml}</div>
  `;

  const result = await ctx.modal.show({
    title: `${cfg.label} — Rachat Salarié`,
    body: form,
    buttons: [
      { label: 'Passer', value: 'cancel' },
      { label: 'Racheter', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — Rachat Salarié : aucun rachat.` };
  }

  let totalCost = 0;
  let count = 0;
  sellable.forEach((s, i) => {
    const cb = form.querySelector(`#rs-${i}`) as HTMLInputElement;
    if (cb?.checked && s.price <= company.treasury - totalCost) {
      totalCost += s.price;
      s.player.cash += s.price;
      s.player.cards = s.player.cards.filter(
        c => !(c.companyId === company.id && c.cardNumber === s.cardNum),
      );
      count++;
    }
  });

  company.treasury -= totalCost;

  return { log: `${cfg.label} — Rachat Salarié : ${count} carte(s) rachetée(s) (−${totalCost}M).` };
}

// ─── OPA ────────────────────────────────────────────────────

async function handleOPA(ctx: ActionContext): Promise<ActionResult> {
  const { company, state } = ctx;
  const cfg = COMPANIES[company.id];
  const patron = company.patronPlayerId !== null ? state.players[company.patronPlayerId] : null;

  if (!patron) {
    await ctx.modal.show({
      title: `${cfg.label} — OPA`,
      body: '<p>Aucun patron pour lancer une OPA.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — OPA : aucun patron.` };
  }

  const targets = Object.values(state.companies).filter(
    c => c.id !== company.id && c.introduced && c.rdePosition.action === 'opable',
  );

  if (targets.length === 0) {
    await ctx.modal.show({
      title: `${cfg.label} — OPA`,
      body: '<p>Aucune entreprise en position OPAble.</p>',
      buttons: [{ label: 'OK', value: 'ok', primary: true }],
    });
    return { log: `${cfg.label} — OPA : aucune cible OPAble.` };
  }

  const listHtml = targets.map(t => {
    const tCfg = COMPANIES[t.id];
    return `<option value="${t.id}">${tCfg.label} (Niv. ${t.level})</option>`;
  }).join('');

  const form = document.createElement('div');
  form.innerHTML = `
    <p>${patron.name} lance une OPA avec le cash de l'entreprise (<strong>${company.treasury}M</strong>).</p>
    <div style="margin:12px 0;">
      <label>Cible :</label>
      <select id="opa-target" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;margin-left:8px;">
        ${listHtml}
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <label>Numéro de carte à acheter :</label>
      <input type="number" id="opa-card" min="1" max="10" value="1"
             style="width:60px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:var(--bg-card);color:#fff;text-align:center;">
    </div>
    <p style="margin-top:8px;font-size:0.85rem;color:var(--text-muted)">
      Rachète une carte de la cible à un actionnaire au prix du marché.
    </p>
  `;

  const result = await ctx.modal.show({
    title: `${cfg.label} — OPA`,
    body: form,
    buttons: [
      { label: 'Annuler', value: 'cancel' },
      { label: 'Lancer l\'OPA', value: 'confirm', primary: true },
    ],
  });

  if (result === 'cancel') {
    return { log: `${cfg.label} — OPA : annulée.` };
  }

  const targetId = (form.querySelector('#opa-target') as HTMLSelectElement).value as CompanyId;
  const cardNum = parseInt((form.querySelector('#opa-card') as HTMLInputElement).value);
  const targetCompany = state.companies[targetId];
  const targetCfg = COMPANIES[targetId];
  const price = cardNum * 2 * targetCompany.level;

  const holder = state.players.find(p =>
    p.cards.some(c => c.companyId === targetId && c.cardNumber === cardNum),
  );

  if (!holder) {
    return { log: `${cfg.label} — OPA : carte #${cardNum} de ${targetCfg.label} introuvable.` };
  }

  if (price > company.treasury) {
    return { log: `${cfg.label} — OPA : fonds insuffisants (${price}M nécessaires).` };
  }

  company.treasury -= price;
  holder.cash += price;
  holder.cards = holder.cards.filter(
    c => !(c.companyId === targetId && c.cardNumber === cardNum),
  );
  patron.cards.push({ companyId: targetId, cardNumber: cardNum });

  // Check patron change
  const newWeights = state.players.map(p => ({
    id: p.id,
    weight: p.cards.filter(c => c.companyId === targetId).reduce((s, c) => s + c.cardNumber, 0),
  }));
  const newPatron = newWeights.reduce((best, cur) => cur.weight > best.weight ? cur : best);
  if (newPatron.weight > 0) targetCompany.patronPlayerId = newPatron.id;

  return { log: `${cfg.label} — OPA sur ${targetCfg.label} : carte #${cardNum} achetée à ${holder.name} pour ${price}M.` };
}

// ─── OPAble ─────────────────────────────────────────────────

async function handleOPAble(ctx: ActionContext): Promise<ActionResult> {
  const { company } = ctx;
  const cfg = COMPANIES[company.id];

  await ctx.modal.show({
    title: `${cfg.label} — OPAble`,
    body: `<p><strong>${cfg.label}</strong> est désormais vulnérable à une OPA.<br>
      N'importe quel patron d'une entreprise en case OPA peut tenter de racheter des cartes.</p>`,
    buttons: [{ label: 'OK', value: 'ok', primary: true }],
  });

  return { log: `${cfg.label} — OPAble : l'entreprise est vulnérable.` };
}

// ─── Dispatcher ─────────────────────────────────────────────

const ACTION_HANDLERS: Record<RDEAction, ActionHandler> = {
  resultats_marche: handleResultatsMarche,
  management: handleManagement,
  construction: handleConstruction,
  prospection: handleProspection,
  guerre_des_prix: handleGuerreDesPrix,
  cash_capital: handleCashCapital,
  bourse: handleBourse,
  location_cash: handleLocationCash,
  stock_option: handleStockOption,
  salary_deal: handleSalaryDeal,
  opa: handleOPA,
  opable: handleOPAble,
};

export async function executeAction(ctx: ActionContext): Promise<ActionResult> {
  const action = ctx.company.rdePosition.action;
  const handler = ACTION_HANDLERS[action];
  return handler(ctx);
}
