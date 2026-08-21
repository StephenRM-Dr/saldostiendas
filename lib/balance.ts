import { toCents } from './money';

export type MovementType = 'ingreso' | 'gasto';

export interface MovementAmounts {
  type: MovementType;
  amount_usd: string | number;
  amount_ves: string | number;
  amount_cop: string | number;
}

export interface Balance {
  usdCents: number;
  vesCents: number;
  copCents: number;
}

export function computeBalance(movements: MovementAmounts[]): Balance {
  return movements.reduce<Balance>(
    (acc, m) => {
      const sign = m.type === 'ingreso' ? 1 : -1;
      return {
        usdCents: acc.usdCents + sign * toCents(m.amount_usd),
        vesCents: acc.vesCents + sign * toCents(m.amount_ves),
        copCents: acc.copCents + sign * toCents(m.amount_cop),
      };
    },
    { usdCents: 0, vesCents: 0, copCents: 0 }
  );
}
