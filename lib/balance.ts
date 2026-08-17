import { toCents } from './money';

export type MovementType = 'ingreso' | 'gasto';

export interface MovementAmounts {
  type: MovementType;
  amount_usd: string | number;
  amount_ves: string | number;
}

export interface Balance {
  usdCents: number;
  vesCents: number;
}

export function computeBalance(movements: MovementAmounts[]): Balance {
  return movements.reduce<Balance>(
    (acc, m) => {
      const sign = m.type === 'ingreso' ? 1 : -1;
      return {
        usdCents: acc.usdCents + sign * toCents(m.amount_usd),
        vesCents: acc.vesCents + sign * toCents(m.amount_ves),
      };
    },
    { usdCents: 0, vesCents: 0 }
  );
}
