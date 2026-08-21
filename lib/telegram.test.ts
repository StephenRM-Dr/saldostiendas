import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatReportMessage, sendTelegramPhoto } from './telegram';

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
          amount_cop: '0',
          observacion: 'Cierre de caja del turno',
        },
        {
          id: 2,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Cambio Zelle',
          type: 'gasto',
          amount_usd: '50.00',
          amount_ves: '0',
          amount_cop: '0',
          observacion: 'Pago a proveedor',
        },
      ],
      saldoInicial: { usdCents: 15000, vesCents: 50000, copCents: 0 },
      saldoFinal: { usdCents: 20000, vesCents: 50000, copCents: 0 },
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
      saldoInicial: { usdCents: 15000, vesCents: 50000, copCents: 0 },
      saldoFinal: { usdCents: 15000, vesCents: 50000, copCents: 0 },
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

  it('uses a custom label instead of "Cierre" when provided', () => {
    const message = formatReportMessage(
      'Barinas',
      '2026-08-17',
      {
        movements: [],
        saldoInicial: { usdCents: 0, vesCents: 0, copCents: 0 },
        saldoFinal: { usdCents: 0, vesCents: 0, copCents: 0 },
      },
      'Reporte de Saldos'
    );

    expect(message.split('\n')[0]).toBe('*Barinas* — Reporte de Saldos 17/08/2026');
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
          amount_cop: '0',
          observacion: 'Cierre de caja del turno',
        },
      ],
      saldoInicial: { usdCents: 0, vesCents: 0, copCents: 0 },
      saldoFinal: { usdCents: 4300, vesCents: 138000, copCents: 0 },
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

  it('includes COP in the saldo lines and each movement when showCop is true', () => {
    const message = formatReportMessage(
      'San Cristóbal',
      '2026-08-17',
      {
        movements: [
          {
            id: 1,
            store_id: 1,
            date: '2026-08-17',
            concept: 'Ingreso Ventas Diarias',
            type: 'ingreso',
            amount_usd: '0',
            amount_ves: '0',
            amount_cop: '50000.00',
            observacion: 'Venta en pesos colombianos',
          },
        ],
        saldoInicial: { usdCents: 0, vesCents: 0, copCents: 0 },
        saldoFinal: { usdCents: 0, vesCents: 0, copCents: 5000000 },
      },
      'Cierre',
      true
    );

    expect(message).toBe(
      [
        '*San Cristóbal* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $0.00 / Bs 0.00 / COP 0.00',
        '',
        'Ingreso Ventas Diarias  +COP50000.00',
        '',
        'Saldo final: $0.00 / Bs 0.00 / COP 50000.00',
      ].join('\n')
    );
  });

  it('omits COP entirely when showCop is false, even with a nonzero amount_cop', () => {
    const message = formatReportMessage('Barinas', '2026-08-17', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '0',
          amount_ves: '0',
          amount_cop: '999.00',
          observacion: 'No debería mostrarse',
        },
      ],
      saldoInicial: { usdCents: 0, vesCents: 0, copCents: 0 },
      saldoFinal: { usdCents: 0, vesCents: 0, copCents: 99900 },
    });

    expect(message).not.toContain('COP');
  });
});

describe('sendTelegramPhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('includes message_thread_id in the request when provided', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendTelegramPhoto('-1004298757566', Buffer.from('img'), 11);

    const formData = fetchMock.mock.calls[0][1].body as FormData;
    expect(formData.get('message_thread_id')).toBe('11');
  });

  it('omits message_thread_id when not provided', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendTelegramPhoto('-1004298757566', Buffer.from('img'));

    const formData = fetchMock.mock.calls[0][1].body as FormData;
    expect(formData.get('message_thread_id')).toBeNull();
  });

  it('does not include a caption, sending only the image', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendTelegramPhoto('-1004298757566', Buffer.from('img'), 11);

    const formData = fetchMock.mock.calls[0][1].body as FormData;
    expect(formData.get('caption')).toBeNull();
    expect(formData.get('parse_mode')).toBeNull();
  });
});
