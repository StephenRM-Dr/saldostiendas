import type { Movement } from './movements';
import type { Balance } from './balance';
import { toCents, formatMoney } from './money';

function formatDateDMY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatSignedAmount(cents: number, prefix: string): string {
  if (cents === 0) return '';
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${prefix}${formatMoney(Math.abs(cents))}`;
}

function formatMovementLine(movement: Movement): string {
  const sign = movement.type === 'gasto' ? -1 : 1;
  const usdCents = sign * toCents(movement.amount_usd);
  const vesCents = sign * toCents(movement.amount_ves);
  const amounts = [formatSignedAmount(usdCents, '$'), formatSignedAmount(vesCents, 'Bs')]
    .filter((part) => part !== '')
    .join('  ');
  return `${movement.concept}  ${amounts}`;
}

export function formatReportMessage(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance },
  label: string = 'Cierre'
): string {
  const { movements, saldoInicial, saldoFinal } = ledger;
  const movementsBlock =
    movements.length === 0 ? 'Sin movimientos hoy.' : movements.map(formatMovementLine).join('\n');

  return [
    `*${storeName}* — ${label} ${formatDateDMY(date)}`,
    '',
    `Saldo inicial: $${formatMoney(saldoInicial.usdCents)} / Bs ${formatMoney(saldoInicial.vesCents)}`,
    '',
    movementsBlock,
    '',
    `Saldo final: $${formatMoney(saldoFinal.usdCents)} / Bs ${formatMoney(saldoFinal.vesCents)}`,
  ].join('\n');
}

export async function sendTelegramPhoto(
  chatId: string,
  imageBuffer: Buffer,
  caption: string,
  messageThreadId?: number | null
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  const formData = new FormData();
  formData.set('chat_id', chatId);
  formData.set('caption', caption);
  formData.set('parse_mode', 'Markdown');
  if (messageThreadId != null) {
    formData.set('message_thread_id', String(messageThreadId));
  }
  formData.set('photo', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'reporte.png');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}
