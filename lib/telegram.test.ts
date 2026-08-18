import { describe, it, expect } from 'vitest';
import { formatReportMessage } from './telegram';

describe('formatReportMessage', () => {
  it('formats a day with movements in USD only', () => {
    const message = formatReportMessage('San Cristóbal', '2026-08-17', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '100.00',
          amount_ves: '0',
        },
        {
          id: 2,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Cambio Zelle',
          type: 'gasto',
          amount_usd: '50.00',
          amount_ves: '0',
        },
      ],
      saldoInicial: { usdCents: 15000, vesCents: 50000 },
      saldoFinal: { usdCents: 20000, vesCents: 50000 },
    });

    expect(message).toBe(
      [
        '*San Cristóbal* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $150.00 / Bs 500.00',
        '',
        'Ingreso Ventas Diarias  +$100.00',
        'Cambio Zelle  -$50.00',
        '',
        'Saldo final: $200.00 / Bs 500.00',
      ].join('\n')
    );
  });

  it('shows "Sin movimientos hoy." when there are no movements', () => {
    const message = formatReportMessage('Barinas', '2026-08-17', {
      movements: [],
      saldoInicial: { usdCents: 15000, vesCents: 50000 },
      saldoFinal: { usdCents: 15000, vesCents: 50000 },
    });

    expect(message).toBe(
      [
        '*Barinas* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $150.00 / Bs 500.00',
        '',
        'Sin movimientos hoy.',
        '',
        'Saldo final: $150.00 / Bs 500.00',
      ].join('\n')
    );
  });

  it('shows both currencies on the same line when both are non-zero', () => {
    const message = formatReportMessage('Barinas', '2026-08-17', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '43.00',
          amount_ves: '1380.00',
        },
      ],
      saldoInicial: { usdCents: 0, vesCents: 0 },
      saldoFinal: { usdCents: 4300, vesCents: 138000 },
    });

    expect(message).toBe(
      [
        '*Barinas* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $0.00 / Bs 0.00',
        '',
        'Ingreso Ventas Diarias  +$43.00  +Bs1380.00',
        '',
        'Saldo final: $43.00 / Bs 1380.00',
      ].join('\n')
    );
  });
});
