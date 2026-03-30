import { BoardRenderer } from '../board/BoardRenderer';
import { createDefault4PlayerLayout } from '../board/defaultLayouts';
import type { CompanyId, CompanyState, GameState, Player } from '../game/types';
import { COMPANIES, COMPANY_PLAY_ORDER } from '../game/types';
import { ACTION_LABELS } from '../game/RDE';
import { executeAction, computeBoardStats, applyProspectionCount, clearPendingProspection } from '../game/actions';
import { ActionModal } from './ActionModal';
import { RDEPanel } from './RDEPanel';
import { CompanyPanel } from './CompanyPanel';
import { PlayerPanel } from './PlayerPanel';
import { axialKey } from '../board/hexUtils';

export class App {
  private root: HTMLElement;
  private gameState: GameState | null = null;

  private boardRenderer: BoardRenderer | null = null;
  private rdePanel: RDEPanel | null = null;
  private companyPanel: CompanyPanel | null = null;
  private playerPanels: PlayerPanel[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start() {
    this.showTitleScreen();
  }

  // ─── Écran titre ────────────────────────────────────────────

  private showTitleScreen() {
    this.root.innerHTML = `
      <div class="title-screen">
        <h1>Battle Juice</h1>
        <p class="subtitle">La guerre des jus de fruits</p>
        <div class="title-actions">
          <button class="btn btn-primary" id="btn-new-game">Nouvelle Partie</button>
          <button class="btn btn-secondary" id="btn-rules">Comment jouer</button>
          <button class="btn btn-secondary" id="btn-load" disabled>Charger (bientôt)</button>
        </div>
      </div>
    `;

    document.getElementById('btn-new-game')!.addEventListener('click', () => {
      this.showSetupScreen();
    });
    document.getElementById('btn-rules')!.addEventListener('click', () => {
      this.showRulesScreen();
    });
  }

  // ─── Écran des règles ─────────────────────────────────────────

  private showRulesScreen() {
    this.root.innerHTML = `
      <div class="rules-screen">
        <div class="rules-header">
          <button class="btn btn-secondary rules-back" id="btn-rules-back">← Retour</button>
          <h2>Comment jouer</h2>
        </div>
        <div class="rules-scroll">
          <div class="rules-content">

            <section class="rules-section rules-intro">
              <h3>Bienvenue dans Battle Juice !</h3>
              <p>
                Battle Juice est un jeu de stratégie économique pour <strong>2 à 8 joueurs</strong>.
                Vous incarnez des investisseurs rivaux qui se disputent le contrôle
                d'entreprises multinationales de jus de fruits. Construisez des usines,
                conquérez des parts de marché, lancez des OPA et devenez le magnat
                incontesté du jus !
              </p>
            </section>

            <section class="rules-section">
              <h3>Objectif</h3>
              <p>
                Accumulez le plus de richesse possible. Votre fortune se compose de
                votre <strong>cash personnel</strong> (dividendes reçus) et de la
                <strong>valeur de vos cartes d'actions</strong> dans les différentes
                entreprises. La partie se termine quand une entreprise atteint le
                <strong>niveau 5</strong> (ou un objectif cash selon la variante choisie).
              </p>
            </section>

            <section class="rules-section">
              <h3>Les entreprises</h3>
              <p>
                Il y a <strong>8 entreprises</strong>, chacune associée à un fruit et un pays.
                Chaque entreprise est dirigée par un <strong>patron</strong> — le joueur qui
                détient la plus grande valeur de cartes. Le patron prend toutes les
                décisions pour l'entreprise à chaque tour.
              </p>
              <div class="rules-grid rules-companies">
                <span class="rules-co" style="--co-color:#E53935">Framboise</span>
                <span class="rules-co" style="--co-color:#00BCD4">Litchi</span>
                <span class="rules-co" style="--co-color:#FDD835">Banane</span>
                <span class="rules-co" style="--co-color:#FB8C00">Orange</span>
                <span class="rules-co" style="--co-color:#BDBDBD">Fraise</span>
                <span class="rules-co" style="--co-color:#8E24AA">Raisin</span>
                <span class="rules-co" style="--co-color:#43A047">Kiwi</span>
                <span class="rules-co" style="--co-color:#1565C0">Myrtille</span>
              </div>
            </section>

            <section class="rules-section">
              <h3>Le plateau hexagonal</h3>
              <p>
                Le plateau est composé de <strong>cases hexagonales</strong>. Chaque entreprise
                possède un territoire de départ avec une <strong>usine</strong> et une
                <strong>école de management</strong>. Les cases libres, désertiques et en
                embargo complètent la carte. L'objectif est de conquérir les cases libres
                avec des <strong>pions de prospection</strong> pour gagner des parts de marché.
              </p>
            </section>

            <section class="rules-section">
              <h3>Le cycle RDE</h3>
              <p>
                La <strong>RDE</strong> (Règle d'Évolution des Entreprises) est le cœur
                du jeu. C'est un cycle d'actions que chaque entreprise parcourt à son tour.
                Le patron choisit sur quelle case avancer parmi les <strong>options légales</strong>
                affichées en surbrillance dorée.
              </p>
              <p>Le cycle se compose de <strong>4 zones</strong> principales :</p>

              <div class="rules-zones">
                <div class="rules-zone" style="--zone-color:#F48FB1">
                  <h4>Zone Rose — Croissance</h4>
                  <p>Distribuez des dividendes, émettez des stock-options ou lancez une OPA hostile.</p>
                  <ul>
                    <li><strong>Cash & Capital</strong> — Verser des dividendes aux actionnaires</li>
                    <li><strong>Rachat Salarié</strong> — Les actionnaires revendent des cartes à l'entreprise</li>
                    <li><strong>Stock-Option</strong> — Le patron reçoit des cartes gratuites</li>
                    <li><strong>OPA</strong> — Lancer une offre publique d'achat (case répétable)</li>
                  </ul>
                </div>

                <div class="rules-zone" style="--zone-color:#42A5F5">
                  <h4>Zone Bleue — Exploitation</h4>
                  <p>Développez votre entreprise sur le terrain. Flux bidirectionnel (montant ↑ ou descendant ↓).</p>
                  <ul>
                    <li><strong>Management</strong> — Recruter des pions (3M) et construire des écoles (5M)</li>
                    <li><strong>Prospection</strong> — Déplacer les pions pour conquérir des parts de marché</li>
                    <li><strong>Construction</strong> — Construire des usines (10M), chacune alimente 3 parts</li>
                    <li><strong>Guerre des Prix</strong> — Attaquer les parts adverses par comparaison de force</li>
                  </ul>
                </div>

                <div class="rules-zone" style="--zone-color:#66BB6A">
                  <h4>Zone Verte — Exploitation</h4>
                  <p>Même actions que la Bleue, dans l'ordre inverse. Permet un second passage.</p>
                </div>

                <div class="rules-zone" style="--zone-color:#FFB74D">
                  <h4>Zone Orange — Restructuration</h4>
                  <p>Gérez la structure financière en difficulté ou préparez-vous à être racheté.</p>
                  <ul>
                    <li><strong>Cash & Capital</strong> — Verser des dividendes</li>
                    <li><strong>Bourse</strong> — Émettre ou racheter des actions</li>
                    <li><strong>Location & Cash</strong> — Louer des usines ou emprunter</li>
                    <li><strong>OPAble</strong> — L'entreprise est vulnérable à un rachat (case répétable)</li>
                  </ul>
                </div>
              </div>

              <div class="rules-zone" style="--zone-color:#9E9E9E">
                <h4>Résultats & Marché</h4>
                <p>
                  Deux cases de transition entre les zones. On y calcule les résultats financiers :
                  <strong>revenus</strong> (parts approvisionnées × 3M) moins
                  <strong>charges</strong> (usines, écoles, pions). Le résultat ajuste la
                  trésorerie et peut faire monter ou descendre le <strong>niveau</strong> de
                  l'entreprise (1 à 5).
                </p>
              </div>
            </section>

            <section class="rules-section">
              <h3>Flux du cycle</h3>
              <p>Le parcours n'est pas linéaire — des <strong>raccourcis stratégiques</strong> existent :</p>
              <ul class="rules-flow">
                <li><strong>Descendant (D ↓)</strong> : Rose → Bleue ↓ → Verte ↓ → R&M bas → Orange</li>
                <li><strong>Montant (G ↑)</strong> : Orange → Verte ↑ → Bleue ↑ → R&M haut → Rose</li>
                <li>Depuis <strong>R&M</strong>, on peut sauter vers Bleue ou Verte au choix</li>
                <li>Depuis <strong>Rose</strong>, on rejoint directement la Bleue</li>
                <li>Depuis <strong>Orange</strong>, on rejoint directement la Verte</li>
              </ul>
              <p>
                Le choix entre descendre (vers la restructuration) ou remonter (vers la
                croissance) est une <strong>décision stratégique majeure</strong> à anticiper.
              </p>
            </section>

            <section class="rules-section">
              <h3>Économie</h3>
              <div class="rules-table-wrap">
                <table class="rules-table">
                  <thead><tr><th>Élément</th><th>Coût</th><th>Effet</th></tr></thead>
                  <tbody>
                    <tr><td>Pion de prospection</td><td>3M</td><td>Conquiert une part de marché</td></tr>
                    <tr><td>École de management</td><td>5M</td><td>+1 valeur marché (5e école : +4 bonus)</td></tr>
                    <tr><td>Usine</td><td>10M</td><td>Alimente 3 parts, -1M d'entretien</td></tr>
                    <tr><td>Part approvisionnée</td><td>—</td><td>+3M de revenu</td></tr>
                    <tr><td>Entretien école</td><td>-1M</td><td>Par école possédée</td></tr>
                    <tr><td>Entretien prospection</td><td>-1M</td><td>Par pion sur le plateau</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="rules-section">
              <h3>Cartes d'actions</h3>
              <p>
                Chaque entreprise a <strong>10 cartes</strong> numérotées de 1 à 10.
                La valeur d'une carte = <strong>numéro × 2 × niveau</strong> de l'entreprise.
                Le joueur possédant la plus forte somme de cartes d'une entreprise en
                devient le <strong>patron</strong>. Les cartes s'échangent via la Bourse,
                les OPA, les Stock-Options et les Rachats Salariés.
              </p>
            </section>

            <section class="rules-section">
              <h3>Déroulement d'un tour</h3>
              <ol class="rules-steps">
                <li>Les entreprises jouent dans l'ordre fixe (Framboise, Litchi, Banane, Orange, Fraise, Raisin, Kiwi, Myrtille).</li>
                <li>Le <strong>patron</strong> de l'entreprise active choisit une case RDE parmi les options légales.</li>
                <li>L'action correspondante est résolue (recrutement, construction, combat, etc.).</li>
                <li>La trésorerie et le niveau sont mis à jour.</li>
                <li>On passe à l'entreprise suivante. Quand toutes ont joué, un nouveau tour commence.</li>
              </ol>
            </section>

            <section class="rules-section">
              <h3>Niveaux d'entreprise</h3>
              <div class="rules-table-wrap">
                <table class="rules-table">
                  <thead><tr><th>Niveau</th><th>Valeur marché</th><th>Multiplicateur carte</th></tr></thead>
                  <tbody>
                    <tr><td>1</td><td>0 – 9</td><td>×2</td></tr>
                    <tr><td>2</td><td>10 – 18</td><td>×4</td></tr>
                    <tr><td>3</td><td>19 – 26</td><td>×6</td></tr>
                    <tr><td>4</td><td>27 – 39</td><td>×8</td></tr>
                    <tr><td>5</td><td>40+</td><td>×10</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="rules-section rules-tip">
              <h3>Conseils stratégiques</h3>
              <ul>
                <li>Devenez patron des entreprises les plus prometteuses pour contrôler leur destinée.</li>
                <li>Diversifiez vos investissements : ne mettez pas tous vos œufs dans le même panier de fruits.</li>
                <li>Surveillez le cycle RDE — les raccourcis vers Rose (OPA) ou Orange (OPAble) sont des armes redoutables.</li>
                <li>Une entreprise avec beaucoup d'usines mais peu de parts est déficitaire : équilibrez !</li>
                <li>Anticipez les passages en R&M pour maximiser vos résultats financiers.</li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-rules-back')!.addEventListener('click', () => {
      this.showTitleScreen();
    });
  }

  // ─── Écran de configuration ─────────────────────────────────

  private showSetupScreen() {
    this.root.innerHTML = `
      <div class="setup-screen">
        <h2>Configuration de la partie</h2>
        <div class="setup-form">
          <div class="form-group">
            <label for="player-count">Nombre de joueurs</label>
            <select id="player-count">
              <option value="2">2 joueurs</option>
              <option value="3">3 joueurs</option>
              <option value="4" selected>4 joueurs</option>
              <option value="5">5 joueurs</option>
              <option value="6">6 joueurs</option>
              <option value="7">7 joueurs</option>
              <option value="8">8 joueurs</option>
            </select>
          </div>
          <div class="form-group">
            <label for="setup-variant">Variante de mise en place</label>
            <select id="setup-variant">
              <option value="1">Variante 1 : Distribution fixe</option>
              <option value="2">Variante 2 : Draft / Enchères</option>
            </select>
          </div>
          <div class="form-group">
            <label for="end-variant">Variante de fin</label>
            <select id="end-variant">
              <option value="1">Variante 1 : Première entreprise niveau 5</option>
              <option value="2">Variante 2 : Objectif cash (200M+)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Noms des joueurs</label>
            <div class="player-names" id="player-names"></div>
          </div>
          <button class="btn btn-primary" id="btn-start">Lancer la partie</button>
        </div>
      </div>
    `;

    const playerCountSelect = document.getElementById('player-count') as HTMLSelectElement;
    const playerNamesDiv = document.getElementById('player-names')!;

    const updatePlayerNames = () => {
      const count = parseInt(playerCountSelect.value);
      playerNamesDiv.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Joueur ${i + 1}`;
        input.value = `Joueur ${i + 1}`;
        input.dataset.index = String(i);
        playerNamesDiv.appendChild(input);
      }
    };

    updatePlayerNames();
    playerCountSelect.addEventListener('change', updatePlayerNames);

    document.getElementById('btn-start')!.addEventListener('click', () => {
      const count = parseInt(playerCountSelect.value);
      const setupVariant = parseInt((document.getElementById('setup-variant') as HTMLSelectElement).value) as 1 | 2;
      const endVariant = parseInt((document.getElementById('end-variant') as HTMLSelectElement).value) as 1 | 2;

      const names: string[] = [];
      const inputs = playerNamesDiv.querySelectorAll('input');
      inputs.forEach(input => names.push((input as HTMLInputElement).value || `Joueur ${names.length + 1}`));

      this.initGame(count, names, setupVariant, endVariant);
    });
  }

  // ─── Initialisation du jeu ──────────────────────────────────

  private initGame(playerCount: number, names: string[], setupVariant: 1 | 2, endVariant: 1 | 2) {
    const board = createDefault4PlayerLayout();

    const players: Player[] = names.map((name, i) => ({
      id: i,
      name,
      cash: 0,
      cards: [],
    }));

    const companies: Record<CompanyId, CompanyState> = {} as Record<CompanyId, CompanyState>;
    const introCount = playerCount <= 4 ? 6 : Math.min(playerCount, 8);

    for (const id of COMPANY_PLAY_ORDER) {
      const config = COMPANIES[id];
      const introduced = config.playOrder < introCount;
      companies[id] = {
        id,
        introduced,
        treasury: introduced ? 15 : 0,
        rdePosition: {
          zone: 'croissance_rose',
          action: 'cash_capital',
          subPosition: 'gauche',
        },
        marketValue: 0,
        level: 1,
        patronPlayerId: null,
      };
    }

    // Distribution variante 1 simplifiée (on distribue les cartes 1 et 3 aux joueurs)
    if (setupVariant === 1) {
      this.distributeVariant1(players, companies, playerCount);
    }

    // Setup initial du plateau : placer usines et écoles de management
    for (const cell of board.cells) {
      if (cell.type === 'entreprise' && cell.companyId && companies[cell.companyId].introduced) {
        const cluster = board.cells.filter(c => c.companyId === cell.companyId);
        const center = cluster[0];
        if (center && !center.hasSchool) {
          center.hasSchool = true;
          center.prospectionPawns.push(cell.companyId);
          center.marketShareOwner = cell.companyId;
        }
        const factoryCell = cluster[1];
        if (factoryCell && !factoryCell.hasFactory) {
          factoryCell.hasFactory = true;
          factoryCell.prospectionPawns.push(cell.companyId!);
          factoryCell.marketShareOwner = cell.companyId;
        }
      }
    }

    this.gameState = {
      config: {
        setupVariant,
        endVariant,
        endCashTarget: 200,
        playerCount,
        boardLayout: board,
      },
      phase: 'playing',
      turnPhase: 'select_rde',
      turn: 1,
      players,
      companies,
      market: { availableCards: [] },
      board,
      currentCompanyIndex: 0,
      agentLibrePlayerId: 1,
      agentLibreUsedThisRound: false,
      lastActionLog: null,
      pendingProspection: null,
    };

    this.showGameScreen();
  }

  private distributeVariant1(players: Player[], companies: Record<CompanyId, CompanyState>, playerCount: number) {
    const introduced = COMPANY_PLAY_ORDER.filter(id => companies[id].introduced);

    if (playerCount === 4) {
      const distributions = [
        [{ c: 'framboise', n: [1, 3] }, { c: 'fraise', n: [3] }, { c: 'litchi', n: [1] }, { c: 'orange', n: [1] }],
        [{ c: 'banane', n: [1, 3] }, { c: 'raisin', n: [3] }, { c: 'myrtille', n: [1] }, { c: 'framboise', n: [1] }],
        [{ c: 'litchi', n: [1, 3] }, { c: 'banane', n: [1] }, { c: 'kiwi', n: [3, 1] }],
        [{ c: 'orange', n: [1, 3] }, { c: 'myrtille', n: [3] }, { c: 'raisin', n: [1] }, { c: 'fraise', n: [1] }],
      ];
      for (let p = 0; p < Math.min(playerCount, distributions.length); p++) {
        for (const dist of distributions[p]) {
          for (const cardNum of dist.n) {
            players[p].cards.push({ companyId: dist.c as CompanyId, cardNumber: cardNum });
          }
        }
      }
    } else {
      // Distribution simplifiée : carte 1 et 3 par round-robin
      for (let i = 0; i < introduced.length; i++) {
        const companyId = introduced[i];
        const p1 = i % playerCount;
        const p2 = (i + 1) % playerCount;
        players[p1].cards.push({ companyId, cardNumber: 3 });
        players[p2].cards.push({ companyId, cardNumber: 1 });
      }
    }

    // Déterminer les patrons (plus grande somme de cartes)
    for (const companyId of introduced) {
      let maxWeight = 0;
      let patronId: number | null = null;
      for (const player of players) {
        const weight = player.cards
          .filter(c => c.companyId === companyId)
          .reduce((s, c) => s + c.cardNumber, 0);
        if (weight > maxWeight) {
          maxWeight = weight;
          patronId = player.id;
        }
      }
      companies[companyId].patronPlayerId = patronId;
    }
  }

  // ─── Écran de jeu ──────────────────────────────────────────

  private showGameScreen() {
    if (!this.gameState) return;
    // Game screen

    const state = this.gameState;
    const currentCompany = COMPANY_PLAY_ORDER[state.currentCompanyIndex];
    const currentCompanyState = state.companies[currentCompany];

    const isSelectPhase = state.turnPhase === 'select_rde';
    const isProspectionPending = state.turnPhase === 'prospection_pending';
    const isDone = state.turnPhase === 'done';

    const phaseLabel = isSelectPhase
      ? '<span class="phase-badge phase-select">Choisir une action RDE</span>'
      : isProspectionPending
        ? '<span class="phase-badge phase-prospection">Prospection</span>'
        : isDone
          ? '<span class="phase-badge phase-done">Action résolue</span>'
          : '<span class="phase-badge phase-resolve">Résolution…</span>';

    this.root.innerHTML = `
      <div class="game-layout">
        <div class="board-container" id="board-container"></div>

        <div class="game-header glass">
          <h2>Battle Juice</h2>
          <div class="turn-info">
            <span>Tour ${state.turn}</span>
            <span>|</span>
            <span style="color:${COMPANIES[currentCompany].color}; font-weight:700;">
              ${COMPANIES[currentCompany].label}
            </span>
            <span class="current-action">
              ${ACTION_LABELS[currentCompanyState.rdePosition.action]}
            </span>
            ${currentCompanyState.patronPlayerId !== null
              ? `<span>Patron : ${state.players[currentCompanyState.patronPlayerId].name}</span>`
              : ''}
            ${phaseLabel}
          </div>
          <button class="btn btn-secondary" id="btn-menu" style="padding:4px 14px;font-size:0.8rem;">Menu</button>
        </div>

        <div class="right-panel glass" id="right-panel">
          <button class="panel-toggle" id="toggle-right" title="Masquer/Afficher">◂</button>
          <div class="right-panel-scroll" id="right-panel-scroll"></div>
        </div>

        <div class="rde-bar glass" id="rde-bar">
          <button class="rde-bar-toggle" id="toggle-rde">▾ RDE</button>
          <div class="rde-bar-content" id="rde-bar-content"></div>
        </div>

        <div class="game-footer glass">
          ${state.pendingProspection ? `
            <div class="prospection-panel" id="prospection-panel">
              ${state.pendingProspection.introHtml}
              <div class="prospection-actions">
                <label for="prospection-count">Nombre de cases à conquérir (max ${state.pendingProspection.maxConquer}) :</label>
                <input type="number" id="prospection-count" class="prospection-count-input" min="0"
                  max="${state.pendingProspection.maxConquer}" value="${state.pendingProspection.maxConquer}" />
                <button type="button" class="btn btn-primary" id="btn-prospection-ok">Valider</button>
                <button type="button" class="btn btn-secondary" id="btn-prospection-cancel">Annuler</button>
              </div>
              <p class="prospection-order-hint">Ordre des cases : liste fixe du moteur (déterministe).</p>
            </div>
          ` : ''}
          ${state.lastActionLog && !state.pendingProspection ? `<div class="action-log">${state.lastActionLog}</div>` : ''}
          <button class="btn btn-primary" id="btn-next-turn" ${!isDone ? 'disabled' : ''}>Tour suivant →</button>
        </div>
      </div>
    `;

    // Board
    const boardContainer = document.getElementById('board-container')!;
    this.boardRenderer = new BoardRenderer(boardContainer);
    this.boardRenderer.render(state.board);
    this.boardRenderer.setOnHexClick((cell) => {
      console.log('Hex cliqué:', axialKey(cell), cell);
    });

    // RDE Panel
    const rdeBar = document.getElementById('rde-bar')!;
    const rdeContent = document.getElementById('rde-bar-content')!;
    this.rdePanel = new RDEPanel(rdeContent);
    this.rdePanel.render(
      Object.values(state.companies),
      currentCompany,
      isSelectPhase,
    );
    this.rdePanel.setOnMoveSelect((pos) => {
      if (!this.gameState || this.gameState.turnPhase !== 'select_rde') return;
      const companyId = COMPANY_PLAY_ORDER[this.gameState.currentCompanyIndex];
      this.gameState.companies[companyId].rdePosition = pos;
      this.gameState.turnPhase = 'resolve_action';
      this.resolveCurrentAction();
    });

    // Right panel: company + player panels
    const rightPanel = document.getElementById('right-panel')!;
    const rightScroll = document.getElementById('right-panel-scroll')!;

    this.companyPanel = new CompanyPanel(rightScroll);
    const boardStats = computeBoardStats(state.board, currentCompany);
    this.companyPanel.render(currentCompanyState, state.players, boardStats);

    this.playerPanels = [];
    for (const player of state.players) {
      const panel = new PlayerPanel(rightScroll);
      const isPatron = currentCompanyState.patronPlayerId === player.id;
      panel.render(player, state.companies, isPatron);
      this.playerPanels.push(panel);
    }

    // Panel toggles
    const toggleRight = document.getElementById('toggle-right')!;
    toggleRight.addEventListener('click', () => {
      const collapsed = rightPanel.classList.toggle('collapsed');
      toggleRight.textContent = collapsed ? '▸' : '◂';
    });

    const toggleRde = document.getElementById('toggle-rde')!;
    toggleRde.addEventListener('click', () => {
      const collapsed = rdeBar.classList.toggle('collapsed');
      toggleRde.textContent = collapsed ? '▴ RDE' : '▾ RDE';
    });

    // Events
    document.getElementById('btn-next-turn')!.addEventListener('click', () => {
      this.nextCompanyTurn();
    });

    document.getElementById('btn-menu')!.addEventListener('click', () => {
      this.showTitleScreen();
    });

    if (state.pendingProspection) {
      document.getElementById('btn-prospection-ok')!.addEventListener('click', () => {
        this.confirmProspection();
      });
      document.getElementById('btn-prospection-cancel')!.addEventListener('click', () => {
        this.cancelProspection();
      });
    }

    window.addEventListener('resize', () => {
      this.boardRenderer?.resize();
    });
  }

  private async resolveCurrentAction() {
    if (!this.gameState) return;
    const state = this.gameState;
    const companyId = COMPANY_PLAY_ORDER[state.currentCompanyIndex];
    const company = state.companies[companyId];
    const stats = computeBoardStats(state.board, companyId);

    const modal = new ActionModal();
    const result = await executeAction({
      state,
      companyId,
      company,
      stats,
      modal,
    });

    if (result.prospectionDeferred) {
      state.pendingProspection = result.prospectionDeferred;
      state.turnPhase = 'prospection_pending';
      state.lastActionLog = null;
      this.refreshGameScreen();
      return;
    }

    state.lastActionLog = result.log;
    state.turnPhase = 'done';
    this.refreshGameScreen();
  }

  private confirmProspection() {
    if (!this.gameState?.pendingProspection) return;
    const log = applyProspectionCount(this.gameState, this.getProspectionCountInput());
    this.gameState.lastActionLog = log;
    this.gameState.turnPhase = 'done';
    this.refreshGameScreen();
  }

  private cancelProspection() {
    if (!this.gameState?.pendingProspection) return;
    const companyId = this.gameState.pendingProspection.companyId;
    clearPendingProspection(this.gameState);
    this.gameState.lastActionLog = `${COMPANIES[companyId].label} — Prospection : annulée.`;
    this.gameState.turnPhase = 'done';
    this.refreshGameScreen();
  }

  private getProspectionCountInput(): number {
    const input = document.getElementById('prospection-count') as HTMLInputElement | null;
    if (!input) return 0;
    return parseInt(input.value, 10) || 0;
  }

  private refreshGameScreen() {
    this.showGameScreen();
  }

  private nextCompanyTurn() {
    if (!this.gameState) return;
    const state = this.gameState;

    if (state.turnPhase !== 'done') return;

    const introducedCompanies = COMPANY_PLAY_ORDER.filter(id => state.companies[id].introduced);

    const prevCompanyId = COMPANY_PLAY_ORDER[state.currentCompanyIndex];
    const prevPatronId = state.companies[prevCompanyId].patronPlayerId;

    let nextIndex = state.currentCompanyIndex + 1;
    if (nextIndex >= introducedCompanies.length) {
      nextIndex = 0;
      state.turn++;
    }
    state.currentCompanyIndex = nextIndex;
    state.turnPhase = 'select_rde';
    state.lastActionLog = null;
    state.pendingProspection = null;

    const nextCompanyId = COMPANY_PLAY_ORDER[state.currentCompanyIndex];
    const nextPatronId = state.companies[nextCompanyId].patronPlayerId;

    if (nextPatronId !== prevPatronId && nextPatronId !== null) {
      this.showHotseatScreen(nextCompanyId);
    } else {
      this.refreshGameScreen();
    }
  }

  // ─── Écran de transition hotseat ──────────────────────────────

  private showHotseatScreen(companyId: CompanyId) {
    if (!this.gameState) return;
    const state = this.gameState;
    const company = state.companies[companyId];
    const cfg = COMPANIES[companyId];
    const patron = company.patronPlayerId !== null
      ? state.players[company.patronPlayerId]
      : null;

    this.root.innerHTML = `
      <div class="hotseat-screen">
        <div class="hotseat-card">
          <div class="hotseat-icon" style="background:${cfg.color}">
            ${cfg.label.charAt(0)}
          </div>
          <h2 class="hotseat-company" style="color:${cfg.color}">
            ${cfg.label}
          </h2>
          <p class="hotseat-country">${cfg.country}</p>
          ${patron
            ? `<p class="hotseat-patron">Passez la tablette à <strong>${patron.name}</strong></p>`
            : '<p class="hotseat-patron">Aucun patron</p>'}
          <p class="hotseat-info">Tour ${state.turn} — ${ACTION_LABELS[company.rdePosition.action]}</p>
          <button class="btn btn-primary hotseat-btn" id="btn-hotseat-ready">
            C'est moi, je suis prêt !
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-hotseat-ready')!.addEventListener('click', () => {
      this.showGameScreen();
    });
  }

}
