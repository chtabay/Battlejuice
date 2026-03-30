import type { CompanyLevel } from './types';

export const MAX_PROSPECTION_PAWNS = 21;
export const MAX_MARKET_SHARES = 21;
export const MAX_FACTORIES = 10;
export const MAX_SCHOOLS = 5;

export const FACTORY_COST = 10;
export const SCHOOL_COST = 5;
export const RECRUIT_PAWN_COST = 3;

export const REVENUE_PER_SUPPLIED_SHARE = 3;
export const SHARES_PER_FACTORY = 3;
export const FACTORY_UPKEEP = 1;
export const SCHOOL_UPKEEP = 1;
export const PROSPECTION_UPKEEP = 1;

export const SCHOOL_MARKET_BONUS = 1;
export const FIFTH_SCHOOL_BONUS = 4;

export const INITIAL_COMPANY_TREASURY = 15;

export const LEVEL_THRESHOLDS: Record<CompanyLevel, { min: number; max: number }> = {
  1: { min: 0, max: 9 },
  2: { min: 10, max: 18 },
  3: { min: 19, max: 26 },
  4: { min: 27, max: 39 },
  5: { min: 40, max: Infinity },
};

export const BILLS = [1, 2, 5, 10, 50, 100, 500] as const;

export function computeProductionMargin(factories: number, marketShares: number): number {
  const suppliedShares = Math.min(marketShares, factories * SHARES_PER_FACTORY);
  return suppliedShares * REVENUE_PER_SUPPLIED_SHARE - factories * FACTORY_UPKEEP;
}

export function computeMarketValue(
  factories: number,
  marketShares: number,
  schools: number,
): number {
  const margin = computeProductionMargin(factories, marketShares);
  const schoolBonus = Math.min(schools, 4) * SCHOOL_MARKET_BONUS
    + (schools >= 5 ? FIFTH_SCHOOL_BONUS : 0);
  return margin + schoolBonus;
}

export function computeResult(
  factories: number,
  marketShares: number,
  schools: number,
  prospectionPawns: number,
): number {
  const margin = computeProductionMargin(factories, marketShares);
  return margin - schools * SCHOOL_UPKEEP - prospectionPawns * PROSPECTION_UPKEEP;
}
