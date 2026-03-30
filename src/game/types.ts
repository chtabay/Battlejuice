// ─── Entreprises ─────────────────────────────────────────────

export type CompanyId =
  | 'framboise'
  | 'litchi'
  | 'banane'
  | 'orange'
  | 'fraise'
  | 'raisin'
  | 'kiwi'
  | 'myrtille';

export interface CompanyConfig {
  id: CompanyId;
  label: string;
  country: string;
  color: string;
  accentColor: string;
  playOrder: number;
}

export const COMPANIES: Record<CompanyId, CompanyConfig> = {
  framboise: { id: 'framboise', label: 'Framboise', country: 'Russie', color: '#E53935', accentColor: '#FFCDD2', playOrder: 0 },
  litchi:    { id: 'litchi',    label: 'Litchi',     country: 'Chine',  color: '#00BCD4', accentColor: '#B2EBF2', playOrder: 1 },
  banane:    { id: 'banane',    label: 'Banane',     country: 'Inde',   color: '#FDD835', accentColor: '#FFF9C4', playOrder: 2 },
  orange:    { id: 'orange',    label: 'Orange',     country: 'Brésil', color: '#FB8C00', accentColor: '#FFE0B2', playOrder: 3 },
  fraise:    { id: 'fraise',    label: 'Fraise',     country: 'USA',    color: '#FAFAFA', accentColor: '#F5F5F5', playOrder: 4 },
  raisin:    { id: 'raisin',    label: 'Raisin',     country: 'Europe', color: '#8E24AA', accentColor: '#E1BEE7', playOrder: 5 },
  kiwi:      { id: 'kiwi',     label: 'Kiwi',       country: 'N-Z',    color: '#43A047', accentColor: '#C8E6C9', playOrder: 6 },
  myrtille:  { id: 'myrtille',  label: 'Myrtille',   country: 'Canada', color: '#1565C0', accentColor: '#BBDEFB', playOrder: 7 },
};

export const COMPANY_PLAY_ORDER: CompanyId[] = [
  'framboise', 'litchi', 'banane', 'orange', 'fraise', 'raisin', 'kiwi', 'myrtille',
];

// ─── Joueurs ────────────────────────────────────────────────

export interface Player {
  id: number;
  name: string;
  cash: number;
  cards: CardHolding[];
}

export interface CardHolding {
  companyId: CompanyId;
  cardNumber: number; // 1-10
}

// ─── Entreprises (état en jeu) ──────────────────────────────

export interface CompanyState {
  id: CompanyId;
  introduced: boolean;
  treasury: number;
  rdePosition: RDEPosition;
  marketValue: number;
  level: CompanyLevel;
  patronPlayerId: number | null;
}

export type CompanyLevel = 1 | 2 | 3 | 4 | 5;

export function getLevelFromMarketValue(value: number): CompanyLevel {
  if (value >= 40) return 5;
  if (value >= 27) return 4;
  if (value >= 19) return 3;
  if (value >= 10) return 2;
  return 1;
}

export function getCardPrice(cardNumber: number, level: CompanyLevel): number {
  return cardNumber * 2 * level;
}

// ─── RDE (Règle d'Évolution des Entreprises) ────────────────

export type RDEZone =
  | 'exploitation_bleue'
  | 'exploitation_verte'
  | 'resultats_marche_haut'
  | 'resultats_marche_bas'
  | 'croissance_rose'
  | 'restructuration_orange';

export type RDEAction =
  | 'management'
  | 'prospection'
  | 'construction'
  | 'guerre_des_prix'
  | 'resultats_marche'
  | 'cash_capital'
  | 'bourse'
  | 'location_cash'
  | 'opable'
  | 'opa'
  | 'stock_option'
  | 'salary_deal';

export type RDESubPosition = 'gauche' | 'droite';

export interface RDEPosition {
  zone: RDEZone;
  action: RDEAction;
  subPosition: RDESubPosition;
}

// ─── Plateau hexagonal ──────────────────────────────────────

export type HexType =
  | 'libre'
  | 'entreprise'
  | 'desert'
  | 'embargo'
  | 'ocean';

export interface HexCell {
  q: number; // axial coordinate
  r: number; // axial coordinate
  type: HexType;
  companyId: CompanyId | null;
  hasFactory: boolean;
  hasSchool: boolean;
  prospectionPawns: CompanyId[];
  marketShareOwner: CompanyId | null;
  leasedFactory: CompanyId | null;
  leasedSchool: CompanyId | null;
}

export interface BoardLayout {
  name: string;
  playerCount: string;
  cells: HexCell[];
}

// ─── Marché boursier ────────────────────────────────────────

export interface MarketState {
  availableCards: CardHolding[];
}

// ─── Phase de tour ──────────────────────────────────────────

export type TurnPhase =
  | 'select_rde'
  | 'resolve_action'
  | 'prospection_pending'
  | 'done';

/** Saisie du nombre de cases à conquérir (pas de modale — UI dans le pied de page). */
export interface PendingProspectionState {
  companyId: CompanyId;
  /** Ordre de conquête (coordonnées axiales) */
  targetKeys: string[];
  /** min(pions sur le plateau, cases cibles) */
  maxConquer: number;
  introHtml: string;
}

// ─── Etat global du jeu ─────────────────────────────────────

export type GamePhase =
  | 'setup'
  | 'placement'
  | 'playing'
  | 'agent_libre'
  | 'game_over';

export type SetupVariant = 1 | 2;
export type EndVariant = 1 | 2;

export interface GameConfig {
  setupVariant: SetupVariant;
  endVariant: EndVariant;
  endCashTarget: number;
  playerCount: number;
  boardLayout: BoardLayout;
}

export interface GameState {
  config: GameConfig;
  phase: GamePhase;
  turnPhase: TurnPhase;
  turn: number;
  players: Player[];
  companies: Record<CompanyId, CompanyState>;
  market: MarketState;
  board: BoardLayout;
  currentCompanyIndex: number;
  agentLibrePlayerId: number;
  agentLibreUsedThisRound: boolean;
  lastActionLog: string | null;
  pendingProspection: PendingProspectionState | null;
}
