import { formatMoney, toCents } from '@/lib/money';
import type { Movement } from '@/lib/movements';

function signedAmount(movement: Movement, field: 'amount_usd' | 'amount_ves'): string {
  const cents = toCents(movement[field]);
  if (cents === 0) return '';
  const signed = movement.type === 'gasto' ? -cents : cents;
  return formatMoney(signed);
}

export default function MovementRow({ movement }: { movement: Movement }) {
  return (
    <tr className="border-b">
      <td className="p-2">{movement.concept}</td>
      <td className="p-2 text-right">{signedAmount(movement, 'amount_usd')}</td>
      <td className="p-2 text-right">{signedAmount(movement, 'amount_ves')}</td>
      <td className="p-2" />
    </tr>
  );
}
