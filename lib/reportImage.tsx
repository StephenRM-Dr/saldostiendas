import { ImageResponse } from 'next/og';
import { formatMoney } from './money';
import { signedAmount } from './movementDisplay';
import type { Movement } from './movements';
import type { Balance } from './balance';

const IMAGE_WIDTH = 800;
const IMAGE_WIDTH_WITH_COP = 1000;
const TITLE_HEIGHT = 90;
const ROW_HEIGHT = 45;
const VERTICAL_PADDING = 40;
const YELLOW = '#fde047';
const YELLOW_LIGHT = '#fef9c3';
const WHITE = '#ffffff';

export function calculateImageHeight(movementCount: number): number {
  const dataRows = Math.max(movementCount, 1);
  const totalRows = dataRows + 3; // header + saldo inicial + data rows + saldo final
  return TITLE_HEIGHT + VERTICAL_PADDING + totalRows * ROW_HEIGHT;
}

function formatDateDMY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function Row({
  concept,
  usd,
  ves,
  cop,
  background,
  bold,
}: {
  concept: string;
  usd: string;
  ves: string;
  cop?: string;
  background: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: `${ROW_HEIGHT}px`,
        backgroundColor: background,
        fontWeight: bold ? 700 : 400,
        fontSize: 20,
        borderBottom: '1px solid #d1d5db',
      }}
    >
      <div style={{ display: 'flex', width: '400px', alignItems: 'center', padding: '0 12px' }}>
        {concept}
      </div>
      <div
        style={{
          display: 'flex',
          width: '200px',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
        }}
      >
        {usd}
      </div>
      <div
        style={{
          display: 'flex',
          width: '200px',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
        }}
      >
        {ves}
      </div>
      {cop !== undefined && (
        <div
          style={{
            display: 'flex',
            width: '200px',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 12px',
          }}
        >
          {cop}
        </div>
      )}
    </div>
  );
}

export function buildReportImageElement(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance },
  label: string = 'Cierre',
  showCop: boolean = false
) {
  const { movements, saldoInicial, saldoFinal } = ledger;
  const cop = (cents: number) => (showCop ? formatMoney(cents) : undefined);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: `${showCop ? IMAGE_WIDTH_WITH_COP : IMAGE_WIDTH}px`,
        backgroundColor: WHITE,
        fontFamily: 'sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: `${TITLE_HEIGHT}px`,
          alignItems: 'center',
          padding: '0 12px',
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {`${storeName} — ${label} ${formatDateDMY(date)}`}
      </div>
      <Row
        concept="Concepto"
        usd="Dólares"
        ves="Bolívares"
        cop={showCop ? 'Pesos COP' : undefined}
        background={YELLOW}
        bold
      />
      <Row
        concept="Saldo al inicio del día"
        usd={formatMoney(saldoInicial.usdCents)}
        ves={formatMoney(saldoInicial.vesCents)}
        cop={cop(saldoInicial.copCents)}
        background={YELLOW_LIGHT}
        bold
      />
      {movements.length === 0 ? (
        <Row concept="Sin movimientos hoy." usd="" ves="" cop={showCop ? '' : undefined} background={WHITE} />
      ) : (
        movements.map((m) => (
          <Row
            key={m.id}
            concept={m.concept}
            usd={signedAmount(m, 'amount_usd')}
            ves={signedAmount(m, 'amount_ves')}
            cop={showCop ? signedAmount(m, 'amount_cop') : undefined}
            background={WHITE}
          />
        ))
      )}
      <Row
        concept="Saldo al Final del día"
        usd={formatMoney(saldoFinal.usdCents)}
        ves={formatMoney(saldoFinal.vesCents)}
        cop={cop(saldoFinal.copCents)}
        background={YELLOW}
        bold
      />
    </div>
  );
}

export async function generateReportImageBuffer(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance },
  label: string = 'Cierre',
  showCop: boolean = false
): Promise<Buffer> {
  const height = calculateImageHeight(ledger.movements.length);
  const imageResponse = new ImageResponse(
    buildReportImageElement(storeName, date, ledger, label, showCop),
    { width: showCop ? IMAGE_WIDTH_WITH_COP : IMAGE_WIDTH, height }
  );
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
