import { toCents, formatMoney } from './money';
import type { Movement } from './movements';

export function signedAmount(movement: Movement, field: 'amount_usd' | 'amount_ves'): string {
  const cents = toCents(movement[field]);
  if (cents === 0) return '';
  const signed = movement.type === 'gasto' ? -cents : cents;
  return formatMoney(signed);
}
